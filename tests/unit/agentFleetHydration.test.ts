import { describe, expect, it, vi } from "vitest";

import { hydrateAgentFleetFromGateway } from "@/features/agents/operations/agentFleetHydration";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import { defaultStudioSettings, type StudioSettings } from "@/lib/studio/settings";

describe("hydrateAgentFleetFromGateway", () => {
  it("maps_gateway_results_into_seeds_and_selects_latest_assistant_agent", async () => {
    const gatewayUrl = "ws://localhost:18789";

    const settings: StudioSettings = {
      ...defaultStudioSettings(),
      avatars: {
        [gatewayUrl]: {
          "agent-1": createDefaultAgentAvatarProfile("persisted-seed"),
        },
      },
    };

    const call = vi.fn(async (method: string, params: unknown) => {
      if (method === "config.get") {
        return {
          hash: "hash-1",
          config: {
            agents: {
              defaults: {
                model: "openai/gpt-5",
              },
              list: [],
            },
          },
        };
      }
      if (method === "agents.list") {
        return {
          defaultId: "agent-1",
          mainKey: "main",
          agents: [
            {
              id: "agent-1",
              name: "One",
              identity: { name: "Main Persona", avatarUrl: "https://example.com/one.png" },
            },
            {
              id: "agent-2",
              name: "Two",
              identity: { avatarUrl: "https://example.com/two.png" },
            },
          ],
        };
      }
      if (method === "agents.files.get") {
        const record = params as Record<string, unknown>;
        if (record.agentId === "agent-2" && record.name === "IDENTITY.md") {
          return {
            workspace: "/tmp/workspace-agent-2",
            file: {
              missing: false,
              content: "# IDENTITY.md - Who Am I?\n\n- Name: GLaDOS\n",
              path: "/tmp/workspace-agent-2/IDENTITY.md",
            },
          };
        }
        return {
          workspace: "/tmp/workspace-agent-1",
          file: {
            missing: false,
            content: "# IDENTITY.md - Who Am I?\n\n- Name: Main Persona\n",
            path: "/tmp/workspace-agent-1/IDENTITY.md",
          },
        };
      }
      if (method === "exec.approvals.get") {
        return {
          file: {
            agents: {
              "agent-1": { security: "allowlist", ask: "always" },
              "agent-2": { security: "full", ask: "off" },
            },
          },
        };
      }
      if (method === "sessions.list") {
        const { agentId, search } = params as Record<string, unknown>;
        return {
          sessions: [
            {
              key: search,
              updatedAt: 1,
              displayName: "Main",
              thinkingLevel: "medium",
              modelProvider: "openai",
              model: agentId === "agent-2" ? "gpt-5" : "gpt-4.1",
            },
          ],
        };
      }
      if (method === "status") {
        return {
          sessions: {
            recent: [],
            byAgent: [],
          },
        };
      }
      if (method === "sessions.preview") {
        return {
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
        };
      }
      throw new Error(`Unhandled method: ${method}`);
    });

    const result = await hydrateAgentFleetFromGateway({
      client: { call },
      gatewayUrl,
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => settings,
      isDisconnectLikeError: () => false,
    });

    expect(call).toHaveBeenCalledWith("agents.list", {});
    expect(call).toHaveBeenCalledWith("exec.approvals.get", {});
    expect(result.seeds).toHaveLength(2);
    expect(result.seeds[0]).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        name: "Main Persona",
        runtimeName: "One",
        identityName: "Main Persona",
        sessionDisplayName: "Main",
        sessionKey: "agent:agent-1:main",
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
        name: "GLaDOS",
        runtimeName: "Two",
        identityName: "GLaDOS",
        sessionExecHost: "gateway",
        sessionExecSecurity: "full",
        sessionExecAsk: "off",
      })
    );
    expect(result.sessionCreatedAgentIds).toEqual(["agent-1", "agent-2"]);
    expect(result.sessionSettingsSyncedAgentIds).toEqual([]);
    expect(result.suggestedSelectedAgentId).toBe("agent-2");
    expect(result.summaryPatches.length).toBeGreaterThan(0);
  });

  it("keeps agents with a stable identity name when listed name is temporary and IDENTITY fetch fails", async () => {
    const gatewayUrl = "ws://127.0.0.1:18789";

    const call = vi.fn(async (method: string, params: unknown) => {
      if (method === "config.get") {
        return {
          hash: "hash-1",
          config: { agents: { defaults: {}, list: [] } },
        };
      }
      if (method === "agents.list") {
        return {
          defaultId: "agent-1",
          mainKey: "main",
          agents: [
            {
              id: "agent-1",
              name: "Skill Installer 1775838022769",
              identity: { name: "Alfred" },
            },
          ],
        };
      }
      if (method === "agents.files.get") {
        throw new Error("workspace unavailable");
      }
      if (method === "exec.approvals.get") {
        return { file: { agents: {} } };
      }
      if (method === "sessions.list") {
        const { search } = params as Record<string, unknown>;
        return {
          sessions: [
            {
              key: search,
              updatedAt: 1,
              displayName: "Main",
              thinkingLevel: "medium",
              modelProvider: "openai",
              model: "gpt-5",
            },
          ],
        };
      }
      if (method === "status") {
        return { sessions: { recent: [], byAgent: [] } };
      }
      if (method === "sessions.preview") {
        return {
          ts: 1,
          previews: [
            {
              key: "agent:agent-1:main",
              status: "ok",
              items: [
                { role: "assistant", text: "ready", timestamp: "2026-02-10T00:00:00Z" },
              ],
            },
          ],
        };
      }
      throw new Error(`Unhandled method: ${method}`);
    });

    const result = await hydrateAgentFleetFromGateway({
      client: { call },
      gatewayUrl,
      cachedConfigSnapshot: null,
      loadStudioSettings: async () => null,
      isDisconnectLikeError: () => false,
    });

    expect(result.seeds).toHaveLength(1);
    expect(result.seeds[0]).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        name: "Alfred",
        runtimeName: "Alfred",
        identityName: "Alfred",
      })
    );
  });

});
