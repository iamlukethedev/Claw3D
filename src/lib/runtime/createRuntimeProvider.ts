import { CustomRuntimeProvider } from "@/lib/runtime/custom/provider";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { DemoRuntimeProvider } from "@/lib/runtime/demo/provider";
import { HermesRuntimeProvider } from "@/lib/runtime/hermes/provider";
import { OpenClawRuntimeProvider } from "@/lib/runtime/openclaw/provider";
import { PaperclipRuntimeProvider } from "@/lib/runtime/paperclip/provider";
import type { RuntimeProvider } from "@/lib/runtime/types";

export const createRuntimeProvider = (
  providerId: RuntimeProvider["id"],
  client: GatewayClient,
  runtimeUrl: string
): RuntimeProvider => {
  switch (providerId) {
    case "custom":
      return new CustomRuntimeProvider(client, runtimeUrl);
    case "demo":
      return new DemoRuntimeProvider(client);
    case "hermes":
      return new HermesRuntimeProvider(client);
    case "paperclip":
      return new PaperclipRuntimeProvider(client);
    case "openclaw":
    default:
      return new OpenClawRuntimeProvider(client);
  }
};
