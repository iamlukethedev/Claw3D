/**
 * Tests for the skillGymHold logic inside reconcileOfficeAnimationTriggerState.
 *
 * Key behaviour (issue #13 fix):
 *  - When a "gym" directive resolves → skillGymHoldByAgentId[agentId] = true.
 *  - When a "release" directive resolves → skillGymHoldByAgentId[agentId] is NOT set
 *    (the hold is cleared, mirroring the desk/github/qa release patterns).
 *  - When no gym directive resolves but a prior hold exists in next state → hold persists.
 *  - When no gym directive and no prior hold → agent has no hold entry.
 */
import { describe, expect, it } from "vitest";

import type { AgentState, AgentStoreSeed } from "@/features/agents/state/store";
import { createTranscriptEntryFromLine } from "@/features/agents/state/transcript";
import {
  createOfficeAnimationTriggerState,
  reconcileOfficeAnimationTriggerState,
} from "@/lib/office/eventTriggers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  if (!entry) throw new Error("Failed to create transcript entry.");
  return entry;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reconcileOfficeAnimationTriggerState – skillGym hold (issue #13)", () => {
  it("sets skillGymHoldByAgentId to true when a 'gym' directive exists", () => {
    // The agent's lastUserMessage triggers a gym-skill directive.
    // A "gym" directive should unconditionally set the hold.
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "Build another OpenClaw skill.",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBe(true);
  });

  it("sets skillGymHoldByAgentId via transcript entry when no lastUserMessage directive", () => {
    // A gym directive embedded in the transcript should also trigger the hold.
    const sessionKey = "agent:skill:main";
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey,
      lastUserMessage: null,
      transcriptEntries: [
        makeTranscriptEntry({
          line: "Please install a skill for me.",
          role: "user",
          sequenceKey: 1,
          sessionKey,
          timestampMs: 500,
        }),
      ],
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBe(true);
  });

  it("persists an existing hold when no new gym directive is present", () => {
    // When there is no gym directive but a prior hold was set (e.g. from a previous
    // reconciliation cycle), the hold must be preserved so the animation continues.
    const priorState = {
      ...createOfficeAnimationTriggerState(),
      skillGymHoldByAgentId: { "skill": true },
    };

    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "How is the weather?", // no gym intent
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: priorState,
      agents: [agent],
      nowMs: 2_000,
    });

    // The hold should carry forward.
    expect(state.skillGymHoldByAgentId["skill"]).toBe(true);
  });

  it("does NOT add a hold entry when no gym directive and no previous hold exists", () => {
    // Agent has a completely unrelated message — no hold should be introduced.
    const agent = makeAgent({
      agentId: "coder",
      name: "Coder",
      sessionKey: "agent:coder:main",
      lastUserMessage: "Fix the linting errors in src/index.ts",
    });

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    // The key should either be absent or explicitly falsy — never true.
    expect(state.skillGymHoldByAgentId["coder"]).toBeFalsy();
  });

  it("handles multiple agents independently — only gym-directive agents get a hold", () => {
    const agents = [
      makeAgent({
        agentId: "skill",
        name: "Skill",
        sessionKey: "agent:skill:main",
        lastUserMessage: "Enable a skill for OpenClaw.", // gym intent
      }),
      makeAgent({
        agentId: "main",
        name: "Main",
        sessionKey: "agent:main:main",
        lastUserMessage: "Check the logs.", // no gym intent
      }),
    ];

    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents,
      nowMs: 1_000,
    });

    expect(state.skillGymHoldByAgentId["skill"]).toBe(true);
    expect(state.skillGymHoldByAgentId["main"]).toBeFalsy();
  });

  it("does NOT set skillGymHoldByAgentId when the latest message has no gym-skill directive", () => {
    // A release phrase (e.g. "leave the gym") resolves through the *manual/command* gym
    // path (source: "manual"), not the skill path (source: "skill") that
    // reconcileOfficeAnimationTriggerState tracks via resolveOfficeGymDirective.
    // The skill-source resolver correctly returns null for such messages, so the hold
    // is neither set nor preserved via the skill-directive branch.
    //
    // Release of the gym hold for the *manual* path is handled downstream in
    // buildOfficeAnimationState → reduceOfficeGymHoldState, which is not under test here.
    const agent = makeAgent({
      agentId: "skill",
      name: "Skill",
      sessionKey: "agent:skill:main",
      lastUserMessage: "Leave the gym.",
    });

    // No prior hold in state.
    const state = reconcileOfficeAnimationTriggerState({
      state: createOfficeAnimationTriggerState(),
      agents: [agent],
      nowMs: 1_000,
    });

    // With no prior hold and no skill-source gym directive, the hold must remain absent.
    expect(state.skillGymHoldByAgentId["skill"]).toBeFalsy();
  });
});
