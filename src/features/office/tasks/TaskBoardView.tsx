"use client";

import {
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import type { CronJobSummary } from "@/lib/cron/types";
import { formatCronSchedule } from "@/lib/cron/types";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";
import { AgentLogsPanel, type AgentLogEntry } from "@/features/office/tasks/AgentLogsPanel";
import {
  CanvasBoard,
  type CanvasNode,
  type JsonCanvas,
} from "@/features/office/tasks/CanvasBoard";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const STATUS_LABELS: Record<TaskBoardStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

const STATUS_ORDER: TaskBoardStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];

const formatRelativeTime = (value: string | null) => {
  if (!value) return "No activity";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return "No activity";
  const delta = Math.max(0, Date.now() - at);
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
  if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))}h ago`;
  return `${Math.max(1, Math.floor(delta / 86_400_000))}d ago`;
};

const formatMs = (ms: number | undefined) => {
  if (!ms) return null;
  return new Date(ms).toLocaleString();
};

const stopAndGetCardId = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
  return event.dataTransfer.getData("text/task-card-id").trim();
};

type CronAlert = { jobId: string; name: string; status: "ok" | "error"; at: number };
type Tab = "workspace" | "kanban" | "logs";

const EMPTY_CANVAS: JsonCanvas = { nodes: [], edges: [] };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export type TaskBoardViewProps = {
  title: string;
  subtitle: string;
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  /** Gateway event log entries — passed from OfficeScreen */
  logEntries?: AgentLogEntry[];
  taskManagerReady?: boolean;
  taskManagerInstalling?: boolean;
  taskManagerInstallProgressPercent?: number;
  taskManagerInstallProgressMessage?: string | null;
  taskManagerInstallError?: string | null;
  taskManagerInstallAvailable?: boolean;
  taskManagerInstallUnavailableReason?: string | null;
  onInstallTaskManagerAction?: () => void;
  onClearLogsAction?: () => void;
  taskCaptureDebug?: {
    lastStatus: "idle" | "detected" | "persisted" | "failed" | "unsupported";
    lastUpdatedAt: string | null;
    lastTitle: string | null;
    lastTaskId: string | null;
    lastSessionKey: string | null;
    lastMessage: string | null;
    detectedCount: number;
    visibleCardCount: number;
    totalCardCount: number;
    sharedTasksSupported: boolean;
    sharedTasksLoading: boolean;
    sharedTasksError: string | null;
  };
  onCreateCardAction: () => void;
  onMoveCardAction: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCardAction: (cardId: string | null) => void;
  onUpdateCardAction: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCardAction: (cardId: string) => void;
  onRefreshCronJobsAction: () => void;
};

// ---------------------------------------------------------------------------
// TaskBoardView
// ---------------------------------------------------------------------------
export function TaskBoardView({
  title,
  subtitle,
  agents,
  cardsByStatus,
  selectedCard,
  activeRuns,
  cronJobs,
  cronLoading,
  cronError,
  logEntries = [],
  taskManagerReady = false,
  taskManagerInstalling = false,
  taskManagerInstallProgressPercent = 0,
  taskManagerInstallProgressMessage = null,
  taskManagerInstallError = null,
  taskManagerInstallAvailable = true,
  taskManagerInstallUnavailableReason = null,
  onInstallTaskManagerAction,
  onClearLogsAction,
  taskCaptureDebug,
  onCreateCardAction,
  onMoveCardAction,
  onSelectCardAction,
  onUpdateCardAction,
  onDeleteCardAction,
  onRefreshCronJobsAction,
}: TaskBoardViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("workspace");
  const [canvas, setCanvas] = useState<JsonCanvas>(EMPTY_CANVAS);

  // Kanban-specific state
  const [hideSystemTasks, setHideSystemTasks] = useState(true);
  const [clearPending, setClearPending] = useState<"system" | "all" | null>(null);
  const [cronExpanded, setCronExpanded] = useState(false);
  const [cronAlerts, setCronAlerts] = useState<CronAlert[]>([]);

  // Track cron job completions
  const prevRunningRef = useRef<Map<string, boolean>>(new Map());
  useEffect(() => {
    const prev = prevRunningRef.current;
    const next = new Map<string, boolean>();
    const newAlerts: CronAlert[] = [];
    for (const job of cronJobs) {
      const isRunning = Boolean(job.state.runningAtMs);
      next.set(job.id, isRunning);
      if (prev.get(job.id) && !isRunning && job.state.lastStatus) {
        newAlerts.push({
          jobId: job.id,
          name: job.name,
          status: job.state.lastStatus === "ok" ? "ok" : "error",
          at: Date.now(),
        });
      }
    }
    prevRunningRef.current = next;
    if (newAlerts.length === 0) return;
    let dismissTimer: number | null = null;
    const addTimer = window.setTimeout(() => {
      setCronAlerts((prev) => [...prev, ...newAlerts]);
      const ids = newAlerts.map((a) => a.jobId);
      dismissTimer = window.setTimeout(() => {
        setCronAlerts((prev) => prev.filter((a) => !ids.includes(a.jobId)));
      }, 30_000);
    }, 0);
    return () => {
      window.clearTimeout(addTimer);
      if (dismissTimer !== null) window.clearTimeout(dismissTimer);
    };
  }, [cronJobs]);

  const allCards = useMemo(
    () => STATUS_ORDER.flatMap((s) => cardsByStatus[s]),
    [cardsByStatus],
  );
  const realCards = useMemo(() => allCards.filter((c) => !c.isInferred), [allCards]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setCanvas((prev) => {
      const validCardIds = new Set(realCards.map((card) => card.id));
      const removedNodeIds = new Set(
        prev.nodes
          .filter((node) => node.type === "task" && !validCardIds.has(node.cardId))
          .map((node) => node.id),
      );
      const retainedNodes = prev.nodes.filter((node) => !removedNodeIds.has(node.id));
      const existingCardIds = new Set(
        retainedNodes
          .filter((node) => node.type === "task")
          .map((node) => node.cardId),
      );
      const unplaced = realCards.filter((c) => !existingCardIds.has(c.id));
      if (removedNodeIds.size === 0 && unplaced.length === 0) return prev;
      const startX = Math.max(0, ...retainedNodes.map((node) => node.x + node.width)) + 40;
      const newNodes: CanvasNode[] = unplaced.map((card, i) => ({
        id: `task-node-${card.id}`,
        type: "task" as const,
        cardId: card.id,
        x: startX,
        y: i * 160,
        width: 220,
        height: 140,
      }));
      return {
        ...prev,
        nodes: [...retainedNodes, ...newNodes],
        edges: prev.edges.filter(
          (edge) => !removedNodeIds.has(edge.fromNode) && !removedNodeIds.has(edge.toNode),
        ),
      };
    }), 0);
    return () => window.clearTimeout(syncTimer);
  }, [realCards]);

  const cardMap = useMemo(
    () => new Map(allCards.map((c) => [c.id, c])),
    [allCards],
  );

  const systemCards = useMemo(() => allCards.filter((c) => c.isInferred), [allCards]);

  const filteredCardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]> = useMemo(
    () =>
      hideSystemTasks
        ? (Object.fromEntries(
            STATUS_ORDER.map((s) => [s, cardsByStatus[s].filter((c) => !c.isInferred)]),
          ) as Record<TaskBoardStatus, TaskBoardCard[]>)
        : cardsByStatus,
    [hideSystemTasks, cardsByStatus],
  );

  const handleClearConfirm = useCallback(() => {
    const targets = clearPending === "all" ? allCards : systemCards;
    for (const card of targets) onDeleteCardAction(card.id);
    setClearPending(null);
  }, [clearPending, allCards, systemCards, onDeleteCardAction]);

  const runningJobs = useMemo(() => cronJobs.filter((j) => j.state.runningAtMs), [cronJobs]);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "workspace", label: "Workspace" },
    { id: "kanban", label: "Kanban", badge: realCards.length },
    { id: "logs", label: "Logs", badge: logEntries.length > 0 ? logEntries.length : undefined },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col bg-transparent text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/10 bg-[#070b11]/22 px-4 py-3 backdrop-blur-[1px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
              {title}
            </div>
            <div className="mt-1 font-mono text-[11px] text-white/40">{subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshCronJobsAction}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-white/20 hover:text-white"
            >
              {cronLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onCreateCardAction}
              className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/50 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="mt-3 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-t border-b-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                activeTab === tab.id
                  ? "border-cyan-400/60 text-cyan-200"
                  : "border-transparent text-white/35 hover:text-white/60"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-white/50">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cron alerts */}
        {cronAlerts.map((alert) => (
          <div
            key={`${alert.jobId}-${alert.at}`}
            className={`mt-2 flex items-center justify-between gap-2 rounded border px-3 py-2 font-mono text-[11px] ${
              alert.status === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-100"
            }`}
          >
            <div className="flex items-center gap-2">
              {alert.status === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                Job &ldquo;{alert.name}&rdquo;{" "}
                {alert.status === "ok" ? "completed." : "failed."}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setCronAlerts((prev) => prev.filter((a) => a.jobId !== alert.jobId))
              }
              className="text-white/40 hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {cronError ? (
          <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-100">
            {cronError}
          </div>
        ) : null}

        {!taskManagerReady ? (
          <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/8 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-200/80">
              Task-manager system skill
            </div>
            <div className="mt-1 text-sm text-cyan-50">
              The board is built in. Use it manually now; when a skills-capable runtime is connected,
              agents can create, update, review, and complete these tasks automatically.
            </div>
            {taskManagerInstalling ? (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100/70">
                  <span>{taskManagerInstallProgressMessage?.trim() || "Preparing task automation"}</span>
                  <span>{Math.max(0, Math.min(100, Math.round(taskManagerInstallProgressPercent)))}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/90">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.max(6, Math.min(100, taskManagerInstallProgressPercent))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {taskManagerInstallError ? (
              <div className="mt-2 rounded border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-200">
                {taskManagerInstallError}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Cron jobs panel */}
        {cronJobs.length > 0 ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setCronExpanded((v) => !v)}
              className="flex w-full items-center gap-2 rounded border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 hover:text-white/75"
            >
              {cronExpanded ? (
                <ChevronUp className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0" />
              )}
              <span>Scheduled jobs ({cronJobs.length})</span>
              {runningJobs.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded bg-cyan-500/20 px-1.5 py-0.5 text-cyan-200">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                  {runningJobs.length} running
                </span>
              )}
            </button>
            {cronExpanded && (
              <div className="mt-1 space-y-1.5 rounded border border-white/8 bg-white/[0.02] px-3 py-3">
                {cronJobs.map((job) => {
                  const isRunning = Boolean(job.state.runningAtMs);
                  const lastStatus = job.state.lastStatus;
                  return (
                    <div
                      key={job.id}
                      className="flex items-start justify-between gap-3 rounded border border-white/6 bg-black/10 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-cyan-400" />
                          ) : lastStatus === "ok" ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                          ) : lastStatus === "error" ? (
                            <AlertCircle className="h-3 w-3 shrink-0 text-rose-400" />
                          ) : (
                            <Clock className="h-3 w-3 shrink-0 text-white/30" />
                          )}
                          <span className="truncate text-[11px] font-medium text-white/80">
                            {job.name}
                          </span>
                          {!job.enabled && (
                            <span className="rounded bg-white/8 px-1 py-0.5 font-mono text-[9px] uppercase text-white/30">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-white/35">
                          {formatCronSchedule(job.schedule)}
                          {job.agentId ? ` · ${job.agentId}` : ""}
                        </div>
                        {job.state.lastError && (
                          <div className="mt-1 truncate font-mono text-[10px] text-rose-300/70">
                            {job.state.lastError}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right font-mono text-[10px] text-white/30">
                        {isRunning ? (
                          <div className="text-cyan-300/70">Running…</div>
                        ) : job.state.nextRunAtMs ? (
                          <div>Next: {formatMs(job.state.nextRunAtMs)}</div>
                        ) : null}
                        {job.state.lastRunAtMs ? (
                          <div>
                            Last:{" "}
                            {formatRelativeTime(
                              new Date(job.state.lastRunAtMs).toISOString(),
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {taskCaptureDebug ? (
          <details className="mt-2 rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2 font-mono text-[11px] text-amber-50">
            <summary className="cursor-pointer list-none select-none">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-amber-100/75">
                <span>Capture debug</span>
                <span>Status: {taskCaptureDebug.lastStatus}</span>
                <span>Visible cards: {taskCaptureDebug.visibleCardCount}</span>
                <span>Tracked cards: {taskCaptureDebug.totalCardCount}</span>
                <span>Detected: {taskCaptureDebug.detectedCount}</span>
              </div>
            </summary>
            <div className="mt-2 grid gap-1 text-white/80">
              <div>Last request: {taskCaptureDebug.lastTitle ?? "None yet."}</div>
              <div>Last task id: {taskCaptureDebug.lastTaskId ?? "-"}</div>
              <div>Session/thread: {taskCaptureDebug.lastSessionKey ?? "-"}</div>
              <div>Last update: {formatRelativeTime(taskCaptureDebug.lastUpdatedAt)}</div>
              <div>
                Shared store:{" "}
                {taskCaptureDebug.sharedTasksSupported
                  ? taskCaptureDebug.sharedTasksLoading
                    ? "Syncing."
                    : "Available."
                  : "Unavailable."}
              </div>
              <div>
                Note:{" "}
                {taskCaptureDebug.lastMessage ?? "Waiting for inbound request detection."}
              </div>
              {taskCaptureDebug.sharedTasksError ? (
                <div className="text-rose-200">
                  Store error: {taskCaptureDebug.sharedTasksError}
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* ── Workspace (JSON Canvas) ── */}
        {activeTab === "workspace" && (
          <CanvasBoard
            canvas={canvas}
            cardMap={cardMap}
            agents={agents}
            onCanvasChangeAction={setCanvas}
            onMoveCardAction={onMoveCardAction}
            onCreateCardAction={onCreateCardAction}
            onRequestClearAllAction={() => setClearPending("all")}
            onConfirmClearAllAction={handleClearConfirm}
            onCancelClearAllAction={() => setClearPending(null)}
            onSelectCardAction={onSelectCardAction}
            onUpdateCardAction={onUpdateCardAction}
            selectedCardId={selectedCard?.id ?? null}
            clearAllPending={clearPending === "all"}
            taskCount={allCards.length}
          />
        )}

        {/* ── Kanban (column view, real tasks only) ── */}
        {activeTab === "kanban" && (
          <KanbanTab
            cardsByStatus={filteredCardsByStatus}
            selectedCard={selectedCard}
            allCards={allCards}
            systemCards={systemCards}
            agents={agents}
            activeRuns={activeRuns}
            cronJobs={cronJobs}
            hideSystemTasks={hideSystemTasks}
            clearPending={clearPending}
            onToggleSystemTasks={() => setHideSystemTasks((v) => !v)}
            onSetClearPending={setClearPending}
            onClearConfirm={handleClearConfirm}
            onMoveCard={onMoveCardAction}
            onSelectCard={onSelectCardAction}
            onUpdateCard={onUpdateCardAction}
            onDeleteCard={onDeleteCardAction}
          />
        )}

        {/* ── Logs ── */}
        {activeTab === "logs" && (
          <AgentLogsPanel entries={logEntries} onClear={onClearLogsAction ?? (() => {})} />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// KanbanTab — extracted so JSX doesn't bloat the main component
// ---------------------------------------------------------------------------
function KanbanTab({
  cardsByStatus,
  selectedCard,
  allCards,
  systemCards,
  agents,
  activeRuns,
  cronJobs,
  hideSystemTasks,
  clearPending,
  onToggleSystemTasks,
  onSetClearPending,
  onClearConfirm,
  onMoveCard,
  onSelectCard,
  onUpdateCard,
  onDeleteCard,
}: {
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  allCards: TaskBoardCard[];
  systemCards: TaskBoardCard[];
  agents: AgentState[];
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  hideSystemTasks: boolean;
  clearPending: "system" | "all" | null;
  onToggleSystemTasks: () => void;
  onSetClearPending: (v: "system" | "all" | null) => void;
  onClearConfirm: () => void;
  onMoveCard: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCard: (cardId: string | null) => void;
  onUpdateCard: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCard: (cardId: string) => void;
}) {
  return (
    <div
      className={`grid h-full min-h-0 overflow-hidden ${selectedCard ? "grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}
    >
      <div className="min-h-0 overflow-auto px-4 py-4">
        {/* Bulk controls */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSystemTasks}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 hover:border-white/20 hover:text-white"
          >
            {hideSystemTasks ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {hideSystemTasks
              ? `Show system (${systemCards.length})`
              : "Hide system"}
          </button>
          {clearPending ? (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-rose-200/80">
                Clear {clearPending === "all" ? "all" : "system"} tasks?
              </span>
              <button
                type="button"
                onClick={onClearConfirm}
                className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 font-mono text-[10px] uppercase text-rose-100 hover:border-rose-400/60"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onSetClearPending(null)}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/50 hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {systemCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSetClearPending("system")}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 hover:border-rose-400/30 hover:text-rose-200"
                >
                  Clear system ({systemCards.length})
                </button>
              )}
              {allCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSetClearPending("all")}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 hover:border-rose-400/30 hover:text-rose-200"
                >
                  Clear all
                </button>
              )}
            </>
          )}
        </div>

        <div className="grid min-w-[700px] grid-cols-5 gap-3">
          {STATUS_ORDER.map((status) => {
            const cards = cardsByStatus[status];
            return (
              <div
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const cardId = stopAndGetCardId(event);
                  if (!cardId) return;
                  onMoveCard(cardId, status);
                }}
                className="flex min-h-[540px] flex-col rounded-xl border border-white/10 bg-black/14 backdrop-blur-[1px]"
              >
                <div className="border-b border-white/8 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                      {STATUS_LABELS[status]}
                    </div>
                    <div className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                      {cards.length}
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {cards.length === 0 ? (
                    <div className="rounded border border-dashed border-white/10 px-3 py-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
                      Drop a card here.
                    </div>
                  ) : (
                    cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        draggable
                        aria-label={`${card.title} — ${STATUS_LABELS[card.status]}. Arrow keys to move between columns.`}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/task-card-id", card.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() =>
                          onSelectCard(selectedCard?.id === card.id ? null : card.id)
                        }
                        onKeyDown={(event: ReactKeyboardEvent) => {
                          const idx = STATUS_ORDER.indexOf(card.status);
                          if (event.key === "ArrowRight" && idx < STATUS_ORDER.length - 1) {
                            event.preventDefault();
                            onMoveCard(card.id, STATUS_ORDER[idx + 1]!);
                          } else if (event.key === "ArrowLeft" && idx > 0) {
                            event.preventDefault();
                            onMoveCard(card.id, STATUS_ORDER[idx - 1]!);
                          }
                        }}
                        className={`flex w-full flex-col rounded-lg border px-4 py-4 text-left transition-colors ${
                          selectedCard?.id === card.id
                            ? "border-cyan-400/35 bg-cyan-500/[0.10]"
                            : "border-white/8 bg-black/12 hover:border-cyan-400/20 hover:bg-cyan-500/[0.04]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="line-clamp-3 text-[13px] font-semibold leading-snug text-white/90">
                            {card.title}
                          </div>
                          <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
                            {card.source.replaceAll("_", " ")}
                          </span>
                        </div>
                        {card.description ? (
                          <div className="mt-2 line-clamp-4 text-[12px] leading-[1.6] text-white/55">
                            {card.description}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/38">
                          <span>{card.assignedAgentId ?? "Unassigned"}</span>
                          {card.runId ? <span>Run linked.</span> : null}
                          {card.playbookJobId ? <span>Playbook linked.</span> : null}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-white/32">
                          {formatRelativeTime(card.lastActivityAt ?? card.updatedAt)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCard ? (
        <aside className="flex min-h-0 flex-col border-l border-white/8 bg-black/25">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
              Task Details
            </div>
            <button
              type="button"
              onClick={() => onSelectCard(null)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Title
              </span>
              <input
                value={selectedCard.title}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, { title: event.target.value })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Description
              </span>
              <textarea
                rows={4}
                value={selectedCard.description}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, { description: event.target.value })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Status
              </span>
              <select
                value={selectedCard.status}
                onChange={(event) =>
                  onMoveCard(selectedCard.id, event.target.value as TaskBoardStatus)
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Assigned agent
              </span>
              <select
                value={selectedCard.assignedAgentId ?? ""}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, {
                    assignedAgentId: event.target.value || null,
                  })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.name || agent.agentId}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Linked active run
              </span>
              <select
                value={selectedCard.runId ?? ""}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, { runId: event.target.value || null })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">No linked run</option>
                {activeRuns.map((run) => (
                  <option key={run.runId} value={run.runId}>
                    {run.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Linked playbook
              </span>
              <select
                value={selectedCard.playbookJobId ?? ""}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, {
                    playbookJobId: event.target.value || null,
                  })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">No linked playbook</option>
                {cronJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Channel
              </span>
              <input
                value={selectedCard.channel ?? ""}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, {
                    channel: event.target.value || null,
                  })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Notes
              </span>
              <textarea
                rows={3}
                value={selectedCard.notes.join("\n")}
                onChange={(event) =>
                  onUpdateCard(selectedCard.id, {
                    notes: event.target.value
                      .split("\n")
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                  })
                }
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
            </label>

            <div className="space-y-2 rounded border border-white/8 bg-white/[0.03] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/38">
              <div>Source: {selectedCard.source.replaceAll("_", " ")}.</div>
              <div>Created: {new Date(selectedCard.createdAt).toLocaleString()}.</div>
              <div>Updated: {new Date(selectedCard.updatedAt).toLocaleString()}.</div>
            </div>

            <button
              type="button"
              onClick={() => onDeleteCard(selectedCard.id)}
              className="inline-flex items-center gap-2 rounded border border-rose-500/25 bg-rose-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-100 transition-colors hover:border-rose-400/50 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Task
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
