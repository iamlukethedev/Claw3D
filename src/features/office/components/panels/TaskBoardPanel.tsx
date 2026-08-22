"use client";

import type { ComponentProps } from "react";
import type { AgentState } from "@/features/agents/state/store";
import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";
import type { CronJobSummary } from "@/lib/cron/types";
import type { AgentLogEntry } from "@/features/office/tasks/AgentLogsPanel";

export function TaskBoardPanel({
  agents,
  cardsByStatus,
  selectedCard,
  activeRuns,
  cronJobs,
  cronLoading,
  cronError,
  taskCaptureDebug,
  logEntries,
  taskManagerReady = false,
  taskManagerInstalling = false,
  taskManagerInstallProgressPercent = 0,
  taskManagerInstallProgressMessage = null,
  taskManagerInstallError = null,
  taskManagerInstallAvailable = true,
  taskManagerInstallUnavailableReason = null,
  onInstallTaskManagerAction,
  onCreateCardAction,
  onMoveCardAction,
  onSelectCardAction,
  onUpdateCardAction,
  onDeleteCardAction,
  onRefreshCronJobsAction,
  onClearLogsAction,
}: {
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  taskCaptureDebug?: ComponentProps<typeof TaskBoardView>["taskCaptureDebug"];
  logEntries?: AgentLogEntry[];
  taskManagerReady?: boolean;
  taskManagerInstalling?: boolean;
  taskManagerInstallProgressPercent?: number;
  taskManagerInstallProgressMessage?: string | null;
  taskManagerInstallError?: string | null;
  taskManagerInstallAvailable?: boolean;
  taskManagerInstallUnavailableReason?: string | null;
  onInstallTaskManagerAction?: () => void;
  onCreateCardAction: () => void;
  onMoveCardAction: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCardAction: (cardId: string | null) => void;
  onUpdateCardAction: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCardAction: (cardId: string) => void;
  onRefreshCronJobsAction: () => void;
  onClearLogsAction?: () => void;
}) {
  return (
    <TaskBoardView
      title="Kanban"
      subtitle="Manual tasks, inferred requests, and scheduled playbooks."
      agents={agents}
      cardsByStatus={cardsByStatus}
      selectedCard={selectedCard}
      activeRuns={activeRuns}
      cronJobs={cronJobs}
      cronLoading={cronLoading}
      cronError={cronError}
      taskCaptureDebug={taskCaptureDebug}
      logEntries={logEntries}
      taskManagerReady={taskManagerReady}
      taskManagerInstalling={taskManagerInstalling}
      taskManagerInstallProgressPercent={taskManagerInstallProgressPercent}
      taskManagerInstallProgressMessage={taskManagerInstallProgressMessage}
      taskManagerInstallError={taskManagerInstallError}
      taskManagerInstallAvailable={taskManagerInstallAvailable}
      taskManagerInstallUnavailableReason={taskManagerInstallUnavailableReason}
      onInstallTaskManagerAction={onInstallTaskManagerAction}
      onCreateCardAction={onCreateCardAction}
      onMoveCardAction={onMoveCardAction}
      onSelectCardAction={onSelectCardAction}
      onUpdateCardAction={onUpdateCardAction}
      onDeleteCardAction={onDeleteCardAction}
      onRefreshCronJobsAction={onRefreshCronJobsAction}
      onClearLogsAction={onClearLogsAction}
    />
  );
}
