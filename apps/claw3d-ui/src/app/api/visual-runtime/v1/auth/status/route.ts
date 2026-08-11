export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    schemaVersion: 1,
    configured: false,
    authenticated: false,
    sessionAuth: false,
    reason: "Cross-origin session relay is intentionally disabled",
  }, { headers: { "cache-control": "no-store" } });
}
