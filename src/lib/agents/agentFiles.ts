// Must match the gateway's WORKSPACE_BOOTSTRAP_FILENAMES allowlist (server-methods/agents-files.ts);
// requesting a name outside it rejects the whole Promise.all batch in useAgentFilesEditor.
export const AGENT_FILE_NAMES = [
  "AGENTS.md",
  "SOUL.md",
  "IDENTITY.md",
  "USER.md",
  "BOOTSTRAP.md",
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

// Broader than AgentFileName: covers legacy names (TOOLS.md, HEARTBEAT.md) still referenced by the
// agent-creation wizard and personalityBuilder, which are independent of what useAgentFilesEditor fetches.
export type KnownAgentFileName = AgentFileName | "TOOLS.md" | "HEARTBEAT.md";

export const AGENT_FILE_META: Record<KnownAgentFileName, { title: string; hint: string }> = {
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
  "BOOTSTRAP.md": {
    title: "BOOTSTRAP.md",
    hint: "First-run onboarding notes.",
  },
  "MEMORY.md": {
    title: "MEMORY.md",
    hint: "Durable memory for this agent.",
  },
  "TOOLS.md": {
    title: "TOOLS.md",
    hint: "Local tool notes and conventions.",
  },
  "HEARTBEAT.md": {
    title: "HEARTBEAT.md",
    hint: "Small checklist for heartbeat runs.",
  },
};

export const AGENT_FILE_PLACEHOLDERS: Record<KnownAgentFileName, string> = {
  "AGENTS.md": "How should this agent work? Priorities, rules, and habits.",
  "SOUL.md": "Tone, personality, boundaries, and how it should sound.",
  "IDENTITY.md": "Name, vibe, emoji, and a one-line identity.",
  "USER.md": "How should it address you? Preferences and context.",
  "BOOTSTRAP.md": "First-run onboarding notes.",
  "MEMORY.md": "Durable facts, decisions, and preferences to remember.",
  "TOOLS.md": "Local tool notes, conventions, and shortcuts.",
  "HEARTBEAT.md": "A tiny checklist for periodic runs.",
};

export const createAgentFilesState = () =>
  Object.fromEntries(
    AGENT_FILE_NAMES.map((name) => [name, { content: "", exists: false, path: null, workspace: null }])
  ) as Record<AgentFileName, { content: string; exists: boolean; path: string | null; workspace: string | null }>;

// Drops any key the gateway doesn't accept (e.g. legacy TOOLS.md/HEARTBEAT.md) before a write, so
// callers that still build the full KnownAgentFileName set (the create-agent wizard, company builder)
// can't accidentally send an unsupported filename to agents.files.set.
export const pickAllowedAgentFiles = (
  files: Partial<Record<KnownAgentFileName, string>>
): Partial<Record<AgentFileName, string>> =>
  Object.fromEntries(
    AGENT_FILE_NAMES.filter((name) => files[name] !== undefined).map((name) => [name, files[name] as string])
  );
