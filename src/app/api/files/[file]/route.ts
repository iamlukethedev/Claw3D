import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { resolveStateDir } from "@/lib/clawdbot/paths";

export const runtime = "nodejs";

const uploadsDir = () => path.join(resolveStateDir(), "claw3d", "uploads");

const contentTypeFromName = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".md":
    case ".markdown":
      return "text/markdown; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".csv":
      return "text/csv; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;
    const safeFile = path.basename(file);
    const targetPath = path.join(uploadsDir(), safeFile);
    const resolvedUploads = path.resolve(uploadsDir());
    const resolvedTarget = path.resolve(targetPath);
    if (!resolvedTarget.startsWith(`${resolvedUploads}${path.sep}`) && resolvedTarget !== resolvedUploads) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    const bytes = await fs.readFile(resolvedTarget);
    return new Response(new Blob([Uint8Array.from(bytes)], { type: contentTypeFromName(safeFile) }), {
      headers: {
        "Content-Type": contentTypeFromName(safeFile),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File not found.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
