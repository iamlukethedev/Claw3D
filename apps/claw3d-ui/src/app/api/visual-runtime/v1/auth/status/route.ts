import { SESSION_AUTH_POLICY } from "../../../../../../server/sessionAuthPolicy";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    schemaVersion: 1,
    configured: false,
    authenticated: false,
    sessionAuth: SESSION_AUTH_POLICY.enabled,
    cookieRelay: SESSION_AUTH_POLICY.cookieRelay,
    reason: SESSION_AUTH_POLICY.reason,
  }, { headers: { "cache-control": "no-store" } });
}
