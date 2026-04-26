import { createElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import type { AgentPermissionsDraft } from "@/features/agents/operations/agentPermissionsOperation";
import type { CronCreateDraft } from "@/lib/cron/createPayloadBuilder";
import type { CronRunResult } from "@/lib/cron/types";
import type { MutationBlockState } from "@/features/agents/operations/mutationLifecycleWorkflow";

import { useAgentSettingsMutationController } from "@/features/agents/operations/useAgentSettingsMutationController";
import { deleteAgentRecordViaStudio } from "@/features/agents/operations/deleteAgentOperation";
import { performCronCreateFlow } from "@/features/agents/operations/cronCreateOperation";
import { updateAgentPermissionsViaStudio } from "@/features/agents/operations/agentPermissionsOperation";
import { runAgentConfigMutationLifecycle } from "@/features/agents/operations/mutationLifecycleWorkflow";
import { runCronJobNow, removeCronJob } from "@/lib/cron/types";
import { shouldAwaitDisconnectRestartForRemoteMutation } from "@/lib/gateway/gatewayReloadMode";
import {
  readGatewayAgentSkillsAllowlist,
  updateGatewayAgentSkillsAllowlist,
} from "@/lib/gateway/agentConfig";
import { removeSkillFromGateway } from "@/lib/skills/remove";
import { installSkill, loadAgentSkillStatus, updateSkill } from "@/lib/skills/types";

let restartBlockHookParams:
  | {
      block: MutationBlockState | null;
      onTimeout: () => void;
      onRestartComplete: (
        block: MutationBlockState,
        ctx: { isCancelled: () => boolean }
      ) => void | Promise<void>;
    }
  | null = null;

vi.mock("@/features/agents/operations/useGatewayRestartBlock", () => ({
  useGatewayRestartBlock: (params: {
    block: MutationBlockState | null;
    onTimeout: () => void;
    onRestartComplete: (
      block: MutationBlockState,
      ctx: { isCancelled: () => boolean }
    ) => void | Promise<void>;
  }) => {
    restartBlockHookParams = {
      block: params.block,
      onTimeout: params.onTimeout,
      onRestartComplete: params.onRestartComplete,
    };
  },
}));

vi.mock("@/features/agents/operations/deleteAgentOperation", () => ({
  deleteAgentRecordViaStudio: vi.fn(),
}));

vi.mock("@/features/agents/operations/cronCreateOperation", () => ({
  performCronCreateFlow: vi.fn(),
}));

vi.mock("@/features/agents/operations/agentPermissionsOperation", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/agents/operations/agentPermissionsOperation")
  >("@/features/agents/operations/agentPermissionsOperation");
  return {
    ...actual,
    updateAgentPermissionsViaStudio: vi.fn(),
  };
});

vi.mock("@/features/agents/operations/mutationLifecycleWorkflow", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/agents/operations/mutationLifecycleWorkflow")
  >("@/features/agents/operations/mutationLifecycleWorkflow");
  return {
    ...actual,
    runAgentConfigMutationLifecycle: vi.fn(),
  };
});

vi.mock("@/lib/cron/types", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cron/types")>("@/lib/cron/types");
  return {
    ...actual,
    runCronJobNow: vi.fn(),
    removeCronJob: vi.fn(),
    listCronJobs: vi.fn(async () => ({ jobs: [] })),
  };
});

vi.mock("@/lib/gateway/gatewayReloadMode", () => ({
  shouldAwaitDisconnectRestartForRemoteMutation: vi.fn(async () => false),
}));

vi.mock("@/lib/gateway/agentConfig", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gateway/agentConfig")>(
    "@/lib/gateway/agentConfig"
  );
  return {
    ...actual,
    readGatewayAgentSkillsAllowlist: vi.fn(async () => undefined),
    updateGatewayAgentSkillsAllowlist: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/skills/types", () => ({
  loadAgentSkillStatus: vi.fn(async () => ({
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/skills",
    skills: [],
  })),
  installSkill: vi.fn(async () => ({
    ok: true,
    message: "Installed",
    stdout: "",
    stderr: "",
    code: 0,
  })),
  updateSkill: vi.fn(async () => ({
    ok: true,
    skillKey: "browser",
    config: {},
  })),
}));

vi.mock("@/lib/skills/remove", () => ({
  removeSkillFromGateway: vi.fn(async () => ({
    removed: true,
    removedPath: "/tmp/workspace/skills/browser",
    source: "openclaw-workspace",
  })),
}));

type ControllerValue = ReturnType<typeof useAgentSettingsMutationController>;

const draft: AgentPermissionsDraft = {
  commandMode: "ask",
  webAccess: true,
  fileTools: false,
};

const createCronDraft = (): CronCreateDraft => ({
  templateId: "custom",
  name: "Nightly sync",
  taskText: "Sync project status.",
  scheduleKind: "every",
  everyAmount: 30,
  everyUnit: "minutes",
  deliveryMode: "announce",
  deliveryChannel: "last",
});

const renderController = (overrides?: Partial<Parameters<typeof useAgentSettingsMutationController>[0]>) => {
  const setError = vi.fn();
  const clearInspectSidebar = vi.fn();
  const setInspectSidebarCapabilities = vi.fn();
  const dispatchUpdateAgent = vi.fn();
  const setMobilePaneChat = vi.fn();
  const loadAgents = vi.fn(async () => undefined);
  const refreshGatewayConfigSnapshot = vi.fn(async () => null);
  const enqueueConfigMutation = vi.fn(async ({ run }: { run: () => Promise<void> }) => {
    await run();
  });
  const client = {
    call: vi.fn(async () => ({})),
  };

  const params: Parameters<typeof useAgentSettingsMutationController>[0] = {
    client: client as never,
    status: "connected",
    runtimeSupportsCron: true,
    isLocalGateway: false,
    agents: [{ agentId: "agent-1", name: "Agent One", sessionKey: "session-1" }] as never,
    hasCreateBlock: false,
    enqueueConfigMutation,
    gatewayConfigSnapshot: null,
    settingsRouteActive: false,
    inspectSidebarAgentId: null,
    inspectSidebarTab: null,
    loadAgents,
    refreshGatewayConfigSnapshot,
    clearInspectSidebar,
    setInspectSidebarCapabilities,
    dispatchUpdateAgent,
    setMobilePaneChat,
    setError,
    ...(overrides ?? {}),
  };

  const valueRef: { current: ControllerValue | null } = { current: null };
  const Probe = ({ onValue }: { onValue: (next: ControllerValue) => void }) => {
    const value = useAgentSettingsMutationController(params);
    useEffect(() => {
      onValue(value);
    }, [onValue, value]);
    return createElement("div", { "data-testid": "probe" }, "ok");
  };

  render(
    createElement(Probe, {
      onValue: (next) => {
        valueRef.current = next;
      },
    })
  );

  return {
    getValue: () => {
      if (!valueRef.current) throw new Error("hook value unavailable");
      return valueRef.current;
    },
    setError,
    clearInspectSidebar,
    setInspectSidebarCapabilities,
    dispatchUpdateAgent,
    setMobilePaneChat,
    loadAgents,
    refreshGatewayConfigSnapshot,
    enqueueConfigMutation,
  };
};

describe("useAgentSettingsMutationController", () => {
  const mockedDeleteAgentViaStudio = vi.mocked(deleteAgentRecordViaStudio);
  const mockedPerformCronCreateFlow = vi.mocked(performCronCreateFlow);
  const mockedRunCronJobNow = vi.mocked(runCronJobNow);
  const mockedRemoveCronJob = vi.mocked(removeCronJob);
  const mockedRunLifecycle = vi.mocked(runAgentConfigMutationLifecycle);
  const mockedUpdateAgentPermissions = vi.mocked(updateAgentPermissionsViaStudio);
  const mockedShouldAwaitRemoteRestart = vi.mocked(shouldAwaitDisconnectRestartForRemoteMutation);
  const mockedReadGatewayAgentSkillsAllowlist = vi.mocked(readGatewayAgentSkillsAllowlist);
  const mockedUpdateGatewayAgentSkillsAllowlist = vi.mocked(updateGatewayAgentSkillsAllowlist);
  const mockedLoadAgentSkillStatus = vi.mocked(loadAgentSkillStatus);
  const mockedInstallSkill = vi.mocked(installSkill);
  const mockedRemoveSkillFromGateway = vi.mocked(removeSkillFromGateway);
  const mockedUpdateSkill = vi.mocked(updateSkill);

  beforeEach(() => {
    restartBlockHookParams = null;
    mockedDeleteAgentViaStudio.mockReset();
    mockedPerformCronCreateFlow.mockReset();
    mockedRunCronJobNow.mockReset();
    mockedRemoveCronJob.mockReset();
    mockedRunLifecycle.mockReset();
    mockedUpdateAgentPermissions.mockReset();
    mockedShouldAwaitRemoteRestart.mockReset();
    mockedReadGatewayAgentSkillsAllowlist.mockReset();
    mockedUpdateGatewayAgentSkillsAllowlist.mockReset();
    mockedLoadAgentSkillStatus.mockReset();
    mockedInstallSkill.mockReset();
    mockedRemoveSkillFromGateway.mockReset();
    mockedUpdateSkill.mockReset();
    mockedShouldAwaitRemoteRestart.mockResolvedValue(false);
    mockedReadGatewayAgentSkillsAllowlist.mockResolvedValue(undefined);
    mockedUpdateGatewayAgentSkillsAllowlist.mockResolvedValue(undefined);
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    mockedInstallSkill.mockResolvedValue({
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    });
    mockedRemoveSkillFromGateway.mockResolvedValue({
      removed: true,
      removedPath: "/tmp/workspace/skills/browser",
      source: "openclaw-workspace",
    });
    mockedUpdateSkill.mockResolvedValue({
      ok: true,
      skillKey: "browser",
      config: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delete_denied_by_guard_does_not_run_delete_side_effect", async () => {
    const ctx = renderController({ status: "disconnected" });

    await act(async () => {
      await ctx.getValue().handleDeleteAgent("agent-1");
    });

    expect(ctx.enqueueConfigMutation).not.toHaveBeenCalled();
    expect(mockedDeleteAgentViaStudio).not.toHaveBeenCalled();
  });

  it("delete_cancelled_by_confirmation_does_not_run_delete_side_effect", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleDeleteAgent("agent-1");
    });

    expect(mockedDeleteAgentViaStudio).not.toHaveBeenCalled();
    expect(ctx.enqueueConfigMutation).not.toHaveBeenCalled();
  });

  it("reserved_main_delete_sets_error_and_skips_enqueue", async () => {
    const ctx = renderController({
      agents: [{ agentId: "main", name: "Main", sessionKey: "main-session" }] as never,
    });

    await act(async () => {
      await ctx.getValue().handleDeleteAgent("main");
    });

    expect(ctx.setError).toHaveBeenCalledWith("The main agent cannot be deleted.");
    expect(ctx.enqueueConfigMutation).not.toHaveBeenCalled();
    expect(mockedDeleteAgentViaStudio).not.toHaveBeenCalled();
  });

  it("cron_delete_is_denied_while_run_busy_without_changing_error_state", async () => {
    mockedRunCronJobNow.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ok: true, ran: true } satisfies CronRunResult;
    });
    const ctx = renderController();

    await act(async () => {
      void ctx.getValue().handleRunCronJob("agent-1", "job-running");
    });
    await waitFor(() => {
      expect(ctx.getValue().cronRunBusyJobId).toBe("job-running");
    });

    await act(async () => {
      await ctx.getValue().handleDeleteCronJob("agent-1", "job-delete");
    });

    expect(mockedRemoveCronJob).not.toHaveBeenCalled();
    expect(ctx.getValue().settingsCronError).toBeNull();
  });

  it("allowed_rename_and_delete_delegate_to_lifecycle_runner", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedRunLifecycle.mockImplementation(async ({ deps }) => {
      deps.setQueuedBlock();
      deps.setMutatingBlock();
      await deps.executeMutation();
      deps.clearBlock();
      return true;
    });
    mockedDeleteAgentViaStudio.mockResolvedValue(undefined);

    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleRenameAgent("agent-1", "Renamed");
    });
    await act(async () => {
      await ctx.getValue().handleDeleteAgent("agent-1");
    });

    expect(mockedRunLifecycle).toHaveBeenCalledTimes(2);
    expect(mockedDeleteAgentViaStudio).toHaveBeenCalledTimes(1);
  });

  it("permissions_update_keeps_load_refresh_and_focus_side_effects", async () => {
    mockedUpdateAgentPermissions.mockResolvedValue(undefined);
    const callOrder: string[] = [];
    const ctx = renderController({
      loadAgents: vi.fn(async () => {
        callOrder.push("loadAgents");
      }),
      refreshGatewayConfigSnapshot: vi.fn(async () => {
        callOrder.push("refresh");
        return null;
      }),
    });

    await act(async () => {
      await ctx.getValue().handleUpdateAgentPermissions("agent-1", draft);
    });

    expect(mockedUpdateAgentPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        sessionKey: "session-1",
        draft,
      })
    );
    expect(callOrder).toEqual(["loadAgents", "refresh"]);
    expect(ctx.setInspectSidebarCapabilities).toHaveBeenCalledWith("agent-1");
    expect(ctx.setMobilePaneChat).toHaveBeenCalled();
  });

  it("exposes_restart_block_state_and_timeout_completion_handlers", async () => {
    mockedRunLifecycle.mockImplementation(async ({ deps }) => {
      deps.setQueuedBlock();
      deps.patchBlockAwaitingRestart({ phase: "awaiting-restart", sawDisconnect: false });
      return true;
    });
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleRenameAgent("agent-1", "Renamed");
    });
    await waitFor(() => {
      expect(ctx.getValue().hasRenameMutationBlock).toBe(true);
      expect(ctx.getValue().restartingMutationBlock?.phase).toBe("awaiting-restart");
      expect(ctx.getValue().hasRestartBlockInProgress).toBe(true);
    });

    await waitFor(() => {
      expect(restartBlockHookParams?.block).not.toBeNull();
    });

    const timeoutHookParams = restartBlockHookParams;
    expect(timeoutHookParams).not.toBeNull();

    await act(async () => {
      timeoutHookParams!.onTimeout();
    });
    expect(ctx.setError).toHaveBeenCalledWith("Gateway restart timed out after renaming the agent.");

    mockedRunLifecycle.mockImplementation(async ({ deps }) => {
      deps.setQueuedBlock();
      deps.patchBlockAwaitingRestart({ phase: "awaiting-restart", sawDisconnect: false });
      return true;
    });
    await act(async () => {
      await ctx.getValue().handleRenameAgent("agent-1", "Renamed Again");
    });
    await waitFor(() => {
      expect(ctx.getValue().restartingMutationBlock?.phase).toBe("awaiting-restart");
    });

    const restartHookParams = restartBlockHookParams;
    expect(restartHookParams?.onRestartComplete).toBeTypeOf("function");
    expect(ctx.getValue().restartingMutationBlock?.phase).toBe("awaiting-restart");

    await act(async () => {
      await restartHookParams!.onRestartComplete(
        ctx.getValue().restartingMutationBlock as MutationBlockState,
        { isCancelled: () => false }
      );
    });
    expect(ctx.loadAgents).toHaveBeenCalled();
    expect(ctx.setMobilePaneChat).toHaveBeenCalled();
    await waitFor(() => {
      expect(ctx.getValue().restartingMutationBlock).toBeNull();
    });
  });

  it("create_cron_handler_delegates_to_create_operation", async () => {
    mockedPerformCronCreateFlow.mockResolvedValue("created");
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleCreateCronJob("agent-1", createCronDraft());
    });

    expect(mockedPerformCronCreateFlow).toHaveBeenCalledTimes(1);
  });

  it("cron_mutations_fail_fast_when_runtime_lacks_cron_capability", async () => {
    const ctx = renderController({ runtimeSupportsCron: false });

    await act(async () => {
      await ctx.getValue().handleCreateCronJob("agent-1", createCronDraft());
      await ctx.getValue().handleRunCronJob("agent-1", "job-1");
      await ctx.getValue().handleDeleteCronJob("agent-1", "job-1");
    });

    expect(mockedPerformCronCreateFlow).not.toHaveBeenCalled();
    expect(mockedRunCronJobNow).not.toHaveBeenCalled();
    expect(mockedRemoveCronJob).not.toHaveBeenCalled();
    expect(ctx.getValue().settingsCronError).toBe("This runtime does not support automations.");
  });

  it("loads_skills_when_settings_skills_tab_is_active", async () => {
    const report = {
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    };
    mockedLoadAgentSkillStatus.mockResolvedValue(report);
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledWith(expect.anything(), "agent-1");
      expect(ctx.getValue().settingsSkillsReport).toEqual(report);
    });
  });

  it("loads_skills_when_settings_system_tab_is_active", async () => {
    const report = {
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    };
    mockedLoadAgentSkillStatus.mockResolvedValue(report);
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "system",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledWith(expect.anything(), "agent-1");
      expect(ctx.getValue().settingsSkillsReport).toEqual(report);
    });
  });

  it("use_all_and_disable_all_skills_write_via_config_queue", async () => {
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleUseAllSkills("agent-1");
      await ctx.getValue().handleDisableAllSkills("agent-1");
    });

    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-agent-skills" })
    );
    expect(mockedUpdateGatewayAgentSkillsAllowlist).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ agentId: "agent-1", mode: "all" })
    );
    expect(mockedUpdateGatewayAgentSkillsAllowlist).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ agentId: "agent-1", mode: "none" })
    );
    expect(ctx.loadAgents).toHaveBeenCalledTimes(2);
    expect(ctx.refreshGatewayConfigSnapshot).toHaveBeenCalledTimes(2);
    expect(mockedLoadAgentSkillStatus).not.toHaveBeenCalled();
  });

  it("sets_selected_skills_allowlist_via_config_queue", async () => {
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleSetSkillsAllowlist("agent-1", [" github ", "slack", "github"]);
    });

    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-agent-skills" })
    );
    expect(mockedUpdateGatewayAgentSkillsAllowlist).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        mode: "allowlist",
        skillNames: ["github", "slack"],
      })
    );
    expect(ctx.loadAgents).toHaveBeenCalledTimes(1);
    expect(ctx.refreshGatewayConfigSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects_empty_selected_skills_allowlist_before_gateway_call", async () => {
    const ctx = renderController();

    await act(async () => {
      await ctx.getValue().handleSetSkillsAllowlist("agent-1", [" ", ""]);
    });

    expect(mockedUpdateGatewayAgentSkillsAllowlist).not.toHaveBeenCalled();
    expect(ctx.getValue().settingsSkillsError).toBe(
      "Cannot set selected skills mode: choose at least one skill."
    );
  });

  it("installs_skill_dependencies_with_per_skill_busy_and_message_state", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await ctx.getValue().handleInstallSkill("agent-1", "browser", "browser", "install-browser");
    });

    expect(mockedInstallSkill).toHaveBeenCalledWith(expect.anything(), {
      name: "browser",
      installId: "install-browser",
      timeoutMs: 120000,
    });
    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-skill-setup" })
    );
    expect(ctx.getValue().settingsSkillsBusyKey).toBeNull();
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "success",
      message: "Installed",
    });
    expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(2);
  });

  it("refreshes_skills_after_system_setup_mutation_when_system_tab_is_active", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "system",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await ctx.getValue().handleInstallSkill("agent-1", "browser", "browser", "install-browser");
    });

    expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(2);
  });

  it("removes_skill_files_with_per_skill_busy_and_message_state", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "browser",
          description: "",
          source: "openclaw-workspace",
          bundled: false,
          filePath: "/tmp/workspace/skills/browser/SKILL.md",
          baseDir: "/tmp/workspace/skills/browser",
          skillKey: "browser",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
          configChecks: [],
          install: [],
        },
      ],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(ctx.getValue().settingsSkillsReport?.workspaceDir).toBe("/tmp/workspace");
    });

    await act(async () => {
      await ctx.getValue().handleRemoveSkill("agent-1", {
        skillKey: "browser",
        source: "openclaw-workspace",
        baseDir: "/tmp/workspace/skills/browser",
      });
    });

    expect(mockedRemoveSkillFromGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        skillKey: "browser",
        source: "openclaw-workspace",
        baseDir: "/tmp/workspace/skills/browser",
        workspaceDir: "/tmp/workspace",
        managedSkillsDir: "/tmp/skills",
      })
    );
    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-skill-setup" })
    );
    expect(ctx.getValue().settingsSkillsBusyKey).toBeNull();
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "success",
      message: "Skill removed from gateway files",
    });
  });

  it("saves_skill_api_key_via_config_queue_and_refreshes_skills", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      ctx.getValue().handleSkillApiKeyDraftChange("browser", "token-123");
    });
    await act(async () => {
      await ctx.getValue().handleSaveSkillApiKey("agent-1", "browser");
    });

    expect(mockedUpdateSkill).toHaveBeenCalledWith(expect.anything(), {
      skillKey: "browser",
      apiKey: "token-123",
    });
    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-skill-setup" })
    );
    expect(ctx.refreshGatewayConfigSnapshot).toHaveBeenCalledTimes(1);
    expect(ctx.getValue().settingsSkillApiKeyDrafts.browser).toBe("token-123");
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "success",
      message: "API key saved",
    });
  });

  it("toggles_global_skill_enabled_via_skill_update", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await ctx.getValue().handleSetSkillGlobalEnabled("agent-1", "browser", false);
    });

    expect(mockedUpdateSkill).toHaveBeenCalledWith(expect.anything(), {
      skillKey: "browser",
      enabled: false,
    });
    expect(ctx.enqueueConfigMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update-skill-setup" })
    );
    expect(ctx.refreshGatewayConfigSnapshot).toHaveBeenCalledTimes(1);
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "success",
      message: "Skill disabled globally",
    });
  });

  it("preserves_api_key_draft_and_sets_error_message_when_save_fails", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    mockedUpdateSkill.mockRejectedValue(new Error("invalid key"));
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      ctx.getValue().handleSkillApiKeyDraftChange("browser", "token-123");
    });
    await act(async () => {
      await ctx.getValue().handleSaveSkillApiKey("agent-1", "browser");
    });

    expect(ctx.getValue().settingsSkillApiKeyDrafts.browser).toBe("token-123");
    expect(ctx.getValue().settingsSkillsError).toBe("invalid key");
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "error",
      message: "invalid key",
    });
  });

  it("rejects_empty_api_key_before_gateway_call", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(mockedLoadAgentSkillStatus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      ctx.getValue().handleSkillApiKeyDraftChange("browser", "   ");
    });
    await act(async () => {
      await ctx.getValue().handleSaveSkillApiKey("agent-1", "browser");
    });

    expect(mockedUpdateSkill).not.toHaveBeenCalled();
    expect(ctx.getValue().settingsSkillsError).toBe("API key cannot be empty.");
    expect(ctx.getValue().settingsSkillMessages.browser).toEqual({
      kind: "error",
      message: "API key cannot be empty.",
    });
  });

  it("disabling_one_skill_from_implicit_all_writes_explicit_allowlist", async () => {
    mockedLoadAgentSkillStatus.mockResolvedValue({
      workspaceDir: "/tmp/workspace",
      managedSkillsDir: "/tmp/skills",
      skills: [
        {
          name: "github",
          description: "",
          source: "shared",
          bundled: false,
          filePath: "/tmp/skills/github/SKILL.md",
          baseDir: "/tmp/skills/github",
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
          description: "",
          source: "bundled",
          bundled: true,
          filePath: "/tmp/skills/browser/SKILL.md",
          baseDir: "/tmp/skills/browser",
          skillKey: "browser",
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
          name: "slack",
          description: "",
          source: "shared",
          bundled: false,
          filePath: "/tmp/skills/slack/SKILL.md",
          baseDir: "/tmp/skills/slack",
          skillKey: "slack",
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
          name: "apple-notes",
          description: "",
          source: "openclaw-managed",
          bundled: false,
          filePath: "/tmp/skills/apple-notes/SKILL.md",
          baseDir: "/tmp/skills/apple-notes",
          skillKey: "apple-notes",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: false,
          requirements: { bins: [], anyBins: [], env: [], config: [], os: ["darwin"] },
          missing: { bins: [], anyBins: [], env: [], config: [], os: ["darwin"] },
          configChecks: [],
          install: [],
        },
      ],
    });
    const ctx = renderController({
      settingsRouteActive: true,
      inspectSidebarAgentId: "agent-1",
      inspectSidebarTab: "skills",
    });

    await waitFor(() => {
      expect(ctx.getValue().settingsSkillsReport?.skills.length).toBe(4);
    });

    await act(async () => {
      await ctx.getValue().handleSetSkillEnabled("agent-1", "browser", false);
    });

    expect(mockedReadGatewayAgentSkillsAllowlist).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agent-1" })
    );
    expect(mockedUpdateGatewayAgentSkillsAllowlist).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentId: "agent-1",
        mode: "allowlist",
        skillNames: ["github", "slack"],
      })
    );
  });
});
