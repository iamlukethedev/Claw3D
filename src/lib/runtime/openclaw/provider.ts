import type {
  EventFrame,
  GatewayConnectOptions,
  GatewayGapInfo,
  GatewayStatus,
} from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import {
  sendAgentHandoffViaRuntime,
  sendDirectedAgentMessageViaRuntime,
} from "@/lib/runtime/agentMessaging";
import { normalizeGatewayEvent } from "@/lib/runtime/openclaw/normalizeGatewayEvent";
import type { RuntimeCapability, RuntimeEvent, RuntimeProvider } from "@/lib/runtime/types";

const OPENCLAW_RUNTIME_CAPABILITIES: ReadonlySet<RuntimeCapability> = new Set([
  "agents",
  "sessions",
  "chat",
  "agent-messages",
  "agent-handoffs",
  "streaming",
  "runtime-agent-events",
  "approvals",
  "config",
  "models",
  "skills",
  "cron",
  "files",
  "agent-roles",
]);

export class OpenClawRuntimeProvider implements RuntimeProvider {
  readonly id = "openclaw" as const;
  readonly label = "OpenClaw";
  readonly metadata = {
    id: this.id,
    label: this.label,
    runtimeName: "OpenClaw",
  } as const;
  readonly capabilities = OPENCLAW_RUNTIME_CAPABILITIES;

  constructor(readonly client: GatewayClient) {}

  connect(options: GatewayConnectOptions): Promise<void> {
    return this.client.connect(options);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  async call<T = unknown>(method: string, params: unknown): Promise<T> {
    switch (method) {
      case "agents.message":
        return (await sendDirectedAgentMessageViaRuntime(this.client, params as never)) as T;
      case "agents.handoff":
        return (await sendAgentHandoffViaRuntime(this.client, params as never)) as T;
      default:
        return this.client.call<T>(method, params);
    }
  }

  onStatus(handler: (status: GatewayStatus) => void): () => void {
    return this.client.onStatus(handler);
  }

  onGap(handler: (info: GatewayGapInfo) => void): () => void {
    return this.client.onGap(handler);
  }

  onEvent(handler: (event: EventFrame) => void): () => void {
    return this.client.onEvent(handler);
  }

  onRuntimeEvent(handler: (event: RuntimeEvent) => void): () => void {
    return this.client.onEvent((event) => {
      handler(normalizeGatewayEvent(event));
    });
  }
}
