// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { GET, POST } from "@/app/api/novaspine/route";

const ORIGINAL_ENV = { ...process.env };

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process"
  );
  return {
    default: actual,
    ...actual,
    spawnSync: vi.fn(),
  };
});

const mockedSpawnSync = vi.mocked(spawnSync);

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeOpenClawConfig = (stateDir: string, payload: Record<string, unknown>) => {
  fs.writeFileSync(path.join(stateDir, "openclaw.json"), JSON.stringify(payload, null, 2), "utf8");
};

describe("/api/novaspine route", () => {
  let tempDir: string | null = null;
  let assetDir: string | null = null;

  const writeBundledAssets = (root: string) => {
    fs.mkdirSync(path.join(root, "packages", "openclaw-memory-plugin"), { recursive: true });
    fs.mkdirSync(path.join(root, "packages", "openclaw-context-engine"), { recursive: true });
    fs.mkdirSync(path.join(root, "packages", "openclaw-consciousness"), { recursive: true });
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "patch-openclaw-config.py"), "#!/usr/bin/env python3\n", "utf8");
    fs.writeFileSync(path.join(root, "packages", "openclaw-memory-plugin", "package.json"), "{}", "utf8");
    fs.writeFileSync(path.join(root, "packages", "openclaw-context-engine", "package.json"), "{}", "utf8");
    fs.writeFileSync(path.join(root, "packages", "openclaw-consciousness", "package.json"), "{}", "utf8");
    fs.writeFileSync(path.join(root, "scripts", "run-memory-maintenance.sh"), "#!/usr/bin/env bash\n", "utf8");
  };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    mockedSpawnSync.mockReset();
    tempDir = makeTempDir("novaspine-route");
    assetDir = makeTempDir("novaspine-assets");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.CLAW3D_NOVASPINE_ASSET_ROOT = assetDir;
    writeBundledAssets(assetDir);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    if (assetDir) {
      fs.rmSync(assetDir, { recursive: true, force: true });
      assetDir = null;
    }
  });

  it("GET reports integrated NovaSpine when slots are already patched", async () => {
    writeOpenClawConfig(tempDir!, {
      gateway: { auth: { token: "token-123" } },
      plugins: {
        slots: {
          memory: "novaspine-memory",
          contextEngine: "novaspine-context",
        },
        entries: {
          "nova-consciousness": { enabled: true },
        },
      },
    });

    mockedSpawnSync.mockImplementation((command, args) => {
      if (command === "openclaw" && (args as string[])[0] === "--version") {
        return { status: 0, stdout: "2026.4.10\n", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && (args as string[])[0] === "--version") {
        return { status: 0, stdout: "Python 3.12.4\n", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && (args as string[])[0] === "-c") {
        return { status: 0, stdout: "", stderr: "", error: undefined } as never;
      }
      return { status: 1, stdout: "", stderr: "", error: undefined } as never;
    });

    const response = await GET();
    const body = (await response.json()) as { status?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.status).toEqual(
      expect.objectContaining({
        integrationEnabled: true,
        readiness: "integrated",
        openclawVersion: "2026.4.10",
        memorySlot: "novaspine-memory",
        contextEngineSlot: "novaspine-context",
      })
    );
  });

  it("POST installs NovaSpine into the local OpenClaw config", async () => {
    const configPath = path.join(tempDir!, "openclaw.json");
    writeOpenClawConfig(tempDir!, {
      gateway: { auth: { token: "token-123" } },
      plugins: { slots: {} },
    });

    mockedSpawnSync.mockImplementation((command, args) => {
      const argv = args as string[];
      if (command === "openclaw" && argv[0] === "--version") {
        return { status: 0, stdout: "2026.4.10\n", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && argv[0] === "--version") {
        return { status: 0, stdout: "Python 3.12.4\n", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && argv[0] === "-c") {
        return { status: 0, stdout: "", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && argv[0] === "-m" && argv[1] === "pip") {
        return { status: 0, stdout: "installed", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && argv[0] === path.join(assetDir!, "patch-openclaw-config.py")) {
        writeOpenClawConfig(tempDir!, {
          gateway: { auth: { token: "token-123" } },
          plugins: {
            slots: {
              memory: "novaspine-memory",
              contextEngine: "novaspine-context",
            },
            entries: {
              "nova-consciousness": { enabled: true },
            },
          },
        });
        return { status: 0, stdout: "patched", stderr: "", error: undefined } as never;
      }
      if (command === "openclaw" && argv[0] === "config" && argv[1] === "validate") {
        return { status: 0, stdout: "valid", stderr: "", error: undefined } as never;
      }
      if (command === "python3" && argv[0] === "-m" && argv[1] === "c3ae.cli") {
        return { status: 0, stdout: "doctor ok", stderr: "", error: undefined } as never;
      }
      return { status: 1, stdout: "", stderr: "", error: undefined } as never;
    });

    const response = await POST(
      new Request("http://localhost/api/novaspine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      })
    );
    const body = (await response.json()) as {
      ok?: boolean;
      status?: { integrationEnabled?: boolean; readiness?: string };
      steps?: Array<{ name?: string; ok?: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toEqual(
      expect.objectContaining({
        integrationEnabled: true,
        readiness: "integrated",
      })
    );
    expect(body.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "python-package", ok: true }),
        expect.objectContaining({ name: "bundle-assets", ok: true }),
        expect.objectContaining({ name: "openclaw-config-patch", ok: true }),
      ])
    );

    const patched = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      plugins?: { slots?: { memory?: string; contextEngine?: string } };
    };
    expect(patched.plugins?.slots).toEqual({
      memory: "novaspine-memory",
      contextEngine: "novaspine-context",
    });
  });
});
