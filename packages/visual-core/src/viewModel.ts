import type { VisualActor, VisualSnapshot, VisualTask } from "@claw3d/visual-contract";
import { actorPosition } from "./geometry";

export interface VisualOfficeViewModel {
  actors: Array<VisualActor & { position: { x: number; z: number }; initials: string }>;
  tasks: VisualTask[];
  activeCount: number;
  idleCount: number;
  errorCount: number;
  completionPercent: number;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export function createOfficeViewModel(snapshot: VisualSnapshot | null): VisualOfficeViewModel {
  if (!snapshot) {
    return { actors: [], tasks: [], activeCount: 0, idleCount: 0, errorCount: 0, completionPercent: 0 };
  }
  const actors = snapshot.actors.map((actor, index) => ({
    ...actor,
    position: actor.position ?? actorPosition(index, snapshot.actors.length),
    initials: initials(actor.displayName),
  }));
  const complete = snapshot.tasks.filter((task) => task.status === "completed").length;
  return {
    actors,
    tasks: [...snapshot.tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    activeCount: actors.filter((actor) => actor.status === "working" || actor.status === "voice").length,
    idleCount: actors.filter((actor) => actor.status === "idle" || actor.status === "unknown").length,
    errorCount: actors.filter((actor) => actor.status === "error").length,
    completionPercent: snapshot.tasks.length === 0 ? 0 : Math.round((complete / snapshot.tasks.length) * 100),
  };
}
