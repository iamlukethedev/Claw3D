const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER?.trim() ?? "";

export const isTwilioConfigured = (): boolean =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);

const twilioApiUrl = (path: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}${path}`;

const twilioHeaders = (): Record<string, string> => ({
  Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
  "Content-Type": "application/x-www-form-urlencoded",
});

// Normalise un numéro vers le format E.164 (+XXXXXXXXXXX).
// Accepte : 0612345678, +33612345678, 06 12 34 56 78, (555) 123-4567, etc.
export const normalizePhoneNumber = (value: string): string => {
  const digits = value.replace(/[^\d+]/g, "");
  // Déjà au format international
  if (digits.startsWith("+")) return digits;
  // Numéro français commençant par 0 → +33
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`;
  // Numéro US à 10 chiffres
  if (digits.length === 10) return `+1${digits}`;
  // Numéro US à 11 chiffres commençant par 1
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Fallback : ajoute + si absent
  return `+${digits}`;
};

export const isPhoneNumberLike = (value: string): boolean => /[\d+]/.test(value);

export const sendSms = async (params: { to: string; body: string }): Promise<{ sid: string }> => {
  const form = new URLSearchParams({
    To: params.to,
    From: TWILIO_PHONE_NUMBER,
    Body: params.body,
  });

  const response = await fetch(twilioApiUrl("/Messages.json"), {
    method: "POST",
    headers: twilioHeaders(),
    body: form.toString(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? `Twilio SMS error ${response.status}`);
  }

  const result = (await response.json()) as { sid: string };
  return { sid: result.sid };
};

export const makeCall = async (params: { to: string; message: string }): Promise<{ sid: string }> => {
  const escaped = params.message.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] ?? c));
  const twiml = `<Response><Pause length="1"/><Say voice="alice" language="fr-FR">Message de votre assistant. ${escaped}</Say></Response>`;

  const form = new URLSearchParams({
    To: params.to,
    From: TWILIO_PHONE_NUMBER,
    Twiml: twiml,
  });

  const response = await fetch(twilioApiUrl("/Calls.json"), {
    method: "POST",
    headers: twilioHeaders(),
    body: form.toString(),
  });

  if (!response.ok) {
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? `Twilio call error ${response.status}`);
  }

  const result = (await response.json()) as { sid: string };
  return { sid: result.sid };
};
