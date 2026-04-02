import type {
  CryptoLaunchConversationState,
  CryptoLaunchDraftState,
  CryptoLaunchPrepared,
  CryptoLaunchResult,
} from "@/features/crypto/types";
import { normalizeLaunchDraft } from "@/features/crypto/lib/launchSchema";

const CRYPTO_LAUNCH_STORAGE_KEY = "openclaw-crypto-launch-v1";
const CRYPTO_LAUNCH_EVENT = "openclaw:crypto-launch-updated";

const buildDefaultConversation = (): CryptoLaunchConversationState => ({
  active: false,
  agentId: null,
  awaitingField: null,
  lastUpdatedAt: null,
});

export const buildInitialCryptoLaunchState = (): CryptoLaunchDraftState => ({
  draft: normalizeLaunchDraft(null),
  conversation: buildDefaultConversation(),
  lastPrepared: null,
  lastResult: null,
});

const canUseDom = () => typeof window !== "undefined";

export const loadCryptoLaunchState = (): CryptoLaunchDraftState => {
  if (!canUseDom()) return buildInitialCryptoLaunchState();
  try {
    const raw = window.localStorage.getItem(CRYPTO_LAUNCH_STORAGE_KEY);
    if (!raw) return buildInitialCryptoLaunchState();
    const parsed = JSON.parse(raw) as Partial<CryptoLaunchDraftState> | null;
    if (!parsed || typeof parsed !== "object") return buildInitialCryptoLaunchState();
    const fallback = buildInitialCryptoLaunchState();
    return {
      draft: normalizeLaunchDraft(parsed.draft),
      conversation:
        parsed.conversation && typeof parsed.conversation === "object"
          ? {
              active: Boolean(parsed.conversation.active),
              agentId:
                typeof parsed.conversation.agentId === "string"
                  ? parsed.conversation.agentId
                  : null,
              awaitingField:
                typeof parsed.conversation.awaitingField === "string"
                  ? parsed.conversation.awaitingField
                  : null,
              lastUpdatedAt:
                typeof parsed.conversation.lastUpdatedAt === "number"
                  ? parsed.conversation.lastUpdatedAt
                  : null,
            }
          : fallback.conversation,
      lastPrepared:
        parsed.lastPrepared && typeof parsed.lastPrepared === "object"
          ? (parsed.lastPrepared as CryptoLaunchPrepared)
          : null,
      lastResult:
        parsed.lastResult && typeof parsed.lastResult === "object"
          ? (parsed.lastResult as CryptoLaunchResult)
          : null,
    };
  } catch {
    return buildInitialCryptoLaunchState();
  }
};

const emitCryptoLaunchUpdate = () => {
  if (!canUseDom()) return;
  window.dispatchEvent(new CustomEvent(CRYPTO_LAUNCH_EVENT));
};

const sanitizePreparedForStorage = (
  prepared: CryptoLaunchPrepared | null,
): CryptoLaunchPrepared | null =>
  prepared
    ? {
        ...prepared,
        submitToken: "",
        serializedTransaction: null,
      }
    : null;

export const saveCryptoLaunchState = (state: CryptoLaunchDraftState) => {
  if (!canUseDom()) return;
  try {
    window.localStorage.setItem(
      CRYPTO_LAUNCH_STORAGE_KEY,
      JSON.stringify({
        ...state,
        lastPrepared: sanitizePreparedForStorage(state.lastPrepared),
      } satisfies CryptoLaunchDraftState),
    );
    emitCryptoLaunchUpdate();
  } catch {
    /* ignore */
  }
};

export const subscribeToCryptoLaunchUpdates = (listener: () => void) => {
  if (!canUseDom()) return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CRYPTO_LAUNCH_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CRYPTO_LAUNCH_EVENT, listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CRYPTO_LAUNCH_EVENT, listener);
  };
};
