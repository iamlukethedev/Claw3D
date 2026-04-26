import { NextResponse } from "next/server";

import { isLikelyLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
  runSshJson,
} from "@/lib/ssh/gateway-host";
import { loadStudioSettings } from "@/lib/studio/settings-store";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export const runtime = "nodejs";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const expandTildeLocal = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
};

const validateRawMediaPath = (raw: string): { trimmed: string; mime: string } => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("path is required");
  if (trimmed.length > 4096) throw new Error("path too long");
  if (/[^\S\r\n]*[\0\r\n]/.test(trimmed)) throw new Error("path contains invalid characters");

  const ext = path.extname(trimmed).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`Unsupported media extension: ${ext || "(none)"}`);

  return { trimmed, mime };
};

const resolveAndValidateLocalMediaPath = (raw: string): { resolved: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);

  const expanded = expandTildeLocal(trimmed);
  if (!path.isAbsolute(expanded)) {
    throw new Error("path must be absolute or start with ~/");
  }

  const resolved = path.resolve(expanded);

  const allowedRoot = path.join(os.homedir(), ".openclaw");
  const allowedPrefix = `${allowedRoot}${path.sep}`;
  if (!(resolved === allowedRoot || resolved.startsWith(allowedPrefix))) {
    throw new Error(`Refusing to read media outside ${allowedRoot}`);
  }

  return { resolved, mime };
};

const isWithinAllowedRoot = (targetPath: string, allowedRoot: string): boolean => {
  const relative = path.relative(allowedRoot, targetPath);
  if (!relative) return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

const validateRemoteMediaPath = (raw: string): { remotePath: string; mime: string } => {
  const { trimmed, mime } = validateRawMediaPath(raw);

  if (!(trimmed.startsWith("/") || trimmed === "~" || trimmed.startsWith("~/"))) {
    throw new Error("path must be absolute or start with ~/");
  }

  // Remote side enforces ~/.openclaw; this guard lets Studio on macOS request
  // /home/ubuntu/.openclaw/... without tripping local homedir checks.
  const normalized = trimmed.replaceAll("\\\\", "/");
  const inOpenclaw =
    normalized === "~/.openclaw" ||
    normalized.startsWith("~/.openclaw/") ||
    normalized.includes("/.openclaw/");
  if (!inOpenclaw) {
    throw new Error("Refusing to read remote media outside ~/.openclaw");
  }

  return { remotePath: trimmed, mime };
};

const readLocalMedia = async (
  resolvedPath: string,
  allowedRoot: string
): Promise<{ bytes: Buffer; size: number }> => {
  const entry = await fs.lstat(resolvedPath);
  if (entry.isSymbolicLink()) {
    throw new Error("symlinked media paths are not allowed");
  }

  const [realResolvedPath, realAllowedRoot] = await Promise.all([
    fs.realpath(resolvedPath),
    fs.realpath(allowedRoot).catch(() => path.resolve(allowedRoot)),
  ]);

  if (!isWithinAllowedRoot(realResolvedPath, realAllowedRoot)) {
    throw new Error(`Refusing to read media outside ${realAllowedRoot}`);
  }

  const stat = await fs.stat(realResolvedPath);
  if (!stat.isFile()) {
    throw new Error("path is not a file");
  }
  if (stat.size > MAX_MEDIA_BYTES) {
    throw new Error(`media file too large (${stat.size} bytes)`);
  }
  const buf = await fs.readFile(realResolvedPath);
  return { bytes: buf, size: stat.size };
};

const REMOTE_READ_SCRIPT = `
set -euo pipefail

python3 - "$1" <<'PY'
import base64
import json
import mimetypes
import os
import pathlib
import sys

raw = sys.argv[1].strip()
if not raw:
  print(json.dumps({"error": "path is required"}))
  raise SystemExit(2)

p = pathlib.Path(os.path.expanduser(raw))
try:
  resolved = p.resolve(strict=True)
except FileNotFoundError:
  print(json.dumps({"error": f"file not found: {raw}"}))
  raise SystemExit(3)

home = pathlib.Path.home().resolve()
allowed = (home / ".openclaw").resolve()
if resolved != allowed and allowed not in resolved.parents:
  print(json.dumps({"error": f"Refusing to read media outside {allowed}"}))
  raise SystemExit(4)

ext = resolved.suffix.lower()
mime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
}.get(ext) or (mimetypes.guess_type(str(resolved))[0] or "")

if not mime.startswith("image/"):
  print(json.dumps({"error": f"Unsupported media extension: {ext or '(none)'}"}))
  raise SystemExit(5)

size = resolved.stat().st_size
max_bytes = ${MAX_MEDIA_BYTES}
if size > max_bytes:
  print(json.dumps({"error": f"media file too large ({size} bytes)"}))
  raise SystemExit(6)

data = base64.b64encode(resolved.read_bytes()).decode("ascii")
print(json.dumps({"ok": True, "mime": mime, "size": size, "data": data}))
PY
`;

const resolveSshTarget = (): string | null => {
  const settings = loadStudioSettings();
  const gatewayUrl = settings.gateway?.url ?? "";
  if (isLikelyLocalGatewayUrl(gatewayUrl)) return null;
  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;
  return resolveGatewaySshTargetFromGatewayUrl(gatewayUrl, process.env);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = (searchParams.get("path") ?? "").trim();

    const sshTarget = resolveSshTarget();

    if (!sshTarget) {
      const { resolved, mime } = resolveAndValidateLocalMediaPath(rawPath);
      const allowedRoot = path.join(os.homedir(), ".openclaw");
      const { bytes, size } = await readLocalMedia(resolved, allowedRoot);
      const body = new Blob([Uint8Array.from(bytes)], { type: mime });
      return new Response(body, {
        headers: {
          "Content-Type": mime,
          "Content-Length": String(size),
          "Cache-Control": "no-store",
        },
      });
    }

    const { remotePath, mime } = validateRemoteMediaPath(rawPath);

    const payload = runSshJson({
      sshTarget,
      argv: ["bash", "-s", "--", remotePath],
      label: "gateway media read",
      input: REMOTE_READ_SCRIPT,
      fallbackMessage: `Failed to fetch media over ssh (${sshTarget})`,
      maxBuffer: Math.ceil(MAX_MEDIA_BYTES * 1.6),
    }) as {
      ok?: boolean;
      data?: string;
      mime?: string;
      size?: number;
    };

    const b64 = payload.data ?? "";
    if (!b64) {
      throw new Error("Remote media fetch returned empty data");
    }

    const buf = Buffer.from(b64, "base64");
    const responseMime = payload.mime || mime;
    const body = new Blob([Uint8Array.from(buf)], { type: responseMime });

    return new Response(body, {
      headers: {
        "Content-Type": responseMime,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch media";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
