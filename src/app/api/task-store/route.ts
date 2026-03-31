import { isTaskBoardSource, isTaskBoardStatus } from "@/features/office/tasks/types";
import { archiveSharedTask, listSharedTasks, upsertSharedTask } from "@/lib/tasks/shared-store";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

const errorJson = (message: string, status: number) =>
  json({ error: message }, status);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export async function GET() {
  try {
    return json({ tasks: listSharedTasks() });
  } catch (error) {
    console.error("[task-store] GET failed:", error);
    return errorJson("Internal error reading task store.", 500);
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON payload.", 400);
  }
  if (!isRecord(body) || !isRecord(body.task)) {
    return errorJson("Task payload is required.", 400);
  }
  const task = body.task;
  const id = typeof task.id === "string" ? task.id.trim() : "";
  const title = typeof task.title === "string" ? task.title.trim() : "";
  if (!id || !title) {
    return errorJson("Task id and title are required.", 400);
  }
  if (task.status !== undefined && !isTaskBoardStatus(task.status)) {
    return errorJson(`Invalid status: "${String(task.status)}".`, 400);
  }
  if (task.source !== undefined && !isTaskBoardSource(task.source)) {
    return errorJson(`Invalid source: "${String(task.source)}".`, 400);
  }
  try {
    return json({
      task: upsertSharedTask({ ...task, id, title }),
    });
  } catch (error) {
    console.error("[task-store] PUT failed:", error);
    return errorJson("Internal error writing task store.", 500);
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON payload.", 400);
  }
  if (!isRecord(body)) {
    return errorJson("Task id is required.", 400);
  }
  const taskId = typeof body.id === "string" ? body.id.trim() : "";
  if (!taskId) {
    return errorJson("Task id is required.", 400);
  }
  try {
    const task = archiveSharedTask(taskId);
    if (!task) {
      return errorJson("Task not found.", 404);
    }
    return json({ task });
  } catch (error) {
    console.error("[task-store] DELETE failed:", error);
    return errorJson("Internal error archiving task.", 500);
  }
}
