"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import { AgentAvatarCreatorModal } from "@/features/agents/components/AgentAvatarCreatorModal";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";
import {
  AgentBrainPanel,
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { FleetSidebar } from "@/features/agents/components/FleetSidebar";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import {
  isHeartbeatPrompt,
} from "@/lib/text/message-extract";
import { useRuntimeConnection } from "@/lib/runtime/useRuntimeConnection";
import {
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";
import {
  getFilteredAgents,
  getSelectedAgent,
  type FocusFilter,
  useAgentStore,
} from "@/features/agents/state/store";
import type { AgentState } from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  type CronJobSummary,
  formatCronJobDisplay,
  listCronJobs,
  resolveLatestCronJobForAgent,
} from "@/lib/cron/types";
import {
  createGatewayAgent,
  readConfigAgentList,
  resolveDefaultConfigAgentId,
  slugifyAgentName,
} from "@/lib/gateway/agentConfig";
import { buildAvatarDataUrl } from "@/lib/avatars/multiavatar";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import {
  type AgentAvatarProfile,
  createDefaultAgentAvatarProfile,
} from "@/lib/avatars/profile";
import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import type { AgentCreateModalSubmitPayload } from "@/features/agents/creation/types";
import {
  isGatewayDisconnectLikeError,
  type EventFrame,
} from "@/lib/gateway/GatewayClient";
import {
  useConfigMutationQueue,
  type ConfigMutationKind,
} from "@/features/agents/operations/useConfigMutationQueue";
import { useGatewayConfigSyncController } from "@/features/agents/operations/useGatewayConfigSyncController";
import { useFinalizedAssistantReplyListener } from "@/hooks/useFinalizedAssistantReplyListener";
import { useStudioVoiceRepliesPreference } from "@/hooks/useStudioVoiceRepliesPreference";
import { useVoiceReplyPlayback } from "@/hooks/useVoiceReplyPlayback";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import type { ExecApprovalDecision, PendingExecApproval } from "@/features/agents/approvals/types";
import {
  planAwaitingUserInputPatches,
  planPendingPruneDelay,
  planPrunedPendingState,
} from "@/features/agents/approvals/execApprovalControlLoopWorkflow";
import {
  runGatewayEventIngressOperation,
  runPauseRunForExecApprovalOperation,
  runResolveExecApprovalOperation,
} from "@/features/agents/approvals/execApprovalRunControlOperation";
import {
  mergePendingApprovalsForFocusedAgent,
} from "@/features/agents/approvals/pendingStore";
import {
  resolveLatestUpdateKind,
} from "@/features/agents/operations/latestUpdateWorkflow";
import { createSpecialLatestUpdateOperation } from "@/features/agents/operations/specialLatestUpdateOperation";
import {
  resolveAgentPermissionsDraft,
} from "@/features/agents/operations/agentPermissionsOperation";
import {
  executeStudioBootstrapLoadCommands,
  executeStudioFocusedPatchCommands,
  executeStudioFocusedPreferenceLoadCommands,
  runStudioBootstrapLoadOperation,
  runStudioFocusFilterPersistenceOperation,
  runStudioFocusedPreferenceLoadOperation,
  runStudioFocusedSelectionPersistenceOperation,
} from "@/features/agents/operations/studioBootstrapOperation";
import {
  CREATE_AGENT_DEFAULT_PERMISSIONS,
  applyCreateAgentBootstrapPermissions,
  executeCreateAgentBootstrapCommands,
  runCreateAgentBootstrapOperation,
} from "@/features/agents/operations/createAgentBootstrapOperation";
import {
  buildQueuedMutationBlock,
  isCreateBlockTimedOut,
  resolveConfigMutationStatusLine,
  runCreateAgentMutationLifecycle,
  type CreateAgentBlockState,
} from "@/features/agents/operations/mutationLifecycleWorkflow";
import { useAgentSettingsMutationController } from "@/features/agents/operations/useAgentSettingsMutationController";
import { useRuntimeSyncController } from "@/features/agents/operations/useRuntimeSyncController";
import { useChatInteractionController } from "@/features/agents/operations/useChatInteractionController";
import { resolveSettingsSidebarEntries } from "@/features/agents/operations/settingsSidebarTabs";
import {
  SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM,
  parseSettingsRouteAgentIdFromQueryParam,
  parseSettingsRouteAgentIdFromPathname,
  type InspectSidebarState,
  type SettingsRouteTab,
} from "@/features/agents/operations/settingsRouteWorkflow";
import { useSettingsRouteController } from "@/features/agents/operations/useSettingsRouteController";

const PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS = 500;

type MobilePane = "fleet" | "chat";
type SettingsSidebarItem = SettingsRouteTab;

const RESERVED_MAIN_AGENT_ID = "main";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeControlUiBasePath = (basePath: string): string => {
  let normalized = basePath.trim();
  if (!normalized || normalized === "/") return "";
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
};

const resolveControlUiUrl = (params: {
  gatewayUrl: string;
  configSnapshot: GatewayModelPolicySnapshot | null;
}): string | null => {
  const rawGatewayUrl = params.gatewayUrl.trim();
  if (!rawGatewayUrl) return null;

  let controlUiEnabled = true;
  let controlUiBasePath = "";

  const config = params.configSnapshot?.config;
  if (isRecord(config)) {
    const configRecord = config as Record<string, unknown>;
    const gateway = isRecord(configRecord["gateway"])
      ? (configRecord["gateway"] as Record<string, unknown>)
      : null;
    const controlUi = gateway && isRecord(gateway.controlUi) ? gateway.controlUi : null;
    if (controlUi && typeof controlUi.enabled === "boolean") {
      controlUiEnabled = controlUi.enabled;
    }
    if (typeof controlUi?.basePath === "string") {
      controlUiBasePath = normalizeControlUiBasePath(controlUi.basePath);
    }
  }

  if (!controlUiEnabled) return null;

  try {
    const url = new URL(rawGatewayUrl);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    url.pathname = controlUiBasePath ? `${controlUiBasePath}/` : "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const resolveNextNewAgentName = (agents: AgentState[]) => {
  const baseName = "New Agent";
  const existingNames = new Set(
    agents.map((agent) => agent.name.trim().toLowerCase()).filter((name) => name.length > 0)
  );
  const existingIds = new Set(
    agents
      .map((agent) => agent.agentId.trim().toLowerCase())
      .filter((agentId) => agentId.length > 0)
  );
  const baseLower = baseName.toLowerCase();
  if (!existingNames.has(baseLower) && !existingIds.has(slugifyAgentName(baseName))) return baseName;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (existingNames.has(candidate.toLowerCase())) continue;
    if (existingIds.has(slugifyAgentName(candidate))) continue;
    return candidate;
  }
  throw new Error("Unable to allocate a unique agent name.");
};

const AgentsPageScreen = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsRouteAgentId = useMemo(
    () =>
      parseSettingsRouteAgentIdFromQueryParam(
        searchParams.get(SETTINGS_ROUTE_AGENT_ID_QUERY_PARAM)
      ) ?? parseSettingsRouteAgentIdFromPathname(pathname ?? ""),
    [pathname, searchParams]
  );
  const settingsRouteActive = settingsRouteAgentId !== null;
  const [settingsCoordinator] = useState(() => createStudioSettingsCoordinator());
  const {
    client,
    provider,
    status,
    connectPromptReady,
    shouldPromptForConnect,
    gatewayUrl,
    token,
    selectedAdapterType,
    activeAdapterType,
    localGatewayDefaults,
    error: gatewayError,
    connect,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
    setSelectedAdapterType,
    supportsCapability,
  } = useRuntimeConnection(settingsCoordinator);
  const runtimeSupportsConfig = supportsCapability("config");
  const runtimeSupportsModels = supportsCapability("models");
  const runtimeSupportsCron = supportsCapability("cron");
  const {
    loaded: voiceRepliesLoaded,
    preference: voiceRepliesPreference,
    enabled: voiceRepliesEnabled,
    speed: voiceRepliesSpeed,
  } = useStudioVoiceRepliesPreference({
    gatewayUrl,
    settingsCoordinator,
  });
  const {
    enqueue: enqueueVoiceReply,
    stop: stopVoiceReplyPlayback,
  } = useVoiceReplyPlayback({
    enabled: voiceRepliesEnabled,
    provider: voiceRepliesPreference.provider,
    voiceId: voiceRepliesPreference.voiceId,
    speed: voiceRepliesSpeed,
  });

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const [didAttemptGatewayConnect, setDidAttemptGatewayConnect] = useState(false);
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const stateRef = useRef(state);
  const focusFilterTouchedRef = useRef(false);
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>([]);
  const [gatewayModelsError, setGatewayModelsError] = useState<string | null>(null);
  const [gatewayConfigSnapshot, setGatewayConfigSnapshot] =
    useState<GatewayModelPolicySnapshot | null>(null);
  const [createAgentBusy, setCreateAgentBusy] = useState(false);
  const [createAgentModalOpen, setCreateAgentModalOpen] = useState(false);
  const [createAgentModalError, setCreateAgentModalError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [inspectSidebar, setInspectSidebar] = useState<InspectSidebarState>(null);
  const [avatarCreatorAgentId, setAvatarCreatorAgentId] = useState<string | null>(null);
  const [systemInitialSkillKey, setSystemInitialSkillKey] = useState<string | null>(null);
  const [personalityHasUnsavedChanges, setPersonalityHasUnsavedChanges] = useState(false);
  const [settingsSidebarItem, setSettingsSidebarItem] = useState<SettingsSidebarItem>("personality");
  const [createAgentBlock, setCreateAgentBlock] = useState<CreateAgentBlockState | null>(null);
  const [pendingExecApprovalsByAgentId, setPendingExecApprovalsByAgentId] = useState<
    Record<string, PendingExecApproval[]>
  >({});
  const [unscopedPendingExecApprovals, setUnscopedPendingExecApprovals] = useState<
    PendingExecApproval[]
  >([]);
  const pendingExecApprovalsByAgentIdRef = useRef(pendingExecApprovalsByAgentId);
  const unscopedPendingExecApprovalsRef = useRef(unscopedPendingExecApprovals);
  const specialUpdateRef = useRef<Map<string, string>>(new Map());
  const seenCronEventIdsRef = useRef<Set<string>>(new Set());
  const preferredSelectedAgentIdRef = useRef<string | null>(null);
  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(
    null
  );
  const enqueueConfigMutationRef = useRef<
    (params: {
      kind: ConfigMutationKind;
      label: string;
      run: () => Promise<void>;
      requiresIdleAgents?: boolean;
    }) => Promise<void>
  >((input) => Promise.reject(new Error(`Config mutation queue not ready for "${input.kind}".`)));
  const approvalPausedRunIdByAgentRef = useRef<Map<string, string>>(new Map());

  const agents = state.agents;
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const filteredAgents = useMemo(
    () => getFilteredAgents(state, focusFilter),
    [focusFilter, state]
  );
  const focusedAgent = useMemo(() => {
    if (filteredAgents.length === 0) return null;
    const selectedInFilter = selectedAgent
      ? filteredAgents.find((entry) => entry.agentId === selectedAgent.agentId)
      : null;
    return selectedInFilter ?? filteredAgents[0] ?? null;
  }, [filteredAgents, selectedAgent]);
  const avatarCreatorAgent = useMemo(
    () =>
      avatarCreatorAgentId
        ? state.agents.find((entry) => entry.agentId === avatarCreatorAgentId) ?? null
        : null,
    [avatarCreatorAgentId, state.agents]
  );
  const focusedAgentId = focusedAgent?.agentId ?? null;
  const focusedAgentRunning = focusedAgent?.status === "running";
  const focusedAgentStopDisabledReason = useMemo(() => {
    if (!focusedAgent) return null;
    if (focusedAgent.status !== "running") return null;
    const lastMessage = focusedAgent.lastUserMessage?.trim() ?? "";
    if (!lastMessage || !isHeartbeatPrompt(lastMessage)) return null;
    return "This task is running as an automatic heartbeat check. Stopping heartbeat runs from Studio isn't available yet (coming soon).";
  }, [focusedAgent]);
  const inspectSidebarAgentId = inspectSidebar?.agentId ?? null;
  const inspectSidebarTab = inspectSidebar?.tab ?? null;
  const effectiveSettingsTab: SettingsRouteTab = inspectSidebarTab ?? "personality";
  useEffect(() => {
    setSettingsSidebarItem(effectiveSettingsTab);
  }, [effectiveSettingsTab]);
  const inspectSidebarAgent = useMemo(() => {
    if (!inspectSidebarAgentId) return null;
    return agents.find((entry) => entry.agentId === inspectSidebarAgentId) ?? null;
  }, [agents, inspectSidebarAgentId]);
  useEffect(() => {
    setSystemInitialSkillKey(null);
  }, [inspectSidebarAgentId]);
  useEffect(() => {
    if (effectiveSettingsTab !== "system") {
      setSystemInitialSkillKey(null);
    }
  }, [effectiveSettingsTab]);
  const settingsAgentPermissionsDraft = useMemo(() => {
    if (!inspectSidebarAgent) return null;
    const baseConfig =
      gatewayConfigSnapshot?.config &&
      typeof gatewayConfigSnapshot.config === "object" &&
      !Array.isArray(gatewayConfigSnapshot.config)
        ? (gatewayConfigSnapshot.config as Record<string, unknown>)
        : undefined;
    const list = readConfigAgentList(baseConfig);
    const configEntry = list.find((entry) => entry.id === inspectSidebarAgent.agentId) ?? null;
    const toolsRaw =
      configEntry && typeof (configEntry as Record<string, unknown>).tools === "object"
        ? ((configEntry as Record<string, unknown>).tools as unknown)
        : null;
    const tools =
      toolsRaw && typeof toolsRaw === "object" && !Array.isArray(toolsRaw)
        ? (toolsRaw as Record<string, unknown>)
        : null;
    return resolveAgentPermissionsDraft({
      agent: inspectSidebarAgent,
      existingTools: tools,
    });
  }, [gatewayConfigSnapshot, inspectSidebarAgent]);
  const settingsAgentSkillsAllowlist = useMemo(() => {
    if (!inspectSidebarAgent) return undefined;
    const baseConfig =
      gatewayConfigSnapshot?.config &&
      typeof gatewayConfigSnapshot.config === "object" &&
      !Array.isArray(gatewayConfigSnapshot.config)
        ? (gatewayConfigSnapshot.config as Record<string, unknown>)
        : undefined;
    const list = readConfigAgentList(baseConfig);
    const configEntry = list.find((entry) => entry.id === inspectSidebarAgent.agentId) ?? null;
    const raw = configEntry?.skills;
    if (!Array.isArray(raw)) return undefined;
    return raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, [gatewayConfigSnapshot, inspectSidebarAgent]);
  const settingsDefaultAgentId = useMemo(() => {
    const baseConfig =
      gatewayConfigSnapshot?.config &&
      typeof gatewayConfigSnapshot.config === "object" &&
      !Array.isArray(gatewayConfigSnapshot.config)
        ? (gatewayConfigSnapshot.config as Record<string, unknown>)
        : undefined;
    return resolveDefaultConfigAgentId(baseConfig);
  }, [gatewayConfigSnapshot]);
  const settingsSkillScopeWarning = useMemo(() => {
    if (!inspectSidebarAgent) return null;
    if (inspectSidebarAgent.agentId === settingsDefaultAgentId) {
      return "Setup actions are shared across agents. Installs run in this shared workspace.";
    }
    return `Setup actions are shared across agents. Installs currently run in ${settingsDefaultAgentId} (shared workspace), not ${inspectSidebarAgent.agentId}.`;
  }, [inspectSidebarAgent, settingsDefaultAgentId]);
  const focusedPendingExecApprovals = useMemo(() => {
    if (!focusedAgentId) return unscopedPendingExecApprovals;
    const scoped = pendingExecApprovalsByAgentId[focusedAgentId] ?? [];
    return mergePendingApprovalsForFocusedAgent({
      scopedApprovals: scoped,
      unscopedApprovals: unscopedPendingExecApprovals,
    });
  }, [focusedAgentId, pendingExecApprovalsByAgentId, unscopedPendingExecApprovals]);
  const suggestedCreateAgentName = useMemo(() => {
    try {
      return resolveNextNewAgentName(state.agents);
    } catch {
      return "New Agent";
    }
  }, [state.agents]);
  const faviconSeed = useMemo(() => {
    const firstAgent = agents[0];
    const seed = firstAgent?.avatarSeed ?? firstAgent?.agentId ?? "";
    return seed.trim() || null;
  }, [agents]);
  const faviconHref = useMemo(
    () => (faviconSeed ? buildAvatarDataUrl(faviconSeed) : null),
    [faviconSeed]
  );
  const errorMessage = state.error ?? gatewayModelsError;
  const runningAgentCount = useMemo(
    () => agents.filter((agent) => agent.status === "running").length,
    [agents]
  );
  const hasRunningAgents = runningAgentCount > 0;
  const isLocalGateway = useMemo(() => isLocalGatewayUrl(gatewayUrl), [gatewayUrl]);
  const controlUiUrl = useMemo(
    () => resolveControlUiUrl({ gatewayUrl, configSnapshot: gatewayConfigSnapshot }),
    [gatewayConfigSnapshot, gatewayUrl]
  );
  const settingsHeaderModel = (inspectSidebarAgent?.model ?? "").trim() || "Default";
  const settingsHeaderThinkingRaw = (inspectSidebarAgent?.thinkingLevel ?? "").trim() || "low";
  const settingsHeaderThinking =
    settingsHeaderThinkingRaw.charAt(0).toUpperCase() + settingsHeaderThinkingRaw.slice(1);
  const activeSettingsSidebarItem: SettingsSidebarItem = settingsSidebarItem;
  const settingsSidebarEntries = useMemo(
    () => resolveSettingsSidebarEntries(runtimeSupportsCron),
    [runtimeSupportsCron]
  );

  useEffect(() => {
    const selector = 'link[data-agent-favicon="true"]';
    const existing = document.querySelector(selector) as HTMLLinkElement | null;
    if (!faviconHref) {
      existing?.remove();
      return;
    }
    if (existing) {
      if (existing.href !== faviconHref) {
        existing.href = faviconHref;
      }
      return;
    }
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = faviconHref;
    link.setAttribute("data-agent-favicon", "true");
    document.head.appendChild(link);
  }, [faviconHref]);

  const resolveCronJobForAgent = useCallback((jobs: CronJobSummary[], agentId: string) => {
    return resolveLatestCronJobForAgent(jobs, agentId);
  }, []);

  const specialLatestUpdate = useMemo(() => {
    return createSpecialLatestUpdateOperation({
      callGateway: (method, params) => client.call(method, params),
      listCronJobs: () =>
        runtimeSupportsCron
          ? listCronJobs(client, { includeDisabled: true })
          : Promise.resolve({ jobs: [] }),
      resolveCronJobForAgent,
      formatCronJobDisplay,
      dispatchUpdateAgent: (agentId, patch) => {
        dispatch({ type: "updateAgent", agentId, patch });
      },
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logError: (message) => console.error(message),
    });
  }, [client, dispatch, resolveCronJobForAgent, runtimeSupportsCron]);

  const refreshHeartbeatLatestUpdate = useCallback(() => {
    const agents = stateRef.current.agents;
    specialLatestUpdate.refreshHeartbeat(agents);
  }, [specialLatestUpdate]);

  const loadStudioSettings = useCallback(
    () => settingsCoordinator.loadSettings(),
    [settingsCoordinator],
  );

  const loadFocusedStudioSettings = useCallback(
    () => settingsCoordinator.loadSettings({ maxAgeMs: 30_000 }),
    [settingsCoordinator],
  );

  const loadAgents = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      const commands = await runStudioBootstrapLoadOperation({
        client: provider,
        gatewayUrl,
        cachedConfigSnapshot: gatewayConfigSnapshot,
        loadStudioSettings,
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        preferredSelectedAgentId: preferredSelectedAgentIdRef.current,
        hasCurrentSelection: Boolean(stateRef.current.selectedAgentId),
        logError: (message, error) => console.error(message, error),
      });
      executeStudioBootstrapLoadCommands({
        commands,
        setGatewayConfigSnapshot,
        hydrateAgents,
        dispatchUpdateAgent: (agentId, patch) => {
          dispatch({ type: "updateAgent", agentId, patch });
        },
        setError,
      });
    } finally {
      setLoading(false);
      setAgentsLoadedOnce(true);
    }
  }, [
    client,
    provider,
    dispatch,
    hydrateAgents,
    setError,
    setLoading,
    gatewayUrl,
    gatewayConfigSnapshot,
    loadStudioSettings,
    status,
  ]);

  const enqueueConfigMutationFromRef = useCallback(
    (mutation: { kind: ConfigMutationKind; label: string; run: () => Promise<void> }) => {
      return enqueueConfigMutationRef.current(mutation);
    },
    []
  );

  const { refreshGatewayConfigSnapshot } = useGatewayConfigSyncController({
    client,
    status,
    enabled: runtimeSupportsConfig && runtimeSupportsModels,
    settingsRouteActive,
    inspectSidebarAgentId,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    setGatewayModels,
    setGatewayModelsError,
    enqueueConfigMutation: enqueueConfigMutationFromRef,
    loadAgents,
    isDisconnectLikeError: isGatewayDisconnectLikeError,
  });

  const settingsMutationController = useAgentSettingsMutationController({
    client,
    status,
    runtimeSupportsCron,
    isLocalGateway,
    agents,
    hasCreateBlock: Boolean(createAgentBlock),
    enqueueConfigMutation: enqueueConfigMutationFromRef,
    gatewayConfigSnapshot,
    settingsRouteActive,
    inspectSidebarAgentId,
    inspectSidebarTab,
    loadAgents,
    refreshGatewayConfigSnapshot,
    clearInspectSidebar: () => {
      setInspectSidebar(null);
    },
    setInspectSidebarCapabilities: (agentId) => {
      setInspectSidebar((current) => {
        if (current?.agentId === agentId) return current;
        return { agentId, tab: "capabilities" };
      });
    },
    dispatchUpdateAgent: (agentId, patch) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch,
      });
    },
    removeAgent: (agentId) => {
      dispatch({
        type: "removeAgent",
        agentId,
      });
    },
    setMobilePaneChat: () => {
      setMobilePane("chat");
    },
    setError,
  });

  const hasRenameMutationBlock = settingsMutationController.hasRenameMutationBlock;
  const hasDeleteMutationBlock = settingsMutationController.hasDeleteMutationBlock;
  const restartingMutationBlock = settingsMutationController.restartingMutationBlock;
  const hasRestartBlockInProgress = Boolean(
    settingsMutationController.hasRestartBlockInProgress ||
      (createAgentBlock && createAgentBlock.phase !== "queued")
  );

  const {
    enqueueConfigMutation,
    queuedCount: queuedConfigMutationCount,
    queuedBlockedByRunningAgents,
    activeConfigMutation,
  } = useConfigMutationQueue({
    status,
    hasRunningAgents,
    hasRestartBlockInProgress,
  });
  enqueueConfigMutationRef.current = enqueueConfigMutation;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    pendingExecApprovalsByAgentIdRef.current = pendingExecApprovalsByAgentId;
  }, [pendingExecApprovalsByAgentId]);

  useEffect(() => {
    unscopedPendingExecApprovalsRef.current = unscopedPendingExecApprovals;
  }, [unscopedPendingExecApprovals]);

  useEffect(() => {
    if (status === "connected") return;
    setAgentsLoadedOnce(false);
  }, [gatewayUrl, status]);

  useEffect(() => {
    let cancelled = false;
    const key = gatewayUrl.trim();
    if (!key) {
      preferredSelectedAgentIdRef.current = null;
      setFocusedPreferencesLoaded(true);
      return;
    }
    setFocusedPreferencesLoaded(false);
    focusFilterTouchedRef.current = false;
    preferredSelectedAgentIdRef.current = null;
    const loadFocusedPreferences = async () => {
      const commands = await runStudioFocusedPreferenceLoadOperation({
        gatewayUrl,
        loadStudioSettings: loadFocusedStudioSettings,
        isFocusFilterTouched: () => focusFilterTouchedRef.current,
      });
      if (cancelled) return;
      executeStudioFocusedPreferenceLoadCommands({
        commands,
        setFocusedPreferencesLoaded,
        setPreferredSelectedAgentId: (agentId) => {
          preferredSelectedAgentIdRef.current = agentId;
        },
        setFocusFilter,
        logError: (message, error) => console.error(message, error),
      });
    };
    void loadFocusedPreferences();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, loadFocusedStudioSettings]);

  useEffect(() => {
    return () => {
      void settingsCoordinator.flushPending();
    };
  }, [settingsCoordinator]);

  useEffect(() => {
    const commands = runStudioFocusFilterPersistenceOperation({
      gatewayUrl,
      focusFilterTouched: focusFilterTouchedRef.current,
      focusFilter,
    });
    executeStudioFocusedPatchCommands({
      commands,
      schedulePatch: settingsCoordinator.schedulePatch.bind(settingsCoordinator),
    });
  }, [focusFilter, gatewayUrl, settingsCoordinator]);

  useEffect(() => {
    const commands = runStudioFocusedSelectionPersistenceOperation({
      gatewayUrl,
      status,
      focusedPreferencesLoaded,
      agentsLoadedOnce,
      selectedAgentId: state.selectedAgentId,
    });
    executeStudioFocusedPatchCommands({
      commands,
      schedulePatch: settingsCoordinator.schedulePatch.bind(settingsCoordinator),
    });
  }, [
    agentsLoadedOnce,
    focusedPreferencesLoaded,
    gatewayUrl,
    settingsCoordinator,
    status,
    state.selectedAgentId,
  ]);

  useEffect(() => {
    if (status !== "connected" || !focusedPreferencesLoaded) return;
    if (restartingMutationBlock && restartingMutationBlock.phase !== "queued") return;
    if (createAgentBlock && createAgentBlock.phase !== "queued") return;
    void loadAgents();
  }, [
    createAgentBlock,
    focusedPreferencesLoaded,
    gatewayUrl,
    loadAgents,
    restartingMutationBlock,
    status,
  ]);

  useEffect(() => {
    if (status === "disconnected") {
      setLoading(false);
    }
  }, [setLoading, status]);

  useEffect(() => {
    const nowMs = Date.now();
    const delayMs = planPendingPruneDelay({
      pendingState: {
        approvalsByAgentId: pendingExecApprovalsByAgentId,
        unscopedApprovals: unscopedPendingExecApprovals,
      },
      nowMs,
      graceMs: PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS,
    });
    if (delayMs === null) return;
    const timerId = window.setTimeout(() => {
      const pendingState = planPrunedPendingState({
        pendingState: {
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        },
        nowMs: Date.now(),
        graceMs: PENDING_EXEC_APPROVAL_PRUNE_GRACE_MS,
      });
      pendingExecApprovalsByAgentIdRef.current = pendingState.approvalsByAgentId;
      unscopedPendingExecApprovalsRef.current = pendingState.unscopedApprovals;
      setPendingExecApprovalsByAgentId(pendingState.approvalsByAgentId);
      setUnscopedPendingExecApprovals(pendingState.unscopedApprovals);
    }, delayMs);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [pendingExecApprovalsByAgentId, unscopedPendingExecApprovals]);

  useEffect(() => {
    const patches = planAwaitingUserInputPatches({
      agents,
      approvalsByAgentId: pendingExecApprovalsByAgentId,
    });
    for (const patch of patches) {
      dispatch({
        type: "updateAgent",
        agentId: patch.agentId,
        patch: { awaitingUserInput: patch.awaitingUserInput },
      });
    }
  }, [agents, dispatch, pendingExecApprovalsByAgentId]);

  useEffect(() => {
    for (const agent of agents) {
      const lastMessage = agent.lastUserMessage?.trim() ?? "";
      const kind = resolveLatestUpdateKind(lastMessage);
      const key = agent.agentId;
      const marker = kind === "heartbeat" ? `${lastMessage}:${heartbeatTick}` : lastMessage;
      const previous = specialUpdateRef.current.get(key);
      if (previous === marker) continue;
      specialUpdateRef.current.set(key, marker);
      void specialLatestUpdate.update(agent.agentId, agent, lastMessage);
    }
  }, [agents, heartbeatTick, specialLatestUpdate]);

  const {
    loadSummarySnapshot,
    loadAgentHistory,
    loadMoreAgentHistory,
    clearHistoryInFlight,
  } = useRuntimeSyncController({
    client: provider,
    status,
    agents,
    focusedAgentId,
    focusedAgentRunning,
    dispatch,
    clearRunTracking: (runId) => {
      runtimeEventHandlerRef.current?.clearRunTracking(runId);
    },
    isDisconnectLikeError: isGatewayDisconnectLikeError,
  });

  const {
    stopBusyAgentId,
    flushPendingDraft,
    handleDraftChange,
    handleSend,
    removeQueuedMessage,
    handleNewSession,
    handleStopRun,
    queueLivePatch,
    clearPendingLivePatch,
  } = useChatInteractionController({
    client: provider,
    status,
    agents,
    dispatch,
    setError,
    getAgents: () => stateRef.current.agents,
    clearRunTracking: (runId) => {
      runtimeEventHandlerRef.current?.clearRunTracking(runId);
    },
    clearHistoryInFlight,
    clearSpecialUpdateMarker: (agentId) => {
      specialUpdateRef.current.delete(agentId);
    },
    clearSpecialLatestUpdateInFlight: (agentId) => {
      specialLatestUpdate.clearInFlight(agentId);
    },
    setInspectSidebarNull: () => {
      setInspectSidebar(null);
    },
    setMobilePaneChat: () => {
      setMobilePane("chat");
    },
  });
  useFinalizedAssistantReplyListener(state.agents, ({ text }) => {
    if (!voiceRepliesLoaded || !voiceRepliesEnabled) return;
    enqueueVoiceReply({
      text,
      provider: voiceRepliesPreference.provider,
      voiceId: voiceRepliesPreference.voiceId,
    });
  });
  const handleChatSend = useCallback(
    async (agentId: string, sessionKey: string, message: string) => {
      stopVoiceReplyPlayback();
      await handleSend(agentId, sessionKey, message);
    },
    [handleSend, stopVoiceReplyPlayback]
  );

  const handleFocusFilterChange = useCallback(
    (next: FocusFilter) => {
      flushPendingDraft(focusedAgent?.agentId ?? null);
      focusFilterTouchedRef.current = true;
      setFocusFilter(next);
    },
    [flushPendingDraft, focusedAgent]
  );

  const {
    handleBackToChat,
    handleSettingsRouteTabChange,
    handleOpenAgentSettingsRoute,
    handleFleetSelectAgent,
  } = useSettingsRouteController({
    settingsRouteActive,
    settingsRouteAgentId,
    status,
    agentsLoadedOnce,
    selectedAgentId: state.selectedAgentId,
    focusedAgentId: focusedAgent?.agentId ?? null,
    personalityHasUnsavedChanges,
    activeTab: effectiveSettingsTab,
    inspectSidebar,
    agents,
    flushPendingDraft,
    dispatchSelectAgent: (agentId) => {
      dispatch({ type: "selectAgent", agentId });
    },
    setInspectSidebar,
    setMobilePaneChat: () => {
      setMobilePane("chat");
    },
    setPersonalityHasUnsavedChanges,
    push: router.push,
    replace: router.replace,
    confirmDiscard: () => window.confirm("Discard changes?"),
  });
  const handleOpenSystemSkillSetup = useCallback(
    (skillKey?: string) => {
      const normalized = skillKey?.trim() ?? "";
      setSystemInitialSkillKey(normalized.length > 0 ? normalized : null);
      setSettingsSidebarItem("system");
      handleSettingsRouteTabChange("system");
    },
    [handleSettingsRouteTabChange]
  );

  const handleOpenCreateAgentModal = useCallback(() => {
    if (createAgentBusy) return;
    if (createAgentBlock) return;
    if (restartingMutationBlock) return;
    setCreateAgentModalError(null);
    setCreateAgentModalOpen(true);
  }, [createAgentBlock, createAgentBusy, restartingMutationBlock]);

  const persistAvatarProfile = useCallback(
    (agentId: string, profile: AgentAvatarProfile) => {
      const resolvedAgentId = agentId.trim();
      const key = gatewayUrl.trim();
      if (!resolvedAgentId || !key) return;
      settingsCoordinator.schedulePatch(
        {
          avatars: {
            [key]: {
              [resolvedAgentId]: profile,
            },
          },
        },
        0
      );
    },
    [gatewayUrl, settingsCoordinator]
  );

  const handleCreateAgentSubmit = useCallback(
    async (payload: AgentCreateModalSubmitPayload) => {
      await runCreateAgentMutationLifecycle(
        {
          payload,
          status,
          hasCreateBlock: Boolean(createAgentBlock),
          hasRenameBlock: hasRenameMutationBlock,
          hasDeleteBlock: hasDeleteMutationBlock,
          createAgentBusy,
        },
        {
          enqueueConfigMutation,
          createAgent: async (name, avatarSeed) => {
            const created = await createGatewayAgent({ client, name });
            if (avatarSeed) {
              persistAvatarProfile(
                created.id,
                createDefaultAgentAvatarProfile(avatarSeed)
              );
            }
            flushPendingDraft(focusedAgent?.agentId ?? null);
            focusFilterTouchedRef.current = true;
            setFocusFilter("all");
            dispatch({ type: "selectAgent", agentId: created.id });
            return { id: created.id };
          },
          setQueuedBlock: ({ agentName, startedAt }) => {
            const queuedCreateBlock = buildQueuedMutationBlock({
              kind: "create-agent",
              agentId: "",
              agentName,
              startedAt,
            });
            setCreateAgentBlock({
              agentName: queuedCreateBlock.agentName,
              phase: "queued",
              startedAt: queuedCreateBlock.startedAt,
            });
          },
          setCreatingBlock: (agentName) => {
            setCreateAgentBlock((current) => {
              if (!current || current.agentName !== agentName) return current;
              return { ...current, phase: "creating" };
            });
          },
          onCompletion: async (completion) => {
            const commands = await runCreateAgentBootstrapOperation({
              completion,
              focusedAgentId: focusedAgent?.agentId ?? null,
              loadAgents,
              findAgentById: (agentId) =>
                stateRef.current.agents.find((entry) => entry.agentId === agentId) ?? null,
              applyDefaultPermissions: async ({ agentId, sessionKey }) => {
                await applyCreateAgentBootstrapPermissions({
                  client,
                  agentId,
                  sessionKey,
                  draft: { ...CREATE_AGENT_DEFAULT_PERMISSIONS },
                  loadAgents,
                });
              },
              refreshGatewayConfigSnapshot,
            });
            executeCreateAgentBootstrapCommands({
              commands,
              setCreateAgentModalError,
              setGlobalError: setError,
              setCreateAgentBlock: (value) => {
                setCreateAgentBlock(value);
              },
              setCreateAgentModalOpen,
              flushPendingDraft,
              selectAgent: (agentId) => {
                dispatch({ type: "selectAgent", agentId });
              },
              setInspectSidebarCapabilities: (agentId) => {
                setInspectSidebar({ agentId, tab: "capabilities" });
              },
              setMobilePaneChat: () => {
                setMobilePane("chat");
              },
            });
          },
          setCreateAgentModalError,
          setCreateAgentBusy,
          clearCreateBlock: () => {
            setCreateAgentBlock(null);
          },
          onError: setError,
        }
      );
    },
    [
      client,
      createAgentBusy,
      createAgentBlock,
      dispatch,
      enqueueConfigMutation,
      flushPendingDraft,
      focusedAgent,
      hasDeleteMutationBlock,
      hasRenameMutationBlock,
      loadAgents,
      persistAvatarProfile,
      refreshGatewayConfigSnapshot,
      setError,
      status,
    ]
  );

  useEffect(() => {
    if (!createAgentBlock || createAgentBlock.phase === "queued") return;
    const maxWaitMs = 90_000;
    const timeoutNow = isCreateBlockTimedOut({
      block: createAgentBlock,
      nowMs: Date.now(),
      maxWaitMs,
    });
    const handleTimeout = () => {
      setCreateAgentBlock(null);
      setCreateAgentModalOpen(false);
      void loadAgents();
      setError("Agent creation timed out.");
    };
    if (timeoutNow) {
      handleTimeout();
      return;
    }
    const elapsed = Date.now() - createAgentBlock.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      if (
        !isCreateBlockTimedOut({
          block: createAgentBlock,
          nowMs: Date.now(),
          maxWaitMs,
        })
      ) {
        return;
      }
      handleTimeout();
    }, remaining);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createAgentBlock, loadAgents, setError]);

  const handleSessionSettingChange = useCallback(
    async (
      agentId: string,
      sessionKey: string,
      field: "model" | "thinkingLevel",
      value: string | null
    ) => {
      await applySessionSettingMutation({
        agents: stateRef.current.agents,
        dispatch,
        client,
        agentId,
        sessionKey,
        field,
        value,
      });
    },
    [client, dispatch]
  );

  const handleModelChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "model", value);
    },
    [handleSessionSettingChange]
  );

  const handleThinkingChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "thinkingLevel", value);
    },
    [handleSessionSettingChange]
  );

  const handleToolCallingToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { toolCallingEnabled: enabled },
      });
    },
    [dispatch]
  );

  const handleThinkingTracesToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { showThinkingTraces: enabled },
      });
    },
    [dispatch]
  );

  const handleResolveExecApproval = useCallback(
    async (approvalId: string, decision: ExecApprovalDecision) => {
      await runResolveExecApprovalOperation({
        client,
        approvalId,
        decision,
        getAgents: () => stateRef.current.agents,
        getPendingState: () => ({
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        }),
        setPendingExecApprovalsByAgentId: (next) => {
          setPendingExecApprovalsByAgentId((current) => {
            const resolved = typeof next === "function" ? next(current) : next;
            pendingExecApprovalsByAgentIdRef.current = resolved;
            return resolved;
          });
        },
        setUnscopedPendingExecApprovals: (next) => {
          setUnscopedPendingExecApprovals((current) => {
            const resolved = typeof next === "function" ? next(current) : next;
            unscopedPendingExecApprovalsRef.current = resolved;
            return resolved;
          });
        },
        requestHistoryRefresh: (agentId) => loadAgentHistory(agentId),
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        dispatch,
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logWarn: (message, error) => console.warn(message, error),
        clearRunTracking: (runId) => runtimeEventHandlerRef.current?.clearRunTracking(runId),
      });
    },
    [client, dispatch, loadAgentHistory]
  );

  const pauseRunForExecApproval = useCallback(
    async (approval: PendingExecApproval, preferredAgentId?: string | null) => {
      await runPauseRunForExecApprovalOperation({
        status,
        client,
        approval,
        preferredAgentId: preferredAgentId ?? null,
        getAgents: () => stateRef.current.agents,
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logWarn: (message, error) => console.warn(message, error),
      });
    },
    [client, status]
  );

  const handleGatewayEventIngress = useCallback(
    (event: EventFrame) => {
      runGatewayEventIngressOperation({
        event,
        getAgents: () => stateRef.current.agents,
        getPendingState: () => ({
          approvalsByAgentId: pendingExecApprovalsByAgentIdRef.current,
          unscopedApprovals: unscopedPendingExecApprovalsRef.current,
        }),
        pausedRunIdByAgentId: approvalPausedRunIdByAgentRef.current,
        seenCronDedupeKeys: seenCronEventIdsRef.current,
        nowMs: Date.now(),
        replacePendingState: (pendingState) => {
          if (
            pendingState.approvalsByAgentId !==
            pendingExecApprovalsByAgentIdRef.current
          ) {
            pendingExecApprovalsByAgentIdRef.current =
              pendingState.approvalsByAgentId;
            setPendingExecApprovalsByAgentId(pendingState.approvalsByAgentId);
          }
          if (
            pendingState.unscopedApprovals !==
            unscopedPendingExecApprovalsRef.current
          ) {
            unscopedPendingExecApprovalsRef.current =
              pendingState.unscopedApprovals;
            setUnscopedPendingExecApprovals(pendingState.unscopedApprovals);
          }
        },
        pauseRunForApproval: (approval, commandPreferredAgentId) =>
          pauseRunForExecApproval(approval, commandPreferredAgentId),
        dispatch,
        recordCronDedupeKey: (dedupeKey) => seenCronEventIdsRef.current.add(dedupeKey),
      });
    },
    [dispatch, pauseRunForExecApproval]
  );

  useEffect(() => {
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => status,
      getAgents: () => stateRef.current.agents,
      dispatch,
      queueLivePatch,
      clearPendingLivePatch,
      loadSummarySnapshot,
      requestHistoryRefresh: ({ agentId }) => loadAgentHistory(agentId),
      refreshHeartbeatLatestUpdate,
      bumpHeartbeatTick: () => setHeartbeatTick((prev) => prev + 1),
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logWarn: (message, meta) => console.warn(message, meta),
      shouldSuppressRunAbortedLine: ({ agentId, runId, stopReason }) => {
        if (stopReason !== "rpc") return false;
        const normalizedRunId = runId?.trim() ?? "";
        if (!normalizedRunId) return false;
        const pausedRunId = approvalPausedRunIdByAgentRef.current.get(agentId)?.trim() ?? "";
        return pausedRunId.length > 0 && pausedRunId === normalizedRunId;
      },
      updateSpecialLatestUpdate: (agentId, agent, message) => {
        void specialLatestUpdate.update(agentId, agent, message);
      },
    });
    runtimeEventHandlerRef.current = handler;
    const unsubscribe = client.onEvent((event: EventFrame) => {
      handler.handleEvent(event);
      handleGatewayEventIngress(event);
    });
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
      unsubscribe();
    };
  }, [
    client,
    dispatch,
    loadAgentHistory,
    loadSummarySnapshot,
    clearPendingLivePatch,
    queueLivePatch,
    refreshHeartbeatLatestUpdate,
    specialLatestUpdate,
    handleGatewayEventIngress,
    status,
  ]);

  const handleAvatarShuffle = useCallback(
    (agentId: string, profile: AgentAvatarProfile) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { avatarProfile: profile, avatarSeed: profile.seed },
      });
      persistAvatarProfile(agentId, profile);
    },
    [dispatch, persistAvatarProfile]
  );

  const connectionPanelVisible = showConnectionPanel;
  const hasAnyAgents = agents.length > 0;
  const configMutationStatusLine = activeConfigMutation
    ? `Applying config change: ${activeConfigMutation.label}`
    : queuedConfigMutationCount > 0
      ? queuedBlockedByRunningAgents
        ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for ${runningAgentCount} running agent${runningAgentCount === 1 ? "" : "s"} to finish`
        : status !== "connected"
          ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for gateway connection`
          : `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}`
      : null;
  const createBlockStatusLine = createAgentBlock
    ? createAgentBlock.phase === "queued"
      ? "Waiting for active runs to finish"
      : createAgentBlock.phase === "creating"
      ? "Submitting config change"
      : null
    : null;
  const restartingMutationStatusLine = resolveConfigMutationStatusLine({
    block: restartingMutationBlock
      ? {
          phase: restartingMutationBlock.phase,
          sawDisconnect: restartingMutationBlock.sawDisconnect,
        }
      : null,
    status,
  });
  const restartingMutationModalTestId = restartingMutationBlock
    ? restartingMutationBlock.kind === "delete-agent"
      ? "agent-delete-restart-modal"
      : "agent-rename-restart-modal"
    : null;
  const restartingMutationAriaLabel = restartingMutationBlock
    ? restartingMutationBlock.kind === "delete-agent"
      ? "Deleting agent and restarting gateway"
      : "Renaming agent and restarting gateway"
    : null;
  const restartingMutationHeading = restartingMutationBlock
    ? restartingMutationBlock.kind === "delete-agent"
      ? "Agent delete in progress"
      : "Agent rename in progress"
    : null;

  useEffect(() => {
    if (status === "connecting") {
      setDidAttemptGatewayConnect(true);
    }
  }, [status]);

  useEffect(() => {
    if (gatewayError) {
      setDidAttemptGatewayConnect(true);
    }
  }, [gatewayError]);

  if (
    !connectionPanelVisible &&
    !agentsLoadedOnce &&
    (!connectPromptReady ||
      (gatewayUrl.trim().length > 0 &&
        !shouldPromptForConnect &&
        token.trim().length > 0 &&
        (!didAttemptGatewayConnect || status === "connecting")))
  ) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-background">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel ui-panel w-full max-w-md px-6 py-6 text-center">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Claw3D
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {status === "connecting" ? "Connecting to gateway…" : "Booting Studio…"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    connectPromptReady &&
    status !== "connected" &&
    !agentsLoadedOnce &&
    (shouldPromptForConnect || didAttemptGatewayConnect)
  ) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-background">
        <div className="relative z-10 flex h-full flex-col">
          <HeaderBar
            status={status}
            onConnectionSettings={() => setShowConnectionPanel(true)}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-6 md:pb-6 md:pt-4">
            {settingsRouteActive ? (
              <div className="w-full">
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em]"
                  onClick={handleBackToChat}
                >
                  Back to chat
                </button>
              </div>
            ) : null}
            {connectionPanelVisible ? (
              <div className="mx-auto w-full max-w-4xl">
                <div className="glass-panel w-full !bg-card px-4 py-4 sm:px-6 sm:py-6">
                  <ConnectionPanel
                    gatewayUrl={gatewayUrl}
                    token={token}
                    selectedAdapterType={selectedAdapterType}
                    activeAdapterType={activeAdapterType}
                    localGatewayUrl={localGatewayDefaults?.url ?? null}
                    localGatewayToken={localGatewayDefaults?.token ?? null}
                    status={status}
                    error={gatewayError}
                    onGatewayUrlChange={setGatewayUrl}
                    onTokenChange={setToken}
                    onAdapterTypeChange={setSelectedAdapterType}
                    onConnect={() => void connect()}
                    onDisconnect={disconnect}
                    onClose={() => setShowConnectionPanel(false)}
                  />
                </div>
              </div>
            ) : (
              <GatewayConnectScreen
                gatewayUrl={gatewayUrl}
                token={token}
                selectedAdapterType={selectedAdapterType}
                activeAdapterType={activeAdapterType}
                localGatewayDefaults={localGatewayDefaults}
                status={status}
                error={gatewayError}
                showApprovalHint={didAttemptGatewayConnect}
                onGatewayUrlChange={setGatewayUrl}
                onTokenChange={setToken}
                onAdapterTypeChange={setSelectedAdapterType}
                onUseLocalDefaults={useLocalGatewayDefaults}
                onConnect={() => void connect()}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "connected" && !agentsLoadedOnce) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-background">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="glass-panel ui-panel w-full max-w-md px-6 py-6 text-center">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Claw3D
            </div>
            <div className="mt-3 text-sm text-muted-foreground">Loading agents…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="glass-panel ui-card px-6 py-3 font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative z-10 flex h-full flex-col">
        <HeaderBar
          status={status}
          onConnectionSettings={() => setShowConnectionPanel(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 md:px-5 md:pb-5 md:pt-3">
          {connectionPanelVisible ? (
            <div className="pointer-events-none fixed inset-x-0 top-12 z-[140] flex justify-center px-3 sm:px-4 md:px-5">
              <div className="glass-panel pointer-events-auto w-full max-w-4xl !bg-card px-4 py-4 sm:px-6 sm:py-6">
                <ConnectionPanel
                  gatewayUrl={gatewayUrl}
                  token={token}
                  selectedAdapterType={selectedAdapterType}
                  activeAdapterType={activeAdapterType}
                  localGatewayUrl={localGatewayDefaults?.url ?? null}
                  localGatewayToken={localGatewayDefaults?.token ?? null}
                  status={status}
                  error={gatewayError}
                  onGatewayUrlChange={setGatewayUrl}
                  onTokenChange={setToken}
                  onAdapterTypeChange={setSelectedAdapterType}
                  onConnect={() => void connect()}
                  onDisconnect={disconnect}
                  onClose={() => setShowConnectionPanel(false)}
                />
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="w-full">
              <div className="ui-alert-danger rounded-md px-4 py-2 text-sm">
                {errorMessage}
              </div>
            </div>
          ) : null}
          {configMutationStatusLine ? (
            <div className="w-full">
              <div className="ui-card px-4 py-2 font-mono text-[11px] tracking-[0.07em] text-muted-foreground">
                {configMutationStatusLine}
              </div>
            </div>
          ) : null}

          {settingsRouteActive ? (
            <div
              className="ui-panel ui-depth-workspace flex min-h-0 flex-1 overflow-hidden"
              data-testid="agent-settings-route-panel"
            >
              <aside className="w-[240px] shrink-0 border-r border-border/60">
                <div className="border-b border-border/60 px-4 py-3">
                  <button
                    type="button"
                    className="ui-btn-secondary w-full px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em]"
                    onClick={handleBackToChat}
                  >
                    Back to chat
                  </button>
                </div>
                <nav className="py-3">
                  {settingsSidebarEntries.map((entry) => {
                    const active = activeSettingsSidebarItem === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`relative w-full px-5 py-3 text-left text-sm transition ${
                          active
                            ? "bg-surface-2/55 font-medium text-foreground"
                            : "font-normal text-muted-foreground hover:bg-surface-2/35 hover:text-foreground"
                        }`}
                        onClick={() => {
                          setSettingsSidebarItem(entry.id);
                          handleSettingsRouteTabChange(entry.id);
                        }}
                      >
                        {active ? (
                          <span
                            className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                        {entry.label}
                      </button>
                    );
                  })}
                </nav>
              </aside>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex items-start justify-between border-b border-border/60 px-6 py-4">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {inspectSidebarAgent?.name ?? settingsRouteAgentId ?? "Agent settings"}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      Model: {settingsHeaderModel}{" "}
                      <span className="mx-2 text-border">|</span>
                      Thinking: {settingsHeaderThinking}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                    [{personalityHasUnsavedChanges ? "Unsaved" : "Saved ✓"}]
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {inspectSidebarAgent ? (
                    effectiveSettingsTab === "personality" ? (
                      <AgentBrainPanel
                        client={client}
                        agents={agents}
                        selectedAgentId={inspectSidebarAgent.agentId}
                        onUnsavedChangesChange={setPersonalityHasUnsavedChanges}
                        onRename={settingsMutationController.handleRenameAgent}
                      />
                    ) : (
                      <div className="h-full overflow-y-auto px-6 py-6">
                        <div className="mx-auto w-full max-w-[920px]">
                          <AgentSettingsPanel
                            key={`${inspectSidebarAgent.agentId}:${effectiveSettingsTab}`}
                            mode={
                              effectiveSettingsTab === "automations"
                                ? "automations"
                                : effectiveSettingsTab === "skills"
                                  ? "skills"
                                  : effectiveSettingsTab === "system"
                                    ? "system"
                                    : effectiveSettingsTab === "advanced"
                                      ? "advanced"
                                      : "capabilities"
                            }
                            showHeader={false}
                            agent={inspectSidebarAgent}
                            onClose={handleBackToChat}
                            permissionsDraft={settingsAgentPermissionsDraft ?? undefined}
                            onUpdateAgentPermissions={(draft) =>
                              settingsMutationController.handleUpdateAgentPermissions(
                                inspectSidebarAgent.agentId,
                                draft
                              )
                            }
                            onDelete={() =>
                              settingsMutationController.handleDeleteAgent(inspectSidebarAgent.agentId)
                            }
                            canDelete={inspectSidebarAgent.agentId !== RESERVED_MAIN_AGENT_ID}
                            onToolCallingToggle={(enabled) =>
                              handleToolCallingToggle(inspectSidebarAgent.agentId, enabled)
                            }
                            onThinkingTracesToggle={(enabled) =>
                              handleThinkingTracesToggle(inspectSidebarAgent.agentId, enabled)
                            }
                            skillsReport={settingsMutationController.settingsSkillsReport}
                            skillsLoading={settingsMutationController.settingsSkillsLoading}
                            skillsError={settingsMutationController.settingsSkillsError}
                            skillsBusy={settingsMutationController.settingsSkillsBusy}
                            skillsBusyKey={settingsMutationController.settingsSkillsBusyKey}
                            skillMessages={settingsMutationController.settingsSkillMessages}
                            skillApiKeyDrafts={settingsMutationController.settingsSkillApiKeyDrafts}
                            defaultAgentScopeWarning={settingsSkillScopeWarning}
                            systemInitialSkillKey={systemInitialSkillKey}
                            onSystemInitialSkillHandled={() => {
                              setSystemInitialSkillKey(null);
                            }}
                            skillsAllowlist={settingsAgentSkillsAllowlist}
                            onSetSkillEnabled={(skillName, enabled) =>
                              settingsMutationController.handleSetSkillEnabled(
                                inspectSidebarAgent.agentId,
                                skillName,
                                enabled
                              )
                            }
                            onOpenSystemSetup={handleOpenSystemSkillSetup}
                            onInstallSkill={(skillKey, name, installId) =>
                              settingsMutationController.handleInstallSkill(
                                inspectSidebarAgent.agentId,
                                skillKey,
                                name,
                                installId
                              )
                            }
                            onRemoveSkill={(skill) =>
                              settingsMutationController.handleRemoveSkill(
                                inspectSidebarAgent.agentId,
                                skill
                              )
                            }
                            onSkillApiKeyChange={(skillKey, value) =>
                              settingsMutationController.handleSkillApiKeyDraftChange(skillKey, value)
                            }
                            onSaveSkillApiKey={(skillKey) =>
                              settingsMutationController.handleSaveSkillApiKey(
                                inspectSidebarAgent.agentId,
                                skillKey
                              )
                            }
                            onSetSkillGlobalEnabled={(skillKey, enabled) =>
                              settingsMutationController.handleSetSkillGlobalEnabled(
                                inspectSidebarAgent.agentId,
                                skillKey,
                                enabled
                              )
                            }
                            cronJobs={settingsMutationController.settingsCronJobs}
                            cronLoading={settingsMutationController.settingsCronLoading}
                            cronError={settingsMutationController.settingsCronError}
                            cronCreateBusy={settingsMutationController.cronCreateBusy}
                            cronRunBusyJobId={settingsMutationController.cronRunBusyJobId}
                            cronDeleteBusyJobId={settingsMutationController.cronDeleteBusyJobId}
                            onCreateCronJob={(draft) =>
                              settingsMutationController.handleCreateCronJob(inspectSidebarAgent.agentId, draft)
                            }
                            onRunCronJob={(jobId) =>
                              settingsMutationController.handleRunCronJob(inspectSidebarAgent.agentId, jobId)
                            }
                            onDeleteCronJob={(jobId) =>
                              settingsMutationController.handleDeleteCronJob(inspectSidebarAgent.agentId, jobId)
                            }
                            controlUiUrl={selectedAdapterType === "openclaw" ? controlUiUrl : null}
                            adapterType={selectedAdapterType}
                          />
                        </div>
                      </div>
                    )
                  ) : (
                    <EmptyStatePanel
                      title="Agent not found."
                      description="Back to chat and select an available agent."
                      fillHeight
                      className="items-center p-6 text-center text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
              <div className="glass-panel ui-panel p-2 xl:hidden" data-testid="mobile-pane-toggle">
                <div className="ui-segment grid-cols-2">
                  <button
                    type="button"
                    className="ui-segment-item px-2 py-2 font-mono text-[12px] font-medium tracking-[0.02em]"
                    data-active={mobilePane === "fleet" ? "true" : "false"}
                    onClick={() => setMobilePane("fleet")}
                  >
                    Fleet
                  </button>
                  <button
                    type="button"
                    className="ui-segment-item px-2 py-2 font-mono text-[12px] font-medium tracking-[0.02em]"
                    data-active={mobilePane === "chat" ? "true" : "false"}
                    onClick={() => setMobilePane("chat")}
                  >
                    Chat
                  </button>
                </div>
              </div>
              <div
                className={`${mobilePane === "fleet" ? "block" : "hidden"} min-h-0 xl:block xl:min-h-0`}
              >
                <FleetSidebar
                  agents={filteredAgents}
                  selectedAgentId={focusedAgent?.agentId ?? state.selectedAgentId}
                  filter={focusFilter}
                  onFilterChange={handleFocusFilterChange}
                  onCreateAgent={() => {
                    handleOpenCreateAgentModal();
                  }}
                  createDisabled={status !== "connected" || createAgentBusy || state.loading}
                  createBusy={createAgentBusy}
                  onSelectAgent={handleFleetSelectAgent}
                />
              </div>
              <div
                className={`${mobilePane === "chat" ? "flex" : "hidden"} ui-panel ui-depth-workspace min-h-0 flex-1 overflow-hidden xl:flex`}
                data-testid="focused-agent-panel"
              >
                {focusedAgent ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1">
                      <AgentChatPanel
                        agent={focusedAgent}
                        isSelected={false}
                        canSend={status === "connected"}
                        models={gatewayModels}
                        stopBusy={stopBusyAgentId === focusedAgent.agentId}
                        stopDisabledReason={focusedAgentStopDisabledReason}
                        onLoadMoreHistory={() => loadMoreAgentHistory(focusedAgent.agentId)}
                        onOpenSettings={() => handleOpenAgentSettingsRoute(focusedAgent.agentId)}
                        onRename={(name) =>
                          settingsMutationController.handleRenameAgent(focusedAgent.agentId, name)
                        }
                        onNewSession={() => handleNewSession(focusedAgent.agentId)}
                        onModelChange={(value) =>
                          handleModelChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                        }
                        onThinkingChange={(value) =>
                          handleThinkingChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                        }
                        onToolCallingToggle={(enabled) =>
                          handleToolCallingToggle(focusedAgent.agentId, enabled)
                        }
                        onThinkingTracesToggle={(enabled) =>
                          handleThinkingTracesToggle(focusedAgent.agentId, enabled)
                        }
                        onDraftChange={(value) => handleDraftChange(focusedAgent.agentId, value)}
                        onSend={(message) =>
                          handleChatSend(
                            focusedAgent.agentId,
                            focusedAgent.sessionKey,
                            message
                          )
                        }
                        onRemoveQueuedMessage={(index) =>
                          removeQueuedMessage(focusedAgent.agentId, index)
                        }
                        onStopRun={() => handleStopRun(focusedAgent.agentId, focusedAgent.sessionKey)}
                        onAvatarShuffle={() => setAvatarCreatorAgentId(focusedAgent.agentId)}
                        pendingExecApprovals={focusedPendingExecApprovals}
                        onResolveExecApproval={(id, decision) => {
                          void handleResolveExecApproval(id, decision);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyStatePanel
                    title={hasAnyAgents ? "No agents match this filter." : "No agents available."}
                    description={
                      hasAnyAgents
                        ? undefined
                        : status === "connected"
                          ? "Use New Agent in the sidebar to add your first agent."
                          : "Connect to your gateway to load agents into the studio."
                    }
                    fillHeight
                    className="items-center p-6 text-center text-sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {createAgentModalOpen ? (
        <AgentCreateModal
          open={createAgentModalOpen}
          suggestedName={suggestedCreateAgentName}
          busy={createAgentBusy}
          submitError={createAgentModalError}
          onClose={() => {
            if (createAgentBusy) return;
            setCreateAgentModalError(null);
            setCreateAgentModalOpen(false);
          }}
          onSubmit={(payload) => {
            void handleCreateAgentSubmit(payload);
          }}
        />
      ) : null}
      {avatarCreatorAgent ? (
        <AgentAvatarCreatorModal
          open
          agentId={avatarCreatorAgent.agentId}
          agentName={avatarCreatorAgent.name}
          initialProfile={avatarCreatorAgent.avatarProfile}
          onClose={() => {
            setAvatarCreatorAgentId(null);
          }}
          onSave={(profile) => {
            handleAvatarShuffle(avatarCreatorAgent.agentId, profile);
          }}
        />
      ) : null}
      {createAgentBlock && createAgentBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
          data-testid="agent-create-restart-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Creating agent"
        >
          <div className="ui-panel w-full max-w-md p-6">
            <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
              Agent create in progress
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {createAgentBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until creation finishes.
            </div>
            {createBlockStatusLine ? (
              <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
                {createBlockStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {restartingMutationBlock && restartingMutationBlock.phase !== "queued" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
          data-testid={restartingMutationModalTestId ?? undefined}
          role="dialog"
          aria-modal="true"
          aria-label={restartingMutationAriaLabel ?? undefined}
        >
          <div className="ui-panel w-full max-w-md p-6">
            <div className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
              {restartingMutationHeading}
            </div>
            <div className="mt-2 text-base font-semibold text-foreground">
              {restartingMutationBlock.agentName}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Studio is temporarily locked until the gateway restarts.
            </div>
            {restartingMutationStatusLine ? (
              <div className="ui-card mt-4 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-foreground">
                {restartingMutationStatusLine}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AgentsPageScreen;
