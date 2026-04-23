import {
  buildAgentMainSessionKey,
  isSameSessionKey,
} from "@/lib/gateway/GatewayClient";
import { type GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import {
  isTemporarySkillAgentName,
} from "@/lib/skills/tempAgents";
import { type StudioSettings, type StudioSettingsPublic } from "@/lib/studio/settings";
import {
  type SummaryPreviewSnapshot,
  type SummarySnapshotPatch,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import type { AgentStoreSeed } from "@/features/agents/state/store";
import { deriveHydrateAgentFleetResult } from "@/features/agents/operations/agentFleetHydrationDerivation";

type GatewayClientLike = {
  call: (method: string, params: unknown) => Promise<unknown>;
  getLastHello?: () => { snapshot?: unknown } | null;
};

type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope?: string;
  agents: Array<{
    id: string;
    name?: string;
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

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

type ExecApprovalsSnapshot = {
  file?: {
    agents?: Record<string, { security?: string | null; ask?: string | null }>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const parseIdentityNameFromContent = (content: string): string | null => {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) break;
    const normalized = trimmed.replace(/^[-*]\s*/, "");
    const match = /^name\s*:\s*(.+)$/i.exec(normalized);
    if (!match) continue;
    const value = match[1]?.trim().replace(/^[*_]+|[*_]+$/g, "").trim() ?? "";
    if (!value || isTemporarySkillAgentName(value)) continue;
    return value;
  }
  return null;
};

const resolveAgentsListFromHelloSnapshot = (snapshot: unknown): AgentsListResult | null => {
  if (!isRecord(snapshot)) return null;
  const health = isRecord(snapshot.health) ? snapshot.health : null;
  const sessionDefaults = isRecord(snapshot.sessionDefaults) ? snapshot.sessionDefaults : null;
  const rawAgents = Array.isArray(health?.agents) ? health.agents : [];
  const agents = rawAgents.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = typeof entry.agentId === "string" ? entry.agentId.trim() : "";
    if (!id) return [];
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    return [
      {
        id,
        ...(name ? { name } : {}),
      },
    ];
  });
  if (agents.length === 0) return null;
  const defaultId =
    typeof health?.defaultAgentId === "string"
      ? health.defaultAgentId.trim()
      : agents.find((entry, index) => {
          const raw = rawAgents[index];
          return isRecord(raw) && raw.isDefault === true;
        })?.id ?? agents[0]?.id ?? "main";
  const mainKey =
    typeof sessionDefaults?.mainKey === "string" ? sessionDefaults.mainKey.trim() || "main" : "main";
  const scope =
    typeof sessionDefaults?.scope === "string" ? sessionDefaults.scope.trim() || undefined : undefined;
  return {
    defaultId,
    mainKey,
    ...(scope ? { scope } : {}),
    agents,
  };
};

export type HydrateAgentFleetResult = {
  seeds: AgentStoreSeed[];
  sessionCreatedAgentIds: string[];
  sessionSettingsSyncedAgentIds: string[];
  summaryPatches: SummarySnapshotPatch[];
  suggestedSelectedAgentId: string | null;
  configSnapshot: GatewayModelPolicySnapshot | null;
};

export async function hydrateAgentFleetFromGateway(params: {
  client: GatewayClientLike;
  gatewayUrl: string;
  cachedConfigSnapshot: GatewayModelPolicySnapshot | null;
  loadStudioSettings: () => Promise<StudioSettings | StudioSettingsPublic | null>;
  isDisconnectLikeError: (err: unknown) => boolean;
  logError?: (message: string, error: unknown) => void;
}): Promise<HydrateAgentFleetResult> {
  const logError = params.logError ?? ((message, error) => console.error(message, error));

  let configSnapshot = params.cachedConfigSnapshot;
  if (!configSnapshot) {
    try {
      configSnapshot = (await params.client.call(
        "config.get",
        {}
      )) as GatewayModelPolicySnapshot;
    } catch (err) {
      if (!params.isDisconnectLikeError(err)) {
        logError("Failed to load gateway config while loading agents.", err);
      }
    }
  }

  const gatewayKey = params.gatewayUrl.trim();
  let settings: StudioSettings | StudioSettingsPublic | null = null;
  if (gatewayKey) {
    try {
      settings = await params.loadStudioSettings();
    } catch (err) {
      logError("Failed to load studio settings while loading agents.", err);
    }
  }

  let execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  try {
    execApprovalsSnapshot = (await params.client.call(
      "exec.approvals.get",
      {}
    )) as ExecApprovalsSnapshot;
  } catch (err) {
    if (!params.isDisconnectLikeError(err)) {
      logError("Failed to load exec approvals while loading agents.", err);
    }
  }

  const helloSnapshotFallback = resolveAgentsListFromHelloSnapshot(
    params.client.getLastHello?.()?.snapshot
  );
  let agentsResult: AgentsListResult;
  try {
    agentsResult = (await params.client.call("agents.list", {})) as AgentsListResult;
  } catch (err) {
    if (helloSnapshotFallback) {
      agentsResult = helloSnapshotFallback;
    } else {
      throw err;
    }
  }
  if (!Array.isArray(agentsResult?.agents) || agentsResult.agents.length === 0) {
    if (helloSnapshotFallback) {
      agentsResult = helloSnapshotFallback;
    }
  }
  agentsResult = {
    ...agentsResult,
    agents: await Promise.all(
      agentsResult.agents.map(async (agent) => {
        const identityName =
          typeof agent.identity?.name === "string" ? agent.identity.name.trim() : "";
        const listedName = typeof agent.name === "string" ? agent.name.trim() : "";
        const hasStableIdentityName =
          Boolean(identityName) && !isTemporarySkillAgentName(identityName);
        const needsIdentityRecovery =
          !identityName ||
          isTemporarySkillAgentName(identityName) ||
          isTemporarySkillAgentName(listedName);
        if (!needsIdentityRecovery) {
          return agent;
        }
        if (isTemporarySkillAgentName(listedName) && hasStableIdentityName) {
          return {
            ...agent,
            name: identityName,
            identity: {
              ...(agent.identity ?? {}),
              name: identityName,
            },
          };
        }
        try {
          const result = (await params.client.call("agents.files.get", {
            agentId: agent.id,
            name: "IDENTITY.md",
          })) as { file?: { missing?: unknown; content?: unknown } };
          const file = result?.file;
          const record =
            file && typeof file === "object" ? (file as Record<string, unknown>) : null;
          if (record?.missing === true || typeof record?.content !== "string") {
            return agent;
          }
          const recoveredName = parseIdentityNameFromContent(record.content);
          if (!recoveredName || isTemporarySkillAgentName(recoveredName)) {
            return agent;
          }
          return {
            ...agent,
            name: recoveredName,
            identity: {
              ...(agent.identity ?? {}),
              name: recoveredName,
            },
          };
        } catch {
          return agent;
        }
      })
    ).then((agents) =>
      agents.filter((agent) => !isTemporarySkillAgentName(agent.name ?? agent.identity?.name))
    ),
  };
  const mainKey = agentsResult.mainKey?.trim() || "main";

  const mainSessionKeyByAgent = new Map<string, SessionsListEntry | null>();
  await Promise.all(
    agentsResult.agents.map(async (agent) => {
      try {
        const expectedMainKey = buildAgentMainSessionKey(agent.id, mainKey);
        const sessions = (await params.client.call("sessions.list", {
          agentId: agent.id,
          includeGlobal: false,
          includeUnknown: false,
          search: expectedMainKey,
          limit: 4,
        })) as SessionsListResult;
        const entries = Array.isArray(sessions.sessions) ? sessions.sessions : [];
        const mainEntry =
          entries.find((entry) => isSameSessionKey(entry.key ?? "", expectedMainKey)) ?? null;
        mainSessionKeyByAgent.set(agent.id, mainEntry);
      } catch (err) {
        if (!params.isDisconnectLikeError(err)) {
          logError("Failed to list sessions while resolving agent session.", err);
        }
        mainSessionKeyByAgent.set(agent.id, null);
      }
    })
  );

  let statusSummary: SummaryStatusSnapshot | null = null;
  let previewResult: SummaryPreviewSnapshot | null = null;
  try {
    const sessionKeys = Array.from(
      new Set(
        agentsResult.agents
          .filter((agent) => Boolean(mainSessionKeyByAgent.get(agent.id)))
          .map((agent) => buildAgentMainSessionKey(agent.id, mainKey))
          .filter((key) => key.trim().length > 0)
      )
    ).slice(0, 64);
    if (sessionKeys.length > 0) {
      const snapshot = await Promise.all([
        params.client.call("status", {}) as Promise<SummaryStatusSnapshot>,
        params.client.call("sessions.preview", {
          keys: sessionKeys,
          limit: 8,
          maxChars: 240,
        }) as Promise<SummaryPreviewSnapshot>,
      ]);
      statusSummary = snapshot[0] ?? null;
      previewResult = snapshot[1] ?? null;
    }
  } catch (err) {
    if (!params.isDisconnectLikeError(err)) {
      logError("Failed to load initial summary snapshot.", err);
    }
  }

  const derived = deriveHydrateAgentFleetResult({
    gatewayUrl: params.gatewayUrl,
    configSnapshot: configSnapshot ?? null,
    settings,
    execApprovalsSnapshot,
    agentsResult,
    mainSessionByAgentId: mainSessionKeyByAgent,
    statusSummary,
    previewResult,
  });

  return derived;
}
