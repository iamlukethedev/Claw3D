import { NextResponse } from "next/server";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveUserPath } from "@/lib/clawdbot/paths";

export const runtime = "nodejs";

type PathAutocompleteEntry = {
  name: string;
  fullPath: string;
  displayPath: string;
  isDirectory: boolean;
};

type PathAutocompleteResult = {
  query: string;
  directory: string;
  entries: PathAutocompleteEntry[];
};

type PathAutocompleteOptions = {
  query: string;
  maxResults?: number;
  homedir?: () => string;
};

const normalizeQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Query is required.");
  }
  if (trimmed === "~") {
    return "~/";
  }
  if (trimmed.startsWith("~")) {
    return trimmed;
  }
  const withoutLeading = trimmed.replace(/^[\\/]+/, "");
  return `~/${withoutLeading}`;
};

const resolveRealPath = (value: string): string => {
  const absolutePath = path.resolve(value);
  try {
    return fs.realpathSync(absolutePath);
  } catch {
    const missingSegments: string[] = [];
    let currentPath = absolutePath;
    while (true) {
      if (fs.existsSync(currentPath)) {
        try {
          return path.join(fs.realpathSync(currentPath), ...missingSegments.reverse());
        } catch {
          return path.join(currentPath, ...missingSegments.reverse());
        }
      }
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return absolutePath;
      }
      missingSegments.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
};

const isWithinHome = (target: string, home: string): boolean => {
  const resolvedTarget = resolveRealPath(target);
  const resolvedHome = resolveRealPath(home);
  const relative = path.relative(resolvedHome, resolvedTarget);
  if (!relative) return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

const listPathAutocompleteEntries = ({
  query,
  maxResults = 10,
  homedir = os.homedir,
}: PathAutocompleteOptions): PathAutocompleteResult => {
  const normalized = normalizeQuery(query);
  const resolvedHome = path.resolve(homedir());
  const resolvedQuery = resolveUserPath(normalized, homedir);
  if (!isWithinHome(resolvedQuery, resolvedHome)) {
    throw new Error("Path must stay within the home directory.");
  }

  const endsWithSlash = normalized.endsWith("/") || normalized.endsWith(path.sep);
  const directoryPath = endsWithSlash ? resolvedQuery : path.dirname(resolvedQuery);
  const prefix = endsWithSlash ? "" : path.basename(resolvedQuery);

  if (!isWithinHome(directoryPath, resolvedHome)) {
    throw new Error("Path must stay within the home directory.");
  }
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Directory does not exist: ${directoryPath}`);
  }
  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${directoryPath}`);
  }

  const limit = Number.isFinite(maxResults) && maxResults > 0 ? Math.floor(maxResults) : 10;

  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .filter((entry) => entry.name.startsWith(prefix))
    .map((entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      const relative = path.relative(resolvedHome, fullPath);
      const normalizedRelative = relative.split(path.sep).join("/");
      const displayBase = `~/${normalizedRelative}`;
      return {
        name: entry.name,
        fullPath,
        displayPath: entry.isDirectory() ? `${displayBase}/` : displayBase,
        isDirectory: entry.isDirectory(),
      } satisfies PathAutocompleteEntry;
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);

  return { query: normalized, directory: directoryPath, entries };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q");
    const query = rawQuery && rawQuery.trim() ? rawQuery.trim() : "~/";
    const result = listPathAutocompleteEntries({ query, maxResults: 10 });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list path suggestions.";
    console.error(message);
    const status = message.includes("does not exist") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
