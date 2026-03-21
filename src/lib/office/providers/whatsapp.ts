/**
 * WhatsApp provider — sends messages via the Twilio WhatsApp API.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID      — same as the voice/SMS Twilio account
 *   TWILIO_AUTH_TOKEN       — same as the voice/SMS Twilio account
 *   TWILIO_WHATSAPP_NUMBER  — your WhatsApp-enabled Twilio number
 *                             format: whatsapp:+14155238886
 *                             (get one at console.twilio.com/develop/sms/whatsapp/senders)
 *
 * The recipient number must be in E.164 format (+1…, +33…, etc.).
 * Twilio will prefix it with "whatsapp:" automatically.
 *
 * Note: outbound WhatsApp calls are not supported via this provider.
 * WhatsApp calling requires the Meta Cloud API with calling permissions,
 * which is not yet generally available.
 *
 * Docs: https://www.twilio.com/docs/whatsapp/api
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER?.trim() ?? "";

const twilioApiUrl = (path: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}${path}`;

const authHeader = () =>
  `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`;

export const isWhatsAppTwilioConfigured = (): boolean =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);

export const sendWhatsAppMessage = async (params: {
  to: string;
  body: string;
}): Promise<{ sid: string }> => {
  const from = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_NUMBER
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  const to = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`;

  const form = new URLSearchParams({ To: to, From: from, Body: params.body });

  const response = await fetch(twilioApiUrl("/Messages.json"), {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? `WhatsApp (Twilio) error ${response.status}`);
  }

  const result = (await response.json()) as { sid: string };
  return { sid: result.sid };
};
