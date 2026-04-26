import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStateDir } from "@/lib/clawdbot/paths";
import {
  isOfficeStateEffectId,
  type OfficeStateEffectId,
} from "@/lib/office/stateMappingConfig";

export type OfficeExternalEventEffect = Exclude<OfficeStateEffectId, "none">;

export type OfficeExternalEvent = {
  id: string;
  source: string;
  type: string;
  title: string;
  message: string;
  effect: OfficeExternalEventEffect | null;
  agentId: string | null;
  receivedAt: number;
  metadata: Record<string, string | number | boolean | null>;
};

export type OfficeExternalEventInput = {
  id?: unknown;
  source?: unknown;
  type?: unknown;
  title?: unknown;
  message?: unknown;
  effect?: unknown;
  agentId?: unknown;
  metadata?: unknown;
};

type OfficeExternalEventsStore = {
  schemaVersion: 1;
  events: OfficeExternalEvent[];
};

const STORE_DIR = "claw3d";
const STORE_FILE = "office-events.json";
const MAX_EVENTS = 50;
const MAX_FIELD_LENGTH = 240;
const MAX_METADATA_ENTRIES = 24;

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

const defaultStore = (): OfficeExternalEventsStore => ({
  schemaVersion: 1,
  events: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const coerceString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : fallback;

const normalizeMetadata = (value: unknown): OfficeExternalEvent["metadata"] => {
  if (!isRecord(value)) return {};
  const entries: OfficeExternalEvent["metadata"] = {};
  for (const [keyRaw, valueRaw] of Object.entries(value).slice(0, MAX_METADATA_ENTRIES)) {
    const key = coerceString(keyRaw).slice(0, 80);
    if (!key) continue;
    if (
      typeof valueRaw === "string" ||
      typeof valueRaw === "number" ||
      typeof valueRaw === "boolean" ||
      valueRaw === null
    ) {
      entries[key] =
        typeof valueRaw === "string" ? valueRaw.slice(0, MAX_FIELD_LENGTH) : valueRaw;
    }
  }
  return entries;
};

const normalizeEffect = (value: unknown): OfficeExternalEventEffect | null => {
  if (!isOfficeStateEffectId(value) || value === "none") return null;
  return value;
};

const normalizeEvent = (value: unknown): OfficeExternalEvent | null => {
  if (!isRecord(value)) return null;
  const source = coerceString(value.source);
  const type = coerceString(value.type);
  if (!source || !type) return null;
  const receivedAt =
    typeof value.receivedAt === "number" && Number.isFinite(value.receivedAt)
      ? value.receivedAt
      : Date.now();
  return {
    id: coerceString(value.id) || randomUUID(),
    source,
    type,
    title: coerceString(value.title) || type,
    message: coerceString(value.message),
    effect: normalizeEffect(value.effect),
    agentId: coerceString(value.agentId) || null,
    receivedAt,
    metadata: normalizeMetadata(value.metadata),
  };
};

const readStore = (): OfficeExternalEventsStore => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) return defaultStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.events)) {
      return defaultStore();
    }
    return {
      schemaVersion: 1,
      events: parsed.events
        .map((entry) => normalizeEvent(entry))
        .filter((entry): entry is OfficeExternalEvent => Boolean(entry))
        .slice(0, MAX_EVENTS),
    };
  } catch {
    return defaultStore();
  }
};

const writeStore = (store: OfficeExternalEventsStore) => {
  fs.writeFileSync(resolveStorePath(), JSON.stringify(store, null, 2), "utf8");
};

export const listOfficeExternalEvents = (limit = MAX_EVENTS): OfficeExternalEvent[] =>
  readStore().events.slice(0, Math.max(1, Math.min(MAX_EVENTS, limit)));

export const appendOfficeExternalEvent = (
  input: OfficeExternalEventInput,
): OfficeExternalEvent => {
  const event = normalizeEvent({
    ...input,
    receivedAt: Date.now(),
  });
  if (!event) {
    throw new Error("External event source and type are required.");
  }
  const store = readStore();
  const deduped = store.events.filter((entry) => entry.id !== event.id);
  const next = {
    schemaVersion: 1 as const,
    events: [event, ...deduped].slice(0, MAX_EVENTS),
  };
  writeStore(next);
  return event;
};
