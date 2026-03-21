/**
 * Tests for the voice transcription API route — focusing on the upload size
 * limit that must be enforced BEFORE the request body is buffered into memory
 * (issue #7 fix).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before the route import
// ---------------------------------------------------------------------------

vi.mock("@/lib/openclaw/voiceTranscription", () => ({
  transcribeVoiceWithOpenClaw: vi.fn().mockResolvedValue({
    transcript: "hello world",
    provider: "openai",
    model: "whisper-1",
    decision: { outcome: "success" },
    ignored: false,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { MAX_VOICE_UPLOAD_BYTES, POST } = await import(
  "@/app/api/office/voice/transcribe/route"
);

/** Build a minimal multipart/form-data Request with an audio file blob. */
function buildAudioRequest(
  fileSizeBytes: number,
  options: { contentLengthOverride?: number | null } = {},
): Request {
  const audioBlob = new Blob([new Uint8Array(fileSizeBytes)], { type: "audio/webm" });
  const formData = new FormData();
  formData.append("audio", audioBlob, "voice.webm");

  // Build headers
  const headers: Record<string, string> = {};
  if (options.contentLengthOverride !== undefined && options.contentLengthOverride !== null) {
    headers["content-length"] = String(options.contentLengthOverride);
  }

  return new Request("http://localhost/api/office/voice/transcribe", {
    method: "POST",
    body: formData,
    headers,
  });
}

/** Build a Request with no audio field in the form. */
function buildNoAudioRequest(): Request {
  const formData = new FormData();
  return new Request("http://localhost/api/office/voice/transcribe", {
    method: "POST",
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/office/voice/transcribe — size limit enforcement (issue #7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Content-Length early rejection ────────────────────────────────────────

  it("returns 413 immediately when Content-Length exceeds MAX_VOICE_UPLOAD_BYTES", async () => {
    const oversizeBytes = MAX_VOICE_UPLOAD_BYTES + 1;
    const request = buildAudioRequest(1, {
      // Lie about size — we want to confirm the header check fires even when
      // the actual payload is small (verifying header-based early rejection).
      contentLengthOverride: oversizeBytes,
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toMatch(/exceeds/i);
  });

  it("returns 413 when Content-Length is exactly one byte over the limit", async () => {
    const request = buildAudioRequest(1, {
      contentLengthOverride: MAX_VOICE_UPLOAD_BYTES + 1,
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
  });

  it("does NOT reject when Content-Length equals MAX_VOICE_UPLOAD_BYTES exactly", async () => {
    // The actual body is tiny; we're testing the header path only here.
    const request = buildAudioRequest(1, {
      contentLengthOverride: MAX_VOICE_UPLOAD_BYTES,
    });
    const response = await POST(request);
    // Should not be a 413 from the header check (actual body is 1 byte, fine).
    expect(response.status).not.toBe(413);
  });

  // ── No Content-Length header — handled gracefully ─────────────────────────

  it("proceeds normally when Content-Length header is absent and file is within limit", async () => {
    // Small valid audio; no content-length header at all.
    const request = buildAudioRequest(1024 /* 1 KB */);

    const response = await POST(request);
    // Should succeed (mocked transcription returns 200).
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.transcript).toBe("hello world");
  });

  it("returns 413 after buffering when Content-Length is absent but body exceeds limit", async () => {
    // Build a real oversized body with no content-length header.
    // We use MAX_VOICE_UPLOAD_BYTES + 1 bytes to trigger the post-buffer check.
    const oversizeBytes = MAX_VOICE_UPLOAD_BYTES + 1;
    const audioBlob = new Blob([new Uint8Array(oversizeBytes)], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "big.webm");

    const request = new Request("http://localhost/api/office/voice/transcribe", {
      method: "POST",
      body: formData,
      // No content-length header — the post-buffer check must catch this.
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toMatch(/exceeds/i);
  });

  // ── Normal happy path ─────────────────────────────────────────────────────

  it("returns 200 with transcript for a valid upload within the size limit", async () => {
    const request = buildAudioRequest(4096 /* 4 KB */);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      transcript: "hello world",
      provider: "openai",
      model: "whisper-1",
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("returns 400 when no audio field is present in the form", async () => {
    const response = await POST(buildNoAudioRequest());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/audio file is required/i);
  });

  it("returns 400 for an empty audio file (0 bytes)", async () => {
    const request = buildAudioRequest(0);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/empty/i);
  });

  it("ignores a malformed (non-numeric) Content-Length header and falls through", async () => {
    const audioBlob = new Blob([new Uint8Array(512)], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.webm");

    const request = new Request("http://localhost/api/office/voice/transcribe", {
      method: "POST",
      body: formData,
      headers: { "content-length": "not-a-number" },
    });

    // Should NOT blow up; header is NaN so we skip the early check and proceed.
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
