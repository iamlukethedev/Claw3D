import { parseAgentIdFromSessionKey } from "@/lib/gateway/sessionKeys";

export type LatestUpdateKind = "heartbeat" | "cron" | null;

export type LatestUpdateIntent =
  | { kind: "reset" }
  | {
      kind: "fetch-heartbeat";
      agentId: string;
      sessionLimit: number;
      historyLimit: number;
    }
  | { kind: "fetch-cron"; agentId: string }
  | { kind: "noop" };

const SPECIAL_UPDATE_HEARTBEAT_RE = /\bheartbeat\b/i;
const SPECIAL_UPDATE_CRON_RE = /\bcron\b/i;
const HEARTBEAT_SESSION_LIMIT = 48;
const HEARTBEAT_HISTORY_LIMIT = 200;

export const resolveLatestUpdateKind = (message: string): LatestUpdateKind => {
  const lowered = message.toLowerCase();
  const heartbeatIndex = lowered.search(SPECIAL_UPDATE_HEARTBEAT_RE);
  const cronIndex = lowered.search(SPECIAL_UPDATE_CRON_RE);
  if (heartbeatIndex === -1 && cronIndex === -1) return null;
  if (heartbeatIndex === -1) return "cron";
  if (cronIndex === -1) return "heartbeat";
  return cronIndex > heartbeatIndex ? "cron" : "heartbeat";
};

export const resolveLatestUpdateIntent = (params: {
  message: string;
  agentId: string;
  sessionKey: string;
  hasExistingOverride: boolean;
}): LatestUpdateIntent => {
  const kind = resolveLatestUpdateKind(params.message);
  if (!kind) {
    return params.hasExistingOverride ? { kind: "reset" } : { kind: "noop" };
  }
  if (kind === "heartbeat") {
    const resolvedAgentId =
      params.agentId.trim() || parseAgentIdFromSessionKey(params.sessionKey) || "";
    if (!resolvedAgentId) {
      return { kind: "reset" };
    }
    return {
      kind: "fetch-heartbeat",
      agentId: resolvedAgentId,
      sessionLimit: HEARTBEAT_SESSION_LIMIT,
      historyLimit: HEARTBEAT_HISTORY_LIMIT,
    };
  }
  return {
    kind: "fetch-cron",
    agentId: params.agentId.trim(),
  };
};

export const buildLatestUpdatePatch = (
  content: string,
  kind?: "heartbeat" | "cron"
): {
  latestOverride: string | null;
  latestOverrideKind: "heartbeat" | "cron" | null;
} => {
  return {
    latestOverride: content || null,
    latestOverrideKind: content && kind ? kind : null,
  };
};
