import { NextResponse } from "next/server";
import type {
  SummaryPreviewSnapshot,
  SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";

import {
  fetchRemoteOfficePresenceSnapshot,
  loadOfficePresenceSnapshot,
} from "@/lib/office/presence";
import { buildOfficePresenceSnapshotFromGateway } from "@/lib/office/gatewayPresence";
import { NodeGatewayClient, buildAgentMainSessionKey } from "@/lib/gateway/nodeGatewayClient";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import { resolveOfficePreference } from "@/lib/studio/settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source")?.trim() || "local";
    const workspaceId = url.searchParams.get("workspaceId")?.trim() || "default";
    if (source === "remote" || source === "remote_gateway") {
      const settings = loadStudioSettings();
      const gatewayUrl = settings.gateway?.url?.trim() || "";
      const officePreference = resolveOfficePreference(settings, gatewayUrl);
      if (
        !officePreference.remoteOfficeEnabled ||
        (source === "remote"
          ? !officePreference.remoteOfficePresenceUrl.trim()
          : !officePreference.remoteOfficeGatewayUrl.trim())
      ) {
        return NextResponse.json(
          {
            workspaceId: "remote",
            timestamp: new Date().toISOString(),
            agents: [],
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (source === "remote") {
        const startedAt = Date.now();
        console.info("[office-presence] Fetching remote office presence.", {
          presenceUrl: officePreference.remoteOfficePresenceUrl,
          tokenConfigured: Boolean(officePreference.remoteOfficeToken?.trim()),
        });
        const snapshot = await fetchRemoteOfficePresenceSnapshot({
          presenceUrl: officePreference.remoteOfficePresenceUrl,
          token: officePreference.remoteOfficeToken,
          timeoutMs: 15_000,
        });
        console.info("[office-presence] Remote office presence loaded.", {
          presenceUrl: officePreference.remoteOfficePresenceUrl,
          elapsedMs: Date.now() - startedAt,
          agentCount: snapshot.agents.length,
        });
        return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
      }

      const startedAt = Date.now();
      const gatewayClient = new NodeGatewayClient();
      try {
        await gatewayClient.connect({
          gatewayUrl: officePreference.remoteOfficeGatewayUrl,
          token: officePreference.remoteOfficeToken,
        });
        const agentsResult = (await gatewayClient.request("agents.list", {})) as {
          mainKey?: string;
          agents?: Array<{ id?: string; name?: string; identity?: { name?: string } }>;
        };
        const statusSummary = (await gatewayClient.request(
          "status",
          {},
        )) as SummaryStatusSnapshot;
        const remoteAgentIds = Array.isArray(agentsResult.agents)
          ? agentsResult.agents
              .map((agent) => (typeof agent.id === "string" ? agent.id.trim() : ""))
              .filter((agentId) => agentId.length > 0)
          : [];
        const sessionKeys = remoteAgentIds.map((agentId) =>
          buildAgentMainSessionKey(agentId, agentsResult.mainKey?.trim() || "main"),
        );
        const previewSnapshot: SummaryPreviewSnapshot | null =
          sessionKeys.length > 0
            ? ((await gatewayClient.request("sessions.preview", {
                keys: sessionKeys,
                limit: 8,
                maxChars: 240,
              })) as SummaryPreviewSnapshot)
            : null;
        const snapshot = buildOfficePresenceSnapshotFromGateway({
          agentsResult,
          statusSummary,
          previewSnapshot,
          workspaceId: "remote-gateway",
        });
        console.info("[office-presence] Remote gateway presence loaded.", {
          gatewayUrl: officePreference.remoteOfficeGatewayUrl,
          elapsedMs: Date.now() - startedAt,
          agentCount: snapshot.agents.length,
        });
        return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
      } finally {
        gatewayClient.close();
      }
    }
    const snapshot = loadOfficePresenceSnapshot(workspaceId);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load office presence.";
    console.error("[office-presence] Failed to load office presence.", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
