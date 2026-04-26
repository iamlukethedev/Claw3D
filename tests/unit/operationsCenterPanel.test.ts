import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { AgentState } from "@/features/agents/state/store";
import { OperationsCenterPanel } from "@/features/office/components/panels/OperationsCenterPanel";
import type { RunRecord } from "@/features/office/hooks/useRunLog";

const makeAgent = (overrides: Partial<AgentState> & Pick<AgentState, "agentId" | "name">): AgentState => ({
  agentId: overrides.agentId,
  name: overrides.name,
  runtimeName: overrides.runtimeName,
  identityName: overrides.identityName,
  sessionDisplayName: overrides.sessionDisplayName,
  role: overrides.role,
  sessionKey: overrides.sessionKey ?? `agent:${overrides.agentId}:main`,
  avatarSeed: overrides.avatarSeed ?? overrides.agentId,
  avatarProfile: overrides.avatarProfile,
  avatarUrl: overrides.avatarUrl ?? null,
  model: overrides.model ?? null,
  thinkingLevel: overrides.thinkingLevel ?? "high",
  sessionExecHost: overrides.sessionExecHost,
  sessionExecSecurity: overrides.sessionExecSecurity,
  sessionExecAsk: overrides.sessionExecAsk,
  toolCallingEnabled: overrides.toolCallingEnabled ?? false,
  showThinkingTraces: overrides.showThinkingTraces ?? true,
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
  transcriptEntries: overrides.transcriptEntries ?? [],
  transcriptRevision: overrides.transcriptRevision ?? 0,
  transcriptSequenceCounter: overrides.transcriptSequenceCounter ?? 0,
  sessionEpoch: overrides.sessionEpoch ?? 0,
  lastHistoryRequestRevision: overrides.lastHistoryRequestRevision ?? null,
  lastAppliedHistoryRequestId: overrides.lastAppliedHistoryRequestId ?? null,
});

describe("OperationsCenterPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("summarizes fleet state and opens selected agents", () => {
    const onSelectAgent = vi.fn();
    const runLog: RunRecord[] = [
      {
        runId: "run-1",
        agentId: "engineer",
        agentName: "Engineer",
        startedAt: Date.now() - 5_000,
        endedAt: null,
        outcome: null,
        trigger: "user",
      },
    ];

    render(
      createElement(OperationsCenterPanel, {
        agents: [
          makeAgent({
            agentId: "engineer",
            name: "Engineer",
            role: "Backend engineer",
            status: "running",
            runId: "run-1",
            streamText: "Implementing API changes.",
          }),
          makeAgent({
            agentId: "qa",
            name: "QA",
            awaitingUserInput: true,
            hasUnseenActivity: true,
          }),
        ],
        runLog,
        feedEvents: [
          {
            id: "engineer",
            name: "Engineer",
            text: "started working",
            ts: Date.now(),
            kind: "status",
          },
        ],
        onSelectAgent,
      }),
    );

    expect(screen.getByText("Operations Center")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Backend engineer")).toBeInTheDocument();
    expect(screen.getByText("Implementing API changes.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Engineer/i })[0]);

    expect(onSelectAgent).toHaveBeenCalledWith("engineer");
  });
});
