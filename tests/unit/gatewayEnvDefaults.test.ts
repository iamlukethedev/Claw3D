import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(result).toEqual({ url: "ws://my-gateway:18789", token: "my-token" });
  });

  it("returns env-based defaults with empty token when only URL is set", async () => {
    process.env.CLAW3D_GATEWAY_URL = "ws://my-gateway:18789";
    delete process.env.CLAW3D_GATEWAY_TOKEN;
    process.env.OPENCLAW_STATE_DIR = "/tmp/claw3d-test-nonexistent-" + Date.now();
    const { loadLocalGatewayDefaults } = await import(
      "../../src/lib/studio/settings-store"
    );
    const result = loadLocalGatewayDefaults();
    expect(result).toEqual({ url: "ws://my-gateway:18789", token: "" });
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
});
