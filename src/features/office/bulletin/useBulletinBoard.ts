"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addBulletinCard,
  editBulletinCard,
  reconcileStandupMeeting,
  reconcileTaskBlockers,
  setBulletinCardArchived,
  setBulletinCardPinned,
  summarizeBulletinBoard,
  type BulletinBoardSummary,
  type BulletinCardChanges,
  type BulletinCardDraft,
  type BulletinContext,
  type BulletinMutationResult,
  type BulletinTaskSignal,
} from "@/features/office/bulletin/bulletinBoard";
import type { BulletinCard } from "@/features/office/bulletin/types";
import type { StudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { resolveBulletinBoardPreference } from "@/lib/studio/settings";
import type { StandupMeeting } from "@/lib/office/standup/types";

export type BulletinBoardStatus = "unavailable" | "loading" | "ready" | "error";

type BoardState = {
  // Gateway the cards belong to; a mismatch with the current gateway means
  // the board is still loading.
  gatewayKey: string | null;
  cards: BulletinCard[];
  error: string | null;
};

type UseBulletinBoardParams = {
  gatewayUrl: string;
  settingsCoordinator: Pick<StudioSettingsCoordinator, "loadSettings" | "schedulePatch">;
  tasks: BulletinTaskSignal[];
  // False until the task board has hydrated; an empty list before then would
  // otherwise read as "every blocked task was resolved".
  tasksReady?: boolean;
  standupMeeting: StandupMeeting | null;
  standupReady?: boolean;
};

export type BulletinBoardController = {
  status: BulletinBoardStatus;
  error: string | null;
  cards: BulletinCard[];
  summary: BulletinBoardSummary;
  addCard: (draft: BulletinCardDraft) => BulletinMutationResult;
  editCard: (id: string, changes: BulletinCardChanges) => BulletinMutationResult;
  setPinned: (id: string, pinned: boolean) => void;
  setArchived: (id: string, archived: boolean) => void;
  reload: () => void;
};

const PERSIST_DEBOUNCE_MS = 150;
const EMPTY_CARDS: BulletinCard[] = [];
const NOT_READY: BulletinMutationResult = {
  ok: false,
  error: "The board is not ready yet.",
};

const createId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `bulletin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const createContext = (): BulletinContext => ({
  now: new Date().toISOString(),
  createId,
});

type AutomationSignals = {
  tasks: BulletinTaskSignal[] | null;
  standupMeeting: StandupMeeting | null | undefined;
};

// `null`/`undefined` signals are not loaded yet and are skipped.
const applyAutomation = (cards: BulletinCard[], signals: AutomationSignals): BulletinCard[] => {
  const context = createContext();
  const withTasks = signals.tasks ? reconcileTaskBlockers(cards, signals.tasks, context) : cards;
  return signals.standupMeeting === undefined
    ? withTasks
    : reconcileStandupMeeting(withTasks, signals.standupMeeting, context);
};

/**
 * Bulletin board state for the current gateway: loads cards from Studio
 * settings, mirrors Kanban blockers and standup output onto the board, and
 * persists every change back through the settings coordinator.
 */
export const useBulletinBoard = ({
  gatewayUrl,
  settingsCoordinator,
  tasks,
  tasksReady = true,
  standupMeeting,
  standupReady = true,
}: UseBulletinBoardParams): BulletinBoardController => {
  const gatewayKey = gatewayUrl.trim();
  const [board, setBoard] = useState<BoardState>({ gatewayKey: null, cards: EMPTY_CARDS, error: null });
  const [reloadToken, setReloadToken] = useState(0);
  // Cards last written (or read) for the loaded gateway; skips echo writes.
  const persistedCardsRef = useRef<BulletinCard[] | null>(null);

  const isCurrent = Boolean(gatewayKey) && board.gatewayKey === gatewayKey;
  const status: BulletinBoardStatus = !gatewayKey
    ? "unavailable"
    : !isCurrent
      ? "loading"
      : board.error
        ? "error"
        : "ready";

  useEffect(() => {
    if (!gatewayKey) return;
    let cancelled = false;
    settingsCoordinator
      .loadSettings({ maxAgeMs: 0 })
      .then((settings) => {
        if (cancelled) return;
        const preference = settings
          ? resolveBulletinBoardPreference(settings, gatewayKey)
          : { cards: EMPTY_CARDS, updatedAt: null };
        persistedCardsRef.current = preference.cards;
        setBoard({ gatewayKey, cards: preference.cards, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Failed to load bulletin board.", error);
        // Keep the board read-only so an empty list never overwrites stored cards.
        persistedCardsRef.current = null;
        setBoard({
          gatewayKey,
          cards: EMPTY_CARDS,
          error: error instanceof Error ? error.message : "Failed to load the bulletin board.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [gatewayKey, reloadToken, settingsCoordinator]);

  // Automation runs during render (React's "adjust state on prop change"
  // pattern). The reconcilers return the same array when nothing changed,
  // so this settles after at most one extra render.
  if (status === "ready") {
    const automated = applyAutomation(board.cards, {
      tasks: tasksReady ? tasks : null,
      standupMeeting: standupReady ? standupMeeting : undefined,
    });
    if (automated !== board.cards) {
      setBoard({ ...board, cards: automated });
    }
  }

  useEffect(() => {
    if (!isCurrent || board.error || !board.gatewayKey) return;
    if (persistedCardsRef.current === board.cards) return;
    persistedCardsRef.current = board.cards;
    settingsCoordinator.schedulePatch(
      {
        bulletinBoard: {
          [board.gatewayKey]: {
            cards: board.cards,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      PERSIST_DEBOUNCE_MS,
    );
  }, [board, isCurrent, settingsCoordinator]);

  const cards = status === "ready" ? board.cards : EMPTY_CARDS;

  const commitCards = useCallback((next: BulletinCard[]) => {
    setBoard((current) => (current.cards === next ? current : { ...current, cards: next }));
  }, []);

  const addCard = useCallback(
    (draft: BulletinCardDraft): BulletinMutationResult => {
      if (status !== "ready") return NOT_READY;
      const result = addBulletinCard(board.cards, draft, createContext());
      if (result.ok) commitCards(result.cards);
      return result;
    },
    [board.cards, commitCards, status],
  );

  const editCard = useCallback(
    (id: string, changes: BulletinCardChanges): BulletinMutationResult => {
      if (status !== "ready") return NOT_READY;
      const result = editBulletinCard(board.cards, id, changes, createContext());
      if (result.ok) commitCards(result.cards);
      return result;
    },
    [board.cards, commitCards, status],
  );

  const setPinned = useCallback(
    (id: string, pinned: boolean) => {
      if (status !== "ready") return;
      commitCards(setBulletinCardPinned(board.cards, id, pinned, createContext()));
    },
    [board.cards, commitCards, status],
  );

  const setArchived = useCallback(
    (id: string, archived: boolean) => {
      if (status !== "ready") return;
      commitCards(setBulletinCardArchived(board.cards, id, archived, createContext()));
    },
    [board.cards, commitCards, status],
  );

  const reload = useCallback(() => {
    setBoard({ gatewayKey: null, cards: EMPTY_CARDS, error: null });
    setReloadToken((token) => token + 1);
  }, []);

  const summary = useMemo(() => summarizeBulletinBoard(cards), [cards]);

  return {
    status,
    error: status === "error" ? board.error : null,
    cards,
    summary,
    addCard,
    editCard,
    setPinned,
    setArchived,
    reload,
  };
};
