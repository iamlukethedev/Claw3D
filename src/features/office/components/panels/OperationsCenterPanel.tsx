"use client";

import { useMemo } from "react";

import type { AgentState } from "@/features/agents/state/store";
import type { RunRecord } from "@/features/office/hooks/useRunLog";

export type OperationsCenterFeedEvent = {
  id: string;
  name: string;
  text: string;
  ts: number;
  kind?: "status" | "reply" | "external";
  effect?: "confetti" | "alarm" | "doorbell" | null;
};

type OperationsCenterPanelProps = {
  agents: AgentState[];
  runLog: RunRecord[];
  feedEvents: OperationsCenterFeedEvent[];
  onSelectAgent: (agentId: string) => void;
};

const formatRelativeTime = (timestampMs: number | null | undefined) => {
  if (!timestampMs) return "No activity";
  const deltaMs = Date.now() - timestampMs;
  if (deltaMs < 60_000) return "Just now";
  if (deltaMs < 3_600_000) return `${Math.max(1, Math.floor(deltaMs / 60_000))}m ago`;
  if (deltaMs < 86_400_000) return `${Math.max(1, Math.floor(deltaMs / 3_600_000))}h ago`;
  return `${Math.max(1, Math.floor(deltaMs / 86_400_000))}d ago`;
};

const resolveAgentCondition = (agent: AgentState): "running" | "waiting" | "error" | "idle" => {
  if (agent.status === "error") return "error";
  if (agent.awaitingUserInput) return "waiting";
  if (agent.status === "running" || agent.runId) return "running";
  return "idle";
};

const CONDITION_STYLES: Record<ReturnType<typeof resolveAgentCondition>, string> = {
  running: "bg-emerald-400",
  waiting: "bg-amber-300",
  error: "bg-rose-400",
  idle: "bg-cyan-300/70",
};

export function OperationsCenterPanel({
  agents,
  runLog,
  feedEvents,
  onSelectAgent,
}: OperationsCenterPanelProps) {
  const summary = useMemo(() => {
    const running = agents.filter((agent) => resolveAgentCondition(agent) === "running").length;
    const waiting = agents.filter((agent) => resolveAgentCondition(agent) === "waiting").length;
    const error = agents.filter((agent) => resolveAgentCondition(agent) === "error").length;
    const unseen = agents.filter((agent) => agent.hasUnseenActivity).length;
    return { total: agents.length, running, waiting, error, unseen };
  }, [agents]);

  const sortedAgents = useMemo(
    () =>
      [...agents].sort((left, right) => {
        const conditionOrder = { error: 0, waiting: 1, running: 2, idle: 3 };
        const conditionDelta =
          conditionOrder[resolveAgentCondition(left)] -
          conditionOrder[resolveAgentCondition(right)];
        if (conditionDelta !== 0) return conditionDelta;
        return (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0) || left.name.localeCompare(right.name);
      }),
    [agents],
  );

  const recentRuns = useMemo(() => runLog.slice(0, 4), [runLog]);
  const recentEvents = useMemo(() => feedEvents.slice(0, 4), [feedEvents]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          Operations Center
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          Fleet state, activity, and run flow at a glance.
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 border-b border-cyan-500/10 px-3 py-3">
        {[
          ["Agents", summary.total],
          ["Running", summary.running],
          ["Waiting", summary.waiting],
          ["Errors", summary.error],
          ["Unread", summary.unseen],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-white/8 bg-white/[0.03] px-2 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
              {label}
            </div>
            <div className="mt-1 font-mono text-[16px] font-semibold text-cyan-100">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 rounded border border-cyan-500/10 bg-cyan-500/[0.04] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">
            Fleet roster
          </div>
          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1">
            {sortedAgents.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">
                No agents are connected yet.
              </div>
            ) : (
              sortedAgents.map((agent) => {
                const condition = resolveAgentCondition(agent);
                return (
                  <button
                    key={agent.agentId}
                    type="button"
                    onClick={() => onSelectAgent(agent.agentId)}
                    className="rounded border border-white/8 bg-black/20 px-3 py-2 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/[0.05]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${CONDITION_STYLES[condition]}`} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                        {agent.name || agent.agentId}
                      </span>
                      <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                        {condition}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-white/45">
                      {agent.role?.trim() || agent.identityName?.trim() || "No role label"}
                    </div>
                    <div className="mt-2 line-clamp-2 font-mono text-[11px] leading-4 text-white/65">
                      {agent.streamText?.trim() ||
                        agent.latestPreview?.trim() ||
                        agent.lastUserMessage?.trim() ||
                        "No current activity."}
                    </div>
                    <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
                      {formatRelativeTime(agent.lastActivityAt)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mb-2 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
            Recent runs
          </div>
          <div className="mt-2 grid gap-2">
            {recentRuns.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">
                No run lifecycle events captured yet.
              </div>
            ) : (
              recentRuns.map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  onClick={() => onSelectAgent(run.agentId)}
                  className="rounded border border-white/8 bg-black/20 px-2.5 py-2 text-left transition-colors hover:border-cyan-400/25"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        run.endedAt === null
                          ? "bg-amber-300"
                          : run.outcome === "error"
                            ? "bg-rose-400"
                            : "bg-emerald-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/75">
                      {run.agentName}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                      {run.endedAt === null ? "running" : run.outcome ?? "done"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
            Activity stream
          </div>
          <div className="mt-2 grid gap-2">
            {recentEvents.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">
                No recent office feed events.
              </div>
            ) : (
              recentEvents.map((event) => (
                <button
                  key={`${event.id}-${event.ts}-${event.text}`}
                  type="button"
                  onClick={() => onSelectAgent(event.id)}
                  className="rounded border border-white/8 bg-black/20 px-2.5 py-2 text-left transition-colors hover:border-cyan-400/25"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/75">
                      {event.name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
                      {event.kind ?? "status"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 font-mono text-[11px] leading-4 text-white/60">
                    {event.text}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
