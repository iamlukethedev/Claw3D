import { describe, expect, it, vi } from "vitest";

import { readGatewayAgentFile } from "@/lib/gateway/agentFiles";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

const createMockClient = (handler: (method: string, params: unknown) => unknown) => {
  return { call: vi.fn(async (method: string, params: unknown) => handler(method, params)) } as unknown as GatewayClient;
};

describe("gateway agent files helpers", () => {
  it("returns exists=false when gateway reports missing", async () => {
    const client = createMockClient((method) => {
      if (method === "agents.files.get") {
        return { file: { missing: true } };
      }
      return {};
    });

    await expect(
      readGatewayAgentFile({ client, agentId: "agent-1", name: "AGENTS.md" })
    ).resolves.toEqual({ exists: false, content: "", path: null, workspace: null });
  });

  it("returns exists=true and content when gateway returns content", async () => {
    const client = createMockClient((method) => {
      if (method === "agents.files.get") {
        return { file: { missing: false, content: "hello" } };
      }
      return {};
    });

    await expect(
      readGatewayAgentFile({ client, agentId: "agent-1", name: "AGENTS.md" })
    ).resolves.toEqual({ exists: true, content: "hello", path: null, workspace: null });
  });

  it("coerces non-string content to empty string", async () => {
    const client = createMockClient((method) => {
      if (method === "agents.files.get") {
        return { file: { missing: false, content: { nope: true } } };
      }
      return {};
    });

    await expect(
      readGatewayAgentFile({ client, agentId: "agent-1", name: "AGENTS.md" })
    ).resolves.toEqual({ exists: true, content: "", path: null, workspace: null });
  });

  it("throws when agentId is empty", async () => {
    const client = createMockClient(() => ({}));
    await expect(
      readGatewayAgentFile({ client, agentId: "   ", name: "AGENTS.md" })
    ).rejects.toThrow("agentId is required.");
  });
});

