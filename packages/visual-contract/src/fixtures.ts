import type {
  VisualActor,
  VisualCapabilities,
  VisualEvent,
  VisualNotification,
  VisualSnapshot,
  VisualSystemStatus,
  VisualTask,
} from "./index";

export const FIXTURE_TIME = "2026-08-11T08:00:00.000Z";

export const READ_ONLY_CAPABILITIES: VisualCapabilities = {
  readOnly: true,
  actors: true,
  tasks: true,
  notifications: true,
  sessionAuth: false,
  scenarioControls: false,
  browserPreferences: false,
};

export const MOCK_CAPABILITIES: VisualCapabilities = {
  ...READ_ONLY_CAPABILITIES,
  scenarioControls: true,
  browserPreferences: true,
};

export const MOCK_ACTORS: VisualActor[] = [
  {
    id: "info",
    displayName: "Info",
    role: "Research",
    status: "working",
    color: "#67e8f9",
    position: { x: -3.2, z: -1.3 },
    lastActivityAt: FIXTURE_TIME,
  },
  {
    id: "dev",
    displayName: "Dev",
    role: "Implementation",
    status: "idle",
    color: "#a78bfa",
    position: { x: 0, z: 1.4 },
  },
  {
    id: "qa",
    displayName: "QA",
    role: "Validation",
    status: "error",
    color: "#fb7185",
    position: { x: 3.2, z: -1.3 },
    lastActivityAt: FIXTURE_TIME,
  },
  {
    id: "ops",
    displayName: "Ops",
    role: "Observability",
    status: "voice",
    color: "#fbbf24",
    position: { x: 0, z: -3.3 },
    lastActivityAt: FIXTURE_TIME,
  },
];

export const MOCK_TASKS: VisualTask[] = [
  {
    id: "task-contract",
    title: "Normalize visual contract",
    status: "completed",
    actorId: "info",
    progress: 100,
    updatedAt: FIXTURE_TIME,
  },
  {
    id: "task-scene",
    title: "Compose autonomous office",
    status: "running",
    actorId: "dev",
    progress: 64,
    updatedAt: FIXTURE_TIME,
  },
  {
    id: "task-resilience",
    title: "Exercise stream reset",
    status: "queued",
    actorId: "qa",
    progress: 0,
    updatedAt: FIXTURE_TIME,
  },
];

export const MOCK_NOTIFICATIONS: VisualNotification[] = [
  {
    id: "notice-readonly",
    level: "info",
    title: "Read-only visual mode",
    occurredAt: FIXTURE_TIME,
  },
  {
    id: "notice-fixture",
    level: "warning",
    title: "Synthetic QA signal",
    occurredAt: FIXTURE_TIME,
  },
];

export const HEALTHY_SYSTEM: VisualSystemStatus = {
  health: "healthy",
  label: "Visual runtime available",
  observedAt: FIXTURE_TIME,
};

export const MOCK_HISTORY: VisualEvent[] = [
  {
    schemaVersion: 1,
    eventId: "fixture-event-1",
    type: "actor.activity",
    occurredAt: FIXTURE_TIME,
    actorId: "info",
    metadata: { source: "fixture" },
  },
  {
    schemaVersion: 1,
    eventId: "fixture-event-2",
    type: "task.updated",
    occurredAt: FIXTURE_TIME,
    task: MOCK_TASKS[1],
    metadata: { source: "fixture" },
  },
];

export function createMockSnapshot(overrides: Partial<VisualSnapshot> = {}): VisualSnapshot {
  return {
    schemaVersion: 1,
    snapshotId: "mock-snapshot-v1",
    generatedAt: FIXTURE_TIME,
    actors: MOCK_ACTORS.map((actor) => ({ ...actor, position: actor.position && { ...actor.position } })),
    tasks: MOCK_TASKS.map((task) => ({ ...task })),
    notifications: MOCK_NOTIFICATIONS.map((notification) => ({ ...notification })),
    system: { ...HEALTHY_SYSTEM },
    capabilities: { ...MOCK_CAPABILITIES },
    history: MOCK_HISTORY.map((event) => ({ ...event, metadata: { ...event.metadata } })),
    ...overrides,
  };
}
