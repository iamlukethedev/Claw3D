import type { AgentStoreSeed } from "@/features/agents/state/store";
import {
  getOfficeFloor,
  OFFICE_FLOORS,
  type FloorId,
  type FloorProvider,
} from "@/lib/office/floors";

export type FloorRosterEntry = {
  agentId: string;
  displayName: string;
  runtimeName: string;
  identityName: string | null;
  sessionDisplayName: string | null;
  role: string | null;
  avatarSeed: string | null;
  model: string | null;
  thinkingLevel: string | null;
  sessionKey: string;
};

export type FloorRosterStatus = "idle" | "loading" | "loaded" | "error";

export type FloorRosterState = {
  floorId: FloorId;
  provider: FloorProvider;
  status: FloorRosterStatus;
  hydratedAt: number | null;
  selectedAgentId: string | null;
  error: string | null;
  entries: FloorRosterEntry[];
};

export type FloorRosterHydrationResult = {
  seeds: AgentStoreSeed[];
  suggestedSelectedAgentId: string | null;
};

export const createFloorRosterEntry = (seed: AgentStoreSeed): FloorRosterEntry => {
  const runtimeName = seed.runtimeName?.trim() || seed.name.trim();
  const identityName = seed.identityName?.trim() || null;
  const sessionDisplayName = seed.sessionDisplayName?.trim() || null;
  const displayName = identityName || sessionDisplayName || runtimeName;
  return {
    agentId: seed.agentId,
    displayName,
    runtimeName,
    identityName,
    sessionDisplayName,
    role: seed.role ?? null,
    avatarSeed: seed.avatarSeed ?? null,
    model: seed.model ?? null,
    thinkingLevel: seed.thinkingLevel ?? null,
    sessionKey: seed.sessionKey,
  };
};

export const defaultFloorRosterState = (floorId: FloorId): FloorRosterState => {
  const floor = getOfficeFloor(floorId);
  return {
    floorId,
    provider: floor.provider,
    status: "idle",
    hydratedAt: null,
    selectedAgentId: null,
    error: null,
    entries: [],
  };
};

export const createFloorRosterCache = (): Record<FloorId, FloorRosterState> => {
  const cache = {} as Record<FloorId, FloorRosterState>;
  for (const floor of OFFICE_FLOORS) {
    cache[floor.id] = defaultFloorRosterState(floor.id);
  }
  return cache;
};

export const buildFloorRosterState = (params: {
  floorId: FloorId;
  result: FloorRosterHydrationResult;
  hydratedAt?: number;
}): FloorRosterState => {
  const entries = params.result.seeds.map(createFloorRosterEntry);
  return {
    floorId: params.floorId,
    provider: getOfficeFloor(params.floorId).provider,
    status: "loaded",
    hydratedAt: params.hydratedAt ?? Date.now(),
    selectedAgentId: params.result.suggestedSelectedAgentId,
    error: null,
    entries,
  };
};

export const buildFloorRosterErrorState = (params: {
  floorId: FloorId;
  message: string;
  previous?: FloorRosterState | null;
}): FloorRosterState => ({
  floorId: params.floorId,
  provider: getOfficeFloor(params.floorId).provider,
  status: "error",
  hydratedAt: params.previous?.hydratedAt ?? null,
  selectedAgentId: params.previous?.selectedAgentId ?? null,
  error: params.message,
  entries: params.previous?.entries ?? [],
});

export const hydrateFloorRoster = async (params: {
  floorId: FloorId;
  hydrate: () => Promise<FloorRosterHydrationResult>;
  now?: () => number;
}): Promise<FloorRosterState> => {
  const result = await params.hydrate();
  return buildFloorRosterState({
    floorId: params.floorId,
    result,
    hydratedAt: params.now?.(),
  });
};
