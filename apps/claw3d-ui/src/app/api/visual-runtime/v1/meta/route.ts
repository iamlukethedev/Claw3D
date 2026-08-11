import { readVisualRuntimeConfig } from "../../../../../composition/config";
import { SESSION_AUTH_POLICY } from "../../../../../server/sessionAuthPolicy";

export const dynamic = "force-dynamic";

export function GET() {
  const config = readVisualRuntimeConfig(process.env);
  return Response.json({
    schemaVersion: 1,
    adapter: config.adapter,
    connectorEnabled: config.adapter === "jarvis-readonly" && config.connectorEnabled,
    capabilities: {
      readOnly: true,
      sessionAuth: SESSION_AUTH_POLICY.enabled,
      businessCommands: false,
    },
  }, { headers: { "cache-control": "no-store" } });
}
