import { NextResponse } from "next/server";

import { buildMockPhoneCallScenario } from "@/lib/office/call/mock";

export const runtime = "nodejs";

type PhoneCallRequestBody = {
  callee?: string;
  message?: string | null;
};

type ValidationErrorResponse = {
  error: "Validation failed";
  code: string;
  field: "body" | "callee" | "message";
  details: string;
  received?: Record<string, unknown> | null;
};

const MAX_CALLEE_CHARS = 120;
const MAX_MESSAGE_CHARS = 1_000;

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const requestMeta = {
      path: requestUrl.pathname,
      search: requestUrl.search || null,
      referer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    };
    console.info("office.call.request.start", requestMeta);

    let body: PhoneCallRequestBody;
    try {
      body = (await request.json()) as PhoneCallRequestBody;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON body';
      console.warn('office.call.validation_failed', {
        reason: 'invalid_json',
        message,
        ...requestMeta,
      });
      const responseBody: ValidationErrorResponse = {
        error: "Validation failed",
        code: "invalid_json",
        field: "body",
        details: message,
      };
      console.info("office.call.request.result", {
        ok: false,
        status: 400,
        code: responseBody.code,
      });
      return NextResponse.json(responseBody, { status: 400 });
    }
    console.info("office.call.request.body", {
      ...requestMeta,
      body,
    });
    const callee = normalizeText(body.callee) || "your contact";
    const message = normalizeText(body.message);

    if (callee.length > MAX_CALLEE_CHARS) {
      console.warn('office.call.validation_failed', {
        reason: 'callee_too_long',
        calleeLength: callee.length,
        maxCalleeChars: MAX_CALLEE_CHARS,
        ...requestMeta,
      });
      const responseBody: ValidationErrorResponse = {
        error: "Validation failed",
        code: "callee_too_long",
        field: "callee",
        details: `callee exceeds ${MAX_CALLEE_CHARS} characters.`,
        received: {
          callee,
          message: message || null,
        },
      };
      console.info("office.call.request.result", {
        ok: false,
        status: 400,
        code: responseBody.code,
      });
      return NextResponse.json(responseBody, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      console.warn('office.call.validation_failed', {
        reason: 'message_too_long',
        messageLength: message.length,
        maxMessageChars: MAX_MESSAGE_CHARS,
        ...requestMeta,
      });
      const responseBody: ValidationErrorResponse = {
        error: "Validation failed",
        code: "message_too_long",
        field: "message",
        details: `message exceeds ${MAX_MESSAGE_CHARS} characters.`,
        received: {
          callee,
          message,
        },
      };
      console.info("office.call.request.result", {
        ok: false,
        status: 400,
        code: responseBody.code,
      });
      return NextResponse.json(responseBody, { status: 400 });
    }

    // TODO: Create Claw3D voice and text skill.
    const scenario = buildMockPhoneCallScenario({
      callee,
      message: message || null,
      voiceAvailable: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    });

    console.info("office.call.request.result", {
      ok: true,
      status: 200,
      phase: scenario.phase,
      callee: scenario.callee,
      voiceAvailable: scenario.voiceAvailable,
    });

    return NextResponse.json(
      { scenario },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare the mock phone call.";
    console.error("office.call.error", {
      error: message,
    });
    return NextResponse.json(
      {
        error: "Office call preparation failed",
        code: "office_call_failed",
        details: message,
      },
      { status: 500 },
    );
  }
}
