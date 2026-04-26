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

  it("prefers env vars over openclaw.json when both exist while preserving the file-backed profile", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://env-gateway:18789";
    process.env.CLAW3D_GATEWAY_TOKEN = "env-token";
    process.env.CLAW3D_GATEWAY_ADAPTER_TYPE = "hermes";

    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw3d-gateway-defaults-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    fs.writeFileSync(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({
        gateway: {
          port: 18791,
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
      url: "ws://env-gateway:18789",
      token: "env-token",
      adapterType: "hermes",
      profiles: {
        hermes: { url: "ws://env-gateway:18789", token: "env-token" },
        openclaw: { url: "ws://localhost:18791", token: "file-token" },
      },
    });
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

  it("prefers Hermes adapter defaults over file-backed OpenClaw defaults while preserving the OpenClaw profile", async () => {
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
      url: "ws://localhost:19444",
      token: "",
      adapterType: "hermes",
      profiles: {
        hermes: { url: "ws://localhost:19444", token: "" },
        openclaw: { url: "ws://localhost:18789", token: "file-token" },
      },
    });
  });

  it("prefers explicit env adapter defaults over file-backed OpenClaw defaults", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://env-gateway:19999";
    process.env.CLAW3D_GATEWAY_TOKEN = "env-token";
    process.env.CLAW3D_GATEWAY_ADAPTER_TYPE = "hermes";

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
      url: "ws://env-gateway:19999",
      token: "env-token",
      adapterType: "hermes",
      profiles: {
        openclaw: { url: "ws://localhost:18789", token: "file-token" },
        hermes: { url: "ws://env-gateway:19999", token: "env-token" },
      },
    });
  });
});
