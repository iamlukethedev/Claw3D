import { describe, expect, it } from "vitest";

import { resolveGatewayAutoRetryDelayMs } from "@/lib/gateway/GatewayClient";

const baseParams = {
  status: "disconnected" as const,
  didAutoConnect: true,
  hasConnectedOnce: true,
  wasManualDisconnect: false,
  gatewayUrl: "wss://remote.example",
  errorMessage: null as string | null,
  connectErrorCode: null as string | null,
  lastDisconnectCode: null as number | null,
  attempt: 0,
};

describe("resolveGatewayAutoRetryDelayMs", () => {
  it("does not retry when upstream gateway url is missing on Studio host", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      errorMessage: "Gateway error (studio.gateway_url_missing): Upstream gateway URL is missing.",
      connectErrorCode: "studio.gateway_url_missing",
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream websocket upgrade fails", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      errorMessage:
        "Gateway error (studio.upstream_error): Failed to connect to upstream gateway WebSocket.",
      connectErrorCode: "studio.upstream_error",
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream websocket handshake times out", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      errorMessage:
        "Gateway error (studio.upstream_timeout): Timed out connecting Studio to the upstream gateway WebSocket.",
      connectErrorCode: "studio.upstream_timeout",
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream gateway explicitly rejects pairing", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      errorMessage:
        "Gateway error (studio.upstream_rejected): Upstream gateway rejected connect (1008): pairing required.",
      connectErrorCode: "studio.upstream_rejected",
    });

    expect(delay).toBeNull();
  });

  it("uses a longer base delay when disconnected by rate limiting (code 1008)", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      lastDisconnectCode: 1008,
      attempt: 0,
    });

    expect(delay).toBe(15_000);
  });

  it("applies exponential backoff on top of rate-limit base delay", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      lastDisconnectCode: 1008,
      attempt: 1,
    });

    expect(delay).toBe(22_500);
  });

  it("uses standard base delay for normal disconnects", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      ...baseParams,
      lastDisconnectCode: 1012,
      attempt: 0,
    });

    expect(delay).toBe(2_000);
  });
});

