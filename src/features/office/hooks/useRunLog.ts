"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import type { AgentEventPayload } from "@/features/agents/state/runtimeEventBridge";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isSameSessionKey } from "@/lib/gateway/GatewayClient";
import { isHeartbeatPrompt } from "@/lib/text/message-extract";

export type RunTriggerKind = "user" | "heartbeat" | "cron";
export type RunOutcomeKind = "ok" | "error" | null;

export type RunRecord = {
  runId: string;
  agentId: string;
  agentName: string;
  startedAt: number;
  endedAt: number | null;
  outcome: RunOutcomeKind;
  trigger: RunTriggerKind;
};

const MAX_RUN_RECORDS = 200;

const resolveRunTrigger = (agent: AgentState): RunTriggerKind => {
  if (agent.latestOverrideKind === "heartbeat" || agent.latestOverrideKind === "cron") {
    return agent.latestOverrideKind;
  }
  const lastUserMessage = agent.lastUserMessage?.trim() ?? "";
  if (lastUserMessage && isHeartbeatPrompt(lastUserMessage)) {
    return "heartbeat";
  }
  return "user";
};

const resolveLifecyclePhase = (payload: AgentEventPayload): "start" | "end" | "error" | null => {
  if (payload.stream !== "lifecycle") return null;
  const phase = typeof payload.data?.phase === "string" ? payload.data.phase.trim() : "";
  if (phase === "start" || phase === "end" || phase === "error") {
    return phase;
  }
  return null;
};

const findAgentForRunEvent = (
  agents: AgentState[],
  payload: AgentEventPayload
): AgentState | null => {
  const sessionKey = payload.sessionKey?.trim() ?? "";
  if (sessionKey) {
    const bySession = agents.find((agent) => isSameSessionKey(agent.sessionKey, sessionKey));
    if (bySession) return bySession;
  }
  return agents.find((agent) => agent.runId === payload.runId) ?? null;
};

export const useRunLog = ({
  client,
  status,
  enabled = true,
  agents,
  maxRecords = MAX_RUN_RECORDS,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  enabled?: boolean;
  agents: AgentState[];
  maxRecords?: number;
}) => {
  const [records, setRecords] = useState<RunRecord[]>([]);
  const agentsRef = useRef(agents);
  const visibleRecords = useMemo(() => (enabled ? records : []), [enabled, records]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    if (!enabled) return;
    if (status !== "connected") return;
    return client.onEvent((event) => {
      if (event.event !== "agent") return;
      const payload = event.payload as AgentEventPayload | undefined;
      if (!payload?.runId) return;
      const phase = resolveLifecyclePhase(payload);
      if (!phase) return;

      const agent = findAgentForRunEvent(agentsRef.current, payload);
      if (!agent) return;
      const timestamp = Date.now();

      setRecords((current) => {
        if (phase === "start") {
          const nextRecord: RunRecord = {
            runId: payload.runId,
            agentId: agent.agentId,
            agentName: agent.name || agent.agentId,
            startedAt: timestamp,
            endedAt: null,
            outcome: null,
            trigger: resolveRunTrigger(agent),
          };
          const withoutExisting = current.filter((record) => record.runId !== payload.runId);
          return [nextRecord, ...withoutExisting].slice(0, Math.max(1, maxRecords));
        }

        let updated = false;
        const next = current.map((record) => {
          if (record.runId !== payload.runId) return record;
          updated = true;
          const outcome: RunOutcomeKind = phase === "error" ? "error" : "ok";
          return {
            ...record,
            endedAt: timestamp,
            outcome,
          };
        });
        if (updated) return next;

        const fallbackOutcome: RunOutcomeKind = phase === "error" ? "error" : "ok";
        const fallbackRecord: RunRecord = {
          runId: payload.runId,
          agentId: agent.agentId,
          agentName: agent.name || agent.agentId,
          startedAt: timestamp,
          endedAt: timestamp,
          outcome: fallbackOutcome,
          trigger: resolveRunTrigger(agent),
        };
        return [fallbackRecord, ...current].slice(0, Math.max(1, maxRecords));
      });
    });
  }, [client, enabled, maxRecords, status]);

  return visibleRecords;
};
