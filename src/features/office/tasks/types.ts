import type { EventFrame } from "@/lib/gateway/GatewayClient";

export const TASK_BOARD_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
] as const;

export type TaskBoardStatus = (typeof TASK_BOARD_STATUSES)[number];

export const TASK_BOARD_SOURCES = [
  "openclaw_event",
  "claw3d_manual",
  "playbook",
  "fallback_inferred",
] as const;

export type TaskBoardSource = (typeof TASK_BOARD_SOURCES)[number];

export type TaskBoardCard = {
  id: string;
  title: string;
  description: string;
  status: TaskBoardStatus;
  source: TaskBoardSource;
  sourceEventId: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  playbookJobId: string | null;
  runId: string | null;
  channel: string | null;
  externalThreadId: string | null;
  lastActivityAt: string | null;
  notes: string[];
  isArchived: boolean;
  isInferred: boolean;
};

export type TaskBoardPreference = {
  cards: TaskBoardCard[];
  selectedCardId: string | null;
};

export type TaskBoardPreferencePatch = {
  cards?: TaskBoardCard[];
  selectedCardId?: string | null;
};

export type TaskBoardExplicitEventKind =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_assigned"
  | "task_linked_to_run"
  | "task_deleted"
  | "task_archived"
  | "playbook_triggered";

export type TaskBoardExplicitEvent = {
  kind: TaskBoardExplicitEventKind;
  frame: EventFrame;
  taskId: string;
  title?: string | null;
  description?: string | null;
  status?: TaskBoardStatus | null;
  assignedAgentId?: string | null;
  playbookJobId?: string | null;
  runId?: string | null;
  channel?: string | null;
  externalThreadId?: string | null;
  occurredAt: string;
  sourceEventId: string;
  archived?: boolean;
};

export const defaultTaskBoardPreference = (): TaskBoardPreference => ({
  cards: [],
  selectedCardId: null,
});

export const isTaskBoardStatus = (value: unknown): value is TaskBoardStatus =>
  typeof value === "string" &&
  (TASK_BOARD_STATUSES as readonly string[]).includes(value);

export const isTaskBoardSource = (value: unknown): value is TaskBoardSource =>
  typeof value === "string" &&
  (TASK_BOARD_SOURCES as readonly string[]).includes(value);
