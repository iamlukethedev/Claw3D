import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard } from "@/features/office/tasks/types";
import type { AgentState } from "@/features/agents/state/store";
import type { CronJobSummary } from "@/lib/cron/types";

afterEach(() => {
  cleanup();
});

const createCard = (overrides: Partial<TaskBoardCard> = {}): TaskBoardCard => ({
  id: "task-1",
  title: "New task",
  description: "",
  status: "todo",
  source: "claw3d_manual",
  sourceEventId: null,
  assignedAgentId: null,
  createdAt: "2026-03-29T10:00:00.000Z",
  updatedAt: "2026-03-29T10:00:00.000Z",
  playbookJobId: null,
  runId: null,
  channel: null,
  externalThreadId: null,
  lastActivityAt: null,
  notes: [],
  isArchived: false,
  isInferred: false,
  ...overrides,
});

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:main",
  status: "idle",
  sessionCreated: true,
  awaitingUserInput: false,
  hasUnseenActivity: false,
  outputLines: [],
  lastResult: null,
  lastDiff: null,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
  latestOverride: null,
  latestOverrideKind: null,
  lastAssistantMessageAt: null,
  lastActivityAt: null,
  latestPreview: null,
  lastUserMessage: null,
  draft: "",
  sessionSettingsSynced: true,
  historyLoadedAt: null,
  historyFetchLimit: null,
  historyFetchedCount: null,
  historyMaybeTruncated: false,
  toolCallingEnabled: true,
  showThinkingTraces: true,
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
});

const createCronJob = (): CronJobSummary => ({
  id: "job-1",
  name: "Morning review",
  agentId: "agent-1",
  enabled: true,
  updatedAtMs: Date.now(),
  schedule: { kind: "every", everyMs: 60_000 },
  sessionTarget: "isolated",
  wakeMode: "now",
  payload: { kind: "agentTurn", message: "Review new tasks." },
  state: {},
});

describe("TaskBoardView", () => {
  it("routes task edits through callbacks", () => {
    const onCreateCard = vi.fn();
    const onMoveCard = vi.fn();
    const onSelectCard = vi.fn();
    const onUpdateCard = vi.fn();
    const onDeleteCard = vi.fn();
    const onRefreshCronJobs = vi.fn();
    const selectedCard = createCard();

    render(
      createElement(TaskBoardView, {
        title: "Kanban",
        subtitle: "Track tasks.",
        agents: [createAgent()],
        cardsByStatus: {
          todo: [selectedCard],
          in_progress: [],
          blocked: [],
          review: [],
          done: [],
        },
        selectedCard,
        activeRuns: [{ runId: "run-1", agentId: "agent-1", label: "Agent One" }],
        cronJobs: [createCronJob()],
        cronLoading: false,
        cronError: null,
        onCreateCardAction: onCreateCard,
        onMoveCardAction: onMoveCard,
        onSelectCardAction: onSelectCard,
        onUpdateCardAction: onUpdateCard,
        onDeleteCardAction: onDeleteCard,
        onRefreshCronJobsAction: onRefreshCronJobs,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /new task/i }));
    fireEvent.click(screen.getByRole("button", { name: /^\+ task$/i }));
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    fireEvent.click(screen.getByRole("button", { name: /^kanban/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Create marketing website" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "in_progress" },
    });
    fireEvent.change(screen.getByLabelText("Assigned agent"), {
      target: { value: "agent-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete task/i }));

    expect(onCreateCard).toHaveBeenCalledTimes(2);
    expect(onRefreshCronJobs).toHaveBeenCalledTimes(1);
    expect(onSelectCard).toHaveBeenCalledWith(null);
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", { title: "Create marketing website" });
    expect(onMoveCard).toHaveBeenCalledWith("task-1", "in_progress");
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", { assignedAgentId: "agent-1" });
    expect(onDeleteCard).toHaveBeenCalledWith("task-1");
  });

  it("allows workspace canvas task cards to be edited directly", async () => {
    const onUpdateCard = vi.fn();
    const selectedCard = createCard();

    render(
      createElement(TaskBoardView, {
        title: "Kanban",
        subtitle: "Track tasks.",
        agents: [createAgent()],
        cardsByStatus: {
          todo: [selectedCard],
          in_progress: [],
          blocked: [],
          review: [],
          done: [],
        },
        selectedCard: null,
        activeRuns: [],
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        onCreateCardAction: vi.fn(),
        onMoveCardAction: vi.fn(),
        onSelectCardAction: vi.fn(),
        onUpdateCardAction: onUpdateCard,
        onDeleteCardAction: vi.fn(),
        onRefreshCronJobsAction: vi.fn(),
      })
    );

    fireEvent.change(await screen.findByPlaceholderText("Task title"), {
      target: { value: "Write the task here" },
    });
    fireEvent.change(screen.getByPlaceholderText("Describe the task..."), {
      target: { value: "Add details without leaving the canvas." },
    });
    fireEvent.change(screen.getByLabelText("Assign task agent"), {
      target: { value: "agent-1" },
    });

    expect(onUpdateCard).toHaveBeenCalledWith("task-1", {
      title: "Write the task here",
    });
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", {
      description: "Add details without leaving the canvas.",
    });
    expect(onUpdateCard).toHaveBeenCalledWith("task-1", {
      assignedAgentId: "agent-1",
    });
  });

  it("can delete all workspace canvas task cards after confirmation", async () => {
    const onDeleteCard = vi.fn();
    const firstCard = createCard({ id: "task-1", title: "First task" });
    const secondCard = createCard({ id: "task-2", title: "Second task" });

    render(
      createElement(TaskBoardView, {
        title: "Kanban",
        subtitle: "Track tasks.",
        agents: [createAgent()],
        cardsByStatus: {
          todo: [firstCard, secondCard],
          in_progress: [],
          blocked: [],
          review: [],
          done: [],
        },
        selectedCard: null,
        activeRuns: [],
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        onCreateCardAction: vi.fn(),
        onMoveCardAction: vi.fn(),
        onSelectCardAction: vi.fn(),
        onUpdateCardAction: vi.fn(),
        onDeleteCardAction: onDeleteCard,
        onRefreshCronJobsAction: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /^delete all$/i }));
    expect(onDeleteCard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^confirm delete all$/i }));

    expect(onDeleteCard).toHaveBeenCalledWith("task-1");
    expect(onDeleteCard).toHaveBeenCalledWith("task-2");
  });
});
