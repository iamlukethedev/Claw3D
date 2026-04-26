import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { resolveStateDir } from "@/lib/clawdbot/paths";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".js": "text/plain",
  ".jsx": "text/plain",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".py": "text/plain",
  ".rb": "text/plain",
  ".go": "text/plain",
  ".rs": "text/plain",
  ".java": "text/plain",
  ".kt": "text/plain",
  ".sql": "text/plain",
  ".html": "text/plain",
  ".css": "text/plain",
  ".yaml": "text/plain",
  ".yml": "text/plain",
  ".log": "text/plain",
};
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = new Set(Object.keys(CONTENT_TYPE_BY_EXT));

const TEXT_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
];

const sanitizeFilename = (input: string): string => {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "upload";
};

const uploadsDir = () => path.join(resolveStateDir(), "claw3d", "uploads");

const isTextContentType = (contentType: string): boolean =>
  TEXT_CONTENT_TYPES.some((prefix) => contentType.startsWith(prefix));

const resolveUploadContentType = (file: File): string | null => {
  const explicit = file.type.trim().toLowerCase();
  if (explicit && (ALLOWED_CONTENT_TYPES.has(explicit) || explicit.startsWith("text/"))) {
    return explicit;
  }
  const ext = path.extname(file.name || "").trim().toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }
  return CONTENT_TYPE_BY_EXT[ext] ?? null;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 400 });
    }

    const contentType = resolveUploadContentType(file);
    if (!contentType) {
      const ext = path.extname(file.name || "").trim().toLowerCase();
      return NextResponse.json(
        { error: `Unsupported file type: ${ext || file.type.trim().toLowerCase() || "(unknown)"}` },
        { status: 400 }
      );
    }

    const fileId = crypto.randomBytes(8).toString("hex");
    const safeName = sanitizeFilename(file.name || "upload");
    const storedName = `${fileId}-${safeName}`;
    const targetDir = uploadsDir();
    const targetPath = path.join(targetDir, storedName);

    await fs.mkdir(targetDir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    let extractedText: string | undefined;
    if (isTextContentType(contentType)) {
      const normalizedText = bytes.toString("utf8").trim();
      if (normalizedText) {
        extractedText =
          normalizedText.length > 12_000
            ? `${normalizedText.slice(0, 12_000).trimEnd()}\n[Truncated]`
            : normalizedText;
      }
    }

    return NextResponse.json({
      id: fileId,
      name: file.name || safeName,
      url: `/api/files/${storedName}`,
      contentType,
      extractedText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
