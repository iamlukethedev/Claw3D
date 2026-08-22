import { describe, expect, it } from "vitest";

import type { SkillStatusEntry } from "@/lib/skills/types";
import {
  deriveAgentSkillDisplayState,
  buildAgentSkillsAllowlistSet,
  buildSkillMissingDetails,
  buildSkillReasons,
  canRemoveSkill,
  deriveAgentSkillsAccessMode,
  deriveSkillReadinessState,
  filterOsCompatibleSkills,
  groupSkillsBySource,
  hasInstallableMissingBinary,
  isBundledBlockedSkill,
  isSkillOsIncompatible,
  normalizeAgentSkillsAllowlist,
  resolvePreferredInstallOption,
} from "@/lib/skills/presentation";

const createSkill = (overrides: Partial<SkillStatusEntry>): SkillStatusEntry => ({
  name: "skill",
  description: "",
  source: "openclaw-workspace",
  bundled: false,
  filePath: "/tmp/workspace/skill/SKILL.md",
  baseDir: "/tmp/workspace/skill",
  skillKey: "skill",
  always: false,
  disabled: false,
  blockedByAllowlist: false,
  eligible: true,
  requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
  missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
  configChecks: [],
  install: [],
  ...overrides,
});

describe("skills presentation helpers", () => {
  it("groups skills by source with stable ordering", () => {
    const groups = groupSkillsBySource([
      createSkill({ name: "other", source: "custom-source" }),
      createSkill({ name: "installed", source: "openclaw-managed" }),
      createSkill({ name: "workspace", source: "openclaw-workspace" }),
      createSkill({ name: "bundled", source: "openclaw-bundled", bundled: true }),
      createSkill({ name: "extra", source: "openclaw-extra" }),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      "workspace",
      "built-in",
      "installed",
      "community",
      "unknown",
    ]);
    expect(groups[0]?.skills.map((skill) => skill.name)).toEqual(["workspace"]);
    expect(groups[1]?.skills.map((skill) => skill.name)).toEqual(["bundled"]);
  });

  it("builds explicit missing detail lines", () => {
    const details = buildSkillMissingDetails(
      createSkill({
        eligible: false,
        missing: {
          bins: ["playwright"],
          anyBins: ["chromium", "chrome"],
          env: ["GITHUB_TOKEN"],
          config: ["browser.enabled"],
          os: ["linux"],
        },
      })
    );

    expect(details).toEqual([
      "Missing tools: playwright",
      "Missing one-of tools (install any): chromium | chrome",
      "Missing env vars: GITHUB_TOKEN",
      "Missing config values (set in gateway config): browser.enabled",
      "Requires OS: Linux",
    ]);
  });

  it("builds reasons from policy and missing requirements", () => {
    const reasons = buildSkillReasons(
      createSkill({
        eligible: false,
        disabled: true,
        blockedByAllowlist: true,
        missing: {
          bins: ["playwright"],
          anyBins: [],
          env: [],
          config: [],
          os: [],
        },
      })
    );

    expect(reasons).toEqual(["disabled", "blocked by allowlist", "missing tools"]);
  });

  it("detects_os_incompatibility_from_missing_os_requirements", () => {
    expect(
      isSkillOsIncompatible(
        createSkill({
          missing: {
            bins: [],
            anyBins: [],
            env: [],
            config: [],
            os: ["darwin"],
          },
        })
      )
    ).toBe(true);
    expect(
      isSkillOsIncompatible(
        createSkill({
          missing: {
            bins: [],
            anyBins: [],
            env: [],
            config: [],
            os: ["  "],
          },
        })
      )
    ).toBe(false);
  });

  it("filters_out_os_incompatible_skills_while_preserving_order", () => {
    const filtered = filterOsCompatibleSkills([
      createSkill({ name: "github", missing: { bins: [], anyBins: [], env: [], config: [], os: [] } }),
      createSkill({
        name: "apple-notes",
        missing: { bins: [], anyBins: [], env: [], config: [], os: ["darwin"] },
      }),
      createSkill({ name: "slack", missing: { bins: [], anyBins: [], env: [], config: [], os: [] } }),
    ]);

    expect(filtered.map((skill) => skill.name)).toEqual(["github", "slack"]);
  });

  it("detects bundled blocked skills", () => {
    expect(
      isBundledBlockedSkill(
        createSkill({
          source: "openclaw-bundled",
          bundled: true,
          eligible: false,
        })
      )
    ).toBe(true);
    expect(isBundledBlockedSkill(createSkill({ bundled: true, eligible: true }))).toBe(false);
  });

  it("detects installable missing binaries including anyBins overlap", () => {
    const skill = createSkill({
      eligible: false,
      missing: {
        bins: [],
        anyBins: ["chromium", "chrome"],
        env: [],
        config: [],
        os: [],
      },
      install: [
        {
          id: "install-chromium",
          kind: "download",
          label: "Install chromium",
          bins: ["chromium"],
        },
      ],
    });

    expect(hasInstallableMissingBinary(skill)).toBe(true);
    expect(resolvePreferredInstallOption(skill)?.id).toBe("install-chromium");
  });

  it("selects_install_option_that_matches_missing_bins", () => {
    const skill = createSkill({
      eligible: false,
      missing: {
        bins: ["gh"],
        anyBins: [],
        env: [],
        config: [],
        os: [],
      },
      install: [
        {
          id: "install-other",
          kind: "download",
          label: "Install other tool",
          bins: ["other"],
        },
        {
          id: "install-gh",
          kind: "brew",
          label: "Install gh",
          bins: ["gh"],
        },
      ],
    });

    expect(resolvePreferredInstallOption(skill)?.id).toBe("install-gh");
  });

  it("marks only gateway-managed and workspace skill sources as removable", () => {
    expect(canRemoveSkill(createSkill({ source: "openclaw-managed" }))).toBe(true);
    expect(canRemoveSkill(createSkill({ source: "openclaw-workspace" }))).toBe(true);
    expect(canRemoveSkill(createSkill({ source: "agents-skills-personal" }))).toBe(true);
    expect(canRemoveSkill(createSkill({ source: "agents-skills-project" }))).toBe(true);
    expect(canRemoveSkill(createSkill({ source: "openclaw-bundled", bundled: true }))).toBe(
      false
    );
    expect(canRemoveSkill(createSkill({ source: "openclaw-extra" }))).toBe(false);
  });

  it("derives agent access mode from allowlist shape", () => {
    expect(deriveAgentSkillsAccessMode(undefined)).toBe("all");
    expect(deriveAgentSkillsAccessMode([])).toBe("none");
    expect(deriveAgentSkillsAccessMode([" ", "github"])).toBe("selected");
  });

  it("normalizes allowlist values and creates a lookup set", () => {
    expect(normalizeAgentSkillsAllowlist([" github ", "github", "slack", " "])).toEqual([
      "github",
      "slack",
    ]);
    expect(buildAgentSkillsAllowlistSet([" github ", "slack"]).has("github")).toBe(true);
    expect(buildAgentSkillsAllowlistSet([" github ", "slack"]).has("browser")).toBe(false);
  });

  it("classifies readiness with disabled and unavailable precedence", () => {
    expect(deriveSkillReadinessState(createSkill({ disabled: true, eligible: false }))).toBe(
      "disabled-globally"
    );
    expect(
      deriveSkillReadinessState(
        createSkill({
          eligible: false,
          missing: { bins: [], anyBins: [], env: [], config: [], os: ["darwin"] },
        })
      )
    ).toBe("unavailable");
    expect(
      deriveSkillReadinessState(
        createSkill({
          eligible: false,
          blockedByAllowlist: true,
        })
      )
    ).toBe("unavailable");
    expect(
      deriveSkillReadinessState(
        createSkill({
          eligible: false,
          missing: { bins: ["gh"], anyBins: [], env: [], config: [], os: [] },
        })
      )
    ).toBe("needs-setup");
    expect(deriveSkillReadinessState(createSkill({ eligible: true }))).toBe("ready");
  });

  it("maps readiness into agent display states", () => {
    expect(deriveAgentSkillDisplayState("ready")).toBe("ready");
    expect(deriveAgentSkillDisplayState("needs-setup")).toBe("setup-required");
    expect(deriveAgentSkillDisplayState("disabled-globally")).toBe("setup-required");
    expect(deriveAgentSkillDisplayState("unavailable")).toBe("not-supported");
  });
});
