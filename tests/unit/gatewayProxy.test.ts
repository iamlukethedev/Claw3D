// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";

const waitForEvent = <T = unknown>(
  target: { once: (event: string, cb: (...args: unknown[]) => void) => void },
  event: string
) =>
  new Promise<T>((resolve) => {
    target.once(event, (...args: unknown[]) => resolve(args as unknown as T));
  });

const closeHttpServer = (server: import("node:http").Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

const closeWebSocketServer = (server: WebSocketServer) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

const closeWebSocket = (ws: WebSocket) =>
  new Promise<void>((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close();
  });

describe("createGatewayProxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("injects gateway token into connect request", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenToken: string | null = null;
    let seenOrigin: string | undefined;
    upstream.on("connection", (ws, req) => {
      seenOrigin = req.headers.origin;
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenToken = parsed?.params?.auth?.token ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "token-123" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");

      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-1",
          method: "connect",
          params: { auth: {} },
        })
      );

      await waitForEvent(browser, "message");

      expect(seenToken).toBe("token-123");
      expect(seenOrigin).toBe(`http://localhost:${address.port}`);
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("forwards upstream connect.challenge before browser connect and then passes nonce-based device auth", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenDeviceNonce: string | null = null;
    upstream.on("connection", (ws) => {
      ws.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: { nonce: "strict-gateway-nonce" },
        })
      );
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenDeviceNonce = parsed?.params?.device?.nonce ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");

      const [challengeRaw] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const challenge = JSON.parse(String(challengeRaw ?? ""));
      expect(challenge).toMatchObject({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "strict-gateway-nonce" },
      });

      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-after-challenge",
          method: "connect",
          params: {
            device: {
              id: "device-id-123",
              publicKey: "device-public-key-123",
              signature: "device-signature-123",
              signedAt: Date.now(),
              nonce: "strict-gateway-nonce",
            },
          },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-after-challenge", ok: true });
      expect(seenDeviceNonce).toBe("strict-gateway-nonce");
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("allows browser auth token passthrough when host token is missing", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenToken: string | null = null;
    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenToken = parsed?.params?.auth?.token ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-pass-token",
          method: "connect",
          params: { auth: { token: "browser-token-123" } },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-pass-token", ok: true });
      expect(seenToken).toBe("browser-token-123");
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("preserves browser auth token when both browser and host tokens are present", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenToken: string | null = null;
    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenToken = parsed?.params?.auth?.token ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "host-token-456" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-browser-precedence",
          method: "connect",
          params: { auth: { token: "browser-token-789" } },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-browser-precedence", ok: true });
      expect(seenToken).toBe("browser-token-789");
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("allows browser device signature passthrough when host token is missing", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenToken: string | null = null;
    let seenDeviceSignature: string | null = null;
    let seenDeviceId: string | null = null;
    let seenDevicePublicKey: string | null = null;
    let seenDeviceNonce: string | null = null;
    let seenDeviceSignedAt: number | null = null;
    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenToken = parsed?.params?.auth?.token ?? null;
          seenDeviceSignature = parsed?.params?.device?.signature ?? null;
          seenDeviceId = parsed?.params?.device?.id ?? null;
          seenDevicePublicKey = parsed?.params?.device?.publicKey ?? null;
          seenDeviceNonce = parsed?.params?.device?.nonce ?? null;
          seenDeviceSignedAt = parsed?.params?.device?.signedAt ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-pass-device",
          method: "connect",
          params: {
            device: {
              id: "device-id-123",
              publicKey: "device-public-key-123",
              signature: "device-signature-123",
              signedAt: Date.now(),
              nonce: "device-nonce-123",
            },
          },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-pass-device", ok: true });
      expect(seenDeviceSignature).toBe("device-signature-123");
      expect(seenDeviceId).toBe("device-id-123");
      expect(seenDevicePublicKey).toBe("device-public-key-123");
      expect(seenDeviceNonce).toBe("device-nonce-123");
      expect(typeof seenDeviceSignedAt).toBe("number");
      expect(seenToken).toBeNull();
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("allows browser password passthrough when host token is missing", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenPassword: string | null = null;
    let seenToken: string | null = null;
    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenPassword = parsed?.params?.auth?.password ?? null;
          seenToken = parsed?.params?.auth?.token ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-pass-password",
          method: "connect",
          params: { auth: { password: "browser-password-123" } },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-pass-password", ok: true });
      expect(seenPassword).toBe("browser-password-123");
      expect(seenToken).toBeNull();
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("allows browser deviceToken passthrough when host token is missing", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let seenDeviceToken: string | null = null;
    let seenToken: string | null = null;
    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          seenDeviceToken = parsed?.params?.auth?.deviceToken ?? null;
          seenToken = parsed?.params?.auth?.token ?? null;
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-pass-device-token",
          method: "connect",
          params: { auth: { deviceToken: "browser-device-token-123" } },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({ type: "res", id: "connect-pass-device-token", ok: true });
      expect(seenDeviceToken).toBe("browser-device-token-123");
      expect(seenToken).toBeNull();
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("returns studio.gateway_token_missing when browser auth and host token are both missing", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    let upstreamConnectionCount = 0;
    upstream.on("connection", () => {
      upstreamConnectionCount += 1;
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      const closePromise = waitForEvent<[number, Buffer]>(browser, "close");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-missing-token",
          method: "connect",
          params: { auth: {} },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({
        type: "res",
        id: "connect-missing-token",
        ok: false,
        error: { code: "studio.gateway_token_missing" },
      });

      const [closeCode] = await closePromise;
      expect(closeCode).toBe(1011);
      expect(upstreamConnectionCount).toBe(1);
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("surfaces upstream pairing rejection before browser close", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          ws.close(1008, "pairing required");
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "host-token-456" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-pairing-required",
          method: "connect",
          params: { auth: {} },
        })
      );

      const [rawMessage] = await waitForEvent<[WebSocket.RawData]>(browser, "message");
      const response = JSON.parse(String(rawMessage ?? ""));
      expect(response).toMatchObject({
        type: "res",
        id: "connect-pairing-required",
        ok: false,
        error: {
          code: "studio.upstream_rejected",
          message: "Upstream gateway rejected connect (1008): pairing required",
        },
      });
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("allows short bursts of post-connect traffic without closing the socket", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "host-token-456" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-burst-ok",
          method: "connect",
          params: { auth: {} },
        })
      );

      await waitForEvent(browser, "message");

      for (let index = 0; index < 80; index += 1) {
        browser.send(
          JSON.stringify({
            type: "req",
            id: `burst-ok-${index}`,
            method: "noop",
            params: { index },
          })
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(browser.readyState).toBe(WebSocket.OPEN);
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

  it("still rate limits abusive bursts that exceed the token bucket", async () => {
    const upstream = new WebSocketServer({ port: 0 });
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("expected upstream server to have a port");
    }
    const upstreamUrl = `ws://127.0.0.1:${address.port}`;

    upstream.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const parsed = JSON.parse(String(raw));
        if (parsed?.method === "connect") {
          ws.send(
            JSON.stringify({
              type: "res",
              id: parsed.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3, auth: {} },
            })
          );
        }
      });
    });

    const { createGatewayProxy } = await import("../../server/gateway-proxy");

    const proxyHttp = await import("node:http").then((m) => m.createServer());
    const proxy = createGatewayProxy({
      loadUpstreamSettings: async () => ({ url: upstreamUrl, token: "host-token-456" }),
      allowWs: (req: { url?: string }) => req.url === "/api/gateway/ws",
      logError: () => {},
    });
    proxyHttp.on("upgrade", (req, socket, head) => proxy.handleUpgrade(req, socket, head));

    await new Promise<void>((resolve) => proxyHttp.listen(0, "127.0.0.1", resolve));
    const proxyAddr = proxyHttp.address();
    if (!proxyAddr || typeof proxyAddr === "string") {
      throw new Error("expected proxy server to have a port");
    }

    const browser = new WebSocket(`ws://127.0.0.1:${proxyAddr.port}/api/gateway/ws`);
    try {
      await waitForEvent(browser, "open");
      browser.send(
        JSON.stringify({
          type: "req",
          id: "connect-burst-limit",
          method: "connect",
          params: { auth: {} },
        })
      );

      await waitForEvent(browser, "message");
      const closePromise = waitForEvent<[number, Buffer]>(browser, "close");

      for (let index = 0; index < 200; index += 1) {
        browser.send(
          JSON.stringify({
            type: "req",
            id: `burst-limit-${index}`,
            method: "noop",
            params: { index },
          })
        );
      }

      const [closeCode, closeReason] = await closePromise;
      expect(closeCode).toBe(1008);
      expect(closeReason.toString()).toBe("rate limit exceeded");
    } finally {
      for (const client of upstream.clients) {
        client.close();
      }
      await Promise.all([
        closeWebSocket(browser),
        closeWebSocketServer(upstream),
        closeHttpServer(proxyHttp),
      ]);
    }
  });

});
