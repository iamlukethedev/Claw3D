export type VoiceReplyProvider = "elevenlabs" | "minimax";

export type MiniMaxVoiceRegion = "global_en" | "cn_zh";

export type VoiceReplySynthesisRequest = {
  text: string;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
  /**
   * MiniMax speech region. When omitted, falls back to the
   * MINIMAX_REGION environment variable (defaults to global_en).
   * Only used by the MiniMax provider.
   */
  region?: MiniMaxVoiceRegion;
};

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_REPLY_PROVIDER: VoiceReplyProvider = "elevenlabs";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";

// MiniMax text-to-audio (speech-2.x) endpoints. The global and CN regions are
// served from distinct hosts, so callers must hit the endpoint that matches
// their credentials' region.
const MINIMAX_T2A_ENDPOINTS: Record<MiniMaxVoiceRegion, string> = {
  global_en: "https://api.minimax.io/v1/t2a_v2",
  cn_zh: "https://api.minimaxi.com/v1/t2a_v2",
};

// MiniMax speech models supported by the /v1/t2a_v2 endpoint. The default is
// configurable via MINIMAX_MODEL_ID so newly released models can be opted into
// without a code change; the list documents the current model choices.
const MINIMAX_SPEECH_MODEL_IDS = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
  "speech-01-hd",
  "speech-01-turbo",
] as const;
const resolveMiniMaxModelId = (): string =>
  process.env.MINIMAX_MODEL_ID?.trim() || MINIMAX_SPEECH_MODEL_IDS[0];

const isMiniMaxRegion = (value: string | null | undefined): value is MiniMaxVoiceRegion =>
  value === "global_en" || value === "cn_zh";

const resolveMiniMaxRegion = (request: VoiceReplySynthesisRequest): MiniMaxVoiceRegion => {
  const explicit = request.region?.trim().toLowerCase();
  if (isMiniMaxRegion(explicit)) return explicit;
  const fromEnv = process.env.MINIMAX_REGION?.trim().toLowerCase();
  if (isMiniMaxRegion(fromEnv)) return fromEnv;
  return "global_en";
};

const normalizeVoiceSpeed = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1.2, Math.max(0.7, value));
};

const normalizeVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  const fromEnv = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ELEVENLABS_VOICE_ID;
};

const normalizeMiniMaxVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  const fromEnv = process.env.MINIMAX_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;
  throw new Error("Missing MINIMAX_VOICE_ID.");
};

const synthesizeWithElevenLabs = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  // TODO: Create Claw3D voice and text skill.
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY.");
  }
  const voiceId = normalizeVoiceId(request.voiceId);
  const speed = normalizeVoiceSpeed(request.speed);
  const response = await fetch(
    `${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: request.text,
        model_id: DEFAULT_ELEVENLABS_MODEL_ID,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.88,
          style: 0.2,
          use_speaker_boost: true,
          speed,
        },
      }),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "ElevenLabs voice synthesis failed.");
  }
  return response;
};

const synthesizeWithMiniMax = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing MINIMAX_API_KEY.");
  }
  const voiceId = normalizeMiniMaxVoiceId(request.voiceId);
  const speed = normalizeVoiceSpeed(request.speed);
  const region = resolveMiniMaxRegion(request);
  const endpoint = MINIMAX_T2A_ENDPOINTS[region];
  const modelId = resolveMiniMaxModelId();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      text: request.text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed,
      },
      audio_setting: {
        sample_rate: 24000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "MiniMax voice synthesis failed.");
  }

  // MiniMax returns a JSON envelope with base64-encoded audio under data.audio
  // (and a base_resp status code/message). Parse it into a binary audio
  // response so downstream callers receive the same shape as ElevenLabs.
  const payload = (await response.json().catch(() => null)) as
    | {
        data?: { audio?: string | null; status?: number };
        base_resp?: { status_code?: number; status_msg?: string };
      }
    | null;

  const audioBase64 = payload?.data?.audio ?? "";
  if (!audioBase64) {
    const statusMsg = payload?.base_resp?.status_msg?.trim();
    throw new Error(statusMsg || "MiniMax voice synthesis returned no audio.");
  }

  const audioBytes = Buffer.from(audioBase64, "base64");
  return new Response(new Uint8Array(audioBytes), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
};

export const synthesizeVoiceReply = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const provider = request.provider ?? DEFAULT_VOICE_REPLY_PROVIDER;
  switch (provider) {
    case "elevenlabs":
      return synthesizeWithElevenLabs(request);
    case "minimax":
      return synthesizeWithMiniMax(request);
    default:
      throw new Error("Unsupported voice reply provider.");
  }
};
