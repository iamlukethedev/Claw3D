import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import type { StandupMeeting, StandupMeetingStore } from "@/lib/office/standup/types";

const STORE_DIR = "claw3d";
const STORE_FILE = "standup-store.json";
const GATHERING_MEETING_MAX_AGE_MS = 5 * 60 * 1000;
const ACTIVE_MEETING_MAX_AGE_MS = 20 * 60 * 1000;

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveStorePath = () => {
  const dir = path.join(resolveStateDir(), STORE_DIR);
  ensureDirectory(dir);
  return path.join(dir, STORE_FILE);
};

const defaultStore = (): StandupMeetingStore => ({
  activeMeeting: null,
  lastMeeting: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeMeeting = (value: unknown): StandupMeeting | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (!Array.isArray(value.cards) || !Array.isArray(value.participantOrder)) return null;
  if (!Array.isArray(value.arrivedAgentIds)) return null;
  if (typeof value.startedAt !== "string" || typeof value.updatedAt !== "string") return null;
  return value as StandupMeeting;
};

const isActiveMeetingStale = (
  meeting: StandupMeeting | null,
  nowMs: number = Date.now()
): boolean => {
  if (!meeting) return false;
  if (meeting.phase === "gathering") {
    const startedAtMs = Date.parse(meeting.startedAt);
    if (!Number.isFinite(startedAtMs)) return false;
    return nowMs - startedAtMs > GATHERING_MEETING_MAX_AGE_MS;
  }
  if (meeting.phase !== "in_progress") {
    return false;
  }
  const updatedAtMs = Date.parse(meeting.updatedAt);
  if (!Number.isFinite(updatedAtMs)) return false;
  return nowMs - updatedAtMs > ACTIVE_MEETING_MAX_AGE_MS;
};

const readStore = (): StandupMeetingStore => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) {
    return defaultStore();
  }
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) return defaultStore();
  const activeMeeting = normalizeMeeting(parsed.activeMeeting);
  const lastMeeting = normalizeMeeting(parsed.lastMeeting);
  return {
    activeMeeting: isActiveMeetingStale(activeMeeting) ? null : activeMeeting,
    lastMeeting,
  };
};

const writeStore = (store: StandupMeetingStore) => {
  const storePath = resolveStorePath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
};

export const loadStandupMeetingStore = (): StandupMeetingStore => readStore();

export const loadActiveStandupMeeting = (): StandupMeeting | null => readStore().activeMeeting;

export const saveStandupMeeting = (meeting: StandupMeeting | null): StandupMeetingStore => {
  const current = readStore();
  const next: StandupMeetingStore = {
    activeMeeting: meeting,
    lastMeeting: meeting ?? current.lastMeeting,
  };
  if (meeting?.phase === "complete") {
    next.lastMeeting = meeting;
  }
  writeStore(next);
  return next;
};

export const updateStandupMeeting = (
  updater: (meeting: StandupMeeting | null) => StandupMeeting | null
): StandupMeetingStore => {
  const current = readStore();
  const nextMeeting = updater(current.activeMeeting);
  const nextStore: StandupMeetingStore = {
    activeMeeting: nextMeeting,
    lastMeeting:
      nextMeeting?.phase === "complete"
        ? nextMeeting
        : current.lastMeeting,
  };
  writeStore(nextStore);
  return nextStore;
};
