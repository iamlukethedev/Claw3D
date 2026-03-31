import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  archiveSharedTask,
  listSharedTasks,
  resolveSharedTaskStorePath,
  upsertSharedTask,
} from "@/lib/tasks/shared-store";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("shared task store", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("creates and lists persisted tasks", () => {
    tempDir = makeTempDir("shared-task-store-create");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const created = upsertSharedTask({
      id: "task-1",
      title: "Research mtulsa.com",
      description: "Check site positioning.",
      status: "todo",
      source: "claw3d_manual",
    });

    expect(created.history).toHaveLength(1);
    expect(created.history[0]).toEqual(
      expect.objectContaining({
        type: "created",
        toStatus: "todo",
      })
    );

    const stored = listSharedTasks();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe("Research mtulsa.com");
    expect(fs.existsSync(resolveSharedTaskStorePath())).toBe(true);
  });

  it("appends history when task status changes and archives instead of deleting", () => {
    tempDir = makeTempDir("shared-task-store-history");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    upsertSharedTask({
      id: "task-1",
      title: "Research mtulsa.com",
      status: "todo",
      source: "claw3d_manual",
    });
    const updated = upsertSharedTask({
      id: "task-1",
      title: "Research mtulsa.com",
      status: "in_progress",
      source: "claw3d_manual",
    });
    const archived = archiveSharedTask("task-1");

    expect(updated.history.map((entry) => entry.type)).toContain("status_changed");
    expect(archived?.isArchived).toBe(true);
    expect(archived?.history.map((entry) => entry.type)).toContain("archived");
  });

  it("recovers gracefully from corrupted JSON on disk", () => {
    tempDir = makeTempDir("shared-task-store-corrupt");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    upsertSharedTask({ id: "t-1", title: "Valid task", status: "todo", source: "claw3d_manual" });
    const storePath = resolveSharedTaskStorePath();
    fs.writeFileSync(storePath, "{invalid json!!!", "utf8");

    const tasks = listSharedTasks();
    expect(tasks).toEqual([]);

    const afterCorrupt = upsertSharedTask({ id: "t-2", title: "After recovery", status: "todo", source: "claw3d_manual" });
    expect(afterCorrupt.id).toBe("t-2");
    expect(listSharedTasks()).toHaveLength(1);
  });

  it("performs atomic writes so partial failures don't corrupt the store", () => {
    tempDir = makeTempDir("shared-task-store-atomic");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    upsertSharedTask({ id: "t-1", title: "Safe task", status: "todo", source: "claw3d_manual" });
    const storePath = resolveSharedTaskStorePath();
    const original = fs.readFileSync(storePath, "utf8");

    expect(JSON.parse(original)).toEqual(
      expect.objectContaining({ schemaVersion: 1 })
    );
    expect(listSharedTasks()).toHaveLength(1);
  });

  it("coerces invalid status and source to defaults", () => {
    tempDir = makeTempDir("shared-task-store-coerce");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const task = upsertSharedTask({
      id: "t-coerce",
      title: "Coerce test",
      status: "banana" as never,
      source: "alien" as never,
    });
    expect(task.status).toBe("todo");
    expect(task.source).toBe("claw3d_manual");
  });

  it("truncates oversized title and description", () => {
    tempDir = makeTempDir("shared-task-store-truncate");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const longTitle = "A".repeat(1000);
    const longDesc = "B".repeat(10_000);
    const task = upsertSharedTask({
      id: "t-long",
      title: longTitle,
      description: longDesc,
      status: "todo",
      source: "claw3d_manual",
    });

    expect(task.title.length).toBeLessThanOrEqual(500);
    expect(task.description.length).toBeLessThanOrEqual(5000);
  });

  it("returns null when archiving a non-existent task", () => {
    tempDir = makeTempDir("shared-task-store-archive-missing");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const result = archiveSharedTask("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns an empty list when store file does not exist", () => {
    tempDir = makeTempDir("shared-task-store-missing-file");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    expect(listSharedTasks()).toEqual([]);
  });
});
