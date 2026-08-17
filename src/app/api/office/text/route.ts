import { NextResponse } from "next/server";

import { buildMockTextMessageScenario } from "@/lib/office/text/mock";

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

    // TODO: Create Hermes3D voice and text skill.
    const scenario = buildMockTextMessageScenario({
      recipient,
      message: message || null,
    });

    return NextResponse.json(
      { scenario },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare the mock text message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
