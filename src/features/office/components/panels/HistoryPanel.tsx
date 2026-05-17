"use client";

import { useMemo, useState } from "react";

import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

import type { AgentState } from "@/features/agents/state/store";
import type { RunRecord, RunTriggerKind } from "@/features/office/hooks/useRunLog";

const formatClockTime = (timestampMs: number) =>
  new Date(timestampMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDuration = (startedAt: number, endedAt: number | null) => {
  const deltaMs = Math.max(0, (endedAt ?? Date.now()) - startedAt);
  const seconds = Math.floor(deltaMs / 1000);
  if (!endedAt) return `${Math.max(1, seconds)}s running`;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const TRIGGER_LABELS: Record<RunTriggerKind, string> = {
  user: "USER",
  heartbeat: "HEARTBEAT",
  cron: "CRON",
};

export function HistoryPanel({
  runs,
  agents,
  onSelectAgent,
}: {
  runs: RunRecord[];
  agents: AgentState[];
  onSelectAgent: (agentId: string) => void;
}) {
  const { t } = useTranslation();
  const [agentFilter, setAgentFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState<"all" | RunTriggerKind>("all");

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (agentFilter !== "all" && run.agentId !== agentFilter) return false;
      if (triggerFilter !== "all" && run.trigger !== triggerFilter) return false;
      return true;
    });
  }, [agentFilter, runs, triggerFilter]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          <T id="history.title" fallback="稽核日誌" />
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          <T id="history.subtitle" fallback="僅限此工作階段。生命週期事件從總部即時捕捉。" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-cyan-500/10 px-4 py-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            <T id="history.filter_agent" fallback="Agent" />
          </span>
          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
          >
            <option value="all">{t('history.filter_all_agents', '所有 Agent')}</option>
            {agents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.name || agent.agentId}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            <T id="history.filter_trigger" fallback="觸發" />
          </span>
          <select
            value={triggerFilter}
            onChange={(event) => setTriggerFilter(event.target.value as "all" | RunTriggerKind)}
            className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
          >
            <option value="all">{t('history.filter_all_triggers', '所有觸發')}</option>
            <option value="user">{t('history.filter_user', '使用者')}</option>
            <option value="heartbeat">{t('history.filter_heartbeat', '心跳')}</option>
            <option value="cron">{t('history.filter_cron', '排程')}</option>
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {filteredRuns.length === 0 ? (
          <div className="px-2 py-6 font-mono text-[11px] text-white/35">
            <T id="history.empty" fallback="此工作階段尚無執行記錄。" />
          </div>
        ) : (
          filteredRuns.map((run) => {
            const isRunning = run.endedAt === null;
            return (
              <button
                key={run.runId}
                type="button"
                onClick={() => onSelectAgent(run.agentId)}
                className="mb-2 flex w-full flex-col rounded border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isRunning
                        ? "bg-amber-400"
                        : run.outcome === "error"
                          ? "bg-rose-400"
                          : "bg-emerald-400"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                    {run.agentName}
                  </span>
                  <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                    {TRIGGER_LABELS[run.trigger]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/38">
                  <div>
                    <div><T id="history.started" fallback="已開始" /></div>
                    <div className="mt-1 text-[11px] text-white/75">{formatClockTime(run.startedAt)}</div>
                  </div>
                  <div>
                    <div><T id="history.duration" fallback="持續時間" /></div>
                    <div className="mt-1 text-[11px] text-white/75">
                      {formatDuration(run.startedAt, run.endedAt)}
                    </div>
                  </div>
                  <div>
                    <div><T id="history.outcome" fallback="結果" /></div>
                    <div className="mt-1 text-[11px] text-white/75">
                      {isRunning ? t('history.running', '執行中') : run.outcome === "error" ? t('history.error', '錯誤') : t('history.completed', '已完成')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
