import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DELETE, GET, PUT } from "@/app/api/task-store/route";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const makeRequest = (method: string, body?: unknown) =>
  new Request("http://localhost/api/task-store", {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

describe("task store route", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("GET returns an empty task list by default", async () => {
    tempDir = makeTempDir("task-store-route-get");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await GET();
    const body = (await response.json()) as { tasks?: unknown[] };

    expect(response.status).toBe(200);
    expect(body.tasks).toEqual([]);
  });

  it("PUT upserts a task and DELETE archives it", async () => {
    tempDir = makeTempDir("task-store-route-put");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const putResponse = await PUT(
      makeRequest("PUT", {
        task: {
          id: "task-1",
          title: "Research mtulsa.com",
          status: "todo",
          source: "claw3d_manual",
        },
      })
    );
    const putBody = (await putResponse.json()) as {
      task?: { id?: string; isArchived?: boolean; history?: Array<{ type?: string }> };
    };

    expect(putResponse.status).toBe(200);
    expect(putBody.task?.id).toBe("task-1");
    expect(putBody.task?.history?.[0]?.type).toBe("created");

    const deleteResponse = await DELETE(
      makeRequest("DELETE", { id: "task-1" })
    );
    const deleteBody = (await deleteResponse.json()) as {
      task?: { isArchived?: boolean; history?: Array<{ type?: string }> };
    };

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.task?.isArchived).toBe(true);
    expect(deleteBody.task?.history?.some((entry) => entry.type === "archived")).toBe(true);
  });

  it("PUT returns 400 for missing task payload", async () => {
    tempDir = makeTempDir("task-store-route-put-no-task");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT(makeRequest("PUT", { notTask: true }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Task payload is required");
  });

  it("PUT returns 400 for empty id or title", async () => {
    tempDir = makeTempDir("task-store-route-put-empty");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT(
      makeRequest("PUT", { task: { id: "", title: "Something" } })
    );
    expect(response.status).toBe(400);

    const response2 = await PUT(
      makeRequest("PUT", { task: { id: "x", title: "" } })
    );
    expect(response2.status).toBe(400);
  });

  it("PUT returns 400 for invalid status enum", async () => {
    tempDir = makeTempDir("task-store-route-put-bad-status");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT(
      makeRequest("PUT", {
        task: { id: "t-1", title: "Test", status: "banana" },
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Invalid status");
  });

  it("PUT returns 400 for invalid source enum", async () => {
    tempDir = makeTempDir("task-store-route-put-bad-source");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT(
      makeRequest("PUT", {
        task: { id: "t-1", title: "Test", source: "alien" },
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Invalid source");
  });

  it("PUT returns 400 for invalid JSON body", async () => {
    tempDir = makeTempDir("task-store-route-put-bad-json");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT(
      new Request("http://localhost/api/task-store", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not valid json{{{",
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("Invalid JSON");
  });

  it("DELETE returns 404 for non-existent task", async () => {
    tempDir = makeTempDir("task-store-route-delete-404");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await DELETE(
      makeRequest("DELETE", { id: "does-not-exist" })
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("not found");
  });

  it("DELETE returns 400 for missing id", async () => {
    tempDir = makeTempDir("task-store-route-delete-no-id");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await DELETE(
      makeRequest("DELETE", { id: "" })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("id is required");
  });

  it("DELETE returns 400 for invalid JSON body", async () => {
    tempDir = makeTempDir("task-store-route-delete-bad-json");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await DELETE(
      new Request("http://localhost/api/task-store", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: "broken{",
      })
    );
    expect(response.status).toBe(400);
  });

  it("all responses include cache-control: no-store", async () => {
    tempDir = makeTempDir("task-store-route-cache");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const getResp = await GET();
    expect(getResp.headers.get("cache-control")).toBe("no-store");

    const putResp = await PUT(
      makeRequest("PUT", { task: { id: "t-1", title: "T" } })
    );
    expect(putResp.headers.get("cache-control")).toBe("no-store");
  });
});
