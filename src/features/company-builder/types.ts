import type { PersonalityBuilderDraft } from "@/lib/agents/personalityBuilder";
import type { AgentFileName } from "@/lib/agents/agentFiles";
import type { CommandModeId } from "@/features/agents/operations/agentPermissionsOperation";

export type CompanyBuilderInput = {
  businessDescription: string;
  improvedBrief: string;
};

export type CompanyBuilderRole = {
  id: string;
  title: string;
  purpose: string;
  soul: string;
  responsibilities: string[];
  collaborators: string[];
  tools: string[];
  heartbeat: string[];
  emoji: string;
  creature: string;
  vibe: string;
  userContext: string;
  commandMode: CommandModeId;
};

export type CompanyBuilderPlan = {
  companyName: string;
  summary: string;
  sharedRules: string[];
  plannerNotes: string[];
  roles: CompanyBuilderRole[];
};

export type CompanyBuilderStoredSnapshot = {
  companyName: string;
  prompt: string;
  improvedBrief: string;
  summary: string;
  generatedAt: string;
  roleTitles: string[];
  planJson: string;
};

export type CompanyAgentBlueprint = {
  agentName: string;
  role: CompanyBuilderRole;
  draft: PersonalityBuilderDraft;
  files: Record<AgentFileName, string>;
};
