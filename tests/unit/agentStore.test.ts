import { describe, expect, it } from "vitest";

import {
  agentStoreReducer,
  buildNewSessionAgentPatch,
  getFilteredAgents,
  initialAgentStoreState,
  type AgentStoreSeed,
} from "@/features/agents/state/store";

describe("agent store", () => {
  it("hydrates agents with defaults and selection", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    const next = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    expect(next.loading).toBe(false);
    expect(next.selectedAgentId).toBe("agent-1");
    expect(next.agents).toHaveLength(1);
    expect(next.agents[0].status).toBe("idle");
    expect(next.agents[0].thinkingLevel).toBe("high");
    expect(next.agents[0].sessionCreated).toBe(false);
    expect(next.agents[0].outputLines).toEqual([]);
  });

  it("does not allocate a new empty agent list on redundant hydrate", () => {
    const next = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [],
    });
    expect(next).toBe(initialAgentStoreState);
  });

  it("does not allocate a new state object on redundant setLoading", () => {
    const next = agentStoreReducer(initialAgentStoreState, {
      type: "setLoading",
      loading: false,
    });
    expect(next).toBe(initialAgentStoreState);
  });

  it("hydrates agents with a requested selection when present", () => {
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
    const next = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
      selectedAgentId: " agent-2 ",
    });
    expect(next.selectedAgentId).toBe("agent-2");
  });

  it("keeps existing selection when requested selection is invalid", () => {
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
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "selectAgent",
      agentId: "agent-2",
    });
    state = agentStoreReducer(state, {
      type: "hydrateAgents",
      agents: seeds,
      selectedAgentId: "missing-agent",
    });
    expect(state.selectedAgentId).toBe("agent-2");
  });

  it("builds a patch that resets runtime state for a session reset", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:studio:old-session",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: {
        status: "running",
        awaitingUserInput: true,
        hasUnseenActivity: true,
        outputLines: ["> hello", "response"],
        lastResult: "response",
        lastDiff: "diff",
        runId: "run-1",
        streamText: "live",
        thinkingTrace: "thinking",
        latestOverride: "override",
        latestOverrideKind: "heartbeat",
        lastAssistantMessageAt: 1700000000000,
        lastActivityAt: 1700000000001,
        latestPreview: "preview",
        lastUserMessage: "hello",
        draft: "draft",
        historyLoadedAt: 1700000000002,
      },
    });

    const agent = state.agents.find((entry) => entry.agentId === "agent-1")!;
    const patch = buildNewSessionAgentPatch(agent);

    expect(patch.sessionKey).toBe("agent:agent-1:studio:old-session");
    expect(patch.status).toBe("idle");
    expect(patch.sessionCreated).toBe(true);
    expect(patch.sessionSettingsSynced).toBe(true);
    expect(patch.outputLines).toEqual([]);
    expect(patch.streamText).toBeNull();
    expect(patch.thinkingTrace).toBeNull();
    expect(patch.lastResult).toBeNull();
    expect(patch.lastDiff).toBeNull();
    expect(patch.historyLoadedAt).toBeNull();
    expect(patch.lastUserMessage).toBeNull();
    expect(patch.runId).toBeNull();
    expect(patch.runStartedAt).toBeNull();
    expect(patch.latestPreview).toBeNull();
    expect(patch.latestOverride).toBeNull();
    expect(patch.latestOverrideKind).toBeNull();
    expect(patch.lastAssistantMessageAt).toBeNull();
    expect(patch.awaitingUserInput).toBe(false);
    expect(patch.hasUnseenActivity).toBe(false);
    expect(patch.draft).toBe("");
  });

  it("preserves_session_created_state_across_hydration", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { sessionCreated: true },
    });
    state = agentStoreReducer(state, {
      type: "hydrateAgents",
      agents: [seed],
    });
    expect(state.agents[0]?.sessionCreated).toBe(true);
  });

  it("resets_runtime_state_when_session_key_changes_on_hydration", () => {
    const initialSeed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:studio:legacy",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [initialSeed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: {
        sessionCreated: true,
        outputLines: ["> old"],
        lastResult: "old result",
        runId: "run-1",
      },
    });

    const nextSeed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    state = agentStoreReducer(state, {
      type: "hydrateAgents",
      agents: [nextSeed],
    });
    const next = state.agents[0];
    expect(next?.sessionKey).toBe("agent:agent-1:main");
    expect(next?.sessionCreated).toBe(false);
    expect(next?.outputLines).toEqual([]);
    expect(next?.lastResult).toBeNull();
    expect(next?.runId).toBeNull();
  });

  it("keeps_transcript_references_for_non_transcript_agent_updates", () => {
    const seed: AgentStoreSeed = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "agent:agent-1:main",
    };
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: [seed],
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { outputLines: ["> hello", "response"] },
    });

    const beforeDraftUpdate = state.agents[0];

    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { draft: "x" },
    });
    const afterDraftUpdate = state.agents[0];

    expect(afterDraftUpdate.outputLines).toBe(beforeDraftUpdate.outputLines);
    expect(afterDraftUpdate.transcriptEntries).toBe(beforeDraftUpdate.transcriptEntries);
    expect(afterDraftUpdate.transcriptSequenceCounter).toBe(beforeDraftUpdate.transcriptSequenceCounter);
  });

  it("tracks_unseen_activity_for_non_selected_agents", () => {
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
    const hydrated = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    const withActivity = agentStoreReducer(hydrated, {
      type: "markActivity",
      agentId: "agent-2",
      at: 1700000000000,
    });
    const second = withActivity.agents.find((agent) => agent.agentId === "agent-2");
    expect(second?.hasUnseenActivity).toBe(true);
    expect(second?.lastActivityAt).toBe(1700000000000);

    const selected = agentStoreReducer(withActivity, {
      type: "selectAgent",
      agentId: "agent-2",
    });
    const cleared = selected.agents.find((agent) => agent.agentId === "agent-2");
    expect(cleared?.hasUnseenActivity).toBe(false);
  });

  it("filters_agents_by_status_and_approvals", () => {
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
      {
        agentId: "agent-3",
        name: "Agent Three",
        sessionKey: "agent:agent-3:main",
      },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { status: "idle", awaitingUserInput: true },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-2",
      patch: { status: "running" },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-3",
      patch: { status: "error" },
    });

    expect(getFilteredAgents(state, "all").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-1",
      "agent-3",
    ]);
    expect(getFilteredAgents(state, "running").map((agent) => agent.agentId)).toEqual([
      "agent-2",
    ]);
    expect(getFilteredAgents(state, "approvals").map((agent) => agent.agentId)).toEqual([
      "agent-1",
    ]);
  });

  it("clears_unseen_indicator_on_focus", () => {
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
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "markActivity",
      agentId: "agent-2",
      at: 1700000000100,
    });

    const before = state.agents.find((agent) => agent.agentId === "agent-2");
    expect(before?.hasUnseenActivity).toBe(true);

    state = agentStoreReducer(state, {
      type: "selectAgent",
      agentId: "agent-2",
    });
    const after = state.agents.find((agent) => agent.agentId === "agent-2");
    expect(after?.hasUnseenActivity).toBe(false);
  });

  it("sorts_filtered_agents_by_latest_assistant_message", () => {
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
      {
        agentId: "agent-3",
        name: "Agent Three",
        sessionKey: "agent:agent-3:main",
      },
    ];
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { status: "running", lastAssistantMessageAt: 200 },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-2",
      patch: { status: "running", lastAssistantMessageAt: 500 },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-3",
      patch: { status: "running", lastAssistantMessageAt: 300 },
    });

    expect(getFilteredAgents(state, "all").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-3",
      "agent-1",
    ]);
    expect(getFilteredAgents(state, "running").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-3",
      "agent-1",
    ]);
  });

  it("prioritizes_running_agents_in_all_filter_even_without_assistant_reply", () => {
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
    let state = agentStoreReducer(initialAgentStoreState, {
      type: "hydrateAgents",
      agents: seeds,
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-1",
      patch: { status: "idle", lastAssistantMessageAt: 900 },
    });
    state = agentStoreReducer(state, {
      type: "updateAgent",
      agentId: "agent-2",
      patch: { status: "running", runStartedAt: 1000, lastAssistantMessageAt: null },
    });

    expect(getFilteredAgents(state, "all").map((agent) => agent.agentId)).toEqual([
      "agent-2",
      "agent-1",
    ]);
  });
});
