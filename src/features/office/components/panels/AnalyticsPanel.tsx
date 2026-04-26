"use client";

import { useMemo, useRef } from "react";

import { CalendarDays } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import { useApprovalMetrics } from "@/features/office/hooks/useApprovalMetrics";
import { useOfficeUsageAnalyticsViewModel } from "@/features/office/hooks/useOfficeUsageAnalyticsViewModel";
import { usePerformanceAnalytics } from "@/features/office/hooks/usePerformanceAnalytics";
import type { RunRecord } from "@/features/office/hooks/useRunLog";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import {
  formatCurrency,
  formatNumber,
} from "@/lib/office/usageAnalyticsPresentation";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
};

const formatDuration = (valueMs: number | null | undefined) => {
  if (!valueMs) return "n/a";
  const seconds = Math.round(valueMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const formatBudgetInput = (value: number | null) => (value === null ? "" : String(value));

const parseBudgetInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="rounded border border-white/8 bg-white/[0.03] px-3 py-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</div>
    <div className="mt-2 font-mono text-[18px] font-semibold text-white/90">{value}</div>
    <div className="mt-1 font-mono text-[10px] text-white/35">{hint}</div>
  </div>
);

const openNativeDatePicker = (input: HTMLInputElement | null) => {
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }
  input.focus();
};

const DatePickerField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </span>
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => openNativeDatePicker(inputRef.current)}
          className="w-full rounded border border-white/10 bg-black/50 px-2 py-2 pr-9 font-mono text-[11px] text-white/80 outline-none"
        />
        <button
          type="button"
          onClick={() => openNativeDatePicker(inputRef.current)}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-white/40 transition-colors hover:text-cyan-200"
          aria-label={`Open ${label.toLowerCase()} calendar`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
        </button>
      </div>
    </label>
  );
};

export function AnalyticsPanel({
  client,
  status,
  approvalsEnabled = true,
  agents,
  runLog,
  gatewayUrl,
  settingsCoordinator,
  onSelectAgent,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  approvalsEnabled?: boolean;
  agents: AgentState[];
  runLog: RunRecord[];
  gatewayUrl: string;
  settingsCoordinator: StudioSettingsCoordinator;
  onSelectAgent: (agentId: string) => void;
}) {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    budgets,
    settingsLoaded,
    usage,
    updateBudget,
  } = useOfficeUsageAnalyticsViewModel({
    client,
    status,
    agents,
    gatewayUrl,
    settingsCoordinator,
  });

  const approvalMetrics = useApprovalMetrics({
    client,
    status,
    enabled: approvalsEnabled,
    agents,
  });
  const performance = usePerformanceAnalytics({
    agents,
    runLog,
    approvalByAgent: approvalMetrics.byAgent,
  });

  const dailyChartMax = useMemo(() => {
    return usage.costDaily.reduce((max, entry) => Math.max(max, entry.totalCost), 0);
  }, [usage.costDaily]);

  const alertBannerClass =
    usage.budgetAlerts.some((alert) => alert.severity === "danger")
      ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
      : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
          Analytics
        </div>
        <div className="mt-1 font-mono text-[11px] text-white/40">
          Real usage, spend, and agent trust metrics for headquarters.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <DatePickerField label="Start" value={startDate} onChange={setStartDate} />
          <DatePickerField label="End" value={endDate} onChange={setEndDate} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] text-white/35">
            {usage.lastRefreshedAt
              ? `Last refresh ${new Date(usage.lastRefreshedAt).toLocaleTimeString()}`
              : "No analytics snapshot yet"}
          </div>
          <button
            type="button"
            onClick={() => void usage.refresh()}
            className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-100"
          >
            Refresh
          </button>
        </div>

        {usage.error ? (
          <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-100">
            {usage.error}
          </div>
        ) : null}

        {usage.budgetAlerts.length > 0 ? (
          <div className={`mt-3 rounded border px-3 py-2 font-mono text-[11px] ${alertBannerClass}`}>
            {usage.budgetAlerts.map((alert) => (
              <div key={alert.key}>
                {alert.label}: {formatCurrency(alert.currentUsd)} / {formatCurrency(alert.limitUsd)}.
              </div>
            ))}
          </div>
        ) : settingsLoaded ? (
          <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-100">
            Budgets are within threshold.
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatCard
            label="Total Spend"
            value={formatCurrency(usage.totals.totalCost)}
            hint="Selected range."
          />
          <StatCard
            label="Total Tokens"
            value={formatNumber(usage.totals.totalTokens)}
            hint="Input + output + cache."
          />
          <StatCard
            label="Success Rate"
            value={formatPercent(performance.fleet.successRate)}
            hint="Completed runs only."
          />
          <StatCard
            label="Avg Runtime"
            value={formatDuration(performance.fleet.avgRuntimeMs)}
            hint="Session-local run history."
          />
        </div>

        <div className="mt-5 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            Budget Limits
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/35">Daily USD</span>
              <input
                value={formatBudgetInput(budgets.dailySpendLimitUsd)}
                onChange={(event) =>
                  updateBudget("dailySpendLimitUsd", parseBudgetInput(event.target.value))
                }
                placeholder="No limit"
                inputMode="decimal"
                className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/35">Monthly USD</span>
              <input
                value={formatBudgetInput(budgets.monthlySpendLimitUsd)}
                onChange={(event) =>
                  updateBudget("monthlySpendLimitUsd", parseBudgetInput(event.target.value))
                }
                placeholder="No limit"
                inputMode="decimal"
                className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/35">Per-agent USD</span>
              <input
                value={formatBudgetInput(budgets.perAgentSoftLimitUsd)}
                onChange={(event) =>
                  updateBudget("perAgentSoftLimitUsd", parseBudgetInput(event.target.value))
                }
                placeholder="Soft limit"
                inputMode="decimal"
                className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/35">Alert threshold %</span>
              <input
                value={String(budgets.alertThresholdPct)}
                onChange={(event) =>
                  updateBudget(
                    "alertThresholdPct",
                    Math.min(100, Math.max(1, parseBudgetInput(event.target.value) ?? 80))
                  )
                }
                inputMode="numeric"
                className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            Daily Cost
          </div>
          {usage.loading ? (
            <div className="mt-3 font-mono text-[11px] text-white/40">Loading usage data.</div>
          ) : usage.costDaily.length === 0 ? (
            <div className="mt-3 font-mono text-[11px] text-white/35">
              No cost data in the selected range.
            </div>
          ) : (
            <div className="mt-3 flex items-end gap-1">
              {usage.costDaily.map((entry) => {
                const heightPct = dailyChartMax > 0 ? (entry.totalCost / dailyChartMax) * 100 : 0;
                return (
                  <div key={entry.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="font-mono text-[9px] text-white/35">
                      {formatCurrency(entry.totalCost)}
                    </div>
                    <div className="flex h-28 w-full items-end rounded bg-black/40 px-1">
                      <div
                        className="w-full rounded-t bg-rose-400/80"
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                        title={`${entry.date} · ${formatCurrency(entry.totalCost)}`}
                      />
                    </div>
                    <div className="font-mono text-[9px] text-white/35">
                      {entry.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 rounded border border-white/8 bg-black/25 px-3 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
              Cost Breakdown
            </div>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-white/70">
              <div>Input: {formatCurrency(usage.totals.inputCost)}.</div>
              <div>Output: {formatCurrency(usage.totals.outputCost)}.</div>
              <div>Cache read: {formatCurrency(usage.totals.cacheReadCost)}.</div>
              <div>Cache write: {formatCurrency(usage.totals.cacheWriteCost)}.</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            Top Agents By Spend
          </div>
          <div className="mt-3 space-y-2">
            {usage.aggregates.byAgent.slice(0, 6).map((entry) => (
              <button
                key={entry.agentId}
                type="button"
                onClick={() => onSelectAgent(entry.agentId)}
                className="flex w-full items-center justify-between rounded border border-white/8 bg-black/25 px-3 py-2 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/[0.04]"
              >
                <span className="font-mono text-[11px] text-white/80">{entry.agentName}</span>
                <span className="font-mono text-[11px] text-white/55">
                  {formatCurrency(entry.totals.totalCost)}
                </span>
              </button>
            ))}
            {usage.aggregates.byAgent.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">No agent spend data yet.</div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            Model Breakdown
          </div>
          <div className="mt-3 space-y-2">
            {usage.aggregates.byModel.slice(0, 6).map((entry) => (
              <div
                key={`${entry.provider ?? "unknown"}:${entry.model ?? "unknown"}`}
                className="flex items-center justify-between rounded border border-white/8 bg-black/25 px-3 py-2"
              >
                <span className="font-mono text-[11px] text-white/80">
                  {entry.provider ?? "unknown"} / {entry.model ?? "unknown"}
                </span>
                <span className="font-mono text-[11px] text-white/55">
                  {formatCurrency(entry.totals.totalCost)}
                </span>
              </div>
            ))}
            {usage.aggregates.byModel.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">No model usage data yet.</div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            Performance
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatCard
              label="Approvals"
              value={formatNumber(approvalMetrics.totals.requestedCount)}
              hint="Session-local approval requests."
            />
            <StatCard
              label="Intervention Rate"
              value={formatPercent(performance.fleet.interventionRate)}
              hint="Approvals per observed run."
            />
            <StatCard
              label="Tool Calls"
              value={formatNumber(performance.fleet.totalToolCalls)}
              hint="Current transcript state."
            />
            <StatCard
              label="Completed Runs"
              value={formatNumber(performance.fleet.completedRuns)}
              hint="In-memory office run log."
            />
          </div>

          <div className="mt-4 space-y-2">
            {performance.rows.map((row) => (
              <button
                key={row.agentId}
                type="button"
                onClick={() => onSelectAgent(row.agentId)}
                className="w-full rounded border border-white/8 bg-black/25 px-3 py-3 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
                    {row.agentName}
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    {row.totalRuns} runs
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-white/55">
                  <div>Success: {formatPercent(row.successRate)}.</div>
                  <div>Avg runtime: {formatDuration(row.avgRuntimeMs)}.</div>
                  <div>Tool calls: {formatNumber(row.toolCalls)}.</div>
                  <div>Approvals: {formatNumber(row.approvalRequestedCount)}.</div>
                </div>
              </button>
            ))}
            {performance.rows.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">
                No performance data is available yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
