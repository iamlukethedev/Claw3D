import { describe, expect, it } from "vitest";
import { createMockSnapshot } from "@claw3d/visual-contract/fixtures";
import {
  INITIAL_VISUAL_STATE,
  createOfficeViewModel,
  planVisualPath,
  visualReducer,
} from "@claw3d/visual-core";

describe("visual core", () => {
  it("deduplicates events and ignores unknown additive events", () => {
    const snapshot = createMockSnapshot({ history: [] });
    const loaded = visualReducer(INITIAL_VISUAL_STATE, { type: "snapshot.received", snapshot });
    const event = {
      schemaVersion: 1 as const,
      eventId: "same-event",
      type: "actor.status.changed" as const,
      occurredAt: "2026-08-11T10:00:00.000Z",
      actorId: "dev",
      state: "working" as const,
      metadata: {},
    };
    const once = visualReducer(loaded, {
      type: "event.received",
      event,
      receivedAt: "2026-08-11T10:00:01.000Z",
    });
    const twice = visualReducer(once, {
      type: "event.received",
      event,
      receivedAt: "2026-08-11T10:00:02.000Z",
    });
    expect(twice).toEqual(once);

    const unknown = visualReducer(once, {
      type: "event.received",
      event: { ...event, eventId: "unknown", type: "future.additive.event" },
      receivedAt: "2026-08-11T10:00:02.000Z",
    });
    expect(unknown.snapshot?.actors).toEqual(once.snapshot?.actors);
  });

  it("does not reactivate an actor from an old or out-of-order event", () => {
    const snapshot = createMockSnapshot({ history: [] });
    const loaded = visualReducer(INITIAL_VISUAL_STATE, { type: "snapshot.received", snapshot });
    const next = visualReducer(loaded, {
      type: "event.received",
      receivedAt: "2026-08-11T10:05:00.000Z",
      event: {
        schemaVersion: 1,
        eventId: "old-event",
        type: "actor.activity",
        occurredAt: "2026-08-11T10:00:00.000Z",
        actorId: "dev",
        metadata: {},
      },
    });
    expect(next.snapshot?.actors.find((actor) => actor.id === "dev")?.status).toBe("idle");
  });

  it("clears transient activity on stream reset", () => {
    const snapshot = createMockSnapshot({ history: [] });
    const loaded = visualReducer(INITIAL_VISUAL_STATE, { type: "snapshot.received", snapshot });
    const reset = visualReducer(loaded, { type: "stream.reset" });
    expect(reset.snapshot?.actors.every((actor) => ["idle", "offline"].includes(actor.status))).toBe(true);
    expect(reset.connection.phase).toBe("reconnecting");
  });

  it("plans a bounded path around an obstacle", () => {
    const path = planVisualPath(
      { x: -2, z: 0 },
      { x: 2, z: 0 },
      [{ center: { x: 0, z: 0 }, width: 1.5, depth: 1.5 }],
    );
    expect(path[0]).toEqual({ x: -2, z: 0 });
    expect(path.at(-1)).toEqual({ x: 2, z: 0 });
    expect(path.some((point) => Math.abs(point.z) >= 1)).toBe(true);
  });

  it("builds a deterministic view model without avatar assets", () => {
    const model = createOfficeViewModel(createMockSnapshot());
    expect(model.actors.map((actor) => actor.initials)).toEqual(["I", "D", "Q", "O"]);
    expect(model.activeCount).toBe(2);
    expect(model.errorCount).toBe(1);
  });
});
