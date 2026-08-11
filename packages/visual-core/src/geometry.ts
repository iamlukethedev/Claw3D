import type { VisualPoint } from "@claw3d/visual-contract";

export interface VisualBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_OFFICE_BOUNDS: VisualBounds = {
  minX: -6,
  maxX: 6,
  minZ: -4.5,
  maxZ: 4.5,
};

export function clampPoint(point: VisualPoint, bounds = DEFAULT_OFFICE_BOUNDS): VisualPoint {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, point.z)),
  };
}

export function snapPoint(point: VisualPoint, grid = 0.5): VisualPoint {
  if (!Number.isFinite(grid) || grid <= 0) return { ...point };
  return {
    x: Math.round(point.x / grid) * grid,
    z: Math.round(point.z / grid) * grid,
  };
}

export function distanceBetween(a: VisualPoint, b: VisualPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function actorPosition(index: number, count: number): VisualPoint {
  if (count <= 1) return { x: 0, z: 0 };
  const radius = Math.min(3.6, 1.8 + count * 0.22);
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return snapPoint({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }, 0.1);
}
