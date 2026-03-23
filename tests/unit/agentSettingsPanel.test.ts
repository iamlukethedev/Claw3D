import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AgentState } from "@/features/agents/state/store";
import { AgentSettingsPanel } from "@/features/agents/components/AgentInspectPanels";
import type { CronJobSummary } from "@/lib/cron/types";
import type { SkillStatusReport } from "@/lib/skills/types";

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
  model: "openai/gpt-5",
  thinkingLevel: "medium",
  avatarSeed: "seed-1",
  avatarUrl: null,
});

const createCronJob = (id: string): CronJobSummary => ({
  id,
  name: `Job ${id}`,
  agentId: "agent-1",
  enabled: true,
  updatedAtMs: Date.now(),
  schedule: { kind: "every", everyMs: 60_000 },
  sessionTarget: "isolated",
  wakeMode: "next-heartbeat",
  payload: { kind: "agentTurn", message: "hi" },
  state: {},
});

const createSkillsReport = (): SkillStatusReport => ({
  workspaceDir: "/tmp/workspace",
  managedSkillsDir: "/tmp/skills",
  skills: [
    {
      name: "github",
      description: "GitHub integration",
      source: "openclaw-workspace",
      bundled: false,
      filePath: "/tmp/workspace/skills/github/SKILL.md",
      baseDir: "/tmp/workspace/skills/github",
      skillKey: "github",
      always: false,
      disabled: false,
      blockedByAllowlist: false,
      eligible: true,
      requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
      missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
      configChecks: [],
      install: [],
    },
    {
      name: "browser",
      description: "Browser automation",
      source: "openclaw-bundled",
      bundled: true,
      filePath: "/tmp/skills/browser/SKILL.md",
      baseDir: "/tmp/skills/browser",
      skillKey: "browser",
      primaryEnv: "BROWSER_API_KEY",
      always: false,
      disabled: true,
      blockedByAllowlist: true,
      eligible: false,
      requirements: { bins: ["playwright"], anyBins: [], env: [], config: [], os: [] },
      missing: { bins: ["playwright"], anyBins: [], env: [], config: [], os: [] },
      configChecks: [],
      install: [
        {
          id: "install-playwright",
          kind: "node",
          label: "Install playwright",
          bins: ["playwright"],
        },
      ],
    },
  ],
});

const createSkillsReportWithOsIncompatibleBrowser = (): SkillStatusReport => {
  const report = createSkillsReport();
  return {
    ...report,
    skills: report.skills.map((entry) =>
      entry.skillKey === "browser"
        ? {
            ...entry,
            requirements: { ...entry.requirements, os: ["darwin"] },
            missing: { ...entry.missing, os: ["darwin"] },
          }
        : entry
    ),
  };
};

describe("AgentSettingsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does_not_render_name_editor_in_capabilities_mode", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByLabelText("Agent name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Name" })).not.toBeInTheDocument();
  });

  it("renders_icon_close_button_with_accessible_label", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    expect(screen.getByTestId("agent-settings-close")).toBeInTheDocument();
  });

  it("does_not_render_show_tool_calls_and_show_thinking_toggles_in_advanced_mode", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "advanced",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByRole("switch", { name: "Show tool calls" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Show thinking" })).not.toBeInTheDocument();
  });

  it("renders_permissions_controls", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByText("Capabilities")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run commands off" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run commands ask" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run commands auto" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Web access" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("switch", { name: "File tools" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("updates_switch_aria_state_when_toggled", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    const webSwitch = screen.getByRole("switch", { name: "Web access" });
    fireEvent.click(webSwitch);
    expect(webSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("autosaves_updated_permissions_draft", async () => {
    const onUpdateAgentPermissions = vi.fn(async () => {});
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        permissionsDraft: {
          commandMode: "off",
          webAccess: false,
          fileTools: false,
        },
        onUpdateAgentPermissions,
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Run commands auto" }));
    fireEvent.click(screen.getByRole("switch", { name: "Web access" }));
    fireEvent.click(screen.getByRole("switch", { name: "File tools" }));

    await waitFor(
      () => {
        expect(onUpdateAgentPermissions).toHaveBeenCalledWith({
          commandMode: "auto",
          webAccess: true,
          fileTools: true,
        });
      },
      { timeout: 2000 }
    );
  });

  it("preserves_pending_permissions_toggles_during_props_refresh", () => {
    const onUpdateAgentPermissions = vi.fn(async () => {});

    const props = {
      agent: createAgent(),
      onClose: vi.fn(),
      onDelete: vi.fn(),
      onToolCallingToggle: vi.fn(),
      onThinkingTracesToggle: vi.fn(),
      cronJobs: [],
      cronLoading: false,
      cronError: null,
      cronRunBusyJobId: null,
      cronDeleteBusyJobId: null,
      onRunCronJob: vi.fn(),
      onDeleteCronJob: vi.fn(),
      onUpdateAgentPermissions,
    };

    const { rerender } = render(
      createElement(AgentSettingsPanel, {
        ...props,
        permissionsDraft: {
          commandMode: "off",
          webAccess: false,
          fileTools: false,
        },
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Run commands auto" }));
    fireEvent.click(screen.getByRole("switch", { name: "Web access" }));
    fireEvent.click(screen.getByRole("switch", { name: "File tools" }));

    rerender(
      createElement(AgentSettingsPanel, {
        ...props,
        permissionsDraft: {
          commandMode: "auto",
          webAccess: false,
          fileTools: false,
        },
      })
    );

    expect(screen.getByRole("switch", { name: "Web access" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("switch", { name: "File tools" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("does_not_render_runtime_settings_section", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByText("Runtime settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Personality")).not.toBeInTheDocument();
  });

  it("does_not_render_new_session_control_in_advanced_mode", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "advanced",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.queryByRole("button", { name: "New session" })).not.toBeInTheDocument();
  });

  it("renders_skills_mode_and_opens_system_setup_for_non_ready_skills", () => {
    const onOpenSystemSetup = vi.fn();
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        skillsAllowlist: ["github"],
        onOpenSystemSetup,
      })
    );

    expect(screen.getByTestId("agent-settings-skills")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open System Setup" }));
    expect(onOpenSystemSetup).toHaveBeenCalledWith("browser");
  });

  it("shows_selected_mode_hint_when_allowlist_mode_is_active", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        skillsAllowlist: ["github"],
      })
    );

    expect(screen.getByText("This agent is using selected skills only.")).toBeInTheDocument();
  });

  it("filters_skills_list_from_search_input", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
      })
    );

    fireEvent.change(screen.getByLabelText("Search skills"), {
      target: { value: "browse" },
    });

    expect(screen.getByText("browser")).toBeInTheDocument();
    expect(screen.queryByText("github")).not.toBeInTheDocument();
  });

  it("toggles_skill_access_with_explicit_allowlist_state", () => {
    const onSetSkillEnabled = vi.fn();
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        skillsAllowlist: ["github"],
        onSetSkillEnabled,
      })
    );

    const githubToggle = screen.getByRole("switch", { name: "Skill github" });
    const browserToggle = screen.getByRole("switch", { name: "Skill browser" });
    expect(githubToggle).toHaveAttribute("aria-checked", "true");
    expect(browserToggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(githubToggle);
    fireEvent.click(browserToggle);
    expect(onSetSkillEnabled).toHaveBeenNthCalledWith(1, "github", false);
    expect(onSetSkillEnabled).toHaveBeenNthCalledWith(2, "browser", true);
  });

  it("runs_system_setup_actions_from_modal", () => {
    const onInstallSkill = vi.fn();
    const onSetSkillGlobalEnabled = vi.fn();
    const onSkillApiKeyChange = vi.fn();
    const onSaveSkillApiKey = vi.fn();
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "system",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        skillApiKeyDrafts: { browser: "seed-key" },
        onInstallSkill,
        onSetSkillGlobalEnabled,
        onSkillApiKeyChange,
        onSaveSkillApiKey,
      })
    );

    fireEvent.change(screen.getByLabelText("Search skills"), {
      target: { value: "browse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    expect(screen.getByRole("dialog", { name: "Setup browser" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Install playwright" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable globally" }));
    fireEvent.change(screen.getByLabelText("API key for browser"), {
      target: { value: "test-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save BROWSER_API_KEY" }));

    expect(onInstallSkill).toHaveBeenCalledWith("browser", "browser", "install-playwright");
    expect(onSetSkillGlobalEnabled).toHaveBeenCalledWith("browser", true);
    expect(onSkillApiKeyChange).toHaveBeenCalledWith("browser", "test-key");
    expect(onSaveSkillApiKey).toHaveBeenCalledWith("browser");
  });

  it("keeps_system_setup_modal_open_until_user_closes_and_then_clears_handoff", async () => {
    const onSystemInitialSkillHandled = vi.fn();
    const Harness = () => {
      const [initialSkillKey, setInitialSkillKey] = useState<string | null>("browser");
      return createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "system",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        systemInitialSkillKey: initialSkillKey,
        onSystemInitialSkillHandled: () => {
          onSystemInitialSkillHandled();
          setInitialSkillKey(null);
        },
      });
    };

    render(createElement(Harness));

    const dialog = screen.getByRole("dialog", { name: "Setup browser" });
    expect(onSystemInitialSkillHandled).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(onSystemInitialSkillHandled).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("dialog", { name: "Setup browser" })).not.toBeInTheDocument();
  });

  it("prompts_before_removing_skill_files_and_confirms_action", () => {
    const onRemoveSkill = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "system",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        onRemoveSkill,
      })
    );

    fireEvent.change(screen.getByLabelText("Search skills"), {
      target: { value: "git" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove for all agents" }));

    expect(onRemoveSkill).toHaveBeenCalledWith({
      skillKey: "github",
      source: "openclaw-workspace",
      baseDir: "/tmp/workspace/skills/github",
    });
  });

  it("disables_api_key_save_when_input_is_blank", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "system",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
      })
    );

    fireEvent.change(screen.getByLabelText("Search skills"), {
      target: { value: "browse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    expect(screen.getByRole("button", { name: "Save BROWSER_API_KEY" })).toBeDisabled();
  });

  it("shows_enabled_count_based_on_visible_skills_not_raw_allowlist_size", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: createSkillsReport(),
        skillsAllowlist: ["github", "missing-skill"],
      })
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("shows_os_incompatible_skills_for_visibility_in_agent_view", () => {
    const report = createSkillsReportWithOsIncompatibleBrowser();
    report.skills = report.skills.map((entry) =>
      entry.skillKey === "browser"
        ? { ...entry, disabled: false, blockedByAllowlist: false }
        : entry
    );

    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsReport: report,
        skillsAllowlist: ["github", "browser"],
      })
    );

    expect(screen.getByRole("switch", { name: "Skill browser" })).toBeDisabled();
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText("Not supported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open System Setup" })).not.toBeInTheDocument();
  });

  it("shows_skills_loading_and_error_states", () => {
    const { rerender } = render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsLoading: true,
      })
    );

    expect(screen.getByText("Loading skills...")).toBeInTheDocument();

    rerender(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "skills",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        skillsLoading: false,
        skillsError: "boom",
      })
    );

    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders_automations_section_when_mode_is_automations", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [createCronJob("job-1")],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    const cronSection = screen.getByTestId("agent-settings-cron");
    expect(cronSection).toBeInTheDocument();
    expect(screen.queryByTestId("agent-settings-session")).not.toBeInTheDocument();
  });

  it("invokes_run_now_and_disables_play_while_pending", () => {
    const onRunCronJob = vi.fn();
    const cronJobs = [createCronJob("job-1")];
    const { rerender } = render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs,
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob,
        onDeleteCronJob: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Run timed automation Job job-1 now" }));
    expect(onRunCronJob).toHaveBeenCalledWith("job-1");

    rerender(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs,
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: "job-1",
        cronDeleteBusyJobId: null,
        onRunCronJob,
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByRole("button", { name: "Run timed automation Job job-1 now" })).toBeDisabled();
  });

  it("invokes_delete_and_disables_trash_while_pending", () => {
    const onDeleteCronJob = vi.fn();
    const cronJobs = [createCronJob("job-1")];
    const { rerender } = render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs,
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete timed automation Job job-1" }));
    expect(onDeleteCronJob).toHaveBeenCalledWith("job-1");

    rerender(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs,
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: "job-1",
        onRunCronJob: vi.fn(),
        onDeleteCronJob,
      })
    );

    expect(screen.getByRole("button", { name: "Delete timed automation Job job-1" })).toBeDisabled();
  });

  it("shows_empty_cron_state_when_agent_has_no_jobs", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByText("No timed automations for this agent.")).toBeInTheDocument();
    expect(screen.getByTestId("cron-empty-icon")).toBeInTheDocument();
  });

  it("shows_create_button_when_no_cron_jobs", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("opens_cron_create_modal_from_empty_state_button", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("dialog", { name: "Create automation" })).toBeInTheDocument();
  });

  it("updates_template_defaults_when_switching_templates", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekly Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Automation name")).toHaveValue("Weekly review");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Morning Brief" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Automation name")).toHaveValue("Morning brief");
  });

  it("submits_modal_with_agent_scoped_draft", async () => {
    const onCreateCronJob = vi.fn(async () => {});
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        onCreateCronJob,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Automation name"), {
      target: { value: "Nightly sync" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Sync project status and report blockers." },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create automation" })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Create automation" }));

    await waitFor(() => {
      expect(onCreateCronJob).toHaveBeenCalledWith({
        templateId: "custom",
        name: "Nightly sync",
        taskText: "Sync project status and report blockers.",
        scheduleKind: "every",
        everyAmount: 30,
        everyUnit: "minutes",
        deliveryMode: "none",
        deliveryChannel: "last",
      });
    });
  });

  it("hides_create_submit_before_review_step_and_disables_next_when_busy", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        cronCreateBusy: true,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.queryByRole("button", { name: "Create automation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps_modal_open_and_shows_error_when_create_fails", async () => {
    const onCreateCronJob = vi.fn(async () => {
      throw new Error("Gateway exploded");
    });
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        onCreateCronJob,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Automation name"), {
      target: { value: "Nightly sync" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Sync project status and report blockers." },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create automation" })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Create automation" }));

    await waitFor(() => {
      expect(screen.getByText("Gateway exploded")).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog", { name: "Create automation" })).toBeInTheDocument();
  });

  it("shows_heartbeat_coming_soon_in_automations_mode", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "automations",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [createCronJob("job-1")],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-settings-heartbeat-coming-soon")).toBeInTheDocument();
    expect(screen.getByText("Heartbeat automation controls are coming soon.")).toBeInTheDocument();
  });

  it("shows_control_ui_section_in_advanced_mode", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "advanced",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
      })
    );

    expect(screen.getByTestId("agent-settings-control-ui")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Full Control UI" })).toBeDisabled();
  });

  it("renders_enabled_control_ui_link_when_available", () => {
    render(
      createElement(AgentSettingsPanel, {
        agent: createAgent(),
        mode: "advanced",
        onClose: vi.fn(),
        onDelete: vi.fn(),
        onToolCallingToggle: vi.fn(),
        onThinkingTracesToggle: vi.fn(),
        cronJobs: [],
        cronLoading: false,
        cronError: null,
        cronRunBusyJobId: null,
        cronDeleteBusyJobId: null,
        onRunCronJob: vi.fn(),
        onDeleteCronJob: vi.fn(),
        controlUiUrl: "http://localhost:3000/control",
      })
    );

    const link = screen.getByRole("link", { name: "Open Full Control UI" });
    expect(link).toHaveAttribute("href", "http://localhost:3000/control");
  });
});
