export type FloorProvider = "openclaw" | "hermes" | "custom" | "demo";
export type FloorZone = "building" | "outside";

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
  shortLabel: string;
  provider: FloorProvider;
  kind: FloorKind;
  zone: FloorZone;
  enabled: boolean;
  sortOrder: number;
  runtimeProfileId: string | null;
};

export const OFFICE_FLOORS: readonly FloorDefinition[] = [
  {
    id: "lobby",
    label: "Lobby",
    shortLabel: "Lobby",
    provider: "demo",
    kind: "lobby",
    zone: "building",
    enabled: true,
    sortOrder: 0,
    runtimeProfileId: null,
  },
  {
    id: "openclaw-ground",
    label: "OpenClaw Floor",
    shortLabel: "OpenClaw",
    provider: "openclaw",
    kind: "runtime",
    zone: "building",
    enabled: true,
    sortOrder: 10,
    runtimeProfileId: "openclaw-default",
  },
  {
    id: "hermes-first",
    label: "Hermes Floor",
    shortLabel: "Hermes",
    provider: "hermes",
    kind: "runtime",
    zone: "building",
    enabled: true,
    sortOrder: 20,
    runtimeProfileId: "hermes-default",
  },
  {
    id: "custom-second",
    label: "Custom Floor",
    shortLabel: "Custom",
    provider: "custom",
    kind: "runtime",
    zone: "building",
    enabled: true,
    sortOrder: 30,
    runtimeProfileId: "custom-default",
  },
  {
    id: "training",
    label: "Training Floor",
    shortLabel: "Training",
    provider: "demo",
    kind: "training",
    zone: "building",
    enabled: false,
    sortOrder: 40,
    runtimeProfileId: null,
  },
  {
    id: "traders-floor",
    label: "Trader's Floor",
    shortLabel: "Traders",
    provider: "demo",
    kind: "market",
    zone: "building",
    enabled: false,
    sortOrder: 50,
    runtimeProfileId: null,
  },
  {
    id: "campus",
    label: "Outside / Campus",
    shortLabel: "Campus",
    provider: "demo",
    kind: "campus",
    zone: "outside",
    enabled: false,
    sortOrder: 100,
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

export const listOfficeFloorsForZone = (zone: FloorZone): FloorDefinition[] =>
  OFFICE_FLOORS.filter((floor) => floor.zone === zone);

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
