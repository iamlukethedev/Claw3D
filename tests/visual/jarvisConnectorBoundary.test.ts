import { afterEach, describe, expect, it, vi } from "vitest";
import { getVisualSnapshot, openVisualEventStream } from "../../apps/claw3d-ui/src/server/jarvisConnector";
import { SESSION_AUTH_POLICY } from "../../apps/claw3d-ui/src/server/sessionAuthPolicy";

const originalEnvironment = {
  enabled: process.env.JARVIS_CONNECTOR_ENABLED,
  origin: process.env.JARVIS_ORIGIN,
};

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnvironment.enabled === undefined) delete process.env.JARVIS_CONNECTOR_ENABLED;
  else process.env.JARVIS_CONNECTOR_ENABLED = originalEnvironment.enabled;
  if (originalEnvironment.origin === undefined) delete process.env.JARVIS_ORIGIN;
  else process.env.JARVIS_ORIGIN = originalEnvironment.origin;
});

function enableSyntheticOrigin() {
  process.env.JARVIS_CONNECTOR_ENABLED = "true";
  process.env.JARVIS_ORIGIN = "https://private-runtime.invalid";
}

describe("server-only private connector boundary", () => {
  it("sends only the exact allowlisted snapshot request without cookies", async () => {
    enableSyntheticOrigin();
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://private-runtime.invalid/api/status");
      expect(init).toMatchObject({
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "manual",
      });
      expect(JSON.stringify(init?.headers)).not.toMatch(/cookie|authorization|token/i);
      return Response.json({
        agents_registered: ["info"],
        conversations: [{ content: "private" }],
      }, {
        headers: {
          "set-cookie": "jarvis_session=secret; Domain=private-runtime.invalid; Path=/; SameSite=Strict; Secure; HttpOnly; Max-Age=3600",
        },
      });
    });
    vi.stubGlobal("fetch", request);

    const snapshot = await getVisualSnapshot();
    expect(snapshot.actors.map((actor) => actor.id)).toEqual(["info"]);
    expect(JSON.stringify(snapshot)).not.toMatch(/jarvis_session|secret|conversations/);
  });

  it("neutralizes streamed payloads and preserves the numeric SSE cursor", async () => {
    enableSyntheticOrigin();
    const upstream = [
      "id: 41",
      "data: {\"event_id\":\"evt-41\",\"type\":\"agent.start\",\"timestamp\":1786438800,\"agent\":\"info\",\"data\":{\"message\":\"private prompt\",\"path\":\"/private/file\"}}",
      "",
      "id: 42",
      "event: stream.reset",
      "data: {\"reason\":\"cursor-gap\",\"skipped\":4}",
      "",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ accept: "text/event-stream", "last-event-id": "40" });
      return new Response(upstream, { status: 200, headers: { "content-type": "text/event-stream" } });
    }));

    const result = await openVisualEventStream(new AbortController().signal, "40");
    expect(result.status).toBe(200);
    if (!result.stream) throw new Error("Expected a neutral event stream");
    const neutral = await new Response(result.stream).text();
    expect(neutral).toContain("id: 41");
    expect(neutral).toContain("actor.status.changed");
    expect(neutral).toContain("id: 42");
    expect(neutral).toContain("stream.reset");
    expect(neutral).not.toContain("private prompt");
    expect(neutral).not.toContain("/private/file");
    expect(neutral).not.toContain("skipped");
  });

  it("defines a closed session boundary for every cookie attribute", () => {
    expect(SESSION_AUTH_POLICY).toMatchObject({
      enabled: false,
      cookieRelay: "disabled",
      forwardedRequestHeaders: [],
      forwardedResponseHeaders: [],
    });
    expect(SESSION_AUTH_POLICY.rejectedCookieAttributes).toEqual([
      "Domain",
      "Path",
      "SameSite",
      "Secure",
      "HttpOnly",
      "Expires",
      "Max-Age",
    ]);
  });
});
