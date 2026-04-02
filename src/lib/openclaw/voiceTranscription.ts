import fs from "node:fs";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const CONFIGURED_OPENCLAW_PACKAGE_ROOT = process.env.OPENCLAW_PACKAGE_ROOT?.trim() ?? "";
const OPENCLAW_PACKAGE_NAME = ["open", "claw"].join("");
const resolvePackageWithNodeRequire = new Function(
  "nodeRequire",
  "specifier",
  "return nodeRequire.resolve(specifier);",
) as (nodeRequire: NodeJS.Require, specifier: string) => string;

const OPENCLAW_DIST_INDEX_RELATIVE_PATH = path.join("dist", "index.js");
const OPENCLAW_DIST_DIRECTORY_RELATIVE_PATH = "dist";
const AUDIO_KIND = "audio.transcription";
const DEFAULT_VOICE_MIME = "audio/webm";
const DEFAULT_VOICE_BASENAME = "voice-note";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/x-m4a": ".m4a",
  "audio/x-wav": ".wav",
};

type OpenClawConfig = {
  tools?: {
    media?: {
      audio?: {
        enabled?: boolean;
      };
    };
  };
};

type MediaUnderstandingOutput = {
  kind?: string;
  text?: string;
  provider?: string;
  model?: string;
};

type MediaUnderstandingDecision = {
  outcome?: string;
  attachments?: Array<{
    attempts?: Array<{
      reason?: string;
    }>;
  }>;
};

type RunCapabilityResult = {
  outputs?: MediaUnderstandingOutput[];
  decision?: MediaUnderstandingDecision;
};

type OpenClawConfigModule = {
  t: () => OpenClawConfig;
};

type OpenClawRunnerModule = {
  a: (params: {
    capability: "audio";
    cfg: OpenClawConfig;
    ctx: Record<string, unknown>;
    attachments: {
      cleanup: () => Promise<void>;
    };
    media: Array<Record<string, unknown>>;
    providerRegistry: unknown;
    config: unknown;
  }) => Promise<RunCapabilityResult>;
  n: (attachments: Array<Record<string, unknown>>) => {
    cleanup: () => Promise<void>;
  };
  r: (ctx: Record<string, unknown>) => Array<Record<string, unknown>>;
  t: () => unknown;
};

type OpenClawTranscriptionSdk = {
  loadConfig: OpenClawConfigModule["t"];
  runCapability: OpenClawRunnerModule["a"];
  createMediaAttachmentCache: OpenClawRunnerModule["n"];
  normalizeMediaAttachments: OpenClawRunnerModule["r"];
  buildProviderRegistry: OpenClawRunnerModule["t"];
};

export type OpenClawVoiceTranscriptionResult = {
  transcript: string | null;
  provider: string | null;
  model: string | null;
  decision: MediaUnderstandingDecision | null;
  ignored: boolean;
};

let sdkPromise: Promise<OpenClawTranscriptionSdk> | null = null;
const nativeImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<unknown>;

const resolveInstalledOpenClawPackageRoot = (): string | null => {
  try {
    const resolvedEntry = resolvePackageWithNodeRequire(require, OPENCLAW_PACKAGE_NAME);
    return path.dirname(path.dirname(resolvedEntry));
  } catch {
    return null;
  }
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

export const buildVoiceTranscriptionErrorMessage = (
  decision: MediaUnderstandingDecision | null | undefined,
): string => {
  if (!decision) return "OpenClaw did not return a transcript.";
  const outcome = decision.outcome?.trim() || "unknown";
  const reasons = (decision.attachments ?? [])
    .flatMap((attachment) => attachment.attempts ?? [])
    .map((attempt) => attempt.reason?.trim() ?? "")
    .filter(Boolean);
  const detail = reasons[0] ? ` ${reasons[0]}` : "";
  switch (outcome) {
    case "disabled":
      return `OpenClaw audio transcription is disabled.${detail}`.trim();
    case "no-attachment":
      return "OpenClaw did not receive any audio to transcribe.";
    case "scope-deny":
      return `OpenClaw blocked audio transcription for this request.${detail}`.trim();
    case "skipped":
      return `OpenClaw skipped audio transcription.${detail}`.trim();
    default:
      return `OpenClaw did not return a transcript.${detail}`.trim();
  }
};

export const shouldIgnoreVoiceTranscription = (params: {
  transcript: string | null | undefined;
  decision: MediaUnderstandingDecision | null | undefined;
}): boolean => {
  const transcript = params.transcript?.trim() ?? "";
  if (transcript) return false;
  const reasons = (params.decision?.attachments ?? [])
    .flatMap((attachment) => attachment.attempts ?? [])
    .map((attempt) => attempt.reason?.trim().toLowerCase() ?? "")
    .filter(Boolean);
  return reasons.some((reason) =>
    [
      "missing text",
      "empty transcript",
      "no speech",
      "no audio detected",
      "no transcript text",
    ].some((snippet) => reason.includes(snippet)),
  );
};

const resolveOpenClawPackageRoot = (): string => {
  const configuredCandidate = CONFIGURED_OPENCLAW_PACKAGE_ROOT;
  if (configuredCandidate) {
    const indexPath = path.join(configuredCandidate, OPENCLAW_DIST_INDEX_RELATIVE_PATH);
    if (fs.existsSync(indexPath)) return configuredCandidate;
    throw new Error("OPENCLAW_PACKAGE_ROOT does not point to a valid OpenClaw installation.");
  }

  const installedCandidate = resolveInstalledOpenClawPackageRoot();
  if (installedCandidate) {
    const indexPath = path.join(installedCandidate, OPENCLAW_DIST_INDEX_RELATIVE_PATH);
    if (fs.existsSync(indexPath)) return installedCandidate;
  }

  throw new Error(
    "OpenClaw could not be resolved from the current Node runtime. Install the `openclaw` package or set OPENCLAW_PACKAGE_ROOT.",
  );
};

const loadOpenClawSdk = async (): Promise<OpenClawTranscriptionSdk> => {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    const packageRoot = resolveOpenClawPackageRoot();
    const distDirectory = path.join(packageRoot, OPENCLAW_DIST_DIRECTORY_RELATIVE_PATH);
    const distEntries = (await fsp.readdir(distDirectory)).sort();
    const configCandidates = distEntries.filter((entry) => /^config-.*\.js$/.test(entry));
    let loadConfig: OpenClawTranscriptionSdk["loadConfig"] | null = null;

    for (const candidate of configCandidates) {
      const configModule = (await nativeImport(
        pathToFileURL(path.join(distDirectory, candidate)).href,
      )) as Partial<OpenClawConfigModule>;
      if (typeof configModule.t === "function") {
        loadConfig = configModule.t;
        break;
      }
    }

    if (!loadConfig) {
      throw new Error("The installed OpenClaw runtime does not expose a loadConfig() module.");
    }

    const runnerCandidates = distEntries.filter((entry) => /^runner-.*\.js$/.test(entry));

    for (const candidate of runnerCandidates) {
      const runnerModule = (await nativeImport(
        pathToFileURL(path.join(distDirectory, candidate)).href,
      )) as Partial<
        OpenClawRunnerModule
      >;
      if (
        typeof runnerModule.a === "function" &&
        typeof runnerModule.n === "function" &&
        typeof runnerModule.r === "function" &&
        typeof runnerModule.t === "function"
      ) {
        return {
          loadConfig,
          runCapability: runnerModule.a,
          createMediaAttachmentCache: runnerModule.n,
          normalizeMediaAttachments: runnerModule.r,
          buildProviderRegistry: runnerModule.t,
        };
      }
    }

    throw new Error("The installed OpenClaw runtime does not expose the audio transcription runner.");
  })().catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
};

export const transcribeVoiceWithOpenClaw = async (params: {
  buffer: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<OpenClawVoiceTranscriptionResult> => {
  const sdk = await loadOpenClawSdk();
  const cfg = sdk.loadConfig();
  if (cfg.tools?.media?.audio?.enabled === false) {
    throw new Error("OpenClaw audio transcription is disabled.");
  }

  const mimeType = normalizeVoiceMimeType(params.mimeType);
  const fileName = sanitizeVoiceFileName(params.fileName, mimeType);
  const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "claw3d-voice-"));
  const tempPath = path.join(tempDirectory, `${randomUUID()}-${fileName}`);

  await fsp.writeFile(tempPath, params.buffer);

  const ctx: Record<string, unknown> = {
    Body: "",
    BodyForAgent: "",
    BodyForCommands: "",
    RawBody: "",
    CommandBody: "",
    ChatType: "direct",
    MediaPath: tempPath,
    MediaType: mimeType,
    MediaPaths: [tempPath],
    MediaTypes: [mimeType],
  };

  const media = sdk.normalizeMediaAttachments(ctx);
  const cache = sdk.createMediaAttachmentCache(media);

  try {
    const result = await sdk.runCapability({
      capability: "audio",
      cfg,
      ctx,
      attachments: cache,
      media,
      providerRegistry: sdk.buildProviderRegistry(),
      config: cfg.tools?.media?.audio,
    });

    const audioOutputs = (result.outputs ?? []).filter((output) => output.kind === AUDIO_KIND);
    const transcript = audioOutputs
      .map((output) => output.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!transcript) {
      if (shouldIgnoreVoiceTranscription({ transcript, decision: result.decision ?? null })) {
        return {
          transcript: null,
          provider: null,
          model: null,
          decision: result.decision ?? null,
          ignored: true,
        };
      }
      throw new Error(buildVoiceTranscriptionErrorMessage(result.decision ?? null));
    }

    const firstOutput = audioOutputs[0] ?? null;
    return {
      transcript,
      provider: firstOutput?.provider ?? null,
      model: firstOutput?.model ?? null,
      decision: result.decision ?? null,
      ignored: false,
    };
  } finally {
    await cache.cleanup().catch(() => undefined);
    await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    await fsp.rmdir(tempDirectory).catch(() => undefined);
  }
};
