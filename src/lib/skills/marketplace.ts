import {
  buildSkillMissingDetails,
  canRemoveSkill,
  deriveSkillReadinessState,
  groupSkillsBySource,
  hasInstallableMissingBinary,
  type SkillReadinessState,
} from "@/lib/skills/presentation";
import { getPackagedSkillBySkillKey } from "@/lib/skills/catalog";
import type { SkillStatusEntry } from "@/lib/skills/types";
import {
  resolveSkillTrustLevel,
  TRUST_LEVEL_LABELS,
  type SkillTrustLevel,
} from "@/lib/skills/sanitize";

// ---------------------------------------------------------------------------
// Collection IDs
// ---------------------------------------------------------------------------

export type SkillMarketplaceCollectionId =
  | "claw3d"
  | "featured"
  | "installed"
  | "setup-required"
  | "built-in"
  | "workspace"
  | "community"
  | "extra"
  | "other";

// ---------------------------------------------------------------------------
// Marketplace metadata types
// ---------------------------------------------------------------------------

export type SkillMarketplaceMetadata = {
  category: string;
  tagline: string;
  trustLabel: string;
  trustLevel: SkillTrustLevel;
  capabilities: string[];
  featured?: boolean;
  editorBadge?: string;
  rating?: number;
  installs?: number;
  poweredByName?: string;
  poweredByUrl?: string;
  hideStats?: boolean;
};

export type SkillMarketplaceEntry = {
  skill: SkillStatusEntry;
  readiness: SkillReadinessState;
  metadata: SkillMarketplaceMetadata;
  installable: boolean;
  removable: boolean;
  missingDetails: string[];
};

// ---------------------------------------------------------------------------
// Per-skill display overrides (curated display data for well-known skills)
// Keyed by skillKey. These override the auto-derived fallback metadata.
// ---------------------------------------------------------------------------

const SKILL_DISPLAY_OVERRIDES: Record<
  string,
  Partial<Omit<SkillMarketplaceMetadata, "trustLabel" | "trustLevel">>
> = {
  github: {
    category: "Engineering",
    tagline: "Turns repository operations into a one-step teammate workflow.",
    capabilities: ["Pull request support", "Issue context", "Repository operations"],
    featured: true,
    editorBadge: "Popular",
    rating: 4.9,
    installs: 18240,
  },
  figma: {
    category: "Design",
    tagline: "Connects design files, specs, and implementation context.",
    capabilities: ["Design context", "Asset lookup", "Spec handoff"],
    featured: true,
    editorBadge: "Editor pick",
    rating: 4.8,
    installs: 9640,
  },
  slack: {
    category: "Communication",
    tagline: "Keeps agents plugged into team channels and notifications.",
    capabilities: ["Channel updates", "Message drafting", "Notification routing"],
    featured: true,
    rating: 4.7,
    installs: 14110,
  },
  linear: {
    category: "Planning",
    tagline: "Brings issue tracking and execution loops directly into agent workflows.",
    capabilities: ["Issue lookup", "Status updates", "Planning workflows"],
    featured: true,
    rating: 4.7,
    installs: 11980,
  },
  "todo-board": {
    category: "Productivity",
    tagline: "Gives agents a shared workspace TODO board with blocked-task tracking.",
    capabilities: ["Task capture", "Blocked tracking", "Shared workspace state"],
    featured: true,
    editorBadge: "Claw3D test",
    hideStats: true,
  },
  "task-manager": {
    category: "Productivity",
    tagline: "Turns actionable requests into persistent shared tasks that power the Kanban board.",
    capabilities: ["Automatic task capture", "Task lifecycle tracking", "Shared Kanban state"],
    featured: true,
    editorBadge: "Kanban core",
    hideStats: true,
  },
  soundclaw: {
    category: "Audio",
    tagline: "Lets agents search Spotify, control playback, and return music links on the current channel.",
    capabilities: ["Spotify search", "Playback control", "Same-channel link sharing"],
    featured: true,
    editorBadge: "Office demo",
    hideStats: true,
  },
};

// ---------------------------------------------------------------------------
// Trust-level → display category mapping (generic, no product hardcoding)
// ---------------------------------------------------------------------------

const TRUST_CATEGORY: Record<SkillTrustLevel, string> = {
  verified:  "Built-in",
  managed:   "Installed",
  workspace: "Workspace",
  community: "Community",
  unknown:   "Unverified",
};

// ---------------------------------------------------------------------------
// Fallback metadata builder
// ---------------------------------------------------------------------------

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

const titleCaseWords = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter((p) => p.length > 0)
    .map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}`)
    .join(" ");

const buildFallbackCapabilities = (skill: SkillStatusEntry): string[] => {
  const caps: string[] = [];
  if (skill.primaryEnv) caps.push(`Uses ${skill.primaryEnv}.`);
  if (skill.install.length > 0) caps.push("Supports guided dependency install.");
  if (skill.always) caps.push("Always available by policy.");
  if (skill.homepage) caps.push("Has external docs.");
  if (caps.length === 0) caps.push("Reusable operational workflow.");
  return caps.slice(0, 3);
};

const buildFallbackMetadata = (skill: SkillStatusEntry): SkillMarketplaceMetadata => {
  const trust      = resolveSkillTrustLevel(skill.source.trim(), skill.bundled);
  const seed       = hashString(`${skill.skillKey.trim()}:${skill.source.trim()}`);
  const isFeatured = trust === "verified" || trust === "managed";

  return {
    category:     TRUST_CATEGORY[trust],
    tagline:      skill.description.trim() || `${titleCaseWords(skill.name)} capability pack.`,
    trustLabel:   TRUST_LEVEL_LABELS[trust],
    trustLevel:   trust,
    capabilities: buildFallbackCapabilities(skill),
    featured:     isFeatured,
    rating:       4.2 + (seed % 7) / 10,
    installs:     400 + (seed % 9500),
  };
};

// ---------------------------------------------------------------------------
// Public metadata resolver
// ---------------------------------------------------------------------------

export const resolveSkillMarketplaceMetadata = (
  skill: SkillStatusEntry,
): SkillMarketplaceMetadata => {
  const trust       = resolveSkillTrustLevel(skill.source.trim(), skill.bundled);
  const fallback    = buildFallbackMetadata(skill);
  const override    = SKILL_DISPLAY_OVERRIDES[skill.skillKey.trim().toLowerCase()];
  const packaged    = getPackagedSkillBySkillKey(skill.skillKey);

  return {
    ...fallback,
    ...(override ?? {}),
    // Trust fields always come from the computed level, never from overrides
    trustLabel: TRUST_LEVEL_LABELS[trust],
    trustLevel: trust,
    capabilities: override?.capabilities ?? fallback.capabilities,
    poweredByName: packaged?.creatorName,
    poweredByUrl:  packaged?.creatorUrl,
    hideStats: override?.hideStats ?? Boolean(packaged),
  };
};

// ---------------------------------------------------------------------------
// Entry builder
// ---------------------------------------------------------------------------

export const buildSkillMarketplaceEntry = (
  skill: SkillStatusEntry,
): SkillMarketplaceEntry => {
  const packaged      = getPackagedSkillBySkillKey(skill.skillKey);
  const missingDetails = buildSkillMissingDetails(skill);

  if (packaged && !skill.baseDir.trim()) {
    missingDetails.unshift("Install this skill to make it available on the gateway.");
  }

  return {
    skill,
    readiness:    deriveSkillReadinessState(skill),
    metadata:     resolveSkillMarketplaceMetadata(skill),
    installable:  hasInstallableMissingBinary(skill),
    removable:    canRemoveSkill(skill),
    missingDetails,
  };
};

// ---------------------------------------------------------------------------
// Collection builder
// ---------------------------------------------------------------------------

export const buildSkillMarketplaceCollections = (
  skills: SkillStatusEntry[],
): Array<{
  id: SkillMarketplaceCollectionId;
  label: string;
  entries: SkillMarketplaceEntry[];
}> => {
  const entries = skills.map(buildSkillMarketplaceEntry);
  const sourceGroups = groupSkillsBySource(skills);

  const collections: Array<{
    id: SkillMarketplaceCollectionId;
    label: string;
    entries: SkillMarketplaceEntry[];
  }> = [];

  // Featured — curated top picks, capped at 6
  const featured = entries.filter((e) => e.metadata.featured).slice(0, 6);
  if (featured.length > 0) {
    collections.push({ id: "featured", label: "Featured", entries: featured });
  }

  // Packaged Claw3D skills
  const claw3d = entries.filter((e) => getPackagedSkillBySkillKey(e.skill.skillKey));
  if (claw3d.length > 0) {
    collections.push({ id: "claw3d", label: "Claw3D", entries: claw3d });
  }

  // Installed / ready
  const installed = entries.filter(
    (e) => e.readiness === "ready" || e.skill.disabled,
  );
  if (installed.length > 0) {
    collections.push({ id: "installed", label: "Installed", entries: installed });
  }

  // Needs setup
  const setupRequired = entries.filter((e) => e.readiness === "needs-setup");
  if (setupRequired.length > 0) {
    collections.push({ id: "setup-required", label: "Needs setup", entries: setupRequired });
  }

  // Source groups — map generic group IDs to collection IDs
  const groupToCollectionId: Record<string, SkillMarketplaceCollectionId> = {
    "built-in":  "built-in",
    "workspace": "workspace",
    "installed": "installed",
    "extra":     "extra",
    "community": "community",
    "unknown":   "other",
    "other":     "other",
  };

  for (const group of sourceGroups) {
    const collectionId = groupToCollectionId[group.id] ?? "other";
    const groupEntries = group.skills.map(buildSkillMarketplaceEntry);
    collections.push({
      id: collectionId,
      label: group.label,
      entries: groupEntries,
    });
  }

  return collections;
};
