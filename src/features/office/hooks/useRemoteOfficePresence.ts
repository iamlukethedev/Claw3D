"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SummaryPreviewSnapshot,
  SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import {
  buildAgentMainSessionKey,
  GatewayClient,
  isGatewayDisconnectLikeError,
} from "@/lib/gateway/GatewayClient";
import { buildOfficePresenceSnapshotFromGateway } from "@/lib/office/gatewayPresence";
import type { OfficePresenceSnapshot } from "@/lib/office/presence";

type UseRemoteOfficePresenceParams = {
  enabled: boolean;
  sourceKind: "presence_endpoint" | "openclaw_gateway";
  presenceUrl: string;
  gatewayUrl: string;
  pollIntervalMs?: number;
};

type UseRemoteOfficePresenceResult = {
  error: string | null;
  loaded: boolean;
  snapshot: OfficePresenceSnapshot | null;
};

const normalizeRemoteGatewayUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:") {
      return `ws://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (parsed.protocol === "https:") {
      return `wss://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
};

export const useRemoteOfficePresence = ({
  enabled,
  sourceKind,
  presenceUrl,
  gatewayUrl,
  pollIntervalMs = 5_000,
}: UseRemoteOfficePresenceParams): UseRemoteOfficePresenceResult => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OfficePresenceSnapshot | null>(null);
  const successLoggedRef = useRef(false);
  const lastLoggedErrorRef = useRef<string | null>(null);
  const normalizedGatewayUrl = useMemo(
    () => normalizeRemoteGatewayUrl(gatewayUrl),
    [gatewayUrl],
  );
  const active =
    enabled &&
    (sourceKind === "presence_endpoint"
      ? presenceUrl.trim().length > 0
      : normalizedGatewayUrl.length > 0);
  const requestUrl = useMemo(() => {
    if (!active) return "";
    const searchParams = new URLSearchParams({
      source: sourceKind === "presence_endpoint" ? "remote" : "remote_gateway",
    });
    return `/api/office/presence?${searchParams.toString()}`;
  }, [active, sourceKind]);

  useEffect(() => {
    if (!active) return;
    console.info("[remote-office] Starting presence polling.", {
      sourceKind,
      configuredPresenceUrl: presenceUrl,
      configuredGatewayUrl: normalizedGatewayUrl,
      requestUrl,
      pollIntervalMs,
    });
    let cancelled = false;
    let intervalId: number | null = null;
    let gatewayClient: GatewayClient | null = null;
    let gatewayConnected = false;
    let loadInFlight = false;
    const loadFromPresenceEndpoint = async () => {
      try {
        const response = await fetch(requestUrl, { cache: "no-store" });
        const payload = (await response.json()) as
          | OfficePresenceSnapshot
          | { error?: string };
        if (!response.ok) {
          const errorMessage =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Failed to load remote office presence.";
          throw new Error(
            errorMessage
          );
        }
        if (cancelled) return;
        setSnapshot(payload as OfficePresenceSnapshot);
        setError(null);
        if (!successLoggedRef.current) {
          const resolvedSnapshot = payload as OfficePresenceSnapshot;
          console.info("[remote-office] Presence polling succeeded.", {
            configuredPresenceUrl: presenceUrl,
            agentCount: resolvedSnapshot.agents.length,
            timestamp: resolvedSnapshot.timestamp,
          });
          successLoggedRef.current = true;
          lastLoggedErrorRef.current = null;
        }
      } catch (loadError) {
        if (cancelled) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load remote office presence.";
        setError(message);
        if (lastLoggedErrorRef.current !== message) {
          console.warn("[remote-office] Presence polling failed.", {
            configuredPresenceUrl: presenceUrl,
            error: message,
          });
          lastLoggedErrorRef.current = message;
          successLoggedRef.current = false;
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    const loadFromGateway = async () => {
      if (loadInFlight) {
        console.debug("[remote-office] Skipping overlapping gateway poll.", {
          configuredGatewayUrl: normalizedGatewayUrl,
        });
        return;
      }
      loadInFlight = true;
      try {
        if (!gatewayClient) {
          gatewayClient = new GatewayClient();
          console.info("[remote-office] Created remote gateway client.", {
            configuredGatewayUrl: normalizedGatewayUrl,
          });
        }
        if (!gatewayConnected) {
          console.info("[remote-office] Connecting to remote gateway.", {
            configuredGatewayUrl: normalizedGatewayUrl,
          });
          await gatewayClient.connect({
            gatewayUrl: normalizedGatewayUrl,
          });
          gatewayConnected = true;
          console.info("[remote-office] Remote gateway connected.", {
            configuredGatewayUrl: normalizedGatewayUrl,
          });
        }
        console.info("[remote-office] Requesting remote gateway agents list.", {
          configuredGatewayUrl: normalizedGatewayUrl,
        });
        const agentsResult = (await gatewayClient.call("agents.list", {})) as {
          mainKey?: string;
          agents?: Array<{ id?: string; name?: string; identity?: { name?: string } }>;
        };
        console.info("[remote-office] Remote gateway agents list loaded.", {
          configuredGatewayUrl: normalizedGatewayUrl,
          agentCount: Array.isArray(agentsResult.agents) ? agentsResult.agents.length : 0,
        });
        console.info("[remote-office] Requesting remote gateway status.", {
          configuredGatewayUrl: normalizedGatewayUrl,
        });
        const statusSummary = (await gatewayClient.call(
          "status",
          {}
        )) as SummaryStatusSnapshot;
        console.info("[remote-office] Remote gateway status loaded.", {
          configuredGatewayUrl: normalizedGatewayUrl,
          byAgentCount: Array.isArray(statusSummary.sessions?.byAgent)
            ? statusSummary.sessions?.byAgent.length
            : 0,
        });
        const remoteAgentIds = Array.isArray(agentsResult.agents)
          ? agentsResult.agents
              .map((agent) => (typeof agent.id === "string" ? agent.id.trim() : ""))
              .filter((agentId) => agentId.length > 0)
          : [];
        const sessionKeys = remoteAgentIds.map((agentId) =>
          buildAgentMainSessionKey(agentId, agentsResult.mainKey?.trim() || "main"),
        );
        const previewSnapshot =
          sessionKeys.length > 0
            ? ((await gatewayClient.call("sessions.preview", {
                keys: sessionKeys,
                limit: 8,
                maxChars: 240,
              })) as SummaryPreviewSnapshot)
            : null;
        const nextSnapshot = buildOfficePresenceSnapshotFromGateway({
          agentsResult,
          helloSnapshot: gatewayClient.getLastHello()?.snapshot,
          statusSummary,
          previewSnapshot,
          workspaceId: "remote-gateway",
        });
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setError(null);
        if (!successLoggedRef.current) {
          console.info("[remote-office] Gateway presence polling succeeded.", {
            configuredGatewayUrl: normalizedGatewayUrl,
            agentCount: nextSnapshot.agents.length,
            timestamp: nextSnapshot.timestamp,
          });
          successLoggedRef.current = true;
          lastLoggedErrorRef.current = null;
        }
      } catch (loadError) {
        if (cancelled) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load remote gateway presence.";
        setError(message);
        if (isGatewayDisconnectLikeError(loadError)) {
          gatewayConnected = false;
          gatewayClient?.disconnect();
          gatewayClient = null;
        }
        if (lastLoggedErrorRef.current !== message) {
          console.warn("[remote-office] Gateway presence polling failed.", {
            configuredGatewayUrl: normalizedGatewayUrl,
            error: message,
          });
          lastLoggedErrorRef.current = message;
          successLoggedRef.current = false;
        }
      } finally {
        loadInFlight = false;
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };
    const loadSnapshot = requestUrl ? loadFromPresenceEndpoint : loadFromGateway;
    void loadSnapshot();
    intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, Math.max(1_000, pollIntervalMs));
    return () => {
      cancelled = true;
      successLoggedRef.current = false;
      lastLoggedErrorRef.current = null;
      gatewayClient?.disconnect();
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [active, normalizedGatewayUrl, pollIntervalMs, presenceUrl, requestUrl, sourceKind]);

  return {
    error: active ? error : null,
    loaded: active ? loaded : false,
    snapshot: active ? snapshot : null,
  };
};
