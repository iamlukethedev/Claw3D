import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET, PUT } from "@/app/api/studio/route";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe("studio settings route", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("GET returns default settings when missing", async () => {
    tempDir = makeTempDir("studio-settings-get-default");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await GET();
    const body = (await response.json()) as {
      settings?: Record<string, unknown>;
      localGatewayDefaults?: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.settings?.gateway).toBe(null);
    expect(body.localGatewayDefaults ?? null).toBeNull();
    expect(body.settings?.version).toBe(1);
  });

  it("GET returns local gateway defaults from openclaw.json", async () => {
    tempDir = makeTempDir("studio-settings-get-local-defaults");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    fs.writeFileSync(
      path.join(tempDir, "openclaw.json"),
      JSON.stringify({ gateway: { port: 18791, auth: { token: "local-token" } } }, null, 2),
      "utf8"
    );

    const response = await GET();
    const body = (await response.json()) as {
      settings?: {
        gateway?: {
          url?: string;
          tokenConfigured?: boolean;
          adapterType?: string;
          profiles?: Record<string, { url?: string; tokenConfigured?: boolean }>;
        } | null;
      };
      localGatewayDefaults?: {
        url?: string;
        tokenConfigured?: boolean;
        adapterType?: string;
        profiles?: Record<string, { url?: string; tokenConfigured?: boolean }>;
      } | null;
    };

    expect(response.status).toBe(200);
    expect(body.localGatewayDefaults).toEqual({
      url: "ws://localhost:18791",
      tokenConfigured: true,
      adapterType: "openclaw",
      profiles: {
        openclaw: {
          url: "ws://localhost:18791",
          tokenConfigured: true,
        },
      },
    });
    expect(body.settings?.gateway).toEqual({
      url: "ws://localhost:18791",
      tokenConfigured: true,
      adapterType: "openclaw",
      profiles: {
        openclaw: {
          url: "ws://localhost:18791",
          tokenConfigured: true,
        },
      },
    });
  });

  it("PUT returns 400 for non-object JSON payload", async () => {
    tempDir = makeTempDir("studio-settings-put-invalid");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const response = await PUT({
      text: async () => JSON.stringify("nope"),
    } as unknown as Request);
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body.error?.length).toBeGreaterThan(0);
  });

  it("PUT persists a patch and GET returns merged settings", async () => {
    tempDir = makeTempDir("studio-settings-put-persist");
    process.env.OPENCLAW_STATE_DIR = tempDir;

    const patch = {
      gateway: { url: "ws://example.test:1234", token: "t", adapterType: "hermes" },
      office: {
        "ws://example.test:1234": {
          title: "Orbit Control",
        },
      },
    };

    const putResponse = await PUT({
      text: async () => JSON.stringify(patch),
    } as unknown as Request);
    expect(putResponse.status).toBe(200);

    const getResponse = await GET();
    const body = (await getResponse.json()) as {
      settings?: {
        gateway?: { url?: string; tokenConfigured?: boolean } | null;
        office?: Record<string, { title?: string }>;
      };
    };

    expect(getResponse.status).toBe(200);
    expect(body.settings?.gateway).toEqual({
      url: "ws://example.test:1234",
      tokenConfigured: true,
      adapterType: "hermes",
    });
    expect(body.settings?.office?.["ws://example.test:1234"]).toEqual(
      expect.objectContaining({
        title: "Orbit Control",
      }),
    );

    const settingsPath = path.join(tempDir, "claw3d", "settings.json");
    expect(fs.existsSync(settingsPath)).toBe(true);
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { url?: string; token?: string; adapterType?: string } | null;
      office?: Record<string, { title?: string }>;
    };
    expect(parsed.gateway).toEqual({
      url: "ws://example.test:1234",
      token: "t",
      adapterType: "hermes",
    });
    expect(parsed.office?.["ws://example.test:1234"]).toEqual(
      expect.objectContaining({
        title: "Orbit Control",
      }),
    );
  });
});
