import type Phaser from "phaser";

import type { OfficeAgentPresence } from "@/lib/office/presence";
import type { OfficeMap } from "@/lib/office/schema";
import {
  astar2D,
  buildNavGrid2D,
  type NavGrid2D,
  type Waypoint,
} from "@/lib/office/pathfinding";

type AgentEffectsSystemParams = {
  scene: Phaser.Scene;
};

type AvatarState = {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  stateIcon: Phaser.GameObjects.Text;
  thoughtIcon: Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  lastThoughtAt: number;
  /** Current waypoint path the agent is following. */
  path: Waypoint[];
  /** Index of the next waypoint in `path` the agent is walking toward. */
  pathIndex: number;
  /** Stringified last-resolved target so we know when to re-path. */
  lastTargetKey: string;
};

const THOUGHTS = ["coffee", "gamepad", "zzz", "idea", "music"] as const;

const stateColor = (state: OfficeAgentPresence["state"]) => {
  if (state === "working") return 0x47c773;
  if (state === "meeting") return 0x58c6ff;
  if (state === "error") return 0xff6e6e;
  return 0xe8d58a;
};

const thoughtFromSeed = (seed: number) => THOUGHTS[Math.abs(seed) % THOUGHTS.length] ?? "idea";

const hash = (value: string) => {
  let h = 0;
  for (let index = 0; index < value.length; index += 1) {
    h = (h * 33 + value.charCodeAt(index)) >>> 0;
  }
  return h;
};

export class AgentEffectsSystem {
  private readonly scene: Phaser.Scene;
  private readonly avatars = new Map<string, AvatarState>();

  /**
   * Cached nav grid.  Rebuilt when the map identity changes so agents always
   * pathfind against the current layout.
   */
  private navGrid: NavGrid2D | null = null;
  private navGridMapVersion: string = "";

  constructor(params: AgentEffectsSystemParams) {
    this.scene = params.scene;
  }

  update(params: {
    map: OfficeMap;
    agents: OfficeAgentPresence[];
    elapsedMs: number;
    thoughtBubblesEnabled: boolean;
  }) {
    // Rebuild the nav grid when the map changes.
    const mapKey = `${params.map.workspaceId}:${params.map.officeVersionId}`;
    if (mapKey !== this.navGridMapVersion) {
      this.navGrid = buildNavGrid2D(params.map);
      this.navGridMapVersion = mapKey;
      // Invalidate all cached paths since the world changed.
      for (const entry of this.avatars.values()) {
        entry.path = [];
        entry.pathIndex = 0;
        entry.lastTargetKey = "";
      }
    }

    const keep = new Set<string>();
    const zonesByType = new Map(
      params.map.zones.map((zone) => [zone.type, zone])
    );

    for (const agent of params.agents) {
      keep.add(agent.agentId);
      const entry = this.getOrCreate(agent.agentId, agent.name, agent.state);
      entry.sprite.fillColor = stateColor(agent.state);
      entry.stateIcon.setText(agent.state === "error" ? "!" : "");

      const target = this.resolveTarget(agent.state, zonesByType);
      const targetKey = `${target.x}:${target.y}`;

      // Re-path when target changes.
      if (targetKey !== entry.lastTargetKey) {
        entry.lastTargetKey = targetKey;
        if (this.navGrid) {
          entry.path = astar2D(
            entry.sprite.x,
            entry.sprite.y,
            target.x,
            target.y,
            this.navGrid,
          );
        } else {
          // Fallback: no grid available, stay put.
          entry.path = [];
        }
        entry.pathIndex = 0;
      }

      // Follow waypoint path.
      this.stepAlongPath(entry, params.elapsedMs);

      entry.label.setPosition(entry.sprite.x, entry.sprite.y + 15);
      entry.stateIcon.setPosition(entry.sprite.x + 12, entry.sprite.y - 12);
      entry.thoughtIcon.setPosition(entry.sprite.x, entry.sprite.y - 20);

      if (
        params.thoughtBubblesEnabled &&
        agent.state === "idle" &&
        params.elapsedMs + entry.lastThoughtAt > 7_000
      ) {
        const now = this.scene.time.now;
        if (now - entry.lastThoughtAt > 7000) {
          const seed = hash(`${agent.agentId}:${Math.floor(now / 2000)}`);
          if (seed % 7 === 0) {
            entry.lastThoughtAt = now;
            entry.thoughtIcon.setAlpha(0.9);
            entry.thoughtIcon.setText(thoughtFromSeed(seed));
          }
        }
      }
      if (entry.thoughtIcon.alpha > 0) {
        entry.thoughtIcon.setAlpha(Math.max(0, entry.thoughtIcon.alpha - 0.0075 * params.elapsedMs));
      }
    }

    for (const [agentId, entry] of this.avatars) {
      if (keep.has(agentId)) continue;
      entry.sprite.destroy();
      entry.label.destroy();
      entry.stateIcon.destroy();
      entry.thoughtIcon.destroy();
      this.avatars.delete(agentId);
    }
  }

  destroy() {
    for (const entry of this.avatars.values()) {
      entry.sprite.destroy();
      entry.label.destroy();
      entry.stateIcon.destroy();
      entry.thoughtIcon.destroy();
    }
    this.avatars.clear();
    this.navGrid = null;
  }

  /**
   * Walk the agent sprite along the computed waypoint path.
   *
   * When the path is empty (no route found) the agent simply stays put,
   * which is the correct behavior: visible stillness is preferable to
   * walking through walls.
   */
  private stepAlongPath(entry: AvatarState, elapsedMs: number): void {
    if (entry.path.length === 0 || entry.pathIndex >= entry.path.length) return;

    const wp = entry.path[entry.pathIndex];
    const dx = wp.x - entry.sprite.x;
    const dy = wp.y - entry.sprite.y;
    const dist = Math.hypot(dx, dy);
    const maxSpeed = 0.05 * elapsedMs;

    if (dist <= maxSpeed) {
      // Arrived at waypoint — snap and advance.
      entry.sprite.x = wp.x;
      entry.sprite.y = wp.y;
      entry.pathIndex += 1;
    } else {
      const step = Math.min(maxSpeed, dist);
      entry.sprite.x += (dx / dist) * step;
      entry.sprite.y += (dy / dist) * step;
    }
  }

  private getOrCreate(agentId: string, name: string, state: OfficeAgentPresence["state"]) {
    const existing = this.avatars.get(agentId);
    if (existing) {
      existing.label.setText(name);
      return existing;
    }
    const sprite = this.scene.add.circle(80, 80, 8, stateColor(state));
    sprite.setDepth(8_500);
    const label = this.scene.add.text(80, 95, name, {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      color: "#d7e7ff",
    });
    label.setDepth(8_500);
    label.setOrigin(0.5, 0);
    const stateIcon = this.scene.add.text(92, 68, "", {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      color: "#ff7171",
    });
    stateIcon.setDepth(9_000);
    stateIcon.setOrigin(0.5, 0.5);
    const thoughtIcon = this.scene.add.text(80, 58, "", {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      color: "#f4e8bb",
      backgroundColor: "rgba(20,30,40,0.55)",
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    });
    thoughtIcon.setDepth(9_000);
    thoughtIcon.setOrigin(0.5, 0.5);
    thoughtIcon.setAlpha(0);
    const created: AvatarState = {
      sprite,
      label,
      stateIcon,
      thoughtIcon,
      vx: 0,
      vy: 0,
      lastThoughtAt: this.scene.time.now,
      path: [],
      pathIndex: 0,
      lastTargetKey: "",
    };
    this.avatars.set(agentId, created);
    return created;
  }

  private resolveTarget(
    state: OfficeAgentPresence["state"],
    zonesByType: Map<string, OfficeMap["zones"][number]>
  ) {
    const fallback = { x: 120, y: 120 };
    const pickFrom = (zoneType: string) => {
      const zone = zonesByType.get(zoneType);
      if (!zone || zone.shape.points.length === 0) return fallback;
      const point = zone.shape.points[0];
      return { x: point.x, y: point.y };
    };
    if (state === "working") return pickFrom("desk_zone");
    if (state === "meeting") return pickFrom("meeting_room");
    if (state === "error") return pickFrom("desk_zone");
    return pickFrom("hallway");
  }
}
