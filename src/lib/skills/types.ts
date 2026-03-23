import type { GatewayClient } from "@/lib/gateway/GatewayClient";

export type SkillStatusConfigCheck = {
  path: string;
  satisfied: boolean;
};

export type SkillRequirementSet = {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
  os: string[];
};

export type SkillInstallOption = {
  id: string;
  kind: "brew" | "node" | "go" | "uv" | "download";
  label: string;
  bins: string[];
};

export type RemovableSkillSource = "openclaw-managed" | "openclaw-workspace";

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: SkillRequirementSet;
  missing: SkillRequirementSet;
  configChecks: SkillStatusConfigCheck[];
  install: SkillInstallOption[];
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

export type SkillInstallRequest = {
  name: string;
  installId: string;
  timeoutMs?: number;
};

export type SkillInstallResult = {
  ok: boolean;
  message: string;
  stdout: string;
  stderr: string;
  code: number | null;
  warnings?: string[];
};

export type SkillUpdateRequest = {
  skillKey: string;
  enabled?: boolean;
  apiKey?: string;
};

export type SkillUpdateResult = {
  ok: boolean;
  skillKey: string;
  config: Record<string, unknown>;
};

export type SkillRemoveRequest = {
  skillKey: string;
  source: RemovableSkillSource;
  baseDir: string;
  workspaceDir: string;
  managedSkillsDir: string;
};

export type SkillRemoveResult = {
  removed: boolean;
  removedPath: string;
  source: RemovableSkillSource;
};

export type PackagedSkillInstallRequest = {
  packageId: string;
  source: RemovableSkillSource;
  workspaceDir: string;
  managedSkillsDir: string;
};

export type PackagedSkillInstallResult = {
  installed: boolean;
  installedPath: string;
  source: RemovableSkillSource;
  skillKey: string;
};

const resolveAgentId = (agentId: string): string => {
  const trimmed = agentId.trim();
  if (!trimmed) {
    throw new Error("Agent id is required to load skill status.");
  }
  return trimmed;
};

const resolveRequiredValue = (value: string, message: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(message);
  }
  return trimmed;
};

export const loadAgentSkillStatus = async (
  client: GatewayClient,
  agentId: string
): Promise<SkillStatusReport> => {
  return client.call<SkillStatusReport>("skills.status", {
    agentId: resolveAgentId(agentId),
  });
};

export const installSkill = async (
  client: GatewayClient,
  params: SkillInstallRequest
): Promise<SkillInstallResult> => {
  return client.call<SkillInstallResult>("skills.install", {
    name: resolveRequiredValue(params.name, "Skill name is required to install dependencies."),
    installId: resolveRequiredValue(
      params.installId,
      "Install option id is required to install dependencies."
    ),
    ...(typeof params.timeoutMs === "number" ? { timeoutMs: params.timeoutMs } : {}),
  });
};

export const updateSkill = async (
  client: GatewayClient,
  params: SkillUpdateRequest
): Promise<SkillUpdateResult> => {
  return client.call<SkillUpdateResult>("skills.update", {
    skillKey: resolveRequiredValue(params.skillKey, "Skill key is required to update skill setup."),
    ...(typeof params.enabled === "boolean" ? { enabled: params.enabled } : {}),
    ...(typeof params.apiKey === "string" ? { apiKey: params.apiKey } : {}),
  });
};
