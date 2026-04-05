import type {
  EventFrame,
  GatewayClient,
  GatewayConnectOptions,
  GatewayGapInfo,
  GatewayStatus,
} from "@/lib/gateway/GatewayClient";

export type RuntimeCapability =
  | "agents"
  | "sessions"
  | "chat"
  | "streaming"
  | "runtime-agent-events"
  | "approvals"
  | "config"
  | "models"
  | "skills"
  | "cron"
  | "files"
  | "agent-roles";

export type RuntimeProviderId = "openclaw" | "hermes" | "demo" | "custom";

export type RuntimeProviderMetadata = {
  id: RuntimeProviderId;
  label: string;
  runtimeName?: string | null;
  vendor?: string | null;
  runtimeVersion?: string | null;
  routeProfile?: string | null;
};

export type RuntimeSummaryEvent = {
  type: "summary-refresh";
  at: number;
  frame: EventFrame;
};

export type RuntimeChatEvent =
  | {
      type: "chat.delta";
      at: number;
      frame: EventFrame;
      runId: string | null;
      sessionKey: string | null;
      text: string | null;
    }
  | {
      type: "chat.final" | "chat.error" | "chat.aborted";
      at: number;
      frame: EventFrame;
      runId: string | null;
      sessionKey: string | null;
      text: string | null;
    };

export type RuntimeLifecycleEvent = {
  type: "run.lifecycle";
  at: number;
  frame: EventFrame;
  runId: string | null;
  sessionKey: string | null;
  phase: "start" | "end" | "error";
};

export type RuntimeUnknownEvent = {
  type: "unknown";
  at: number;
  frame: EventFrame;
};

export type RuntimeEvent =
  | RuntimeSummaryEvent
  | RuntimeChatEvent
  | RuntimeLifecycleEvent
  | RuntimeUnknownEvent;

export type RuntimeStatus = GatewayStatus;

export interface RuntimeProvider {
  readonly id: RuntimeProviderId;
  readonly label: string;
  readonly metadata: RuntimeProviderMetadata;
  readonly capabilities: ReadonlySet<RuntimeCapability>;
  readonly client: GatewayClient;
  connect(options: GatewayConnectOptions): Promise<void>;
  disconnect(): void;
  call<T = unknown>(method: string, params: unknown): Promise<T>;
  onStatus(handler: (status: RuntimeStatus) => void): () => void;
  onGap(handler: (info: GatewayGapInfo) => void): () => void;
  onEvent(handler: (event: EventFrame) => void): () => void;
  onRuntimeEvent(handler: (event: RuntimeEvent) => void): () => void;
}

export const hasRuntimeCapability = (
  capabilities: ReadonlySet<RuntimeCapability>,
  capability: RuntimeCapability
): boolean => capabilities.has(capability);
