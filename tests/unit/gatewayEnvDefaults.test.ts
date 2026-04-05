import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("loadLocalGatewayDefaults with CLAW3D_GATEWAY_URL", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("returns env-based defaults when CLAW3D_GATEWAY_URL is set and no openclaw.json exists", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://my-gateway:18789";
    process.env.CLAW3D_GATEWAY_TOKEN = "my-token";
    // Point state dir to a non-existent location so openclaw.json is not found
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toEqual({
      url: "ws://my-gateway:18789",
      token: "my-token",
      adapterType: "openclaw",
      profiles: {
        openclaw: { url: "ws://my-gateway:18789", token: "my-token" },
      },
    });
  });

  it("returns env-based defaults with empty token when only URL is set", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://my-gateway:18789";
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toEqual({
      url: "ws://my-gateway:18789",
      token: "",
      adapterType: "openclaw",
      profiles: {
        openclaw: { url: "ws://my-gateway:18789", token: "" },
      },
    });
  });

  it("returns null when no env var and no openclaw.json", async () => {
    delete process.env.CLAW3D_GATEWAY_URL;
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toBeNull();
  });

  it("prefers openclaw.json over env vars when both exist", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://env-gateway:18789";
    process.env.CLAW3D_GATEWAY_TOKEN = "env-token";
    // Use real state dir which has openclaw.json
    delete process.env.OPENCLAW_STATE_DIR;
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    // Should return the file-based defaults, not the env vars
    if (result) {
      expect(result.url).not.toBe("ws://env-gateway:18789");
    }
    // If no file exists in CI, it falls back to env — that's also correct
  });

  it("uses CLAW3D_GATEWAY_ADAPTER_TYPE for Hermes env defaults", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://my-hermes:18789";
    process.env.CLAW3D_GATEWAY_ADAPTER_TYPE = "hermes";
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toEqual({
      url: "ws://my-hermes:18789",
      token: "",
      adapterType: "hermes",
      profiles: {
        hermes: { url: "ws://my-hermes:18789", token: "" },
      },
    });
  });

  it("exposes local Hermes adapter defaults when only HERMES_ADAPTER_PORT is set", async () => {
    delete process.env.CLAW3D_GATEWAY_URL;
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    process.env.HERMES_ADAPTER_PORT = "19444";
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toEqual({
      url: "ws://localhost:19444",
      token: "",
      adapterType: "hermes",
      profiles: {
        hermes: { url: "ws://localhost:19444", token: "" },
      },
    });
  });

  it("merges Hermes adapter defaults into file-backed OpenClaw defaults", async () => {
    delete process.env.CLAW3D_GATEWAY_URL;
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    delete process.env.CLAW3D_GATEWAY_ADAPTER_TYPE;
    process.env.HERMES_ADAPTER_PORT = "19444";

    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw3d-gateway-defaults-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          port: 18789,
          auth: { token: "file-token" },
        },
      }),
      "utf8"
    );

    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();

    expect(result).toEqual({
      url: "ws://localhost:18789",
      token: "file-token",
      adapterType: "openclaw",
      profiles: {
        openclaw: { url: "ws://localhost:18789", token: "file-token" },
        hermes: { url: "ws://localhost:19444", token: "" },
      },
    });
  });

  it("keeps file-backed openclaw profile when CLAW3D_GATEWAY_URL is also set", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://env-gateway:19999";
    process.env.CLAW3D_GATEWAY_TOKEN = "env-token";
    delete process.env.CLAW3D_GATEWAY_ADAPTER_TYPE;

    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw3d-gateway-defaults-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          port: 18789,
          auth: { token: "file-token" },
        },
      }),
      "utf8"
    );

    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();

    expect(result).toEqual({
      url: "ws://localhost:18789",
      token: "file-token",
      adapterType: "openclaw",
      profiles: {
        openclaw: { url: "ws://localhost:18789", token: "file-token" },
      },
    });
  });
});
