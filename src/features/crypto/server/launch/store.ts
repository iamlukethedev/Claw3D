import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CryptoLaunchDraft, CryptoLaunchPrepared } from "@/features/crypto/types";
import { resolveStateDir } from "@/lib/clawdbot/paths";

type PersistedPreparedLaunch = {
  prepared: CryptoLaunchPrepared;
  draft: CryptoLaunchDraft;
  serializedTransaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
  submitTokenHash: string;
  createdAt: string;
  requestIp: string | null;
  userAgent: string | null;
};

type LaunchStore = {
  schemaVersion: 1;
  updatedAt: string;
  preparedLaunches: PersistedPreparedLaunch[];
};

export type LaunchAuditEntry = {
  at: string;
  type:
    | "prepare_succeeded"
    | "prepare_failed"
    | "submit_succeeded"
    | "submit_failed"
    | "server_mode_denied"
    | "rate_limited";
  launchId: string | null;
  network: string | null;
  executionMode: string | null;
  creatorPublicKey: string | null;
  mintAddress: string | null;
  requestIp: string | null;
  userAgent: string | null;
  note: string | null;
};

const STORE_DIR = path.join("claw3d", "crypto-launch");
const STORE_FILE = "prepared-launches.json";
const AUDIT_FILE = "launch-audit.jsonl";

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveLaunchStoreDir = () => {
  const dir = path.join(resolveStateDir(), STORE_DIR);
  ensureDirectory(dir);
  return dir;
};

const resolveLaunchStorePath = () => path.join(resolveLaunchStoreDir(), STORE_FILE);
const resolveLaunchAuditPath = () => path.join(resolveLaunchStoreDir(), AUDIT_FILE);

const defaultStore = (): LaunchStore => ({
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  preparedLaunches: [],
});

const normalizePreparedLaunch = (value: unknown): PersistedPreparedLaunch | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const prepared = record.prepared;
  const draft = record.draft;
  if (!prepared || typeof prepared !== "object" || !draft || typeof draft !== "object") return null;
  const launchId =
    typeof (prepared as Record<string, unknown>).launchId === "string"
      ? (prepared as Record<string, unknown>).launchId
      : "";
  const submitTokenHash = typeof record.submitTokenHash === "string" ? record.submitTokenHash : "";
  const serializedTransaction =
    typeof record.serializedTransaction === "string" ? record.serializedTransaction : "";
  const blockhash = typeof record.blockhash === "string" ? record.blockhash : "";
  const lastValidBlockHeight =
    typeof record.lastValidBlockHeight === "number" ? record.lastValidBlockHeight : NaN;
  if (!launchId || !submitTokenHash || !serializedTransaction || !blockhash || !Number.isFinite(lastValidBlockHeight)) {
    return null;
  }
  return {
    prepared: prepared as CryptoLaunchPrepared,
    draft: draft as CryptoLaunchDraft,
    serializedTransaction,
    blockhash,
    lastValidBlockHeight,
    submitTokenHash,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
    requestIp: typeof record.requestIp === "string" ? record.requestIp : null,
    userAgent: typeof record.userAgent === "string" ? record.userAgent : null,
  };
};

const readStore = (): LaunchStore => {
  const storePath = resolveLaunchStorePath();
  if (!fs.existsSync(storePath)) return defaultStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as { preparedLaunches?: unknown[]; updatedAt?: unknown } | null;
    if (!parsed || typeof parsed !== "object") return defaultStore();
    return {
      schemaVersion: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      preparedLaunches: Array.isArray(parsed.preparedLaunches)
        ? parsed.preparedLaunches
            .map((entry) => normalizePreparedLaunch(entry))
            .filter((entry): entry is PersistedPreparedLaunch => Boolean(entry))
        : [],
    };
  } catch {
    return defaultStore();
  }
};

const writeStore = (store: LaunchStore) => {
  const storePath = resolveLaunchStorePath();
  const dir = path.dirname(storePath);
  const tmpPath = path.join(dir, `.prepared-launches-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmpPath, storePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }
};

export const hashLaunchSubmitToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createLaunchSubmitToken = () => crypto.randomBytes(32).toString("hex");

export const listPreparedLaunches = () => readStore().preparedLaunches;

export const savePreparedLaunch = (entry: PersistedPreparedLaunch) => {
  const store = readStore();
  const next = store.preparedLaunches.filter(
    (existing) => existing.prepared.launchId !== entry.prepared.launchId,
  );
  next.push(entry);
  writeStore({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    preparedLaunches: next,
  });
};

export const getPreparedLaunch = (launchId: string) =>
  readStore().preparedLaunches.find((entry) => entry.prepared.launchId === launchId) ?? null;

export const deletePreparedLaunch = (launchId: string) => {
  const store = readStore();
  const next = store.preparedLaunches.filter((entry) => entry.prepared.launchId !== launchId);
  if (next.length === store.preparedLaunches.length) return;
  writeStore({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    preparedLaunches: next,
  });
};

export const pruneExpiredPreparedLaunches = (now = Date.now()) => {
  const store = readStore();
  const next = store.preparedLaunches.filter((entry) => entry.prepared.expiresAt > now);
  if (next.length === store.preparedLaunches.length) return;
  writeStore({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    preparedLaunches: next,
  });
};

export const appendLaunchAuditEntry = (entry: LaunchAuditEntry) => {
  const auditPath = resolveLaunchAuditPath();
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, "utf8");
};

export type StoredPreparedLaunch = PersistedPreparedLaunch;
export const resolveLaunchStorePaths = () => ({
  storePath: resolveLaunchStorePath(),
  auditPath: resolveLaunchAuditPath(),
});
