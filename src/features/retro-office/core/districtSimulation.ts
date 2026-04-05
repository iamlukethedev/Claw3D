import type { OfficeAgent } from "@/features/retro-office/core/types";

export const DISTRICT_SIM_DEFAULT_DISTRICT_COUNT = 10;
export const DISTRICT_SIM_DEFAULT_MAX_AGENTS = 10;

export type DistrictSimulationNeeds = {
  hunger: number;
  energy: number;
  social: number;
  comfort: number;
};

export type DistrictSimulationActivity =
  | "work"
  | "sleep"
  | "socialize"
  | "eat"
  | "idle";

export type DistrictSimulationAgent = {
  id: string;
  name: string;
  districtId: number;
  homeDistrictId: number;
  workDistrictId: number;
  roomsOwned: number;
  wallet: number;
  needs: DistrictSimulationNeeds;
  activity: DistrictSimulationActivity;
  workStartHour: number;
  workEndHour: number;
  lastRentDay: number;
};

export type DistrictSimulationState = {
  day: number;
  minuteOfDay: number;
  districtCount: number;
  maxAgents: number;
  agents: DistrictSimulationAgent[];
  relationships: Record<string, number>;
  seed: number;
};

type DistrictSimulationSeed = Pick<OfficeAgent, "id" | "name">;

type DistrictSimulationCreateInput = {
  agents: DistrictSimulationSeed[];
  districtCount?: number;
  maxAgents?: number;
  seedKey?: string;
};

type DistrictSimulationReconcileInput = {
  agents: DistrictSimulationSeed[];
  districtCount?: number;
  maxAgents?: number;
  seedKey?: string;
};

type DistrictSimulationStepInput = {
  minutes?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampNeed = (value: number) => clamp(value, 0, 100);

const normalizeDistrictCount = (districtCount?: number) =>
  Math.max(1, Math.floor(districtCount ?? DISTRICT_SIM_DEFAULT_DISTRICT_COUNT));

const normalizeMaxAgents = (maxAgents?: number) =>
  Math.max(1, Math.floor(maxAgents ?? DISTRICT_SIM_DEFAULT_MAX_AGENTS));

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const relationshipKey = (leftId: string, rightId: string) =>
  leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;

const withRelationshipPairs = (
  relationships: Record<string, number>,
  agentIds: string[],
): Record<string, number> => {
  const next: Record<string, number> = {};
  const validAgentIds = new Set(agentIds);
  for (const [key, value] of Object.entries(relationships)) {
    const [leftId, rightId] = key.split("::");
    if (!leftId || !rightId) continue;
    if (!validAgentIds.has(leftId) || !validAgentIds.has(rightId)) continue;
    next[key] = value;
  }
  for (let i = 0; i < agentIds.length; i += 1) {
    for (let j = i + 1; j < agentIds.length; j += 1) {
      const leftId = agentIds[i];
      const rightId = agentIds[j];
      if (!leftId || !rightId) continue;
      const key = relationshipKey(leftId, rightId);
      if (next[key] === undefined) next[key] = 0;
    }
  }
  return next;
};

const seedAgent = (
  agent: DistrictSimulationSeed,
  districtCount: number,
  seed: number,
): DistrictSimulationAgent => {
  const localSeed = hashSeed(`${seed}:${agent.id}:${agent.name}`);
  const homeDistrictId = localSeed % districtCount;
  const workDistrictId = (homeDistrictId + 1 + (localSeed % 3)) % districtCount;
  const workStartHour = 8 + (localSeed % 2);
  const workEndHour = workStartHour + 8;
  const roomsOwned = 1 + (localSeed % 3);
  const wallet = 320 + (localSeed % 220);
  const needs: DistrictSimulationNeeds = {
    hunger: 65 + (localSeed % 30),
    energy: 60 + ((localSeed >> 3) % 30),
    social: 55 + ((localSeed >> 5) % 35),
    comfort: 58 + ((localSeed >> 7) % 30),
  };
  return {
    id: agent.id,
    name: agent.name,
    districtId: homeDistrictId,
    homeDistrictId,
    workDistrictId,
    roomsOwned,
    wallet,
    needs: {
      hunger: clampNeed(needs.hunger),
      energy: clampNeed(needs.energy),
      social: clampNeed(needs.social),
      comfort: clampNeed(needs.comfort),
    },
    activity: "idle",
    workStartHour,
    workEndHour,
    lastRentDay: 0,
  };
};

const resolveActivity = (
  agent: DistrictSimulationAgent,
  hourOfDay: number,
): DistrictSimulationActivity => {
  const inWorkHours =
    hourOfDay >= agent.workStartHour && hourOfDay < agent.workEndHour;
  if (agent.needs.energy < 22) return "sleep";
  if (agent.needs.hunger < 35) return "eat";
  if (inWorkHours && agent.needs.energy > 30 && agent.needs.hunger > 30) return "work";
  if (agent.needs.social < 45) return "socialize";
  if (agent.needs.comfort < 35) return "idle";
  return inWorkHours ? "work" : "idle";
};

const applyNeedDelta = (
  needs: DistrictSimulationNeeds,
  activity: DistrictSimulationActivity,
  minutes: number,
): DistrictSimulationNeeds => {
  if (activity === "work") {
    return {
      hunger: clampNeed(needs.hunger - minutes * 0.35),
      energy: clampNeed(needs.energy - minutes * 0.42),
      social: clampNeed(needs.social - minutes * 0.2),
      comfort: clampNeed(needs.comfort - minutes * 0.16),
    };
  }
  if (activity === "sleep") {
    return {
      hunger: clampNeed(needs.hunger - minutes * 0.18),
      energy: clampNeed(needs.energy + minutes * 0.9),
      social: clampNeed(needs.social - minutes * 0.05),
      comfort: clampNeed(needs.comfort + minutes * 0.24),
    };
  }
  if (activity === "eat") {
    return {
      hunger: clampNeed(needs.hunger + minutes * 1.08),
      energy: clampNeed(needs.energy + minutes * 0.12),
      social: clampNeed(needs.social + minutes * 0.06),
      comfort: clampNeed(needs.comfort + minutes * 0.08),
    };
  }
  if (activity === "socialize") {
    return {
      hunger: clampNeed(needs.hunger - minutes * 0.14),
      energy: clampNeed(needs.energy - minutes * 0.16),
      social: clampNeed(needs.social + minutes * 0.82),
      comfort: clampNeed(needs.comfort + minutes * 0.12),
    };
  }
  return {
    hunger: clampNeed(needs.hunger - minutes * 0.08),
    energy: clampNeed(needs.energy + minutes * 0.06),
    social: clampNeed(needs.social - minutes * 0.04),
    comfort: clampNeed(needs.comfort + minutes * 0.2),
  };
};

const applyWalletDelta = (
  agent: DistrictSimulationAgent,
  activity: DistrictSimulationActivity,
  minutes: number,
): number => {
  let wallet = agent.wallet;
  if (activity === "work") wallet += minutes * 1.75;
  if (activity === "eat") wallet -= minutes * 0.34;
  if (activity === "socialize") wallet -= minutes * 0.12;
  return wallet;
};

const applyRentCharge = (
  agent: DistrictSimulationAgent,
  nextDay: number,
): DistrictSimulationAgent => {
  if (nextDay <= agent.lastRentDay) return agent;
  const dayDelta = nextDay - agent.lastRentDay;
  const rentCost = dayDelta * agent.roomsOwned * 38;
  return {
    ...agent,
    wallet: agent.wallet - rentCost,
    lastRentDay: nextDay,
  };
};

export const createDistrictSimulationState = ({
  agents,
  districtCount,
  maxAgents,
  seedKey = "default",
}: DistrictSimulationCreateInput): DistrictSimulationState => {
  const resolvedDistrictCount = normalizeDistrictCount(districtCount);
  const resolvedMaxAgents = normalizeMaxAgents(maxAgents);
  const seed = hashSeed(`${seedKey}:${resolvedDistrictCount}:${resolvedMaxAgents}`);
  const seededAgents = agents
    .slice(0, resolvedMaxAgents)
    .map((agent) => seedAgent(agent, resolvedDistrictCount, seed));
  const relationships = withRelationshipPairs(
    {},
    seededAgents.map((agent) => agent.id),
  );
  return {
    day: 1,
    minuteOfDay: 9 * 60,
    districtCount: resolvedDistrictCount,
    maxAgents: resolvedMaxAgents,
    agents: seededAgents,
    relationships,
    seed,
  };
};

export const reconcileDistrictSimulationAgents = (
  state: DistrictSimulationState,
  {
    agents,
    districtCount,
    maxAgents,
    seedKey = "default",
  }: DistrictSimulationReconcileInput,
): DistrictSimulationState => {
  const resolvedDistrictCount = normalizeDistrictCount(districtCount);
  const resolvedMaxAgents = normalizeMaxAgents(maxAgents);
  const shouldReseed =
    resolvedDistrictCount !== state.districtCount ||
    resolvedMaxAgents !== state.maxAgents ||
    hashSeed(`${seedKey}:${resolvedDistrictCount}:${resolvedMaxAgents}`) !== state.seed;
  if (shouldReseed) {
    return createDistrictSimulationState({
      agents,
      districtCount: resolvedDistrictCount,
      maxAgents: resolvedMaxAgents,
      seedKey,
    });
  }

  const nextSeeds = agents.slice(0, resolvedMaxAgents);
  const existingById = new Map(state.agents.map((agent) => [agent.id, agent]));
  const nextAgents = nextSeeds.map((seedAgentEntry) => {
    const existing = existingById.get(seedAgentEntry.id);
    if (existing) return existing;
    return seedAgent(seedAgentEntry, state.districtCount, state.seed);
  });

  const relationships = withRelationshipPairs(
    state.relationships,
    nextAgents.map((agent) => agent.id),
  );
  return {
    ...state,
    agents: nextAgents,
    relationships,
  };
};

export const stepDistrictSimulation = (
  state: DistrictSimulationState,
  { minutes = 10 }: DistrictSimulationStepInput = {},
): DistrictSimulationState => {
  const resolvedMinutes = clamp(Math.floor(minutes), 1, 240);
  const totalMinutes = state.minuteOfDay + resolvedMinutes;
  const dayDelta = Math.floor(totalMinutes / (24 * 60));
  const nextDay = state.day + dayDelta;
  const minuteOfDay = totalMinutes % (24 * 60);
  const hourOfDay = minuteOfDay / 60;

  const steppedAgents = state.agents.map((agent) => {
    const withRent = dayDelta > 0 ? applyRentCharge(agent, nextDay) : agent;
    const activity = resolveActivity(withRent, hourOfDay);
    const districtId =
      activity === "work"
        ? withRent.workDistrictId
        : activity === "socialize"
          ? (withRent.homeDistrictId + 2) % state.districtCount
          : withRent.homeDistrictId;
    const needs = applyNeedDelta(withRent.needs, activity, resolvedMinutes);
    let wallet = applyWalletDelta(withRent, activity, resolvedMinutes);
    if (wallet < 0) {
      needs.comfort = clampNeed(needs.comfort - resolvedMinutes * 0.28);
    }
    wallet = Number(wallet.toFixed(2));
    return {
      ...withRent,
      districtId,
      activity,
      wallet,
      needs,
    };
  });

  const relationships = { ...state.relationships };
  for (let i = 0; i < steppedAgents.length; i += 1) {
    for (let j = i + 1; j < steppedAgents.length; j += 1) {
      const left = steppedAgents[i];
      const right = steppedAgents[j];
      if (!left || !right) continue;
      const key = relationshipKey(left.id, right.id);
      const currentScore = relationships[key] ?? 0;
      const sameDistrict = left.districtId === right.districtId;
      const socialBoost =
        left.activity === "socialize" || right.activity === "socialize";
      const delta = sameDistrict
        ? socialBoost
          ? resolvedMinutes * 0.28
          : resolvedMinutes * 0.08
        : -resolvedMinutes * 0.05;
      relationships[key] = Number(clamp(currentScore + delta, -100, 100).toFixed(2));
    }
  }

  return {
    ...state,
    day: nextDay,
    minuteOfDay,
    agents: steppedAgents,
    relationships,
  };
};

export const getDistrictSimulationRelationship = (
  state: DistrictSimulationState,
  leftId: string,
  rightId: string,
): number => state.relationships[relationshipKey(leftId, rightId)] ?? 0;

export const getDistrictSimulationNeedEmoji = (
  needs: DistrictSimulationNeeds,
): string | null => {
  const entries = Object.entries(needs) as Array<
    [keyof DistrictSimulationNeeds, number]
  >;
  entries.sort((left, right) => left[1] - right[1]);
  const [lowestNeed, value] = entries[0] ?? ["comfort", 100];
  if (value >= 55) return null;
  if (lowestNeed === "hunger") return "🍔";
  if (lowestNeed === "energy") return "😴";
  if (lowestNeed === "social") return "💬";
  return "🛋️";
};
