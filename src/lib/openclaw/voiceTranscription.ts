import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_VOICE_MIME = "audio/webm";
const DEFAULT_VOICE_BASENAME = "voice-note";
const WHISPER_BIN = process.env.WHISPER_BIN?.trim() || "whisper";
const WHISPER_MODEL = process.env.WHISPER_MODEL?.trim() || "base";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/x-m4a": ".m4a",
  "audio/x-wav": ".wav",
};

type MediaUnderstandingDecision = {
  outcome?: string;
  attachments?: Array<{
    attempts?: Array<{
      reason?: string;
    }>;
  }>;
};

export type OpenClawVoiceTranscriptionResult = {
  transcript: string | null;
  provider: string | null;
  model: string | null;
  decision: MediaUnderstandingDecision | null;
  ignored: boolean;
};

export const normalizeVoiceMimeType = (value: string | null | undefined): string => {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return DEFAULT_VOICE_MIME;
  const [baseType] = trimmed.split(";", 1);
  return MIME_EXTENSION_MAP[baseType] ? baseType : trimmed.startsWith("audio/") ? baseType : DEFAULT_VOICE_MIME;
};

export const inferVoiceFileExtension = (
  fileName: string | null | undefined,
  mimeType: string | null | undefined,
): string => {
  const trimmedName = fileName?.trim() ?? "";
  const nameExtension = path.extname(trimmedName).toLowerCase();
  if (nameExtension && Object.values(MIME_EXTENSION_MAP).includes(nameExtension)) {
    return nameExtension;
  }
  return MIME_EXTENSION_MAP[normalizeVoiceMimeType(mimeType)] ?? MIME_EXTENSION_MAP[DEFAULT_VOICE_MIME];
};

export const sanitizeVoiceFileName = (
  fileName: string | null | undefined,
  mimeType: string | null | undefined,
): string => {
  const extension = inferVoiceFileExtension(fileName, mimeType);
  const rawBase = path.basename(fileName?.trim() || DEFAULT_VOICE_BASENAME, path.extname(fileName?.trim() || ""));
  const sanitizedBase =
    rawBase.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") ||
    DEFAULT_VOICE_BASENAME;
  const normalizedBase = sanitizedBase.toLowerCase();
  return normalizedBase.endsWith(extension) ? normalizedBase : `${normalizedBase}${extension}`;
};

export const transcribeVoiceWithOpenClaw = async (params: {
  buffer: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<OpenClawVoiceTranscriptionResult> => {
  const mimeType = normalizeVoiceMimeType(params.mimeType);
  const fileName = sanitizeVoiceFileName(params.fileName, mimeType);
  const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "claw3d-voice-"));
  const inputName = `${randomUUID()}-${fileName}`;
  const tempPath = path.join(tempDirectory, inputName);

  await fsp.writeFile(tempPath, params.buffer);

  try {
    await execFileAsync(WHISPER_BIN, [
      tempPath,
      "--model", WHISPER_MODEL,
      "--output_format", "txt",
      "--output_dir", tempDirectory,
      "--fp16", "False",
    ]);

    const baseName = path.basename(tempPath, path.extname(tempPath));
    const txtPath = path.join(tempDirectory, `${baseName}.txt`);
    const transcript = (await fsp.readFile(txtPath, "utf8")).trim();

    return {
      transcript: transcript || null,
      provider: "whisper",
      model: WHISPER_MODEL,
      decision: null,
      ignored: !transcript,
    };
  } finally {
    await fsp.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
};
