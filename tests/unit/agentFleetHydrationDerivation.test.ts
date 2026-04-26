import { describe, expect, it } from "vitest";

import { deriveHydrateAgentFleetResult } from "@/features/agents/operations/agentFleetHydrationDerivation";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import { defaultStudioSettings, type StudioSettings } from "@/lib/studio/settings";

describe("deriveHydrateAgentFleetResult", () => {
  it("derives_seeds_and_sync_sets_from_snapshots", () => {
    const gatewayUrl = "ws://localhost:18789";

    const settings: StudioSettings = {
      ...defaultStudioSettings(),
      avatars: {
        [gatewayUrl]: {
          "agent-1": createDefaultAgentAvatarProfile("persisted-seed"),
        },
      },
    };

    const result = deriveHydrateAgentFleetResult({
      gatewayUrl,
      configSnapshot: {
        config: {
          agents: {
            defaults: {
              model: "openai/gpt-5",
            },
            list: [],
          },
        },
      },
      settings,
      execApprovalsSnapshot: {
        file: {
          agents: {
            "agent-1": { security: "allowlist", ask: "always" },
            "agent-2": { security: "full", ask: "off" },
          },
        },
      },
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        agents: [
          {
            id: "agent-1",
            name: "One",
            identity: { avatarUrl: "https://example.com/one.png" },
          },
          {
            id: "agent-2",
            name: "Two",
            identity: { avatarUrl: "https://example.com/two.png" },
          },
        ],
      },
      mainSessionByAgentId: new Map([
        [
          "agent-1",
          {
            key: "agent:agent-1:main",
            updatedAt: 1,
            displayName: "Main",
            thinkingLevel: "medium",
            modelProvider: "openai",
            model: "gpt-4.1",
          },
        ],
        [
          "agent-2",
          {
            key: "agent:agent-2:main",
            updatedAt: 1,
            displayName: "Main",
            thinkingLevel: "medium",
            modelProvider: "openai",
            model: "gpt-5",
          },
        ],
      ]),
      statusSummary: null,
      previewResult: null,
    });

    expect(result.seeds).toHaveLength(2);
    expect(result.seeds[0]).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        name: "One",
        runtimeName: "One",
        identityName: null,
        sessionDisplayName: "Main",
        sessionKey: "agent:agent-1:main",
        avatarSeed: "persisted-seed",
        avatarProfile: expect.objectContaining({ seed: "persisted-seed" }),
        avatarUrl: "https://example.com/one.png",
        model: "openai/gpt-4.1",
        thinkingLevel: "medium",
        sessionExecHost: "gateway",
        sessionExecSecurity: "allowlist",
        sessionExecAsk: "always",
      })
    );
    expect(result.seeds[1]).toEqual(
      expect.objectContaining({
        agentId: "agent-2",
        sessionExecHost: "gateway",
        sessionExecSecurity: "full",
        sessionExecAsk: "off",
      })
    );
    expect(result.sessionCreatedAgentIds).toEqual(["agent-1", "agent-2"]);
    expect(result.sessionSettingsSyncedAgentIds).toEqual([]);
    expect(result.suggestedSelectedAgentId).toBe(null);
    expect(result.summaryPatches).toEqual([]);
  });

  it("derives_summary_patches_and_suggested_agent_when_preview_present", () => {
    const gatewayUrl = "ws://127.0.0.1:18789";

    const result = deriveHydrateAgentFleetResult({
      gatewayUrl,
      configSnapshot: null,
      settings: null,
      execApprovalsSnapshot: null,
      agentsResult: {
        defaultId: "agent-1",
        mainKey: "main",
        agents: [
          { id: "agent-1", name: "One", identity: {} },
          { id: "agent-2", name: "Two", identity: {} },
        ],
      },
      mainSessionByAgentId: new Map([
        ["agent-1", { key: "agent:agent-1:main" }],
        ["agent-2", { key: "agent:agent-2:main" }],
      ]),
      statusSummary: {
        sessions: {
          recent: [],
          byAgent: [],
        },
      },
      previewResult: {
        ts: 1,
        previews: [
          {
            key: "agent:agent-1:main",
            status: "ok",
            items: [
              { role: "assistant", text: "one", timestamp: "2026-02-10T00:00:00Z" },
            ],
          },
          {
            key: "agent:agent-2:main",
            status: "ok",
            items: [
              { role: "assistant", text: "two", timestamp: "2026-02-10T01:00:00Z" },
            ],
          },
        ],
      },
    });

    expect(result.summaryPatches.length).toBeGreaterThan(0);
    expect(result.suggestedSelectedAgentId).toBe("agent-2");
  });
});
