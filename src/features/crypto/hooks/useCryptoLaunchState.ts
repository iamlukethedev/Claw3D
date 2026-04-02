"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildInitialCryptoLaunchState,
  loadCryptoLaunchState,
  saveCryptoLaunchState,
  subscribeToCryptoLaunchUpdates,
} from "@/features/crypto/lib/launchStorage";
import { executeServerSideLaunch, executeWalletApprovedLaunch } from "@/features/crypto/lib/launchClient";
import { normalizeLaunchDraft } from "@/features/crypto/lib/launchSchema";
import type { CryptoLaunchDraft, CryptoLaunchDraftState } from "@/features/crypto/types";

export function useCryptoLaunchState() {
  const [launchState, setLaunchState] = useState<CryptoLaunchDraftState>(() => loadCryptoLaunchState());
  const [launchBusy, setLaunchBusy] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => subscribeToCryptoLaunchUpdates(() => setLaunchState(loadCryptoLaunchState())), []);

  const persistState = useCallback((next: CryptoLaunchDraftState) => {
    setLaunchState(next);
    saveCryptoLaunchState(next);
  }, []);

  const setDraft = useCallback(
    (updater: CryptoLaunchDraft | ((draft: CryptoLaunchDraft) => CryptoLaunchDraft)) => {
      persistState({
        ...launchState,
        draft:
          typeof updater === "function"
            ? normalizeLaunchDraft((updater as (draft: CryptoLaunchDraft) => CryptoLaunchDraft)(launchState.draft))
            : normalizeLaunchDraft(updater),
      });
    },
    [launchState, persistState],
  );

  const setConversation = useCallback(
    (conversation: CryptoLaunchDraftState["conversation"]) => {
      persistState({
        ...launchState,
        conversation,
      });
    },
    [launchState, persistState],
  );

  const resetDraft = useCallback(() => {
    persistState({
      ...buildInitialCryptoLaunchState(),
      lastPrepared: launchState.lastPrepared,
      lastResult: launchState.lastResult,
    });
    setLaunchError(null);
  }, [launchState.lastPrepared, launchState.lastResult, persistState]);

  const submitLaunch = useCallback(async () => {
    setLaunchBusy(true);
    setLaunchError(null);
    try {
      const draft = normalizeLaunchDraft(launchState.draft);
      const outcome =
        draft.executionMode === "server_side"
          ? await executeServerSideLaunch(draft)
          : await executeWalletApprovedLaunch(draft);
      const nextState: CryptoLaunchDraftState = {
        ...launchState,
        draft: {
          ...draft,
          creatorWallet:
            draft.executionMode === "user_approved" ? outcome.result.creatorPublicKey : draft.creatorWallet,
        },
        conversation: {
          active: false,
          agentId: null,
          awaitingField: null,
          lastUpdatedAt: Date.now(),
        },
        lastPrepared: outcome.prepared,
        lastResult: outcome.result,
      };
      persistState(nextState);
      return outcome.result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to complete the Pump.fun launch.";
      setLaunchError(message);
      throw error;
    } finally {
      setLaunchBusy(false);
    }
  }, [launchState, persistState]);

  return {
    launchState,
    draft: launchState.draft,
    conversation: launchState.conversation,
    lastPrepared: launchState.lastPrepared,
    lastResult: launchState.lastResult,
    launchBusy,
    launchError,
    setDraft,
    setConversation,
    resetDraft,
    submitLaunch,
    clearLaunchError: () => setLaunchError(null),
  };
}
