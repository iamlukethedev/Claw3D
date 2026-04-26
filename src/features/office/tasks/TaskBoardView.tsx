"use client";

import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import type { CronJobSummary } from "@/lib/cron/types";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";

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

const stopAndGetCardId = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
  return event.dataTransfer.getData("text/task-card-id").trim();
};

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
  taskCaptureDebug,
  onCreateCard,
  onMoveCard,
  onSelectCard,
  onUpdateCard,
  onDeleteCard,
  onRefreshCronJobs,
}: {
  title: string;
  subtitle: string;
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
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
  onCreateCard: () => void;
  onMoveCard: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCard: (cardId: string | null) => void;
  onUpdateCard: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onRefreshCronJobs: () => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-transparent text-white">
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
              onClick={onRefreshCronJobs}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-white/20 hover:text-white"
            >
              {cronLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onCreateCard}
              className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/50 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
          </div>
        </div>
        {cronError ? (
          <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-100">
            {cronError}
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
              <div>
                Last request: {taskCaptureDebug.lastTitle ?? "None yet."}
              </div>
              <div>
                Last task id: {taskCaptureDebug.lastTaskId ?? "-"}
              </div>
              <div>
                Session/thread: {taskCaptureDebug.lastSessionKey ?? "-"}
              </div>
              <div>
                Last update: {formatRelativeTime(taskCaptureDebug.lastUpdatedAt)}
              </div>
              <div>
                Shared store:{" "}
                {taskCaptureDebug.sharedTasksSupported
                  ? taskCaptureDebug.sharedTasksLoading
                    ? "Syncing."
                    : "Available."
                  : "Unavailable."}
              </div>
              <div>
                Note: {taskCaptureDebug.lastMessage ?? "Waiting for inbound request detection."}
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

      <div className={`grid min-h-0 flex-1 overflow-hidden ${selectedCard ? "grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}>
        <div className="min-h-0 overflow-auto px-4 py-4">
          <div className="grid min-w-[700px] grid-cols-5 gap-3">
            {STATUS_ORDER.map((status) => {
              const cards = cardsByStatus[status];
              return (
                <div
                  key={status}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    const cardId = stopAndGetCardId(event);
                    if (!cardId) return;
                    onMoveCard(cardId, status);
                  }}
                  className="flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-black/14 backdrop-blur-[1px]"
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
                          onClick={() => onSelectCard(selectedCard?.id === card.id ? null : card.id)}
                          onKeyDown={(event: ReactKeyboardEvent) => {
                            const currentIdx = STATUS_ORDER.indexOf(card.status);
                            if (event.key === "ArrowRight" && currentIdx < STATUS_ORDER.length - 1) {
                              event.preventDefault();
                              onMoveCard(card.id, STATUS_ORDER[currentIdx + 1]!);
                            } else if (event.key === "ArrowLeft" && currentIdx > 0) {
                              event.preventDefault();
                              onMoveCard(card.id, STATUS_ORDER[currentIdx - 1]!);
                            }
                          }}
                          className={`flex w-full flex-col rounded-lg border px-3 py-3 text-left transition-colors ${
                            selectedCard?.id === card.id
                              ? "border-cyan-400/35 bg-cyan-500/[0.10]"
                              : "border-white/8 bg-black/12 hover:border-cyan-400/20 hover:bg-cyan-500/[0.04]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="line-clamp-2 text-sm font-medium text-white/90">
                              {card.title}
                            </div>
                            <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
                              {card.source.replaceAll("_", " ")}
                            </span>
                          </div>
                          {card.description ? (
                            <div className="mt-2 line-clamp-3 text-[12px] leading-5 text-white/55">
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
    </section>
  );
}
