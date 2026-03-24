import { CANVAS_H, SNAP_GRID } from "@/features/retro-office/core/constants";
import { snap } from "@/features/retro-office/core/geometry";

export type DistrictZone = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const LOCAL_OFFICE_CANVAS_WIDTH = 1800;

export const LOCAL_OFFICE_ZONE: DistrictZone = {
  minX: 0,
  maxX: LOCAL_OFFICE_CANVAS_WIDTH,
  minY: 0,
  maxY: CANVAS_H,
};

export const CITY_PATH_ZONE: DistrictZone = {
  minX: LOCAL_OFFICE_CANVAS_WIDTH + 40,
  maxX: 2040,
  minY: 300,
  maxY: 420,
};

export const REMOTE_OFFICE_ZONE: DistrictZone = {
  minX: 2100,
  maxX: 2520,
  minY: 120,
  maxY: 600,
};

export const REMOTE_ROAM_POINTS = [
  { x: 2180, y: 190 },
  { x: 2250, y: 520 },
  { x: 2340, y: 310 },
  { x: 2420, y: 210 },
  { x: 2460, y: 470 },
  { x: 2300, y: 420 },
] as const;

export const DISTRICT_CAMERA_POSITION: [number, number, number] = [18, 14, 16];
export const DISTRICT_CAMERA_TARGET: [number, number, number] = [4, 0, 0];
export const DISTRICT_CAMERA_ZOOM = 43;

export const isRemoteOfficeAgentId = (agentId: string) => agentId.startsWith("remote:");

const clampZoneValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, snap(value)));

export const clampPointToZone = (
  x: number,
  y: number,
  zone: DistrictZone,
): { x: number; y: number } => ({
  x: clampZoneValue(x, zone.minX + SNAP_GRID, zone.maxX - SNAP_GRID),
  y: clampZoneValue(y, zone.minY + SNAP_GRID, zone.maxY - SNAP_GRID),
});

export const pickRandomPointInZone = (
  zone: DistrictZone,
  random = Math.random,
): { x: number; y: number } =>
  clampPointToZone(
    zone.minX + (zone.maxX - zone.minX) * random(),
    zone.minY + (zone.maxY - zone.minY) * random(),
    zone,
  );
