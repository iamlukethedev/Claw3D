import { NextResponse } from "next/server";

import { buildMockTextMessageScenario } from "@/lib/office/text/mock";
import { isTwilioConfigured, isPhoneNumberLike, normalizePhoneNumber, sendSms } from "@/lib/office/twilio";

export const runtime = "nodejs";

type TextMessageRequestBody = {
  recipient?: string;
  message?: string | null;
};

const MAX_RECIPIENT_CHARS = 120;
const MAX_MESSAGE_CHARS = 1_000;

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TextMessageRequestBody;
    const recipient = normalizeText(body.recipient);
    const message = normalizeText(body.message);

    if (!recipient) {
      return NextResponse.json({ error: "recipient is required." }, { status: 400 });
    }
    if (recipient.length > MAX_RECIPIENT_CHARS) {
      return NextResponse.json(
        { error: `recipient exceeds ${MAX_RECIPIENT_CHARS} characters.` },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `message exceeds ${MAX_MESSAGE_CHARS} characters.` },
        { status: 400 },
      );
    }

    const twilioEnabled = isTwilioConfigured();
    const recipientIsPhone = isPhoneNumberLike(recipient);

    // Si Twilio est configuré, le destinataire ressemble à un numéro, et on a un message : envoi réel
    if (twilioEnabled && recipientIsPhone && message) {
      const to = normalizePhoneNumber(recipient);
      await sendSms({ to, body: message });
      const scenario = {
        phase: "ready_to_send" as const,
        recipient,
        messageText: message,
        confirmationText: "SMS envoyé via Twilio.",
        promptText: null,
        statusLine: `SMS envoyé à ${recipient}.`,
      };
      return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
    }

    // Si Twilio est configuré mais pas de message encore, demander le message
    if (twilioEnabled && recipientIsPhone && !message) {
      const scenario = {
        phase: "needs_message" as const,
        recipient,
        messageText: null,
        confirmationText: null,
        promptText: `Que voulez-vous envoyer à ${recipient} ?`,
        statusLine: `En attente de votre message pour ${recipient}.`,
      };
      return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
    }

    // Fallback : mode mock (Twilio non configuré ou destinataire non numérique)
    const scenario = buildMockTextMessageScenario({ recipient, message: message || null });
    return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send text message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
