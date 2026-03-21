import { NextResponse } from "next/server";

import { transcribeVoiceWithOpenClaw } from "@/lib/openclaw/voiceTranscription";

export const runtime = "nodejs";

export const MAX_VOICE_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    // ── Early size check via Content-Length ──────────────────────────────────
    // Reject oversized uploads BEFORE buffering any request body into memory.
    // This prevents a DoS/OOM attack where a huge payload is fully read before
    // the limit is enforced.  Content-Length can be absent or spoofed, so we
    // also enforce the limit again after buffering (see below), but the header
    // check eliminates the common case with zero memory cost.
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > MAX_VOICE_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            error: `Audio upload exceeds the ${MAX_VOICE_UPLOAD_BYTES} byte limit.`,
          },
          { status: 413 },
        );
      }
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    // Use duck-typing instead of `instanceof File` to guard against cross-realm
    // issues where jsdom/test environments expose a different File constructor.
    if (
      audio === null ||
      typeof audio !== "object" ||
      typeof (audio as File).arrayBuffer !== "function"
    ) {
      return NextResponse.json({ error: "audio file is required." }, { status: 400 });
    }
    const audioFile = audio as File;

    const arrayBuffer = await audioFile.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (byteLength <= 0) {
      return NextResponse.json({ error: "Audio upload is empty." }, { status: 400 });
    }

    // ── Secondary (post-buffer) size check ──────────────────────────────────
    // Guards against a missing or falsified Content-Length header. Status 413
    // is used here too for consistency (the body IS too large, regardless of
    // what the header claimed).
    if (byteLength > MAX_VOICE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Audio upload exceeds the ${MAX_VOICE_UPLOAD_BYTES} byte limit.`,
        },
        { status: 413 },
      );
    }

    const result = await transcribeVoiceWithOpenClaw({
      buffer: Buffer.from(arrayBuffer),
      fileName: audioFile.name,
      mimeType: audioFile.type,
    });

    return NextResponse.json({
      transcript: result.transcript,
      provider: result.provider,
      model: result.model,
      decision: result.decision,
      ignored: result.ignored,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transcribe audio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
