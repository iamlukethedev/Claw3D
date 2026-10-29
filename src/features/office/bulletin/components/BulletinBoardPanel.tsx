"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  filterBulletinCards,
  groupBulletinCards,
  type BulletinAuthorFilter,
} from "@/features/office/bulletin/bulletinBoard";
import { BULLETIN_TYPE_THEME } from "@/features/office/bulletin/bulletinTheme";
import {
  BulletinCardComposer,
  type BulletinComposerAgent,
} from "@/features/office/bulletin/components/BulletinCardComposer";
import {
  BulletinCardView,
  type BulletinLinkedTask,
} from "@/features/office/bulletin/components/BulletinCardView";
import { BULLETIN_CARD_TYPES, type BulletinCard, type BulletinCardType } from "@/features/office/bulletin/types";
import type { BulletinBoardController } from "@/features/office/bulletin/useBulletinBoard";

type BulletinBoardPanelProps = {
  board: BulletinBoardController;
  agents: BulletinComposerAgent[];
  tasksById: Record<string, BulletinLinkedTask>;
  onClose: () => void;
  onOpenAgent: (agentId: string) => void;
  onOpenTask: (taskId: string) => void;
};

type ComposerState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; card: BulletinCard };

const AUTHOR_OPTIONS: Array<{ value: BulletinAuthorFilter; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "human", label: "People" },
  { value: "agent", label: "Agents" },
  { value: "system", label: "Automations" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keep Tab and Shift+Tab inside the dialog so focus never reaches the 3D scene.
const trapFocus = (event: KeyboardEvent, container: HTMLElement | null): void => {
  if (!container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const outside = !(active instanceof Node) || !container.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
};

// Lanes with more cards than this span two columns.
const BUSY_LANE_CARDS = 4;

// Re-render relative timestamps once a minute while the board is open.
const CLOCK_TICK_MS = 60_000;

const useMinuteClock = (): number => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return nowMs;
};

function StatPill({ tone, value, label }: { tone: string; value: number; label: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>
      <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

function BoardMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="bulletin-paper max-w-md -rotate-1 rounded-[3px] bg-[#fffbea] px-6 py-6 text-center text-stone-700">
        <span aria-hidden="true" className="bulletin-tape absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2" />
        <p className="bulletin-display text-3xl tracking-[0.04em] text-stone-900">{title}</p>
        <div className="mt-2 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function BulletinBoardPanel({
  board,
  agents,
  tasksById,
  onClose,
  onOpenAgent,
  onOpenTask,
}: BulletinBoardPanelProps) {
  const nowMs = useMinuteClock();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [composer, setComposer] = useState<ComposerState>({ mode: "closed" });
  const [types, setTypes] = useState<BulletinCardType[]>([]);
  const [author, setAuthor] = useState<BulletinAuthorFilter>("all");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.agentId, agent.name])),
    [agents],
  );

  const groups = useMemo(
    () => groupBulletinCards(filterBulletinCards(board.cards, { types, author, query, includeArchived })),
    [author, board.cards, includeArchived, query, types],
  );
  const filtersActive = types.length > 0 || author !== "all" || query.trim().length > 0;
  const { summary } = board;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        trapFocus(event, dialogRef.current);
        return;
      }
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (composer.mode !== "closed") {
        setComposer({ mode: "closed" });
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [composer.mode, onClose]);

  const toggleType = (type: BulletinCardType) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    );
  };

  const resetFilters = () => {
    setTypes([]);
    setAuthor("all");
    setQuery("");
  };

  const renderBody = () => {
    if (board.status === "unavailable") {
      return (
        <BoardMessage title="No runtime connected">
          Connect to a runtime to use the office board. Each runtime keeps its own board.
        </BoardMessage>
      );
    }
    if (board.status === "loading") {
      return (
        <div role="status" className="flex min-h-[40vh] items-center justify-center font-mono text-xs uppercase tracking-[0.2em] text-amber-100/70">
          Loading the board…
        </div>
      );
    }
    if (board.status === "error") {
      return (
        <BoardMessage title="The board didn't load">
          <p>{board.error}</p>
          <p className="mt-1 text-stone-500">Nothing was changed. Your notes are still saved.</p>
          <button
            type="button"
            onClick={board.reload}
            className="mt-4 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Try again
          </button>
        </BoardMessage>
      );
    }
    if (board.cards.length === 0) {
      return (
        <BoardMessage title="The board is clear">
          <p>Pin the goals, announcements, and handoffs the whole office should see.</p>
          <p className="mt-1 text-stone-500">
            Blocked Kanban tasks and standup summaries show up here on their own.
          </p>
          <button
            type="button"
            onClick={() => setComposer({ mode: "create" })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Pin the first note
          </button>
        </BoardMessage>
      );
    }
    if (groups.length === 0 && summary.active === 0 && !includeArchived && !filtersActive) {
      return (
        <BoardMessage title="Everything is archived">
          <p>All notes on this board have been archived.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setIncludeArchived(true)}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
            >
              Show archived
            </button>
            <button
              type="button"
              onClick={() => setComposer({ mode: "create" })}
              className="rounded-md border border-stone-900/30 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-900/8"
            >
              Pin a new note
            </button>
          </div>
        </BoardMessage>
      );
    }
    if (groups.length === 0) {
      return (
        <BoardMessage title="Nothing matches">
          <p>No notes match these filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Clear filters
          </button>
        </BoardMessage>
      );
    }
    return (
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 px-4 pb-10 pt-5 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const isBusy = group.cards.length > BUSY_LANE_CARDS;
          return (
            <section
              key={group.key}
              aria-labelledby={`bulletin-group-${group.key}`}
              className={isBusy ? "md:col-span-2" : undefined}
            >
              <h3
                id={`bulletin-group-${group.key}`}
                className="bulletin-label mb-4 inline-flex items-center gap-2 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-800"
              >
                {group.label}
                <span className="tabular-nums text-stone-500">{group.cards.length}</span>
              </h3>
              <div className={`grid grid-cols-1 gap-x-5 gap-y-6 ${isBusy ? "sm:grid-cols-2" : ""}`}>
                {group.cards.map((card) => (
                  <BulletinCardView
                    key={card.id}
                    card={card}
                    nowMs={nowMs}
                    agentName={card.agentId ? (agentNameById.get(card.agentId) ?? null) : null}
                    linkedTask={card.taskId ? (tasksById[card.taskId] ?? null) : null}
                    onEdit={(target) => setComposer({ mode: "edit", card: target })}
                    onTogglePinned={(target) => board.setPinned(target.id, !target.pinned)}
                    onToggleArchived={(target) => board.setArchived(target.id, !target.archived)}
                    onOpenAgent={onOpenAgent}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-6"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || composer.mode !== "closed") return;
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulletin-board-title"
        // The office binds Space, arrows, Delete, and [ ] on window; typing
        // or pressing buttons here must not move or delete furniture.
        onKeyDown={(event) => event.stopPropagation()}
        className="bulletin-frame relative flex h-full max-h-[920px] w-full max-w-7xl flex-col overflow-hidden rounded-lg"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/30 bg-stone-950/85 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/60">Office signal wall</p>
            <h2 id="bulletin-board-title" className="bulletin-display text-[2rem] leading-none tracking-[0.06em] text-amber-50">
              Bulletin Board
            </h2>
          </div>
          {board.status === "ready" ? (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Board summary">
              <StatPill
                tone={summary.blockers > 0 ? "border-rose-400/40 bg-rose-500/15 text-rose-100" : "border-amber-100/10 text-amber-100/50"}
                value={summary.blockers}
                label={summary.blockers === 1 ? "blocker" : "blockers"}
              />
              <StatPill tone="border-emerald-400/30 bg-emerald-500/10 text-emerald-100" value={summary.byType.goal} label="goals" />
              <StatPill tone="border-amber-100/15 text-amber-100/70" value={summary.pinned} label="pinned" />
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={board.status !== "ready"}
              onClick={() => setComposer({ mode: "create" })}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3.5 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Pin a note</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close bulletin board"
              className="flex h-9 w-9 items-center justify-center rounded-md text-amber-100/70 transition hover:bg-amber-100/10 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {board.status === "ready" && board.cards.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-black/30 bg-stone-950/70 px-4 py-2.5 sm:px-6">
            <div
              className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible"
              role="group"
              aria-label="Filter by type"
            >
              {BULLETIN_CARD_TYPES.map((type) => {
                const theme = BULLETIN_TYPE_THEME[type];
                const active = types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleType(type)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                      active ? theme.chip : "border-amber-100/10 text-amber-100/55 hover:border-amber-100/25 hover:text-amber-50"
                    }`}
                  >
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.pin }} />
                    {theme.label}
                    <span className="font-mono tabular-nums opacity-70">{summary.byType[type]}</span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="bulletin-author-filter">
                Author
              </label>
              <select
                id="bulletin-author-filter"
                value={author}
                onChange={(event) => setAuthor(event.target.value as BulletinAuthorFilter)}
                className="rounded-md border border-amber-100/10 bg-black/40 px-2.5 py-1.5 text-xs text-amber-50 outline-none focus:border-amber-300/50"
              >
                {AUTHOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-100/40" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search notes"
                  aria-label="Search notes"
                  className="w-40 rounded-md border border-amber-100/10 bg-black/40 py-1.5 pl-8 pr-2.5 text-xs text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-300/50 sm:w-52"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-amber-100/70">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Archived
              </label>
              {filtersActive ? (
                <button type="button" onClick={resetFilters} className="text-xs text-amber-200/80 underline underline-offset-2 hover:text-amber-50">
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="bulletin-cork relative min-h-0 flex-1 overflow-y-auto">
          {composer.mode !== "closed" ? (
            <div className="sticky top-0 z-20 px-4 pt-4 sm:px-6">
              <div className="mx-auto max-w-2xl">
                <BulletinCardComposer
                  key={composer.mode === "edit" ? composer.card.id : "new"}
                  card={composer.mode === "edit" ? composer.card : null}
                  agents={agents}
                  onCreate={board.addCard}
                  onUpdate={board.editCard}
                  onDone={() => setComposer({ mode: "closed" })}
                />
              </div>
            </div>
          ) : null}
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
