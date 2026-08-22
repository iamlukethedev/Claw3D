/**
 * Re-exports from the @/lib/skills/skill-safe package
 */
export type {
  SanitizationCategory,
  SanitizationSeverity,
  SanitizationFlag,
  SanitizationResult,
  SkillTrustLevel,
  RuleDefinition,
} from "@/lib/skills/skill-safe";

export {
  normalizeSkillText,
  sanitizeSkillMarkdown,
  sanitizeSkillFile,
  extractSkillFrontmatter,
  resolveSkillTrustLevel,
  requiresSanitization,
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_DESCRIPTION,
  TRUST_LEVEL_COLOR,
  SEVERITY_COLOR,
  RULES,
} from "@/lib/skills/skill-safe";
