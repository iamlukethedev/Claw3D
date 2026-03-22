import {
  ATM_MIGRATION_KEY,
  CRYPTO_ROOM_MIGRATION_KEY,
  GYM_ROOM_MIGRATION_KEY,
  PHONE_BOOTH_MIGRATION_KEY,
  QA_LAB_MIGRATION_KEY,
  SMS_BOOTH_MIGRATION_KEY,
  SERVER_ROOM_MIGRATION_KEY,
  STORAGE_KEY,
} from "@/features/retro-office/core/constants";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const hasStorageFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const markStorageFlag = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
};

export const saveFurniture = (items: FurnitureItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

export const loadFurniture = (): FurnitureItem[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as FurnitureItem[])
      : null;
  } catch {
    return null;
  }
};

export const hasAtmMigrationApplied = () => hasStorageFlag(ATM_MIGRATION_KEY);

export const markAtmMigrationApplied = () => {
  markStorageFlag(ATM_MIGRATION_KEY);
};

export const hasServerRoomMigrationApplied = () =>
  hasStorageFlag(SERVER_ROOM_MIGRATION_KEY);

export const markServerRoomMigrationApplied = () => {
  markStorageFlag(SERVER_ROOM_MIGRATION_KEY);
};

export const hasGymRoomMigrationApplied = () =>
  hasStorageFlag(GYM_ROOM_MIGRATION_KEY);

export const markGymRoomMigrationApplied = () => {
  markStorageFlag(GYM_ROOM_MIGRATION_KEY);
};

export const hasQaLabMigrationApplied = () =>
  hasStorageFlag(QA_LAB_MIGRATION_KEY);

export const markQaLabMigrationApplied = () => {
  markStorageFlag(QA_LAB_MIGRATION_KEY);
};

export const hasPhoneBoothMigrationApplied = () =>
  hasStorageFlag(PHONE_BOOTH_MIGRATION_KEY);

export const markPhoneBoothMigrationApplied = () => {
  markStorageFlag(PHONE_BOOTH_MIGRATION_KEY);
};

export const hasSmsBoothMigrationApplied = () =>
  hasStorageFlag(SMS_BOOTH_MIGRATION_KEY);

export const markSmsBoothMigrationApplied = () => {
  markStorageFlag(SMS_BOOTH_MIGRATION_KEY);
};

export const hasCryptoRoomMigrationApplied = () =>
  hasStorageFlag(CRYPTO_ROOM_MIGRATION_KEY);

export const markCryptoRoomMigrationApplied = () => {
  markStorageFlag(CRYPTO_ROOM_MIGRATION_KEY);
};
