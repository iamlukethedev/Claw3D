import { getVisualSnapshot, VisualConnectorError } from "../../../../../server/jarvisConnector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const snapshot = await getVisualSnapshot(request.signal);
    return Response.json(snapshot, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof VisualConnectorError ? error.status : 502;
    return Response.json(
      { schemaVersion: 1, error: "visual_connector_unavailable" },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
