/**
 * iMessage provider — sends messages via the BlueBubbles server.
 *
 * Apple does not provide a public API for iMessage. This provider uses
 * BlueBubbles (https://bluebubbles.app), an open-source Mac server that
 * exposes a REST API to send and receive iMessages from any device.
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 * 1. Install BlueBubbles on a Mac that stays on and signed into iMessage:
 *    https://github.com/BlueBubblesApp/bluebubbles-server/releases
 * 2. In BlueBubbles settings, note the server URL and set a password.
 * 3. Make sure the Mac is reachable from your Claw3D server
 *    (same network, or expose via ngrok / Cloudflare Tunnel).
 * 4. Set env vars:
 *
 * Required env vars:
 *   IMESSAGE_BLUEBUBBLES_URL       — BlueBubbles server base URL
 *                                    example: http://192.168.1.50:1234
 *                                    or: https://your-ngrok-url.ngrok.io
 *   IMESSAGE_BLUEBUBBLES_PASSWORD  — the password set in BlueBubbles settings
 *
 * ── Recipient format ─────────────────────────────────────────────────────────
 * The `to` field accepts a phone number (E.164: +1…, +33…) or an Apple ID
 * email address. BlueBubbles resolves the correct chat GUID automatically.
 *
 * ── Limitations ──────────────────────────────────────────────────────────────
 * - Requires a Mac running BlueBubbles to be online.
 * - Outbound calls are not supported.
 * - Group chats require passing the full chat GUID instead of a phone number.
 *
 * Docs: https://documenter.getpostman.com/view/765844/UV5RnfwM
 */

const BLUEBUBBLES_URL = process.env.IMESSAGE_BLUEBUBBLES_URL?.trim().replace(/\/$/, "") ?? "";
const BLUEBUBBLES_PASSWORD = process.env.IMESSAGE_BLUEBUBBLES_PASSWORD?.trim() ?? "";

export const isIMessageConfigured = (): boolean =>
  Boolean(BLUEBUBBLES_URL && BLUEBUBBLES_PASSWORD);

export const sendIMessage = async (params: {
  to: string;
  body: string;
}): Promise<{ sid: string }> => {
  if (!BLUEBUBBLES_URL) throw new Error("IMESSAGE_BLUEBUBBLES_URL is not set.");
  if (!BLUEBUBBLES_PASSWORD) throw new Error("IMESSAGE_BLUEBUBBLES_PASSWORD is not set.");

  // BlueBubbles chat GUID format for individual iMessage: "iMessage;-;+1234567890"
  // If the caller already passed a full GUID, use it as-is.
  const chatGuid = params.to.startsWith("iMessage;")
    ? params.to
    : `iMessage;-;${params.to}`;

  const url = `${BLUEBUBBLES_URL}/api/v1/message/text?password=${encodeURIComponent(BLUEBUBBLES_PASSWORD)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatGuid,
      message: params.body,
      method: "apple-script",
      // tempGuid is optional — BlueBubbles uses it for dedup on its end
      tempGuid: `claw3d-${Date.now()}`,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new Error(
      error?.message ?? error?.error ?? `BlueBubbles error ${response.status}`,
    );
  }

  const result = (await response.json()) as { data?: { guid?: string } };
  return { sid: result.data?.guid ?? "ok" };
};
