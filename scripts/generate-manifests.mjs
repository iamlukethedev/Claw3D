#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_SHA = "70ba84c1b13322eb660a6f7f5c53e36e7067c412";

const manifestNames = new Set([
  "KEEP_MANIFEST.md",
  "REFACTOR_MANIFEST.md",
  "REMOVE_MANIFEST.md",
]);

const keepExact = new Set([
  ".claw3d-root",
  "ASSET_AUDIT.md",
  "BASELINE_REPORT.md",
  "CHECKPOINT_REPORT.md",
  "DELETION_PLAN.md",
  "KEEP_MANIFEST.md",
  "LICENSE",
  "REMOVE_MANIFEST.md",
  "REFACTOR_MANIFEST.md",
  "UPSTREAM_SOURCE.md",
  "docs/architecture/visual-ui.md",
  "scripts/generate-manifests.mjs",
  "scripts/verify-visual-boundaries.mjs",
]);

const refactorExact = new Set([
  ".env.example",
  ".gitignore",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CODE_DOCUMENTATION.md",
  "README.md",
  "components.json",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "tsconfig.visual.json",
  "vitest.config.ts",
  "vitest.visual.config.ts",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/features/office/components/OfficeBuilderPanel.tsx",
  "src/features/office/screens/OfficeScreen.tsx",
]);

const refactorPrefixes = [
  ".github/",
  ".serena/",
  "apps/",
  "packages/",
  "src/app/office/",
  "src/components/ui/",
  "src/features/office/phaser/",
  "src/features/retro-office/",
  "src/lib/avatars/",
  "src/lib/office/",
  "tests/e2e/",
  "tests/visual/",
];

const visualTestPattern = /(office|retro|navigation|pathfinding|floor|furniture|avatar|builder|geometry|desk|map)/i;

function classify(file) {
  if (
    keepExact.has(file) ||
    file.startsWith("artifacts/baseline/") ||
    file.startsWith("artifacts/checkpoint/")
  ) return "keep";
  if (refactorExact.has(file) || refactorPrefixes.some((prefix) => file.startsWith(prefix))) {
    return "refactor";
  }
  if (file.startsWith("tests/") && visualTestPattern.test(file)) return "refactor";
  return "remove";
}

const raw = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
);

const files = [...new Set([...raw.split("\n").filter(Boolean), ...manifestNames])].sort();
const buckets = { keep: [], refactor: [], remove: [] };

for (const file of files) buckets[classify(file)].push(file);

const assigned = new Set(Object.values(buckets).flat());
if (assigned.size !== files.length) {
  throw new Error(`Manifest assignment mismatch: ${assigned.size}/${files.length}`);
}

const labels = {
  keep: ["KEEP_MANIFEST.md", "kept without semantic extraction"],
  refactor: ["REFACTOR_MANIFEST.md", "kept only after decoupling or rewrite"],
  remove: ["REMOVE_MANIFEST.md", "removed after explicit checkpoint approval"],
};

for (const [bucket, entries] of Object.entries(buckets)) {
  const [name, meaning] = labels[bucket];
  const body = [
    `# ${name.replace("_MANIFEST.md", " manifest")}`,
    "",
    `Source SHA: \`${SOURCE_SHA}\`.`,
    `Classification: ${meaning}.`,
    `Exact paths: ${entries.length}.`,
    `Coverage set: ${files.length} repository files; every path is assigned exactly once.`,
    "",
    ...entries.map((entry) => `- \`${entry}\``),
    "",
  ].join("\n");
  writeFileSync(path.join(root, name), body, "utf8");
}

console.log(
  `Manifest coverage verified: ${files.length} files ` +
    `(keep ${buckets.keep.length}, refactor ${buckets.refactor.length}, remove ${buckets.remove.length}).`,
);
