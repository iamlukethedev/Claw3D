import { buildAgentMainSessionKey } from "@/lib/gateway/GatewayClient";
import { createDefaultAgentAvatarProfile } from "@/lib/avatars/profile";
import { resolveConfiguredModelKey, type GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import {
  resolveAgentAvatarProfile,
  resolveAgentAvatarSeed,
  type StudioSettings,
  type StudioSettingsPublic,
} from "@/lib/studio/settings";
import {
  buildSummarySnapshotPatches,
  type SummaryPreviewSnapshot,
  type SummarySnapshotAgent,
  type SummarySnapshotPatch,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import type { AgentStoreSeed } from "@/features/agents/state/store";

type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope?: string;
  agents: Array<{
    id: string;
    name?: string;
    role?: string;
    identity?: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  }>;
};

type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
};

type ExecHost = "sandbox" | "gateway" | "node";
type ExecSecurity = "deny" | "allowlist" | "full";
type ExecAsk = "off" | "on-miss" | "always";

type ExecApprovalsSnapshot = {
  file?: {
    agents?: Record<string, { security?: string | null; ask?: string | null }>;
  };
};

type ExecPolicyEntry = {
  security?: ExecSecurity;
  ask?: ExecAsk;
};

type SandboxMode = "off" | "non-main" | "all";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const resolveAgentSandboxMode = (
  agentId: string,
  snapshot: GatewayModelPolicySnapshot | null
): SandboxMode | null => {
  const resolvedAgentId = agentId.trim();
  if (!resolvedAgentId) return null;
  const configRaw = snapshot?.config as unknown;
  if (!isRecord(configRaw)) return null;
  const agents = isRecord(configRaw.agents) ? configRaw.agents : null;
  const list = Array.isArray(agents?.list) ? agents?.list : [];
  for (const entryRaw of list) {
    if (!isRecord(entryRaw)) continue;
    const id = typeof entryRaw.id === "string" ? entryRaw.id.trim() : "";
    if (!id || id !== resolvedAgentId) continue;
    const sandbox = isRecord(entryRaw.sandbox) ? entryRaw.sandbox : null;
    const modeRaw = typeof sandbox?.mode === "string" ? sandbox.mode.trim().toLowerCase() : "";
    if (modeRaw === "off" || modeRaw === "non-main" || modeRaw === "all") {
      return modeRaw;
    }
    return null;
  }
  return null;
};

const normalizeExecHost = (raw: string | null | undefined): ExecHost | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "sandbox" || normalized === "gateway" || normalized === "node") {
    return normalized;
  }
  return undefined;
};

const normalizeExecSecurity = (raw: string | null | undefined): ExecSecurity | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "deny" || normalized === "allowlist" || normalized === "full") {
    return normalized;
  }
  return undefined;
};

const normalizeExecAsk = (raw: string | null | undefined): ExecAsk | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "off" || normalized === "on-miss" || normalized === "always") {
    return normalized;
  }
  return undefined;
};

const resolveAgentName = (agent: AgentsListResult["agents"][number]) => {
  const fromList = typeof agent.name === "string" ? agent.name.trim() : "";
  if (fromList) return fromList;
  const fromIdentity = typeof agent.identity?.name === "string" ? agent.identity.name.trim() : "";
  if (fromIdentity) return fromIdentity;
  return agent.id;
};

const resolveAgentAvatarUrl = (agent: AgentsListResult["agents"][number]) => {
  const candidate = agent.identity?.avatarUrl ?? agent.identity?.avatar ?? null;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("data:image/")) return trimmed;
  return null;
};

const resolveDefaultModelForAgent = (
  agentId: string,
  snapshot: GatewayModelPolicySnapshot | null
): string | null => {
  const resolvedAgentId = agentId.trim();
  if (!resolvedAgentId) return null;
  const defaults = snapshot?.config?.agents?.defaults;
  const modelAliases = defaults?.models;
  const agentEntry =
    snapshot?.config?.agents?.list?.find((entry) => entry?.id?.trim() === resolvedAgentId) ??
    null;
  const agentModel = agentEntry?.model;
  let raw: string | null = null;
  if (typeof agentModel === "string") {
    raw = agentModel;
  } else if (agentModel && typeof agentModel === "object") {
    raw = agentModel.primary ?? null;
  }
  if (!raw) {
    const defaultModel = defaults?.model;
    if (typeof defaultModel === "string") {
      raw = defaultModel;
    } else if (defaultModel && typeof defaultModel === "object") {
      raw = defaultModel.primary ?? null;
    }
  }
  if (!raw) return null;
  return resolveConfiguredModelKey(raw, modelAliases);
};

export type DeriveFleetHydrationInput = {
  gatewayUrl: string;
  configSnapshot: GatewayModelPolicySnapshot | null;
  settings: StudioSettings | StudioSettingsPublic | null;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  agentsResult: AgentsListResult;
  mainSessionByAgentId: Map<string, SessionsListEntry | null>;
  statusSummary: SummaryStatusSnapshot | null;
  previewResult: SummaryPreviewSnapshot | null;
};

export type DerivedHydrateAgentFleetResult = {
  seeds: AgentStoreSeed[];
  sessionCreatedAgentIds: string[];
  sessionSettingsSyncedAgentIds: string[];
  summaryPatches: SummarySnapshotPatch[];
  suggestedSelectedAgentId: string | null;
  configSnapshot: GatewayModelPolicySnapshot | null;
};

export const deriveHydrateAgentFleetResult = (
  input: DeriveFleetHydrationInput
): DerivedHydrateAgentFleetResult => {
  const execPolicyByAgentId = new Map<string, ExecPolicyEntry>();
  const execAgents = input.execApprovalsSnapshot?.file?.agents ?? {};
  for (const [agentId, entry] of Object.entries(execAgents)) {
    const normalizedSecurity = normalizeExecSecurity(entry?.security);
    const normalizedAsk = normalizeExecAsk(entry?.ask);
    if (!normalizedSecurity && !normalizedAsk) continue;
    execPolicyByAgentId.set(agentId, {
      security: normalizedSecurity,
      ask: normalizedAsk,
    });
  }

  const mainKey = input.agentsResult.mainKey?.trim() || "main";
  const gatewayKey = input.gatewayUrl.trim();

  const needsSessionSettingsSync = new Set<string>();
  const seeds: AgentStoreSeed[] = input.agentsResult.agents.map((agent) => {
    const defaultAvatarProfile = createDefaultAgentAvatarProfile(agent.id);
    const persistedProfile =
      input.settings && gatewayKey ? resolveAgentAvatarProfile(input.settings, gatewayKey, agent.id) : null;
    const persistedSeed =
      input.settings && gatewayKey ? resolveAgentAvatarSeed(input.settings, gatewayKey, agent.id) : null;
    const avatarProfile = persistedProfile ?? defaultAvatarProfile;
    const avatarSeed = persistedSeed ?? avatarProfile.seed ?? agent.id;
    const avatarUrl = resolveAgentAvatarUrl(agent);
    const name = resolveAgentName(agent);
    const mainSession = input.mainSessionByAgentId.get(agent.id) ?? null;
    const modelProvider =
      typeof mainSession?.modelProvider === "string" ? mainSession.modelProvider.trim() : "";
    const modelId = typeof mainSession?.model === "string" ? mainSession.model.trim() : "";
    const model =
      modelProvider && modelId
        ? `${modelProvider}/${modelId}`
        : resolveDefaultModelForAgent(agent.id, input.configSnapshot);
    const thinkingLevel =
      typeof mainSession?.thinkingLevel === "string" ? mainSession.thinkingLevel : null;
    const sessionExecHost = normalizeExecHost(mainSession?.execHost);
    const sessionExecSecurity = normalizeExecSecurity(mainSession?.execSecurity);
    const sessionExecAsk = normalizeExecAsk(mainSession?.execAsk);
    const policy = execPolicyByAgentId.get(agent.id);
    const sandboxMode = resolveAgentSandboxMode(agent.id, input.configSnapshot);
    const resolvedExecSecurity = sessionExecSecurity ?? policy?.security;
    const resolvedExecAsk = sessionExecAsk ?? policy?.ask;
    const shouldForceSandboxExecHost =
      sandboxMode === "all" &&
      Boolean(sessionExecHost || resolvedExecSecurity || resolvedExecAsk);
    const resolvedExecHost = shouldForceSandboxExecHost
      ? "sandbox"
      : sessionExecHost ??
        (resolvedExecSecurity || resolvedExecAsk ? "gateway" : undefined);
    const expectsExecOverrides = Boolean(
      resolvedExecHost || resolvedExecSecurity || resolvedExecAsk
    );
    const hasMatchingExecOverrides =
      sessionExecHost === resolvedExecHost &&
      sessionExecSecurity === resolvedExecSecurity &&
      sessionExecAsk === resolvedExecAsk;
    if (expectsExecOverrides && !hasMatchingExecOverrides) {
      needsSessionSettingsSync.add(agent.id);
    }
    return {
      agentId: agent.id,
      name,
      role: typeof agent.role === "string" && agent.role.trim() ? agent.role.trim() : null,
      sessionKey: buildAgentMainSessionKey(agent.id, mainKey),
      avatarSeed,
      avatarProfile,
      avatarUrl,
      model,
      thinkingLevel,
      sessionExecHost: resolvedExecHost,
      sessionExecSecurity: resolvedExecSecurity,
      sessionExecAsk: resolvedExecAsk,
    };
  });

  const sessionCreatedAgentIds: string[] = [];
  const sessionSettingsSyncedAgentIds: string[] = [];
  for (const seed of seeds) {
    const mainSession = input.mainSessionByAgentId.get(seed.agentId) ?? null;
    if (!mainSession) continue;
    sessionCreatedAgentIds.push(seed.agentId);
    if (!needsSessionSettingsSync.has(seed.agentId)) {
      sessionSettingsSyncedAgentIds.push(seed.agentId);
    }
  }

  let summaryPatches: SummarySnapshotPatch[] = [];
  let suggestedSelectedAgentId: string | null = null;
  if (input.statusSummary && input.previewResult) {
    const activeAgents: SummarySnapshotAgent[] = [];
    for (const seed of seeds) {
      const mainSession = input.mainSessionByAgentId.get(seed.agentId) ?? null;
      if (!mainSession) continue;
      activeAgents.push({
        agentId: seed.agentId,
        sessionKey: seed.sessionKey,
        status: "idle",
      });
    }
    const sessionKeys = Array.from(
      new Set(activeAgents.map((agent) => agent.sessionKey).filter((key) => key.trim().length > 0))
    ).slice(0, 64);
    if (sessionKeys.length > 0) {
      summaryPatches = buildSummarySnapshotPatches({
        agents: activeAgents,
        statusSummary: input.statusSummary,
        previewResult: input.previewResult,
      });

      const assistantAtByAgentId = new Map<string, number>();
      for (const entry of summaryPatches) {
        if (typeof entry.patch.lastAssistantMessageAt === "number") {
          assistantAtByAgentId.set(entry.agentId, entry.patch.lastAssistantMessageAt);
        }
      }

      let bestAgentId: string | null = seeds[0]?.agentId ?? null;
      let bestTs = bestAgentId ? assistantAtByAgentId.get(bestAgentId) ?? 0 : 0;
      for (const seed of seeds) {
        const ts = assistantAtByAgentId.get(seed.agentId) ?? 0;
        if (ts <= bestTs) continue;
        bestTs = ts;
        bestAgentId = seed.agentId;
      }
      suggestedSelectedAgentId = bestAgentId;
    }
  }

  return {
    seeds,
    sessionCreatedAgentIds,
    sessionSettingsSyncedAgentIds,
    summaryPatches,
    suggestedSelectedAgentId,
    configSnapshot: input.configSnapshot ?? null,
  };
};
