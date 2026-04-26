import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isPermissionsCustom,
  resolveAgentPermissionsDraft,
  resolveCommandModeFromRole,
  resolvePresetDefaultsForRole,
  resolveRoleForCommandMode,
  resolveToolGroupOverrides,
  resolveToolGroupStateFromConfigEntry,
  updateAgentPermissionsViaStudio,
  updateExecutionRoleViaStudio,
} from "@/features/agents/operations/agentPermissionsOperation";
import { syncGatewaySessionSettings } from "@/lib/gateway/GatewayClient";
import { updateGatewayAgentOverrides } from "@/lib/gateway/agentConfig";
import {
  readGatewayAgentExecApprovals,
  upsertGatewayAgentExecApprovals,
} from "@/lib/gateway/execApprovals";
import { GatewayResponseError } from "@/lib/gateway/errors";

vi.mock("@/lib/gateway/GatewayClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gateway/GatewayClient")>(
    "@/lib/gateway/GatewayClient"
  );
  return {
    ...actual,
    syncGatewaySessionSettings: vi.fn(),
  };
});

vi.mock("@/lib/gateway/agentConfig", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gateway/agentConfig")>(
    "@/lib/gateway/agentConfig"
  );
  return {
    ...actual,
    updateGatewayAgentOverrides: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/gateway/execApprovals", () => ({
  readGatewayAgentExecApprovals: vi.fn(async () => null),
  upsertGatewayAgentExecApprovals: vi.fn(async () => undefined),
}));

const createWebchatBlockedPatchError = () =>
  new GatewayResponseError({
    code: "INVALID_REQUEST",
    message: "webchat clients cannot patch sessions; use chat.send for session-scoped updates",
  });

describe("agentPermissionsOperation", () => {
  const mockedSyncGatewaySessionSettings = vi.mocked(syncGatewaySessionSettings);
  const mockedUpdateGatewayAgentOverrides = vi.mocked(updateGatewayAgentOverrides);
  const mockedReadGatewayAgentExecApprovals = vi.mocked(readGatewayAgentExecApprovals);
  const mockedUpsertGatewayAgentExecApprovals = vi.mocked(upsertGatewayAgentExecApprovals);

  beforeEach(() => {
    mockedSyncGatewaySessionSettings.mockReset();
    mockedUpdateGatewayAgentOverrides.mockClear();
    mockedReadGatewayAgentExecApprovals.mockReset();
    mockedUpsertGatewayAgentExecApprovals.mockReset();
    mockedReadGatewayAgentExecApprovals.mockResolvedValue(null);
    mockedUpsertGatewayAgentExecApprovals.mockResolvedValue(undefined);
    mockedUpdateGatewayAgentOverrides.mockResolvedValue(undefined);
  });

  it("maps command mode and preset role in both directions", () => {
    expect(resolveRoleForCommandMode("off")).toBe("conservative");
    expect(resolveRoleForCommandMode("ask")).toBe("collaborative");
    expect(resolveRoleForCommandMode("auto")).toBe("autonomous");

    expect(resolveCommandModeFromRole("conservative")).toBe("off");
    expect(resolveCommandModeFromRole("collaborative")).toBe("ask");
    expect(resolveCommandModeFromRole("autonomous")).toBe("auto");
  });

  it("resolves autonomous preset defaults to permissive capabilities", () => {
    expect(resolvePresetDefaultsForRole("autonomous")).toEqual({
      commandMode: "auto",
      webAccess: true,
      fileTools: true,
    });
  });

  it("derives tool-group state from allow and deny with deny precedence", () => {
    const state = resolveToolGroupStateFromConfigEntry({
      allow: ["group:web", "group:runtime"],
      deny: ["group:web"],
    });

    expect(state.usesAllow).toBe(true);
    expect(state.runtime).toBe(true);
    expect(state.web).toBe(false);
    expect(state.fs).toBeNull();
  });

  it("merges group toggles while preserving allow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        allow: ["group:web", "custom:tool"],
        deny: ["group:runtime", "group:fs"],
      },
      runtimeEnabled: true,
      webEnabled: false,
      fsEnabled: true,
    });

    expect(overrides.tools.allow).toEqual(
      expect.arrayContaining(["custom:tool", "group:runtime", "group:fs"])
    );
    expect(overrides.tools.allow).not.toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:web"]));
    expect(overrides.tools.deny).not.toEqual(
      expect.arrayContaining(["group:runtime", "group:fs"])
    );
  });

  it("merges group toggles while preserving alsoAllow mode", () => {
    const overrides = resolveToolGroupOverrides({
      existingTools: {
        alsoAllow: ["group:web"],
        deny: [],
      },
      runtimeEnabled: true,
      webEnabled: true,
      fsEnabled: false,
    });

    expect(overrides.tools).not.toHaveProperty("allow");
    expect(overrides.tools.alsoAllow).toEqual(
      expect.arrayContaining(["group:web", "group:runtime"])
    );
    expect(overrides.tools.deny).toEqual(expect.arrayContaining(["group:fs"]));
  });

  it("resolves draft from session role and config group overrides", () => {
    const draft = resolveAgentPermissionsDraft({
      agent: {
        sessionExecSecurity: "allowlist",
        sessionExecAsk: "always",
      },
      existingTools: {
        allow: ["group:web"],
        deny: ["group:fs"],
      },
    });

    expect(draft).toEqual({
      commandMode: "ask",
      webAccess: true,
      fileTools: false,
    });
  });

  it("flags custom draft when advanced values diverge from preset baseline", () => {
    expect(
      isPermissionsCustom({
        role: "autonomous",
        draft: {
          commandMode: "auto",
          webAccess: false,
          fileTools: true,
        },
      })
    ).toBe(true);
  });

  it("does not fail permission updates when webchat blocks sessions.patch after config writes", async () => {
    mockedSyncGatewaySessionSettings.mockRejectedValue(createWebchatBlockedPatchError());
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            config: {
              agents: [
                {
                  id: "agent-1",
                  sandbox: { mode: "workspace-write" },
                  tools: { allow: ["group:web"], deny: [] },
                },
              ],
            },
          };
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    } as never;
    const loadAgents = vi.fn(async () => undefined);

    await expect(
      updateAgentPermissionsViaStudio({
        client,
        agentId: "agent-1",
        sessionKey: "session-1",
        draft: {
          commandMode: "ask",
          webAccess: true,
          fileTools: false,
        },
        loadAgents,
      })
    ).resolves.toBeUndefined();

    expect(mockedUpsertGatewayAgentExecApprovals).toHaveBeenCalledTimes(1);
    expect(mockedUpdateGatewayAgentOverrides).toHaveBeenCalledTimes(1);
    expect(mockedSyncGatewaySessionSettings).toHaveBeenCalledTimes(1);
    expect(loadAgents).toHaveBeenCalledTimes(1);
  });

  it("does not fail execution-role updates when webchat blocks sessions.patch after config writes", async () => {
    mockedSyncGatewaySessionSettings.mockRejectedValue(createWebchatBlockedPatchError());
    const client = {
      call: vi.fn(async (method: string) => {
        if (method === "config.get") {
          return {
            config: {
              agents: [
                {
                  id: "agent-1",
                  sandbox: { mode: "workspace-write" },
                  tools: { allow: ["group:web"], deny: [] },
                },
              ],
            },
          };
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    } as never;
    const loadAgents = vi.fn(async () => undefined);

    await expect(
      updateExecutionRoleViaStudio({
        client,
        agentId: "agent-1",
        sessionKey: "session-1",
        role: "autonomous",
        loadAgents,
      })
    ).resolves.toBeUndefined();

    expect(mockedUpsertGatewayAgentExecApprovals).toHaveBeenCalledTimes(1);
    expect(mockedUpdateGatewayAgentOverrides).toHaveBeenCalledTimes(1);
    expect(mockedSyncGatewaySessionSettings).toHaveBeenCalledTimes(1);
    expect(loadAgents).toHaveBeenCalledTimes(1);
  });
});
