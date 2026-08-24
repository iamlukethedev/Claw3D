import type { AgentState } from "@/features/agents/state/store";
import type { OfficeAnimationState } from "@/lib/office/eventTriggers";
import {
  normalizeOfficeStateToken,
  type OfficeStateAnimationMapping,
  type OfficeStateAnimationTarget,
} from "@/lib/office/stateMappingConfig";

type BooleanByAgentId = Record<string, boolean>;

type OfficeStateAnimationHoldMaps = {
  deskHoldByAgentId: BooleanByAgentId;
  githubHoldByAgentId: BooleanByAgentId;
  gymHoldByAgentId: BooleanByAgentId;
  jukeboxHoldByAgentId: BooleanByAgentId;
  qaHoldByAgentId: BooleanByAgentId;
  smsBoothHoldByAgentId: BooleanByAgentId;
  phoneBoothHoldByAgentId: BooleanByAgentId;
  skillGymHoldByAgentId: BooleanByAgentId;
};

export type OfficeStateAnimationMappingResult = OfficeStateAnimationHoldMaps & {
  matchedMappingByAgentId: Record<string, OfficeStateAnimationMapping>;
};

const emptyHoldMaps = (): OfficeStateAnimationHoldMaps => ({
  deskHoldByAgentId: {},
  githubHoldByAgentId: {},
  gymHoldByAgentId: {},
  jukeboxHoldByAgentId: {},
  qaHoldByAgentId: {},
  smsBoothHoldByAgentId: {},
  phoneBoothHoldByAgentId: {},
  skillGymHoldByAgentId: {},
});

const setTargetHold = (
  maps: OfficeStateAnimationHoldMaps,
  agentId: string,
  target: OfficeStateAnimationTarget,
) => {
  if (target === "desk") maps.deskHoldByAgentId[agentId] = true;
  if (target === "server_room") maps.githubHoldByAgentId[agentId] = true;
  if (target === "gym") {
    maps.gymHoldByAgentId[agentId] = true;
    maps.skillGymHoldByAgentId[agentId] = true;
  }
  if (target === "jukebox") maps.jukeboxHoldByAgentId[agentId] = true;
  if (target === "qa_lab") maps.qaHoldByAgentId[agentId] = true;
  if (target === "sms_booth") maps.smsBoothHoldByAgentId[agentId] = true;
  if (target === "phone_booth") maps.phoneBoothHoldByAgentId[agentId] = true;
};

const deriveAgentStateTokens = (
  agent: AgentState,
  animationState: Pick<
    OfficeAnimationState,
    | "awaitingApprovalByAgentId"
    | "streamingByAgentId"
    | "thinkingByAgentId"
    | "workingUntilByAgentId"
  >,
  nowMs: number,
): string[] => {
  const tokens = new Set<string>();
  tokens.add(normalizeOfficeStateToken(agent.status));
  if (agent.runId || agent.status === "running") tokens.add("executing");
  if ((animationState.workingUntilByAgentId[agent.agentId] ?? 0) > nowMs) {
    tokens.add("working");
    tokens.add("executing");
  }
  if (animationState.streamingByAgentId[agent.agentId] || agent.streamText?.trim()) {
    tokens.add("writing");
  }
  if (animationState.thinkingByAgentId[agent.agentId] || agent.thinkingTrace?.trim()) {
    tokens.add("thinking");
  }
  if (animationState.awaitingApprovalByAgentId[agent.agentId] || agent.awaitingUserInput) {
    tokens.add("waiting");
    tokens.add("approval_pending");
  }
  if (agent.status === "error") tokens.add("error");
  return [...tokens].filter(Boolean);
};

export const buildOfficeStateAnimationMappingResult = (params: {
  agents: AgentState[];
  animationState: Pick<
    OfficeAnimationState,
    | "awaitingApprovalByAgentId"
    | "streamingByAgentId"
    | "thinkingByAgentId"
    | "workingUntilByAgentId"
  >;
  mappings: OfficeStateAnimationMapping[];
  nowMs?: number;
}): OfficeStateAnimationMappingResult => {
  const maps = emptyHoldMaps();
  const matchedMappingByAgentId: Record<string, OfficeStateAnimationMapping> = {};
  const enabledMappings = params.mappings
    .filter((mapping) => mapping.enabled && mapping.animationTarget !== "none")
    .sort((left, right) => right.priority - left.priority);
  const mappingByState = new Map<string, OfficeStateAnimationMapping>();
  for (const mapping of enabledMappings) {
    if (!mappingByState.has(mapping.sourceState)) {
      mappingByState.set(mapping.sourceState, mapping);
    }
  }

  const nowMs = params.nowMs ?? Date.now();
  for (const agent of params.agents) {
    const tokens = deriveAgentStateTokens(agent, params.animationState, nowMs);
    const matched = tokens
      .map((token) => mappingByState.get(token))
      .find((mapping): mapping is OfficeStateAnimationMapping => Boolean(mapping));
    if (!matched) continue;
    matchedMappingByAgentId[agent.agentId] = matched;
    setTargetHold(maps, agent.agentId, matched.animationTarget);
  }

  return {
    ...maps,
    matchedMappingByAgentId,
  };
};
