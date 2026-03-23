import { GatewayResponseError, type GatewayClient } from "@/lib/gateway/GatewayClient";

export type AgentHeartbeatActiveHours = {
  start: string;
  end: string;
};

export type AgentHeartbeat = {
  every: string;
  target: string;
  includeReasoning: boolean;
  ackMaxChars?: number | null;
  activeHours?: AgentHeartbeatActiveHours | null;
};

export type AgentHeartbeatResult = {
  heartbeat: AgentHeartbeat;
  hasOverride: boolean;
};

export type AgentHeartbeatUpdatePayload = {
  override: boolean;
  heartbeat: AgentHeartbeat;
};

export type AgentHeartbeatSummary = {
  id: string;
  agentId: string;
  source: "override" | "default";
  enabled: boolean;
  heartbeat: AgentHeartbeat;
};

export type HeartbeatListResult = {
  heartbeats: AgentHeartbeatSummary[];
};

export type HeartbeatWakeResult = { ok: true } | { ok: false };

export type GatewayConfigSnapshot = {
  config?: Record<string, unknown>;
  hash?: string;
  exists?: boolean;
  path?: string | null;
};

type HeartbeatBlock = Record<string, unknown> | null | undefined;

const DEFAULT_EVERY = "30m";
const DEFAULT_TARGET = "last";
const DEFAULT_ACK_MAX_CHARS = 300;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export type ConfigAgentEntry = Record<string, unknown> & { id: string };

export type GatewayAgentSandboxOverrides = {
  mode?: "off" | "non-main" | "all";
  workspaceAccess?: "none" | "ro" | "rw";
};

export type GatewayAgentToolsOverrides = {
  profile?: "minimal" | "coding" | "messaging" | "full";
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
  sandbox?: {
    tools?: {
      allow?: string[];
      deny?: string[];
    };
  };
};

export type GatewayAgentOverrides = {
  sandbox?: GatewayAgentSandboxOverrides;
  tools?: GatewayAgentToolsOverrides;
};

const DEFAULT_AGENT_ID = "main";

export const readConfigAgentList = (
  config: Record<string, unknown> | undefined
): ConfigAgentEntry[] => {
  if (!config) return [];
  const agents = isRecord(config.agents) ? config.agents : null;
  const list = Array.isArray(agents?.list) ? agents.list : [];
  return list.filter((entry): entry is ConfigAgentEntry => {
    if (!isRecord(entry)) return false;
    if (typeof entry.id !== "string") return false;
    return entry.id.trim().length > 0;
  });
};

export const resolveDefaultConfigAgentId = (
  config: Record<string, unknown> | undefined
): string => {
  const list = readConfigAgentList(config);
  if (list.length === 0) {
    return DEFAULT_AGENT_ID;
  }
  const defaults = list.filter((entry) => entry.default === true);
  const selected = defaults[0] ?? list[0];
  const resolved = selected.id.trim();
  return resolved || DEFAULT_AGENT_ID;
};

export const writeConfigAgentList = (
  config: Record<string, unknown>,
  list: ConfigAgentEntry[]
): Record<string, unknown> => {
  const agents = isRecord(config.agents) ? { ...config.agents } : {};
  return { ...config, agents: { ...agents, list } };
};

export const upsertConfigAgentEntry = (
  list: ConfigAgentEntry[],
  agentId: string,
  updater: (entry: ConfigAgentEntry) => ConfigAgentEntry
): { list: ConfigAgentEntry[]; entry: ConfigAgentEntry } => {
  let updatedEntry: ConfigAgentEntry | null = null;
  const nextList = list.map((entry) => {
    if (entry.id !== agentId) return entry;
    const next = updater({ ...entry, id: agentId });
    updatedEntry = next;
    return next;
  });
  if (!updatedEntry) {
    updatedEntry = updater({ id: agentId });
    nextList.push(updatedEntry);
  }
  return { list: nextList, entry: updatedEntry };
};

export const slugifyAgentName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Name produced an empty folder name.");
  }
  return slug;
};

const coerceString = (value: unknown) => (typeof value === "string" ? value : undefined);
const coerceBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;
const coerceNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const coerceActiveHours = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  const start = coerceString(value.start);
  const end = coerceString(value.end);
  if (!start || !end) return undefined;
  return { start, end };
};

const mergeHeartbeat = (defaults: HeartbeatBlock, override: HeartbeatBlock) => {
  const merged = {
    ...(defaults ?? {}),
    ...(override ?? {}),
  } as Record<string, unknown>;
  if (override && typeof override === "object" && "activeHours" in override) {
    merged.activeHours = (override as Record<string, unknown>).activeHours;
  } else if (defaults && typeof defaults === "object" && "activeHours" in defaults) {
    merged.activeHours = (defaults as Record<string, unknown>).activeHours;
  }
  return merged;
};

const normalizeHeartbeat = (
  defaults: HeartbeatBlock,
  override: HeartbeatBlock
): AgentHeartbeatResult => {
  const resolved = mergeHeartbeat(defaults, override);
  const every = coerceString(resolved.every) ?? DEFAULT_EVERY;
  const target = coerceString(resolved.target) ?? DEFAULT_TARGET;
  const includeReasoning = coerceBoolean(resolved.includeReasoning) ?? false;
  const ackMaxChars = coerceNumber(resolved.ackMaxChars) ?? DEFAULT_ACK_MAX_CHARS;
  const activeHours = coerceActiveHours(resolved.activeHours) ?? null;
  return {
    heartbeat: {
      every,
      target,
      includeReasoning,
      ackMaxChars,
      activeHours,
    },
    hasOverride: Boolean(override && typeof override === "object"),
  };
};

const readHeartbeatDefaults = (config: Record<string, unknown>): HeartbeatBlock => {
  const agents = isRecord(config.agents) ? config.agents : null;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : null;
  return (defaults?.heartbeat ?? null) as HeartbeatBlock;
};

const buildHeartbeatOverride = (payload: AgentHeartbeat): Record<string, unknown> => {
  const nextHeartbeat: Record<string, unknown> = {
    every: payload.every,
    target: payload.target,
    includeReasoning: payload.includeReasoning,
  };
  if (payload.ackMaxChars !== undefined && payload.ackMaxChars !== null) {
    nextHeartbeat.ackMaxChars = payload.ackMaxChars;
  }
  if (payload.activeHours) {
    nextHeartbeat.activeHours = {
      start: payload.activeHours.start,
      end: payload.activeHours.end,
    };
  }
  return nextHeartbeat;
};

export const resolveHeartbeatSettings = (
  config: Record<string, unknown>,
  agentId: string
): AgentHeartbeatResult => {
  const list = readConfigAgentList(config);
  const entry = list.find((item) => item.id === agentId) ?? null;
  const defaults = readHeartbeatDefaults(config);
  const override =
    entry && typeof entry === "object"
      ? ((entry as Record<string, unknown>).heartbeat as HeartbeatBlock)
      : null;
  return normalizeHeartbeat(defaults, override);
};

type GatewayStatusHeartbeatAgent = {
  agentId?: string;
  enabled?: boolean;
  every?: string;
  everyMs?: number | null;
};

type GatewayStatusSnapshot = {
  heartbeat?: {
    agents?: GatewayStatusHeartbeatAgent[];
  };
};

const resolveHeartbeatAgentId = (agentId: string) => {
  const trimmed = agentId.trim();
  if (!trimmed) {
    throw new Error("Agent id is required.");
  }
  return trimmed;
};

const resolveStatusHeartbeatAgent = (
  status: GatewayStatusSnapshot,
  agentId: string
): GatewayStatusHeartbeatAgent | null => {
  const list = Array.isArray(status.heartbeat?.agents) ? status.heartbeat?.agents : [];
  for (const entry of list) {
    if (!entry || typeof entry.agentId !== "string") continue;
    if (entry.agentId.trim() !== agentId) continue;
    return entry;
  }
  return null;
};

export const listHeartbeatsForAgent = async (
  client: GatewayClient,
  agentId: string
): Promise<HeartbeatListResult> => {
  const resolvedAgentId = resolveHeartbeatAgentId(agentId);
  const [snapshot, status] = await Promise.all([
    client.call<GatewayConfigSnapshot>("config.get", {}),
    client.call<GatewayStatusSnapshot>("status", {}),
  ]);
  const config = isRecord(snapshot.config) ? snapshot.config : {};
  const resolved = resolveHeartbeatSettings(config, resolvedAgentId);
  const statusHeartbeat = resolveStatusHeartbeatAgent(status, resolvedAgentId);
  const enabled = Boolean(statusHeartbeat?.enabled);
  const every = typeof statusHeartbeat?.every === "string" ? statusHeartbeat.every.trim() : "";
  const heartbeat = every ? { ...resolved.heartbeat, every } : resolved.heartbeat;
  if (!enabled && !resolved.hasOverride) {
    return { heartbeats: [] };
  }
  return {
    heartbeats: [
      {
        id: resolvedAgentId,
        agentId: resolvedAgentId,
        source: resolved.hasOverride ? "override" : "default",
        enabled,
        heartbeat,
      },
    ],
  };
};

export const triggerHeartbeatNow = async (
  client: GatewayClient,
  agentId: string
): Promise<HeartbeatWakeResult> => {
  const resolvedAgentId = resolveHeartbeatAgentId(agentId);
  return client.call<HeartbeatWakeResult>("wake", {
    mode: "now",
    text: `Claw3D heartbeat trigger (${resolvedAgentId}).`,
  });
};

const shouldRetryConfigWrite = (err: unknown) => {
  if (!(err instanceof GatewayResponseError)) return false;
  return /re-run config\.get|config changed since last load/i.test(err.message);
};

const applyGatewayConfigPatch = async (params: {
  client: GatewayClient;
  patch: Record<string, unknown>;
  baseHash?: string | null;
  exists?: boolean;
  attempt?: number;
}): Promise<void> => {
  const attempt = params.attempt ?? 0;
  const requiresBaseHash = params.exists !== false;
  const baseHash = requiresBaseHash ? params.baseHash?.trim() : undefined;
  if (requiresBaseHash && !baseHash) {
    throw new Error("Gateway config hash unavailable; re-run config.get.");
  }
  const payload: Record<string, unknown> = {
    raw: JSON.stringify(params.patch, null, 2),
  };
  if (baseHash) payload.baseHash = baseHash;
  try {
    await params.client.call("config.patch", payload);
  } catch (err) {
    if (attempt < 1 && shouldRetryConfigWrite(err)) {
      const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
      return applyGatewayConfigPatch({
        ...params,
        baseHash: snapshot.hash ?? undefined,
        exists: snapshot.exists,
        attempt: attempt + 1,
      });
    }
    throw err;
  }
};

export const renameGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
  name: string;
}) => {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Agent name is required.");
  }
  await params.client.call("agents.update", { agentId: params.agentId, name: trimmed });
  return { id: params.agentId, name: trimmed };
};

const dirnameLike = (value: string): string => {
  const lastSlash = value.lastIndexOf("/");
  const lastBackslash = value.lastIndexOf("\\");
  const idx = Math.max(lastSlash, lastBackslash);
  if (idx < 0) return "";
  return value.slice(0, idx);
};

const joinPathLike = (dir: string, leaf: string): string => {
  const sep = dir.includes("\\") ? "\\" : "/";
  const trimmedDir = dir.endsWith("/") || dir.endsWith("\\") ? dir.slice(0, -1) : dir;
  return `${trimmedDir}${sep}${leaf}`;
};

export const createGatewayAgent = async (params: {
  client: GatewayClient;
  name: string;
}): Promise<ConfigAgentEntry> => {
  const trimmed = params.name.trim();
  if (!trimmed) {
    throw new Error("Agent name is required.");
  }

  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const configPath = typeof snapshot.path === "string" ? snapshot.path.trim() : "";
  if (!configPath) {
    throw new Error(
      'Gateway did not return a config path; cannot compute a default workspace for "agents.create".',
    );
  }
  const stateDir = dirnameLike(configPath);
  if (!stateDir) {
    throw new Error(
      `Gateway config path "${configPath}" is missing a directory; cannot compute workspace.`,
    );
  }
  const idGuess = slugifyAgentName(trimmed);
  const workspace = joinPathLike(stateDir, `workspace-${idGuess}`);

  const result = (await params.client.call("agents.create", {
    name: trimmed,
    workspace,
  })) as { ok?: boolean; agentId?: string; name?: string; workspace?: string };
  const agentId = typeof result?.agentId === "string" ? result.agentId.trim() : "";
  if (!agentId) {
    throw new Error("Gateway returned an invalid agents.create response (missing agentId).");
  }
  return { id: agentId, name: trimmed };
};

export const deleteGatewayAgent = async (params: {
  client: GatewayClient;
  agentId: string;
}) => {
  try {
    const result = (await params.client.call("agents.delete", {
      agentId: params.agentId,
    })) as { ok?: boolean; removedBindings?: unknown };
    const removedBindings =
      typeof result?.removedBindings === "number" && Number.isFinite(result.removedBindings)
        ? Math.max(0, Math.floor(result.removedBindings))
        : 0;
    return { removed: true, removedBindings };
  } catch (err) {
    if (err instanceof GatewayResponseError && /not found/i.test(err.message)) {
      return { removed: false, removedBindings: 0 };
    }
    throw err;
  }
};

export const removeGatewayAgentFromConfigOnly = async (params: {
  client: GatewayClient;
  agentId: string;
}): Promise<{ removed: boolean }> => {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }

  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const nextList = list.filter((entry) => entry.id !== agentId);
  if (nextList.length === list.length) {
    return { removed: false };
  }

  await applyGatewayConfigPatch({
    client: params.client,
    patch: { agents: { list: nextList } },
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
  });
  return { removed: true };
};

export const updateGatewayHeartbeat = async (params: {
  client: GatewayClient;
  agentId: string;
  payload: AgentHeartbeatUpdatePayload;
}): Promise<AgentHeartbeatResult> => {
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const { list: nextList } = upsertConfigAgentEntry(list, params.agentId, (entry) => {
    const next = { ...entry };
    if (params.payload.override) {
      next.heartbeat = buildHeartbeatOverride(params.payload.heartbeat);
    } else if ("heartbeat" in next) {
      delete next.heartbeat;
    }
    return next;
  });
  const nextConfig = writeConfigAgentList(baseConfig, nextList);
  await applyGatewayConfigPatch({
    client: params.client,
    patch: { agents: { list: nextList } },
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
  });
  return resolveHeartbeatSettings(nextConfig, params.agentId);
};

export const removeGatewayHeartbeatOverride = async (params: {
  client: GatewayClient;
  agentId: string;
}): Promise<AgentHeartbeatResult> => {
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const nextList = list.map((entry) => {
    if (entry.id !== params.agentId) return entry;
    if (!("heartbeat" in entry)) return entry;
    const next = { ...entry };
    delete next.heartbeat;
    return next;
  });
  const changed = nextList.some((entry, index) => entry !== list[index]);
  if (!changed) {
    return resolveHeartbeatSettings(baseConfig, params.agentId);
  }
  const nextConfig = writeConfigAgentList(baseConfig, nextList);
  await applyGatewayConfigPatch({
    client: params.client,
    patch: { agents: { list: nextList } },
    baseHash: snapshot.hash ?? undefined,
    exists: snapshot.exists,
  });
  return resolveHeartbeatSettings(nextConfig, params.agentId);
};

export type AgentSkillsAccessMode = "all" | "none" | "allowlist";

const resolveRequiredAgentId = (agentId: string): string => {
  const trimmed = agentId.trim();
  if (!trimmed) {
    throw new Error("Agent id is required.");
  }
  return trimmed;
};

const normalizeSkillAllowlistInput = (values: ReadonlyArray<unknown>): string[] => {
  const next = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(next)).sort((a, b) => a.localeCompare(b));
};

const normalizeSkillAllowlist = (values: string[]): string[] => {
  return normalizeSkillAllowlistInput(values);
};

const areStringArraysEqual = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};

const buildAgentSkillsConfig = (params: {
  baseConfig: Record<string, unknown>;
  agentId: string;
  mode: AgentSkillsAccessMode;
  skillNames?: string[];
}): Record<string, unknown> => {
  const list = readConfigAgentList(params.baseConfig);
  const currentEntry = list.find((entry) => entry.id === params.agentId);
  const hasEntry = Boolean(currentEntry);
  const currentRawSkills = currentEntry?.skills;

  if (params.mode === "all") {
    if (!hasEntry) {
      return params.baseConfig;
    }
    if (!Object.prototype.hasOwnProperty.call(currentEntry, "skills")) {
      return params.baseConfig;
    }
  }

  if (params.mode === "none" && Array.isArray(currentRawSkills) && currentRawSkills.length === 0) {
    return params.baseConfig;
  }

  if (params.mode === "allowlist") {
    const rawSkills = params.skillNames;
    if (!rawSkills) {
      throw new Error("Skills allowlist is required when mode is allowlist.");
    }
    const normalizedNext = normalizeSkillAllowlist(rawSkills);
    if (Array.isArray(currentRawSkills)) {
      const normalizedCurrent = normalizeSkillAllowlistInput(currentRawSkills);
      if (areStringArraysEqual(normalizedCurrent, normalizedNext)) {
        return params.baseConfig;
      }
    }
  }

  const { list: nextList } = upsertConfigAgentEntry(list, params.agentId, (entry) => {
    const next: ConfigAgentEntry = { ...entry, id: params.agentId };
    if (params.mode === "all") {
      if ("skills" in next) {
        delete next.skills;
      }
      return next;
    }
    if (params.mode === "none") {
      next.skills = [];
      return next;
    }
    const rawSkills = params.skillNames;
    if (!rawSkills) {
      throw new Error("Skills allowlist is required when mode is allowlist.");
    }
    next.skills = normalizeSkillAllowlist(rawSkills);
    return next;
  });
  return writeConfigAgentList(params.baseConfig, nextList);
};

export const readGatewayAgentSkillsAllowlist = async (params: {
  client: GatewayClient;
  agentId: string;
}): Promise<string[] | undefined> => {
  const agentId = resolveRequiredAgentId(params.agentId);
  const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
  const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
  const list = readConfigAgentList(baseConfig);
  const entry = list.find((item) => item.id === agentId);
  if (!entry) {
    return undefined;
  }
  const raw = entry.skills;
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return normalizeSkillAllowlistInput(raw);
};

export const updateGatewayAgentSkillsAllowlist = async (params: {
  client: GatewayClient;
  agentId: string;
  mode: AgentSkillsAccessMode;
  skillNames?: string[];
}): Promise<void> => {
  const agentId = resolveRequiredAgentId(params.agentId);
  if (params.mode === "allowlist" && !params.skillNames) {
    throw new Error("Skills allowlist is required when mode is allowlist.");
  }

  const attemptWrite = async (attempt: number): Promise<void> => {
    const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
    const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
    const nextConfig = buildAgentSkillsConfig({
      baseConfig,
      agentId,
      mode: params.mode,
      skillNames: params.skillNames,
    });
    if (nextConfig === baseConfig) {
      return;
    }
    const payload: Record<string, unknown> = {
      raw: JSON.stringify(nextConfig, null, 2),
    };
    const requiresBaseHash = snapshot.exists !== false;
    const baseHash = requiresBaseHash ? snapshot.hash?.trim() : undefined;
    if (requiresBaseHash && !baseHash) {
      throw new Error("Gateway config hash unavailable; re-run config.get.");
    }
    if (baseHash) {
      payload.baseHash = baseHash;
    }
    try {
      await params.client.call("config.set", payload);
    } catch (err) {
      if (attempt < 1 && shouldRetryConfigWrite(err)) {
        return attemptWrite(attempt + 1);
      }
      throw err;
    }
  };

  await attemptWrite(0);
};

const normalizeToolList = (values: string[] | undefined): string[] | undefined => {
  if (!values) return undefined;
  const next = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return Array.from(new Set(next));
};

export const updateGatewayAgentOverrides = async (params: {
  client: GatewayClient;
  agentId: string;
  overrides: GatewayAgentOverrides;
}): Promise<void> => {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }
  if (params.overrides.tools?.allow !== undefined && params.overrides.tools?.alsoAllow !== undefined) {
    throw new Error("Agent tools overrides cannot set both allow and alsoAllow.");
  }
  const hasSandboxOverrides =
    Boolean(params.overrides.sandbox?.mode) || Boolean(params.overrides.sandbox?.workspaceAccess);
  const hasToolsOverrides =
    Boolean(params.overrides.tools?.profile) ||
    params.overrides.tools?.allow !== undefined ||
    params.overrides.tools?.alsoAllow !== undefined ||
    params.overrides.tools?.deny !== undefined ||
    params.overrides.tools?.sandbox?.tools?.allow !== undefined ||
    params.overrides.tools?.sandbox?.tools?.deny !== undefined;
  if (!hasSandboxOverrides && !hasToolsOverrides) {
    return;
  }

  const buildNextConfig = (baseConfig: Record<string, unknown>): Record<string, unknown> => {
    const list = readConfigAgentList(baseConfig);
    const { list: nextList } = upsertConfigAgentEntry(list, agentId, (entry) => {
      const next: ConfigAgentEntry = { ...entry, id: agentId };

      if (hasSandboxOverrides) {
        const currentSandbox = isRecord(next.sandbox) ? { ...next.sandbox } : {};
        if (params.overrides.sandbox?.mode) {
          currentSandbox.mode = params.overrides.sandbox.mode;
        }
        if (params.overrides.sandbox?.workspaceAccess) {
          currentSandbox.workspaceAccess = params.overrides.sandbox.workspaceAccess;
        }
        next.sandbox = currentSandbox;
      }

      if (hasToolsOverrides) {
        const currentTools = isRecord(next.tools) ? { ...next.tools } : {};
        if (params.overrides.tools?.profile) {
          currentTools.profile = params.overrides.tools.profile;
        }
        const allow = normalizeToolList(params.overrides.tools?.allow);
        if (allow !== undefined) {
          currentTools.allow = allow;
          delete currentTools.alsoAllow;
        }
        const alsoAllow = normalizeToolList(params.overrides.tools?.alsoAllow);
        if (alsoAllow !== undefined) {
          currentTools.alsoAllow = alsoAllow;
          delete currentTools.allow;
        }
        const deny = normalizeToolList(params.overrides.tools?.deny);
        if (deny !== undefined) {
          currentTools.deny = deny;
        }

        const sandboxAllow = normalizeToolList(params.overrides.tools?.sandbox?.tools?.allow);
        const sandboxDeny = normalizeToolList(params.overrides.tools?.sandbox?.tools?.deny);
        if (sandboxAllow !== undefined || sandboxDeny !== undefined) {
          const sandboxRaw = (currentTools as Record<string, unknown>).sandbox;
          const sandbox = isRecord(sandboxRaw) ? { ...sandboxRaw } : {};
          const sandboxToolsRaw = (sandbox as Record<string, unknown>).tools;
          const sandboxTools = isRecord(sandboxToolsRaw) ? { ...sandboxToolsRaw } : {};
          if (sandboxAllow !== undefined) {
            (sandboxTools as Record<string, unknown>).allow = sandboxAllow;
          }
          if (sandboxDeny !== undefined) {
            (sandboxTools as Record<string, unknown>).deny = sandboxDeny;
          }
          (sandbox as Record<string, unknown>).tools = sandboxTools;
          (currentTools as Record<string, unknown>).sandbox = sandbox;
        }
        next.tools = currentTools;
      }

      return next;
    });
    return writeConfigAgentList(baseConfig, nextList);
  };

  const attemptWrite = async (attempt: number): Promise<void> => {
    const snapshot = await params.client.call<GatewayConfigSnapshot>("config.get", {});
    const baseConfig = isRecord(snapshot.config) ? snapshot.config : {};
    const nextConfig = buildNextConfig(baseConfig);
    const payload: Record<string, unknown> = {
      raw: JSON.stringify(nextConfig, null, 2),
    };
    const requiresBaseHash = snapshot.exists !== false;
    const baseHash = requiresBaseHash ? snapshot.hash?.trim() : undefined;
    if (requiresBaseHash && !baseHash) {
      throw new Error("Gateway config hash unavailable; re-run config.get.");
    }
    if (baseHash) payload.baseHash = baseHash;
    try {
      await params.client.call("config.set", payload);
    } catch (err) {
      if (attempt < 1 && shouldRetryConfigWrite(err)) {
        return attemptWrite(attempt + 1);
      }
      throw err;
    }
  };

  await attemptWrite(0);
};
