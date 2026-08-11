import {
  createMockSnapshot,
  FIXTURE_TIME,
  MOCK_CAPABILITIES,
} from "@claw3d/visual-contract/fixtures";
import type {
  EventPort,
  QueryPort,
  VisualConnectionState,
  VisualEvent,
  VisualRuntimeAdapter,
  VisualSnapshot,
} from "@claw3d/visual-contract";

export const MOCK_SCENARIOS = [
  "loading",
  "empty",
  "offline",
  "inactive",
  "active",
  "error",
  "multiple",
  "reconnect",
  "reset",
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function snapshotForScenario(scenario: MockScenario): VisualSnapshot {
  const base = createMockSnapshot();
  if (scenario === "empty") return createMockSnapshot({ actors: [], tasks: [], notifications: [], history: [] });
  if (scenario === "offline") {
    return createMockSnapshot({
      actors: base.actors.map((actor) => ({ ...actor, status: "offline" })),
      system: { health: "offline", label: "Offline fixture", observedAt: FIXTURE_TIME },
    });
  }
  if (scenario === "inactive") {
    return createMockSnapshot({ actors: [base.actors[1] && { ...base.actors[1], status: "idle" }].filter(Boolean) as VisualSnapshot["actors"] });
  }
  if (scenario === "active") {
    return createMockSnapshot({ actors: [{ ...base.actors[0], status: "working" }] });
  }
  if (scenario === "error") {
    return createMockSnapshot({
      actors: [{ ...base.actors[2], status: "error" }],
      system: { health: "degraded", label: "Synthetic adapter error", observedAt: FIXTURE_TIME },
    });
  }
  return base;
}

const EVENT_SEQUENCE: VisualEvent[] = [
  {
    schemaVersion: 1,
    eventId: "mock-live-1",
    type: "actor.status.changed",
    occurredAt: new Date().toISOString(),
    actorId: "dev",
    state: "working",
    metadata: { source: "mock" },
  },
  {
    schemaVersion: 1,
    eventId: "mock-live-2",
    type: "task.updated",
    occurredAt: new Date().toISOString(),
    task: {
      id: "task-scene",
      title: "Compose autonomous office",
      status: "completed",
      actorId: "dev",
      progress: 100,
      updatedAt: new Date().toISOString(),
    },
    metadata: { source: "mock" },
  },
  {
    schemaVersion: 1,
    eventId: "mock-live-3",
    type: "actor.status.changed",
    occurredAt: new Date().toISOString(),
    actorId: "dev",
    state: "idle",
    metadata: { source: "mock" },
  },
];

export interface MockVisualRuntimeAdapter extends VisualRuntimeAdapter {
  readonly id: "mock";
  getScenario(): MockScenario;
  setScenario(scenario: MockScenario): void;
}

export function createMockAdapter(initialScenario: MockScenario = "multiple"): MockVisualRuntimeAdapter {
  let scenario = initialScenario;

  const query: QueryPort = {
    async getSnapshot(signal) {
      await wait(scenario === "loading" ? 850 : 80, signal);
      return snapshotForScenario(scenario === "loading" ? "multiple" : scenario);
    },
  };

  const events: EventPort = {
    subscribe(options, onEvent, onConnectionChange) {
      let stopped = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const emitConnection = (state: VisualConnectionState, delay: number) => {
        timers.push(setTimeout(() => !stopped && onConnectionChange?.(state), delay));
      };
      const emit = (event: VisualEvent, delay: number) => {
        timers.push(setTimeout(() => !stopped && onEvent(event), delay));
      };

      if (scenario === "offline") {
        emitConnection({ phase: "offline", attempt: 0, label: "Mock offline" }, 20);
      } else if (scenario === "reconnect") {
        emitConnection({ phase: "reconnecting", attempt: 1, label: "Mock reconnecting" }, 20);
        emitConnection({ phase: "online", attempt: 0, label: "Mock recovered" }, 900);
      } else {
        emitConnection({ phase: "online", attempt: 0, label: "Mock stream online" }, 20);
      }

      if (scenario === "reset") {
        emit(
          {
            schemaVersion: 1,
            eventId: "mock-stream-reset",
            type: "stream.reset",
            occurredAt: new Date().toISOString(),
            metadata: { reason: "fixture" },
          },
          700,
        );
      } else if (!["offline", "empty", "inactive", "error"].includes(scenario)) {
        EVENT_SEQUENCE.forEach((event, index) => {
          if (event.eventId !== options.lastEventId) emit({ ...event, occurredAt: new Date().toISOString() }, 900 + index * 900);
        });
      }

      const stop = () => {
        stopped = true;
        timers.forEach(clearTimeout);
      };
      options.signal?.addEventListener("abort", stop, { once: true });
      return stop;
    },
  };

  return {
    id: "mock",
    query,
    events,
    getScenario: () => scenario,
    setScenario(next) {
      scenario = next;
    },
  };
}

export { MOCK_CAPABILITIES };
