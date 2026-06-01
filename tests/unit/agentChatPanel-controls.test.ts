import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { formatThinkingMarkdown } from "@/lib/text/message-extract";

const createAgent = (): AgentState => ({
  agentId: "agent-1",
  name: "Agent One",
  sessionKey: "agent:agent-1:studio:test-session",
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
  model: null,
  thinkingLevel: null,
  avatarSeed: "seed-1",
  avatarUrl: null,
});

describe("AgentChatPanel controls", () => {
  const models: GatewayModelChoice[] = [
    { provider: "openai", id: "gpt-5", name: "gpt-5", reasoning: true },
    { provider: "openai", id: "gpt-5-mini", name: "gpt-5-mini", reasoning: false },
  ];

  afterEach(() => {
    cleanup();
  });

  it("renders_runtime_controls_in_agent_header_and_no_inline_name_editor", () => {
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onRename: vi.fn(async () => true),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    expect(screen.getByLabelText("Model")).toBeInTheDocument();
    expect(screen.getByLabelText("Thinking")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Agent One")).not.toBeInTheDocument();
    expect(screen.getByTestId("agent-rename-toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("Rename agent")).toBeInTheDocument();
    expect(screen.getByTestId("agent-new-session-toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("Start new session")).toBeInTheDocument();
    expect(screen.getByTestId("agent-settings-toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("Open behavior")).toBeInTheDocument();
    expect(screen.queryByText("Inspect")).not.toBeInTheDocument();
  });

  it("renames_agent_inline_from_header", async () => {
    const onRename = vi.fn(async () => true);
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onRename,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByTestId("agent-rename-toggle"));
    const input = screen.getByTestId("agent-rename-input") as HTMLInputElement;

    await waitFor(() => {
      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe("Agent One".length);
    });

    fireEvent.change(input, { target: { value: "  Agent Prime  " } });
    fireEvent.click(screen.getByTestId("agent-rename-save"));

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("Agent Prime");
    });
  });

  it("cancels_inline_rename_without_saving", () => {
    const onRename = vi.fn(async () => true);
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onRename,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByTestId("agent-rename-toggle"));
    fireEvent.change(screen.getByTestId("agent-rename-input"), {
      target: { value: "Edited Name" },
    });
    fireEvent.click(screen.getByTestId("agent-rename-cancel"));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId("agent-rename-input")).not.toBeInTheDocument();
  });

  it("invokes_on_new_session_when_control_clicked", () => {
    const onNewSession = vi.fn(async () => {});

    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onNewSession,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByTestId("agent-new-session-toggle"));
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });

  it("does_not_render_inline_status_badge_markers", () => {
    const { rerender, container } = render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const idleBadge = container.querySelector('[data-status="idle"]');
    expect(idleBadge).toBeNull();

    rerender(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const runningBadge = container.querySelector('[data-status="running"]');
    expect(runningBadge).toBeNull();
  });

  it("invokes_on_model_change_when_model_select_changes_and_blurs_select", () => {
    const onModelChange = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange,
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    modelSelect.focus();
    expect(modelSelect).toHaveFocus();

    fireEvent.change(modelSelect, {
      target: { value: "openai/gpt-5-mini" },
    });
    expect(onModelChange).toHaveBeenCalledWith("openai/gpt-5-mini");
    expect(modelSelect).not.toHaveFocus();
  });

  it("invokes_on_thinking_change_when_thinking_select_changes", () => {
    const onThinkingChange = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange,
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.change(screen.getByLabelText("Thinking"), {
      target: { value: "high" },
    });
    expect(onThinkingChange).toHaveBeenCalledWith("high");
  });

  it("invokes_on_open_settings_when_control_clicked", () => {
    const onOpenSettings = vi.fn();

    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings,
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByTestId("agent-settings-toggle"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows_stop_button_while_running_and_invokes_stop_handler", () => {
    const onStopRun = vi.fn();

    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun,
        onAvatarShuffle: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStopRun).toHaveBeenCalledTimes(1);
  });

  it("allows_send_while_running_so_follow_up_can_be_queued", () => {
    const onSend = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const textarea = screen.getByPlaceholderText("type a message");
    fireEvent.change(textarea, { target: { value: "follow up" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("follow up", []);
  });

  it("renders_queue_bar_and_supports_removing_queued_messages", () => {
    const onRemoveQueuedMessage = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), queuedMessages: ["first queued", "second queued"] },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onRemoveQueuedMessage,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    expect(screen.getByTestId("queued-messages-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove queued message 1" }));
    expect(onRemoveQueuedMessage).toHaveBeenCalledWith(0);
  });

  it("disables_stop_button_with_tooltip_when_stop_is_unavailable", () => {
    const stopDisabledReason =
      "This task is running as an automatic heartbeat check. Stopping heartbeat runs from Studio isn't available yet (coming soon).";
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        stopDisabledReason,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const stopButton = screen.getByRole("button", {
      name: `Stop unavailable: ${stopDisabledReason}`,
    });
    expect(stopButton).toBeDisabled();
    expect(stopButton.parentElement).toHaveAttribute("title", stopDisabledReason);
  });

  it("shows_thinking_indicator_while_running_before_stream_text", () => {
    render(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), status: "running", outputLines: ["> test"] },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-typing-indicator")).toBeInTheDocument();
    expect(within(screen.getByTestId("agent-typing-indicator")).getByText("Thinking")).toBeInTheDocument();
  });

  it("shows_thinking_indicator_after_stream_starts", () => {
    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          status: "running",
          outputLines: ["> test"],
          streamText: "working on it",
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-typing-indicator")).toBeInTheDocument();
    expect(within(screen.getByTestId("agent-typing-indicator")).getByText("Thinking")).toBeInTheDocument();
  });

  it("does_not_render_duplicate_typing_indicator_when_internal_thinking_is_visible", () => {
    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          status: "running",
          outputLines: ["> test", formatThinkingMarkdown("thinking now")],
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    expect(screen.queryByTestId("agent-typing-indicator")).not.toBeInTheDocument();
    expect(screen.getByText("Thinking (internal)")).toBeInTheDocument();
  });

  it("renders thinking row collapsed by default", () => {
    render(
      createElement(AgentChatPanel, {
        agent: {
          ...createAgent(),
          status: "running",
          outputLines: ["> test", formatThinkingMarkdown("thinking now"), "final response"],
        },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend: vi.fn(),
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const details = screen.getByText("Thinking (internal)").closest("details");
    expect(details).toBeTruthy();
    expect(details).not.toHaveAttribute("open");
  });

  it("does_not_overwrite_active_draft_with_stale_nonempty_agent_draft", () => {
    const onDraftChange = vi.fn();
    const onSend = vi.fn();
    const { rerender } = render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange,
        onSend,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const textarea = screen.getByPlaceholderText("type a message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(textarea.value).toBe("hello world");

    rerender(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), draft: "hello" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange,
        onSend,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );
    expect(textarea.value).toBe("hello world");

    rerender(
      createElement(AgentChatPanel, {
        agent: { ...createAgent(), draft: "" },
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange,
        onSend,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );
    expect(textarea.value).toBe("");
  });

  it("does_not_send_when_enter_is_pressed_during_composition", () => {
    const onSend = vi.fn();
    render(
      createElement(AgentChatPanel, {
        agent: createAgent(),
        isSelected: true,
        canSend: true,
        models,
        stopBusy: false,
        onLoadMoreHistory: vi.fn(),
        onOpenSettings: vi.fn(),
        onModelChange: vi.fn(),
        onThinkingChange: vi.fn(),
        onDraftChange: vi.fn(),
        onSend,
        onStopRun: vi.fn(),
        onAvatarShuffle: vi.fn(),
      })
    );

    const textarea = screen.getByPlaceholderText("type a message");
    fireEvent.change(textarea, { target: { value: "draft text" } });

    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      keyCode: 229,
      isComposing: true,
    });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });
    expect(onSend).toHaveBeenCalledWith("draft text", []);
  });
});
