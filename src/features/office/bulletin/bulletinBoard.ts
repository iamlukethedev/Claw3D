// Pure bulletin board operations. Every operation returns the input array
// unchanged (same reference) when nothing changed, so callers can persist on
// reference change without risking write loops.

import type { TaskBoardCard } from "@/features/office/tasks/types";
import type { StandupMeeting } from "@/lib/office/standup/types";
import {
  BULLETIN_CARD_TYPES,
  BULLETIN_LIMITS,
  capBulletinCards,
  clampBulletinText,
  isBulletinCardType,
  isBulletinPriority,
  normalizeBulletinTags,
  type BulletinAuthorType,
  type BulletinCard,
  type BulletinCardType,
  type BulletinPriority,
} from "@/features/office/bulletin/types";

export type BulletinContext = {
  now: string;
  createId: () => string;
};

export type BulletinCardDraft = {
  type: BulletinCardType;
  title: string;
  body?: string;
  priority?: BulletinPriority;
  tags?: string[];
  pinned?: boolean;
  agentId?: string | null;
  sessionKey?: string | null;
  taskId?: string | null;
  authorType?: Exclude<BulletinAuthorType, "system">;
  authorId?: string | null;
  authorName?: string | null;
};

export type BulletinCardChanges = Partial<
  Pick<BulletinCard, "type" | "title" | "body" | "priority" | "tags" | "agentId" | "taskId">
>;

export type BulletinMutationResult =
  | { ok: true; cards: BulletinCard[]; card: BulletinCard }
  | { ok: false; error: string };

export type BulletinTaskSignal = Pick<
  TaskBoardCard,
  "id" | "title" | "description" | "status" | "assignedAgentId" | "isArchived"
>;

export type BulletinAuthorFilter = "all" | BulletinAuthorType;

export type BulletinFilter = {
  types?: BulletinCardType[];
  author?: BulletinAuthorFilter;
  query?: string;
  includeArchived?: boolean;
};

export type BulletinGroupKey = "pinned" | BulletinCardType | "archived";

export type BulletinGroup = {
  key: BulletinGroupKey;
  label: string;
  cards: BulletinCard[];
};

export type BulletinHighlight = Pick<BulletinCard, "id" | "type" | "priority" | "pinned" | "title">;

export type BulletinBoardSummary = {
  active: number;
  pinned: number;
  blockers: number;
  highPriorityBlockers: number;
  byType: Record<BulletinCardType, number>;
  highlights: BulletinHighlight[];
};

const ERROR_TITLE_REQUIRED = "A card needs a title.";
const ERROR_NOT_FOUND = "Card not found.";
const ERROR_SYSTEM_READ_ONLY = "System cards are read-only. Archive it instead.";

const TASK_BLOCKER_PREFIX = "task-blocked:";
const STANDUP_LIVE_PREFIX = "standup-live:";
const STANDUP_MINUTES_PREFIX = "standup-minutes:";
const STANDUP_BLOCKER_PREFIX = "standup-blocker:";
// Minutes for older meetings are not back-filled; the board is a "now" surface.
const STANDUP_MINUTES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Number of cards the in-world prop can render legibly.
export const BULLETIN_PROP_SLOTS = 12;

const GROUP_ORDER: BulletinGroupKey[] = ["pinned", "blocker", "goal", "announcement", "handoff", "meeting_note", "archived"];

export const BULLETIN_GROUP_LABELS: Record<BulletinGroupKey, string> = {
  pinned: "Pinned",
  blocker: "Blockers",
  goal: "Goals",
  announcement: "Announcements",
  handoff: "Handoffs",
  meeting_note: "Meeting notes",
  archived: "Archived",
};

const PRIORITY_RANK: Record<BulletinPriority, number> = { high: 2, normal: 1, low: 0 };

const optionalId = (value: string | null | undefined): string | null => {
  const text = clampBulletinText(value ?? "", 256);
  return text ? text : null;
};

const compareCards = (left: BulletinCard, right: BulletinCard): number => {
  const byPriority = PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority];
  if (byPriority !== 0) return byPriority;
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
};

const replaceCard = (cards: BulletinCard[], next: BulletinCard): BulletinCard[] =>
  cards.map((card) => (card.id === next.id ? next : card));

export { capBulletinCards };

export const addBulletinCard = (
  cards: BulletinCard[],
  draft: BulletinCardDraft,
  context: BulletinContext,
): BulletinMutationResult => {
  const title = clampBulletinText(draft.title, BULLETIN_LIMITS.titleMax);
  if (!title) return { ok: false, error: ERROR_TITLE_REQUIRED };
  if (!isBulletinCardType(draft.type)) return { ok: false, error: "Unknown card type." };
  const card: BulletinCard = {
    id: context.createId(),
    type: draft.type,
    title,
    body: clampBulletinText(draft.body ?? "", BULLETIN_LIMITS.bodyMax),
    createdAt: context.now,
    updatedAt: context.now,
    authorType: draft.authorType ?? "human",
    authorId: optionalId(draft.authorId),
    authorName: clampBulletinText(draft.authorName ?? "", 80) || null,
    agentId: optionalId(draft.agentId),
    sessionKey: optionalId(draft.sessionKey),
    taskId: optionalId(draft.taskId),
    pinned: draft.pinned === true,
    archived: false,
    archivedBy: null,
    priority: draft.priority && isBulletinPriority(draft.priority) ? draft.priority : "normal",
    tags: normalizeBulletinTags(draft.tags ?? []),
    sourceKey: null,
  };
  return { ok: true, card, cards: capBulletinCards([...cards, card]) };
};

export const editBulletinCard = (
  cards: BulletinCard[],
  id: string,
  changes: BulletinCardChanges,
  context: BulletinContext,
): BulletinMutationResult => {
  const current = cards.find((card) => card.id === id);
  if (!current) return { ok: false, error: ERROR_NOT_FOUND };
  if (current.authorType === "system") return { ok: false, error: ERROR_SYSTEM_READ_ONLY };
  const title =
    changes.title === undefined
      ? current.title
      : clampBulletinText(changes.title, BULLETIN_LIMITS.titleMax);
  if (!title) return { ok: false, error: ERROR_TITLE_REQUIRED };
  const card: BulletinCard = {
    ...current,
    type: changes.type && isBulletinCardType(changes.type) ? changes.type : current.type,
    title,
    body:
      changes.body === undefined
        ? current.body
        : clampBulletinText(changes.body, BULLETIN_LIMITS.bodyMax),
    priority:
      changes.priority && isBulletinPriority(changes.priority) ? changes.priority : current.priority,
    tags: changes.tags === undefined ? current.tags : normalizeBulletinTags(changes.tags),
    agentId: changes.agentId === undefined ? current.agentId : optionalId(changes.agentId),
    taskId: changes.taskId === undefined ? current.taskId : optionalId(changes.taskId),
    updatedAt: context.now,
  };
  return { ok: true, card, cards: replaceCard(cards, card) };
};

export const setBulletinCardPinned = (
  cards: BulletinCard[],
  id: string,
  pinned: boolean,
  context: BulletinContext,
): BulletinCard[] => {
  const current = cards.find((card) => card.id === id);
  if (!current || current.pinned === pinned) return cards;
  // Pinning brings an archived card back onto the board.
  return replaceCard(cards, {
    ...current,
    pinned,
    ...(pinned ? { archived: false, archivedBy: null } : {}),
    updatedAt: context.now,
  });
};

export const setBulletinCardArchived = (
  cards: BulletinCard[],
  id: string,
  archived: boolean,
  context: BulletinContext,
): BulletinCard[] => {
  const current = cards.find((card) => card.id === id);
  if (!current || current.archived === archived) return cards;
  return replaceCard(cards, {
    ...current,
    archived,
    archivedBy: archived ? "human" : null,
    pinned: archived ? false : current.pinned,
    updatedAt: context.now,
  });
};

const matchesQuery = (card: BulletinCard, query: string): boolean => {
  const haystack = [card.title, card.body, card.authorName ?? "", ...card.tags]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
};

export const filterBulletinCards = (
  cards: BulletinCard[],
  filter: BulletinFilter,
): BulletinCard[] => {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const types = filter.types && filter.types.length > 0 ? new Set(filter.types) : null;
  const author = filter.author ?? "all";
  return cards.filter((card) => {
    if (!filter.includeArchived && card.archived) return false;
    if (types && !types.has(card.type)) return false;
    if (author !== "all" && card.authorType !== author) return false;
    if (query && !matchesQuery(card, query)) return false;
    return true;
  });
};

const groupKeyFor = (card: BulletinCard): BulletinGroupKey => {
  if (card.archived) return "archived";
  if (card.pinned) return "pinned";
  return card.type;
};

/**
 * Group cards by the spec's information hierarchy: pinned first, then
 * blockers, goals, announcements, handoffs, meeting notes, and archive.
 */
export const groupBulletinCards = (cards: BulletinCard[]): BulletinGroup[] => {
  const buckets = new Map<BulletinGroupKey, BulletinCard[]>();
  for (const card of cards) {
    const key = groupKeyFor(card);
    buckets.set(key, [...(buckets.get(key) ?? []), card]);
  }
  return GROUP_ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) return [];
    return [{ key, label: BULLETIN_GROUP_LABELS[key], cards: [...bucket].sort(compareCards) }];
  });
};

export const summarizeBulletinBoard = (cards: BulletinCard[]): BulletinBoardSummary => {
  const active = cards.filter((card) => !card.archived);
  const byType = Object.fromEntries(BULLETIN_CARD_TYPES.map((type) => [type, 0])) as Record<
    BulletinCardType,
    number
  >;
  for (const card of active) byType[card.type] += 1;
  const blockers = active.filter((card) => card.type === "blocker");
  const highlights = groupBulletinCards(active)
    .flatMap((group) => group.cards)
    .slice(0, BULLETIN_PROP_SLOTS)
    .map(({ id, type, priority, pinned, title }) => ({ id, type, priority, pinned, title }));
  return {
    active: active.length,
    pinned: active.filter((card) => card.pinned).length,
    blockers: blockers.length,
    highPriorityBlockers: blockers.filter((card) => card.priority === "high").length,
    byType,
    highlights,
  };
};

type SystemCardFields = {
  type: BulletinCardType;
  title: string;
  body: string;
  sourceKey: string;
  authorName: string;
  priority: BulletinPriority;
  tags: string[];
  agentId?: string | null;
  taskId?: string | null;
};

const createSystemCard = (fields: SystemCardFields, context: BulletinContext): BulletinCard => ({
  id: context.createId(),
  type: fields.type,
  title: clampBulletinText(fields.title, BULLETIN_LIMITS.titleMax) || "Untitled card",
  body: clampBulletinText(fields.body, BULLETIN_LIMITS.bodyMax),
  createdAt: context.now,
  updatedAt: context.now,
  authorType: "system",
  authorId: null,
  authorName: fields.authorName,
  agentId: fields.agentId ?? null,
  sessionKey: null,
  taskId: fields.taskId ?? null,
  pinned: false,
  archived: false,
  archivedBy: null,
  priority: fields.priority,
  tags: fields.tags,
  sourceKey: fields.sourceKey,
});

const archiveBySystem = (card: BulletinCard, context: BulletinContext): BulletinCard => ({
  ...card,
  archived: true,
  archivedBy: "system",
  pinned: false,
  updatedAt: context.now,
});

const isSystemCardWithPrefix = (card: BulletinCard, prefix: string): card is BulletinCard & { sourceKey: string } =>
  card.authorType === "system" && typeof card.sourceKey === "string" && card.sourceKey.startsWith(prefix);

const taskBlockerContent = (task: BulletinTaskSignal) => ({
  title: clampBulletinText(`Blocked: ${task.title}`, BULLETIN_LIMITS.titleMax),
  body: clampBulletinText(task.description, BULLETIN_LIMITS.bodyMax),
  agentId: task.assignedAgentId ?? null,
});

/**
 * Mirror blocked Kanban tasks as system blocker cards. Cards are archived by
 * the system when their task is unblocked and reopened if it blocks again;
 * a card a human archived is never reopened.
 */
export const reconcileTaskBlockers = (
  cards: BulletinCard[],
  tasks: BulletinTaskSignal[],
  context: BulletinContext,
): BulletinCard[] => {
  const blockedById = new Map(
    tasks.filter((task) => task.status === "blocked" && !task.isArchived).map((task) => [task.id, task]),
  );
  const seenKeys = new Set<string>();
  let changed = false;
  const next = cards.map((card) => {
    if (!isSystemCardWithPrefix(card, TASK_BLOCKER_PREFIX)) return card;
    seenKeys.add(card.sourceKey);
    const task = blockedById.get(card.sourceKey.slice(TASK_BLOCKER_PREFIX.length));
    if (!task) {
      if (card.archived) return card;
      changed = true;
      return archiveBySystem(card, context);
    }
    if (card.archived && card.archivedBy !== "system") return card;
    const content = taskBlockerContent(task);
    if (
      !card.archived &&
      card.title === content.title &&
      card.body === content.body &&
      card.agentId === content.agentId
    ) {
      return card;
    }
    changed = true;
    return { ...card, ...content, archived: false, archivedBy: null, updatedAt: context.now };
  });
  const created: BulletinCard[] = [];
  for (const task of blockedById.values()) {
    const sourceKey = `${TASK_BLOCKER_PREFIX}${task.id}`;
    if (seenKeys.has(sourceKey)) continue;
    created.push(
      createSystemCard(
        {
          type: "blocker",
          ...taskBlockerContent(task),
          sourceKey,
          authorName: "Kanban",
          priority: "high",
          tags: ["kanban"],
          taskId: task.id,
        },
        context,
      ),
    );
  }
  if (!changed && created.length === 0) return cards;
  return capBulletinCards([...next, ...created]);
};

/**
 * The standup store is shared by every runtime the office connects to, so
 * only treat a meeting as this board's when one of its participants is in
 * the current fleet.
 */
export const isStandupMeetingForFleet = (
  meeting: StandupMeeting,
  agentIds: Iterable<string>,
): boolean => {
  const fleet = new Set(agentIds);
  return meeting.participantOrder.some((agentId) => fleet.has(agentId));
};

const isLiveStandup = (meeting: StandupMeeting | null): meeting is StandupMeeting =>
  Boolean(meeting && (meeting.phase === "gathering" || meeting.phase === "in_progress"));

const participantNames = (meeting: StandupMeeting): string[] => {
  const nameById = new Map(meeting.cards.map((card) => [card.agentId, card.agentName]));
  return meeting.participantOrder.map((agentId) => nameById.get(agentId) ?? agentId);
};

const liveAnnouncementBody = (meeting: StandupMeeting): string => {
  const names = participantNames(meeting);
  if (names.length === 0) return "Agents are gathering in the meeting room.";
  const noun = names.length === 1 ? "agent" : "agents";
  return `${names.length} ${noun} in the meeting room: ${names.join(", ")}.`;
};

const minutesBody = (meeting: StandupMeeting): string =>
  meeting.cards
    .map((card) => {
      const task = card.currentTask.trim() || "No current task reported";
      const blockers = card.blockers.map((entry) => entry.trim()).filter(Boolean);
      const suffix = blockers.length > 0 ? ` (blocked: ${blockers.join("; ")})` : "";
      return `${card.agentName} — ${task}${suffix}`;
    })
    .join("\n");

const isRecentlyCompleted = (meeting: StandupMeeting, now: string): boolean => {
  if (meeting.phase !== "complete" || !meeting.completedAt) return false;
  const completedAt = Date.parse(meeting.completedAt);
  if (Number.isNaN(completedAt)) return false;
  return Date.parse(now) - completedAt <= STANDUP_MINUTES_MAX_AGE_MS;
};

const standupCompletionCards = (
  meeting: StandupMeeting,
  existingKeys: Set<string>,
  context: BulletinContext,
): BulletinCard[] => {
  const created: BulletinCard[] = [];
  const minutesKey = `${STANDUP_MINUTES_PREFIX}${meeting.id}`;
  if (!existingKeys.has(minutesKey)) {
    created.push(
      createSystemCard(
        {
          type: "meeting_note",
          title: `Standup summary · ${(meeting.completedAt ?? context.now).slice(0, 10)}`,
          body: minutesBody(meeting),
          sourceKey: minutesKey,
          authorName: "Standup",
          priority: "normal",
          tags: ["standup"],
        },
        context,
      ),
    );
  }
  for (const summary of meeting.cards) {
    const blockers = summary.blockers.map((entry) => entry.trim()).filter(Boolean);
    const sourceKey = `${STANDUP_BLOCKER_PREFIX}${meeting.id}:${summary.agentId}`;
    if (blockers.length === 0 || existingKeys.has(sourceKey)) continue;
    created.push(
      createSystemCard(
        {
          type: "blocker",
          title: `${summary.agentName}: ${blockers[0]}`,
          body: blockers.join("\n"),
          sourceKey,
          authorName: "Standup",
          priority: "high",
          tags: ["standup"],
          agentId: summary.agentId,
        },
        context,
      ),
    );
  }
  return created;
};

/**
 * Reflect the standup lifecycle on the board: a live announcement while the
 * meeting runs, then minutes and blocker follow-ups once it completes.
 */
export const reconcileStandupMeeting = (
  cards: BulletinCard[],
  meeting: StandupMeeting | null,
  context: BulletinContext,
): BulletinCard[] => {
  const liveMeeting = isLiveStandup(meeting) ? meeting : null;
  const liveKey = liveMeeting ? `${STANDUP_LIVE_PREFIX}${liveMeeting.id}` : null;
  const existingKeys = new Set<string>();
  let changed = false;
  const next = cards.map((card) => {
    if (card.sourceKey) existingKeys.add(card.sourceKey);
    if (!isSystemCardWithPrefix(card, STANDUP_LIVE_PREFIX)) return card;
    if (card.sourceKey !== liveKey) {
      if (card.archived) return card;
      changed = true;
      return archiveBySystem(card, context);
    }
    // A person archived it: respect that for the rest of the meeting.
    if (card.archived && card.archivedBy !== "system") return card;
    const body = liveAnnouncementBody(liveMeeting as StandupMeeting);
    if (!card.archived && card.body === body) return card;
    changed = true;
    return { ...card, body, archived: false, archivedBy: null, updatedAt: context.now };
  });
  const created: BulletinCard[] = [];
  if (liveMeeting && liveKey && !existingKeys.has(liveKey)) {
    created.push(
      createSystemCard(
        {
          type: "announcement",
          title: "Standup in progress",
          body: liveAnnouncementBody(liveMeeting),
          sourceKey: liveKey,
          authorName: "Standup",
          priority: "high",
          tags: ["standup"],
        },
        context,
      ),
    );
  }
  if (meeting && isRecentlyCompleted(meeting, context.now)) {
    created.push(...standupCompletionCards(meeting, existingKeys, context));
  }
  if (!changed && created.length === 0) return cards;
  return capBulletinCards([...next, ...created]);
};
