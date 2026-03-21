import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("server studio upstream gateway settings", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("falls back to openclaw.json token/port when studio settings are missing", async () => {
    tempDir = makeTempDir("studio-upstream-openclaw-defaults");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18790, auth: { token: "tok" } } }, null, 2),
      "utf8"
    );

    const { loadUpstreamGatewaySettings } = await import("../../server/studio-settings");
    const settings = loadUpstreamGatewaySettings(process.env);
    expect(settings.url).toBe("ws://localhost:18790");
    expect(settings.token).toBe("tok");
  });

  it("keeps a configured url and fills token from openclaw.json when url is local", async () => {
    tempDir = makeTempDir("studio-upstream-url-keep");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    fs.mkdirSync(path.join(tempDir, "claw3d"), { recursive: true });
    // Use a local URL so the fallback token-fill logic triggers.
    // Non-local URLs intentionally skip the openclaw.json token lookup
    // to avoid leaking local credentials to remote gateways.
    fs.writeFileSync(
      path.join(tempDir, "claw3d", "settings.json"),
      JSON.stringify({ gateway: { url: "ws://localhost:18790", token: "" } }, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18789, auth: { token: "tok-local" } } }, null, 2),
      "utf8"
    );

    const { loadUpstreamGatewaySettings } = await import("../../server/studio-settings");
    const settings = loadUpstreamGatewaySettings(process.env);
    expect(settings.url).toBe("ws://localhost:18790");
    expect(settings.token).toBe("tok-local");
  });
});
