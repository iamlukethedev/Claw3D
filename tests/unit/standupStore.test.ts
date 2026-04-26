import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadActiveStandupMeeting } from "@/lib/office/standup/store";
import type { StandupMeetingStore } from "@/lib/office/standup/types";

const makeTempDir = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writeStandupStore = (stateDir: string, store: StandupMeetingStore) => {
  const storeDir = path.join(stateDir, "claw3d");
  fs.mkdirSync(storeDir, { recursive: true });
  fs.writeFileSync(
    path.join(storeDir, "standup-store.json"),
    JSON.stringify(store, null, 2),
    "utf8"
  );
};

describe("standup store", () => {
  const priorStateDir = process.env.OPENCLAW_STATE_DIR;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.OPENCLAW_STATE_DIR = priorStateDir;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("drops stale active gathering meetings on load", () => {
    tempDir = makeTempDir("standup-store-stale");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    const staleIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    writeStandupStore(tempDir, {
      activeMeeting: {
        id: "meeting-stale",
        trigger: "manual",
        phase: "gathering",
        scheduledFor: null,
        startedAt: staleIso,
        updatedAt: staleIso,
        completedAt: null,
        currentSpeakerAgentId: null,
        speakerStartedAt: null,
        speakerDurationMs: 8000,
        participantOrder: ["main"],
        arrivedAgentIds: ["main"],
        cards: [],
      },
      lastMeeting: null,
    });

    expect(loadActiveStandupMeeting()).toBeNull();
  });

  it("keeps fresh active gatherings on load", () => {
    tempDir = makeTempDir("standup-store-fresh");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    const freshIso = new Date().toISOString();
    writeStandupStore(tempDir, {
      activeMeeting: {
        id: "meeting-fresh",
        trigger: "manual",
        phase: "gathering",
        scheduledFor: null,
        startedAt: freshIso,
        updatedAt: freshIso,
        completedAt: null,
        currentSpeakerAgentId: null,
        speakerStartedAt: null,
        speakerDurationMs: 8000,
        participantOrder: ["main"],
        arrivedAgentIds: [],
        cards: [],
      },
      lastMeeting: null,
    });

    expect(loadActiveStandupMeeting()?.id).toBe("meeting-fresh");
  });

  it("drops stale gathering meetings even if arrivals refreshed updatedAt", () => {
    tempDir = makeTempDir("standup-store-gathering-updated");
    process.env.OPENCLAW_STATE_DIR = tempDir;
    const staleStartedIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const freshUpdatedIso = new Date().toISOString();
    writeStandupStore(tempDir, {
      activeMeeting: {
        id: "meeting-gathering-stale",
        trigger: "manual",
        phase: "gathering",
        scheduledFor: null,
        startedAt: staleStartedIso,
        updatedAt: freshUpdatedIso,
        completedAt: null,
        currentSpeakerAgentId: null,
        speakerStartedAt: null,
        speakerDurationMs: 8000,
        participantOrder: ["main"],
        arrivedAgentIds: ["main"],
        cards: [],
      },
      lastMeeting: null,
    });

    expect(loadActiveStandupMeeting()).toBeNull();
  });
});
