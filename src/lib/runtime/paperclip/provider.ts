import type {
  EventFrame,
  GatewayConnectOptions,
  GatewayGapInfo,
  GatewayStatus,
} from "@/lib/gateway/GatewayClient";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { normalizeGatewayEvent } from "@/lib/runtime/openclaw/normalizeGatewayEvent";
import type { RuntimeCapability, RuntimeEvent, RuntimeProvider } from "@/lib/runtime/types";

const PAPERCLIP_RUNTIME_CAPABILITIES: ReadonlySet<RuntimeCapability> = new Set([
  "agents",
  "sessions",
  "chat",
  "streaming",
  "config",
  "models",
  "files",
  "agent-roles",
]);

export class PaperclipRuntimeProvider implements RuntimeProvider {
  readonly id = "paperclip" as const;
  readonly label = "Paperclip";
  readonly metadata = {
    id: this.id,
    label: this.label,
    runtimeName: "Paperclip",
  } as const;
  readonly capabilities = PAPERCLIP_RUNTIME_CAPABILITIES;

  constructor(readonly client: GatewayClient) {}

  connect(options: GatewayConnectOptions): Promise<void> {
    return this.client.connect(options);
  }

  disconnect(): void {
    this.client.disconnect();
  }

  call<T = unknown>(method: string, params: unknown): Promise<T> {
    return this.client.call<T>(method, params);
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
