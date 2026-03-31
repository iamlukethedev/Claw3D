import { describe, expect, it } from "vitest";

import type { AgentState } from "@/features/agents/state/store";
import type { RunRecord } from "@/features/office/hooks/useRunLog";
import {
  deriveFallbackChatCard,
  deriveRecoveredAgentRequestCard,
  deriveLiveSessionTaskCard,
  isActionableTaskRequest,
  parseExplicitTaskEvent,
  syncCardWithLinkedRun,
} from "@/features/office/tasks/useTaskBoardController";

const makeAgent = (overrides: Partial<AgentState> = {}) =>
  ({
    agentId: "agent-1",
    name: "Agent One",
    sessionKey: "agent:agent-1:main",
    awaitingUserInput: false,
    ...overrides,
  }) as AgentState;

describe("task board controller helpers", () => {
  it("parses explicit OpenClaw task events", () => {
    const parsed = parseExplicitTaskEvent({
      type: "event",
      event: "task_status_changed",
      seq: 42,
      payload: {
        taskId: "task-42",
        title: "Ship the kanban board",
        status: "review",
        assignedAgentId: "agent-1",
        runId: "run-1",
      },
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        taskId: "task-42",
        title: "Ship the kanban board",
        status: "review",
        assignedAgentId: "agent-1",
        runId: "run-1",
        sourceEventId: "task_status_changed:42",
      }),
    );
  });

  it("derives fallback cards from user chat requests", () => {
    const card = deriveFallbackChatCard(
      {
        type: "event",
        event: "chat",
        payload: {
          sessionKey: "agent:agent-1:main",
          seq: 7,
          channel: "telegram",
          message: {
            role: "user",
            content: [{ type: "text", text: "Create a website for me." }],
          },
        },
      },
      [makeAgent()],
    );

    expect(card).toEqual(
      expect.objectContaining({
        id: "chat:agent:agent-1:main:7",
        title: "Create a website for me.",
        assignedAgentId: "agent-1",
        channel: "telegram",
        source: "fallback_inferred",
      }),
    );
  });

  it("treats plain inbound user asks as live session tasks", () => {
    const card = deriveLiveSessionTaskCard(
      {
        type: "event",
        event: "chat",
        payload: {
          sessionKey: "agent:agent-1:main",
          seq: 8,
          channel: "telegram",
          message: {
            role: "user",
            content: [{ type: "text", text: "Can you check the latest news on OpenClaw?" }],
          },
        },
      },
      [makeAgent()],
    );

    expect(card).toEqual(
      expect.objectContaining({
        id: "chat:agent:agent-1:main:8",
        title: "Can you check the latest news on OpenClaw?",
        assignedAgentId: "agent-1",
        channel: "telegram",
        externalThreadId: "agent:agent-1:main",
        source: "openclaw_event",
        isInferred: false,
      }),
    );
  });

  it("filters conversational messages out of task capture", () => {
    expect(isActionableTaskRequest("?")).toBe(false);
    expect(isActionableTaskRequest("are you there")).toBe(false);
    expect(isActionableTaskRequest("thanks")).toBe(false);
    expect(isActionableTaskRequest("Can you research about Paul Brady in Tulsa, OK?")).toBe(
      true
    );
  });

  it("accepts messages with common verb typos", () => {
    expect(isActionableTaskRequest("Rearch who is Luke the dev")).toBe(true);
    expect(isActionableTaskRequest("Reserch best practices for React")).toBe(true);
    expect(isActionableTaskRequest("Resarch the latest trends")).toBe(true);
  });

  it("accepts 5+ word messages without punctuation", () => {
    expect(isActionableTaskRequest("do a deep dive into kubernetes networking")).toBe(true);
    expect(isActionableTaskRequest("check the logs from last deployment")).toBe(true);
  });

  it("rejects very short non-verb messages", () => {
    expect(isActionableTaskRequest("ok sure")).toBe(false);
    expect(isActionableTaskRequest("hi")).toBe(false);
  });

  it("recovers latest user asks from agent transcript history", () => {
    const card = deriveRecoveredAgentRequestCard(
      makeAgent({
        lastActivityAt: Date.parse("2026-03-30T20:00:00.000Z"),
        transcriptEntries: [
          {
            entryId: "assistant-1",
            role: "assistant",
            kind: "assistant",
            text: "Sure, I'll check.",
            sessionKey: "agent:agent-1:main",
            runId: "run-1",
            source: "history",
            timestampMs: Date.parse("2026-03-30T20:00:05.000Z"),
            sequenceKey: 2,
            confirmed: true,
            fingerprint: "assistant-1",
          },
          {
            entryId: "user-1",
            role: "user",
            kind: "user",
            text: "Can you check the latest news on OpenClaw?",
            sessionKey: "agent:agent-1:main",
            runId: null,
            source: "history",
            timestampMs: Date.parse("2026-03-30T20:00:00.000Z"),
            sequenceKey: 1,
            confirmed: true,
            fingerprint: "user-1",
          },
        ],
      }),
    );

    expect(card).toEqual(
      expect.objectContaining({
        id: "history:agent:agent-1:main:1",
        title: "Can you check the latest news on OpenClaw?",
        assignedAgentId: "agent-1",
        externalThreadId: "agent:agent-1:main",
        source: "openclaw_event",
        isInferred: false,
      }),
    );
  });

  it("does not recover conversational transcript entries as tasks", () => {
    const card = deriveRecoveredAgentRequestCard(
      makeAgent({
        lastActivityAt: Date.parse("2026-03-30T20:00:00.000Z"),
        transcriptEntries: [
          {
            entryId: "user-1",
            role: "user",
            kind: "user",
            text: "are you there",
            sessionKey: "agent:agent-1:main",
            runId: null,
            source: "history",
            timestampMs: Date.parse("2026-03-30T20:00:00.000Z"),
            sequenceKey: 1,
            confirmed: true,
            fingerprint: "user-1",
          },
        ],
      }),
    );

    expect(card).toBeNull();
  });

  it("updates linked run cards to done or blocked", () => {
    const baseCard = {
      id: "task-1",
      title: "Review patch",
      description: "",
      status: "in_progress" as const,
      source: "claw3d_manual" as const,
      sourceEventId: null,
      assignedAgentId: "agent-1",
      createdAt: "2026-03-29T10:00:00.000Z",
      updatedAt: "2026-03-29T10:00:00.000Z",
      playbookJobId: null,
      runId: "run-1",
      channel: null,
      externalThreadId: null,
      lastActivityAt: null,
      notes: [],
      isArchived: false,
      isInferred: false,
    };
    const okRun: RunRecord = {
      runId: "run-1",
      agentId: "agent-1",
      agentName: "Agent One",
      startedAt: Date.parse("2026-03-29T10:00:00.000Z"),
      endedAt: Date.parse("2026-03-29T10:03:00.000Z"),
      outcome: "ok",
      trigger: "user",
    };
    const errorRun: RunRecord = {
      ...okRun,
      outcome: "error",
    };

    expect(syncCardWithLinkedRun(baseCard, [okRun]).status).toBe("review");
    expect(syncCardWithLinkedRun(baseCard, [errorRun]).status).toBe("blocked");
  });
});
