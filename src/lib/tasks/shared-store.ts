import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { TaskBoardCard, TaskBoardSource, TaskBoardStatus } from "@/features/office/tasks/types";
import { isTaskBoardSource, isTaskBoardStatus } from "@/features/office/tasks/types";
import { resolveStateDir } from "@/lib/clawdbot/paths";

export type SharedTaskHistoryEntry = {
  at: string;
  type: "created" | "updated" | "status_changed" | "archived";
  note: string | null;
  fromStatus: TaskBoardStatus | null;
  toStatus: TaskBoardStatus | null;
};

export type SharedTaskRecord = TaskBoardCard & {
  history: SharedTaskHistoryEntry[];
};

type SharedTaskStore = {
  schemaVersion: 1;
  updatedAt: string;
  tasks: SharedTaskRecord[];
};

const STORE_DIR = path.join("claw3d", "task-manager");
const STORE_FILE = "tasks.json";

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveStorePath = () => {
  const stateDir = resolveStateDir();
  const dir = path.join(stateDir, STORE_DIR);
  ensureDirectory(dir);
  return path.join(dir, STORE_FILE);
};

const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const normalizeHistoryEntry = (value: unknown): SharedTaskHistoryEntry | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const at = trimString(record.at);
  const type = trimString(record.type);
  if (!at) return null;
  if (!["created", "updated", "status_changed", "archived"].includes(type)) return null;
  return {
    at,
    type: type as SharedTaskHistoryEntry["type"],
    note: trimString(record.note) || null,
    fromStatus: isTaskBoardStatus(record.fromStatus) ? record.fromStatus : null,
    toStatus: isTaskBoardStatus(record.toStatus) ? record.toStatus : null,
  };
};

const normalizeTaskRecord = (value: unknown): SharedTaskRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = trimString(record.id);
  const title = trimString(record.title);
  const createdAt = trimString(record.createdAt);
  const updatedAt = trimString(record.updatedAt);
  if (!id || !title || !createdAt || !updatedAt) return null;
  return {
    id,
    title,
    description: trimString(record.description),
    status: isTaskBoardStatus(record.status) ? record.status : "todo",
    source: isTaskBoardSource(record.source) ? record.source : "claw3d_manual",
    sourceEventId: trimString(record.sourceEventId) || null,
    assignedAgentId: trimString(record.assignedAgentId) || null,
    createdAt,
    updatedAt,
    playbookJobId: trimString(record.playbookJobId) || null,
    runId: trimString(record.runId) || null,
    channel: trimString(record.channel) || null,
    externalThreadId: trimString(record.externalThreadId) || null,
    lastActivityAt: trimString(record.lastActivityAt) || null,
    notes: normalizeStringArray(record.notes),
    isArchived: Boolean(record.isArchived),
    isInferred: false,
    history: Array.isArray(record.history)
      ? record.history
          .map((entry) => normalizeHistoryEntry(entry))
          .filter((entry): entry is SharedTaskHistoryEntry => Boolean(entry))
      : [],
  };
};

const defaultStore = (): SharedTaskStore => ({
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  tasks: [],
});

const normalizeStore = (value: unknown): SharedTaskStore => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStore();
  }
  const record = value as Record<string, unknown>;
  const updatedAt = trimString(record.updatedAt) || new Date(0).toISOString();
  const tasks = Array.isArray(record.tasks)
    ? record.tasks
        .map((entry) => normalizeTaskRecord(entry))
        .filter((entry): entry is SharedTaskRecord => Boolean(entry))
    : [];
  return {
    schemaVersion: 1,
    updatedAt,
    tasks,
  };
};

const readStore = (): SharedTaskStore => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) return defaultStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return defaultStore();
  }
};

const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5_000;
const MAX_NOTE_LENGTH = 2_000;
const MAX_NOTES_COUNT = 50;
const MAX_TASKS = 500;

const writeStore = (store: SharedTaskStore) => {
  const storePath = resolveStorePath();
  const dir = path.dirname(storePath);
  const tmpPath = path.join(dir, `.tasks-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmpPath, storePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }
};

const truncateField = (value: string, max: number) =>
  value.length <= max ? value : value.slice(0, max);

const appendHistory = (
  existing: SharedTaskRecord | null,
  next: SharedTaskRecord
): SharedTaskHistoryEntry[] => {
  if (!existing) {
    return [
      {
        at: next.updatedAt,
        type: "created",
        note: "Task created.",
        fromStatus: null,
        toStatus: next.status,
      },
    ];
  }
  const prior = existing.history ?? [];
  if (existing.isArchived !== next.isArchived && next.isArchived) {
    return [
      ...prior,
      {
        at: next.updatedAt,
        type: "archived",
        note: "Task archived.",
        fromStatus: existing.status,
        toStatus: existing.status,
      },
    ];
  }
  if (existing.status !== next.status) {
    return [
      ...prior,
      {
        at: next.updatedAt,
        type: "status_changed",
        note: null,
        fromStatus: existing.status,
        toStatus: next.status,
      },
    ];
  }
  if (existing.updatedAt !== next.updatedAt) {
    return [
      ...prior,
      {
        at: next.updatedAt,
        type: "updated",
        note: null,
        fromStatus: existing.status,
        toStatus: next.status,
      },
    ];
  }
  return prior;
};

export const listSharedTasks = (): SharedTaskRecord[] => readStore().tasks;

export const upsertSharedTask = (
  task: Partial<SharedTaskRecord> & Pick<SharedTaskRecord, "id" | "title">
): SharedTaskRecord => {
  const store = readStore();
  const existing = store.tasks.find((entry) => entry.id === task.id) ?? null;
  const nowIso = task.updatedAt?.trim() || new Date().toISOString();
  const rawStatus = task.status ?? existing?.status ?? "todo";
  const rawSource = (task.source as TaskBoardSource | undefined) ?? existing?.source ?? "claw3d_manual";
  const notes = (task.notes ? [...task.notes] : [...(existing?.notes ?? [])])
    .slice(0, MAX_NOTES_COUNT)
    .map((n) => truncateField(n, MAX_NOTE_LENGTH));

  const next: SharedTaskRecord = {
    id: task.id.trim(),
    title: truncateField(task.title.trim() || existing?.title || "Untitled task", MAX_TITLE_LENGTH),
    description: truncateField(task.description?.trim() ?? existing?.description ?? "", MAX_DESCRIPTION_LENGTH),
    status: isTaskBoardStatus(rawStatus) ? rawStatus : "todo",
    source: isTaskBoardSource(rawSource) ? rawSource : "claw3d_manual",
    sourceEventId: task.sourceEventId ?? existing?.sourceEventId ?? null,
    assignedAgentId: task.assignedAgentId ?? existing?.assignedAgentId ?? null,
    createdAt: task.createdAt?.trim() || existing?.createdAt || nowIso,
    updatedAt: nowIso,
    playbookJobId: task.playbookJobId ?? existing?.playbookJobId ?? null,
    runId: task.runId ?? existing?.runId ?? null,
    channel: task.channel ?? existing?.channel ?? null,
    externalThreadId: task.externalThreadId ?? existing?.externalThreadId ?? null,
    lastActivityAt: task.lastActivityAt ?? existing?.lastActivityAt ?? nowIso,
    notes,
    isArchived: task.isArchived ?? existing?.isArchived ?? false,
    isInferred: false,
    history: [],
  };
  next.history = appendHistory(existing, next);
  const index = store.tasks.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    store.tasks[index] = next;
  } else {
    if (store.tasks.length >= MAX_TASKS) {
      const archivedIndex = store.tasks.findIndex((t) => t.isArchived);
      if (archivedIndex >= 0) {
        store.tasks.splice(archivedIndex, 1);
      } else {
        store.tasks.shift();
      }
    }
    store.tasks.push(next);
  }
  store.updatedAt = nowIso;
  writeStore(store);
  return next;
};

export const archiveSharedTask = (taskId: string): SharedTaskRecord | null => {
  const existing = readStore().tasks.find((entry) => entry.id === taskId.trim()) ?? null;
  if (!existing) return null;
  return upsertSharedTask({
    ...existing,
    isArchived: true,
    updatedAt: new Date().toISOString(),
  });
};

export const resolveSharedTaskStorePath = () => resolveStorePath();
