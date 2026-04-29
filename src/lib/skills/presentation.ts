import type {
  SkillInstallOption,
  SkillStatusEntry,
} from "@/lib/skills/types";
import {
  resolveSkillTrustLevel,
  type SkillTrustLevel,
} from "@/lib/skills/sanitize";

export type { SkillTrustLevel };

// ---------------------------------------------------------------------------
// Source group IDs — now includes community + unknown for external sources
// ---------------------------------------------------------------------------

export type SkillSourceGroupId =
  | "workspace"
  | "built-in"
  | "installed"
  | "extra"
  | "community"
  | "unknown"
  | "other";

export type SkillSourceGroup = {
  id: SkillSourceGroupId;
  label: string;
  skills: SkillStatusEntry[];
};

export type SkillReadinessState =
  | "ready"
  | "needs-setup"
  | "unavailable"
  | "disabled-globally";

export type AgentSkillDisplayState = "ready" | "setup-required" | "not-supported";

export type AgentSkillsAccessMode = "all" | "none" | "selected";

// ---------------------------------------------------------------------------
// Trust → group mapping (generic, no openclaw-* assumptions)
// ---------------------------------------------------------------------------

const TRUST_TO_GROUP: Record<SkillTrustLevel, Exclude<SkillSourceGroupId, "other">> = {
  verified:  "built-in",
  managed:   "installed",
  workspace: "workspace",
  community: "community",
  unknown:   "unknown",
};

const GROUP_DEFINITIONS: Array<{
  id: Exclude<SkillSourceGroupId, "other">;
  label: string;
}> = [
  { id: "workspace",  label: "Workspace Skills" },
  { id: "built-in",  label: "Built-in Skills" },
  { id: "installed",  label: "Installed Skills" },
  { id: "extra",      label: "Extra Skills" },
  { id: "community",  label: "Community Skills" },
  { id: "unknown",    label: "Unverified Skills" },
];

// ---------------------------------------------------------------------------
// Removable skill determination
// Skills from workspace or managed sources can be removed;
// bundled/verified skills cannot.
// ---------------------------------------------------------------------------

const REMOVABLE_TRUST_LEVELS = new Set<SkillTrustLevel>(["managed", "workspace"]);

// Legacy type kept for API compatibility — callers that pass a raw source string
// can still use canRemoveSkillSource, but internally we route through trust level.
export type RemovableSkillSource = string;

const trimNonEmpty = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const canRemoveSkillSource = (source: string, bundled = false): boolean => {
  const trimmed = trimNonEmpty(source);
  if (!trimmed) return false;
  const trust = resolveSkillTrustLevel(trimmed, bundled);
  return REMOVABLE_TRUST_LEVELS.has(trust);
};

export const canRemoveSkill = (skill: SkillStatusEntry): boolean =>
  canRemoveSkillSource(skill.source, skill.bundled);

// ---------------------------------------------------------------------------
// Group resolution (source-agnostic via trust level)
// ---------------------------------------------------------------------------

export const resolveSkillGroupId = (skill: SkillStatusEntry): SkillSourceGroupId => {
  const trust = resolveSkillTrustLevel(skill.source.trim(), skill.bundled);
  return TRUST_TO_GROUP[trust] ?? "other";
};

export const groupSkillsBySource = (skills: SkillStatusEntry[]): SkillSourceGroup[] => {
  const grouped = new Map<SkillSourceGroupId, SkillSourceGroup>();
  for (const def of GROUP_DEFINITIONS) {
    grouped.set(def.id, { id: def.id, label: def.label, skills: [] });
  }
  grouped.set("other", { id: "other", label: "Other Skills", skills: [] });

  for (const skill of skills) {
    const groupId = resolveSkillGroupId(skill);
    grouped.get(groupId)?.skills.push(skill);
  }

  const ordered: SkillSourceGroup[] = [];
  for (const def of GROUP_DEFINITIONS) {
    const group = grouped.get(def.id);
    if (group && group.skills.length > 0) ordered.push(group);
  }
  const other = grouped.get("other");
  if (other && other.skills.length > 0) ordered.push(other);
  return ordered;
};

// ---------------------------------------------------------------------------
// Allowlist helpers
// ---------------------------------------------------------------------------

const normalizeStringList = (values: string[] | undefined): string[] => {
  if (!Array.isArray(values)) return [];
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
};

export const normalizeAgentSkillsAllowlist = (values: string[] | undefined): string[] =>
  Array.from(new Set(normalizeStringList(values)));

export const deriveAgentSkillsAccessMode = (
  values: string[] | undefined,
): AgentSkillsAccessMode => {
  if (!Array.isArray(values)) return "all";
  return normalizeAgentSkillsAllowlist(values).length === 0 ? "none" : "selected";
};

export const buildAgentSkillsAllowlistSet = (values: string[] | undefined): Set<string> =>
  new Set(normalizeAgentSkillsAllowlist(values));

// ---------------------------------------------------------------------------
// OS label helpers
// ---------------------------------------------------------------------------

const OS_LABELS: Record<string, string> = {
  darwin:  "macOS",
  linux:   "Linux",
  win32:   "Windows",
  windows: "Windows",
};

const toOsLabel = (value: string): string =>
  OS_LABELS[value.trim().toLowerCase()] ?? value.trim();

// ---------------------------------------------------------------------------
// Missing-detail builders
// ---------------------------------------------------------------------------

export const buildSkillMissingDetails = (skill: SkillStatusEntry): string[] => {
  const details: string[] = [];

  const bins = normalizeStringList(skill.missing.bins);
  if (bins.length > 0) details.push(`Missing tools: ${bins.join(", ")}`);

  const anyBins = normalizeStringList(skill.missing.anyBins);
  if (anyBins.length > 0) details.push(`Missing one-of tools (install any): ${anyBins.join(" | ")}`);

  const env = normalizeStringList(skill.missing.env);
  if (env.length > 0) details.push(`Missing env vars: ${env.join(", ")}`);

  const config = normalizeStringList(skill.missing.config);
  if (config.length > 0) details.push(`Missing config values (set in gateway config): ${config.join(", ")}`);

  const os = normalizeStringList(skill.missing.os);
  if (os.length > 0) details.push(`Requires OS: ${os.map(toOsLabel).join(", ")}`);

  return details;
};

export const buildSkillReasons = (skill: SkillStatusEntry): string[] => {
  const reasons: string[] = [];
  if (skill.disabled) reasons.push("disabled");
  if (skill.blockedByAllowlist) reasons.push("blocked by allowlist");
  if (normalizeStringList(skill.missing.bins).length > 0) reasons.push("missing tools");
  if (normalizeStringList(skill.missing.anyBins).length > 0) reasons.push("missing one-of tools");
  if (normalizeStringList(skill.missing.env).length > 0) reasons.push("missing env vars");
  if (normalizeStringList(skill.missing.config).length > 0) reasons.push("missing config values");
  if (normalizeStringList(skill.missing.os).length > 0) reasons.push("unsupported OS");
  return reasons;
};

// ---------------------------------------------------------------------------
// Readiness derivation
// ---------------------------------------------------------------------------

export const isSkillOsIncompatible = (skill: SkillStatusEntry): boolean =>
  normalizeStringList(skill.missing.os).length > 0;

export const filterOsCompatibleSkills = (skills: SkillStatusEntry[]): SkillStatusEntry[] =>
  skills.filter((skill) => !isSkillOsIncompatible(skill));

export const deriveSkillReadinessState = (skill: SkillStatusEntry): SkillReadinessState => {
  if (skill.disabled) return "disabled-globally";
  if (isSkillOsIncompatible(skill) || skill.blockedByAllowlist) return "unavailable";
  if (skill.eligible) return "ready";
  return "needs-setup";
};

export const deriveAgentSkillDisplayState = (
  readiness: SkillReadinessState,
): AgentSkillDisplayState => {
  if (readiness === "ready") return "ready";
  if (readiness === "unavailable") return "not-supported";
  return "setup-required";
};

export const isBundledBlockedSkill = (skill: SkillStatusEntry): boolean => {
  const trust = resolveSkillTrustLevel(skill.source.trim(), skill.bundled);
  return trust === "verified" && !skill.eligible;
};

// ---------------------------------------------------------------------------
// Install option helpers
// ---------------------------------------------------------------------------

export const hasInstallableMissingBinary = (skill: SkillStatusEntry): boolean => {
  const installOptions = Array.isArray(skill.install) ? skill.install : [];
  if (installOptions.length === 0) return false;

  const missingBinarySet = new Set([
    ...normalizeStringList(skill.missing.bins),
    ...normalizeStringList(skill.missing.anyBins),
  ]);
  if (missingBinarySet.size === 0) return false;

  for (const option of installOptions) {
    const bins = normalizeStringList(option.bins);
    if (bins.length === 0) return true;
    for (const bin of bins) {
      if (missingBinarySet.has(bin)) return true;
    }
  }
  return false;
};

export const resolvePreferredInstallOption = (
  skill: SkillStatusEntry,
): SkillInstallOption | null => {
  if (!hasInstallableMissingBinary(skill)) return null;
  const missingBinarySet = new Set([
    ...normalizeStringList(skill.missing.bins),
    ...normalizeStringList(skill.missing.anyBins),
  ]);
  for (const option of skill.install) {
    const bins = normalizeStringList(option.bins);
    if (bins.length === 0) return option;
    for (const bin of bins) {
      if (missingBinarySet.has(bin)) return option;
    }
  }
  return skill.install[0] ?? null;
};
