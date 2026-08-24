export const OFFICE_STATE_ANIMATION_TARGETS = [
  "none",
  "desk",
  "server_room",
  "gym",
  "jukebox",
  "qa_lab",
  "sms_booth",
  "phone_booth",
] as const;

export type OfficeStateAnimationTarget =
  (typeof OFFICE_STATE_ANIMATION_TARGETS)[number];

export const OFFICE_STATE_EFFECT_IDS = [
  "none",
  "confetti",
  "alarm",
  "doorbell",
] as const;

export type OfficeStateEffectId = (typeof OFFICE_STATE_EFFECT_IDS)[number];

export type OfficeStateAnimationMapping = {
  id: string;
  sourceState: string;
  label: string;
  animationTarget: OfficeStateAnimationTarget;
  effect: OfficeStateEffectId;
  soundCueId: string | null;
  priority: number;
  enabled: boolean;
};

export type OfficeStateAnimationMappingPatch = Partial<
  Omit<OfficeStateAnimationMapping, "id">
> & {
  id?: string | null;
};

export type OfficeStateAnimationHoldMaps = {
  deskHoldByAgentId: Record<string, boolean>;
  githubHoldByAgentId: Record<string, boolean>;
  gymHoldByAgentId: Record<string, boolean>;
  jukeboxHoldByAgentId: Record<string, boolean>;
  qaHoldByAgentId: Record<string, boolean>;
  smsBoothHoldByAgentId: Record<string, boolean>;
  phoneBoothHoldByAgentId: Record<string, boolean>;
};

export type OfficeStateMappingAgentSnapshot = {
  agentId: string;
  status?: string | null;
  streamText?: string | null;
  thinkingTrace?: string | null;
  awaitingUserInput?: boolean | null;
  latestOverrideKind?: string | null;
};

const MAX_STATE_MAPPINGS = 64;
const MAX_STATE_TOKEN_LENGTH = 64;
const MAX_LABEL_LENGTH = 80;
const MAX_SOUND_CUE_ID_LENGTH = 80;

export const normalizeOfficeStateToken = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, "_").slice(0, MAX_STATE_TOKEN_LENGTH);
};

const coerceString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeMappingId = (value: unknown, fallback: string): string => {
  const raw = coerceString(value) || fallback;
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
};

export const isOfficeStateAnimationTarget = (
  value: unknown,
): value is OfficeStateAnimationTarget =>
  typeof value === "string" &&
  OFFICE_STATE_ANIMATION_TARGETS.includes(value as OfficeStateAnimationTarget);

export const isOfficeStateEffectId = (
  value: unknown,
): value is OfficeStateEffectId =>
  typeof value === "string" &&
  OFFICE_STATE_EFFECT_IDS.includes(value as OfficeStateEffectId);

const normalizePriority = (value: unknown, fallback = 50): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const normalizeOfficeStateAnimationMappings = (
  value: unknown,
  fallback: OfficeStateAnimationMapping[] = [],
): OfficeStateAnimationMapping[] => {
  const entries = Array.isArray(value) ? value : fallback;
  const seenIds = new Set<string>();
  const mappings: OfficeStateAnimationMapping[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const sourceState = normalizeOfficeStateToken(record.sourceState);
    if (!sourceState) continue;
    const fallbackId = `state-${sourceState}`;
    let id = normalizeMappingId(record.id, fallbackId);
    if (seenIds.has(id)) {
      id = `${id}-${mappings.length + 1}`;
    }
    seenIds.add(id);
    const label = (coerceString(record.label) || sourceState).slice(0, MAX_LABEL_LENGTH);
    const animationTarget = isOfficeStateAnimationTarget(record.animationTarget)
      ? record.animationTarget
      : "none";
    const effect = isOfficeStateEffectId(record.effect) ? record.effect : "none";
    const soundCueId = coerceString(record.soundCueId).slice(0, MAX_SOUND_CUE_ID_LENGTH) || null;

    mappings.push({
      id,
      sourceState,
      label,
      animationTarget,
      effect,
      soundCueId,
      priority: normalizePriority(record.priority),
      enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    });

    if (mappings.length >= MAX_STATE_MAPPINGS) break;
  }

  return mappings;
};

const createEmptyOfficeStateAnimationHoldMaps = (): OfficeStateAnimationHoldMaps => ({
  deskHoldByAgentId: {},
  githubHoldByAgentId: {},
  gymHoldByAgentId: {},
  jukeboxHoldByAgentId: {},
  qaHoldByAgentId: {},
  smsBoothHoldByAgentId: {},
  phoneBoothHoldByAgentId: {},
});

const resolveAgentSourceStateTokens = (
  agent: OfficeStateMappingAgentSnapshot,
): Set<string> => {
  const tokens = new Set<string>();
  const status = normalizeOfficeStateToken(agent.status);
  if (status) tokens.add(status);
  if (agent.awaitingUserInput) tokens.add("waiting");
  if (agent.streamText?.trim()) tokens.add("writing");
  if (agent.thinkingTrace?.trim()) tokens.add("thinking");
  const overrideKind = normalizeOfficeStateToken(agent.latestOverrideKind);
  if (overrideKind) tokens.add(overrideKind);
  return tokens;
};

export const buildOfficeStateMappingHoldMaps = (
  agents: OfficeStateMappingAgentSnapshot[],
  mappings: OfficeStateAnimationMapping[],
): OfficeStateAnimationHoldMaps => {
  const holds = createEmptyOfficeStateAnimationHoldMaps();
  const enabledMappings = mappings
    .filter((mapping) => mapping.enabled && mapping.animationTarget !== "none")
    .sort((a, b) => b.priority - a.priority);

  for (const agent of agents) {
    const tokens = resolveAgentSourceStateTokens(agent);
    const mapping = enabledMappings.find((entry) => tokens.has(entry.sourceState));
    if (!mapping) continue;
    if (mapping.animationTarget === "desk") {
      holds.deskHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "server_room") {
      holds.githubHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "gym") {
      holds.gymHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "jukebox") {
      holds.jukeboxHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "qa_lab") {
      holds.qaHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "sms_booth") {
      holds.smsBoothHoldByAgentId[agent.agentId] = true;
    } else if (mapping.animationTarget === "phone_booth") {
      holds.phoneBoothHoldByAgentId[agent.agentId] = true;
    }
  }

  return holds;
};
