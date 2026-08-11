import { describe, expect, it } from "vitest";
import {
  mapPrivateEvent,
  mapPrivateStatus,
  parseSseFrame,
} from "@claw3d/adapter-jarvis-readonly";

describe("private read-only anti-corruption mapper", () => {
  it("keeps only registered actor identities from a status snapshot", () => {
    const snapshot = mapPrivateStatus({
      agents_registered: ["info", "school", "info", "../unsafe"],
      raw_conversations: [{ content: "must never leave the server" }],
      secret: "never-expose",
      local_path: "/private/data",
    }, new Date("2026-08-11T09:00:00.000Z"));

    expect(snapshot.actors.map((actor) => actor.id)).toEqual(["info", "school"]);
    expect(snapshot.capabilities).toMatchObject({ readOnly: true, sessionAuth: false });
    expect(JSON.stringify(snapshot)).not.toContain("never-expose");
    expect(JSON.stringify(snapshot)).not.toContain("must never leave");
    expect(JSON.stringify(snapshot)).not.toContain("/private/data");
  });

  it("maps allowlisted activity while dropping messages and tool payloads", () => {
    const event = mapPrivateEvent({
      event_id: "8d55fb5f-activity",
      type: "agent.action",
      timestamp: 1_786_438_800,
      agent: "info",
      data: {
        message: "private prompt",
        arguments: { path: "/private/file" },
        result: "private result",
      },
    });

    expect(event).toMatchObject({
      schemaVersion: 1,
      eventId: "8d55fb5f-activity",
      type: "actor.activity",
      actorId: "info",
      state: "working",
    });
    expect(JSON.stringify(event)).not.toContain("private");
  });

  it("maps tasks and notifications through exact safe fields", () => {
    const task = mapPrivateEvent({
      event_id: "task-event-1",
      type: "task.updated",
      timestamp: 1_786_438_800,
      data: {
        task_id: 42,
        changes: { title: "Prepare visual report", status: "completed", progress: 100 },
        internal_notes: "not exposed",
      },
    });
    const notification = mapPrivateEvent({
      event_id: "notification-event-1",
      type: "notification.created",
      timestamp: 1_786_438_800,
      data: {
        notification_id: 7,
        title: "Visual source ready",
        priority: "high",
        content: "private body",
      },
    });

    expect(task?.task).toMatchObject({ id: "task-42", status: "completed", progress: 100 });
    expect(notification?.notification).toMatchObject({ id: "notification-7", level: "error" });
    expect(JSON.stringify([task, notification])).not.toContain("internal_notes");
    expect(JSON.stringify([task, notification])).not.toContain("private body");
  });

  it("ignores unknown and malformed additive events", () => {
    expect(mapPrivateEvent({ event_id: "future-1", type: "future.additive", timestamp: 1 })).toBeNull();
    expect(mapPrivateEvent({ type: "agent.start", timestamp: 1, agent: "info" })).toBeNull();
    expect(mapPrivateEvent("not-an-event")).toBeNull();
  });

  it("parses Last-Event-ID compatible SSE frames and stream resets", () => {
    expect(parseSseFrame("id: 17\nevent: visual\ndata: {\"schemaVersion\":1}\n")).toEqual({
      id: "17",
      event: "visual",
      data: "{\"schemaVersion\":1}",
    });
    expect(mapPrivateEvent({
      event_id: "stream-reset-17",
      type: "stream.reset",
      timestamp: 1_786_438_800,
      data: { reason: "cursor-gap", leaked: "ignored" },
    })).toMatchObject({ type: "stream.reset", metadata: { reason: "cursor-gap" } });
  });
});
