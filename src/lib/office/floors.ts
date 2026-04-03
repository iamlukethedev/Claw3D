export type FloorProvider = "openclaw" | "hermes" | "custom" | "demo";

export type FloorId =
  | "lobby"
  | "openclaw-ground"
  | "hermes-first"
  | "custom-second"
  | "training"
  | "traders-floor"
  | "campus";

export type FloorKind =
  | "lobby"
  | "runtime"
  | "training"
  | "market"
  | "campus";

export type FloorDefinition = {
  id: FloorId;
  label: string;
  provider: FloorProvider;
  kind: FloorKind;
  enabled: boolean;
  runtimeProfileId: string | null;
};

export const OFFICE_FLOORS: readonly FloorDefinition[] = [
  {
    id: "lobby",
    label: "Lobby",
    provider: "demo",
    kind: "lobby",
    enabled: true,
    runtimeProfileId: null,
  },
  {
    id: "openclaw-ground",
    label: "OpenClaw Floor",
    provider: "openclaw",
    kind: "runtime",
    enabled: true,
    runtimeProfileId: "openclaw-default",
  },
  {
    id: "hermes-first",
    label: "Hermes Floor",
    provider: "hermes",
    kind: "runtime",
    enabled: true,
    runtimeProfileId: "hermes-default",
  },
  {
    id: "custom-second",
    label: "Custom Floor",
    provider: "custom",
    kind: "runtime",
    enabled: true,
    runtimeProfileId: "custom-default",
  },
  {
    id: "training",
    label: "Training Floor",
    provider: "demo",
    kind: "training",
    enabled: false,
    runtimeProfileId: null,
  },
  {
    id: "traders-floor",
    label: "Trader's Floor",
    provider: "demo",
    kind: "market",
    enabled: false,
    runtimeProfileId: null,
  },
  {
    id: "campus",
    label: "Outside / Campus",
    provider: "demo",
    kind: "campus",
    enabled: false,
    runtimeProfileId: null,
  },
] as const;

export const DEFAULT_ACTIVE_FLOOR_ID: FloorId = "lobby";

const FLOOR_BY_ID: Readonly<Record<FloorId, FloorDefinition>> = OFFICE_FLOORS.reduce(
  (acc, floor) => {
    acc[floor.id] = floor;
    return acc;
  },
  {} as Record<FloorId, FloorDefinition>
);

export const getOfficeFloor = (floorId: FloorId): FloorDefinition => FLOOR_BY_ID[floorId];

export const listEnabledOfficeFloors = (): FloorDefinition[] =>
  OFFICE_FLOORS.filter((floor) => floor.enabled);

export const listOfficeFloorsForProvider = (provider: FloorProvider): FloorDefinition[] =>
  OFFICE_FLOORS.filter((floor) => floor.provider === provider);

export const resolveActiveOfficeFloorId = (floorId: FloorId | null | undefined): FloorId => {
  if (floorId && FLOOR_BY_ID[floorId]?.enabled) {
    return floorId;
  }
  return listEnabledOfficeFloors()[0]?.id ?? DEFAULT_ACTIVE_FLOOR_ID;
};

export const getAdjacentEnabledOfficeFloorId = (
  floorId: FloorId,
  direction: 1 | -1
): FloorId => {
  const enabled = listEnabledOfficeFloors();
  const activeId = resolveActiveOfficeFloorId(floorId);
  const currentIndex = enabled.findIndex((floor) => floor.id === activeId);
  if (currentIndex < 0 || enabled.length === 0) {
    return DEFAULT_ACTIVE_FLOOR_ID;
  }
  const nextIndex = (currentIndex + direction + enabled.length) % enabled.length;
  return enabled[nextIndex]?.id ?? DEFAULT_ACTIVE_FLOOR_ID;
};
