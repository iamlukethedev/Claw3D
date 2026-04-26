import { describe, expect, it } from "vitest";

import type { AgentState, AgentStoreSeed } from "@/features/agents/state/store";
import { createTranscriptEntryFromLine } from "@/features/agents/state/transcript";
import {
  buildOfficeAnimationState,
  clearOfficeAnimationTriggerHold,
  createOfficeAnimationTriggerState,
  reconcileOfficeAnimationTriggerState,
  reduceOfficeAnimationTriggerEvent,
} from "@/lib/office/eventTriggers";
import type { EventFrame } from "@/lib/gateway/GatewayClient";

const makeAgent = (
  overrides: Partial<AgentState> & Pick<AgentStoreSeed, "agentId" | "name" | "sessionKey">,
): AgentState => ({
  agentId: overrides.agentId,
  name: overrides.name,
  sessionKey: overrides.sessionKey,
  avatarSeed: overrides.avatarSeed ?? overrides.agentId,
  avatarUrl: overrides.avatarUrl ?? null,
  model: overrides.model ?? null,
  thinkingLevel: overrides.thinkingLevel ?? "high",
  sessionExecHost: overrides.sessionExecHost,
  sessionExecSecurity: overrides.sessionExecSecurity,
  sessionExecAsk: overrides.sessionExecAsk,
  status: overrides.status ?? "idle",
  sessionCreated: overrides.sessionCreated ?? false,
  awaitingUserInput: overrides.awaitingUserInput ?? false,
  hasUnseenActivity: overrides.hasUnseenActivity ?? false,
  outputLines: overrides.outputLines ?? [],
  lastResult: overrides.lastResult ?? null,
  lastDiff: overrides.lastDiff ?? null,
  runId: overrides.runId ?? null,
  runStartedAt: overrides.runStartedAt ?? null,
  streamText: overrides.streamText ?? null,
  thinkingTrace: overrides.thinkingTrace ?? null,
  latestOverride: overrides.latestOverride ?? null,
  latestOverrideKind: overrides.latestOverrideKind ?? null,
  lastAssistantMessageAt: overrides.lastAssistantMessageAt ?? null,
  lastActivityAt: overrides.lastActivityAt ?? null,
  latestPreview: overrides.latestPreview ?? null,
  lastUserMessage: overrides.lastUserMessage ?? null,
  draft: overrides.draft ?? "",
  queuedMessages: overrides.queuedMessages ?? [],
  sessionSettingsSynced: overrides.sessionSettingsSynced ?? false,
  historyLoadedAt: overrides.historyLoadedAt ?? null,
  historyFetchLimit: overrides.historyFetchLimit ?? null,
  historyFetchedCount: overrides.historyFetchedCount ?? null,
  historyMaybeTruncated: overrides.historyMaybeTruncated ?? false,
  toolCallingEnabled: overrides.toolCallingEnabled ?? false,
  showThinkingTraces: overrides.showThinkingTraces ?? true,
  transcriptEntries: overrides.transcriptEntries ?? [],
  transcriptRevision: overrides.transcriptRevision ?? 0,
  transcriptSequenceCounter: overrides.transcriptSequenceCounter ?? 0,
  sessionEpoch: overrides.sessionEpoch ?? 0,
  lastHistoryRequestRevision: overrides.lastHistoryRequestRevision ?? null,
  lastAppliedHistoryRequestId: overrides.lastAppliedHistoryRequestId ?? null,
});

const makeTranscriptEntry = (params: {
  line: string;
  role: "user" | "assistant";
  sequenceKey: number;
  sessionKey: string;
  timestampMs: number;
}) => {
  const entry = createTranscriptEntryFromLine({
    line: params.line,
    sessionKey: params.sessionKey,
    source: "history",
    sequenceKey: params.sequenceKey,
    timestampMs: params.timestampMs,
    fallbackTimestampMs: params.timestampMs,
    role: params.role,
    kind: params.role === "user" ? "user" : "assistant",
    confirmed: true,
  });
  if (!entry) {
    throw new Error("Failed to create transcript entry.");
  }
  return entry;
};

describe("office event triggers", () => {
  it("derives room holds from agent messages", () => {
    const agents = [
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey: "agent:main:main",
        lastUserMessage: "Check GitHub for pull requests.",
      }),
      makeAgent({
        agentId: "qa",
        name: "QA",
        sessionKey: "agent:qa:main",
        lastUserMessage: "Please test this build in the QA lab.",
      }),
      makeAgent({
        agentId: "skill",
        name: "Skill",
        sessionKey: "agent:skill:main",
        lastUserMessage: "Build another OpenClaw skill.",
        status: "running",
        runId: "run-skill",
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 1_000,
    });
    const animationState = buildOfficeAnimationState({
      state,
      agents,
      nowMs: 1_000,
    });

    expect(animationState.githubHoldByAgentId.main).toBe(true);
    expect(animationState.qaHoldByAgentId.qa).toBe(true);
    expect(animationState.skillGymHoldByAgentId.skill).toBe(true);
  });

  it("reacts to runtime chat commands regardless of channel transport", () => {
    const agents = [
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey: "agent:main:main",
      }),
      makeAgent({
        agentId: "worker",
        name: "Worker",
        sessionKey: "agent:worker:slack",
      }),
    ];
    const gymEvent: EventFrame = {
      type: "event",
      event: "chat",
      payload: {
        runId: "run-worker",
        sessionKey: "agent:worker:slack",
        state: "final",
        message: {
          role: "user",
          text: "Let's go to the gym.",
        },
      },
    };
    const standupEvent: EventFrame = {
      type: "event",
      event: "chat",
      payload: {
        runId: "run-main",
        sessionKey: "agent:main:main",
        state: "final",
        message: {
          role: "user",
          text: "Start the standup meeting.",
        },
      },
    };

    const afterGym = reduceOfficeAnimationTriggerEvent({
      state: createOfficeAnimationTriggerState(),
      agents,
      event: gymEvent,
      nowMs: 5_000,
    });
    const afterStandup = reduceOfficeAnimationTriggerEvent({
      state: afterGym,
      agents,
      event: standupEvent,
      nowMs: 6_000,
    });

    expect(afterStandup.manualGymUntilByAgentId.worker).toBeGreaterThan(5_000);
    expect(afterStandup.pendingStandupRequest?.message).toBe(
      "Start the standup meeting.",
    );
  });

  it("does not replay standup commands from old transcript history", () => {
    const sessionKey = "agent:main:main";
    const agents = [
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey,
        lastUserMessage: "Start the standup meeting.",
        transcriptEntries: [
          makeTranscriptEntry({
            line: "Start the standup meeting.",
            role: "user",
            sequenceKey: 1,
            sessionKey,
            timestampMs: 10_000,
          }),
        ],
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 100_000,
    });

    expect(state.pendingStandupRequest).toBeNull();
  });

  it("treats final transport chat messages without an explicit user role as commands", () => {
    const agents = [
      makeAgent({
        agentId: "worker",
        name: "Worker",
        sessionKey: "agent:worker:main",
      }),
    ];

    const afterDesk = reduceOfficeAnimationTriggerEvent({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 7_000,
      event: {
        type: "event",
        event: "chat",
        payload: {
          runId: "run-worker-telegram",
          sessionKey: "agent:worker:telegram",
          state: "final",
          message: {
            text: "Please head to your desk now.",
          },
        },
      },
    });
    const afterGym = reduceOfficeAnimationTriggerEvent({
      state: afterDesk,
      agents,
      nowMs: 8_000,
      event: {
        type: "event",
        event: "chat",
        payload: {
          runId: "run-worker-telegram",
          sessionKey: "agent:worker:telegram",
          state: "final",
          message: {
            text: "Go to the gym.",
          },
        },
      },
    });

    expect(afterGym.deskHoldByAgentId.worker).toBe(true);
    expect(afterGym.manualGymUntilByAgentId.worker).toBeGreaterThan(8_000);
  });

  it("tracks streaming and reasoning activity from runtime events", () => {
    const agents = [
      makeAgent({
        agentId: "agent-1",
        name: "Agent 1",
        sessionKey: "agent:agent-1:web",
      }),
    ];

    const afterChat = reduceOfficeAnimationTriggerEvent({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 10_000,
      event: {
        type: "event",
        event: "chat",
        payload: {
          runId: "run-1",
          sessionKey: "agent:agent-1:web",
          state: "delta",
          message: {
            role: "assistant",
            text: "Streaming reply.",
          },
        },
      },
    });
    const afterReasoning = reduceOfficeAnimationTriggerEvent({
      state: afterChat,
      agents,
      nowMs: 10_100,
      event: {
        type: "event",
        event: "agent",
        payload: {
          runId: "run-1",
          sessionKey: "agent:agent-1:web",
          stream: "reasoning_trace",
          data: {
            text: "Thinking about a plan.",
          },
        },
      },
    });
    const animationState = buildOfficeAnimationState({
      state: afterReasoning,
      agents,
      nowMs: 10_150,
    });

    expect(animationState.streamingByAgentId["agent-1"]).toBe(true);
    expect(animationState.thinkingByAgentId["agent-1"]).toBe(true);
    expect(animationState.workingUntilByAgentId["agent-1"]).toBeGreaterThan(10_000);
  });

  it("suppresses desk holds while a gym command is active", () => {
    const agents = [
      makeAgent({
        agentId: "agent-1",
        name: "Agent 1",
        sessionKey: "agent:agent-1:main",
      }),
    ];

    const animationState = buildOfficeAnimationState({
      agents,
      nowMs: 11_000,
      state: {
        ...createOfficeAnimationTriggerState(),
        deskHoldByAgentId: { "agent-1": true },
        manualGymUntilByAgentId: { "agent-1": 12_000 },
      },
    });

    expect(animationState.gymHoldByAgentId["agent-1"]).toBe(true);
    expect(animationState.deskHoldByAgentId["agent-1"]).toBeUndefined();
  });

  it("suppresses dismissed github holds until a new command arrives and emits cleanup cues", () => {
    const baseAgent = makeAgent({
      agentId: "main",
      name: "Main",
      sessionKey: "agent:main:main",
      lastUserMessage: "Check GitHub for pull requests.",
      sessionEpoch: 1,
    });

    const initialState = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [baseAgent],
      nowMs: 20_000,
    });
    const dismissedState = clearOfficeAnimationTriggerHold({
      state: initialState,
      hold: "github",
      agentId: "main",
    });
    const sameMessageState = reconcileOfficeAnimationTriggerState({
      state: dismissedState,
      agents: [baseAgent],
      nowMs: 20_500,
    });
    const nextMessageState = reconcileOfficeAnimationTriggerState({
      state: sameMessageState,
      agents: [
        makeAgent({
          ...baseAgent,
          lastUserMessage: "Review some code in the server room.",
          sessionEpoch: 2,
        }),
      ],
      nowMs: 21_000,
    });

    expect(sameMessageState.githubHoldByAgentId.main).toBeUndefined();
    expect(nextMessageState.githubHoldByAgentId.main).toBe(true);
    expect(nextMessageState.cleaningCues).toHaveLength(1);
    expect(nextMessageState.cleaningCues[0]?.agentId).toBe("main");
  });

  it("does not restore completed messaging booth requests from transcript history", () => {
    const sessionKey = "agent:main:main";
    const agents = [
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey,
        lastUserMessage: "Text my wife that I am running late.",
        transcriptEntries: [
          makeTranscriptEntry({
            line: "Text my wife that I am running late.",
            role: "user",
            sequenceKey: 1,
            sessionKey,
            timestampMs: 40_000,
          }),
          makeTranscriptEntry({
            line: "[messaging booth] Message to my wife sent.",
            role: "assistant",
            sequenceKey: 2,
            sessionKey,
            timestampMs: 41_000,
          }),
        ],
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 45_000,
    });
    const animationState = buildOfficeAnimationState({
      state,
      agents,
      nowMs: 45_000,
    });

    expect(state.textMessageByAgentId.main).toBeUndefined();
    expect(animationState.smsBoothHoldByAgentId.main).toBeUndefined();
  });

  it("does not restore stale messaging booth requests from old transcript history", () => {
    const sessionKey = "agent:main:main";
    const agents = [
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey,
        lastUserMessage: "Text my wife.",
        transcriptEntries: [
          makeTranscriptEntry({
            line: "Text my wife.",
            role: "user",
            sequenceKey: 1,
            sessionKey,
            timestampMs: 10_000,
          }),
        ],
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 200_000,
    });
    const animationState = buildOfficeAnimationState({
      state,
      agents,
      nowMs: 200_000,
    });

    expect(state.textMessageByAgentId.main).toBeUndefined();
    expect(animationState.textMessageByAgentId.main).toBeUndefined();
    expect(animationState.smsBoothHoldByAgentId.main).toBeUndefined();
  });
});
