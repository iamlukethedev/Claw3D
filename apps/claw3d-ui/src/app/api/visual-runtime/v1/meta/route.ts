import { readVisualRuntimeConfig } from "../../../../../composition/config";

export const dynamic = "force-dynamic";

export function GET() {
  const config = readVisualRuntimeConfig(process.env);
  return Response.json({
    schemaVersion: 1,
    adapter: config.adapter,
    connectorEnabled: config.adapter === "jarvis-readonly" && config.connectorEnabled,
    capabilities: {
      readOnly: true,
      sessionAuth: false,
      businessCommands: false,
    },
  }, { headers: { "cache-control": "no-store" } });
}
