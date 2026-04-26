import { useCallback, useEffect, useRef } from "react";

import {
  resolveGatewayModelsSyncIntent,
  resolveSandboxRepairIntent,
  shouldRefreshGatewayConfigForSettingsRoute,
  type GatewayConnectionStatus,
} from "@/features/agents/operations/gatewayConfigSyncWorkflow";
import { updateGatewayAgentOverrides } from "@/lib/gateway/agentConfig";
import {
  buildGatewayModelChoices,
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

const defaultLogError = (message: string, err: unknown) => {
  console.error(message, err);
};

export type UseGatewayConfigSyncControllerParams = {
  client: GatewayClient;
  status: GatewayConnectionStatus;
  enabled?: boolean;
  settingsRouteActive: boolean;
  inspectSidebarAgentId: string | null;
  gatewayConfigSnapshot: GatewayModelPolicySnapshot | null;
  setGatewayConfigSnapshot: (snapshot: GatewayModelPolicySnapshot | null) => void;
  setGatewayModels: (models: GatewayModelChoice[]) => void;
  setGatewayModelsError: (message: string | null) => void;
  enqueueConfigMutation: (params: {
    kind: "repair-sandbox-tool-allowlist";
    label: string;
    run: () => Promise<void>;
    requiresIdleAgents?: boolean;
  }) => Promise<void>;
  loadAgents: () => Promise<void>;
  isDisconnectLikeError: (err: unknown) => boolean;
  logError?: (message: string, err: unknown) => void;
};

export type GatewayConfigSyncController = {
  refreshGatewayConfigSnapshot: () => Promise<GatewayModelPolicySnapshot | null>;
};

export function useGatewayConfigSyncController(
  params: UseGatewayConfigSyncControllerParams
): GatewayConfigSyncController {
  const sandboxRepairAttemptedRef = useRef(false);
  const {
    client,
    status,
    enabled = true,
    settingsRouteActive,
    inspectSidebarAgentId,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    setGatewayModels,
    setGatewayModelsError,
    enqueueConfigMutation,
    loadAgents,
    isDisconnectLikeError,
  } = params;

  const logError = params.logError ?? defaultLogError;

  const refreshGatewayConfigSnapshot = useCallback(async () => {
    if (!enabled) return null;
    if (status !== "connected") return null;
    try {
      const snapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
      setGatewayConfigSnapshot(snapshot);
      return snapshot;
    } catch (err) {
      if (!isDisconnectLikeError(err)) {
        logError("Failed to refresh gateway config.", err);
      }
      return null;
    }
  }, [client, enabled, isDisconnectLikeError, setGatewayConfigSnapshot, status, logError]);

  useEffect(() => {
    if (enabled) return;
    setGatewayModels([]);
    setGatewayModelsError(null);
    setGatewayConfigSnapshot(null);
  }, [enabled, setGatewayConfigSnapshot, setGatewayModels, setGatewayModelsError]);

  useEffect(() => {
    if (!enabled) return;
    const repairIntent = resolveSandboxRepairIntent({
      status,
      attempted: sandboxRepairAttemptedRef.current,
      snapshot: gatewayConfigSnapshot,
    });
    if (repairIntent.kind !== "repair") return;

    sandboxRepairAttemptedRef.current = true;
    void enqueueConfigMutation({
      kind: "repair-sandbox-tool-allowlist",
      label: "Repair sandbox tool access",
      run: async () => {
        for (const agentId of repairIntent.agentIds) {
          await updateGatewayAgentOverrides({
            client,
            agentId,
            overrides: {
              tools: {
                sandbox: {
                  tools: {
                    allow: ["*"],
                  },
                },
              },
            },
          });
        }
        await loadAgents();
      },
    });
  }, [client, enabled, enqueueConfigMutation, gatewayConfigSnapshot, loadAgents, status]);

  useEffect(() => {
    if (!enabled) return;
    if (
      !shouldRefreshGatewayConfigForSettingsRoute({
        status,
        settingsRouteActive,
        inspectSidebarAgentId,
      })
    ) {
      return;
    }
    void refreshGatewayConfigSnapshot();
  }, [enabled, inspectSidebarAgentId, refreshGatewayConfigSnapshot, settingsRouteActive, status]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const syncIntent = resolveGatewayModelsSyncIntent({ status });
    if (syncIntent.kind === "clear") {
      setGatewayModels([]);
      setGatewayModelsError(null);
      setGatewayConfigSnapshot(null);
      return;
    }

    let cancelled = false;
    const loadModels = async () => {
      let configSnapshot: GatewayModelPolicySnapshot | null = null;
      try {
        configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
        if (!cancelled) {
          setGatewayConfigSnapshot(configSnapshot);
        }
      } catch (err) {
        if (!isDisconnectLikeError(err)) {
          logError("Failed to load gateway config.", err);
        }
      }

      try {
        const result = await client.call<{ models: GatewayModelChoice[] }>(
          "models.list",
          {}
        );
        if (cancelled) return;
        const catalog = Array.isArray(result.models) ? result.models : [];
        setGatewayModels(buildGatewayModelChoices(catalog, configSnapshot));
        setGatewayModelsError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load models.";
        setGatewayModelsError(message);
        setGatewayModels([]);
        if (!isDisconnectLikeError(err)) {
          logError("Failed to load gateway models.", err);
        }
      }
    };

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [
    client,
    isDisconnectLikeError,
    setGatewayConfigSnapshot,
    setGatewayModels,
    setGatewayModelsError,
    enabled,
    status,
    logError,
  ]);

  return {
    refreshGatewayConfigSnapshot,
  };
}
