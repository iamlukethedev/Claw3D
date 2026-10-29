import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { summarizeBulletinBoard } from "@/features/office/bulletin/bulletinBoard";
import { BulletinBoardPanel } from "@/features/office/bulletin/components/BulletinBoardPanel";
import type { BulletinCard } from "@/features/office/bulletin/types";
import type { BulletinBoardController } from "@/features/office/bulletin/useBulletinBoard";

const card = (overrides: Partial<BulletinCard>): BulletinCard => ({
  id: "card",
  type: "announcement",
  title: "Untitled",
  body: "",
  createdAt: "2026-10-29T10:00:00.000Z",
  updatedAt: "2026-10-29T10:00:00.000Z",
  authorType: "human",
  authorId: null,
  authorName: null,
  agentId: null,
  sessionKey: null,
  taskId: null,
  pinned: false,
  archived: false,
  archivedBy: null,
  priority: "normal",
  tags: [],
  sourceKey: null,
  ...overrides,
});

const makeBoard = (
  cards: BulletinCard[],
  overrides: Partial<BulletinBoardController> = {},
): BulletinBoardController => ({
  status: "ready",
  error: null,
  cards,
  summary: summarizeBulletinBoard(cards),
  addCard: vi.fn(() => ({ ok: true as const, cards, card: cards[0] ?? card({}) })),
  editCard: vi.fn(() => ({ ok: true as const, cards, card: cards[0] ?? card({}) })),
  setPinned: vi.fn(),
  setArchived: vi.fn(),
  reload: vi.fn(),
  ...overrides,
});

const renderPanel = (board: BulletinBoardController) => {
  const handlers = { onClose: vi.fn(), onOpenAgent: vi.fn(), onOpenTask: vi.fn() };
  render(
    createElement(BulletinBoardPanel, {
      board,
      agents: [{ agentId: "agent-a", name: "Alice" }],
      tasksById: { "task-1": { title: "Fix staging auth", status: "blocked" } },
      ...handlers,
    }),
  );
  return handlers;
};

describe("BulletinBoardPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_groups_in_hierarchy_order_with_a_blocker_summary", () => {
    renderPanel(
      makeBoard([
        card({ id: "goal", type: "goal", title: "Ship v1", pinned: true }),
        card({ id: "blocker", type: "blocker", title: "Staging auth broken", priority: "high" }),
        card({ id: "news", type: "announcement", title: "Release at 5pm" }),
      ]),
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Pinned1", "Blockers1", "Announcements1"]);
    expect(within(screen.getByLabelText("Board summary")).getByText("blocker")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("shows_an_empty_state_that_opens_the_composer", () => {
    const board = makeBoard([]);
    renderPanel(board);

    fireEvent.click(screen.getByRole("button", { name: "Pin the first note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Weekly goal" } });
    fireEvent.click(screen.getByRole("button", { name: "Pin note" }));

    expect(board.addCard).toHaveBeenCalledWith(
      expect.objectContaining({ type: "goal", title: "Weekly goal", pinned: false }),
    );
    expect(screen.queryByRole("button", { name: "Pin note" })).not.toBeInTheDocument();
  });

  it("keeps_the_composer_open_and_shows_validation_errors", () => {
    const board = makeBoard([], {
      addCard: vi.fn(() => ({ ok: false as const, error: "A card needs a title." })),
    });
    renderPanel(board);

    fireEvent.click(screen.getByRole("button", { name: "Pin a note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: " " } });
    fireEvent.submit(screen.getByRole("textbox", { name: "Title" }).closest("form") as HTMLFormElement);

    expect(screen.getByRole("alert")).toHaveTextContent("A card needs a title.");
  });

  it("filters_by_type_and_clears_filters", () => {
    renderPanel(
      makeBoard([
        card({ id: "blocker", type: "blocker", title: "Staging auth broken" }),
        card({ id: "news", type: "announcement", title: "Release at 5pm" }),
      ]),
    );

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by type" })).getByRole("button", { name: /Blocker/ }));
    expect(screen.queryByText("Release at 5pm")).not.toBeInTheDocument();
    expect(screen.getByText("Staging auth broken")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Release at 5pm")).toBeInTheDocument();
  });

  it("archives_pins_and_follows_links", () => {
    const board = makeBoard([
      card({
        id: "handoff",
        type: "handoff",
        title: "Backend done",
        agentId: "agent-a",
        taskId: "task-1",
      }),
    ]);
    const handlers = renderPanel(board);

    fireEvent.click(screen.getByRole("button", { name: 'Archive "Backend done"' }));
    expect(board.setArchived).toHaveBeenCalledWith("handoff", true);

    fireEvent.click(screen.getByRole("button", { name: 'Pin "Backend done"' }));
    expect(board.setPinned).toHaveBeenCalledWith("handoff", true);

    fireEvent.click(screen.getByRole("button", { name: "Open chat with Alice" }));
    expect(handlers.onOpenAgent).toHaveBeenCalledWith("agent-a");

    fireEvent.click(screen.getByRole("button", { name: /Kanban · Blocked/ }));
    expect(handlers.onOpenTask).toHaveBeenCalledWith("task-1");
  });

  it("does_not_offer_edit_for_system_cards", () => {
    renderPanel(makeBoard([card({ id: "sys", title: "Standup summary", authorType: "system", authorName: "Standup" })]));
    expect(screen.queryByRole("button", { name: 'Edit "Standup summary"' })).not.toBeInTheDocument();
    expect(screen.getByText(/Standup · auto/)).toBeInTheDocument();
  });

  it("closes_on_escape_and_closes_the_composer_first", () => {
    const handlers = renderPanel(makeBoard([card({ id: "a", title: "Hello" })]));

    fireEvent.click(screen.getByRole("button", { name: "Pin a note" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Pin note" })).not.toBeInTheDocument();
    expect(handlers.onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("explains_an_all_archived_board_and_offers_to_show_the_archive", () => {
    renderPanel(makeBoard([card({ id: "old", title: "Done thing", archived: true, archivedBy: "human" })]));

    fireEvent.click(screen.getByRole("button", { name: "Show archived" }));
    expect(screen.getByText("Done thing")).toBeInTheDocument();
  });

  it("keeps_keystrokes_inside_the_dialog_away_from_office_shortcuts", () => {
    const officeShortcut = vi.fn();
    window.addEventListener("keydown", officeShortcut);
    try {
      renderPanel(makeBoard([card({ id: "a", title: "Hello" })]));
      fireEvent.keyDown(screen.getByRole("button", { name: 'Archive "Hello"' }), { key: " ", code: "Space" });
      expect(officeShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", officeShortcut);
    }
  });

  it("does_not_close_on_backdrop_click_while_a_note_is_being_written", () => {
    const handlers = renderPanel(makeBoard([card({ id: "a", title: "Hello" })]));
    fireEvent.click(screen.getByRole("button", { name: "Pin a note" }));

    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.mouseDown(backdrop);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("offers_a_retry_when_the_board_failed_to_load", () => {
    const board = makeBoard([], { status: "error", error: "disk unavailable" });
    renderPanel(board);

    expect(screen.getByText("disk unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(board.reload).toHaveBeenCalled();
  });
});
