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

  it("keeps a configured url and fills token from openclaw.json when missing", async () => {
    tempDir = makeTempDir("studio-upstream-url-keep");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    fs.mkdirSync(path.join(tempDir, "claw3d"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "claw3d", "settings.json"),
      JSON.stringify({ gateway: { url: "ws://gateway.example:18789", token: "" } }, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18789, auth: { token: "tok-local" } } }, null, 2),
      "utf8"
    );

    const { loadUpstreamGatewaySettings } = await import("../../server/studio-settings");
    const settings = loadUpstreamGatewaySettings(process.env);
    expect(settings.url).toBe("ws://gateway.example:18789");
    expect(settings.token).toBe("tok-local");
  });

  it("keeps Hermes tokenless and does not inherit openclaw.json credentials", async () => {
    tempDir = makeTempDir("studio-upstream-hermes-tokenless");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    fs.mkdirSync(path.join(tempDir, "claw3d"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "claw3d", "settings.json"),
      JSON.stringify(
        {
          gateway: {
            url: "ws://127.0.0.1:18790",
            token: "leftover-openclaw-token",
            adapterType: "hermes",
            profiles: {
              hermes: { url: "ws://127.0.0.1:18790", token: "" },
              openclaw: { url: "ws://127.0.0.1:18789", token: "tok-local" },
            },
          },
        },
        null,
        2
      ),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18789, auth: { token: "tok-local" } } }, null, 2),
      "utf8"
    );

    const { loadUpstreamGatewaySettings } = await import("../../server/studio-settings");
    const settings = loadUpstreamGatewaySettings(process.env);
    expect(settings.adapterType).toBe("hermes");
    expect(settings.url).toBe("ws://127.0.0.1:18790");
    expect(settings.token).toBe("");
  });

  it("defaults a Hermes upstream to the local adapter port when the url is missing", async () => {
    tempDir = makeTempDir("studio-upstream-hermes-default");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    fs.mkdirSync(path.join(tempDir, "claw3d"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "claw3d", "settings.json"),
      JSON.stringify({ gateway: { adapterType: "hermes", token: "" } }, null, 2),
      "utf8"
    );

    const { loadUpstreamGatewaySettings } = await import("../../server/studio-settings");
    const settings = loadUpstreamGatewaySettings(process.env);
    expect(settings.adapterType).toBe("hermes");
    expect(settings.url).toBe("ws://127.0.0.1:18790");
    expect(settings.token).toBe("");
  });
});
