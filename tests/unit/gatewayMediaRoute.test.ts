// @vitest-environment node

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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

let GET: typeof import("@/app/api/gateway/media/route")["GET"];

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeStudioSettings = (stateDir: string, gatewayUrl: string) => {
  const settingsDir = path.join(stateDir, "claw3d");
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(settingsDir, "settings.json"),
    JSON.stringify(
      {
        version: 1,
        gateway: { url: gatewayUrl, token: "token-123" },
        focused: {},
      },
      null,
      2
    ),
    "utf8"
  );
};

beforeAll(async () => {
  ({ GET } = await import("@/app/api/gateway/media/route"));
});

describe("/api/gateway/media route", () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPENCLAW_GATEWAY_SSH_TARGET;
    delete process.env.OPENCLAW_GATEWAY_SSH_USER;
    delete process.env.OPENCLAW_STATE_DIR;
    mockedSpawnSync.mockReset();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("returns binary image data when reading remote media over ssh", async () => {
    tempDir = makeTempDir("gateway-media-route-remote");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    process.env.OPENCLAW_GATEWAY_SSH_TARGET = "me@host.test";
    writeStudioSettings(tempDir, "ws://example.test:18789");

    const payloadBytes = Buffer.from("fake", "utf8");
    mockedSpawnSync.mockReturnValueOnce({
      status: 0,
      stdout: JSON.stringify({
        ok: true,
        mime: "image/png",
        size: payloadBytes.length,
        data: payloadBytes.toString("base64"),
      }),
      stderr: "",
      error: undefined,
    } as never);

    const remotePath = "/home/ubuntu/.openclaw/images/pic.png";
    const response = await GET(
      new Request(
        `http://localhost/api/gateway/media?path=${encodeURIComponent(remotePath)}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe(String(payloadBytes.length));

    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.equals(payloadBytes)).toBe(true);

    expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
    const [cmd, args, options] = mockedSpawnSync.mock.calls[0] as [
      string,
      string[],
      { encoding?: string; input?: string; maxBuffer?: number },
    ];
    expect(cmd).toBe("ssh");
    expect(args).toEqual(
      expect.arrayContaining([
        "-o",
        "BatchMode=yes",
        "me@host.test",
        "bash",
        "-s",
        "--",
        remotePath,
      ])
    );
    expect(options.encoding).toBe("utf8");
    expect(options.input).toContain("python3 - \"$1\"");
    expect(typeof options.maxBuffer).toBe("number");
    expect(options.maxBuffer).toBeGreaterThan(payloadBytes.length);
  });

  it("rejects symlinked local media paths", async () => {
    tempDir = makeTempDir("gateway-media-route-local-symlink");
    const realHome = os.homedir();
    const allowedRoot = path.join(realHome, ".openclaw");
    const imagesDir = path.join(allowedRoot, "images");
    const outsideDir = path.join(tempDir, "outside");
    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });

    const outsideFile = path.join(outsideDir, "secret.png");
    fs.writeFileSync(outsideFile, "not-allowed", "utf8");
    const symlinkPath = path.join(imagesDir, "linked.png");
    fs.symlinkSync(outsideFile, symlinkPath);

    process.env.OPENCLAW_STATE_DIR = tempDir;
    writeStudioSettings(tempDir, "ws://localhost:18789");

    const response = await GET(
      new Request(
        `http://localhost/api/gateway/media?path=${encodeURIComponent(symlinkPath)}`
      )
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/symlink/i);

    fs.rmSync(symlinkPath, { force: true });
  });
});

