import type { VisualPoint } from "@claw3d/visual-contract";
import { clampPoint, distanceBetween, snapPoint, type VisualBounds } from "./geometry";

export interface NavigationObstacle {
  center: VisualPoint;
  width: number;
  depth: number;
}

function key(point: VisualPoint): string {
  return `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
}

function blocked(point: VisualPoint, obstacles: readonly NavigationObstacle[]): boolean {
  return obstacles.some(
    (obstacle) =>
      Math.abs(point.x - obstacle.center.x) < obstacle.width / 2 &&
      Math.abs(point.z - obstacle.center.z) < obstacle.depth / 2,
  );
}

export function planVisualPath(
  from: VisualPoint,
  to: VisualPoint,
  obstacles: readonly NavigationObstacle[] = [],
  bounds?: VisualBounds,
  step = 0.5,
): VisualPoint[] {
  const start = snapPoint(clampPoint(from, bounds), step);
  const goal = snapPoint(clampPoint(to, bounds), step);
  if (key(start) === key(goal)) return [start];

  const frontier: VisualPoint[] = [start];
  const cameFrom = new Map<string, string | null>([[key(start), null]]);
  const points = new Map<string, VisualPoint>([[key(start), start]]);
  const directions = [
    { x: step, z: 0 },
    { x: -step, z: 0 },
    { x: 0, z: step },
    { x: 0, z: -step },
  ];

  while (frontier.length > 0 && cameFrom.size < 2_048) {
    frontier.sort((a, b) => distanceBetween(a, goal) - distanceBetween(b, goal));
    const current = frontier.shift()!;
    if (key(current) === key(goal)) break;

    for (const direction of directions) {
      const candidate = snapPoint(
        clampPoint({ x: current.x + direction.x, z: current.z + direction.z }, bounds),
        step,
      );
      const candidateKey = key(candidate);
      if (candidateKey === key(current) || cameFrom.has(candidateKey) || blocked(candidate, obstacles)) {
        continue;
      }
      cameFrom.set(candidateKey, key(current));
      points.set(candidateKey, candidate);
      frontier.push(candidate);
    }
  }

  if (!cameFrom.has(key(goal))) return [start, goal];
  const result: VisualPoint[] = [];
  let cursor: string | null = key(goal);
  while (cursor) {
    result.push(points.get(cursor)!);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return result.reverse();
}
