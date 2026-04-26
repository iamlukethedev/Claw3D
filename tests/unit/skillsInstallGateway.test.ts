import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { installPackagedSkillViaGatewayAgent } from "@/lib/skills/install-gateway";

describe("skills install gateway", () => {
  it("creates a temporary installer agent and installs a workspace skill", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "agents.create") {
        return { agentId: "installer-1" };
      }
      if (method === "config.get") {
        return {
          exists: true,
          hash: "hash-1",
          config: {
            agents: {
              list: [{ id: "installer-1", tools: {} }],
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

    const result = await installPackagedSkillViaGatewayAgent({
      client: { call } as unknown as GatewayClient,
      request: {
        packageId: "todo-board",
        source: "openclaw-workspace",
        workspaceDir: "/home/openclaw/workspace-demo",
        managedSkillsDir: "/home/openclaw/.openclaw/skills",
      },
    });

    expect(result).toEqual({
      installed: true,
      installedPath: "/home/openclaw/workspace-demo/skills/todo-board",
      source: "openclaw-workspace",
      skillKey: "todo-board",
    });
    expect(call).toHaveBeenCalledWith("agents.create", {
      name: expect.stringContaining("Skill Installer"),
      workspace: "/home/openclaw/workspace-demo",
    });
    expect(call).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        sessionKey: "agent:installer-1:main",
        deliver: false,
      })
    );
    expect(call).toHaveBeenCalledWith("agent.wait", { runId: "run-1", timeoutMs: 60_000 });
    expect(call).toHaveBeenCalledWith(
      "config.patch",
      expect.objectContaining({
        baseHash: "hash-1",
      })
    );
  });

  it("cleans up the temporary installer agent when install fails", async () => {
    const call = vi.fn(async (method: string) => {
      if (method === "agents.create") {
        return { agentId: "installer-2" };
      }
      if (method === "config.get") {
        return {
          exists: true,
          hash: "hash-2",
          config: {
            agents: {
              list: [{ id: "installer-2", tools: {} }],
            },
          },
        };
      }
      if (method === "config.set") {
        return { ok: true };
      }
      if (method === "agents.list") {
        return { mainKey: "main" };
      }
      if (method === "chat.send") {
        throw new Error("chat failed");
      }
      if (method === "config.patch") {
        return { ok: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await expect(
      installPackagedSkillViaGatewayAgent({
        client: { call } as unknown as GatewayClient,
        request: {
          packageId: "todo-board",
          source: "openclaw-workspace",
          workspaceDir: "/home/openclaw/workspace-demo",
          managedSkillsDir: "/home/openclaw/.openclaw/skills",
        },
      })
    ).rejects.toThrow("chat failed");

    expect(call).toHaveBeenCalledWith(
      "config.patch",
      expect.objectContaining({
        baseHash: "hash-2",
      })
    );
  });

  it("rejects installs when the gateway reports the global root workspace", async () => {
    const call = vi.fn();

    await expect(
      installPackagedSkillViaGatewayAgent({
        client: { call } as unknown as GatewayClient,
        request: {
          packageId: "todo-board",
          source: "openclaw-workspace",
          workspaceDir: "/home/pi/.openclaw/workspace",
          managedSkillsDir: "/home/pi/.openclaw/skills",
          agentId: "soundclaw",
          agentName: "soundclaw",
        },
      })
    ).rejects.toThrow(/gateway root workspace/i);

    expect(call).toHaveBeenCalledTimes(3);
    expect(call).toHaveBeenNthCalledWith(1, "agents.files.get", {
      agentId: "soundclaw",
      name: "IDENTITY.md",
    });
  });

  it("repairs the workspace from agent file provenance before creating the installer agent", async () => {
    const call = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === "agents.files.get") {
        expect(params).toEqual({ agentId: "main", name: "IDENTITY.md" });
        return {
          workspace: "/home/pi/.openclaw/workspace",
          file: {
            missing: false,
            content: "# IDENTITY",
            path: "/home/pi/.openclaw/workspace-main/IDENTITY.md",
          },
        };
      }
      if (method === "agents.create") {
        return { agentId: "installer-3" };
      }
      if (method === "config.get") {
        return {
          exists: true,
          hash: "hash-3",
          config: {
            agents: {
              list: [{ id: "installer-3", tools: {} }],
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
        return { runId: "run-3", status: "started" };
      }
      if (method === "agent.wait") {
        return { ok: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const result = await installPackagedSkillViaGatewayAgent({
      client: { call } as unknown as GatewayClient,
      request: {
        packageId: "todo-board",
        source: "openclaw-workspace",
        workspaceDir: "/home/pi/.openclaw/workspace",
        managedSkillsDir: "/home/pi/.openclaw/skills",
        agentId: "main",
        agentName: "main",
      },
    });

    expect(result.installedPath).toBe("/home/pi/.openclaw/workspace-main/skills/todo-board");
    expect(call).toHaveBeenCalledWith("agents.create", {
      name: expect.stringContaining("Skill Installer"),
      workspace: "/home/pi/.openclaw/workspace-main",
    });
  });
});
