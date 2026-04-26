import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  isWebchatSessionMutationBlockedError,
  syncGatewaySessionSettings,
} from "@/lib/gateway/GatewayClient";
import {
  readGatewayAgentExecApprovals,
  upsertGatewayAgentExecApprovals,
} from "@/lib/gateway/execApprovals";
import { readConfigAgentList, updateGatewayAgentOverrides } from "@/lib/gateway/agentConfig";

export type ExecutionRoleId = "conservative" | "collaborative" | "autonomous";
export type CommandModeId = "off" | "ask" | "auto";

export type AgentPermissionsDraft = {
  commandMode: CommandModeId;
  webAccess: boolean;
  fileTools: boolean;
};

export type ToolGroupState = {
  runtime: boolean | null;
  web: boolean | null;
  fs: boolean | null;
  usesAllow: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const resolveExecutionRoleFromAgent = (agent: {
  sessionExecSecurity?: "deny" | "allowlist" | "full";
  sessionExecAsk?: "off" | "on-miss" | "always";
}): ExecutionRoleId => {
  if (agent.sessionExecSecurity === "full" && agent.sessionExecAsk === "off") {
    return "autonomous";
  }
  if (
    agent.sessionExecSecurity === "allowlist" ||
    agent.sessionExecAsk === "always" ||
    agent.sessionExecAsk === "on-miss"
  ) {
    return "collaborative";
  }
  return "conservative";
};

export const resolveRoleForCommandMode = (mode: CommandModeId): ExecutionRoleId => {
  if (mode === "auto") return "autonomous";
  if (mode === "ask") return "collaborative";
  return "conservative";
};

export const resolveCommandModeFromRole = (role: ExecutionRoleId): CommandModeId => {
  if (role === "autonomous") return "auto";
  if (role === "collaborative") return "ask";
  return "off";
};

export const resolvePresetDefaultsForRole = (role: ExecutionRoleId): AgentPermissionsDraft => {
  const commandMode = resolveCommandModeFromRole(role);
  if (role === "conservative") {
    return {
      commandMode,
      webAccess: false,
      fileTools: false,
    };
  }
  return {
    commandMode,
    webAccess: true,
    fileTools: true,
  };
};

export const resolveEffectivePermissionsSummary = (draft: AgentPermissionsDraft): string => {
  const commandLabel =
    draft.commandMode === "auto"
      ? "Commands: Auto"
      : draft.commandMode === "ask"
      ? "Commands: Ask"
      : "Commands: Off";
  const webLabel = draft.webAccess ? "Web: On" : "Web: Off";
  const fileLabel = draft.fileTools ? "File tools: On" : "File tools: Off";
  return `${commandLabel} | ${webLabel} | ${fileLabel}`;
};

export const isPermissionsCustom = (params: {
  role: ExecutionRoleId;
  draft: AgentPermissionsDraft;
}): boolean => {
  const defaults = resolvePresetDefaultsForRole(params.role);
  return (
    defaults.commandMode !== params.draft.commandMode ||
    defaults.webAccess !== params.draft.webAccess ||
    defaults.fileTools !== params.draft.fileTools
  );
};

const resolveGroupState = (params: {
  group: "group:runtime" | "group:web" | "group:fs";
  allowed: Set<string>;
  denied: Set<string>;
}): boolean | null => {
  if (params.denied.has(params.group)) return false;
  if (params.allowed.has(params.group)) return true;
  return null;
};

export const resolveToolGroupStateFromConfigEntry = (existingTools: unknown): ToolGroupState => {
  const tools = isRecord(existingTools) ? existingTools : null;
  const existingAllow = coerceStringArray(tools?.allow);
  const existingAlsoAllow = coerceStringArray(tools?.alsoAllow);
  const existingDeny = coerceStringArray(tools?.deny) ?? [];
  const usesAllow = existingAllow !== null;
  const allowed = new Set(usesAllow ? existingAllow : existingAlsoAllow ?? []);
  const denied = new Set(existingDeny);

  return {
    runtime: resolveGroupState({ group: "group:runtime", allowed, denied }),
    web: resolveGroupState({ group: "group:web", allowed, denied }),
    fs: resolveGroupState({ group: "group:fs", allowed, denied }),
    usesAllow,
  };
};

export const resolveAgentPermissionsDraft = (params: {
  agent: {
    sessionExecSecurity?: "deny" | "allowlist" | "full";
    sessionExecAsk?: "off" | "on-miss" | "always";
  };
  existingTools: unknown;
}): AgentPermissionsDraft => {
  const role = resolveExecutionRoleFromAgent(params.agent);
  const defaults = resolvePresetDefaultsForRole(role);
  const groupState = resolveToolGroupStateFromConfigEntry(params.existingTools);

  return {
    commandMode: defaults.commandMode,
    webAccess: groupState.web ?? defaults.webAccess,
    fileTools: groupState.fs ?? defaults.fileTools,
  };
};

export function resolveExecApprovalsPolicyForRole(params: {
  role: ExecutionRoleId;
  allowlist: Array<{ pattern: string }>;
}):
  | {
      security: "full" | "allowlist";
      ask: "off" | "always";
      allowlist: Array<{ pattern: string }>;
    }
  | null {
  if (params.role === "conservative") return null;
  if (params.role === "autonomous") {
    return { security: "full", ask: "off", allowlist: params.allowlist };
  }
  return { security: "allowlist", ask: "always", allowlist: params.allowlist };
}

export function resolveToolGroupOverrides(params: {
  existingTools: unknown;
  runtimeEnabled: boolean;
  webEnabled: boolean;
  fsEnabled: boolean;
}): { tools: { allow?: string[]; alsoAllow?: string[]; deny?: string[] } } {
  const tools = isRecord(params.existingTools) ? params.existingTools : null;

  const existingAllow = coerceStringArray(tools?.allow);
  const existingAlsoAllow = coerceStringArray(tools?.alsoAllow);
  const existingDeny = coerceStringArray(tools?.deny) ?? [];

  const usesAllow = existingAllow !== null;
  const allowed = new Set(usesAllow ? existingAllow : existingAlsoAllow ?? []);
  const denied = new Set(existingDeny);

  const applyGroup = (group: "group:runtime" | "group:web" | "group:fs", enabled: boolean) => {
    if (enabled) {
      allowed.add(group);
      denied.delete(group);
      return;
    }
    allowed.delete(group);
    denied.add(group);
  };

  applyGroup("group:runtime", params.runtimeEnabled);
  applyGroup("group:web", params.webEnabled);
  applyGroup("group:fs", params.fsEnabled);

  const allowedList = Array.from(allowed);
  const denyList = Array.from(denied).filter((entry) => !allowed.has(entry));

  return {
    tools: usesAllow
      ? { allow: allowedList, deny: denyList }
      : { alsoAllow: allowedList, deny: denyList },
  };
}

export function resolveSessionExecSettingsForRole(params: {
  role: ExecutionRoleId;
  sandboxMode: string;
}): {
  execHost: "sandbox" | "gateway" | null;
  execSecurity: "deny" | "allowlist" | "full";
  execAsk: "off" | "always";
} {
  if (params.role === "conservative") {
    return { execHost: null, execSecurity: "deny", execAsk: "off" };
  }

  const normalizedMode = params.sandboxMode.trim().toLowerCase();
  const execHost = normalizedMode === "all" ? "sandbox" : "gateway";
  if (params.role === "autonomous") {
    return { execHost, execSecurity: "full", execAsk: "off" };
  }
  return { execHost, execSecurity: "allowlist", execAsk: "always" };
}

export function resolveRuntimeToolOverridesForRole(params: {
  role: ExecutionRoleId;
  existingTools: unknown;
}): { tools: { allow?: string[]; alsoAllow?: string[]; deny?: string[] } } {
  const tools = isRecord(params.existingTools) ? params.existingTools : null;

  const existingAllow = coerceStringArray(tools?.allow);
  const existingAlsoAllow = coerceStringArray(tools?.alsoAllow);
  const existingDeny = coerceStringArray(tools?.deny) ?? [];

  const usesAllow = existingAllow !== null;
  const baseAllowed = new Set(usesAllow ? existingAllow : existingAlsoAllow ?? []);
  const deny = new Set(existingDeny);

  if (params.role === "conservative") {
    baseAllowed.delete("group:runtime");
    deny.add("group:runtime");
  } else {
    baseAllowed.add("group:runtime");
    deny.delete("group:runtime");
  }

  const allowedList = Array.from(baseAllowed);
  const denyList = Array.from(deny).filter((entry) => !baseAllowed.has(entry));

  return {
    tools: usesAllow
      ? { allow: allowedList, deny: denyList }
      : { alsoAllow: allowedList, deny: denyList },
  };
}

type AgentRuntimeConfigContext = {
  sandboxMode: string;
  tools: Record<string, unknown> | null;
};

const resolveAgentRuntimeConfigContext = async (params: {
  client: GatewayClient;
  agentId: string;
}): Promise<AgentRuntimeConfigContext> => {
  const snapshot = await params.client.call<{ config?: unknown }>("config.get", {});
  const baseConfig =
    snapshot.config && typeof snapshot.config === "object" && !Array.isArray(snapshot.config)
      ? (snapshot.config as Record<string, unknown>)
      : undefined;

  const list = readConfigAgentList(baseConfig);
  const configEntry = list.find((entry) => entry.id === params.agentId) ?? null;

  const sandboxRaw =
    configEntry && typeof (configEntry as Record<string, unknown>).sandbox === "object"
      ? ((configEntry as Record<string, unknown>).sandbox as unknown)
      : null;
  const sandbox =
    sandboxRaw && typeof sandboxRaw === "object" && !Array.isArray(sandboxRaw)
      ? (sandboxRaw as Record<string, unknown>)
      : null;
  const sandboxMode = typeof sandbox?.mode === "string" ? sandbox.mode.trim().toLowerCase() : "";

  const toolsRaw =
    configEntry && typeof (configEntry as Record<string, unknown>).tools === "object"
      ? ((configEntry as Record<string, unknown>).tools as unknown)
      : null;
  const tools =
    toolsRaw && typeof toolsRaw === "object" && !Array.isArray(toolsRaw)
      ? (toolsRaw as Record<string, unknown>)
      : null;

  return {
    sandboxMode,
    tools,
  };
};

const upsertExecApprovalsPolicyForRole = async (params: {
  client: GatewayClient;
  agentId: string;
  role: ExecutionRoleId;
}) => {
  const existingPolicy = await readGatewayAgentExecApprovals({
    client: params.client,
    agentId: params.agentId,
  });
  const allowlist = existingPolicy?.allowlist ?? [];
  const nextPolicy = resolveExecApprovalsPolicyForRole({ role: params.role, allowlist });

  await upsertGatewayAgentExecApprovals({
    client: params.client,
    agentId: params.agentId,
    policy: nextPolicy,
  });
};

const syncExecutionRoleSessionSettings = async (params: {
  client: GatewayClient;
  sessionKey: string;
  role: ExecutionRoleId;
  sandboxMode?: string | null;
}) => {
  const execSettings = resolveSessionExecSettingsForRole({
    role: params.role,
    sandboxMode: params.sandboxMode ?? "",
  });
  try {
    await syncGatewaySessionSettings({
      client: params.client,
      sessionKey: params.sessionKey,
      execHost: execSettings.execHost,
      execSecurity: execSettings.execSecurity,
      execAsk: execSettings.execAsk,
    });
  } catch (error) {
    if (isWebchatSessionMutationBlockedError(error)) {
      return;
    }
    throw error;
  }
};

export async function updateAgentPermissionsViaStudio(params: {
  client: GatewayClient;
  agentId: string;
  sessionKey: string;
  draft: AgentPermissionsDraft;
  loadAgents?: () => Promise<void>;
}): Promise<void> {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }

  const role = resolveRoleForCommandMode(params.draft.commandMode);
  await upsertExecApprovalsPolicyForRole({
    client: params.client,
    agentId,
    role,
  });
  const runtimeConfigContext = await resolveAgentRuntimeConfigContext({
    client: params.client,
    agentId,
  });

  const toolOverrides = resolveToolGroupOverrides({
    existingTools: runtimeConfigContext.tools,
    runtimeEnabled: role !== "conservative",
    webEnabled: params.draft.webAccess,
    fsEnabled: params.draft.fileTools,
  });

  await updateGatewayAgentOverrides({
    client: params.client,
    agentId,
    overrides: toolOverrides,
  });

  await syncExecutionRoleSessionSettings({
    client: params.client,
    sessionKey: params.sessionKey,
    role,
    sandboxMode: runtimeConfigContext.sandboxMode,
  });

  if (params.loadAgents) {
    await params.loadAgents();
  }
}

export async function updateExecutionRoleViaStudio(params: {
  client: GatewayClient;
  agentId: string;
  sessionKey: string;
  role: ExecutionRoleId;
  loadAgents: () => Promise<void>;
}): Promise<void> {
  const agentId = params.agentId.trim();
  if (!agentId) {
    throw new Error("Agent id is required.");
  }

  await upsertExecApprovalsPolicyForRole({
    client: params.client,
    agentId,
    role: params.role,
  });
  const runtimeConfigContext = await resolveAgentRuntimeConfigContext({
    client: params.client,
    agentId,
  });

  const toolOverrides = resolveRuntimeToolOverridesForRole({
    role: params.role,
    existingTools: runtimeConfigContext.tools,
  });
  await updateGatewayAgentOverrides({
    client: params.client,
    agentId,
    overrides: toolOverrides,
  });

  await syncExecutionRoleSessionSettings({
    client: params.client,
    sessionKey: params.sessionKey,
    role: params.role,
    sandboxMode: runtimeConfigContext.sandboxMode,
  });

  await params.loadAgents();
}
