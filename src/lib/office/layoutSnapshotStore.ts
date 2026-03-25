import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "@/lib/clawdbot/paths";
import type { OfficeLayoutSnapshot } from "@/lib/office/layoutSnapshot";

type LayoutSnapshotStore = {
  schemaVersion: 1;
  snapshots: Record<string, OfficeLayoutSnapshot>;
};

const STORE_DIR = "claw3d";
const STORE_FILE = "retro-office-layouts.json";

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const resolveStorePath = () => {
  const stateDir = resolveStateDir();
  const dir = path.join(stateDir, STORE_DIR);
  ensureDirectory(dir);
  return path.join(dir, STORE_FILE);
};

const defaultStore = (): LayoutSnapshotStore => ({
  schemaVersion: 1,
  snapshots: {},
});

const readStore = (): LayoutSnapshotStore => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) {
    return defaultStore();
  }
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as LayoutSnapshotStore;
    if (
      !parsed ||
      parsed.schemaVersion !== 1 ||
      !parsed.snapshots ||
      typeof parsed.snapshots !== "object"
    ) {
      return defaultStore();
    }
    return parsed;
  } catch {
    return defaultStore();
  }
};

const writeStore = (store: LayoutSnapshotStore) => {
  fs.writeFileSync(resolveStorePath(), JSON.stringify(store, null, 2), "utf8");
};

const normalizeGatewayKey = (gatewayUrl: string) => gatewayUrl.trim();

export const loadOfficeLayoutSnapshot = (gatewayUrl: string) => {
  const key = normalizeGatewayKey(gatewayUrl);
  if (!key) return null;
  const store = readStore();
  return store.snapshots[key] ?? null;
};

export const saveOfficeLayoutSnapshot = (snapshot: OfficeLayoutSnapshot) => {
  const key = normalizeGatewayKey(snapshot.gatewayUrl);
  if (!key) {
    throw new Error("Gateway URL is required to save office layout snapshot.");
  }
  const store = readStore();
  store.snapshots[key] = snapshot;
  writeStore(store);
  return snapshot;
};
