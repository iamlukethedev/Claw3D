import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@noble/ed25519", () => ({
  getPublicKeyAsync: vi.fn(async () => new Uint8Array([1, 2, 3])),
  signAsync: vi.fn(async () => new Uint8Array([9, 9, 9])),
  utils: {
    randomSecretKey: vi.fn(() => new Uint8Array([4, 5, 6])),
  },
}));

import { GatewayBrowserClient } from "@/lib/gateway/openclaw/GatewayBrowserClient";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  static sent: string[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    MockWebSocket.sent.push(String(data));
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "" } as CloseEvent);
  }
}

describe("GatewayBrowserClient token auth precedence", () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalSubtle = globalThis.crypto?.subtle;
  const DEVICE_IDENTITY_STORAGE_KEY = "openclaw-device-identity-v1";
  const DEVICE_AUTH_STORAGE_KEY = "openclaw.device.auth.v1";
  const storedDeviceId = "0".repeat(64);

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockWebSocket.sent = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    if (globalThis.crypto) {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: {
          digest: vi.fn(async () => new Uint8Array(32).buffer),
        },
        configurable: true,
      });
    }
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    globalThis.WebSocket = originalWebSocket;
    if (globalThis.crypto) {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });
    }
  });

  it("prefers explicit shared token over first-time device auth on secure contexts", async () => {
    const client = new GatewayBrowserClient({ url: "ws://example.com", token: "shared-secret" });
    client.start();

    const ws = MockWebSocket.instances[0];
    if (!ws) throw new Error("WebSocket not created");

    ws.onopen?.();
    await vi.runAllTimersAsync();

    expect(MockWebSocket.sent).toHaveLength(1);
    const frame = JSON.parse(MockWebSocket.sent[0] ?? "{}");
    expect(frame.type).toBe("req");
    expect(frame.method).toBe("connect");
    expect(frame.id).toMatch(UUID_V4_RE);
    expect(frame.params?.auth?.token).toBe("shared-secret");
    expect(frame.params?.device).toBeUndefined();
  });

  it("continues using stored device auth when a device token already exists", async () => {
    localStorage.setItem(
      DEVICE_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        deviceId: storedDeviceId,
        publicKey: "AQID",
        privateKey: "BAUG",
        createdAtMs: Date.now(),
      })
    );
    localStorage.setItem(
      DEVICE_AUTH_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        deviceId: storedDeviceId,
        tokens: {
          "ws://example.com::operator": {
            token: "stored-device-token",
            role: "operator",
            scopes: ["operator.admin"],
            updatedAtMs: Date.now(),
          },
        },
      })
    );

    const client = new GatewayBrowserClient({ url: "ws://example.com", token: "shared-secret" });
    client.start();

    const ws = MockWebSocket.instances[0];
    if (!ws) throw new Error("WebSocket not created");

    ws.onopen?.();
    await vi.runAllTimersAsync();

    expect(MockWebSocket.sent).toHaveLength(1);
    const frame = JSON.parse(MockWebSocket.sent[0] ?? "{}");
    expect(frame.params?.auth?.token).toBe("stored-device-token");
    expect(frame.params?.device?.id).toBe(storedDeviceId);
  });
});
