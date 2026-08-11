import { describe, expect, it, vi } from "vitest";
import { createJarvisReadonlyBrowserAdapter } from "@claw3d/adapter-jarvis-readonly";
import { createMockSnapshot } from "@claw3d/visual-contract/fixtures";

function eventStream(frames: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frames));
      controller.close();
    },
  });
}

describe("read-only browser adapter", () => {
  it("only calls fixed same-origin visual routes", async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/visual-runtime/v1/snapshot");
      return Response.json(createMockSnapshot());
    });
    const adapter = createJarvisReadonlyBrowserAdapter({ fetch: request as typeof fetch });
    await expect(adapter.query.getSnapshot()).resolves.toMatchObject({ schemaVersion: 1 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forwards a numeric stream cursor after reconnect and ignores malformed data", async () => {
    vi.useFakeTimers();
    const headers: Array<HeadersInit | undefined> = [];
    let calls = 0;
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers.push(init?.headers);
      calls += 1;
      if (calls === 1) {
        return new Response(eventStream(
          "id: 21\nevent: visual\ndata: {\"schemaVersion\":1,\"eventId\":\"evt-21\",\"type\":\"actor.status.changed\",\"occurredAt\":\"2026-08-11T09:00:00.000Z\",\"actorId\":\"info\",\"state\":\"idle\",\"metadata\":{}}\n\n"
          + "id: 22\ndata: not-json\n\n",
        ), { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response(null, { status: 401 });
    });
    const adapter = createJarvisReadonlyBrowserAdapter({
      fetch: request as typeof fetch,
      random: () => 0,
      baseDelayMs: 100,
    });
    const events: string[] = [];
    const states: string[] = [];
    const stop = adapter.events.subscribe({}, (event) => events.push(event.eventId), (state) => states.push(state.phase));
    await vi.advanceTimersByTimeAsync(150);
    stop();
    vi.useRealTimers();

    expect(events).toEqual(["evt-21"]);
    expect(states).toContain("locked");
    expect(headers[1]).toMatchObject({ "last-event-id": "22" });
  });

  it("stops cleanly on an external abort", async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
      return new Response();
    });
    const controller = new AbortController();
    const adapter = createJarvisReadonlyBrowserAdapter({ fetch: request as typeof fetch });
    const stop = adapter.events.subscribe({ signal: controller.signal }, () => undefined);
    controller.abort();
    stop();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
