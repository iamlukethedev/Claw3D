"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentState } from "@/features/agents/state/store";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  resolveExecApprovalAgentId,
} from "@/features/agents/approvals/execApprovalEvents";
import type { ExecApprovalDecision } from "@/features/agents/approvals/types";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

export type ApprovalRecord = {
  id: string;
  agentId: string | null;
  sessionKey: string | null;
  command: string;
  createdAtMs: number;
  expiresAtMs: number;
  resolvedAtMs: number | null;
  decision: ExecApprovalDecision | null;
  resolvedBy: string | null;
};

export type ApprovalAgentMetrics = {
  agentId: string;
  requestedCount: number;
  resolvedCount: number;
  deniedCount: number;
  allowOnceCount: number;
  allowAlwaysCount: number;
};

const MAX_APPROVAL_RECORDS = 300;

export const useApprovalMetrics = ({
  client,
  status,
  enabled = true,
  agents,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  enabled?: boolean;
  agents: AgentState[];
}) => {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const agentsRef = useRef(agents);
  const visibleRecords = useMemo(() => (enabled ? records : []), [enabled, records]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    if (!enabled) return;
    if (status !== "connected") return;
    return client.onEvent((event) => {
      const requested = parseExecApprovalRequested(event);
      if (requested) {
        const agentId = resolveExecApprovalAgentId({
          requested,
          agents: agentsRef.current,
        });
        const nextRecord: ApprovalRecord = {
          id: requested.id,
          agentId,
          sessionKey: requested.request.sessionKey,
          command: requested.request.command,
          createdAtMs: requested.createdAtMs,
          expiresAtMs: requested.expiresAtMs,
          resolvedAtMs: null,
          decision: null,
          resolvedBy: null,
        };
        setRecords((current) => {
          const withoutExisting = current.filter((record) => record.id !== requested.id);
          return [nextRecord, ...withoutExisting].slice(0, MAX_APPROVAL_RECORDS);
        });
        return;
      }

      const resolved = parseExecApprovalResolved(event);
      if (!resolved) return;
      setRecords((current) => {
        let updated = false;
        const next = current.map((record) => {
          if (record.id !== resolved.id) return record;
          updated = true;
          return {
            ...record,
            resolvedAtMs: resolved.ts,
            decision: resolved.decision,
            resolvedBy: resolved.resolvedBy,
          };
        });
        if (updated) return next;
        const fallbackRecord: ApprovalRecord = {
          id: resolved.id,
          agentId: null,
          sessionKey: null,
          command: "Unknown command",
          createdAtMs: resolved.ts,
          expiresAtMs: resolved.ts,
          resolvedAtMs: resolved.ts,
          decision: resolved.decision,
          resolvedBy: resolved.resolvedBy,
        };
        return [fallbackRecord, ...current].slice(0, MAX_APPROVAL_RECORDS);
      });
    });
  }, [client, enabled, status]);

  const byAgent = useMemo(() => {
    const metrics = new Map<string, ApprovalAgentMetrics>();
    for (const record of visibleRecords) {
      const agentId = record.agentId?.trim() ?? "";
      if (!agentId) continue;
      const current = metrics.get(agentId) ?? {
        agentId,
        requestedCount: 0,
        resolvedCount: 0,
        deniedCount: 0,
        allowOnceCount: 0,
        allowAlwaysCount: 0,
      };
      current.requestedCount += 1;
      if (record.decision) {
        current.resolvedCount += 1;
        if (record.decision === "deny") current.deniedCount += 1;
        if (record.decision === "allow-once") current.allowOnceCount += 1;
        if (record.decision === "allow-always") current.allowAlwaysCount += 1;
      }
      metrics.set(agentId, current);
    }
    return Array.from(metrics.values()).sort((left, right) => {
      if (right.requestedCount !== left.requestedCount) {
        return right.requestedCount - left.requestedCount;
      }
      return left.agentId.localeCompare(right.agentId);
    });
  }, [visibleRecords]);

  const totals = useMemo(() => {
    return {
      requestedCount: visibleRecords.length,
      resolvedCount: visibleRecords.filter((record) => record.decision !== null).length,
      deniedCount: visibleRecords.filter((record) => record.decision === "deny").length,
      allowOnceCount: visibleRecords.filter((record) => record.decision === "allow-once").length,
      allowAlwaysCount: visibleRecords.filter((record) => record.decision === "allow-always").length,
    };
  }, [visibleRecords]);

  return {
    records: visibleRecords,
    byAgent,
    totals,
  };
};
