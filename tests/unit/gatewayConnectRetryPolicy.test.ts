import { describe, expect, it } from "vitest";

import { resolveGatewayAutoRetryDelayMs } from "@/lib/gateway/GatewayClient";

describe("resolveGatewayAutoRetryDelayMs", () => {
  it("does not retry when upstream gateway url is missing on Studio host", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      status: "disconnected",
      didAutoConnect: true,
      hasConnectedOnce: true,
      wasManualDisconnect: false,
      gatewayUrl: "wss://remote.example",
      errorMessage: "Gateway error (studio.gateway_url_missing): Upstream gateway URL is missing.",
      connectErrorCode: "studio.gateway_url_missing",
      attempt: 0,
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream websocket upgrade fails", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      status: "disconnected",
      didAutoConnect: true,
      hasConnectedOnce: true,
      wasManualDisconnect: false,
      gatewayUrl: "wss://remote.example",
      errorMessage:
        "Gateway error (studio.upstream_error): Failed to connect to upstream gateway WebSocket.",
      connectErrorCode: "studio.upstream_error",
      attempt: 0,
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream websocket handshake times out", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      status: "disconnected",
      didAutoConnect: true,
      hasConnectedOnce: true,
      wasManualDisconnect: false,
      gatewayUrl: "wss://remote.example",
      errorMessage:
        "Gateway error (studio.upstream_timeout): Timed out connecting Studio to the upstream gateway WebSocket.",
      connectErrorCode: "studio.upstream_timeout",
      attempt: 0,
    });

    expect(delay).toBeNull();
  });

  it("does not retry when the upstream gateway explicitly rejects pairing", () => {
    const delay = resolveGatewayAutoRetryDelayMs({
      status: "disconnected",
      didAutoConnect: true,
      hasConnectedOnce: true,
      wasManualDisconnect: false,
      gatewayUrl: "wss://remote.example",
      errorMessage:
        "Gateway error (studio.upstream_rejected): Upstream gateway rejected connect (1008): pairing required.",
      connectErrorCode: "studio.upstream_rejected",
      attempt: 0,
    });

    expect(delay).toBeNull();
  });
});

