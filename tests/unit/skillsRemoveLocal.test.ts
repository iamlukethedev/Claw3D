import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { removeSkillLocally } from "@/lib/skills/remove-local";

const mkTmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "hermes3d-skill-remove-"));

describe("skills remove local", () => {
  const originalStateDir = process.env.OPENCLAW_STATE_DIR;

  afterEach(() => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
  });

  it("removes a workspace skill directory", () => {
    process.env.OPENCLAW_STATE_DIR = mkTmpDir();

    const workspaceDir = mkTmpDir();
    const managedSkillsDir = mkTmpDir();
    const skillDir = path.join(workspaceDir, "skills", "github");

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# skill", "utf8");

    const result = removeSkillLocally({
      skillKey: "github",
      source: "openclaw-workspace",
      baseDir: skillDir,
      workspaceDir,
      managedSkillsDir,
    });

    expect(result).toEqual({
      removed: true,
      removedPath: skillDir,
      source: "openclaw-workspace",
    });
    expect(fs.existsSync(skillDir)).toBe(false);
  });

  it("rejects removal outside the source root", () => {
    const workspaceDir = mkTmpDir();
    const managedSkillsDir = mkTmpDir();
    const outsideDir = mkTmpDir();

    expect(() =>
      removeSkillLocally({
        skillKey: "github",
        source: "openclaw-workspace",
        baseDir: outsideDir,
        workspaceDir,
        managedSkillsDir,
      })
    ).toThrow("Refusing to remove skill outside allowed root");
  });

  it("refuses removing the root skills directory itself", () => {
    const workspaceDir = mkTmpDir();
    const managedSkillsDir = mkTmpDir();
    const workspaceSkillsRoot = path.join(workspaceDir, "skills");
    fs.mkdirSync(workspaceSkillsRoot, { recursive: true });

    expect(() =>
      removeSkillLocally({
        skillKey: "github",
        source: "openclaw-workspace",
        baseDir: workspaceSkillsRoot,
        workspaceDir,
        managedSkillsDir,
      })
    ).toThrow("Refusing to remove the skills root directory");
  });

  it("refuses removing directories that are not skills", () => {
    const workspaceDir = mkTmpDir();
    const managedSkillsDir = mkTmpDir();
    const nonSkillDir = path.join(workspaceDir, "skills", "tmp");
    fs.mkdirSync(nonSkillDir, { recursive: true });

    expect(() =>
      removeSkillLocally({
        skillKey: "tmp",
        source: "openclaw-workspace",
        baseDir: nonSkillDir,
        workspaceDir,
        managedSkillsDir,
      })
    ).toThrow("Refusing to remove non-skill directory");
  });
});
