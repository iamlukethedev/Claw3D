import type {
  VisualActor,
  VisualActorStatus,
  VisualEvent,
  VisualNotification,
  VisualSnapshot,
  VisualSystemStatus,
  VisualTask,
  VisualTaskStatus,
} from "@claw3d/visual-contract";

const ACTOR_COLORS = ["#48d7ff", "#a76bff", "#ffde59", "#ff8d4d", "#65e6a6", "#ff6f91"];
const MAX_LABEL_LENGTH = 160;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, maximum = MAX_LABEL_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, maximum) : undefined;
}

function safeIdentifier(value: unknown): string | undefined {
  const candidate = safeString(value, 80);
  return candidate && /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(candidate) ? candidate : undefined;
}

function occurredAt(value: unknown): string | undefined {
  const milliseconds = typeof value === "number" ? value * 1_000 : Date.parse(String(value));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
}

function displayName(identifier: string): string {
  return identifier
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventData(raw: UnknownRecord): UnknownRecord {
  return isRecord(raw.data) ? raw.data : isRecord(raw.payload) ? raw.payload : {};
}

function actorId(raw: UnknownRecord, data: UnknownRecord): string | undefined {
  return safeIdentifier(raw.agent) ?? safeIdentifier(data.agent);
}

function eventIdentity(raw: UnknownRecord): string | undefined {
  return safeIdentifier(raw.event_id) ?? safeIdentifier(raw.eventId);
}

function taskStatus(value: unknown): VisualTaskStatus {
  switch (safeString(value, 32)?.toLowerCase()) {
    case "running":
    case "in_progress":
      return "running";
    case "done":
    case "completed":
      return "completed";
    case "failed":
    case "error":
      return "failed";
    default:
      return "queued";
  }
}

function mapTask(data: UnknownRecord, timestamp: string): VisualTask | undefined {
  const idValue = data.task_id ?? data.id;
  const id = typeof idValue === "number" ? String(idValue) : safeIdentifier(idValue);
  if (!id) return undefined;
  const changes = isRecord(data.changes) ? data.changes : {};
  const title = safeString(data.title) ?? safeString(changes.title) ?? `Task ${id}`;
  const progressValue = data.progress ?? changes.progress;
  const progress = typeof progressValue === "number"
    ? Math.max(0, Math.min(100, progressValue))
    : undefined;
  return {
    id: `task-${id}`,
    title,
    status: taskStatus(data.status ?? changes.status),
    actorId: safeIdentifier(data.agent ?? changes.agent),
    progress,
    updatedAt: timestamp,
  };
}

function mapNotification(data: UnknownRecord, timestamp: string): VisualNotification | undefined {
  const idValue = data.notification_id ?? data.id;
  const id = typeof idValue === "number" ? String(idValue) : safeIdentifier(idValue);
  const title = safeString(data.title);
  if (!id || !title) return undefined;
  const priority = safeString(data.priority, 32)?.toLowerCase();
  return {
    id: `notification-${id}`,
    level: priority === "critical" || priority === "high" ? "error" : priority === "warning" ? "warning" : "info",
    title,
    occurredAt: timestamp,
  };
}

function actorEvent(
  identity: string,
  timestamp: string,
  actor: string | undefined,
  state: VisualActorStatus,
  activity = false,
): VisualEvent | null {
  if (!actor) return null;
  return {
    schemaVersion: 1,
    eventId: identity,
    type: activity ? "actor.activity" : "actor.status.changed",
    occurredAt: timestamp,
    actorId: actor,
    state,
    metadata: { channel: activity ? "activity" : "status" },
  };
}

export function mapPrivateStatus(raw: unknown, now = new Date()): VisualSnapshot {
  if (!isRecord(raw) || !Array.isArray(raw.agents_registered)) {
    throw new TypeError("Invalid visual status response");
  }
  const actorIds = raw.agents_registered
    .map(safeIdentifier)
    .filter((value): value is string => Boolean(value));
  const uniqueIds = [...new Set(actorIds)].slice(0, 64);
  const generatedAt = now.toISOString();
  const actors: VisualActor[] = uniqueIds.map((id, index) => ({
    id,
    displayName: displayName(id),
    status: "idle",
    color: ACTOR_COLORS[index % ACTOR_COLORS.length] ?? ACTOR_COLORS[0],
  }));
  return {
    schemaVersion: 1,
    snapshotId: `visual-${now.getTime()}`,
    generatedAt,
    actors,
    tasks: [],
    notifications: [],
    system: { health: "healthy", label: "Private visual source online", observedAt: generatedAt },
    capabilities: {
      readOnly: true,
      actors: true,
      tasks: true,
      notifications: true,
      sessionAuth: false,
      scenarioControls: false,
      browserPreferences: true,
    },
    history: [],
  };
}

export function mapPrivateEvent(raw: unknown): VisualEvent | null {
  if (!isRecord(raw)) return null;
  const type = safeString(raw.type ?? raw.event_type, 80);
  const identity = eventIdentity(raw);
  const timestamp = occurredAt(raw.timestamp ?? raw.occurredAt);
  if (!type || !identity || !timestamp) return null;

  const data = eventData(raw);
  const actor = actorId(raw, data);
  switch (type) {
    case "orchestrator.route":
    case "agent.action":
      return actorEvent(identity, timestamp, actor, "working", true);
    case "agent.start":
    case "agent.thinking":
      return actorEvent(identity, timestamp, actor, "working");
    case "agent.response":
    case "agent.action_result":
      return actorEvent(identity, timestamp, actor, "idle");
    case "agent.error":
      return actorEvent(identity, timestamp, actor, "error");
    case "voice.listening":
    case "voice.speech_start":
    case "tts.start":
    case "tts.playing":
      return actorEvent(identity, timestamp, actor ?? "info", "voice");
    case "voice.speech_end":
    case "voice.stt_result":
    case "tts.done":
      return actorEvent(identity, timestamp, actor ?? "info", "idle");
    case "voice.stt_error":
      return actorEvent(identity, timestamp, actor ?? "info", "error");
    case "task.created":
    case "task.updated": {
      const task = mapTask(data, timestamp);
      return task ? {
        schemaVersion: 1,
        eventId: identity,
        type: "task.updated",
        occurredAt: timestamp,
        task,
        metadata: { channel: "task" },
      } : null;
    }
    case "notification.created": {
      const notification = mapNotification(data, timestamp);
      return notification ? {
        schemaVersion: 1,
        eventId: identity,
        type: "notification.created",
        occurredAt: timestamp,
        notification,
        metadata: { channel: "notification" },
      } : null;
    }
    case "system.service_up":
    case "system.service_down":
    case "system.error": {
      const system: VisualSystemStatus = {
        health: type === "system.service_up" ? "healthy" : "degraded",
        label: type === "system.service_up" ? "Visual source online" : "Visual source degraded",
        observedAt: timestamp,
      };
      return {
        schemaVersion: 1,
        eventId: identity,
        type: "system.status.changed",
        occurredAt: timestamp,
        system,
        metadata: { channel: "system" },
      };
    }
    case "stream.reset":
      return {
        schemaVersion: 1,
        eventId: identity,
        type: "stream.reset",
        occurredAt: timestamp,
        metadata: { reason: safeString(data.reason, 48) ?? "stream-gap" },
      };
    default:
      return null;
  }
}
