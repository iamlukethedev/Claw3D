// Bulletin board domain types and persistence normalization.
// See docs/office_sys/bulletin-board-spec.md for the product spec.

export const BULLETIN_CARD_TYPES = [
  "goal",
  "announcement",
  "blocker",
  "handoff",
  "meeting_note",
] as const;

export type BulletinCardType = (typeof BULLETIN_CARD_TYPES)[number];

export const BULLETIN_AUTHOR_TYPES = ["human", "agent", "system"] as const;

export type BulletinAuthorType = (typeof BULLETIN_AUTHOR_TYPES)[number];

export const BULLETIN_PRIORITIES = ["low", "normal", "high"] as const;

export type BulletinPriority = (typeof BULLETIN_PRIORITIES)[number];

export type BulletinArchivedBy = "human" | "system";

export type BulletinCard = {
  id: string;
  type: BulletinCardType;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorType: BulletinAuthorType;
  authorId: string | null;
  authorName: string | null;
  agentId: string | null;
  sessionKey: string | null;
  taskId: string | null;
  pinned: boolean;
  archived: boolean;
  // Who archived the card. Automation only reopens cards it archived itself.
  archivedBy: BulletinArchivedBy | null;
  priority: BulletinPriority;
  tags: string[];
  // Stable key for automation-authored cards so they are posted once.
  sourceKey: string | null;
};

export type BulletinBoardPreference = {
  cards: BulletinCard[];
  updatedAt: string | null;
};

export type BulletinBoardPreferencePatch = {
  cards?: BulletinCard[];
  updatedAt?: string | null;
};

export const BULLETIN_LIMITS = {
  titleMax: 120,
  bodyMax: 2000,
  tagsMax: 8,
  tagLengthMax: 32,
  cardsMax: 200,
} as const;

export const defaultBulletinBoardPreference = (): BulletinBoardPreference => ({
  cards: [],
  updatedAt: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const isBulletinCardType = (value: unknown): value is BulletinCardType =>
  includes(BULLETIN_CARD_TYPES, value);

export const isBulletinAuthorType = (value: unknown): value is BulletinAuthorType =>
  includes(BULLETIN_AUTHOR_TYPES, value);

export const isBulletinPriority = (value: unknown): value is BulletinPriority =>
  includes(BULLETIN_PRIORITIES, value);

export const clampBulletinText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const normalizeOptionalId = (value: unknown): string | null => {
  const text = clampBulletinText(value, 256);
  return text ? text : null;
};

const normalizeIso = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  return Number.isNaN(Date.parse(value)) ? fallback : value;
};

export const normalizeBulletinTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  for (const entry of value) {
    const tag = clampBulletinText(entry, BULLETIN_LIMITS.tagLengthMax);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= BULLETIN_LIMITS.tagsMax) break;
  }
  return tags;
};

export const normalizeBulletinCard = (
  value: unknown,
  nowIso: string = new Date().toISOString(),
): BulletinCard | null => {
  if (!isRecord(value)) return null;
  const id = normalizeOptionalId(value.id);
  if (!id || !isBulletinCardType(value.type)) return null;
  const createdAt = normalizeIso(value.createdAt, nowIso);
  const archived = value.archived === true;
  return {
    id,
    type: value.type,
    title: clampBulletinText(value.title, BULLETIN_LIMITS.titleMax) || "Untitled card",
    body: clampBulletinText(value.body, BULLETIN_LIMITS.bodyMax),
    createdAt,
    updatedAt: normalizeIso(value.updatedAt, createdAt),
    authorType: isBulletinAuthorType(value.authorType) ? value.authorType : "human",
    authorId: normalizeOptionalId(value.authorId),
    authorName: clampBulletinText(value.authorName, 80) || null,
    agentId: normalizeOptionalId(value.agentId),
    sessionKey: normalizeOptionalId(value.sessionKey),
    taskId: normalizeOptionalId(value.taskId),
    pinned: !archived && value.pinned === true,
    archived,
    archivedBy: archived
      ? value.archivedBy === "system"
        ? "system"
        : "human"
      : null,
    priority: isBulletinPriority(value.priority) ? value.priority : "normal",
    tags: normalizeBulletinTags(value.tags),
    sourceKey: normalizeOptionalId(value.sourceKey),
  };
};

// Lower rank is evicted first. Automation cards stay longest because they
// also mark "already posted"; evicting one lets automation post it again.
const evictionRank = (card: BulletinCard): number => {
  if (card.archived) return card.sourceKey ? 1 : 0;
  return card.pinned ? 3 : 2;
};

/**
 * Keep the board under `max` cards, evicting the oldest cards of the lowest
 * eviction rank first and preserving the original order otherwise.
 */
export const capBulletinCards = (
  cards: BulletinCard[],
  max: number = BULLETIN_LIMITS.cardsMax,
): BulletinCard[] => {
  if (cards.length <= max) return cards;
  const removalOrder = [...cards].sort((left, right) => {
    const byRank = evictionRank(left) - evictionRank(right);
    if (byRank !== 0) return byRank;
    return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  });
  const removed = new Set(removalOrder.slice(0, cards.length - max).map((card) => card.id));
  return cards.filter((card) => !removed.has(card.id));
};

export const normalizeBulletinBoardPreference = (
  value: unknown,
  fallback: BulletinBoardPreference = defaultBulletinBoardPreference(),
): BulletinBoardPreference => {
  if (!isRecord(value)) return { cards: [...fallback.cards], updatedAt: fallback.updatedAt };
  const rawCards = Array.isArray(value.cards) ? value.cards : fallback.cards;
  const seen = new Set<string>();
  const cards: BulletinCard[] = [];
  for (const entry of rawCards) {
    const card = normalizeBulletinCard(entry);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  const updatedAt =
    typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt))
      ? value.updatedAt
      : fallback.updatedAt;
  return {
    cards: capBulletinCards(cards),
    updatedAt,
  };
};
