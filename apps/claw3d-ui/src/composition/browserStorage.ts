import type { StoragePort } from "@claw3d/visual-contract";

const NAMESPACE = "claw3d.visual.v1.";

export function createBrowserStoragePort(enabled: boolean): StoragePort {
  const storage = () => (enabled && typeof window !== "undefined" ? window.localStorage : null);
  return {
    get(key) {
      try { return storage()?.getItem(`${NAMESPACE}${key}`) ?? null; } catch { return null; }
    },
    set(key, value) {
      try { storage()?.setItem(`${NAMESPACE}${key}`, value); } catch { /* unavailable by policy */ }
    },
    remove(key) {
      try { storage()?.removeItem(`${NAMESPACE}${key}`); } catch { /* unavailable by policy */ }
    },
    clearNamespace() {
      try {
        const target = window.localStorage;
        const keys = Array.from({ length: target.length }, (_, index) => target.key(index)).filter(
          (key): key is string => Boolean(key?.startsWith(NAMESPACE)),
        );
        keys.forEach((key) => target.removeItem(key));
      } catch { /* unavailable by policy */ }
    },
  };
}
