"use client";

import { useCallback, useSyncExternalStore } from "react";

// Session-only values for keys whose last write could not be persisted
// (private mode, quota, disabled storage). Keeps the UI responsive even when
// localStorage is unavailable.
const memoryFallback = new Map<string, boolean>();
const listenersByKey = new Map<string, Set<() => void>>();

const readFlag = (key: string): boolean => {
  const fallback = memoryFallback.get(key);
  if (fallback !== undefined) return fallback;
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const notify = (key: string): void => {
  listenersByKey.get(key)?.forEach((listener) => listener());
};

const writeFlag = (key: string, value: boolean): void => {
  try {
    if (value) {
      window.localStorage.setItem(key, "true");
    } else {
      window.localStorage.removeItem(key);
    }
    memoryFallback.delete(key);
  } catch {
    memoryFallback.set(key, value);
  }
  notify(key);
};

const subscribe = (key: string, listener: () => void): (() => void) => {
  const listeners = listenersByKey.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  listenersByKey.set(key, listeners);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    memoryFallback.delete(key);
    listener();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByKey.delete(key);
    window.removeEventListener("storage", handleStorage);
  };
};

const getServerSnapshot = (): null => null;

/**
 * Boolean flag persisted in localStorage.
 *
 * Returns `null` during server render and hydration so callers can avoid
 * flashing UI that depends on browser-only state.
 */
export const useLocalStorageFlag = (
  key: string,
): [boolean | null, (value: boolean) => void] => {
  const subscribeToKey = useCallback(
    (listener: () => void) => subscribe(key, listener),
    [key],
  );
  const getSnapshot = useCallback(() => readFlag(key), [key]);
  const value = useSyncExternalStore<boolean | null>(
    subscribeToKey,
    getSnapshot,
    getServerSnapshot,
  );
  const setValue = useCallback((next: boolean) => writeFlag(key, next), [key]);
  return [value, setValue];
};
