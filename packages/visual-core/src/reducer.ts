import type {
  VisualActorStatus,
  VisualConnectionState,
  VisualEvent,
  VisualSnapshot,
} from "@claw3d/visual-contract";

const TRANSIENT_MAX_AGE_MS = 30_000;
const MAX_EVENT_IDS = 256;
const KNOWN_STATUSES = new Set<VisualActorStatus>([
  "unknown",
  "idle",
  "working",
  "voice",
  "error",
  "offline",
]);

export interface VisualState {
  snapshot: VisualSnapshot | null;
  connection: VisualConnectionState;
  eventIds: string[];
  lastEventId?: string;
}

export type VisualAction =
  | { type: "load.started" }
  | { type: "snapshot.received"; snapshot: VisualSnapshot }
  | { type: "event.received"; event: VisualEvent; receivedAt?: string }
  | { type: "connection.changed"; connection: VisualConnectionState }
  | { type: "stream.reset"; snapshot?: VisualSnapshot };

export const INITIAL_VISUAL_STATE: VisualState = {
  snapshot: null,
  connection: { phase: "idle", attempt: 0, label: "Not started" },
  eventIds: [],
};

function isRecent(event: VisualEvent, receivedAt: string): boolean {
  const occurred = Date.parse(event.occurredAt);
  const received = Date.parse(receivedAt);
  if (!Number.isFinite(occurred) || !Number.isFinite(received)) return false;
  return received - occurred <= TRANSIENT_MAX_AGE_MS && occurred - received <= 5_000;
}

function withEventId(state: VisualState, eventId: string): Pick<VisualState, "eventIds" | "lastEventId"> {
  return {
    eventIds: [...state.eventIds, eventId].slice(-MAX_EVENT_IDS),
    lastEventId: eventId,
  };
}

function applyEvent(state: VisualState, event: VisualEvent, receivedAt: string): VisualState {
  if (!state.snapshot || state.eventIds.includes(event.eventId) || event.schemaVersion !== 1) {
    return state;
  }
  const ids = withEventId(state, event.eventId);

  if (event.type === "stream.reset") {
    return resetVisualStream({ ...state, ...ids });
  }

  if (event.type === "actor.status.changed" || event.type === "actor.activity") {
    if (!event.actorId) return { ...state, ...ids };
    const requestedStatus = event.type === "actor.activity" ? "working" : event.state;
    if (!requestedStatus || !KNOWN_STATUSES.has(requestedStatus)) return { ...state, ...ids };
    if ((requestedStatus === "working" || requestedStatus === "voice") && !isRecent(event, receivedAt)) {
      return { ...state, ...ids };
    }
    return {
      ...state,
      ...ids,
      snapshot: {
        ...state.snapshot,
        actors: state.snapshot.actors.map((actor) =>
          actor.id === event.actorId
            ? { ...actor, status: requestedStatus, lastActivityAt: event.occurredAt }
            : actor,
        ),
      },
    };
  }

  if (event.type === "task.updated" && event.task) {
    const existing = state.snapshot.tasks.some((task) => task.id === event.task!.id);
    return {
      ...state,
      ...ids,
      snapshot: {
        ...state.snapshot,
        tasks: existing
          ? state.snapshot.tasks.map((task) => (task.id === event.task!.id ? { ...event.task! } : task))
          : [...state.snapshot.tasks, { ...event.task }],
      },
    };
  }

  if (event.type === "notification.created" && event.notification) {
    return {
      ...state,
      ...ids,
      snapshot: {
        ...state.snapshot,
        notifications: [event.notification, ...state.snapshot.notifications].slice(0, 20),
      },
    };
  }

  if (event.type === "system.status.changed" && event.system) {
    return { ...state, ...ids, snapshot: { ...state.snapshot, system: { ...event.system } } };
  }

  return { ...state, ...ids };
}

export function resetVisualStream(state: VisualState, snapshot?: VisualSnapshot): VisualState {
  const nextSnapshot = snapshot ??
    (state.snapshot
      ? {
          ...state.snapshot,
          actors: state.snapshot.actors.map((actor) => ({
            ...actor,
            status: actor.status === "offline" ? "offline" : "idle",
          })),
          history: [],
        }
      : null);
  return {
    ...state,
    snapshot: nextSnapshot,
    eventIds: [],
    lastEventId: undefined,
    connection: { phase: "reconnecting", attempt: 1, label: "Stream reset" },
  };
}

export function visualReducer(state: VisualState, action: VisualAction): VisualState {
  switch (action.type) {
    case "load.started":
      return { ...state, connection: { phase: "loading", attempt: 0, label: "Loading snapshot" } };
    case "snapshot.received":
      return {
        snapshot: action.snapshot,
        connection: { phase: "online", attempt: 0, label: "Visual runtime online" },
        eventIds: action.snapshot.history.map((event) => event.eventId).slice(-MAX_EVENT_IDS),
        lastEventId: action.snapshot.history.at(-1)?.eventId,
      };
    case "event.received":
      return applyEvent(state, action.event, action.receivedAt ?? new Date().toISOString());
    case "connection.changed":
      return { ...state, connection: action.connection };
    case "stream.reset":
      return resetVisualStream(state, action.snapshot);
  }
}
