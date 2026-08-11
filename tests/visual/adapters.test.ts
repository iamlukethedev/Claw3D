import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockAdapter, snapshotForScenario } from "@claw3d/adapter-mock";
import { createNullAdapter } from "@claw3d/adapter-null";

describe("visual adapters", () => {
  afterEach(() => vi.useRealTimers());

  it("null performs no network operation and reports offline", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const adapter = createNullAdapter();
    const snapshot = await adapter.query.getSnapshot();
    expect(snapshot.system.health).toBe("offline");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("covers every required mock presentation state", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(snapshotForScenario("empty").actors).toHaveLength(0);
    expect(snapshotForScenario("offline").system.health).toBe("offline");
    expect(snapshotForScenario("inactive").actors[0]?.status).toBe("idle");
    expect(snapshotForScenario("active").actors[0]?.status).toBe("working");
    expect(snapshotForScenario("error").system.health).toBe("degraded");
    expect(snapshotForScenario("multiple").actors.length).toBeGreaterThan(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("emits a reset scenario and stops cleanly", async () => {
    vi.useFakeTimers();
    const adapter = createMockAdapter("reset");
    const events: string[] = [];
    const stop = adapter.events.subscribe({}, (event) => events.push(event.type));
    await vi.advanceTimersByTimeAsync(800);
    expect(events).toEqual(["stream.reset"]);
    stop();
    await vi.runAllTimersAsync();
    expect(events).toHaveLength(1);
  });
});
