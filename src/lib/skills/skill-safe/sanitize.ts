import { RULES } from "./rules";
import type { SanitizationCategory, SanitizationSeverity, RuleDefinition } from "./rules";

export type { SanitizationCategory, SanitizationSeverity, RuleDefinition };

export type SanitizationFlag = {
  severity: SanitizationSeverity;
  category: SanitizationCategory;
  description: string;
  /** Short excerpt of the matched text for display */
  matched: string;
  /** True when matched only after normalization/de-obfuscation. */
  normalized?: boolean;
  /** External framework mapping for governance/reporting. */
  owasp?: string[];
  mitreAtlas?: string[];
  nistAiRmf?: string[];
};

export type SanitizationResult = {
  /** Worst severity across all flags, or "safe" if none. */
  severity: "safe" | "caution" | "danger";
  flags: SanitizationFlag[];
  /** false only when at least one "danger" flag is present */
  safeToInstall: boolean;
  report: SkillScanReport;
};

export type SkillScanReport = {
  version: "skill-safe.report.v1";
  riskScore: number;
  summary: {
    safeToInstall: boolean;
    severity: "safe" | "caution" | "danger";
    danger: number;
    caution: number;
    hiddenContent: number;
    normalizedMatches: number;
  };
  categories: Partial<Record<SanitizationCategory, number>>;
  mappings: {
    owasp: string[];
    mitreAtlas: string[];
    nistAiRmf: string[];
  };
  recommendedAction: "allow" | "review" | "block";
};

// ---------------------------------------------------------------------------
// Core scanner
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  colon: ":",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  sol: "/",
};

const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2800\u3164\uFFA0]/g;
const INVISIBLE_RUN_RE = /[\u200B-\u200D\u2060\uFEFF\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2800\u3164\uFFA0]{10,}/g;

export const normalizeSkillText = (content: string): string => {
  let normalized = content
    .normalize("NFKC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\\u\{?([0-9a-fA-F]{2,6})\}?/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _match;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);?/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _match;
      }
    })
    .replace(/&#(\d+);?/g, (_match, dec: string) => {
      const code = Number.parseInt(dec, 10);
      if (!Number.isFinite(code)) return _match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _match;
      }
    })
    .replace(/&([a-zA-Z]+);?/g, (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match);

  // De-obfuscate common spaced command/protocol words without collapsing normal prose.
  const spacedTokens = [
    "curl",
    "wget",
    "fetch",
    "javascript",
    "ignore",
    "disregard",
    "override",
    "exfiltrate",
  ];
  for (const token of spacedTokens) {
    const pattern = new RegExp(`\\b${token.split("").join("\\s*")}\\b`, "gi");
    normalized = normalized.replace(pattern, token);
  }

  return normalized;
};

const excerptMatch = (content: string, index: number, matchLength: number): string => {
  const CONTEXT = 40;
  const start = Math.max(0, index - 20);
  const end   = Math.min(content.length, index + matchLength + CONTEXT);
  const raw   = content.slice(start, end).replace(/\s+/g, " ").trim();
  return end < content.length ? `${raw}…` : raw;
};

const uniqueSorted = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

const buildReport = (
  severity: "safe" | "caution" | "danger",
  safeToInstall: boolean,
  flags: SanitizationFlag[],
): SkillScanReport => {
  const danger = flags.filter((flag) => flag.severity === "danger").length;
  const caution = flags.filter((flag) => flag.severity === "caution").length;
  const hiddenContent = flags.filter((flag) => flag.category === "hidden-content").length;
  const normalizedMatches = flags.filter((flag) => flag.normalized).length;
  const categories: Partial<Record<SanitizationCategory, number>> = {};
  for (const flag of flags) {
    categories[flag.category] = (categories[flag.category] ?? 0) + 1;
  }

  const riskScore = Math.min(
    100,
    danger * 35 + caution * 12 + hiddenContent * 8 + normalizedMatches * 8,
  );

  return {
    version: "skill-safe.report.v1",
    riskScore,
    summary: {
      safeToInstall,
      severity,
      danger,
      caution,
      hiddenContent,
      normalizedMatches,
    },
    categories,
    mappings: {
      owasp: uniqueSorted(flags.flatMap((flag) => flag.owasp ?? [])),
      mitreAtlas: uniqueSorted(flags.flatMap((flag) => flag.mitreAtlas ?? [])),
      nistAiRmf: uniqueSorted(flags.flatMap((flag) => flag.nistAiRmf ?? [])),
    },
    recommendedAction: severity === "danger" ? "block" : severity === "caution" ? "review" : "allow",
  };
};

/**
 * Scan skill markdown content for red flags.
 *
 * @param content - Raw markdown string (YAML frontmatter + body)
 * @param extraRules - Optional additional rules to append (for custom extensions)
 */
export const sanitizeSkillMarkdown = (
  content: string,
  extraRules: RuleDefinition[] = [],
): SanitizationResult => {
  const flags: SanitizationFlag[] = [];
  const seenPatterns = new Set<string>();
  const allRules = [...RULES, ...extraRules];
  const normalizedContent = normalizeSkillText(content);

  const invisibleRuns = [...content.matchAll(INVISIBLE_RUN_RE)];
  for (const match of invisibleRuns) {
    flags.push({
      severity: "danger",
      category: "hidden-content",
      description: "Contains a long run of invisible Unicode characters.",
      matched: excerptMatch(content, match.index ?? 0, match[0].length),
      owasp: ["Agentic Instruction and Tool Manipulation"],
      nistAiRmf: ["Map", "Measure"],
    });
  }

  const invisibleCount = (content.match(INVISIBLE_RE) ?? []).length;
  if (invisibleCount > 0 && invisibleRuns.length === 0) {
    flags.push({
      severity: "caution",
      category: "hidden-content",
      description: "Contains invisible Unicode characters that may hide instructions from reviewers.",
      matched: `${invisibleCount} invisible character${invisibleCount === 1 ? "" : "s"}`,
      owasp: ["Agentic Instruction and Tool Manipulation"],
      nistAiRmf: ["Map", "Measure"],
    });
  }

  for (const rule of allRules) {
    const key = `${rule.pattern.source}/${rule.pattern.flags}`;
    if (seenPatterns.has(key)) continue;

    // Reset lastIndex so the regex is safe to reuse across calls
    rule.pattern.lastIndex = 0;
    let match = rule.pattern.exec(content);
    let matchedNormalized = false;
    if (!match && normalizedContent !== content) {
      rule.pattern.lastIndex = 0;
      match = rule.pattern.exec(normalizedContent);
      matchedNormalized = Boolean(match);
    }
    if (!match) continue;

    seenPatterns.add(key);
    flags.push({
      severity:    rule.severity,
      category:    rule.category,
      description: rule.description,
      matched:     matchedNormalized
        ? excerptMatch(normalizedContent, match.index, match[0].length)
        : excerptMatch(content, match.index, match[0].length),
      normalized:  matchedNormalized || undefined,
      owasp:       rule.owasp,
      mitreAtlas:  rule.mitreAtlas,
      nistAiRmf:   rule.nistAiRmf,
    });
  }

  // Composite risk: prompt-injection + (data-exfiltration or script-injection) = lethal trifecta
  // Inspired by Skillguard / OWASP Agentic Skills Top 10.
  // When an instruction override is combined with a network or code execution vector,
  // escalate the combined flag to danger even if individual flags were caution.
  const categories = new Set(flags.map((f) => f.category));
  const hasInjection = categories.has("prompt-injection") || categories.has("identity-hijack");
  const hasExecution = categories.has("data-exfiltration") || categories.has("script-injection");
  if (hasInjection && hasExecution) {
    flags.push({
      severity:    "danger",
      category:    "prompt-injection",
      description: "Composite risk: instruction override combined with network/code-execution vector (Lethal Trifecta).",
      matched:     "(multiple patterns)",
      owasp:       ["Agentic Instruction and Tool Manipulation", "Data and Resource Exfiltration"],
      mitreAtlas:  ["Exfiltration"],
      nistAiRmf:   ["Measure", "Manage"],
    });
  }

  const hasDanger  = flags.some((f) => f.severity === "danger");
  const hasCaution = flags.some((f) => f.severity === "caution");

  const severity = hasDanger ? "danger" : hasCaution ? "caution" : "safe";
  const safeToInstall = !hasDanger;

  return {
    severity,
    flags,
    safeToInstall,
    report: buildReport(severity, safeToInstall, flags),
  };
};

/**
 * Extract YAML frontmatter from a skill markdown file.
 * Returns null if no frontmatter block is present.
 */
export const extractSkillFrontmatter = (content: string): Record<string, string> | null => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(content.trimStart());
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key   = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) result[key] = value;
  }
  return result;
};

/**
 * Convenience: scan both frontmatter and body of a skill file.
 * Returns a combined result treating them as a single document.
 */
export const sanitizeSkillFile = (
  content: string,
  extraRules: RuleDefinition[] = [],
): SanitizationResult => sanitizeSkillMarkdown(content, extraRules);
