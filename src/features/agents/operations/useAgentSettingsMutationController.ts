import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentPermissionsDraft } from "@/features/agents/operations/agentPermissionsOperation";
import { updateAgentPermissionsViaStudio } from "@/features/agents/operations/agentPermissionsOperation";
import { performCronCreateFlow } from "@/features/agents/operations/cronCreateOperation";
import { deleteAgentRecordViaStudio } from "@/features/agents/operations/deleteAgentOperation";
import {
  planAgentSettingsMutation,
  type AgentSettingsMutationContext,
} from "@/features/agents/operations/agentSettingsMutationWorkflow";
import {
  buildQueuedMutationBlock,
  runAgentConfigMutationLifecycle,
  type MutationBlockState,
  type MutationWorkflowKind,
} from "@/features/agents/operations/mutationLifecycleWorkflow";
import type { SettingsRouteTab } from "@/features/agents/operations/settingsRouteWorkflow";
import type { ConfigMutationKind } from "@/features/agents/operations/useConfigMutationQueue";
import { useGatewayRestartBlock } from "@/features/agents/operations/useGatewayRestartBlock";
import type { AgentState } from "@/features/agents/state/store";
import type { CronCreateDraft } from "@/lib/cron/createPayloadBuilder";
import {
  filterCronJobsForAgent,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
  sortCronJobsByUpdatedAt,
  type CronJobSummary,
} from "@/lib/cron/types";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import {
  renameGatewayAgent,
  updateGatewayAgentSkillsAllowlist,
} from "@/lib/gateway/agentConfig";
import { canRemoveSkillSource } from "@/lib/skills/presentation";
import { setAgentSkillEnabled } from "@/lib/skills/agentAccess";
import { removeSkillFromGateway } from "@/lib/skills/remove";
import {
  installSkill,
  loadAgentSkillStatus,
  updateSkill,
  type SkillStatusEntry,
  type SkillStatusReport,
} from "@/lib/skills/types";

export type RestartingMutationBlockState = MutationBlockState & { kind: MutationWorkflowKind };
export type SkillSetupMessage = { kind: "success" | "error"; message: string };
export type SkillSetupMessageMap = Record<string, SkillSetupMessage>;

type AgentForSettingsMutation = Pick<AgentState, "agentId" | "name" | "sessionKey">;

export type UseAgentSettingsMutationControllerParams = {
  client: GatewayClient;
  status: GatewayStatus;
  runtimeSupportsCron: boolean;
  isLocalGateway: boolean;
  agents: AgentForSettingsMutation[];
  hasCreateBlock: boolean;
  enqueueConfigMutation: (params: {
    kind: ConfigMutationKind;
    label: string;
    run: () => Promise<void>;
    requiresIdleAgents?: boolean;
  }) => Promise<void>;
  gatewayConfigSnapshot: GatewayModelPolicySnapshot | null;
  settingsRouteActive: boolean;
  inspectSidebarAgentId: string | null;
  inspectSidebarTab: SettingsRouteTab | null;
  loadAgents: () => Promise<void>;
  refreshGatewayConfigSnapshot: () => Promise<GatewayModelPolicySnapshot | null>;
  clearInspectSidebar: () => void;
  setInspectSidebarCapabilities: (agentId: string) => void;
  dispatchUpdateAgent: (agentId: string, patch: Partial<AgentState>) => void;
  removeAgent?: (agentId: string) => void;
  setMobilePaneChat: () => void;
  setError: (message: string) => void;
};

export function useAgentSettingsMutationController(params: UseAgentSettingsMutationControllerParams) {
  const { agents, loadAgents, setMobilePaneChat, status } = params;
  const skillsLoadRequestIdRef = useRef(0);
  const [settingsSkillsReport, setSettingsSkillsReport] = useState<SkillStatusReport | null>(null);
  const [settingsSkillsLoading, setSettingsSkillsLoading] = useState(false);
  const [settingsSkillsError, setSettingsSkillsError] = useState<string | null>(null);
  const [settingsSkillsBusy, setSettingsSkillsBusy] = useState(false);
  const [settingsSkillsBusyKey, setSettingsSkillsBusyKey] = useState<string | null>(null);
  const [settingsSkillMessages, setSettingsSkillMessages] = useState<SkillSetupMessageMap>({});
  const [settingsSkillApiKeyDrafts, setSettingsSkillApiKeyDrafts] = useState<Record<string, string>>(
    {}
  );
  const [settingsCronJobs, setSettingsCronJobs] = useState<CronJobSummary[]>([]);
  const [settingsCronLoading, setSettingsCronLoading] = useState(false);
  const [settingsCronError, setSettingsCronError] = useState<string | null>(null);
  const [cronCreateBusy, setCronCreateBusy] = useState(false);
  const [cronRunBusyJobId, setCronRunBusyJobId] = useState<string | null>(null);
  const [cronDeleteBusyJobId, setCronDeleteBusyJobId] = useState<string | null>(null);
  const [restartingMutationBlock, setRestartingMutationBlock] =
    useState<RestartingMutationBlockState | null>(null);
  const REMOTE_MUTATION_EXEC_TIMEOUT_MS = 45_000;
  const SKILL_INSTALL_TIMEOUT_MS = 120_000;
  const CRON_UNSUPPORTED_MESSAGE = "This runtime does not support automations.";

  const hasRenameMutationBlock = restartingMutationBlock?.kind === "rename-agent";
  const hasDeleteMutationBlock = restartingMutationBlock?.kind === "delete-agent";
  const hasRestartBlockInProgress = Boolean(
    restartingMutationBlock && restartingMutationBlock.phase !== "queued"
  );

  const mutationContext: AgentSettingsMutationContext = useMemo(
    () => ({
      status: params.status,
      hasCreateBlock: params.hasCreateBlock,
      hasRenameBlock: hasRenameMutationBlock,
      hasDeleteBlock: hasDeleteMutationBlock,
      cronCreateBusy,
      cronRunBusyJobId,
      cronDeleteBusyJobId,
    }),
    [
      cronCreateBusy,
      cronDeleteBusyJobId,
      cronRunBusyJobId,
      hasDeleteMutationBlock,
      hasRenameMutationBlock,
      params.hasCreateBlock,
      params.status,
    ]
  );

  const setSkillMessage = useCallback((skillKey: string, message?: SkillSetupMessage) => {
    const normalizedSkillKey = skillKey.trim();
    if (!normalizedSkillKey) {
      return;
    }
    setSettingsSkillMessages((current) => {
      const next = { ...current };
      if (!message) {
        delete next[normalizedSkillKey];
      } else {
        next[normalizedSkillKey] = message;
      }
      return next;
    });
  }, []);

  const loadSkillsForSettingsAgent = useCallback(
    async (agentId: string) => {
      const requestId = skillsLoadRequestIdRef.current + 1;
      skillsLoadRequestIdRef.current = requestId;
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        if (requestId === skillsLoadRequestIdRef.current) {
          setSettingsSkillsReport(null);
          setSettingsSkillsError("Failed to load skills: missing agent id.");
        }
        return;
      }
      setSettingsSkillsLoading(true);
      setSettingsSkillsError(null);
      try {
        const report = await loadAgentSkillStatus(params.client, resolvedAgentId);
        if (requestId !== skillsLoadRequestIdRef.current) {
          return;
        }
        setSettingsSkillsReport(report);
      } catch (err) {
        if (requestId !== skillsLoadRequestIdRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load skills.";
        setSettingsSkillsReport(null);
        setSettingsSkillsError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        if (requestId === skillsLoadRequestIdRef.current) {
          setSettingsSkillsLoading(false);
        }
      }
    },
    [params.client]
  );

  useEffect(() => {
    const skillsTabActive =
      params.inspectSidebarTab === "skills" || params.inspectSidebarTab === "system";
    if (
      !params.settingsRouteActive ||
      !params.inspectSidebarAgentId ||
      params.status !== "connected" ||
      !skillsTabActive
    ) {
      skillsLoadRequestIdRef.current += 1;
      setSettingsSkillsReport(null);
      setSettingsSkillsLoading(false);
      setSettingsSkillsError(null);
      setSettingsSkillsBusy(false);
      setSettingsSkillsBusyKey(null);
      setSettingsSkillMessages({});
      setSettingsSkillApiKeyDrafts({});
      return;
    }
    void loadSkillsForSettingsAgent(params.inspectSidebarAgentId);
  }, [
    loadSkillsForSettingsAgent,
    params.inspectSidebarAgentId,
    params.inspectSidebarTab,
    params.settingsRouteActive,
    params.status,
  ]);

  useEffect(() => {
    setSettingsSkillsBusyKey(null);
    setSettingsSkillMessages({});
    setSettingsSkillApiKeyDrafts({});
  }, [params.inspectSidebarAgentId]);

  const loadCronJobsForSettingsAgent = useCallback(
    async (agentId: string) => {
      if (!params.runtimeSupportsCron) {
        setSettingsCronJobs([]);
        setSettingsCronLoading(false);
        setSettingsCronError(CRON_UNSUPPORTED_MESSAGE);
        return;
      }
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setSettingsCronJobs([]);
        setSettingsCronError("Failed to load schedules: missing agent id.");
        return;
      }
      setSettingsCronLoading(true);
      setSettingsCronError(null);
      try {
        const result = await listCronJobs(params.client, { includeDisabled: true });
        const filtered = filterCronJobsForAgent(result.jobs, resolvedAgentId);
        setSettingsCronJobs(sortCronJobsByUpdatedAt(filtered));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load schedules.";
        setSettingsCronJobs([]);
        setSettingsCronError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsCronLoading(false);
      }
    },
    [params.client, params.runtimeSupportsCron]
  );

  useEffect(() => {
    if (
      !params.settingsRouteActive ||
      !params.inspectSidebarAgentId ||
      params.status !== "connected" ||
      params.inspectSidebarTab !== "automations"
    ) {
      setSettingsCronJobs([]);
      setSettingsCronLoading(false);
      setSettingsCronError(null);
      setCronRunBusyJobId(null);
      setCronDeleteBusyJobId(null);
      return;
    }
    void loadCronJobsForSettingsAgent(params.inspectSidebarAgentId);
  }, [
    loadCronJobsForSettingsAgent,
    params.inspectSidebarAgentId,
    params.inspectSidebarTab,
    params.settingsRouteActive,
    params.status,
  ]);

  const runRestartingMutationLifecycle = useCallback(
    async (input: {
      kind: MutationWorkflowKind;
      agentId: string;
      agentName: string;
      label: string;
      executeMutation: () => Promise<void>;
    }) => {
      return await runAgentConfigMutationLifecycle({
        kind: input.kind,
        label: input.label,
        isLocalGateway: params.isLocalGateway,
        deps: {
          enqueueConfigMutation: params.enqueueConfigMutation,
          setQueuedBlock: () => {
            const queuedBlock = buildQueuedMutationBlock({
              kind: input.kind,
              agentId: input.agentId,
              agentName: input.agentName,
              startedAt: Date.now(),
            });
            setRestartingMutationBlock({
              kind: input.kind,
              agentId: queuedBlock.agentId,
              agentName: queuedBlock.agentName,
              phase: queuedBlock.phase,
              startedAt: queuedBlock.startedAt,
              sawDisconnect: queuedBlock.sawDisconnect,
            });
          },
          setMutatingBlock: () => {
            setRestartingMutationBlock((current) => {
              if (!current) return current;
              if (current.kind !== input.kind || current.agentId !== input.agentId) return current;
              return {
                ...current,
                phase: "mutating",
              };
            });
          },
          patchBlockAwaitingRestart: (patch) => {
            setRestartingMutationBlock((current) => {
              if (!current) return current;
              if (current.kind !== input.kind || current.agentId !== input.agentId) return current;
              return {
                ...current,
                ...patch,
              };
            });
          },
          clearBlock: () => {
            setRestartingMutationBlock((current) => {
              if (!current) return current;
              if (current.kind !== input.kind || current.agentId !== input.agentId) return current;
              return null;
            });
          },
          executeMutation: async () => {
            const timeoutLabel =
              input.kind === "delete-agent"
                ? "Delete agent request timed out."
                : "Rename agent request timed out.";
            await Promise.race([
              input.executeMutation(),
              new Promise<never>((_, reject) => {
                window.setTimeout(
                  () =>
                    reject(
                      new Error(
                        `${timeoutLabel} The gateway did not respond in time.`
                      )
                    ),
                  REMOTE_MUTATION_EXEC_TIMEOUT_MS
                );
              }),
            ]);
          },
          shouldAwaitRemoteRestart: async () => false,
          reloadAgents: params.loadAgents,
          setMobilePaneChat: params.setMobilePaneChat,
          onError: params.setError,
        },
      });
    },
    [
      params.enqueueConfigMutation,
      params.isLocalGateway,
      params.loadAgents,
      params.setError,
      params.setMobilePaneChat,
    ]
  );

  useGatewayRestartBlock({
    status: params.status,
    block: restartingMutationBlock,
    setBlock: setRestartingMutationBlock,
    maxWaitMs: 90_000,
    onTimeout: () => {
      const timeoutMessage =
        restartingMutationBlock?.kind === "delete-agent"
          ? "Gateway restart timed out after deleting the agent."
          : "Gateway restart timed out after renaming the agent.";
      setRestartingMutationBlock(null);
      params.setError(timeoutMessage);
    },
    onRestartComplete: async (_, ctx) => {
      await params.loadAgents();
      if (ctx.isCancelled()) return;
      setRestartingMutationBlock(null);
      params.setMobilePaneChat();
    },
  });

  useEffect(() => {
    if (!restartingMutationBlock) return;
    if (restartingMutationBlock.kind !== "delete-agent") return;
    if (restartingMutationBlock.phase !== "awaiting-restart") return;
    if (status !== "connected") return;

    const deletedAgentStillPresent = agents.some(
      (entry) => entry.agentId === restartingMutationBlock.agentId
    );
    if (!deletedAgentStillPresent) {
      setRestartingMutationBlock(null);
      setMobilePaneChat();
      return;
    }

    let cancelled = false;
    const refreshAgents = async () => {
      try {
        await loadAgents();
      } catch (error) {
        if (!isGatewayDisconnectLikeError(error)) {
          console.error("Failed to refresh agents while awaiting delete restart.", error);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      void refreshAgents();
    }, 2500);
    void refreshAgents();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    agents,
    loadAgents,
    restartingMutationBlock,
    setMobilePaneChat,
    status,
  ]);

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      const decision = planAgentSettingsMutation(
        { kind: "delete-agent", agentId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          params.setError(decision.message);
        }
        return;
      }

      const agent = params.agents.find((entry) => entry.agentId === decision.normalizedAgentId);
      if (!agent) return;
      const confirmed = window.confirm(
        `Delete ${agent.name}? This removes the agent record from OpenClaw and clears its scheduled automations. Claw3D will not touch workspace files.`
      );
      if (!confirmed) return;

      await runRestartingMutationLifecycle({
        kind: "delete-agent",
        agentId: decision.normalizedAgentId,
        agentName: agent.name,
        label: `Delete ${agent.name}`,
        executeMutation: async () => {
          await deleteAgentRecordViaStudio({
            client: params.client,
            agentId: decision.normalizedAgentId,
            logError: (message, error) => console.error(message, error),
          });
          params.removeAgent?.(decision.normalizedAgentId);
          params.clearInspectSidebar();
        },
      });
    },
    [mutationContext, params, runRestartingMutationLifecycle]
  );

  const handleCreateCronJob = useCallback(
    async (agentId: string, draft: CronCreateDraft) => {
      if (!params.runtimeSupportsCron) {
        setSettingsCronError(CRON_UNSUPPORTED_MESSAGE);
        return;
      }
      const decision = planAgentSettingsMutation(
        { kind: "create-cron-job", agentId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          setSettingsCronError(decision.message);
        }
        return;
      }

      try {
        await performCronCreateFlow({
          client: params.client,
          agentId: decision.normalizedAgentId,
          draft,
          busy: {
            createBusy: cronCreateBusy,
            runBusyJobId: cronRunBusyJobId,
            deleteBusyJobId: cronDeleteBusyJobId,
          },
          onBusyChange: setCronCreateBusy,
          onError: setSettingsCronError,
          onJobs: setSettingsCronJobs,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create automation.";
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
        throw err;
      }
    },
    [
      cronCreateBusy,
      cronDeleteBusyJobId,
      cronRunBusyJobId,
      mutationContext,
      params.client,
      params.runtimeSupportsCron,
    ]
  );

  const handleRunCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      if (!params.runtimeSupportsCron) {
        setSettingsCronError(CRON_UNSUPPORTED_MESSAGE);
        return;
      }
      const decision = planAgentSettingsMutation(
        { kind: "run-cron-job", agentId, jobId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          setSettingsCronError(decision.message);
        }
        return;
      }

      const resolvedJobId = decision.normalizedJobId as string;
      const resolvedAgentId = decision.normalizedAgentId;
      setCronRunBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        await runCronJobNow(params.client, resolvedJobId);
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run schedule.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronRunBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [loadCronJobsForSettingsAgent, mutationContext, params.client, params.runtimeSupportsCron]
  );

  const handleDeleteCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      if (!params.runtimeSupportsCron) {
        setSettingsCronError(CRON_UNSUPPORTED_MESSAGE);
        return;
      }
      const decision = planAgentSettingsMutation(
        { kind: "delete-cron-job", agentId, jobId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          setSettingsCronError(decision.message);
        }
        return;
      }

      const resolvedJobId = decision.normalizedJobId as string;
      const resolvedAgentId = decision.normalizedAgentId;
      setCronDeleteBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        const result = await removeCronJob(params.client, resolvedJobId);
        if (result.ok && result.removed) {
          setSettingsCronJobs((jobs) => jobs.filter((job) => job.id !== resolvedJobId));
        }
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete schedule.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronDeleteBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [loadCronJobsForSettingsAgent, mutationContext, params.client, params.runtimeSupportsCron]
  );

  const handleRenameAgent = useCallback(
    async (agentId: string, name: string) => {
      const decision = planAgentSettingsMutation(
        { kind: "rename-agent", agentId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          params.setError(decision.message);
        }
        return false;
      }
      const agent = params.agents.find((entry) => entry.agentId === decision.normalizedAgentId);
      if (!agent) return false;

      return await runRestartingMutationLifecycle({
        kind: "rename-agent",
        agentId: decision.normalizedAgentId,
        agentName: name,
        label: `Rename ${agent.name}`,
        executeMutation: async () => {
          await renameGatewayAgent({
            client: params.client,
            agentId: decision.normalizedAgentId,
            name,
          });
          params.dispatchUpdateAgent(decision.normalizedAgentId, { name });
        },
      });
    },
    [mutationContext, params, runRestartingMutationLifecycle]
  );

  const handleUpdateAgentPermissions = useCallback(
    async (agentId: string, draft: AgentPermissionsDraft) => {
      const decision = planAgentSettingsMutation(
        { kind: "update-agent-permissions", agentId },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          params.setError(decision.message);
        }
        return;
      }

      const agent = params.agents.find((entry) => entry.agentId === decision.normalizedAgentId);
      if (!agent) return;

      await params.enqueueConfigMutation({
        kind: "update-agent-permissions",
        label: `Update permissions for ${agent.name}`,
        run: async () => {
          await updateAgentPermissionsViaStudio({
            client: params.client,
            agentId: decision.normalizedAgentId,
            sessionKey: agent.sessionKey,
            draft,
            loadAgents: async () => {},
          });
          await params.loadAgents();
          await params.refreshGatewayConfigSnapshot();
          params.setInspectSidebarCapabilities(decision.normalizedAgentId);
          params.setMobilePaneChat();
        },
      });
    },
    [mutationContext, params]
  );

  const reloadSkillsIfVisible = useCallback(
    async (agentId: string) => {
      const skillsTabActive =
        params.inspectSidebarTab === "skills" || params.inspectSidebarTab === "system";
      if (
        params.settingsRouteActive &&
        skillsTabActive &&
        params.inspectSidebarAgentId === agentId &&
        params.status === "connected"
      ) {
        await loadSkillsForSettingsAgent(agentId);
      }
    },
    [
      loadSkillsForSettingsAgent,
      params.inspectSidebarAgentId,
      params.inspectSidebarTab,
      params.settingsRouteActive,
      params.status,
    ]
  );

  const runSkillsMutation = useCallback(
    async (input: {
      agentId: string;
      decisionKind:
        | "use-all-skills"
        | "disable-all-skills"
        | "set-skills-allowlist"
        | "set-skill-enabled";
      skillName?: string;
      run: (normalizedAgentId: string) => Promise<void>;
    }) => {
      const decision = planAgentSettingsMutation(
        {
          kind: input.decisionKind,
          agentId: input.agentId,
          ...(input.skillName ? { skillName: input.skillName } : {}),
        },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          setSettingsSkillsError(decision.message);
        }
        return;
      }

      const agent =
        params.agents.find((entry) => entry.agentId === decision.normalizedAgentId) ?? null;
      setSettingsSkillsBusy(true);
      setSettingsSkillsError(null);
      try {
        await params.enqueueConfigMutation({
          kind: "update-agent-skills",
          label: `Update skills for ${agent?.name ?? decision.normalizedAgentId}`,
          run: async () => {
            await input.run(decision.normalizedAgentId);
            await params.loadAgents();
            await params.refreshGatewayConfigSnapshot();
            await reloadSkillsIfVisible(decision.normalizedAgentId);
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update skills.";
        setSettingsSkillsError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsSkillsBusy(false);
      }
    },
    [mutationContext, params, reloadSkillsIfVisible]
  );

  const handleUseAllSkills = useCallback(
    async (agentId: string) => {
      await runSkillsMutation({
        agentId,
        decisionKind: "use-all-skills",
        run: async (normalizedAgentId) => {
          await updateGatewayAgentSkillsAllowlist({
            client: params.client,
            agentId: normalizedAgentId,
            mode: "all",
          });
        },
      });
    },
    [params.client, runSkillsMutation]
  );

  const handleDisableAllSkills = useCallback(
    async (agentId: string) => {
      await runSkillsMutation({
        agentId,
        decisionKind: "disable-all-skills",
        run: async (normalizedAgentId) => {
          await updateGatewayAgentSkillsAllowlist({
            client: params.client,
            agentId: normalizedAgentId,
            mode: "none",
          });
        },
      });
    },
    [params.client, runSkillsMutation]
  );

  const handleSetSkillEnabled = useCallback(
    async (agentId: string, skillName: string, enabled: boolean) => {
      await runSkillsMutation({
        agentId,
        decisionKind: "set-skill-enabled",
        skillName,
        run: async (normalizedAgentId) => {
          await setAgentSkillEnabled({
            client: params.client,
            agentId: normalizedAgentId,
            skillName,
            enabled,
            visibleSkills: settingsSkillsReport?.skills ?? [],
          });
        },
      });
    },
    [params.client, runSkillsMutation, settingsSkillsReport]
  );

  const handleSetSkillsAllowlist = useCallback(
    async (agentId: string, skillNames: string[]) => {
      await runSkillsMutation({
        agentId,
        decisionKind: "set-skills-allowlist",
        run: async (normalizedAgentId) => {
          const normalizedSkillNames = Array.from(
            new Set(
              skillNames
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            )
          );
          if (normalizedSkillNames.length === 0) {
            throw new Error("Cannot set selected skills mode: choose at least one skill.");
          }
          await updateGatewayAgentSkillsAllowlist({
            client: params.client,
            agentId: normalizedAgentId,
            mode: "allowlist",
            skillNames: normalizedSkillNames,
          });
        },
      });
    },
    [params.client, runSkillsMutation]
  );

  const handleSkillApiKeyDraftChange = useCallback((skillKey: string, value: string) => {
    const normalizedSkillKey = skillKey.trim();
    if (!normalizedSkillKey) {
      return;
    }
    setSettingsSkillApiKeyDrafts((current) => ({
      ...current,
      [normalizedSkillKey]: value,
    }));
  }, []);

  const runSkillSetupMutation = useCallback(
    async (input: {
      agentId: string;
      decisionKind:
        | "install-skill"
        | "remove-skill"
        | "save-skill-api-key"
        | "set-skill-global-enabled";
      skillKey: string;
      label: string;
      run: () => Promise<{ successMessage: string }>;
      refreshConfigSnapshot?: boolean;
    }) => {
      const normalizedSkillKey = input.skillKey.trim();
      const decision = planAgentSettingsMutation(
        {
          kind: input.decisionKind,
          agentId: input.agentId,
          skillKey: normalizedSkillKey,
        },
        mutationContext
      );
      if (decision.kind === "deny") {
        if (decision.message) {
          setSettingsSkillsError(decision.message);
        }
        return;
      }

      setSettingsSkillsError(null);
      setSettingsSkillsBusyKey(normalizedSkillKey);
      setSkillMessage(normalizedSkillKey);
      try {
        await params.enqueueConfigMutation({
          kind: "update-skill-setup",
          label: input.label,
          run: async () => {
            const result = await input.run();
            if (input.refreshConfigSnapshot) {
              await params.refreshGatewayConfigSnapshot();
            }
            await reloadSkillsIfVisible(decision.normalizedAgentId);
            setSkillMessage(normalizedSkillKey, {
              kind: "success",
              message: result.successMessage,
            });
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update skill setup.";
        setSettingsSkillsError(message);
        setSkillMessage(normalizedSkillKey, {
          kind: "error",
          message,
        });
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsSkillsBusyKey((current) => (current === normalizedSkillKey ? null : current));
      }
    },
    [mutationContext, params, reloadSkillsIfVisible, setSkillMessage]
  );

  const handleInstallSkill = useCallback(
    async (agentId: string, skillKey: string, name: string, installId: string) => {
      await runSkillSetupMutation({
        agentId,
        decisionKind: "install-skill",
        skillKey,
        label: `Install dependencies for ${name.trim() || skillKey.trim()}`,
        run: async () => {
          const result = await installSkill(params.client, {
            name,
            installId,
            timeoutMs: SKILL_INSTALL_TIMEOUT_MS,
          });
          return {
            successMessage: result.message || "Installed",
          };
        },
      });
    },
    [SKILL_INSTALL_TIMEOUT_MS, params.client, runSkillSetupMutation]
  );

  const handleRemoveSkill = useCallback(
    async (
      agentId: string,
      skill: Pick<SkillStatusEntry, "skillKey" | "source" | "baseDir">
    ) => {
      const report = settingsSkillsReport;
      const normalizedSkillKey = skill.skillKey.trim();
      if (!normalizedSkillKey) {
        const message = "Skill key is required to remove the skill.";
        setSettingsSkillsError(message);
        return;
      }
      if (!report) {
        const message = "Cannot remove skill: skills are not loaded.";
        setSettingsSkillsError(message);
        setSkillMessage(normalizedSkillKey, {
          kind: "error",
          message,
        });
        return;
      }
      const normalizedSource = skill.source.trim();
      if (!canRemoveSkillSource(normalizedSource)) {
        const message = `Skill source cannot be removed from Studio: ${normalizedSource || "unknown"}.`;
        setSettingsSkillsError(message);
        setSkillMessage(normalizedSkillKey, {
          kind: "error",
          message,
        });
        return;
      }

      await runSkillSetupMutation({
        agentId,
        decisionKind: "remove-skill",
        skillKey: normalizedSkillKey,
        label: `Remove ${normalizedSkillKey}`,
        run: async () => {
          const result = await removeSkillFromGateway({
            client: params.client,
            skillKey: normalizedSkillKey,
            source: normalizedSource,
            baseDir: skill.baseDir,
            workspaceDir: report.workspaceDir,
            managedSkillsDir: report.managedSkillsDir,
          });
          return {
            successMessage: result.removed
              ? "Skill removed from gateway files"
              : "Skill files were already removed",
          };
        },
      });
    },
    [params.client, runSkillSetupMutation, setSkillMessage, settingsSkillsReport]
  );

  const handleSaveSkillApiKey = useCallback(
    async (agentId: string, skillKey: string) => {
      const normalizedSkillKey = skillKey.trim();
      const apiKey = (settingsSkillApiKeyDrafts[normalizedSkillKey] ?? "").trim();
      if (!apiKey) {
        const message = "API key cannot be empty.";
        setSettingsSkillsError(message);
        setSkillMessage(normalizedSkillKey, {
          kind: "error",
          message,
        });
        return;
      }
      await runSkillSetupMutation({
        agentId,
        decisionKind: "save-skill-api-key",
        skillKey: normalizedSkillKey,
        label: `Save API key for ${normalizedSkillKey}`,
        refreshConfigSnapshot: true,
        run: async () => {
          await updateSkill(params.client, {
            skillKey: normalizedSkillKey,
            apiKey,
          });
          return {
            successMessage: "API key saved",
          };
        },
      });
    },
    [params.client, runSkillSetupMutation, setSkillMessage, settingsSkillApiKeyDrafts]
  );

  const handleSetSkillGlobalEnabled = useCallback(
    async (agentId: string, skillKey: string, enabled: boolean) => {
      const normalizedSkillKey = skillKey.trim();
      await runSkillSetupMutation({
        agentId,
        decisionKind: "set-skill-global-enabled",
        skillKey: normalizedSkillKey,
        label: `${enabled ? "Enable" : "Disable"} ${normalizedSkillKey}`,
        refreshConfigSnapshot: true,
        run: async () => {
          await updateSkill(params.client, {
            skillKey: normalizedSkillKey,
            enabled,
          });
          return {
            successMessage: enabled ? "Skill enabled globally" : "Skill disabled globally",
          };
        },
      });
    },
    [params.client, runSkillSetupMutation]
  );

  return {
    settingsSkillsReport,
    settingsSkillsLoading,
    settingsSkillsError,
    settingsSkillsBusy,
    settingsSkillsBusyKey,
    settingsSkillMessages,
    settingsSkillApiKeyDrafts,
    settingsCronJobs,
    settingsCronLoading,
    settingsCronError,
    cronCreateBusy,
    cronRunBusyJobId,
    cronDeleteBusyJobId,
    restartingMutationBlock,
    hasRenameMutationBlock,
    hasDeleteMutationBlock,
    hasRestartBlockInProgress,
    handleDeleteAgent,
    handleCreateCronJob,
    handleRunCronJob,
    handleDeleteCronJob,
    handleRenameAgent,
    handleUpdateAgentPermissions,
    handleUseAllSkills,
    handleDisableAllSkills,
    handleSetSkillsAllowlist,
    handleSetSkillEnabled,
    handleInstallSkill,
    handleRemoveSkill,
    handleSkillApiKeyDraftChange,
    handleSaveSkillApiKey,
    handleSetSkillGlobalEnabled,
  };
}
