import {
  type CommandModeId,
} from "@/features/agents/operations/agentPermissionsOperation";
import {
  createEmptyPersonalityDraft,
  serializePersonalityFiles,
  type PersonalityBuilderDraft,
} from "@/lib/agents/personalityBuilder";
import type { AgentFileName } from "@/lib/agents/agentFiles";
import type {
  CompanyAgentBlueprint,
  CompanyBuilderPlan,
  CompanyBuilderRole,
  CompanyBuilderStoredSnapshot,
} from "@/features/company-builder/types";

type ParsedCompanyPlan = {
  companyName?: unknown;
  summary?: unknown;
  sharedRules?: unknown;
  plannerNotes?: unknown;
  roles?: unknown;
};

type ParsedCompanyRole = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  purpose?: unknown;
  soul?: unknown;
  responsibilities?: unknown;
  collaborators?: unknown;
  tools?: unknown;
  heartbeat?: unknown;
  emoji?: unknown;
  creature?: unknown;
  vibe?: unknown;
  userContext?: unknown;
  commandMode?: unknown;
};

const COMPANY_FENCE_RE = /^```(?:json)?\s*|\s*```$/gim;
const MAX_ROLE_COUNT = 8;

const normalizeLine = (value: string) => value.replace(/\r\n/g, "\n").trim();

const coerceString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const coerceStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values));

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toPascalCaseWord = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => `${entry.charAt(0).toUpperCase()}${entry.slice(1).toLowerCase()}`)
    .join("");

const normalizeRoleName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const singleWord = trimmed.replace(/[^a-zA-Z0-9]/g, "");
  if (singleWord.length > 0 && !/\s/.test(trimmed)) {
    return singleWord.slice(0, 18);
  }
  const compact = toPascalCaseWord(trimmed);
  return compact.slice(0, 18);
};

const dedupeCompactNames = (values: string[], fallbackPrefix: string) => {
  const used = new Set<string>();
  return values.map((value, index) => {
    const fallback = `${fallbackPrefix}${index + 1}`;
    const baseName = normalizeRoleName(value) || normalizeRoleName(fallback) || fallback;
    let nextName = baseName;
    let suffix = 2;
    while (used.has(nextName.toLowerCase())) {
      const suffixText = String(suffix);
      const trimmedBase = baseName.slice(0, Math.max(1, 18 - suffixText.length));
      nextName = `${trimmedBase}${suffixText}`;
      suffix += 1;
    }
    used.add(nextName.toLowerCase());
    return nextName;
  });
};

const toSentenceList = (values: string[]) =>
  values
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => (/[.!?]$/.test(entry) ? entry : `${entry}.`));

const resolveCommandMode = (value: unknown, roleText: string): CommandModeId => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "off" || normalized === "ask" || normalized === "auto") {
    return normalized;
  }
  const lowered = roleText.toLowerCase();
  if (/\b(developer|engineer|automation|devops|ops)\b/.test(lowered)) {
    return "auto";
  }
  if (/\b(manager|lead|qa|support|analyst|marketing|social)\b/.test(lowered)) {
    return "ask";
  }
  return "ask";
};

const buildRoleIdentity = (role: CompanyBuilderRole) => ({
  emoji: role.emoji || "🤖",
  creature: role.creature || "specialist",
  vibe: role.vibe || "helpful and focused",
});

const buildRoleAgentsMarkdown = (params: {
  plan: CompanyBuilderPlan;
  role: CompanyBuilderRole;
}) => {
  const collaborators =
    params.role.collaborators.length > 0
      ? params.role.collaborators
      : params.plan.roles
          .filter((entry) => entry.id !== params.role.id)
          .slice(0, 3)
          .map((entry) => entry.title);
  const responsibilityLines = toSentenceList(params.role.responsibilities);
  const sharedRules = toSentenceList(params.plan.sharedRules);
  const plannerNotes = toSentenceList(params.plan.plannerNotes);
  return [
    `# ${params.plan.companyName} Team Operating Guide`,
    "",
    `You are the ${params.role.title} inside ${params.plan.companyName}.`,
    "",
    "## Mission",
    "",
    params.role.purpose || `Own the ${params.role.title.toLowerCase()} function for the company.`,
    "",
    "## Responsibilities",
    "",
    ...(responsibilityLines.length > 0
      ? responsibilityLines.map((entry) => `- ${entry}`)
      : ["- Keep your area moving and surface blockers quickly."]),
    "",
    "## Collaborators",
    "",
    ...(collaborators.length > 0
      ? collaborators.map((entry) => `- Work closely with ${entry}.`)
      : ["- Coordinate with the rest of the company when work crosses team boundaries."]),
    "",
    "## Shared Rules",
    "",
    ...(sharedRules.length > 0
      ? sharedRules.map((entry) => `- ${entry}`)
      : [
          "- Keep updates concise, practical, and action-oriented.",
          "- Hand off work clearly when another role should take over.",
        ]),
    "",
    "## Planning Notes",
    "",
    ...(plannerNotes.length > 0
      ? plannerNotes.map((entry) => `- ${entry}`)
      : ["- Treat the user's company brief as the source of truth."]),
    "",
  ].join("\n");
};

const buildRoleToolsMarkdown = (role: CompanyBuilderRole) =>
  [
    "# TOOLS.md",
    "",
    `Preferred operating mode: ${role.commandMode}.`,
    "",
    "## Tool Preferences",
    "",
    ...(role.tools.length > 0
      ? role.tools.map((entry) => `- ${entry}.`)
      : [
          "- Use the tools that best match your role.",
          "- Ask for help when another teammate has better context.",
        ]),
    "",
  ].join("\n");

const buildRoleHeartbeatMarkdown = (role: CompanyBuilderRole) =>
  [
    "# HEARTBEAT.md",
    "",
    "When your heartbeat runs:",
    "",
    ...(role.heartbeat.length > 0
      ? role.heartbeat.map((entry) => `- ${entry}.`)
      : [
          "- Check your most important queue or active work.",
          "- Report blockers before they become expensive.",
          "- Coordinate with collaborators if handoffs are waiting.",
        ]),
    "",
  ].join("\n");

const buildRoleMemoryMarkdown = (params: {
  plan: CompanyBuilderPlan;
  role: CompanyBuilderRole;
}) =>
  [
    "# MEMORY.md",
    "",
    `Company: ${params.plan.companyName}.`,
    `Role: ${params.role.title}.`,
    "",
    "Remember:",
    "",
    `- ${params.plan.summary || "The company plan should guide your decisions."}`,
    `- ${params.role.purpose || "Protect the quality of your function."}`,
    "",
  ].join("\n");

const buildRoleSoulDraft = (params: {
  plan: CompanyBuilderPlan;
  role: CompanyBuilderRole;
}): PersonalityBuilderDraft => {
  const draft = createEmptyPersonalityDraft();
  const identity = buildRoleIdentity(params.role);
  draft.identity.name = params.role.title;
  draft.identity.emoji = identity.emoji;
  draft.identity.creature = identity.creature;
  draft.identity.vibe = identity.vibe;
  draft.user.context = normalizeLine(
    [
      `Company brief: ${params.plan.summary}`,
      params.role.userContext,
    ]
      .filter((entry) => entry.trim().length > 0)
      .join("\n\n")
  );
  draft.soul.coreTruths = normalizeLine(
    [
      params.role.soul,
      `Your job is to help ${params.plan.companyName} succeed as the ${params.role.title}.`,
    ]
      .filter((entry) => entry.trim().length > 0)
      .join("\n\n")
  );
  draft.soul.boundaries = normalizeLine(
    [
      "Do not invent decisions that should be handed to another specialist.",
      "Escalate blockers early and keep handoffs explicit.",
    ].join("\n")
  );
  draft.soul.vibe = normalizeLine(
    params.role.vibe || `${params.role.title} energy: practical, collaborative, and sharp.`
  );
  draft.soul.continuity = normalizeLine(
    `Keep continuity around ${params.plan.companyName}'s goals, teammates, and operating rules.`
  );
  draft.agents = buildRoleAgentsMarkdown(params);
  draft.tools = buildRoleToolsMarkdown(params.role);
  draft.heartbeat = buildRoleHeartbeatMarkdown(params.role);
  draft.memory = buildRoleMemoryMarkdown(params);
  return draft;
};

const normalizeRole = (value: ParsedCompanyRole, index: number): CompanyBuilderRole | null => {
  const title = normalizeRoleName(coerceString(value.name) || coerceString(value.title));
  if (!title) return null;
  const purpose = coerceString(value.purpose);
  const soul = coerceString(value.soul);
  const responsibilities = uniqueStrings(coerceStringArray(value.responsibilities)).slice(0, 8);
  const collaborators = uniqueStrings(coerceStringArray(value.collaborators)).slice(0, 8);
  const tools = uniqueStrings(coerceStringArray(value.tools)).slice(0, 8);
  const heartbeat = uniqueStrings(coerceStringArray(value.heartbeat)).slice(0, 8);
  const emoji = coerceString(value.emoji);
  const creature = coerceString(value.creature);
  const vibe = coerceString(value.vibe);
  const userContext = coerceString(value.userContext);
  const id = coerceString(value.id) || slugify(title) || `role-${index + 1}`;
  const roleText = [title, purpose, soul, ...responsibilities, ...tools].join(" ");
  return {
    id,
    title,
    purpose,
    soul,
    responsibilities,
    collaborators,
    tools,
    heartbeat,
    emoji,
    creature,
    vibe,
    userContext,
    commandMode: resolveCommandMode(value.commandMode, roleText),
  };
};

export const buildImproveCompanyBriefPrompt = (businessDescription: string) =>
  [
    "You are helping a user describe the company they want to build inside Claw3D.",
    "Rewrite their brief so another connected runtime agent can generate a clean org structure from it.",
    "Keep the answer short, concrete, and useful.",
    "Return markdown with these sections only:",
    "## Company",
    "## Goals",
    "## Constraints",
    "## Suggested Roles",
    "",
    "User brief:",
    businessDescription.trim(),
  ].join("\n");

export const buildGenerateCompanyPlanPrompt = (brief: string) =>
  [
    "You are designing an AI company org structure for Claw3D.",
    "Return only valid JSON with no markdown fence.",
    "Each role name must be one concise word only with no spaces.",
    "Schema:",
    "{",
    '  "companyName": "string",',
    '  "summary": "string",',
    '  "sharedRules": ["string"],',
    '  "plannerNotes": ["string"],',
    '  "roles": [',
    "    {",
    '      "id": "string",',
    '      "name": "string",',
    '      "purpose": "string",',
    '      "soul": "string",',
    '      "responsibilities": ["string"],',
    '      "collaborators": ["string"],',
    '      "tools": ["string"],',
    '      "heartbeat": ["string"],',
    '      "emoji": "string",',
    '      "creature": "string",',
    '      "vibe": "string",',
    '      "userContext": "string",',
    '      "commandMode": "off|ask|auto"',
    "    }",
    "  ]",
    "}",
    "Create between 2 and 6 roles unless the brief clearly needs more or less.",
    "Prefer silly but useful role titles when it helps the brand, but keep the org practical.",
    "Role names should be short single words like Builder, Analyst, Closer, Captain, Scout, or Designer.",
    "All role names must be unique.",
    "Make collaborators reference role names.",
    "",
    "Company brief:",
    brief.trim(),
  ].join("\n");

export const extractJsonFromAssistantText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("The planning agent returned an empty response.");
  }
  const unfenced = trimmed.replace(COMPANY_FENCE_RE, "").trim();
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("The planning agent did not return valid JSON.");
  }
  return unfenced.slice(firstBrace, lastBrace + 1);
};

export const parseCompanyPlanFromAssistantText = (value: string): CompanyBuilderPlan => {
  let parsed: ParsedCompanyPlan;
  try {
    parsed = JSON.parse(extractJsonFromAssistantText(value)) as ParsedCompanyPlan;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse the planning agent response.");
  }

  const rolesRaw = Array.isArray(parsed.roles) ? parsed.roles : [];
  const normalizedRoles = rolesRaw
    .map((entry, index) => normalizeRole((entry ?? {}) as ParsedCompanyRole, index))
    .filter((entry): entry is CompanyBuilderRole => Boolean(entry))
    .slice(0, MAX_ROLE_COUNT);
  if (normalizedRoles.length === 0) {
    throw new Error("The planning agent did not return any company roles.");
  }
  const uniqueTitles = dedupeCompactNames(
    normalizedRoles.map((entry) => entry.title),
    "Agent",
  );
  const usedIds = new Set<string>();
  const roles = normalizedRoles.map((role, index) => {
    const title = uniqueTitles[index] ?? role.title;
    const baseId = role.id.trim() || slugify(title) || `role-${index + 1}`;
    let nextId = baseId;
    let suffix = 2;
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(nextId);
    return {
      ...role,
      id: nextId,
      title,
    };
  });
  return {
    companyName: coerceString(parsed.companyName) || "New Company",
    summary: coerceString(parsed.summary) || "A company plan generated from the user's brief.",
    sharedRules: uniqueStrings(coerceStringArray(parsed.sharedRules)).slice(0, 12),
    plannerNotes: uniqueStrings(coerceStringArray(parsed.plannerNotes)).slice(0, 12),
    roles,
  };
};

export const buildCompanyAgentBlueprints = (plan: CompanyBuilderPlan): CompanyAgentBlueprint[] => {
  const usedNames = new Set<string>();
  return plan.roles.map((role, index) => {
    const baseName = role.title.trim() || `Agent ${index + 1}`;
    let nextName = baseName;
    let dedupe = 2;
    while (usedNames.has(nextName.toLowerCase())) {
      nextName = `${baseName} ${dedupe}`;
      dedupe += 1;
    }
    usedNames.add(nextName.toLowerCase());
    const roleWithName = { ...role, title: nextName };
    const draft = buildRoleSoulDraft({ plan, role: roleWithName });
    const files = serializePersonalityFiles(draft) as Record<AgentFileName, string>;
    return {
      agentName: nextName,
      role: roleWithName,
      draft,
      files,
    };
  });
};

export const buildStoredCompanySnapshot = (params: {
  prompt: string;
  improvedBrief: string;
  plan: CompanyBuilderPlan;
  now?: () => string;
}): CompanyBuilderStoredSnapshot => ({
  companyName: params.plan.companyName,
  prompt: params.prompt.trim(),
  improvedBrief: params.improvedBrief.trim(),
  summary: params.plan.summary,
  generatedAt: (params.now ?? (() => new Date().toISOString()))(),
  roleTitles: params.plan.roles.map((entry) => entry.title),
  planJson: JSON.stringify(params.plan),
});
