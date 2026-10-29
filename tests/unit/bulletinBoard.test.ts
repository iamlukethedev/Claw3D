import { describe, expect, it } from "vitest";

import {
  addBulletinCard,
  capBulletinCards,
  editBulletinCard,
  filterBulletinCards,
  groupBulletinCards,
  isStandupMeetingForFleet,
  reconcileStandupMeeting,
  reconcileTaskBlockers,
  setBulletinCardArchived,
  setBulletinCardPinned,
  summarizeBulletinBoard,
  type BulletinContext,
  type BulletinTaskSignal,
} from "@/features/office/bulletin/bulletinBoard";
import {
  BULLETIN_LIMITS,
  normalizeBulletinBoardPreference,
  type BulletinCard,
} from "@/features/office/bulletin/types";
import type { StandupMeeting } from "@/lib/office/standup/types";

const NOW = "2026-10-29T12:00:00.000Z";

const makeContext = (now = NOW): BulletinContext => {
  let counter = 0;
  return {
    now,
    createId: () => {
      counter += 1;
      return `card-${counter}`;
    },
  };
};

const makeCard = (overrides: Partial<BulletinCard> = {}): BulletinCard => ({
  id: "card-x",
  type: "announcement",
  title: "Hello office",
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

const makeMeeting = (overrides: Partial<StandupMeeting> = {}): StandupMeeting => ({
  id: "meeting-1",
  trigger: "manual",
  phase: "gathering",
  scheduledFor: null,
  startedAt: "2026-10-29T11:50:00.000Z",
  updatedAt: "2026-10-29T11:50:00.000Z",
  completedAt: null,
  currentSpeakerAgentId: null,
  speakerStartedAt: null,
  speakerDurationMs: 8000,
  participantOrder: ["agent-a", "agent-b"],
  arrivedAgentIds: [],
  cards: [
    {
      agentId: "agent-a",
      agentName: "Alice",
      speech: "",
      currentTask: "Ship Hermes adapter",
      blockers: [],
      recentCommits: [],
      activeTickets: [],
      manualNotes: [],
      sourceStates: [],
    },
    {
      agentId: "agent-b",
      agentName: "Bob",
      speech: "",
      currentTask: "",
      blockers: ["Waiting on staging gateway token", "Needs design signoff"],
      recentCommits: [],
      activeTickets: [],
      manualNotes: [],
      sourceStates: [],
    },
  ],
  ...overrides,
});

const blockedTask = (overrides: Partial<BulletinTaskSignal> = {}): BulletinTaskSignal => ({
  id: "task-1",
  title: "Fix gateway auth on staging",
  description: "401 from upstream",
  status: "blocked",
  assignedAgentId: "agent-a",
  isArchived: false,
  ...overrides,
});

describe("bulletin board normalization", () => {
  it("drops_cards_without_ids_or_known_types_and_fills_defaults", () => {
    const preference = normalizeBulletinBoardPreference({
      cards: [
        { id: "a", type: "goal", title: "  Ship v1  " },
        { id: "", type: "goal", title: "No id" },
        { id: "b", type: "mystery", title: "Unknown type" },
        "garbage",
      ],
    });

    expect(preference.cards).toHaveLength(1);
    expect(preference.cards[0]).toEqual(
      expect.objectContaining({
        id: "a",
        type: "goal",
        title: "Ship v1",
        body: "",
        authorType: "human",
        pinned: false,
        archived: false,
        archivedBy: null,
        priority: "normal",
        tags: [],
        sourceKey: null,
      }),
    );
  });

  it("clamps_text_fields_and_tags_to_limits", () => {
    const preference = normalizeBulletinBoardPreference({
      cards: [
        {
          id: "a",
          type: "announcement",
          title: "x".repeat(500),
          body: "y".repeat(5000),
          tags: ["one", "one", " two ", "", 42, "z".repeat(80), "3", "4", "5", "6", "7", "8", "9"],
        },
      ],
    });
    const card = preference.cards[0]!;

    expect(card.title).toHaveLength(BULLETIN_LIMITS.titleMax);
    expect(card.body).toHaveLength(BULLETIN_LIMITS.bodyMax);
    expect(card.tags).toHaveLength(BULLETIN_LIMITS.tagsMax);
    expect(card.tags.slice(0, 3)).toEqual(["one", "two", "z".repeat(BULLETIN_LIMITS.tagLengthMax)]);
  });

  it("returns_an_empty_board_for_non_record_input", () => {
    expect(normalizeBulletinBoardPreference(null)).toEqual({ cards: [], updatedAt: null });
  });
});

describe("bulletin board authoring", () => {
  it("adds_a_trimmed_human_card", () => {
    const result = addBulletinCard(
      [],
      { type: "goal", title: "  Ship Hermes support ", body: " by Friday ", tags: ["release", "release"] },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card).toEqual(
      expect.objectContaining({
        id: "card-1",
        type: "goal",
        title: "Ship Hermes support",
        body: "by Friday",
        authorType: "human",
        createdAt: NOW,
        updatedAt: NOW,
        tags: ["release"],
      }),
    );
    expect(result.cards).toEqual([result.card]);
  });

  it("rejects_cards_without_a_title", () => {
    const result = addBulletinCard([], { type: "goal", title: "   " }, makeContext());
    expect(result).toEqual({ ok: false, error: "A card needs a title." });
  });

  it("edits_human_cards_and_bumps_updated_at", () => {
    const card = makeCard({ id: "a" });
    const result = editBulletinCard([card], "a", { title: "Renamed", priority: "high" }, makeContext());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card).toEqual(
      expect.objectContaining({ title: "Renamed", priority: "high", updatedAt: NOW }),
    );
  });

  it("refuses_to_edit_system_cards", () => {
    const card = makeCard({ id: "a", authorType: "system" });
    const result = editBulletinCard([card], "a", { title: "Tampered" }, makeContext());
    expect(result).toEqual({ ok: false, error: "System cards are read-only. Archive it instead." });
  });

  it("reports_missing_cards", () => {
    const result = editBulletinCard([], "nope", { title: "x" }, makeContext());
    expect(result).toEqual({ ok: false, error: "Card not found." });
  });

  it("pins_and_unpins_any_card_including_system_cards", () => {
    const card = makeCard({ id: "a", authorType: "system" });
    const pinned = setBulletinCardPinned([card], "a", true, makeContext());
    expect(pinned[0]).toEqual(expect.objectContaining({ pinned: true, updatedAt: NOW }));
    expect(setBulletinCardPinned(pinned, "a", false, makeContext())[0]?.pinned).toBe(false);
  });

  it("archiving_unpins_and_records_a_human_archive", () => {
    const card = makeCard({ id: "a", pinned: true });
    const archived = setBulletinCardArchived([card], "a", true, makeContext());
    expect(archived[0]).toEqual(
      expect.objectContaining({ archived: true, archivedBy: "human", pinned: false }),
    );
    const restored = setBulletinCardArchived(archived, "a", false, makeContext());
    expect(restored[0]).toEqual(expect.objectContaining({ archived: false, archivedBy: null }));
  });

  it("returns_the_same_array_when_a_toggle_is_a_no_op", () => {
    const cards = [makeCard({ id: "a", pinned: true })];
    expect(setBulletinCardPinned(cards, "a", true, makeContext())).toBe(cards);
    expect(setBulletinCardArchived(cards, "missing", true, makeContext())).toBe(cards);
  });
});

describe("bulletin board views", () => {
  const cards = [
    makeCard({ id: "pinned-goal", type: "goal", pinned: true, updatedAt: "2026-10-29T09:00:00.000Z" }),
    makeCard({ id: "blocker-low", type: "blocker", priority: "low", updatedAt: "2026-10-29T11:00:00.000Z" }),
    makeCard({ id: "blocker-high", type: "blocker", priority: "high", updatedAt: "2026-10-29T08:00:00.000Z" }),
    makeCard({ id: "news-old", type: "announcement", updatedAt: "2026-10-29T07:00:00.000Z" }),
    makeCard({ id: "news-new", type: "announcement", updatedAt: "2026-10-29T11:30:00.000Z", authorType: "agent", agentId: "agent-a", authorName: "Alice" }),
    makeCard({ id: "minutes", type: "meeting_note", authorType: "system", title: "Standup summary" }),
    makeCard({ id: "handoff", type: "handoff", body: "Backend done, over to QA" }),
    makeCard({ id: "old", type: "goal", archived: true, archivedBy: "human" }),
  ];

  it("groups_by_information_hierarchy_with_pinned_first_and_high_priority_on_top", () => {
    const groups = groupBulletinCards(cards);

    // The only active goal is pinned, so there is no separate "goal" group.
    expect(groups.map((group) => group.key)).toEqual([
      "pinned",
      "blocker",
      "announcement",
      "handoff",
      "meeting_note",
      "archived",
    ]);
    expect(groups[0]?.cards.map((card) => card.id)).toEqual(["pinned-goal"]);
    expect(groups[1]?.cards.map((card) => card.id)).toEqual(["blocker-high", "blocker-low"]);
    expect(groups[2]?.cards.map((card) => card.id)).toEqual(["news-new", "news-old"]);
    expect(groups[5]?.cards.map((card) => card.id)).toEqual(["old"]);
  });

  it("omits_empty_groups", () => {
    const groups = groupBulletinCards([makeCard({ id: "only", type: "handoff" })]);
    expect(groups.map((group) => group.key)).toEqual(["handoff"]);
  });

  it("filters_by_type_author_query_and_archive_state", () => {
    expect(filterBulletinCards(cards, { types: ["blocker"] }).map((card) => card.id)).toEqual([
      "blocker-low",
      "blocker-high",
    ]);
    expect(filterBulletinCards(cards, { author: "agent" }).map((card) => card.id)).toEqual(["news-new"]);
    expect(filterBulletinCards(cards, { author: "system" }).map((card) => card.id)).toEqual(["minutes"]);
    expect(filterBulletinCards(cards, { query: "qa" }).map((card) => card.id)).toEqual(["handoff"]);
    expect(filterBulletinCards(cards, { query: "alice" }).map((card) => card.id)).toEqual(["news-new"]);
    expect(filterBulletinCards(cards, {}).some((card) => card.id === "old")).toBe(false);
    expect(
      filterBulletinCards(cards, { includeArchived: true }).some((card) => card.id === "old"),
    ).toBe(true);
  });

  it("summarizes_active_cards_for_the_in_world_prop", () => {
    const summary = summarizeBulletinBoard(cards);

    expect(summary.active).toBe(7);
    expect(summary.pinned).toBe(1);
    expect(summary.blockers).toBe(2);
    expect(summary.highPriorityBlockers).toBe(1);
    expect(summary.byType).toEqual({
      goal: 1,
      announcement: 2,
      blocker: 2,
      handoff: 1,
      meeting_note: 1,
    });
    expect(summary.highlights.map((highlight) => highlight.id)).toEqual([
      "pinned-goal",
      "blocker-high",
      "blocker-low",
      "news-new",
      "news-old",
      "handoff",
      "minutes",
    ]);
  });
});

describe("bulletin board capacity", () => {
  it("drops_oldest_archived_cards_before_active_ones", () => {
    const cards = [
      makeCard({ id: "active-1" }),
      makeCard({ id: "archived-old", archived: true, updatedAt: "2026-10-01T00:00:00.000Z" }),
      makeCard({ id: "archived-new", archived: true, updatedAt: "2026-10-28T00:00:00.000Z" }),
      makeCard({ id: "active-2" }),
    ];

    expect(capBulletinCards(cards, 3).map((card) => card.id)).toEqual([
      "active-1",
      "archived-new",
      "active-2",
    ]);
    expect(capBulletinCards(cards, 10)).toBe(cards);
  });

  it("evicts_plain_archived_cards_before_archived_automation_cards", () => {
    const cards = [
      makeCard({ id: "auto-old", archived: true, authorType: "system", sourceKey: "task-blocked:t1", updatedAt: "2026-09-01T00:00:00.000Z" }),
      makeCard({ id: "plain-new", archived: true, updatedAt: "2026-10-28T00:00:00.000Z" }),
      makeCard({ id: "active" }),
    ];

    // Automation cards double as "already posted" markers, so they go last.
    expect(capBulletinCards(cards, 2).map((card) => card.id)).toEqual(["auto-old", "active"]);
  });

  it("normalization_applies_the_same_eviction_policy", () => {
    const cards = Array.from({ length: BULLETIN_LIMITS.cardsMax + 1 }, (_, index) =>
      makeCard({ id: `c-${index}`, archived: index === BULLETIN_LIMITS.cardsMax, archivedBy: "human" }),
    );
    const normalized = normalizeBulletinBoardPreference({ cards });
    expect(normalized.cards).toHaveLength(BULLETIN_LIMITS.cardsMax);
    expect(normalized.cards.some((card) => card.archived)).toBe(false);
  });
});

describe("bulletin board task blocker automation", () => {
  it("creates_one_system_blocker_card_per_blocked_task", () => {
    const next = reconcileTaskBlockers([], [blockedTask(), blockedTask({ id: "task-2", status: "todo" })], makeContext());

    expect(next).toHaveLength(1);
    expect(next[0]).toEqual(
      expect.objectContaining({
        type: "blocker",
        authorType: "system",
        title: "Blocked: Fix gateway auth on staging",
        body: "401 from upstream",
        taskId: "task-1",
        agentId: "agent-a",
        priority: "high",
        sourceKey: "task-blocked:task-1",
        tags: ["kanban"],
      }),
    );
  });

  it("is_idempotent_and_returns_the_same_array_when_nothing_changes", () => {
    const once = reconcileTaskBlockers([], [blockedTask()], makeContext());
    const twice = reconcileTaskBlockers(once, [blockedTask()], makeContext());
    expect(twice).toBe(once);
  });

  it("auto_archives_when_the_task_is_unblocked_and_reopens_when_blocked_again", () => {
    const created = reconcileTaskBlockers([], [blockedTask()], makeContext());
    const resolved = reconcileTaskBlockers(created, [blockedTask({ status: "in_progress" })], makeContext());
    expect(resolved[0]).toEqual(expect.objectContaining({ archived: true, archivedBy: "system" }));

    const reblocked = reconcileTaskBlockers(resolved, [blockedTask()], makeContext());
    expect(reblocked[0]).toEqual(expect.objectContaining({ archived: false, archivedBy: null }));
  });

  it("auto_archives_when_the_task_disappears_or_is_archived", () => {
    const created = reconcileTaskBlockers([], [blockedTask()], makeContext());
    expect(reconcileTaskBlockers(created, [], makeContext())[0]?.archived).toBe(true);
    expect(
      reconcileTaskBlockers(created, [blockedTask({ isArchived: true })], makeContext())[0]?.archived,
    ).toBe(true);
  });

  it("never_reopens_a_card_a_human_archived", () => {
    const created = reconcileTaskBlockers([], [blockedTask()], makeContext());
    const humanArchived = setBulletinCardArchived(created, created[0]!.id, true, makeContext());
    const next = reconcileTaskBlockers(humanArchived, [blockedTask()], makeContext());
    expect(next).toBe(humanArchived);
  });

  it("leaves_human_cards_untouched", () => {
    const human = [makeCard({ id: "mine", type: "blocker", taskId: "task-1" })];
    const next = reconcileTaskBlockers(human, [], makeContext());
    expect(next).toBe(human);
  });
});

describe("bulletin board standup automation", () => {
  it("posts_a_live_announcement_while_the_standup_is_running", () => {
    const next = reconcileStandupMeeting([], makeMeeting({ phase: "in_progress" }), makeContext());

    expect(next).toHaveLength(1);
    expect(next[0]).toEqual(
      expect.objectContaining({
        type: "announcement",
        authorType: "system",
        title: "Standup in progress",
        body: "2 agents in the meeting room: Alice, Bob.",
        sourceKey: "standup-live:meeting-1",
        tags: ["standup"],
      }),
    );
    expect(reconcileStandupMeeting(next, makeMeeting({ phase: "in_progress" }), makeContext())).toBe(next);
  });

  it("archives_the_live_announcement_and_posts_minutes_and_blockers_when_complete", () => {
    const live = reconcileStandupMeeting([], makeMeeting({ phase: "gathering" }), makeContext());
    const complete = makeMeeting({ phase: "complete", completedAt: "2026-10-29T11:58:00.000Z" });
    const next = reconcileStandupMeeting(live, complete, makeContext());

    const announcement = next.find((card) => card.sourceKey === "standup-live:meeting-1");
    expect(announcement).toEqual(expect.objectContaining({ archived: true, archivedBy: "system" }));

    const minutes = next.find((card) => card.sourceKey === "standup-minutes:meeting-1");
    expect(minutes).toEqual(
      expect.objectContaining({
        type: "meeting_note",
        title: "Standup summary · 2026-10-29",
        body: [
          "Alice — Ship Hermes adapter",
          "Bob — No current task reported (blocked: Waiting on staging gateway token; Needs design signoff)",
        ].join("\n"),
      }),
    );

    const blocker = next.find((card) => card.sourceKey === "standup-blocker:meeting-1:agent-b");
    expect(blocker).toEqual(
      expect.objectContaining({
        type: "blocker",
        title: "Bob: Waiting on staging gateway token",
        body: "Waiting on staging gateway token\nNeeds design signoff",
        agentId: "agent-b",
        priority: "high",
      }),
    );
    expect(next.filter((card) => card.type === "blocker")).toHaveLength(1);

    expect(reconcileStandupMeeting(next, complete, makeContext())).toBe(next);
  });

  it("ignores_meetings_completed_more_than_a_day_ago", () => {
    const stale = makeMeeting({ phase: "complete", completedAt: "2026-10-27T09:00:00.000Z" });
    const cards: BulletinCard[] = [];
    expect(reconcileStandupMeeting(cards, stale, makeContext())).toBe(cards);
  });

  it("reopens_a_live_announcement_the_system_archived_while_the_meeting_was_unknown", () => {
    const live = reconcileStandupMeeting([], makeMeeting({ phase: "gathering" }), makeContext());
    const lost = reconcileStandupMeeting(live, null, makeContext());
    const back = reconcileStandupMeeting(lost, makeMeeting({ phase: "in_progress" }), makeContext());
    expect(back[0]).toEqual(expect.objectContaining({ archived: false, archivedBy: null }));

    const humanArchived = setBulletinCardArchived(back, back[0]!.id, true, makeContext());
    expect(reconcileStandupMeeting(humanArchived, makeMeeting({ phase: "in_progress" }), makeContext())).toBe(
      humanArchived,
    );
  });

  it("matches_meetings_to_the_current_fleet_by_participant", () => {
    expect(isStandupMeetingForFleet(makeMeeting(), ["agent-b", "agent-z"])).toBe(true);
    expect(isStandupMeetingForFleet(makeMeeting(), ["agent-z"])).toBe(false);
    expect(isStandupMeetingForFleet(makeMeeting({ participantOrder: [] }), ["agent-a"])).toBe(false);
  });

  it("archives_a_dangling_live_announcement_when_no_meeting_is_active", () => {
    const live = reconcileStandupMeeting([], makeMeeting({ phase: "gathering" }), makeContext());
    const next = reconcileStandupMeeting(live, null, makeContext());
    expect(next[0]).toEqual(expect.objectContaining({ archived: true, archivedBy: "system" }));
  });
});
