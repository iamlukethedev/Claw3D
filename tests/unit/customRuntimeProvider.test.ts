// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { CustomRuntimeProvider } from "@/lib/runtime/custom/provider";

type ProxiedRequest = { pathname: string; body?: Record<string, unknown> };

const runtimeResponses: Record<string, unknown> = {
  "/health": { ok: true, status: "ok" },
  "/state": { active: { main: "demo-model" } },
  "/registry": { models: { "demo-model": {}, "other-model": {} } },
  "/v1/chat/completions": { choices: [{ message: { role: "assistant", content: "Hello." } }] },
};

const stubRuntime = () => {
  const requests: ProxiedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      const proxied = JSON.parse(String(init?.body)) as ProxiedRequest;
      requests.push(proxied);
      return new Response(JSON.stringify(runtimeResponses[proxied.pathname] ?? {}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
  return requests;
};

const createProvider = () =>
  new CustomRuntimeProvider({} as GatewayClient, "http://127.0.0.1:7770");

describe("CustomRuntimeProvider sessions.patch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("acknowledges session settings the runtime does not use instead of failing chat", async () => {
    stubRuntime();
    const provider = createProvider();

    await expect(
      provider.call("sessions.patch", {
        key: "agent:main:main",
        thinkingLevel: "high",
        execHost: null,
        execSecurity: null,
        execAsk: null,
      })
    ).resolves.toEqual({ ok: true, key: "agent:main:main" });
  });

  it("keeps the selected model and sends its bare id with the next chat message", async () => {
    const requests = stubRuntime();
    const provider = createProvider();

    await expect(
      provider.call("sessions.patch", { key: "agent:main:main", model: "custom/other-model" })
    ).resolves.toEqual({
      ok: true,
      key: "agent:main:main",
      resolved: { modelProvider: "custom", model: "other-model" },
    });

    await expect(
      provider.call("chat.send", {
        sessionKey: "agent:main:main",
        message: "Hi",
        idempotencyKey: "run-1",
      })
    ).resolves.toMatchObject({ status: "completed", text: "Hello." });
    const chat = requests.find((request) => request.pathname === "/v1/chat/completions");
    expect(chat?.body?.model).toBe("other-model");
  });

  it("requires a session key", async () => {
    const provider = createProvider();

    await expect(provider.call("sessions.patch", { model: "custom/demo-model" })).rejects.toThrow(
      "Custom runtime requires key for sessions.patch."
    );
  });
});
