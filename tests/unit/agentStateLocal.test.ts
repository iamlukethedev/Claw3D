import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { restoreAgentStateLocally, trashAgentStateLocally } from "@/lib/agent-state/local";

const mkTmpStateDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "hermes3d-test-"));

describe("agent state local", () => {
  const originalStateDir = process.env.OPENCLAW_STATE_DIR;

  afterEach(() => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
  });

  it("trashes and restores agent workspace + state", () => {
    const stateDir = mkTmpStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const agentId = "test-agent";
    const workspace = path.join(stateDir, `workspace-${agentId}`);
    const agentDir = path.join(stateDir, "agents", agentId);
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(workspace, "hello.txt"), "hi", "utf8");
    fs.writeFileSync(path.join(agentDir, "state.json"), "{}", "utf8");

    const trashed = trashAgentStateLocally({ agentId });
    expect(fs.existsSync(workspace)).toBe(false);
    expect(fs.existsSync(agentDir)).toBe(false);
    expect(fs.existsSync(trashed.trashDir)).toBe(true);

    const restored = restoreAgentStateLocally({ agentId, trashDir: trashed.trashDir });
    expect(restored.restored.length).toBeGreaterThan(0);
    expect(fs.existsSync(workspace)).toBe(true);
    expect(fs.existsSync(agentDir)).toBe(true);
    expect(fs.readFileSync(path.join(workspace, "hello.txt"), "utf8")).toBe("hi");
  });

  it("rejects restore paths outside the agent-state trash root", () => {
    const stateDir = mkTmpStateDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const agentId = "test-agent";
    const fakeTrashDir = path.join(stateDir, "agents", agentId);
    fs.mkdirSync(fakeTrashDir, { recursive: true });

    expect(() => restoreAgentStateLocally({ agentId, trashDir: fakeTrashDir })).toThrow(
      "trashDir is not under"
    );
  });
});

