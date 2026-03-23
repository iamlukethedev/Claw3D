import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { removeSkillViaGatewayAgent } from "@/lib/skills/remove-gateway";

describe("skills remove gateway", () => {
  it("creates a temporary remover agent and removes a workspace skill", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "agents.create") {
        return { agentId: "remover-1" };
      }
      if (method === "config.get") {
        return {
          exists: true,
          hash: "hash-1",
          config: {
            agents: {
              list: [{ id: "remover-1", tools: {} }],
            },
          },
        };
      }
      if (method === "config.set") {
        return { ok: true };
      }
      if (method === "config.patch") {
        return { ok: true };
      }
      if (method === "agents.list") {
        return { mainKey: "main" };
      }
      if (method === "chat.send") {
        return { runId: "run-1", status: "started" };
      }
      if (method === "agent.wait") {
        return { ok: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const result = await removeSkillViaGatewayAgent({
      client: { call } as unknown as GatewayClient,
      request: {
        skillKey: "todo-board",
        source: "openclaw-workspace",
        baseDir: "/home/openclaw/workspace-demo/skills/todo-board",
        workspaceDir: "/home/openclaw/workspace-demo",
        managedSkillsDir: "/home/openclaw/.openclaw/skills",
      },
    });

    expect(result).toEqual({
      removed: true,
      removedPath: "/home/openclaw/workspace-demo/skills/todo-board",
      source: "openclaw-workspace",
    });
    expect(call).toHaveBeenCalledWith("agents.create", {
      name: expect.stringContaining("Skill Remover"),
      workspace: "/home/openclaw/workspace-demo",
    });
    expect(call).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        sessionKey: "agent:remover-1:main",
        deliver: false,
      }),
    );
    expect(call).toHaveBeenCalledWith("agent.wait", { runId: "run-1", timeoutMs: 60_000 });
    expect(call).toHaveBeenCalledWith(
      "config.patch",
      expect.objectContaining({
        baseHash: "hash-1",
      }),
    );
  });

  it("uses the managed skills directory as workspace for managed skill removal", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "agents.create") {
        return { agentId: "remover-2" };
      }
      if (method === "config.get") {
        return {
          exists: true,
          hash: "hash-2",
          config: {
            agents: {
              list: [{ id: "remover-2", tools: {} }],
            },
          },
        };
      }
      if (method === "config.set") {
        return { ok: true };
      }
      if (method === "config.patch") {
        return { ok: true };
      }
      if (method === "agents.list") {
        return { mainKey: "main" };
      }
      if (method === "chat.send") {
        return { runId: "run-2", status: "started" };
      }
      if (method === "agent.wait") {
        return { ok: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await removeSkillViaGatewayAgent({
      client: { call } as unknown as GatewayClient,
      request: {
        skillKey: "github",
        source: "openclaw-managed",
        baseDir: "/home/openclaw/.openclaw/skills/github",
        workspaceDir: "/home/openclaw/workspace-demo",
        managedSkillsDir: "/home/openclaw/.openclaw/skills",
      },
    });

    expect(call).toHaveBeenCalledWith("agents.create", {
      name: expect.stringContaining("Skill Remover"),
      workspace: "/home/openclaw/.openclaw/skills",
    });
  });
});
