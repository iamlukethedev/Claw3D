import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..", "..");

const COLOR_OWNED_FILES = [
  "src/features/agents/components/FleetSidebar.tsx",
  "src/features/agents/components/AgentChatPanel.tsx",
  "src/features/agents/components/ConnectionPanel.tsx",
  "src/features/agents/components/AgentInspectPanels.tsx",
  "src/features/agents/components/GatewayConnectScreen.tsx",
  "src/features/agents/components/AgentCreateModal.tsx",
  "src/features/agents/components/HeaderBar.tsx",
  "src/app/page.tsx",
] as const;

const RAW_HUE_UTILITY_PATTERN =
  /\b(?:bg|text|border|from|to|via)-(?:amber|cyan|emerald|orange|violet|red|green|blue|zinc)-\d{2,3}(?:\/\d{1,3})?\b/g;

// Exec-approval and voice-recording indicator patterns use amber/red hues that are
// hard to abstract into semantic CSS variables because they carry domain-specific
// meaning (caution/recording/danger) and mix hover/disabled state variants.
// Whitelist these until a dedicated approval/recording color token set exists.
const ALLOWED_PATTERNS: Record<string, RegExp[]> = {
  "src/features/agents/components/AgentChatPanel.tsx": [
    /\b(?:bg|text|border|hover:bg|hover:text|hover:border|disabled:border|disabled:bg|disabled:text)-amber-\d{2,3}(?:\/\d{1,3})?\b/,
  ],
};

const isAllowed = (relativePath: string, match: string): boolean => {
  const patterns = ALLOWED_PATTERNS[relativePath];
  if (!patterns) return false;
  return patterns.some((pattern) => pattern.test(match));
};

describe("color semantic guard", () => {
  it("blocks raw hue utility classes in color-owned UI files", () => {
    const offenders: string[] = [];

    for (const relativePath of COLOR_OWNED_FILES) {
      const source = readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
      const matches = source.match(RAW_HUE_UTILITY_PATTERN) ?? [];
      for (const match of matches) {
        if (!isAllowed(relativePath, match)) {
          offenders.push(`${relativePath}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
