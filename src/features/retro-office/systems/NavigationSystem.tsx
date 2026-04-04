import {
  AGENT_RADIUS,
  BUMP_FREEZE_MS,
  SEPARATION_STRENGTH,
} from "@/features/retro-office/core/constants";
import {
  isRemoteOfficeAgentId,
  REMOTE_ROAM_POINTS,
} from "@/features/retro-office/core/district";
import { ROAM_POINTS } from "@/features/retro-office/core/navigation";
import type { RenderAgent } from "@/features/retro-office/core/types";

type ApplyAgentCollisionBumpsArgs = {
  agents: RenderAgent[];
  now: number;
};

export function applyAgentCollisionBumps({
  agents,
  now,
}: ApplyAgentCollisionBumpsArgs): RenderAgent[] {
  const moved = [...agents];
  const collisionCellSize = AGENT_RADIUS * 4;
  const collisionBuckets = new Map<string, number[]>();
  for (let index = 0; index < moved.length; index += 1) {
    const agent = moved[index];
    if ("role" in agent && agent.role === "janitor") continue;
    const bucketKey = `${Math.floor(agent.x / collisionCellSize)}:${Math.floor(
      agent.y / collisionCellSize,
    )}`;
    const bucket = collisionBuckets.get(bucketKey);
    if (bucket) bucket.push(index);
    else collisionBuckets.set(bucketKey, [index]);
  }

  for (let i = 0; i < moved.length; i += 1) {
    const mi = moved[i];
    if ("role" in mi && mi.role === "janitor") continue;
    if (
      moved[i].state === "sitting" ||
      moved[i].state === "working_out" ||
      moved[i].state === "dancing"
    )
      continue;
    if (moved[i].pingPongUntil !== undefined && moved[i].state !== "walking")
      continue;
    if (moved[i].bumpedUntil !== undefined) continue;
    if ((moved[i].collisionCooldownUntil ?? 0) > now) continue;
    let sx = 0,
      sy = 0,
      fx = 0,
      fy = 0;
    const bucketX = Math.floor(mi.x / collisionCellSize);
    const bucketY = Math.floor(mi.y / collisionCellSize);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const bucket = collisionBuckets.get(
          `${bucketX + offsetX}:${bucketY + offsetY}`,
        );
        if (!bucket) continue;
        for (const j of bucket) {
          if (i === j) continue;
          const mj = moved[j];
          if ("role" in mj && mj.role === "janitor") continue;
          let ddx = moved[i].x - moved[j].x;
          let ddy = moved[i].y - moved[j].y;
          const d = Math.hypot(ddx, ddy);
          const minDist = AGENT_RADIUS * 2;
          if (d < minDist) {
            if (d === 0) {
              ddx = Math.random() - 0.5;
              ddy = Math.random() - 0.5;
            }
            const effD = Math.max(d, 0.01);
            const effNorm = Math.hypot(ddx, ddy) || 1;
            const push = (1 - effD / minDist) * SEPARATION_STRENGTH;
            sx += (ddx / effNorm) * push;
            sy += (ddy / effNorm) * push;
            fx += (-ddx / effNorm) * push;
            fy += (-ddy / effNorm) * push;
          }
        }
      }
    }
    if (sx === 0 && sy === 0) continue;
    const pushMag = Math.hypot(sx, sy);
    const norm = pushMag || 1;
    let bestDot = -Infinity;
    const roamCandidates = isRemoteOfficeAgentId(moved[i].id)
      ? REMOTE_ROAM_POINTS
      : ROAM_POINTS;
    let escapeTarget = roamCandidates[0];
    for (const rp of roamCandidates) {
      const rdx = rp.x - moved[i].x,
        rdy = rp.y - moved[i].y;
      const rdist = Math.hypot(rdx, rdy) || 1;
      const dot = (rdx / rdist) * (sx / norm) + (rdy / rdist) * (sy / norm);
      if (dot > bestDot) {
        bestDot = dot;
        escapeTarget = rp;
      }
    }
    moved[i] = {
      ...moved[i],
      facing: Math.atan2(fx || sx, fy || sy),
      state: "standing",
      path: [],
      targetX: escapeTarget.x,
      targetY: escapeTarget.y,
      bumpedUntil: now + BUMP_FREEZE_MS,
      bumpTalkUntil: now + BUMP_FREEZE_MS,
    };
  }

  return moved;
}
