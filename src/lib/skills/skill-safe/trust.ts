/**
 * Source trust normalization.
 *
 * Maps any skill source string to a normalized trust level — handles
 * openclaw-* conventions AND generic external sources (GitHub, souls.zip,
 * HashLips, hermes-agent, custom registries, etc.).
 *
 * Trust levels are ordered: verified > managed > workspace > community > unknown
 */

export type SkillTrustLevel =
  | "verified"   // bundled with the app, reviewed and signed
  | "managed"    // installed via official marketplace
  | "workspace"  // from an agent's local workspace
  | "community"  // external source (GitHub, registry, etc.)
  | "unknown";   // unrecognized — treat as untrusted

/**
 * Resolve a trust level from a raw skill source string.
 *
 * Recognizes:
 *   - openclaw-bundled          → verified
 *   - openclaw-managed          → managed
 *   - openclaw-workspace        → workspace
 *   - agents-skills-*           → workspace
 *   - openclaw-extra            → community
 *   - github:<owner>/<repo>     → community
 *   - registry:<name>           → community
 *   - souls:<id>                → community
 *   - hermes:<id>               → community
 *   - anything else             → unknown
 */
export const resolveSkillTrustLevel = (
  source: string,
  bundled: boolean,
): SkillTrustLevel => {
  if (bundled) return "verified";
  const s = source.trim().toLowerCase();
  if (s === "openclaw-bundled") return "verified";
  if (s === "openclaw-managed") return "managed";
  if (
    s === "openclaw-workspace" ||
    s === "workspace" ||
    s.startsWith("agents-skills-")
  ) return "workspace";
  if (
    s === "openclaw-extra" ||
    s === "community" ||
    s === "external" ||
    s.startsWith("github:") ||
    s.startsWith("registry:") ||
    s.startsWith("souls:") ||
    s.startsWith("hermes:") ||
    s.startsWith("hashlips:") ||
    s.startsWith("npm:")
  ) return "community";
  return "unknown";
};

export const TRUST_LEVEL_LABELS: Record<SkillTrustLevel, string> = {
  verified:  "Verified",
  managed:   "Managed",
  workspace: "Workspace",
  community: "Community",
  unknown:   "Unknown",
};

export const TRUST_LEVEL_DESCRIPTION: Record<SkillTrustLevel, string> = {
  verified:  "Bundled with the application. Reviewed and signed.",
  managed:   "Installed via the official marketplace. Reviewed.",
  workspace: "From an agent's local workspace. Review before using.",
  community: "From an external source (GitHub, registry, souls.zip, etc.). Sanitize before installing.",
  unknown:   "Source is unrecognized. Treat as untrusted until reviewed.",
};

/**
 * Tailwind class strings for rendering trust badges in a dark UI.
 */
export const TRUST_LEVEL_COLOR: Record<SkillTrustLevel, string> = {
  verified:  "text-emerald-400 border-emerald-500/30 bg-emerald-500/8",
  managed:   "text-cyan-400 border-cyan-500/30 bg-cyan-500/8",
  workspace: "text-amber-300 border-amber-400/30 bg-amber-500/8",
  community: "text-violet-300 border-violet-500/30 bg-violet-500/8",
  unknown:   "text-rose-300 border-rose-500/30 bg-rose-500/8",
};

export const SEVERITY_COLOR: Record<"safe" | "caution" | "danger", string> = {
  safe:    "text-emerald-400 border-emerald-500/30 bg-emerald-500/8",
  caution: "text-amber-300 border-amber-400/30 bg-amber-500/8",
  danger:  "text-rose-300 border-rose-500/30 bg-rose-500/8",
};

/**
 * Returns true if the skill should be sanitized before install.
 * Workspace/community/unknown sources are mutable or external, so scan them.
 */
export const requiresSanitization = (trust: SkillTrustLevel): boolean =>
  trust === "workspace" || trust === "community" || trust === "unknown";
