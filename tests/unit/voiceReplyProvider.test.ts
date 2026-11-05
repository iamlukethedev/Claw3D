import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { synthesizeVoiceReply } from "@/lib/voiceReply/provider";

// ---------------------------------------------------------------------------
// fetch is mocked so the MiniMax provider is exercised without a network call.
// ---------------------------------------------------------------------------

const jsonLike = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const BASE_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...BASE_ENV };
});

afterEach(() => {
  process.env = { ...BASE_ENV };
});

describe("synthesizeVoiceReply — MiniMax provider", () => {
  it("hits the global region endpoint and parses data.audio into an mp3 response", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";

    // base64 for "audio" bytes: Buffer.from("clip").toString("base64")
    const audioBase64 = Buffer.from("clip").toString("base64");
    fetchMock.mockResolvedValueOnce(
      jsonLike({
        data: { audio: audioBase64, status: 2 },
        base_resp: { status_code: 0, status_msg: "" },
      })
    );

    const response = await synthesizeVoiceReply({
      text: "hello",
      provider: "minimax",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimax.io/v1/t2a_v2");
    expect(init?.method).toBe("POST");
    expect(init?.headers?.Authorization).toBe("Bearer test-key");
    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody.model).toBe("speech-2.8-hd");
    expect(sentBody.text).toBe("hello");
    expect(sentBody.stream).toBe(false);
    expect(sentBody.voice_setting.voice_id).toBe("voice-123");
    expect(sentBody.audio_setting.format).toBe("mp3");

    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes).toString("utf8")).toBe("clip");
  });

  it("uses the cn_zh region endpoint when configured via the request", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-cn";

    fetchMock.mockResolvedValueOnce(
      jsonLike({
        data: { audio: Buffer.from("ok").toString("base64") },
        base_resp: { status_code: 0 },
      })
    );

    await synthesizeVoiceReply({
      text: "你好",
      provider: "minimax",
      region: "cn_zh",
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimaxi.com/v1/t2a_v2");
  });

  it("honors MINIMAX_REGION for the cn_zh host", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-cn";
    process.env.MINIMAX_REGION = "cn_zh";

    fetchMock.mockResolvedValueOnce(
      jsonLike({ data: { audio: Buffer.from("ok").toString("base64") } })
    );

    await synthesizeVoiceReply({ text: "hi", provider: "minimax" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.minimaxi.com/v1/t2a_v2");
  });

  it("allows overriding the speech model via MINIMAX_MODEL_ID", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";
    process.env.MINIMAX_MODEL_ID = "speech-2.6-turbo";

    fetchMock.mockResolvedValueOnce(
      jsonLike({ data: { audio: Buffer.from("ok").toString("base64") } })
    );

    await synthesizeVoiceReply({ text: "hi", provider: "minimax" });

    const sent = fetchMock.mock.calls[0][1];
    const sentBody = JSON.parse(String(sent?.body));
    expect(sentBody.model).toBe("speech-2.6-turbo");
  });

  it("rejects an unknown region and falls back to the global host", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";

    fetchMock.mockResolvedValueOnce(
      jsonLike({ data: { audio: Buffer.from("ok").toString("base64") } })
    );

    await synthesizeVoiceReply({
      text: "hi",
      provider: "minimax",
      // @ts-expect-error — exercise the runtime guard with a bogus region
      region: "mars",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.minimax.io/v1/t2a_v2");
  });

  it("throws when MINIMAX_API_KEY is missing", async () => {
    delete process.env.MINIMAX_API_KEY;
    process.env.MINIMAX_VOICE_ID = "voice-123";

    await expect(
      synthesizeVoiceReply({ text: "hi", provider: "minimax" })
    ).rejects.toThrow(/Missing MINIMAX_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when MINIMAX_VOICE_ID is missing", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    delete process.env.MINIMAX_VOICE_ID;

    await expect(
      synthesizeVoiceReply({ text: "hi", provider: "minimax" })
    ).rejects.toThrow(/Missing MINIMAX_VOICE_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the base_resp status message when no audio is returned", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";

    fetchMock.mockResolvedValueOnce(
      jsonLike({ data: { audio: "" }, base_resp: { status_code: 1004, status_msg: "voice not found" } })
    );

    await expect(
      synthesizeVoiceReply({ text: "hi", provider: "minimax" })
    ).rejects.toThrow(/voice not found/);
  });

  it("throws on a non-2xx response", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";

    fetchMock.mockResolvedValueOnce(
      new Response("unauthorized", { status: 401 })
    );

    await expect(
      synthesizeVoiceReply({ text: "hi", provider: "minimax" })
    ).rejects.toThrow(/unauthorized|MiniMax voice synthesis failed/);
  });

  it("clamps voice speed to the supported range", async () => {
    process.env.MINIMAX_API_KEY = "test-key";
    process.env.MINIMAX_VOICE_ID = "voice-123";

    fetchMock.mockResolvedValueOnce(
      jsonLike({ data: { audio: Buffer.from("ok").toString("base64") } })
    );

    await synthesizeVoiceReply({ text: "hi", provider: "minimax", speed: 5 });

    const sent = fetchMock.mock.calls[0][1];
    const sentBody = JSON.parse(String(sent?.body));
    expect(sentBody.voice_setting.speed).toBe(1.2);
  });
});

describe("synthesizeVoiceReply — provider dispatch", () => {
  it("throws on an unsupported provider", async () => {
    await expect(
      // @ts-expect-error — exercise the default branch
      synthesizeVoiceReply({ text: "hi", provider: "nope" })
    ).rejects.toThrow(/Unsupported voice reply provider/);
  });
});
