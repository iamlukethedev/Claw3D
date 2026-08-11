#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["packages/visual-core", "packages/visual-react"];
const banned = [
  ["network request", /fetch\s*\(/i],
  ["web socket", /\bWebSocket\b/i],
  ["event stream", /\bEventSource\b/i],
  ["environment access", /process\.env/i],
  ["Next server", /next\/server/i],
  ["Node module", /node:/i],
  ["filesystem", /(?:^|[^A-Za-z])fs(?:[^A-Za-z]|$)/i],
  ["API route", /\/api\//i],
  ["legacy runtime", /openclaw|hermes/i],
  ["private backend", /jarvis/i],
];

function sourceFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(absolute));
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

const violations = [];
for (const target of targets) {
  for (const file of sourceFiles(path.join(root, target))) {
    const source = readFileSync(file, "utf8");
    for (const [label, pattern] of banned) {
      if (pattern.test(source)) violations.push(`${path.relative(root, file)}: ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Visual boundary violations:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Visual boundary verification passed.");
}
