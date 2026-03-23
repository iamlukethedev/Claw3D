import type { TranscriptEntry } from "@/features/agents/state/transcript";
import {
  DEFAULT_SKILL_TRIGGER_FALLBACKS_BY_SKILL_KEY,
  isOfficeSkillTriggerMovementTarget,
  type OfficeSkillTriggerMovementTarget,
} from "@/lib/office/places";
import { listPackagedSkills } from "@/lib/skills/catalog";
import { readPackagedSkillFiles } from "@/lib/skills/packaged";

type SkillTriggerJsonShape = {
  activation?: {
    anyPhrases?: unknown;
  };
  movement?: {
    target?: unknown;
    skipIfAlreadyThere?: unknown;
  };
};

export type SkillTriggerDefinition = {
  packageId: string;
  skillKey: string;
  skillName: string;
  activationPhrases: string[];
  movementTarget: OfficeSkillTriggerMovementTarget;
  skipIfAlreadyThere: boolean;
};

const TRIGGER_SECTION_RE = /##\s+Trigger\s*([\s\S]*?)(?:\n##\s+|\s*$)/i;
const JSON_CODE_BLOCK_RE = /```json\s*([\s\S]*?)```/i;

const normalizePhrase = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeMessage = (value: string | null | undefined): string =>
  normalizePhrase(value ?? "");

const extractTriggerJson = (markdown: string): SkillTriggerJsonShape | null => {
  const triggerSection = markdown.match(TRIGGER_SECTION_RE)?.[1] ?? "";
  if (!triggerSection) {
    return null;
  }
  const jsonBlock = triggerSection.match(JSON_CODE_BLOCK_RE)?.[1]?.trim() ?? "";
  if (!jsonBlock) {
    return null;
  }
  try {
    return JSON.parse(jsonBlock) as SkillTriggerJsonShape;
  } catch {
    return null;
  }
};

const parseSkillTriggerDefinition = (params: {
  packageId: string;
  skillKey: string;
  skillName: string;
  markdown: string;
}): SkillTriggerDefinition | null => {
  const parsed = extractTriggerJson(params.markdown);
  const fallback = DEFAULT_SKILL_TRIGGER_FALLBACKS_BY_SKILL_KEY[params.skillKey];
  if (!parsed && !fallback) {
    return null;
  }

  const activationPhrases = Array.isArray(parsed?.activation?.anyPhrases)
    ? Array.from(
        new Set(
          parsed.activation!.anyPhrases
            .filter((value): value is string => typeof value === "string")
            .map(normalizePhrase)
            .filter((value) => value.length > 0),
        ),
      )
    : fallback?.anyPhrases.map(normalizePhrase) ?? [];
  const movementTarget = parsed?.movement?.target;
  const resolvedMovementTarget = isOfficeSkillTriggerMovementTarget(movementTarget)
    ? movementTarget
    : fallback?.movementTarget;
  if (activationPhrases.length === 0 || !resolvedMovementTarget) {
    return null;
  }
  const skipIfAlreadyThere =
    typeof parsed?.movement?.skipIfAlreadyThere === "boolean"
      ? parsed.movement.skipIfAlreadyThere
      : fallback?.skipIfAlreadyThere ?? true;

  return {
    packageId: params.packageId,
    skillKey: params.skillKey,
    skillName: params.skillName,
    activationPhrases,
    movementTarget: resolvedMovementTarget,
    skipIfAlreadyThere,
  };
};

let packagedSkillTriggerCache: SkillTriggerDefinition[] | null = null;

export const listPackagedSkillTriggerDefinitions = (): SkillTriggerDefinition[] => {
  if (packagedSkillTriggerCache) {
    return packagedSkillTriggerCache.map((entry) => ({
      ...entry,
      activationPhrases: [...entry.activationPhrases],
    }));
  }

  const triggers: SkillTriggerDefinition[] = [];
  for (const skill of listPackagedSkills()) {
    const skillFile = readPackagedSkillFiles(skill.packageId).find(
      (file) => file.relativePath === "SKILL.md",
    );
    if (!skillFile) {
      continue;
    }
    const trigger = parseSkillTriggerDefinition({
      packageId: skill.packageId,
      skillKey: skill.skillKey,
      skillName: skill.name,
      markdown: skillFile.content,
    });
    if (trigger) {
      triggers.push(trigger);
    }
  }

  packagedSkillTriggerCache = triggers;
  return triggers.map((entry) => ({
    ...entry,
    activationPhrases: [...entry.activationPhrases],
  }));
};

export const resolveTriggeredSkillDefinition = (params: {
  isAgentRunning: boolean;
  lastUserMessage: string | null | undefined;
  transcriptEntries: TranscriptEntry[] | undefined;
  triggers: SkillTriggerDefinition[];
}): SkillTriggerDefinition | null => {
  if (!params.isAgentRunning || params.triggers.length === 0) {
    return null;
  }

  const candidates: string[] = [];
  const latestMessage = params.lastUserMessage?.trim() ?? "";
  if (latestMessage) {
    candidates.push(latestMessage);
  }
  if (Array.isArray(params.transcriptEntries)) {
    for (let index = params.transcriptEntries.length - 1; index >= 0; index -= 1) {
      const entry = params.transcriptEntries[index];
      if (!entry || entry.role !== "user") {
        continue;
      }
      const text = entry.text.trim();
      if (text) {
        candidates.push(text);
      }
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeMessage(candidate);
    let bestMatch: { trigger: SkillTriggerDefinition; phraseLength: number } | null = null;
    for (const trigger of params.triggers) {
      for (const phrase of trigger.activationPhrases) {
        if (!normalizedCandidate.includes(phrase)) {
          continue;
        }
        if (!bestMatch || phrase.length > bestMatch.phraseLength) {
          bestMatch = {
            trigger,
            phraseLength: phrase.length,
          };
        }
      }
    }
    if (bestMatch) {
      return bestMatch.trigger;
    }
  }

  return null;
};
