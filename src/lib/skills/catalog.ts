import type {
  RemovableSkillSource,
  SkillStatusEntry,
} from "@/lib/skills/types";

export type PackagedSkillId = "soundclaw" | "task-manager" | "todo-board";

export type PackagedSkillDefinition = {
  packageId: PackagedSkillId;
  skillKey: string;
  name: string;
  description: string;
  installSource: RemovableSkillSource;
  creatorName?: string;
  creatorUrl?: string;
};

const EMPTY_REQUIREMENTS = {
  bins: [],
  anyBins: [],
  env: [],
  config: [],
  os: [],
};

const PACKAGED_SKILLS: PackagedSkillDefinition[] = [
  {
    packageId: "todo-board",
    skillKey: "todo-board",
    name: "todo",
    description: "Maintain a shared workspace TODO list with blocked tasks.",
    installSource: "openclaw-workspace",
    creatorName: "iamlukethedev",
    creatorUrl: "http://x.com/iamlukethedev/",
  },
  {
    packageId: "task-manager",
    skillKey: "task-manager",
    name: "task-manager",
    description:
      "Capture actionable requests as persistent tasks and keep a shared Kanban task store in sync.",
    installSource: "openclaw-workspace",
    creatorName: "iamlukethedev",
    creatorUrl: "https://github.com/iamlukethedev",
  },
  {
    packageId: "soundclaw",
    skillKey: "soundclaw",
    name: "soundclaw",
    description: "Control Spotify playback, search music, and return shareable music links.",
    installSource: "openclaw-workspace",
    creatorName: "iamlukethedev",
    creatorUrl: "https://github.com/iamlukethedev",
  },
];

export const listPackagedSkills = (): PackagedSkillDefinition[] => [
  ...PACKAGED_SKILLS,
];

export const getPackagedSkillById = (
  packageId: string,
): PackagedSkillDefinition | null =>
  PACKAGED_SKILLS.find((skill) => skill.packageId === packageId) ?? null;

export const getPackagedSkillBySkillKey = (
  skillKey: string,
): PackagedSkillDefinition | null => {
  const normalized = skillKey.trim();
  return PACKAGED_SKILLS.find((skill) => skill.skillKey === normalized) ?? null;
};

export const buildPackagedSkillStatusEntry = (
  skill: PackagedSkillDefinition,
): SkillStatusEntry => ({
  name: skill.name,
  description: skill.description,
  source: "openclaw-extra",
  bundled: false,
  filePath: "",
  baseDir: "",
  skillKey: skill.skillKey,
  always: false,
  disabled: false,
  blockedByAllowlist: false,
  eligible: false,
  requirements: { ...EMPTY_REQUIREMENTS },
  missing: { ...EMPTY_REQUIREMENTS },
  configChecks: [],
  install: [],
});

export const appendPackagedSkillsToMarketplace = (
  skills: SkillStatusEntry[],
): SkillStatusEntry[] => {
  const presentKeys = new Set(skills.map((skill) => skill.skillKey.trim()));
  const additions = PACKAGED_SKILLS.filter(
    (skill) => !presentKeys.has(skill.skillKey),
  ).map(buildPackagedSkillStatusEntry);
  if (additions.length === 0) {
    return skills;
  }
  return [...additions, ...skills];
};
