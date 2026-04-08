import { resolveExecApprovalEventEffects, type ExecApprovalEventEffects } from "@/features/agents/approvals/execApprovalLifecycleWorkflow";
import type { AgentState } from "@/features/agents/state/store";
import type { EventFrame } from "@/lib/gateway/GatewayClient";
import { parseAgentIdFromSessionKey } from "@/lib/gateway/sessionKeys";

export type CronTranscriptIntent = {
  agentId: string;
  sessionKey: string;
  dedupeKey: string;
  line: string;
  timestampMs: number;
  activityAtMs: number | null;
};

export type GatewayEventIngressDecision = {
  approvalEffects: ExecApprovalEventEffects | null;
  cronDedupeKeyToRecord: string | null;
  cronTranscriptIntent: CronTranscriptIntent | null;
};

const NO_CRON_DECISION = {
  cronDedupeKeyToRecord: null,
  cronTranscriptIntent: null,
} as const;

const resolveCronDecision = (params: {
  event: EventFrame;
  agents: AgentState[];
  seenCronDedupeKeys: ReadonlySet<string>;
  nowMs: number;
}): Pick<GatewayEventIngressDecision, "cronDedupeKeyToRecord" | "cronTranscriptIntent"> => {
  if (params.event.event !== "cron") {
    return NO_CRON_DECISION;
  }
  const payload = params.event.payload;
  if (!payload || typeof payload !== "object") {
    return NO_CRON_DECISION;
  }
  const record = payload as Record<string, unknown>;
  if (record.action !== "finished") {
    return NO_CRON_DECISION;
  }
  const sessionKey = typeof record.sessionKey === "string" ? record.sessionKey.trim() : "";
  if (!sessionKey) {
    return NO_CRON_DECISION;
  }
  const agentId = parseAgentIdFromSessionKey(sessionKey);
  if (!agentId) {
    return NO_CRON_DECISION;
  }
  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";
  if (!jobId) {
    return NO_CRON_DECISION;
  }
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const runAtMs = typeof record.runAtMs === "number" ? record.runAtMs : null;
  const status = typeof record.status === "string" ? record.status.trim() : "";
  const error = typeof record.error === "string" ? record.error.trim() : "";
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";

  const dedupeKey = `cron:${jobId}:${sessionId || (runAtMs ?? "none")}`;
  if (params.seenCronDedupeKeys.has(dedupeKey)) {
    return NO_CRON_DECISION;
  }

  const agent = params.agents.find((entry) => entry.agentId === agentId) ?? null;
  if (!agent) {
    return {
      cronDedupeKeyToRecord: dedupeKey,
      cronTranscriptIntent: null,
    };
  }

  const header = `Cron finished (${status || "unknown"}): ${jobId}`;
  const body = summary || error || "(no output)";
  return {
    cronDedupeKeyToRecord: dedupeKey,
    cronTranscriptIntent: {
      agentId,
      sessionKey: agent.sessionKey,
      dedupeKey,
      line: `${header}\n\n${body}`,
      timestampMs: runAtMs ?? params.nowMs,
      activityAtMs: runAtMs,
    },
  };
};

export const resolveGatewayEventIngressDecision = (params: {
  event: EventFrame;
  agents: AgentState[];
  seenCronDedupeKeys: ReadonlySet<string>;
  nowMs: number;
}): GatewayEventIngressDecision => {
  const approvalEffects = resolveExecApprovalEventEffects({
    event: params.event,
    agents: params.agents,
  });
  return {
    approvalEffects,
    ...resolveCronDecision(params),
  };
};
