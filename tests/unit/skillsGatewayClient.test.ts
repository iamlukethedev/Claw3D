import { describe, expect, it, vi } from "vitest";

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { installSkill, loadAgentSkillStatus, updateSkill } from "@/lib/skills/types";

describe("skills gateway client", () => {
  it("loads skills status for the selected agent", async () => {
    const report = {
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    };
    const client = {
      call: vi.fn(async () => report),
    } as unknown as GatewayClient;

    const result = await loadAgentSkillStatus(client, " agent-1 ");

    expect(client.call).toHaveBeenCalledWith("skills.status", { agentId: "agent-1" });
    expect(result).toBe(report);
  });

  it("repairs root workspace reports using agent file provenance", async () => {
    const client = {
      call: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        if (method === "skills.status") {
          return {
            workspaceDir: "/home/pi/.openclaw/workspace",
            managedSkillsDir: "/home/pi/.openclaw/skills",
            skills: [],
          };
        }
        if (method === "agents.files.get") {
          expect(params).toEqual({
            agentId: "main",
            name: "IDENTITY.md",
          });
          return {
            workspace: "/home/pi/.openclaw/workspace-main",
            file: {
              missing: false,
              content: "# IDENTITY",
              path: "/home/pi/.openclaw/workspace-main/IDENTITY.md",
            },
          };
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    } as unknown as GatewayClient;

    const result = await loadAgentSkillStatus(client, "main");

    expect(result.workspaceDir).toBe("/home/pi/.openclaw/workspace-main");
    expect(client.call).toHaveBeenNthCalledWith(1, "skills.status", { agentId: "main" });
    expect(client.call).toHaveBeenNthCalledWith(2, "agents.files.get", {
      agentId: "main",
      name: "IDENTITY.md",
    });
  });

  it("derives workspace from file path when agents.files.get reports the root workspace", async () => {
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "skills.status") {
          return {
            workspaceDir: "/home/pi/.openclaw/workspace",
            managedSkillsDir: "/home/pi/.openclaw/skills",
            skills: [],
          };
        }
        if (method === "agents.files.get") {
          return {
            workspace: "/home/pi/.openclaw/workspace",
            file: {
              missing: false,
              content: "# IDENTITY",
              path: "/home/pi/.openclaw/workspace-main/IDENTITY.md",
            },
          };
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    } as unknown as GatewayClient;

    const result = await loadAgentSkillStatus(client, "main");

    expect(result.workspaceDir).toBe("/home/pi/.openclaw/workspace-main");
  });

  it("fails fast when agent id is empty", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(loadAgentSkillStatus(client, "  ")).rejects.toThrow(
      "Agent id is required to load skill status."
    );
    expect(client.call).not.toHaveBeenCalled();
  });

  it("installs skill dependencies with normalized params", async () => {
    const response = {
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    };
    const client = {
      call: vi.fn(async () => response),
    } as unknown as GatewayClient;

    const result = await installSkill(client, {
      name: " browser ",
      installId: " install-browser ",
      timeoutMs: 120_000,
    });

    expect(client.call).toHaveBeenCalledWith("skills.install", {
      name: "browser",
      installId: "install-browser",
      timeoutMs: 120_000,
    });
    expect(result).toBe(response);
  });

  it("fails fast when install inputs are empty", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(installSkill(client, { name: " ", installId: "id" })).rejects.toThrow(
      "Skill name is required to install dependencies."
    );
    await expect(installSkill(client, { name: "browser", installId: " " })).rejects.toThrow(
      "Install option id is required to install dependencies."
    );
    expect(client.call).not.toHaveBeenCalled();
  });

  it("updates skill setup with normalized skill key", async () => {
    const response = {
      ok: true,
      skillKey: "browser",
      config: {},
    };
    const client = {
      call: vi.fn(async () => response),
    } as unknown as GatewayClient;

    const result = await updateSkill(client, {
      skillKey: " browser ",
      apiKey: "secret-token",
    });

    expect(client.call).toHaveBeenCalledWith("skills.update", {
      skillKey: "browser",
      apiKey: "secret-token",
    });
    expect(result).toBe(response);
  });

  it("updates global enabled state through skills.update", async () => {
    const response = {
      ok: true,
      skillKey: "browser",
      config: {},
    };
    const client = {
      call: vi.fn(async () => response),
    } as unknown as GatewayClient;

    await updateSkill(client, {
      skillKey: " browser ",
      enabled: false,
    });

    expect(client.call).toHaveBeenCalledWith("skills.update", {
      skillKey: "browser",
      enabled: false,
    });
  });

  it("fails fast when skill key is empty for updates", async () => {
    const client = {
      call: vi.fn(),
    } as unknown as GatewayClient;

    await expect(updateSkill(client, { skillKey: " ", apiKey: "token" })).rejects.toThrow(
      "Skill key is required to update skill setup."
    );
    expect(client.call).not.toHaveBeenCalled();
  });
});
