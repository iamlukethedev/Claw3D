import { NextResponse } from "next/server";

import { buildMockPhoneCallScenario } from "@/lib/office/call/mock";
import { isPhoneNumberLike, normalizePhoneNumber } from "@/lib/office/twilio";
import {
  dispatchMakeCall,
  getDefaultCallProvider,
  getCallProviderStatus,
  type CallCapableProvider,
} from "@/lib/office/messagingProviders";

export const runtime = "nodejs";

type PhoneCallRequestBody = {
  callee?: string;
  message?: string | null;
  /** Optional: override the active messaging provider for this request. */
  provider?: CallCapableProvider;
};

const MAX_CALLEE_CHARS = 120;
const MAX_MESSAGE_CHARS = 1_000;

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PhoneCallRequestBody;
    const callee = normalizeText(body.callee);
    const message = normalizeText(body.message);

    if (!callee) {
      return NextResponse.json({ error: "callee is required." }, { status: 400 });
    }
    if (callee.length > MAX_CALLEE_CHARS) {
      return NextResponse.json(
        { error: `callee exceeds ${MAX_CALLEE_CHARS} characters.` },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `message exceeds ${MAX_MESSAGE_CHARS} characters.` },
        { status: 400 },
      );
    }

    const provider = body.provider ?? getDefaultCallProvider();
    const providerReady = getCallProviderStatus(provider) === "configured";
    const calleeIsPhone = isPhoneNumberLike(callee);

    // Provider configured + phone number + message → real call
    if (providerReady && calleeIsPhone && message) {
      const to = normalizePhoneNumber(callee);
      await dispatchMakeCall({ to, message, provider });
      const scenario = {
        phase: "ready_to_call" as const,
        callee,
        dialNumber: to,
        promptText: null,
        spokenText: message,
        recipientReply: null,
        statusLine: `Appel lancé vers ${callee}.`,
        voiceAvailable: false,
      };
      return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
    }

    // Provider configured but no message yet → prompt for message
    if (providerReady && calleeIsPhone && !message) {
      const scenario = {
        phase: "needs_message" as const,
        callee,
        dialNumber: normalizePhoneNumber(callee),
        promptText: `Que voulez-vous dire à ${callee} ?`,
        spokenText: null,
        recipientReply: null,
        statusLine: `En attente de votre message pour ${callee}.`,
        voiceAvailable: false,
      };
      return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
    }

    // Fallback: mock mode (no provider configured or recipient is not a phone number)
    const scenario = buildMockPhoneCallScenario({
      callee,
      message: message || null,
      voiceAvailable: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    });
    return NextResponse.json({ scenario }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place phone call.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
