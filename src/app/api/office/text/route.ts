import { NextResponse } from "next/server";

import { buildMockTextMessageScenario } from "@/lib/office/text/mock";
import { isPhoneNumberLike, normalizePhoneNumber } from "@/lib/office/twilio";
import {
  dispatchSendSms,
  getDefaultSmsProvider,
  getSmsProviderStatus,
  type SmsCapableProvider,
} from "@/lib/office/messagingProviders";

export const runtime = "nodejs";

type TextMessageRequestBody = {
  recipient?: string;
  message?: string | null;
  /** Optional: override the active messaging provider for this request. */
  provider?: SmsCapableProvider;
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

    const provider = body.provider ?? getDefaultSmsProvider();
    const providerReady = getSmsProviderStatus(provider) === "configured";
    const recipientIsPhone = isPhoneNumberLike(recipient);

    // Provider configured + phone number + message → real SMS
    if (providerReady && recipientIsPhone && message) {
      const to = normalizePhoneNumber(recipient);
      await dispatchSendSms({ to, body: message, provider });
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

    // Provider configured but no message yet → prompt for message
    if (providerReady && recipientIsPhone && !message) {
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

    // Fallback: mock mode (no provider configured or recipient is not a phone number)
    const scenario = buildMockTextMessageScenario({ recipient, message: message || null });
    return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send text message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
