"use client";

import { useMemo } from "react";

import type { AgentState } from "@/features/agents/state/store";
import { T, useTranslation } from '@/lib/i18n/TranslationProvider';

export function InboxPanel({
  agents,
  onSelectAgent,
}: {
  agents: AgentState[];
  onSelectAgent: (agentId: string) => void;
}) {
  const { t } = useTranslation();

  const formatRelativeTime = (timestampMs: number | null) => {
    if (!timestampMs) return t('inbox.time_no_output', '尚無輸出');
    const deltaMs = Date.now() - timestampMs;
    if (deltaMs < 60_000) return t('inbox.time_just_now', '剛剛');
    if (deltaMs < 3_600_000) return t('inbox.time_min_ago', '%{n} 分鐘前').replace('%{n}', String(Math.max(1, Math.floor(deltaMs / 60_000))));
    if (deltaMs < 86_400_000) return t('inbox.time_hour_ago', '%{n} 小時前').replace('%{n}', String(Math.max(1, Math.floor(deltaMs / 3_600_000))));
    return t('inbox.time_day_ago', '%{n} 天前').replace('%{n}', String(Math.max(1, Math.floor(deltaMs / 86_400_000))));
  };

  const sortedAgents = useMemo(
    () =>
      [...agents].sort(
        (left, right) =>
          (right.lastAssistantMessageAt ?? 0) - (left.lastAssistantMessageAt ?? 0) ||
          left.name.localeCompare(right.name)
      ),
    [agents]
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          Results Center
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          Latest assistant output from every desk.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sortedAgents.length === 0 ? (
          <div className="px-2 py-6 font-mono text-[11px] text-white/35">
            No agents are connected yet.
          </div>
        ) : (
          sortedAgents.map((agent) => {
            const preview = agent.latestPreview?.trim() || "No completed assistant output yet.";
            const isRunning = agent.status === "running";
            return (
              <button
                key={agent.agentId}
                type="button"
                onClick={() => onSelectAgent(agent.agentId)}
                className="mb-2 flex w-full flex-col rounded border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isRunning ? "bg-emerald-400" : "bg-amber-400/80"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                    {agent.name || agent.agentId}
                  </span>
                  {agent.hasUnseenActivity ? (
                    <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                      New
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 line-clamp-3 font-mono text-[12px] leading-5 text-white/70">
                  {preview}
                </div>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  {formatRelativeTime(agent.lastAssistantMessageAt)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
