"use client";

import { Check, Landmark, Lock, RefreshCw, Wallet } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";
import {
  type OfficeUsageAnalyticsParams,
  useOfficeUsageAnalyticsViewModel,
} from "@/features/office/hooks/useOfficeUsageAnalyticsViewModel";
import {
  formatCurrency,
  formatNumber,
  toDateInputValue,
} from "@/lib/office/usageAnalyticsPresentation";

const PIN_STORAGE_KEY = "openclaw_atm_pin_code";

const resolveInitialPinMode = (): "setup" | "verify" => {
  if (typeof window === "undefined") {
    return "verify";
  }
  return window.localStorage.getItem(PIN_STORAGE_KEY) ? "verify" : "setup";
};

export function AtmImmersiveScreen(props: OfficeUsageAnalyticsParams) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinMode] = useState<"setup" | "verify">(resolveInitialPinMode);
  const [inputPin, setInputPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { usage, settingsLoaded, startDate, endDate, setStartDate, setEndDate } =
    useOfficeUsageAnalyticsViewModel(props);

  const handlePinSubmit = () => {
    if (inputPin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    if (pinMode === "setup") {
      localStorage.setItem(PIN_STORAGE_KEY, inputPin);
      setIsAuthenticated(true);
      setError(null);
    } else {
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      if (inputPin === stored) {
        setIsAuthenticated(true);
        setError(null);
      } else {
        setError("Incorrect PIN");
        setInputPin("");
      }
    }
  };

  const handleKeyPad = (key: string) => {
    setError(null);
    if (key === "clear") {
      setInputPin("");
    } else if (key === "backspace") {
      setInputPin((prev) => prev.slice(0, -1));
    } else if (key === "submit") {
      handlePinSubmit();
    } else {
      if (inputPin.length < 6) {
        setInputPin((prev) => prev + key);
      }
    }
  };

  const recentCostDaily = useMemo(() => usage.costDaily.slice(-7), [usage.costDaily]);
  const chartMax = useMemo(
    () => recentCostDaily.reduce((max, entry) => Math.max(max, entry.totalCost), 0),
    [recentCostDaily],
  );
  const overviewCards = useMemo(
    () => [
      { label: "Total Spend", value: formatCurrency(usage.totals.totalCost) },
      { label: "Total Tokens", value: formatNumber(usage.totals.totalTokens) },
      { label: "Sessions", value: formatNumber(usage.sessions.length) },
      { label: "Messages", value: formatNumber(usage.aggregates.messages.total) },
      { label: "Tool Calls", value: formatNumber(usage.aggregates.tools.totalCalls) },
      { label: "Unique Tools", value: formatNumber(usage.aggregates.tools.uniqueTools) },
      { label: "Errors", value: formatNumber(usage.aggregates.messages.errors) },
      {
        label: "Avg Session Cost",
        value:
          usage.sessions.length > 0
            ? formatCurrency(usage.totals.totalCost / usage.sessions.length)
            : formatCurrency(0),
      },
    ],
    [usage],
  );
  const recentSessions = useMemo(
    () =>
      [...usage.sessions]
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .slice(0, 18),
    [usage.sessions],
  );
  const selectedRangeLabel = useMemo(() => {
    const now = new Date();
    const end = toDateInputValue(now);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 6);
    const lastMonth = new Date(now);
    lastMonth.setDate(lastMonth.getDate() - 29);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (startDate === toDateInputValue(lastWeek) && endDate === end) return "7D";
    if (startDate === toDateInputValue(lastMonth) && endDate === end) return "30D";
    if (startDate === toDateInputValue(monthStart) && endDate === end) return "MTD";
    return "Custom";
  }, [endDate, startDate]);

  const setQuickRange = (days: number | "mtd") => {
    const end = new Date();
    const start = new Date(end);
    if (days === "mtd") {
      start.setDate(1);
    } else {
      start.setDate(start.getDate() - (days - 1));
    }
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  };

  if (!isAuthenticated) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#113a3d_0%,#071719_65%,#020607_100%)] text-[#d6fff7]">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(130,255,228,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(130,255,228,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-[#7dfff0]/30 bg-[#0d3034] shadow-[0_0_40px_rgba(125,255,240,0.15)]">
            <Lock className="h-8 w-8 text-[#7dfff0]" />
          </div>

          <h2 className="text-[24px] font-medium tracking-[0.1em] text-[#dbfff6]">
            {pinMode === "setup" ? "CREATE ACCESS PIN" : "ENTER PIN CODE"}
          </h2>
          <p className="mt-2 text-[13px] uppercase tracking-[0.15em] text-[#83fff0]/60">
            {pinMode === "setup"
              ? "Set a secure code for your treasury ledger"
              : "Authentication required to view ledger"}
          </p>

          <div className="mb-8 mt-10 flex gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border border-[#7dfff0]/40 transition-all duration-200 ${
                  i < inputPin.length
                    ? "bg-[#7dfff0] shadow-[0_0_15px_rgba(125,255,240,0.6)]"
                    : "bg-transparent"
                }`}
              />
            ))}
          </div>

          {error ? (
            <div className="animate-in slide-in-from-top-2 mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-[13px] font-medium text-rose-200 fade-in">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPad(num.toString())}
                className="flex h-16 w-24 items-center justify-center rounded-xl border border-[#7dfff0]/10 bg-[#041315]/80 text-[24px] font-light text-[#d6fff7] transition-all hover:bg-[#0d3034] hover:border-[#7dfff0]/30 active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleKeyPad("clear")}
              className="flex h-16 w-24 items-center justify-center rounded-xl border border-rose-500/20 bg-[#1a0505]/60 text-[14px] font-medium uppercase tracking-wider text-rose-200 transition-all hover:bg-rose-900/40 active:scale-95"
            >
              Clear
            </button>
            <button
              onClick={() => handleKeyPad("0")}
              className="flex h-16 w-24 items-center justify-center rounded-xl border border-[#7dfff0]/10 bg-[#041315]/80 text-[24px] font-light text-[#d6fff7] transition-all hover:bg-[#0d3034] hover:border-[#7dfff0]/30 active:scale-95"
            >
              0
            </button>
            <button
              onClick={() => handleKeyPad("submit")}
              className="flex h-16 w-24 items-center justify-center rounded-xl border border-emerald-500/20 bg-[#051a10]/60 text-emerald-200 transition-all hover:bg-emerald-900/40 active:scale-95"
            >
              <Check className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[radial-gradient(circle_at_top,#113a3d_0%,#071719_45%,#020607_100%)] text-[#d6fff7]">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(130,255,228,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(130,255,228,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.34)_100%)]" />
      <div className="relative flex min-h-full flex-col px-10 py-8 pb-14">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.32em] text-[#83fff0]/70">
              <Landmark className="h-4 w-4" />
              OpenClaw Treasury ATM
            </div>
            <div className="mt-3 text-[13px] uppercase tracking-[0.24em] text-[#7ddfd2]/62">
              Token Usage Ledger
            </div>
            <div className="mt-2 text-[44px] font-semibold tracking-[0.08em] text-[#dbfff6]">
              {formatNumber(usage.totals.totalTokens)}
            </div>
            <div className="mt-2 text-[15px] uppercase tracking-[0.28em] text-[#89fff1]/72">
              Total tokens used
            </div>
            <div className="mt-4 inline-flex items-center rounded-full border border-[#7cffef]/20 bg-black/20 px-4 py-2 text-[13px] uppercase tracking-[0.24em] text-[#bafff7]/85">
              USD equivalent {formatCurrency(usage.totals.totalCost)}
            </div>
          </div>
          <div className="w-[320px] rounded-[24px] border border-[#7dfff0]/18 bg-black/22 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#88fff1]/62">
              <Wallet className="h-4 w-4" />
              Account summary
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "7D", value: 7 },
                { label: "30D", value: 30 },
                { label: "MTD", value: "mtd" as const },
              ].map((range) => (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => setQuickRange(range.value)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-colors ${
                    selectedRangeLabel === range.label
                      ? "border-[#8efff2]/40 bg-[#0d3034] text-[#dffff8]"
                      : "border-[#7dfff0]/16 bg-[#041315] text-[#8ffff3]/68 hover:border-[#7dfff0]/30 hover:text-[#dffff8]"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryCard label="Input" value={formatCurrency(usage.totals.inputCost)} />
              <SummaryCard label="Output" value={formatCurrency(usage.totals.outputCost)} />
              <SummaryCard label="Cache read" value={formatCurrency(usage.totals.cacheReadCost)} />
              <SummaryCard label="Cache write" value={formatCurrency(usage.totals.cacheWriteCost)} />
            </div>
            <div className="mt-4 rounded-2xl border border-[#7dfff0]/12 bg-[#031314]/80 px-4 py-3 text-[12px] uppercase tracking-[0.18em] text-[#9ffef0]/76">
              {usage.lastRefreshedAt
                ? `Last refresh ${new Date(usage.lastRefreshedAt).toLocaleTimeString()}`
                : settingsLoaded
                  ? "Awaiting first usage snapshot"
                  : "Loading account preferences"}
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-6">
          <SectionCard
            title="Usage Overview"
            subtitle="Expanded OpenClaw expense data for the selected ledger window."
            action={
              <button
                type="button"
                onClick={() => void usage.refresh()}
                className="inline-flex items-center gap-2 rounded-full border border-[#7dfff0]/24 bg-[#072528] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#b7fff8] transition-colors hover:border-[#7dfff0]/40 hover:bg-[#0a3035]"
              >
                {usage.loading ? (
                  <RunningAvatarLoader size={16} trackWidth={32} inline />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </button>
            }
          >
            {usage.error ? <EmptyPanelState message={usage.error} tone="danger" /> : null}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {overviewCards.map((card) => (
                <SummaryCard key={card.label} label={card.label} value={card.value} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Daily Withdrawals"
            subtitle="Recent cost movement across the last seven days."
          >
            {usage.loading && recentCostDaily.length === 0 ? (
              <EmptyPanelState message="Loading ATM ledger." />
            ) : recentCostDaily.length === 0 ? (
              <EmptyPanelState message="No token spend recorded for the current ledger window." />
            ) : (
              <div className="grid grid-cols-7 gap-3">
                {recentCostDaily.map((entry) => {
                  const heightPct = chartMax > 0 ? (entry.totalCost / chartMax) * 100 : 0;
                  return (
                    <div key={entry.date} className="flex min-w-0 flex-col items-center gap-3">
                      <div className="text-center text-[11px] uppercase tracking-[0.12em] text-[#9dfef0]/68">
                        {formatCurrency(entry.totalCost)}
                      </div>
                      <div className="flex h-[230px] w-full items-end rounded-[20px] border border-[#7dfff0]/10 bg-[#041315]/86 p-2">
                        <div
                          className="w-full rounded-[14px] bg-[linear-gradient(180deg,#7effef_0%,#2cd3bf_100%)] shadow-[0_0_18px_rgba(85,255,231,0.32)]"
                          style={{ height: `${Math.max(8, heightPct)}%` }}
                          title={`${entry.date} ${formatCurrency(entry.totalCost)}`}
                        />
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#7bd9cd]/72">
                        {entry.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Activity By Day"
              subtitle="Daily tokens, cost, messages, tool calls, and errors."
            >
              <div className="space-y-3">
                {usage.aggregates.daily.map((entry) => (
                  <ListRow
                    key={entry.date}
                    title={entry.date}
                    primary={`${formatCurrency(entry.cost)} · ${formatNumber(entry.tokens)} tokens`}
                    secondary={`${formatNumber(entry.messages)} messages · ${formatNumber(entry.toolCalls)} tool calls · ${formatNumber(entry.errors)} errors`}
                  />
                ))}
                {usage.aggregates.daily.length === 0 ? (
                  <EmptyPanelState message="No daily activity rows available yet." />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Budget Alerts"
              subtitle="Threshold warnings for daily, monthly, and per-agent spend."
            >
              <div className="space-y-3">
                {usage.budgetAlerts.map((alert) => (
                  <div
                    key={alert.key}
                    className={`rounded-2xl border px-4 py-4 text-[13px] ${
                      alert.severity === "danger"
                        ? "border-rose-400/35 bg-rose-500/12 text-rose-100"
                        : "border-amber-300/30 bg-amber-400/12 text-amber-50"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">
                      {alert.label}
                    </div>
                    <div className="mt-2 text-[16px]">
                      {formatCurrency(alert.currentUsd)} / {formatCurrency(alert.limitUsd)}.
                    </div>
                  </div>
                ))}
                {usage.budgetAlerts.length === 0 ? (
                  <EmptyPanelState
                    message="Budget thresholds are healthy for the current ATM ledger window."
                    tone="success"
                  />
                ) : null}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Agent Expenses" subtitle="All agents ranked by total spend.">
              <div className="space-y-3">
                {usage.aggregates.byAgent.map((entry, index) => (
                  <ListRow
                    key={entry.agentId}
                    title={`Account ${String(index + 1).padStart(2, "0")} · ${entry.agentName}`}
                    primary={formatCurrency(entry.totals.totalCost)}
                    secondary={`${formatNumber(entry.totals.totalTokens)} tokens`}
                  />
                ))}
                {usage.aggregates.byAgent.length === 0 ? (
                  <EmptyPanelState message="No agent token activity yet." />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Model Expenses"
              subtitle="Provider and model spend breakdown."
            >
              <div className="space-y-3">
                {usage.aggregates.byModel.map((entry, index) => (
                  <ListRow
                    key={`${entry.provider ?? "unknown"}:${entry.model ?? "unknown"}`}
                    title={`Route ${String(index + 1).padStart(2, "0")} · ${entry.provider ?? "unknown"} / ${entry.model ?? "unknown"}`}
                    primary={formatCurrency(entry.totals.totalCost)}
                    secondary={`${formatNumber(entry.totals.totalTokens)} tokens`}
                  />
                ))}
                {usage.aggregates.byModel.length === 0 ? (
                  <EmptyPanelState message="No model cost routes recorded yet." />
                ) : null}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard title="Tool Usage" subtitle="All tools observed in the selected sessions.">
              <div className="space-y-3">
                {usage.aggregates.tools.tools.map((tool, index) => (
                  <ListRow
                    key={tool.name}
                    title={`Tool ${String(index + 1).padStart(2, "0")} · ${tool.name}`}
                    primary={formatNumber(tool.count)}
                    secondary="total invocations"
                  />
                ))}
                {usage.aggregates.tools.tools.length === 0 ? (
                  <EmptyPanelState message="No tool usage has been recorded yet." />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Message Totals"
              subtitle="Conversation activity across all selected sessions."
            >
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  label="All Messages"
                  value={formatNumber(usage.aggregates.messages.total)}
                />
                <SummaryCard
                  label="User"
                  value={formatNumber(usage.aggregates.messages.user)}
                />
                <SummaryCard
                  label="Assistant"
                  value={formatNumber(usage.aggregates.messages.assistant)}
                />
                <SummaryCard
                  label="Tool Results"
                  value={formatNumber(usage.aggregates.messages.toolResults)}
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Recent Sessions"
            subtitle="Latest sessions with cost and token totals."
          >
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <ListRow
                  key={session.key}
                  title={session.label ?? session.agentName ?? session.key}
                  primary={`${formatCurrency(session.usage.totals.totalCost)} · ${formatNumber(
                    session.usage.totals.totalTokens,
                  )} tokens`}
                  secondary={`${session.provider ?? "unknown"} / ${session.model ?? "unknown"} · ${
                    session.updatedAt
                      ? new Date(session.updatedAt).toLocaleString()
                      : "no timestamp"
                  }`}
                />
              ))}
              {recentSessions.length === 0 ? (
                <EmptyPanelState message="No sessions available for the selected range." />
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#7dfff0]/16 bg-black/20 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.24em] text-[#8cfff3]/64">
            {title}
          </div>
          <div className="mt-2 text-[14px] text-[#d8fff7]/74">{subtitle}</div>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#7dfff0]/10 bg-[#031314]/78 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#7addcf]/58">
        {label}
      </div>
      <div className="mt-2 text-[16px] text-[#e4fff9]">{value}</div>
    </div>
  );
}

function ListRow({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#7dfff0]/10 bg-[#031314]/78 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-[13px] uppercase tracking-[0.12em] text-[#dffef8]">
          {title}
        </div>
        <div className="mt-1 text-[11px] text-[#8cdcd1]/66">{secondary}</div>
      </div>
      <div className="shrink-0 text-right text-[15px] text-[#d9fff8]">{primary}</div>
    </div>
  );
}

function EmptyPanelState({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-400/30 bg-rose-500/12 text-rose-100"
      : tone === "success"
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
        : "border-[#7dfff0]/10 bg-[#031314]/78 text-[#b6fff7]/70";
  return (
    <div className={`rounded-2xl border px-4 py-4 text-[13px] ${toneClass}`}>
      {message}
    </div>
  );
}
