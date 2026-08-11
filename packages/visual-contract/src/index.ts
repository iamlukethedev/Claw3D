export const VISUAL_SCHEMA_VERSION = 1 as const;

export type VisualActorStatus =
  | "unknown"
  | "idle"
  | "working"
  | "voice"
  | "error"
  | "offline";

export interface VisualPoint {
  x: number;
  z: number;
}

export interface VisualActor {
  id: string;
  displayName: string;
  role?: string;
  status: VisualActorStatus;
  color: string;
  position?: VisualPoint;
  lastActivityAt?: string;
}

export type VisualTaskStatus = "queued" | "running" | "completed" | "failed";

export interface VisualTask {
  id: string;
  title: string;
  status: VisualTaskStatus;
  actorId?: string;
  progress?: number;
  updatedAt: string;
}

export interface VisualNotification {
  id: string;
  level: "info" | "warning" | "error";
  title: string;
  occurredAt: string;
}

export interface VisualSystemStatus {
  health: "unknown" | "healthy" | "degraded" | "offline" | "locked";
  label: string;
  observedAt: string;
}

export interface VisualCapabilities {
  readOnly: true;
  actors: boolean;
  tasks: boolean;
  notifications: boolean;
  sessionAuth: boolean;
  scenarioControls: boolean;
  browserPreferences: boolean;
}

export type VisualConnectionPhase =
  | "idle"
  | "loading"
  | "online"
  | "reconnecting"
  | "offline"
  | "locked"
  | "rate-limited"
  | "error";

export interface VisualConnectionState {
  phase: VisualConnectionPhase;
  attempt: number;
  label: string;
  retryAt?: string;
}

export interface VisualSnapshot {
  schemaVersion: typeof VISUAL_SCHEMA_VERSION;
  snapshotId: string;
  generatedAt: string;
  actors: VisualActor[];
  tasks: VisualTask[];
  notifications: VisualNotification[];
  system: VisualSystemStatus;
  capabilities: VisualCapabilities;
  history: VisualEvent[];
}

export type VisualEventType =
  | "actor.status.changed"
  | "actor.activity"
  | "task.updated"
  | "notification.created"
  | "system.status.changed"
  | "stream.reset";

export type VisualMetadataValue = string | number | boolean | null;

export interface VisualEvent {
  schemaVersion: typeof VISUAL_SCHEMA_VERSION;
  eventId: string;
  type: VisualEventType | (string & {});
  occurredAt: string;
  actorId?: string;
  state?: VisualActorStatus;
  task?: VisualTask;
  notification?: VisualNotification;
  system?: VisualSystemStatus;
  metadata: Record<string, VisualMetadataValue>;
}

export interface QueryPort {
  getSnapshot(signal?: AbortSignal): Promise<VisualSnapshot>;
}

export interface EventSubscriptionOptions {
  lastEventId?: string;
  signal?: AbortSignal;
}

export interface EventPort {
  subscribe(
    options: EventSubscriptionOptions,
    onEvent: (event: VisualEvent) => void,
    onConnectionChange?: (state: VisualConnectionState) => void,
  ): () => void;
}

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clearNamespace(): void;
}

export interface AssetResolver {
  resolve(assetId: string): string;
}

export interface VisualRuntimeAdapter {
  readonly id: "mock" | "null" | "jarvis-readonly";
  readonly query: QueryPort;
  readonly events: EventPort;
}
