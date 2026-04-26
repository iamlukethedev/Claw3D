// @vitest-environment node

import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("studio setup paths", () => {
  it("resolves settings path under OPENCLAW_STATE_DIR when set", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const settingsPath = resolveStudioSettingsPath({
      OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
    } as unknown as NodeJS.ProcessEnv);
    expect(settingsPath).toBe(
      path.join(path.resolve("/tmp/openclaw-state"), "claw3d", "settings.json")
    );
  });

  it("resolves settings path under ~/.openclaw by default", async () => {
    const { resolveStudioSettingsPath } = await import("../../server/studio-settings");
    const settingsPath = resolveStudioSettingsPath({} as NodeJS.ProcessEnv);
    expect(settingsPath).toBe(
      path.join(os.homedir(), ".openclaw", "claw3d", "settings.json")
    );
  });
});
