import { describe, expect, it } from "vitest";

import type { AgentStoreSeed } from "@/features/agents/state/store";
import {
  buildFloorRosterErrorState,
  buildFloorRosterState,
  createFloorRosterCache,
  createFloorRosterEntry,
  defaultFloorRosterState,
  hydrateFloorRoster,
} from "@/lib/office/floorRoster";

const makeSeed = (overrides: Partial<AgentStoreSeed> = {}): AgentStoreSeed => ({
  agentId: "agent-1",
  name: "main",
  runtimeName: "main",
  identityName: "GLaDOS",
  sessionDisplayName: "Portal Supervisor",
  role: "assistant",
  sessionKey: "agent:agent-1:main",
  avatarSeed: "seed-1",
  model: "openai/gpt-5",
  thinkingLevel: "high",
  ...overrides,
});

describe("floorRoster", () => {
  it("creates entries with identity-first display names", () => {
    expect(createFloorRosterEntry(makeSeed())).toEqual(
      expect.objectContaining({
        agentId: "agent-1",
        displayName: "GLaDOS",
        runtimeName: "main",
        identityName: "GLaDOS",
        sessionDisplayName: "Portal Supervisor",
      }),
    );
  });

  it("builds a roster cache for all floors", () => {
    const cache = createFloorRosterCache();
    expect(cache.lobby).toEqual(defaultFloorRosterState("lobby"));
    expect(cache["hermes-first"]).toEqual(
      expect.objectContaining({ floorId: "hermes-first", provider: "hermes" }),
    );
  });

  it("builds loaded roster state from hydration results", () => {
    const state = buildFloorRosterState({
      floorId: "openclaw-ground",
      hydratedAt: 123,
      result: {
        seeds: [makeSeed()],
        suggestedSelectedAgentId: "agent-1",
      },
    });

    expect(state).toEqual(
      expect.objectContaining({
        floorId: "openclaw-ground",
        provider: "openclaw",
        status: "loaded",
        hydratedAt: 123,
        selectedAgentId: "agent-1",
      }),
    );
    expect(state.entries[0]?.displayName).toBe("GLaDOS");
  });

  it("preserves prior roster entries when building error state", () => {
    const previous = buildFloorRosterState({
      floorId: "openclaw-ground",
      hydratedAt: 123,
      result: {
        seeds: [makeSeed()],
        suggestedSelectedAgentId: "agent-1",
      },
    });
    const errored = buildFloorRosterErrorState({
      floorId: "openclaw-ground",
      message: "connect timeout",
      previous,
    });

    expect(errored).toEqual(
      expect.objectContaining({
        status: "error",
        error: "connect timeout",
        selectedAgentId: "agent-1",
      }),
    );
    expect(errored.entries).toHaveLength(1);
  });

  it("hydrates roster state through a runtime-neutral entry point", async () => {
    const state = await hydrateFloorRoster({
      floorId: "hermes-first",
      now: () => 456,
      hydrate: async () => ({
        seeds: [makeSeed({ identityName: null, sessionDisplayName: "Hermes Prime" })],
        suggestedSelectedAgentId: "agent-1",
      }),
    });

    expect(state).toEqual(
      expect.objectContaining({
        floorId: "hermes-first",
        provider: "hermes",
        status: "loaded",
        hydratedAt: 456,
      }),
    );
    expect(state.entries[0]?.displayName).toBe("Hermes Prime");
  });
});
