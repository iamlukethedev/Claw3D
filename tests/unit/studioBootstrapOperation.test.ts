import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentStoreSeed } from "@/features/agents/state/store";
import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import { defaultStudioSettings, type StudioSettingsPatch } from "@/lib/studio/settings";

vi.mock("@/features/agents/operations/agentFleetHydration", () => ({
  hydrateAgentFleetFromGateway: vi.fn(),
}));

import { hydrateAgentFleetFromGateway } from "@/features/agents/operations/agentFleetHydration";
import {
  executeStudioBootstrapLoadCommands,
  executeStudioFocusedPatchCommands,
  executeStudioFocusedPreferenceLoadCommands,
  runStudioBootstrapLoadOperation,
  runStudioFocusFilterPersistenceOperation,
  runStudioFocusedPreferenceLoadOperation,
  runStudioFocusedSelectionPersistenceOperation,
  type StudioBootstrapLoadCommand,
} from "@/features/agents/operations/studioBootstrapOperation";

const hydrateAgentFleetFromGatewayMock = vi.mocked(hydrateAgentFleetFromGateway);

describe("studioBootstrapOperation", () => {
  beforeEach(() => {
    hydrateAgentFleetFromGatewayMock.mockReset();
  });

  it("builds bootstrap commands from hydrated fleet result", async () => {
    const seeds: AgentStoreSeed[] = [
      {
        agentId: "agent-1",
        name: "Agent One",
        sessionKey: "agent:agent-1:main",
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        sessionKey: "agent:agent-2:main",
      },
    ];
    const snapshot = { config: {} } as GatewayModelPolicySnapshot;
    hydrateAgentFleetFromGatewayMock.mockResolvedValue({
      seeds,
      sessionCreatedAgentIds: ["agent-1"],
      sessionSettingsSyncedAgentIds: ["agent-1"],
      summaryPatches: [{ agentId: "agent-2", patch: { latestPreview: "hello" } }],
      suggestedSelectedAgentId: "agent-2",
      configSnapshot: snapshot,
    });

    const commands = await runStudioBootstrapLoadOperation({
      client: { call: async () => null },
      gatewayUrl: "https://gateway.test",
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => null,
      isDisconnectLikeError: () => false,
      preferredSelectedAgentId: "agent-1",
      hasCurrentSelection: false,
    });

    expect(commands).toEqual([
      { kind: "set-gateway-config-snapshot", snapshot },
      {
        kind: "hydrate-agents",
        seeds,
        initialSelectedAgentId: "agent-1",
      },
      {
        kind: "mark-session-created",
        agentId: "agent-1",
        sessionSettingsSynced: true,
      },
      {
        kind: "apply-summary-patch",
        agentId: "agent-2",
        patch: { latestPreview: "hello" },
      },
    ]);
  });

  it("returns set-error command when fleet hydration fails", async () => {
    hydrateAgentFleetFromGatewayMock.mockRejectedValue(new Error("load failed"));

    const commands = await runStudioBootstrapLoadOperation({
      client: { call: async () => null },
      gatewayUrl: "https://gateway.test",
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => null,
      isDisconnectLikeError: () => false,
      preferredSelectedAgentId: null,
      hasCurrentSelection: false,
    });

    expect(commands).toEqual([{ kind: "set-error", message: "load failed" }]);
  });

  it("executes bootstrap commands with injected callbacks", () => {
    const commands: StudioBootstrapLoadCommand[] = [
      {
        kind: "set-gateway-config-snapshot",
        snapshot: { config: {} } as GatewayModelPolicySnapshot,
      },
      {
        kind: "hydrate-agents",
        seeds: [{ agentId: "agent-1", name: "Agent One", sessionKey: "s1" }],
        initialSelectedAgentId: "agent-1",
      },
      {
        kind: "mark-session-created",
        agentId: "agent-1",
        sessionSettingsSynced: true,
      },
      {
        kind: "apply-summary-patch",
        agentId: "agent-1",
        patch: { latestPreview: "preview" },
      },
      {
        kind: "set-error",
        message: "failed",
      },
    ];

    const setGatewayConfigSnapshot = vi.fn();
    const hydrateAgents = vi.fn();
    const dispatchUpdateAgent = vi.fn();
    const setError = vi.fn();

    executeStudioBootstrapLoadCommands({
      commands,
      setGatewayConfigSnapshot,
      hydrateAgents,
      dispatchUpdateAgent,
      setError,
    });

    expect(setGatewayConfigSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateAgents).toHaveBeenCalledWith(
      [{ agentId: "agent-1", name: "Agent One", sessionKey: "s1" }],
      "agent-1"
    );
    expect(dispatchUpdateAgent).toHaveBeenCalledWith("agent-1", {
      sessionCreated: true,
      sessionSettingsSynced: true,
    });
    expect(dispatchUpdateAgent).toHaveBeenCalledWith("agent-1", { latestPreview: "preview" });
    expect(setError).toHaveBeenCalledWith("failed");
  });

  it("loads focused preference and emits restore commands", async () => {
    const commands = await runStudioFocusedPreferenceLoadOperation({
      gatewayUrl: "https://gateway.test",
      loadStudioSettings: async () => ({
        ...defaultStudioSettings(),
        focused: {
          "https://gateway.test": {
            mode: "focused",
            selectedAgentId: "agent-9",
            filter: "running",
          },
        },
      }),
      isFocusFilterTouched: () => false,
    });

    expect(commands).toEqual([
      {
        kind: "set-preferred-selected-agent-id",
        agentId: "agent-9",
      },
      {
        kind: "set-focus-filter",
        filter: "all",
      },
      {
        kind: "set-focused-preferences-loaded",
        value: true,
      },
    ]);
  });

  it("skips focused preference restore when user touched filter during load", async () => {
    const commands = await runStudioFocusedPreferenceLoadOperation({
      gatewayUrl: "https://gateway.test",
      loadStudioSettings: async () => ({
        ...defaultStudioSettings(),
        focused: {
          "https://gateway.test": {
            mode: "focused",
            selectedAgentId: "agent-9",
            filter: "running",
          },
        },
      }),
      isFocusFilterTouched: () => true,
    });

    expect(commands).toEqual([
      {
        kind: "set-focused-preferences-loaded",
        value: true,
      },
    ]);
  });

  it("returns focused preference load error command on failure", async () => {
    const commands = await runStudioFocusedPreferenceLoadOperation({
      gatewayUrl: "https://gateway.test",
      loadStudioSettings: async () => {
        throw new Error("settings failed");
      },
      isFocusFilterTouched: () => false,
    });

    expect(commands[0]).toMatchObject({
      kind: "log-error",
      message: "Failed to load focused preference.",
    });
    expect(commands[1]).toEqual({
      kind: "set-focused-preferences-loaded",
      value: true,
    });
  });

  it("executes focused preference load commands", () => {
    const setFocusedPreferencesLoaded = vi.fn();
    const setPreferredSelectedAgentId = vi.fn();
    const setFocusFilter = vi.fn();
    const logError = vi.fn();

    executeStudioFocusedPreferenceLoadCommands({
      commands: [
        { kind: "set-focused-preferences-loaded", value: false },
        { kind: "set-preferred-selected-agent-id", agentId: "agent-1" },
        { kind: "set-focus-filter", filter: "approvals" },
        { kind: "log-error", message: "failed", error: new Error("boom") },
      ],
      setFocusedPreferencesLoaded,
      setPreferredSelectedAgentId,
      setFocusFilter,
      logError,
    });

    expect(setFocusedPreferencesLoaded).toHaveBeenCalledWith(false);
    expect(setPreferredSelectedAgentId).toHaveBeenCalledWith("agent-1");
    expect(setFocusFilter).toHaveBeenCalledWith("approvals");
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("plans focused persistence patch commands and executes scheduler", () => {
    const filterCommands = runStudioFocusFilterPersistenceOperation({
      gatewayUrl: "https://gateway.test",
      focusFilterTouched: true,
      focusFilter: "running",
    });
    const selectionCommands = runStudioFocusedSelectionPersistenceOperation({
      gatewayUrl: "https://gateway.test",
      status: "connected",
      focusedPreferencesLoaded: true,
      agentsLoadedOnce: true,
      selectedAgentId: "agent-2",
    });

    const schedulePatch = vi.fn();
    executeStudioFocusedPatchCommands({
      commands: [...filterCommands, ...selectionCommands],
      schedulePatch,
    });

    expect(schedulePatch).toHaveBeenCalledTimes(2);
    const firstCall = schedulePatch.mock.calls[0] as [StudioSettingsPatch, number];
    const secondCall = schedulePatch.mock.calls[1] as [StudioSettingsPatch, number];
    expect(firstCall[1]).toBe(300);
    expect(secondCall[1]).toBe(300);
  });
});
