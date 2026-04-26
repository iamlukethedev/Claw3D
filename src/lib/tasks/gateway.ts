import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { GatewayResponseError } from "@/lib/gateway/errors";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";

export type GatewayTaskRecord = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskBoardStatus;
  source?: TaskBoardCard["source"];
  sourceEventId?: string | null;
  assignedAgentId?: string | null;
  createdAt: string;
  updatedAt: string;
  playbookJobId?: string | null;
  runId?: string | null;
  channel?: string | null;
  externalThreadId?: string | null;
  lastActivityAt?: string | null;
  notes?: string[];
  archived?: boolean;
};

export type GatewayTasksListResult = {
  tasks: GatewayTaskRecord[];
};

export type GatewayTaskCreateInput = {
  title: string;
  description?: string;
  status?: TaskBoardStatus;
  assignedAgentId?: string | null;
  playbookJobId?: string | null;
  runId?: string | null;
  channel?: string | null;
  externalThreadId?: string | null;
  notes?: string[];
  source?: TaskBoardCard["source"];
  sourceEventId?: string | null;
};

export type GatewayTaskUpdateInput = {
  title?: string;
  description?: string;
  status?: TaskBoardStatus;
  assignedAgentId?: string | null;
  playbookJobId?: string | null;
  runId?: string | null;
  channel?: string | null;
  externalThreadId?: string | null;
  notes?: string[];
  archived?: boolean;
};

const trimOrUndefined = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
};

export const isUnsupportedTaskGatewayError = (error: unknown): boolean => {
  if (!(error instanceof GatewayResponseError)) return false;
  const code = error.code.trim().toUpperCase();
  const message = error.message.trim().toLowerCase();
  if (code === "METHOD_NOT_FOUND" || code === "NOT_IMPLEMENTED") return true;
  if (code !== "INVALID_REQUEST" && code !== "NOT_FOUND") {
    return message.includes("unknown method") || message.includes("not implemented");
  }
  return (
    message.includes("unknown method") ||
    message.includes("not implemented") ||
    message.includes("tasks.") ||
    message.includes("task ")
  );
};

export const listGatewayTasks = async (
  client: GatewayClient,
  params: { includeArchived?: boolean } = {}
): Promise<GatewayTasksListResult> => {
  return client.call<GatewayTasksListResult>("tasks.list", {
    includeArchived: params.includeArchived ?? true,
  });
};

export const createGatewayTask = async (
  client: GatewayClient,
  input: GatewayTaskCreateInput
): Promise<GatewayTaskRecord> => {
  const title = trimOrUndefined(input.title);
  if (!title) throw new Error("Task title is required.");
  return client.call<GatewayTaskRecord>("tasks.create", {
    title,
    ...(trimOrUndefined(input.description) ? { description: trimOrUndefined(input.description) } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.assignedAgentId !== undefined ? { assignedAgentId: input.assignedAgentId } : {}),
    ...(input.playbookJobId !== undefined ? { playbookJobId: input.playbookJobId } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(input.channel !== undefined ? { channel: trimOrUndefined(input.channel) ?? null } : {}),
    ...(input.externalThreadId !== undefined
      ? { externalThreadId: trimOrUndefined(input.externalThreadId) ?? null }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.sourceEventId !== undefined ? { sourceEventId: input.sourceEventId } : {}),
  });
};

export const updateGatewayTask = async (
  client: GatewayClient,
  id: string,
  patch: GatewayTaskUpdateInput
): Promise<GatewayTaskRecord> => {
  const taskId = trimOrUndefined(id);
  if (!taskId) throw new Error("Task id is required.");
  return client.call<GatewayTaskRecord>("tasks.update", {
    id: taskId,
    ...(patch.title !== undefined ? { title: trimOrUndefined(patch.title) ?? "" } : {}),
    ...(patch.description !== undefined
      ? { description: trimOrUndefined(patch.description) ?? "" }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.assignedAgentId !== undefined ? { assignedAgentId: patch.assignedAgentId } : {}),
    ...(patch.playbookJobId !== undefined ? { playbookJobId: patch.playbookJobId } : {}),
    ...(patch.runId !== undefined ? { runId: patch.runId } : {}),
    ...(patch.channel !== undefined ? { channel: trimOrUndefined(patch.channel) ?? null } : {}),
    ...(patch.externalThreadId !== undefined
      ? { externalThreadId: trimOrUndefined(patch.externalThreadId) ?? null }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
  });
};

export const deleteGatewayTask = async (client: GatewayClient, id: string) => {
  const taskId = trimOrUndefined(id);
  if (!taskId) throw new Error("Task id is required.");
  return client.call<{ ok: boolean; removed?: boolean }>("tasks.delete", { id: taskId });
};
