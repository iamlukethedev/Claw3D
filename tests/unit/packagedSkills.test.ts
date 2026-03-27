import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildPackagedSkillStatusEntry, listPackagedSkills } from "@/lib/skills/catalog";
import { resolveSkillMarketplaceMetadata } from "@/lib/skills/marketplace";
import { readPackagedSkillFiles } from "@/lib/skills/packaged";

const resolveAssetDir = (packageId: string) => path.join(process.cwd(), "assets/skills", packageId);

const listFilesRecursively = (dir: string, prefix = ""): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile()) {
      files.push(relative);
    } else if (entry.isDirectory()) {
      files.push(...listFilesRecursively(path.join(dir, entry.name), relative));
    }
  }
  return files;
};

describe("packaged skills", () => {
  it("keeps packaged skill files synchronized with the asset source files", () => {
    for (const packagedSkill of listPackagedSkills()) {
      const assetDir = resolveAssetDir(packagedSkill.packageId);
      const expectedFiles = listFilesRecursively(assetDir).sort();
      const packagedFiles = readPackagedSkillFiles(packagedSkill.packageId);
      const packagedRelativePaths = packagedFiles.map((file) => file.relativePath).sort();

      expect(packagedRelativePaths).toEqual(expectedFiles);

      for (const file of packagedFiles) {
        const assetContent = readFileSync(path.join(assetDir, file.relativePath), "utf8");
        expect(file.content).toBe(assetContent);
      }
    }
  });

  it("exposes creator attribution and hides fake popularity stats for packaged skills", () => {
    for (const packagedSkill of listPackagedSkills()) {
      expect(packagedSkill.creatorName).toBeTruthy();
      expect(packagedSkill.creatorUrl).toBeTruthy();

      const metadata = resolveSkillMarketplaceMetadata(buildPackagedSkillStatusEntry(packagedSkill));

      expect(metadata.poweredByName).toBe(packagedSkill.creatorName);
      expect(metadata.poweredByUrl).toBe(packagedSkill.creatorUrl);
      expect(metadata.hideStats).toBe(true);
    }
  });
});
