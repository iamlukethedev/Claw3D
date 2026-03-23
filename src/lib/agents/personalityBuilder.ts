import type { AgentFileName } from "@/lib/agents/agentFiles";

export type PersonalityBuilderDraft = {
  identity: {
    name: string;
    creature: string;
    vibe: string;
    emoji: string;
    avatar: string;
  };
  user: {
    name: string;
    callThem: string;
    pronouns: string;
    timezone: string;
    notes: string;
    context: string;
  };
  soul: {
    coreTruths: string;
    boundaries: string;
    vibe: string;
    continuity: string;
  };
  agents: string;
  tools: string;
  heartbeat: string;
  memory: string;
};

type AgentFilesInput = Record<AgentFileName, { content: string; exists: boolean }>;

export const createEmptyPersonalityDraft = (): PersonalityBuilderDraft => ({
  identity: {
    name: "",
    creature: "",
    vibe: "",
    emoji: "",
    avatar: "",
  },
  user: {
    name: "",
    callThem: "",
    pronouns: "",
    timezone: "",
    notes: "",
    context: "",
  },
  soul: {
    coreTruths: "",
    boundaries: "",
    vibe: "",
    continuity: "",
  },
  agents: "",
  tools: "",
  heartbeat: "",
  memory: "",
});

const cleanLabel = (value: string) => value.replace(/[*_]/g, "").trim().toLowerCase();

const cleanValue = (value: string) => {
  let next = value.trim();
  next = next.replace(/^[*_]+|[*_]+$/g, "").trim();
  return next;
};

const normalizeTemplateValue = (value: string) => {
  let normalized = value.trim();
  normalized = normalized.replace(/^[*_]+|[*_]+$/g, "").trim();
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  normalized = normalized.replace(/[\u2013\u2014]/g, "-");
  normalized = normalized.replace(/\s+/g, " ").toLowerCase();
  return normalized;
};

const IDENTITY_PLACEHOLDER_VALUES = new Set([
  "pick something you like",
  "ai? robot? familiar? ghost in the machine? something weirder?",
  "how do you come across? sharp? warm? chaotic? calm?",
  "your signature - pick one that feels right",
  "workspace-relative path, http(s) url, or data uri",
]);

const USER_PLACEHOLDER_VALUES = new Set([
  "optional",
]);

const USER_CONTEXT_PLACEHOLDER_VALUES = new Set([
  "what do they care about? what projects are they working on? what annoys them? what makes them laugh? build this over time.",
]);

const isIdentityPlaceholder = (value: string) =>
  IDENTITY_PLACEHOLDER_VALUES.has(normalizeTemplateValue(value));

const isUserPlaceholder = (value: string) => USER_PLACEHOLDER_VALUES.has(normalizeTemplateValue(value));

const isUserContextPlaceholder = (value: string) =>
  USER_CONTEXT_PLACEHOLDER_VALUES.has(normalizeTemplateValue(value));

const parseLabelMap = (content: string): Map<string, string> => {
  const map = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      break;
    }
    const normalized = trimmed.replace(/^[-*]\s*/, "");
    const colonIndex = normalized.indexOf(":");
    if (colonIndex < 0) {
      continue;
    }
    const label = cleanLabel(normalized.slice(0, colonIndex));
    if (!label) {
      continue;
    }
    if (map.has(label)) {
      continue;
    }
    const value = cleanValue(normalized.slice(colonIndex + 1));
    map.set(label, value);
  }
  return map;
};

const readFirst = (map: Map<string, string>, labels: string[]) => {
  for (const label of labels) {
    const value = map.get(label);
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
};

const isSectionHeading = (line: string) => /^##\s+/.test(line.trim());

const parseSection = (content: string, sectionTitle: string): string => {
  const lines = content.split(/\r?\n/);
  const target = `## ${sectionTitle}`.toLowerCase();
  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().toLowerCase() === target) {
      startIndex = index + 1;
      break;
    }
  }

  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;
  for (let index = startIndex; index < lines.length; index += 1) {
    if (isSectionHeading(lines[index])) {
      endIndex = index;
      break;
    }
  }

  while (startIndex < endIndex && lines[startIndex].trim().length === 0) {
    startIndex += 1;
  }
  while (endIndex > startIndex && lines[endIndex - 1].trim().length === 0) {
    endIndex -= 1;
  }

  if (startIndex >= endIndex) {
    return "";
  }

  return lines.slice(startIndex, endIndex).join("\n");
};

const normalizeText = (value: string) => value.replace(/\r\n/g, "\n").trim();

const normalizeListField = (value: string) => value.replace(/\r\n/g, "\n").trim();

const serializeIdentityMarkdown = (draft: PersonalityBuilderDraft["identity"]) => {
  const name = normalizeListField(draft.name);
  const creature = normalizeListField(draft.creature);
  const vibe = normalizeListField(draft.vibe);
  const emoji = normalizeListField(draft.emoji);
  const avatar = normalizeListField(draft.avatar);

  return [
    "# IDENTITY.md - Who Am I?",
    "",
    `- Name: ${name}`,
    `- Creature: ${creature}`,
    `- Vibe: ${vibe}`,
    `- Emoji: ${emoji}`,
    `- Avatar: ${avatar}`,
    "",
  ].join("\n");
};

const serializeUserMarkdown = (draft: PersonalityBuilderDraft["user"]) => {
  const name = normalizeListField(draft.name);
  const callThem = normalizeListField(draft.callThem);
  const pronouns = normalizeListField(draft.pronouns);
  const timezone = normalizeListField(draft.timezone);
  const notes = normalizeListField(draft.notes);
  const context = normalizeText(draft.context);

  return [
    "# USER.md - About Your Human",
    "",
    `- Name: ${name}`,
    `- What to call them: ${callThem}`,
    `- Pronouns: ${pronouns}`,
    `- Timezone: ${timezone}`,
    `- Notes: ${notes}`,
    "",
    "## Context",
    "",
    ...(context ? context.split("\n") : []),
    "",
  ].join("\n");
};

const serializeSoulMarkdown = (draft: PersonalityBuilderDraft["soul"]) => {
  const coreTruths = normalizeText(draft.coreTruths);
  const boundaries = normalizeText(draft.boundaries);
  const vibe = normalizeText(draft.vibe);
  const continuity = normalizeText(draft.continuity);

  return [
    "# SOUL.md - Who You Are",
    "",
    "## Core Truths",
    "",
    ...(coreTruths ? coreTruths.split("\n") : []),
    "",
    "## Boundaries",
    "",
    ...(boundaries ? boundaries.split("\n") : []),
    "",
    "## Vibe",
    "",
    ...(vibe ? vibe.split("\n") : []),
    "",
    "## Continuity",
    "",
    ...(continuity ? continuity.split("\n") : []),
    "",
  ].join("\n");
};

export const parsePersonalityFiles = (files: AgentFilesInput): PersonalityBuilderDraft => {
  const draft = createEmptyPersonalityDraft();

  const identity = parseLabelMap(files["IDENTITY.md"].content);
  const identityName = readFirst(identity, ["name"]);
  const identityCreature = readFirst(identity, ["creature"]);
  const identityVibe = readFirst(identity, ["vibe"]);
  const identityEmoji = readFirst(identity, ["emoji"]);
  const identityAvatar = readFirst(identity, ["avatar"]);
  draft.identity.name = isIdentityPlaceholder(identityName) ? "" : identityName;
  draft.identity.creature = isIdentityPlaceholder(identityCreature) ? "" : identityCreature;
  draft.identity.vibe = isIdentityPlaceholder(identityVibe) ? "" : identityVibe;
  draft.identity.emoji = isIdentityPlaceholder(identityEmoji) ? "" : identityEmoji;
  draft.identity.avatar = isIdentityPlaceholder(identityAvatar) ? "" : identityAvatar;

  const user = parseLabelMap(files["USER.md"].content);
  const userName = readFirst(user, ["name"]);
  const userCallThem = readFirst(user, ["what to call them", "preferred address", "how to address them"]);
  const userPronouns = readFirst(user, ["pronouns"]);
  const userTimezone = readFirst(user, ["timezone", "time zone"]);
  const userNotes = readFirst(user, ["notes"]);
  const userContext = parseSection(files["USER.md"].content, "Context");
  draft.user.name = isUserPlaceholder(userName) ? "" : userName;
  draft.user.callThem = isUserPlaceholder(userCallThem) ? "" : userCallThem;
  draft.user.pronouns = isUserPlaceholder(userPronouns) ? "" : userPronouns;
  draft.user.timezone = isUserPlaceholder(userTimezone) ? "" : userTimezone;
  draft.user.notes = isUserPlaceholder(userNotes) ? "" : userNotes;
  draft.user.context = isUserContextPlaceholder(userContext) ? "" : userContext;

  draft.soul.coreTruths = parseSection(files["SOUL.md"].content, "Core Truths");
  draft.soul.boundaries = parseSection(files["SOUL.md"].content, "Boundaries");
  draft.soul.vibe = parseSection(files["SOUL.md"].content, "Vibe");
  draft.soul.continuity = parseSection(files["SOUL.md"].content, "Continuity");

  draft.agents = files["AGENTS.md"].content;
  draft.tools = files["TOOLS.md"].content;
  draft.heartbeat = files["HEARTBEAT.md"].content;
  draft.memory = files["MEMORY.md"].content;

  return draft;
};

export const serializePersonalityFiles = (
  draft: PersonalityBuilderDraft
): Record<AgentFileName, string> => ({
  "AGENTS.md": draft.agents,
  "SOUL.md": serializeSoulMarkdown(draft.soul),
  "IDENTITY.md": serializeIdentityMarkdown(draft.identity),
  "USER.md": serializeUserMarkdown(draft.user),
  "TOOLS.md": draft.tools,
  "HEARTBEAT.md": draft.heartbeat,
  "MEMORY.md": draft.memory,
});
