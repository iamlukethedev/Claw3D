"use client";

import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";
import type { CronJobSummary } from "@/lib/cron/types";

export function KanbanImmersiveScreen({
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
  onClose,
}: {
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  taskCaptureDebug?: ComponentProps<typeof TaskBoardView>["taskCaptureDebug"];
  onCreateCard: () => void;
  onMoveCard: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCard: (cardId: string | null) => void;
  onUpdateCard: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onRefreshCronJobs: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.focus();

    const trapFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) {
        event.stopPropagation();
        dialog.focus();
      }
    };

    document.addEventListener("focusin", trapFocus);
    return () => {
      document.removeEventListener("focusin", trapFocus);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kanban Board"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Kanban Board"
          className="absolute -right-5 -top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-[#0e0b07]/90 text-amber-200/70 backdrop-blur-sm transition-colors hover:border-amber-400/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          ref={dialogRef}
          tabIndex={-1}
          className="flex h-[min(75vh,800px)] w-[min(80vw,1280px)] flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0e0b07]/85 shadow-2xl outline-none backdrop-blur-md"
        >
          <div className="min-h-0 flex-1">
          <TaskBoardView
            title="Kanban Board"
            subtitle="Headquarters task routing, scheduling, and review."
            agents={agents}
            cardsByStatus={cardsByStatus}
            selectedCard={selectedCard}
            activeRuns={activeRuns}
            cronJobs={cronJobs}
            cronLoading={cronLoading}
            cronError={cronError}
            taskCaptureDebug={taskCaptureDebug}
            onCreateCard={onCreateCard}
            onMoveCard={onMoveCard}
            onSelectCard={onSelectCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onRefreshCronJobs={onRefreshCronJobs}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
