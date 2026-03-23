import { afterEach, describe, expect, it, vi } from "vitest";

import { removeSkillFromGateway } from "@/lib/skills/remove";
import { removeSkillViaGatewayAgent } from "@/lib/skills/remove-gateway";

vi.mock("@/lib/skills/remove-gateway", () => ({
  removeSkillViaGatewayAgent: vi.fn(),
}));

describe("skills remove client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates sanitized skill removal payloads to the gateway-native remover", async () => {
    vi.mocked(removeSkillViaGatewayAgent).mockResolvedValueOnce({
      removed: true,
      removedPath: "/tmp/workspace/skills/github",
      source: "openclaw-workspace",
    });

    const result = await removeSkillFromGateway({
      client: { call: vi.fn() } as never,
      skillKey: " github ",
      source: "openclaw-workspace",
      baseDir: " /tmp/workspace/skills/github ",
      workspaceDir: " /tmp/workspace ",
      managedSkillsDir: " /tmp/managed ",
    });

    expect(removeSkillViaGatewayAgent).toHaveBeenCalledWith({
      client: expect.any(Object),
      request: {
        skillKey: "github",
        source: "openclaw-workspace",
        baseDir: "/tmp/workspace/skills/github",
        workspaceDir: "/tmp/workspace",
        managedSkillsDir: "/tmp/managed",
      },
    });
    expect(result).toEqual({
      removed: true,
      removedPath: "/tmp/workspace/skills/github",
      source: "openclaw-workspace",
    });
  });

  it("fails fast when required payload fields are missing", async () => {
    await expect(
      removeSkillFromGateway({
        client: { call: vi.fn() } as never,
        skillKey: " ",
        source: "openclaw-workspace",
        baseDir: "/tmp/workspace/skills/github",
        workspaceDir: "/tmp/workspace",
        managedSkillsDir: "/tmp/managed",
      })
    ).rejects.toThrow("skillKey is required.");

    await expect(
      removeSkillFromGateway({
        client: { call: vi.fn() } as never,
        skillKey: "github",
        source: "openclaw-workspace",
        baseDir: " ",
        workspaceDir: "/tmp/workspace",
        managedSkillsDir: "/tmp/managed",
      })
    ).rejects.toThrow("baseDir is required.");
  });
});
