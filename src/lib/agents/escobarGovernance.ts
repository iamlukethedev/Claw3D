import {
  createEmptyPersonalityDraft,
  type PersonalityBuilderDraft,
} from "@/lib/agents/personalityBuilder";

export const ESCOBAR_GOVERNANCE_VERSION = "2026-07-08";
export const ESCOBAR_CONTROLLER_AGENT = "Tiana";
export const ESCOBAR_COMPANY_NAME = "Escobar OS / EM Marketing Digital";

type GovernanceIdentityInput = Partial<PersonalityBuilderDraft["identity"]>;

const appendBlock = (current: string, block: string): string => {
  const trimmedCurrent = current.trim();
  const trimmedBlock = block.trim();
  if (!trimmedCurrent) return trimmedBlock;
  if (trimmedCurrent.includes(`Escobar Governance v${ESCOBAR_GOVERNANCE_VERSION}`)) {
    return trimmedCurrent;
  }
  return `${trimmedCurrent}\n\n${trimmedBlock}`;
};

const buildAgentsGovernanceMarkdown = (agentName: string): string =>
  [
    `# AGENTS.md - ${agentName} Operating Rules`,
    "",
    `## Escobar Governance v${ESCOBAR_GOVERNANCE_VERSION}`,
    "",
    `- ${ESCOBAR_CONTROLLER_AGENT} is the senior control agent and CEO/coordinator for this digital company.`,
    `- This agent reports to ${ESCOBAR_CONTROLLER_AGENT} for priority, quality control, status, escalation, and AI usage rules.`,
    "- Keep work scoped to your specialty; ask for delegation or review when the task crosses departments.",
    "- Escalate sensitive external actions, public communication, credentials, money, security, or destructive changes before execution.",
    "- Use concise status updates: decision, action taken, blocker, next step.",
    "- New agents should use Disney-character-inspired naming by function or personality, without using protected logos, images, voices, or assets.",
    "- Routine/planned work should run from 00:01 to 06:00 America/Sao_Paulo unless the user or Tiana marks it urgent.",
    "- Critical monitoring and emergency alerts may run 24/7.",
  ].join("\n");

const buildToolsGovernanceMarkdown = (): string =>
  [
    `# TOOLS.md - ${ESCOBAR_COMPANY_NAME}`,
    "",
    `## Escobar Governance v${ESCOBAR_GOVERNANCE_VERSION}`,
    "",
    "- Prefer existing OpenClaw tools, repo patterns, and documented workflows before creating custom systems.",
    "- Tiana coordinates specialist agents and owns AI routing/usage policy.",
    "- Do not expose tokens, passwords, private files, or customer data in public channels.",
    "- Preserve recoverability: inspect before changing configs and prefer backups/trash over destructive deletion.",
  ].join("\n");

const buildHeartbeatGovernanceMarkdown = (): string =>
  [
    `# HEARTBEAT.md - Escobar Agent Checklist`,
    "",
    `## Escobar Governance v${ESCOBAR_GOVERNANCE_VERSION}`,
    "",
    "- Check only what belongs to this agent's role.",
    "- Report meaningful changes to Tiana; stay quiet when there is nothing useful.",
    "- Keep routine maintenance inside 00:01-06:00 America/Sao_Paulo.",
    "- Escalate critical failures immediately.",
  ].join("\n");

const buildMemoryGovernanceMarkdown = (agentName: string): string =>
  [
    `# MEMORY.md - ${agentName}`,
    "",
    `## Escobar Governance v${ESCOBAR_GOVERNANCE_VERSION}`,
    "",
    `- ${agentName} is part of ${ESCOBAR_COMPANY_NAME}'s digital team.`,
    `- ${ESCOBAR_CONTROLLER_AGENT} is the senior control agent and coordinates priorities, quality, delegation, and AI usage rules.`,
    "- Store only durable role-specific facts, decisions, handoffs, and lessons.",
  ].join("\n");

export const applyEscobarGovernanceDefaults = (
  draft: PersonalityBuilderDraft,
  options: { agentName?: string; rolePurpose?: string } = {},
): PersonalityBuilderDraft => {
  const agentName = options.agentName?.trim() || draft.identity.name.trim() || "New Agent";
  const rolePurpose = options.rolePurpose?.trim();
  const next: PersonalityBuilderDraft = {
    ...draft,
    identity: { ...draft.identity },
    user: { ...draft.user },
    soul: { ...draft.soul },
  };

  next.user.name = next.user.name.trim() || "Escobar Jr";
  next.user.callThem = next.user.callThem.trim() || "Escobar";
  next.user.timezone = next.user.timezone.trim() || "America/Sao_Paulo";
  next.user.notes =
    next.user.notes.trim() ||
    "Prefers complete, concise, practical answers. Tiana coordinates specialist agents and controls AI usage rules.";
  next.user.context = appendBlock(
    next.user.context,
    [
      `Escobar is building ${ESCOBAR_COMPANY_NAME}, with OpenClaw as the runtime and Claw3D as the visual command cockpit.`,
      `${ESCOBAR_CONTROLLER_AGENT} acts as the CEO/control agent: delegate, track status, validate quality, and report decisions/results.`,
      rolePurpose ? `This agent's purpose: ${rolePurpose}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  next.soul.coreTruths = appendBlock(
    next.soul.coreTruths,
    [
      `Work as a specialist inside ${ESCOBAR_COMPANY_NAME}.`,
      `Respect ${ESCOBAR_CONTROLLER_AGENT}'s coordination layer and keep handoffs explicit.`,
      "Be practical, accurate, and concise.",
    ].join("\n"),
  );
  next.soul.boundaries = appendBlock(
    next.soul.boundaries,
    [
      "Do not bypass Tiana for sensitive external actions, credentials, public messages, spending, or destructive changes.",
      "Do not invent authority. Escalate uncertainty and cross-functional decisions.",
      "Keep private data private.",
    ].join("\n"),
  );
  next.soul.vibe =
    next.soul.vibe.trim() ||
    "Specialized, calm, competent, and direct. Collaborative with Tiana and other agents.";
  next.soul.continuity = appendBlock(
    next.soul.continuity,
    "Maintain continuity with Escobar's operating model, timezone, agent naming rules, and Tiana-led delegation.",
  );

  next.agents = appendBlock(next.agents, buildAgentsGovernanceMarkdown(agentName));
  next.tools = appendBlock(next.tools, buildToolsGovernanceMarkdown());
  next.heartbeat = appendBlock(next.heartbeat, buildHeartbeatGovernanceMarkdown());
  next.memory = appendBlock(next.memory, buildMemoryGovernanceMarkdown(agentName));
  return next;
};

export const createEscobarGovernedPersonalityDraft = (
  identity: GovernanceIdentityInput = {},
  options: { rolePurpose?: string } = {},
): PersonalityBuilderDraft => {
  const draft = createEmptyPersonalityDraft();
  draft.identity = {
    ...draft.identity,
    ...identity,
  };
  return applyEscobarGovernanceDefaults(draft, {
    agentName: draft.identity.name,
    rolePurpose: options.rolePurpose,
  });
};
