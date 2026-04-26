export const AGENT_FILE_NAMES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "MEMORY.md",
] as const;

export type AgentFileName = (typeof AGENT_FILE_NAMES)[number];

export const PERSONALITY_FILE_NAMES = [
  "SOUL.md",
  "AGENTS.md",
  "USER.md",
  "IDENTITY.md",
] as const satisfies readonly AgentFileName[];

export type PersonalityFileName = (typeof PERSONALITY_FILE_NAMES)[number];

export const PERSONALITY_FILE_LABELS: Record<PersonalityFileName, string> = {
  "SOUL.md": "Persona",
  "AGENTS.md": "Directives",
  "USER.md": "Context",
  "IDENTITY.md": "Identity",
};

export const isAgentFileName = (value: string): value is AgentFileName =>
  AGENT_FILE_NAMES.includes(value as AgentFileName);

export const AGENT_FILE_META: Record<AgentFileName, { title: string; hint: string }> = {
  "AGENTS.md": {
    title: "AGENTS.md",
    hint: "Operating instructions, priorities, and rules.",
  },
  "SOUL.md": {
    title: "SOUL.md",
    hint: "Persona, tone, and boundaries.",
  },
  "IDENTITY.md": {
    title: "IDENTITY.md",
    hint: "Name, vibe, and emoji.",
  },
  "USER.md": {
    title: "USER.md",
    hint: "User profile and preferences.",
  },
  "TOOLS.md": {
    title: "TOOLS.md",
    hint: "Local tool notes and conventions.",
  },
  "HEARTBEAT.md": {
    title: "HEARTBEAT.md",
    hint: "Small checklist for heartbeat runs.",
  },
  "MEMORY.md": {
    title: "MEMORY.md",
    hint: "Durable memory for this agent.",
  },
};

export const AGENT_FILE_PLACEHOLDERS: Record<AgentFileName, string> = {
  "AGENTS.md": "How should this agent work? Priorities, rules, and habits.",
  "SOUL.md": "Tone, personality, boundaries, and how it should sound.",
  "IDENTITY.md": "Name, vibe, emoji, and a one-line identity.",
  "USER.md": "How should it address you? Preferences and context.",
  "TOOLS.md": "Local tool notes, conventions, and shortcuts.",
  "HEARTBEAT.md": "A tiny checklist for periodic runs.",
  "MEMORY.md": "Durable facts, decisions, and preferences to remember.",
};

export const createAgentFilesState = () =>
  Object.fromEntries(
    AGENT_FILE_NAMES.map((name) => [name, { content: "", exists: false, path: null, workspace: null }])
  ) as Record<AgentFileName, { content: string; exists: boolean; path: string | null; workspace: string | null }>;
