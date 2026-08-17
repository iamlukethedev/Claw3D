import { NextResponse } from "next/server";

import { buildMockPhoneCallScenario } from "@/lib/office/call/mock";

export const runtime = "nodejs";

type PhoneCallRequestBody = {
  callee?: string;
  message?: string | null;
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

    // TODO: Create Hermes3D voice and text skill.
    const scenario = buildMockPhoneCallScenario({
      callee,
      message: message || null,
      voiceAvailable: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    });

    return NextResponse.json(
      { scenario },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare the mock phone call.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
