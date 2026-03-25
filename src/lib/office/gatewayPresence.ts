import type {
  SummaryPreviewSnapshot,
  SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import { buildAgentMainSessionKey } from "@/lib/gateway/GatewayClient";
import type { OfficeAgentPresence, OfficePresenceSnapshot } from "@/lib/office/presence";

type GatewayAgentsListEntry = {
  id?: string;
  name?: string;
  identity?: {
    name?: string;
  };
};

type GatewayAgentsListResult = {
  mainKey?: string;
  agents?: GatewayAgentsListEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const RECENT_ACTIVITY_MS = 45_000;

const resolveAgentsFromHelloSnapshot = (snapshot: unknown): GatewayAgentsListEntry[] => {
  if (!isRecord(snapshot)) return [];
  const health = isRecord(snapshot.health) ? snapshot.health : null;
  const rawAgents = Array.isArray(health?.agents) ? health.agents : [];
  return rawAgents.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = typeof entry.agentId === "string" ? entry.agentId.trim() : "";
    if (!id) return [];
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    return [
      {
        id,
        ...(name ? { name } : {}),
      },
    ];
  });
};

const normalizeGatewayAgentEntries = (
  agentsResult: GatewayAgentsListResult | null,
  helloSnapshot: unknown,
): GatewayAgentsListEntry[] => {
  const listedAgents = Array.isArray(agentsResult?.agents) ? agentsResult.agents : [];
  if (listedAgents.length > 0) return listedAgents;
  return resolveAgentsFromHelloSnapshot(helloSnapshot);
};

const resolvePreviewState = (
  agentId: string,
  agentsResult: GatewayAgentsListResult | null,
  previewSnapshot: SummaryPreviewSnapshot | null,
): OfficeAgentPresence["state"] | null => {
  const mainKey =
    typeof agentsResult?.mainKey === "string" && agentsResult.mainKey.trim().length > 0
      ? agentsResult.mainKey.trim()
      : "main";
  const sessionKey = buildAgentMainSessionKey(agentId, mainKey);
  const previews = Array.isArray(previewSnapshot?.previews) ? previewSnapshot.previews : [];
  const preview = previews.find((entry) => entry.key === sessionKey) ?? null;
  if (!preview || !Array.isArray(preview.items) || preview.items.length === 0) {
    return null;
  }
  for (let index = preview.items.length - 1; index >= 0; index -= 1) {
    const item = preview.items[index];
    if (!item) continue;
    if (item.role === "assistant") return "idle";
    if (item.role === "user") return "working";
  }
  return null;
};

const resolveAgentState = (
  agentId: string,
  agentsResult: GatewayAgentsListResult | null,
  statusSummary: SummaryStatusSnapshot | null,
  previewSnapshot: SummaryPreviewSnapshot | null,
  now = Date.now(),
): OfficeAgentPresence["state"] => {
  const previewState = resolvePreviewState(agentId, agentsResult, previewSnapshot);
  if (previewState) {
    return previewState;
  }
  const byAgent = Array.isArray(statusSummary?.sessions?.byAgent)
    ? statusSummary.sessions.byAgent
    : [];
  const recentEntries =
    byAgent.find((entry) => entry.agentId === agentId)?.recent?.filter(Boolean) ?? [];
  const latestUpdatedAt = recentEntries.reduce<number | null>((latest, entry) => {
    const updatedAt = typeof entry.updatedAt === "number" ? entry.updatedAt : null;
    if (updatedAt === null) return latest;
    return latest === null ? updatedAt : Math.max(latest, updatedAt);
  }, null);
  if (latestUpdatedAt === null) return "idle";
  if (now - latestUpdatedAt <= RECENT_ACTIVITY_MS) return "working";
  return "idle";
};

export const buildOfficePresenceSnapshotFromGateway = (params: {
  agentsResult: GatewayAgentsListResult | null;
  helloSnapshot?: unknown;
  statusSummary?: SummaryStatusSnapshot | null;
  previewSnapshot?: SummaryPreviewSnapshot | null;
  workspaceId?: string;
  now?: number;
}): OfficePresenceSnapshot => {
  const workspaceId = params.workspaceId?.trim() || "remote-gateway";
  const now = params.now ?? Date.now();
  const gatewayAgents = normalizeGatewayAgentEntries(
    params.agentsResult,
    params.helloSnapshot,
  );
  const agents: OfficeAgentPresence[] = gatewayAgents.flatMap((agent) => {
    const agentId = typeof agent.id === "string" ? agent.id.trim() : "";
    if (!agentId) return [];
    const name =
      (typeof agent.identity?.name === "string" ? agent.identity.name.trim() : "") ||
      (typeof agent.name === "string" ? agent.name.trim() : "") ||
      agentId;
    return [
      {
        agentId,
        name,
        state: resolveAgentState(
          agentId,
          params.agentsResult,
          params.statusSummary ?? null,
          params.previewSnapshot ?? null,
          now,
        ),
      },
    ];
  });
  return {
    workspaceId,
    timestamp: new Date(now).toISOString(),
    agents,
  };
};
