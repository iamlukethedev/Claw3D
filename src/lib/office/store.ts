import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import { createEmptyOfficeMap, normalizeOfficeMap, type OfficeMap } from "@/lib/office/schema";

export type OfficeRecord = {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type OfficeVersionRecord = {
  id: string;
  officeId: string;
  workspaceId: string;
  versionNumber: number;
  mapJson: OfficeMap;
  createdBy: string;
  createdAt: string;
  notes?: string;
};

export type PublishedOfficeRecord = {
  workspaceId: string;
  officeId: string;
  officeVersionId: string;
  publishedAt: string;
  publishedBy: string;
};

type OfficeStoreShape = {
  schemaVersion: number;
  offices: OfficeRecord[];
  officeVersions: OfficeVersionRecord[];
  published: PublishedOfficeRecord[];
};

const STORE_DIR = "hermes3d";
const STORE_FILE = "office-store.json";
const STORE_VERSION = 1;

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

const defaultStore = (): OfficeStoreShape => ({
  schemaVersion: STORE_VERSION,
  offices: [],
  officeVersions: [],
  published: [],
});

const normalizeStore = (value: unknown): OfficeStoreShape => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStore();
  }
  const raw = value as Record<string, unknown>;
  const offices = Array.isArray(raw.offices) ? raw.offices : [];
  const officeVersions = Array.isArray(raw.officeVersions) ? raw.officeVersions : [];
  const published = Array.isArray(raw.published) ? raw.published : [];

  return {
    schemaVersion: STORE_VERSION,
    offices: offices.filter((entry): entry is OfficeRecord => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Record<string, unknown>;
      return (
        typeof record.id === "string" &&
        typeof record.workspaceId === "string" &&
        typeof record.name === "string" &&
        typeof record.createdAt === "string" &&
        typeof record.updatedAt === "string"
      );
    }),
    officeVersions: officeVersions.filter((entry): entry is OfficeVersionRecord => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Record<string, unknown>;
      return (
        typeof record.id === "string" &&
        typeof record.officeId === "string" &&
        typeof record.workspaceId === "string" &&
        typeof record.versionNumber === "number" &&
        typeof record.createdBy === "string" &&
        typeof record.createdAt === "string" &&
        Boolean(record.mapJson)
      );
    }),
    published: published.filter((entry): entry is PublishedOfficeRecord => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Record<string, unknown>;
      return (
        typeof record.workspaceId === "string" &&
        typeof record.officeId === "string" &&
        typeof record.officeVersionId === "string" &&
        typeof record.publishedAt === "string" &&
        typeof record.publishedBy === "string"
      );
    }),
  };
};

const readStore = (): OfficeStoreShape => {
  const storePath = resolveStorePath();
  if (!fs.existsSync(storePath)) {
    return defaultStore();
  }
  const raw = fs.readFileSync(storePath, "utf8");
  return normalizeStore(JSON.parse(raw));
};

const writeStore = (store: OfficeStoreShape) => {
  const storePath = resolveStorePath();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
};

export const listOfficesForWorkspace = (workspaceId: string) => {
  const store = readStore();
  return store.offices.filter((entry) => entry.workspaceId === workspaceId);
};

export const listOfficeVersions = (workspaceId: string, officeId: string) => {
  const store = readStore();
  return store.officeVersions
    .filter((entry) => entry.workspaceId === workspaceId && entry.officeId === officeId)
    .sort((left, right) => right.versionNumber - left.versionNumber);
};

export const getPublishedOffice = (workspaceId: string) => {
  const store = readStore();
  return store.published.find((entry) => entry.workspaceId === workspaceId) ?? null;
};

export const getPublishedOfficeMap = (workspaceId: string): OfficeMap | null => {
  const store = readStore();
  const published = store.published.find((entry) => entry.workspaceId === workspaceId);
  if (!published) return null;
  const version = store.officeVersions.find(
    (entry) =>
      entry.workspaceId === workspaceId &&
      entry.officeId === published.officeId &&
      entry.id === published.officeVersionId
  );
  if (!version) return null;
  const fallback = createEmptyOfficeMap({
    workspaceId,
    officeVersionId: version.id,
    width: 1600,
    height: 900,
  });
  return normalizeOfficeMap(version.mapJson, fallback);
};

export const upsertOffice = (params: {
  workspaceId: string;
  officeId: string;
  name: string;
}) => {
  const store = readStore();
  const now = new Date().toISOString();
  const existing = store.offices.find(
    (entry) => entry.workspaceId === params.workspaceId && entry.id === params.officeId
  );
  if (existing) {
    existing.name = params.name;
    existing.updatedAt = now;
    writeStore(store);
    return existing;
  }
  const created: OfficeRecord = {
    id: params.officeId,
    workspaceId: params.workspaceId,
    name: params.name,
    createdAt: now,
    updatedAt: now,
  };
  store.offices.push(created);
  writeStore(store);
  return created;
};

export const saveOfficeVersion = (params: {
  workspaceId: string;
  officeId: string;
  versionId: string;
  createdBy: string;
  notes?: string;
  map: OfficeMap;
}) => {
  const store = readStore();
  const now = new Date().toISOString();
  const matching = store.officeVersions.filter(
    (entry) => entry.workspaceId === params.workspaceId && entry.officeId === params.officeId
  );
  const nextVersionNumber = matching.length === 0 ? 1 : Math.max(...matching.map((entry) => entry.versionNumber)) + 1;
  const record: OfficeVersionRecord = {
    id: params.versionId,
    officeId: params.officeId,
    workspaceId: params.workspaceId,
    versionNumber: nextVersionNumber,
    mapJson: params.map,
    createdBy: params.createdBy,
    createdAt: now,
    notes: params.notes,
  };
  store.officeVersions.push(record);
  writeStore(store);
  return record;
};

export const publishOfficeVersion = (params: {
  workspaceId: string;
  officeId: string;
  officeVersionId: string;
  publishedBy: string;
}) => {
  const store = readStore();
  const match = store.officeVersions.find(
    (entry) =>
      entry.workspaceId === params.workspaceId &&
      entry.officeId === params.officeId &&
      entry.id === params.officeVersionId
  );
  if (!match) {
    throw new Error("Office version not found.");
  }
  const now = new Date().toISOString();
  const current = store.published.find((entry) => entry.workspaceId === params.workspaceId);
  if (current) {
    current.officeId = params.officeId;
    current.officeVersionId = params.officeVersionId;
    current.publishedBy = params.publishedBy;
    current.publishedAt = now;
    writeStore(store);
    return current;
  }
  const created: PublishedOfficeRecord = {
    workspaceId: params.workspaceId,
    officeId: params.officeId,
    officeVersionId: params.officeVersionId,
    publishedBy: params.publishedBy,
    publishedAt: now,
  };
  store.published.push(created);
  writeStore(store);
  return created;
};
