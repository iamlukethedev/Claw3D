import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { GatewayResponseError } from "@/lib/gateway/errors";
import {
  createGatewayTask,
  deleteGatewayTask,
  isUnsupportedTaskGatewayError,
  listGatewayTasks,
  updateGatewayTask,
} from "@/lib/tasks/gateway";

describe("task gateway client", () => {
  it("lists tasks via tasks.list", async () => {
    const client = {
      call: vi.fn(async () => ({ tasks: [] })),
    } as unknown as GatewayClient;

    await listGatewayTasks(client);

    expect(client.call).toHaveBeenCalledWith("tasks.list", { includeArchived: true });
  });

  it("creates tasks via tasks.create", async () => {
    const client = {
      call: vi.fn(async () => ({ id: "task-1", title: "Ship board", status: "todo" })),
    } as unknown as GatewayClient;

    await createGatewayTask(client, {
      title: "Ship board",
      description: "Release the board.",
      status: "todo",
      source: "claw3d_manual",
    });

    expect(client.call).toHaveBeenCalledWith(
      "tasks.create",
      expect.objectContaining({
        title: "Ship board",
        description: "Release the board.",
        status: "todo",
        source: "claw3d_manual",
      })
    );
  });

  it("updates and deletes tasks via gateway methods", async () => {
    const client = {
      call: vi.fn(async () => ({ ok: true })),
    } as unknown as GatewayClient;

    await updateGatewayTask(client, "task-1", { status: "review" });
    await deleteGatewayTask(client, "task-1");

    expect(client.call).toHaveBeenCalledWith(
      "tasks.update",
      expect.objectContaining({ id: "task-1", status: "review" })
    );
    expect(client.call).toHaveBeenCalledWith("tasks.delete", { id: "task-1" });
  });

  it("detects unsupported task gateway methods", () => {
    expect(
      isUnsupportedTaskGatewayError(
        new GatewayResponseError({
          code: "METHOD_NOT_FOUND",
          message: "Unknown method tasks.list",
        })
      )
    ).toBe(true);
  });
});
