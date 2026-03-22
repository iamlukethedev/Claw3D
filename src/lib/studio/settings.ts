import type {
  StandupConfig,
  StandupJiraConfig,
  StandupManualEntry,
  StandupScheduleConfig,
} from "@/lib/office/standup/types";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import { normalizeAgentAvatarProfile } from "@/lib/avatars/profile";

export type StudioGatewaySettings = {
  url: string;
  token: string;
};

export type StudioGatewaySettingsPublic = {
  url: string;
  token: string;
  tokenConfigured: boolean;
};

export type StudioGatewaySettingsPatch = {
  url?: string | null;
  token?: string | null;
};

export type FocusFilter = "all" | "running" | "approvals";
export type StudioViewMode = "focused";

export type StudioFocusedPreference = {
  mode: StudioViewMode;
  selectedAgentId: string | null;
  filter: FocusFilter;
};

export type StudioAnalyticsBudgetSettings = {
  dailySpendLimitUsd: number | null;
  monthlySpendLimitUsd: number | null;
  perAgentSoftLimitUsd: number | null;
  alertThresholdPct: number;
};

export type StudioAnalyticsPreference = {
  budgets: StudioAnalyticsBudgetSettings;
};

export type StudioAnalyticsPreferencePatch = {
  budgets?: Partial<StudioAnalyticsBudgetSettings>;
};

export type StudioVoiceRepliesProvider = "elevenlabs";

export type StudioVoiceRepliesPreference = {
  enabled: boolean;
  provider: StudioVoiceRepliesProvider;
  voiceId: string | null;
  speed: number;
};

export type StudioVoiceRepliesPreferencePatch = {
  enabled?: boolean;
  provider?: StudioVoiceRepliesProvider;
  voiceId?: string | null;
  speed?: number;
};

export type StudioOfficePreference = {
  title: string;
};

export type StudioOfficePreferencePatch = {
  title?: string | null;
};

export type StudioDeskAssignments = Record<string, string>;
export type StudioAgentAvatars = Record<string, AgentAvatarProfile>;

export type StudioStandupPreference = StandupConfig;

export type StudioStandupPreferencePublic = Omit<StudioStandupPreference, "jira"> & {
  jira: StandupJiraConfigPublic;
};

export type StudioStandupPreferencePatch = {
  schedule?: Partial<StandupScheduleConfig>;
  jira?: Partial<StandupJiraConfig>;
  manualByAgentId?: Record<string, Partial<StandupManualEntry> | null>;
};

export type StandupJiraConfigPublic = Omit<StandupJiraConfig, "apiToken"> & {
  apiToken: string;
  apiTokenConfigured: boolean;
};

export type StudioSettings = {
  version: 1;
  gateway: StudioGatewaySettings | null;
  focused: Record<string, StudioFocusedPreference>;
  avatars: Record<string, StudioAgentAvatars>;
  deskAssignments: Record<string, StudioDeskAssignments>;
  analytics: Record<string, StudioAnalyticsPreference>;
  voiceReplies: Record<string, StudioVoiceRepliesPreference>;
  office: Record<string, StudioOfficePreference>;
  standup?: Record<string, StudioStandupPreference>;
};

export type StudioSettingsPublic = Omit<StudioSettings, "gateway" | "standup"> & {
  gateway: StudioGatewaySettingsPublic | null;
  standup?: Record<string, StudioStandupPreferencePublic>;
};

export type StudioSettingsPatch = {
  gateway?: StudioGatewaySettingsPatch | null;
  focused?: Record<string, Partial<StudioFocusedPreference> | null>;
  avatars?: Record<string, Record<string, AgentAvatarProfile | null> | null>;
  deskAssignments?: Record<string, Record<string, string | null> | null>;
  analytics?: Record<string, StudioAnalyticsPreferencePatch | null>;
  voiceReplies?: Record<string, StudioVoiceRepliesPreferencePatch | null>;
  office?: Record<string, StudioOfficePreferencePatch | null>;
  standup?: Record<string, StudioStandupPreferencePatch | null>;
};

const SETTINGS_VERSION = 1 as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const coerceString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "0.0.0.0"]);

const normalizeGatewayUrl = (value: unknown) => {
  const url = coerceString(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return url;
    }
    const auth =
      parsed.username || parsed.password
        ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
        : "";
    const host = parsed.port ? `localhost:${parsed.port}` : "localhost";
    const dropDefaultPath =
      parsed.pathname === "/" && !url.endsWith("/") && !parsed.search && !parsed.hash;
    const pathname = dropDefaultPath ? "" : parsed.pathname;
    return `${parsed.protocol}//${auth}${host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

const normalizeGatewayKey = (value: unknown) => {
  const key = coerceString(value);
  return key ? key : null;
};

const normalizeFocusFilter = (
  value: unknown,
  fallback: FocusFilter = "all"
): FocusFilter => {
  const filter = coerceString(value);
  if (filter === "needs-attention") return "all";
  if (filter === "idle") return "approvals";
  if (
    filter === "all" ||
    filter === "running" ||
    filter === "approvals"
  ) {
    return filter;
  }
  return fallback;
};

const normalizeViewMode = (
  value: unknown,
  fallback: StudioViewMode = "focused"
): StudioViewMode => {
  const mode = coerceString(value);
  if (mode === "focused") {
    return mode;
  }
  return fallback;
};

const normalizeSelectedAgentId = (value: unknown, fallback: string | null = null) => {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalNumber = (value: unknown, fallback: number | null = null) => {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
};

const normalizeAlertThresholdPct = (value: unknown, fallback: number = 80) => {
  const next = normalizeOptionalNumber(value, fallback);
  if (next === null) return fallback;
  return Math.min(100, Math.max(1, next));
};

const defaultFocusedPreference = (): StudioFocusedPreference => ({
  mode: "focused",
  selectedAgentId: null,
  filter: "all",
});

export const defaultStudioAnalyticsPreference = (): StudioAnalyticsPreference => ({
  budgets: {
    dailySpendLimitUsd: null,
    monthlySpendLimitUsd: null,
    perAgentSoftLimitUsd: null,
    alertThresholdPct: 80,
  },
});

export const defaultStudioVoiceRepliesPreference =
  (): StudioVoiceRepliesPreference => ({
    enabled: false,
    provider: "elevenlabs",
    voiceId: null,
    speed: 1,
  });

export const defaultStudioStandupScheduleConfig = (): StandupScheduleConfig => ({
  enabled: false,
  cronExpr: "0 9 * * 1-5",
  timezone: "UTC",
  speakerSeconds: 8,
  autoOpenBoard: true,
  lastAutoRunAt: null,
});

export const defaultStudioStandupJiraConfig = (): StandupJiraConfig => ({
  enabled: false,
  baseUrl: "",
  email: "",
  apiToken: "",
  projectKey: "",
  jql: "",
});

export const defaultStudioStandupManualEntry = (): StandupManualEntry => ({
  jiraAssignee: null,
  currentTask: "",
  blockers: "",
  note: "",
  updatedAt: null,
});

export const defaultStudioStandupPreference = (): StudioStandupPreference => ({
  schedule: defaultStudioStandupScheduleConfig(),
  jira: defaultStudioStandupJiraConfig(),
  manualByAgentId: {},
});

const normalizeVoiceReplySpeed = (value: unknown, fallback: number = 1): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1.2, Math.max(0.7, value));
};

const normalizeOptionalIsoString = (
  value: unknown,
  fallback: string | null = null
): string | null => {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const DEFAULT_OFFICE_TITLE = "Luke Headquarters";

const normalizeOfficeTitle = (
  value: unknown,
  fallback: string = DEFAULT_OFFICE_TITLE
) => {
  const title = coerceString(value);
  return (title || fallback).slice(0, 48);
};

export const defaultStudioOfficePreference = (): StudioOfficePreference => ({
  title: DEFAULT_OFFICE_TITLE,
});

const normalizeStandupScheduleConfig = (
  value: unknown,
  fallback: StandupScheduleConfig = defaultStudioStandupScheduleConfig()
): StandupScheduleConfig => {
  if (!isRecord(value)) return fallback;
  const cronExpr = coerceString(value.cronExpr) || fallback.cronExpr;
  const timezone = coerceString(value.timezone) || fallback.timezone;
  const speakerSecondsRaw =
    typeof value.speakerSeconds === "number" && Number.isFinite(value.speakerSeconds)
      ? Math.round(value.speakerSeconds)
      : fallback.speakerSeconds;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    cronExpr,
    timezone,
    speakerSeconds: Math.max(4, Math.min(120, speakerSecondsRaw)),
    autoOpenBoard:
      typeof value.autoOpenBoard === "boolean"
        ? value.autoOpenBoard
        : fallback.autoOpenBoard,
    lastAutoRunAt: normalizeOptionalIsoString(
      value.lastAutoRunAt,
      fallback.lastAutoRunAt
    ),
  };
};

const normalizeStandupJiraConfig = (
  value: unknown,
  fallback: StandupJiraConfig = defaultStudioStandupJiraConfig()
): StandupJiraConfig => {
  if (!isRecord(value)) return fallback;
  const baseUrl = coerceString(value.baseUrl).replace(/\/+$/, "");
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    baseUrl: baseUrl || fallback.baseUrl,
    email: coerceString(value.email) || fallback.email,
    apiToken: coerceString(value.apiToken) || fallback.apiToken,
    projectKey: coerceString(value.projectKey).toUpperCase() || fallback.projectKey,
    jql: coerceString(value.jql) || fallback.jql,
  };
};

const normalizeStandupManualEntry = (
  value: unknown,
  fallback: StandupManualEntry = defaultStudioStandupManualEntry()
): StandupManualEntry => {
  if (!isRecord(value)) return fallback;
  return {
    jiraAssignee: normalizeSelectedAgentId(value.jiraAssignee, fallback.jiraAssignee),
    currentTask: coerceString(value.currentTask) || fallback.currentTask,
    blockers: coerceString(value.blockers) || fallback.blockers,
    note: coerceString(value.note) || fallback.note,
    updatedAt: normalizeOptionalIsoString(value.updatedAt, fallback.updatedAt),
  };
};

const normalizeStandupPreference = (
  value: unknown,
  fallback: StudioStandupPreference = defaultStudioStandupPreference()
): StudioStandupPreference => {
  if (!isRecord(value)) return fallback;
  const manualByAgentId: Record<string, StandupManualEntry> = {};
  if (isRecord(value.manualByAgentId)) {
    for (const [agentIdRaw, entryRaw] of Object.entries(value.manualByAgentId)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      manualByAgentId[agentId] = normalizeStandupManualEntry(
        entryRaw,
        fallback.manualByAgentId[agentId] ?? defaultStudioStandupManualEntry()
      );
    }
  }
  return {
    schedule: normalizeStandupScheduleConfig(value.schedule, fallback.schedule),
    jira: normalizeStandupJiraConfig(value.jira, fallback.jira),
    manualByAgentId,
  };
};

const normalizeStandup = (
  value: unknown
): Record<string, StudioStandupPreference> => {
  if (!isRecord(value)) return {};
  const standup: Record<string, StudioStandupPreference> = {};
  for (const [gatewayKeyRaw, standupRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    standup[gatewayKey] = normalizeStandupPreference(standupRaw);
  }
  return standup;
};

const normalizeFocusedPreference = (
  value: unknown,
  fallback: StudioFocusedPreference = defaultFocusedPreference()
): StudioFocusedPreference => {
  if (!isRecord(value)) return fallback;
  return {
    mode: normalizeViewMode(value.mode, fallback.mode),
    selectedAgentId: normalizeSelectedAgentId(
      value.selectedAgentId,
      fallback.selectedAgentId
    ),
    filter: normalizeFocusFilter(value.filter, fallback.filter),
  };
};

const normalizeGatewaySettings = (value: unknown): StudioGatewaySettings | null => {
  if (!isRecord(value)) return null;
  const url = normalizeGatewayUrl(value.url);
  if (!url) return null;
  const token = coerceString(value.token);
  return { url, token };
};

const mergeGatewaySettings = (
  current: StudioGatewaySettings | null,
  patch: StudioGatewaySettingsPatch | null,
): StudioGatewaySettings | null => {
  if (patch === null) return null;
  const nextUrl =
    patch.url === undefined ? current?.url ?? "" : normalizeGatewayUrl(patch.url);
  if (!nextUrl) return null;
  const nextToken =
    patch.token === undefined ? current?.token ?? "" : coerceString(patch.token);
  return {
    url: nextUrl,
    token: nextToken,
  };
};

const normalizeFocused = (value: unknown): Record<string, StudioFocusedPreference> => {
  if (!isRecord(value)) return {};
  const focused: Record<string, StudioFocusedPreference> = {};
  for (const [gatewayKeyRaw, focusedRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    focused[gatewayKey] = normalizeFocusedPreference(focusedRaw);
  }
  return focused;
};

const normalizeAvatars = (value: unknown): Record<string, StudioAgentAvatars> => {
  if (!isRecord(value)) return {};
  const avatars: Record<string, StudioAgentAvatars> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: StudioAgentAvatars = {};
    for (const [agentIdRaw, avatarRaw] of Object.entries(gatewayRaw)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      entries[agentId] = normalizeAgentAvatarProfile(avatarRaw, agentId);
    }
    avatars[gatewayKey] = entries;
  }
  return avatars;
};

const normalizeDeskAssignments = (
  value: unknown,
): Record<string, StudioDeskAssignments> => {
  if (!isRecord(value)) return {};
  const deskAssignments: Record<string, StudioDeskAssignments> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: StudioDeskAssignments = {};
    for (const [deskUidRaw, agentIdRaw] of Object.entries(gatewayRaw)) {
      const deskUid = coerceString(deskUidRaw);
      if (!deskUid) continue;
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      entries[deskUid] = agentId;
    }
    deskAssignments[gatewayKey] = entries;
  }
  return deskAssignments;
};

const normalizeAnalyticsBudgetSettings = (
  value: unknown,
  fallback: StudioAnalyticsBudgetSettings = defaultStudioAnalyticsPreference().budgets
): StudioAnalyticsBudgetSettings => {
  if (!isRecord(value)) return fallback;
  return {
    dailySpendLimitUsd: normalizeOptionalNumber(
      value.dailySpendLimitUsd,
      fallback.dailySpendLimitUsd
    ),
    monthlySpendLimitUsd: normalizeOptionalNumber(
      value.monthlySpendLimitUsd,
      fallback.monthlySpendLimitUsd
    ),
    perAgentSoftLimitUsd: normalizeOptionalNumber(
      value.perAgentSoftLimitUsd,
      fallback.perAgentSoftLimitUsd
    ),
    alertThresholdPct: normalizeAlertThresholdPct(
      value.alertThresholdPct,
      fallback.alertThresholdPct
    ),
  };
};

const normalizeAnalyticsPreference = (
  value: unknown,
  fallback: StudioAnalyticsPreference = defaultStudioAnalyticsPreference()
): StudioAnalyticsPreference => {
  if (!isRecord(value)) return fallback;
  return {
    budgets: normalizeAnalyticsBudgetSettings(value.budgets, fallback.budgets),
  };
};

const normalizeAnalytics = (value: unknown): Record<string, StudioAnalyticsPreference> => {
  if (!isRecord(value)) return {};
  const analytics: Record<string, StudioAnalyticsPreference> = {};
  for (const [gatewayKeyRaw, analyticsRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    analytics[gatewayKey] = normalizeAnalyticsPreference(analyticsRaw);
  }
  return analytics;
};

const normalizeVoiceRepliesProvider = (
  value: unknown,
  fallback: StudioVoiceRepliesProvider = "elevenlabs"
): StudioVoiceRepliesProvider => {
  const provider = coerceString(value);
  return provider === "elevenlabs" ? provider : fallback;
};

const normalizeVoiceRepliesPreference = (
  value: unknown,
  fallback: StudioVoiceRepliesPreference = defaultStudioVoiceRepliesPreference()
): StudioVoiceRepliesPreference => {
  if (!isRecord(value)) return fallback;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    provider: normalizeVoiceRepliesProvider(value.provider, fallback.provider),
    voiceId: normalizeSelectedAgentId(value.voiceId, fallback.voiceId),
    speed: normalizeVoiceReplySpeed(value.speed, fallback.speed),
  };
};

const normalizeVoiceReplies = (
  value: unknown
): Record<string, StudioVoiceRepliesPreference> => {
  if (!isRecord(value)) return {};
  const voiceReplies: Record<string, StudioVoiceRepliesPreference> = {};
  for (const [gatewayKeyRaw, voiceRepliesRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    voiceReplies[gatewayKey] = normalizeVoiceRepliesPreference(voiceRepliesRaw);
  }
  return voiceReplies;
};

const normalizeOfficePreference = (
  value: unknown,
  fallback: StudioOfficePreference = defaultStudioOfficePreference()
): StudioOfficePreference => {
  if (!isRecord(value)) return fallback;
  return {
    title: normalizeOfficeTitle(value.title, fallback.title),
  };
};

const normalizeOffice = (value: unknown): Record<string, StudioOfficePreference> => {
  if (!isRecord(value)) return {};
  const office: Record<string, StudioOfficePreference> = {};
  for (const [gatewayKeyRaw, officeRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    office[gatewayKey] = normalizeOfficePreference(officeRaw);
  }
  return office;
};

export const defaultStudioSettings = (): StudioSettings => ({
  version: SETTINGS_VERSION,
  gateway: null,
  focused: {},
  avatars: {},
  deskAssignments: {},
  analytics: {},
  voiceReplies: {},
  office: {},
  standup: {},
});

export const sanitizeStudioGatewaySettings = (
  value: StudioGatewaySettings | null,
): StudioGatewaySettingsPublic | null => {
  if (!value) return null;
  return {
    url: value.url,
    token: value.token,
    tokenConfigured: value.token.length > 0,
  };
};

export const sanitizeStandupJiraConfig = (
  value: StandupJiraConfig,
): StandupJiraConfigPublic => ({
  ...value,
  apiToken: "",
  apiTokenConfigured: value.apiToken.length > 0,
});

export const sanitizeStandupPreference = (
  value: StudioStandupPreference,
): StudioStandupPreferencePublic => ({
  ...value,
  jira: sanitizeStandupJiraConfig(value.jira),
});

export const sanitizeStudioSettings = (
  value: StudioSettings,
): StudioSettingsPublic => ({
  ...value,
  gateway: sanitizeStudioGatewaySettings(value.gateway),
  standup: Object.fromEntries(
    Object.entries(value.standup ?? {}).map(([gatewayKey, preference]) => [
      gatewayKey,
      sanitizeStandupPreference(preference),
    ]),
  ),
});

export const normalizeStudioSettings = (raw: unknown): StudioSettings => {
  if (!isRecord(raw)) return defaultStudioSettings();
  const gateway = normalizeGatewaySettings(raw.gateway);
  const focused = normalizeFocused(raw.focused);
  const avatars = normalizeAvatars(raw.avatars);
  const deskAssignments = normalizeDeskAssignments(raw.deskAssignments);
  const analytics = normalizeAnalytics(raw.analytics);
  const voiceReplies = normalizeVoiceReplies(raw.voiceReplies);
  const office = normalizeOffice(raw.office);
  const standup = normalizeStandup(raw.standup);
  return {
    version: SETTINGS_VERSION,
    gateway,
    focused,
    avatars,
    deskAssignments,
    analytics,
    voiceReplies,
    office,
    standup,
  };
};

export const mergeStudioSettings = (
  current: StudioSettings,
  patch: StudioSettingsPatch
): StudioSettings => {
  const nextGateway =
    patch.gateway === undefined ? current.gateway : mergeGatewaySettings(current.gateway, patch.gateway);
  const nextFocused = { ...current.focused };
  const nextAvatars = { ...current.avatars };
  const nextDeskAssignments = { ...current.deskAssignments };
  const nextAnalytics = { ...current.analytics };
  const nextVoiceReplies = { ...current.voiceReplies };
  const nextOffice = { ...current.office };
  const nextStandup = { ...(current.standup ?? {}) };
  if (patch.focused) {
    for (const [keyRaw, value] of Object.entries(patch.focused)) {
      const key = normalizeGatewayKey(keyRaw);
      if (!key) continue;
      if (value === null) {
        delete nextFocused[key];
        continue;
      }
      const fallback = nextFocused[key] ?? defaultFocusedPreference();
      nextFocused[key] = normalizeFocusedPreference(value, fallback);
    }
  }
  if (patch.avatars) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.avatars)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextAvatars[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextAvatars[gatewayKey] ? { ...nextAvatars[gatewayKey] } : {};
      for (const [agentIdRaw, avatarPatchRaw] of Object.entries(gatewayPatch)) {
        const agentId = coerceString(agentIdRaw);
        if (!agentId) continue;
        if (avatarPatchRaw === null) {
          delete existing[agentId];
          continue;
        }
        existing[agentId] = normalizeAgentAvatarProfile(avatarPatchRaw, agentId);
      }
      nextAvatars[gatewayKey] = existing;
    }
  }
  if (patch.deskAssignments) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.deskAssignments)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextDeskAssignments[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextDeskAssignments[gatewayKey]
        ? { ...nextDeskAssignments[gatewayKey] }
        : {};
      for (const [deskUidRaw, agentIdPatchRaw] of Object.entries(gatewayPatch)) {
        const deskUid = coerceString(deskUidRaw);
        if (!deskUid) continue;
        if (agentIdPatchRaw === null) {
          delete existing[deskUid];
          continue;
        }
        const agentId = coerceString(agentIdPatchRaw);
        if (!agentId) {
          delete existing[deskUid];
          continue;
        }
        existing[deskUid] = agentId;
      }
      nextDeskAssignments[gatewayKey] = existing;
    }
  }
  if (patch.analytics) {
    for (const [gatewayKeyRaw, analyticsPatch] of Object.entries(patch.analytics)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (analyticsPatch === null) {
        delete nextAnalytics[gatewayKey];
        continue;
      }
      const fallback = nextAnalytics[gatewayKey] ?? defaultStudioAnalyticsPreference();
      nextAnalytics[gatewayKey] = normalizeAnalyticsPreference(
        {
          ...fallback,
          ...analyticsPatch,
          budgets: {
            ...fallback.budgets,
            ...(isRecord(analyticsPatch.budgets) ? analyticsPatch.budgets : {}),
          },
        },
        fallback
      );
    }
  }
  if (patch.voiceReplies) {
    for (const [gatewayKeyRaw, voiceRepliesPatch] of Object.entries(patch.voiceReplies)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (voiceRepliesPatch === null) {
        delete nextVoiceReplies[gatewayKey];
        continue;
      }
      const fallback =
        nextVoiceReplies[gatewayKey] ?? defaultStudioVoiceRepliesPreference();
      nextVoiceReplies[gatewayKey] = normalizeVoiceRepliesPreference(
        {
          ...fallback,
          ...voiceRepliesPatch,
        },
        fallback
      );
    }
  }
  if (patch.office) {
    for (const [gatewayKeyRaw, officePatch] of Object.entries(patch.office)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (officePatch === null) {
        delete nextOffice[gatewayKey];
        continue;
      }
      const fallback = nextOffice[gatewayKey] ?? defaultStudioOfficePreference();
      nextOffice[gatewayKey] = normalizeOfficePreference(
        {
          ...fallback,
          ...officePatch,
        },
        fallback
      );
    }
  }
  if (patch.standup) {
    for (const [gatewayKeyRaw, standupPatch] of Object.entries(patch.standup)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (standupPatch === null) {
        delete nextStandup[gatewayKey];
        continue;
      }
      const fallback =
        nextStandup[gatewayKey] ?? defaultStudioStandupPreference();
      const nextManualByAgentId = { ...fallback.manualByAgentId };
      if (standupPatch.manualByAgentId) {
        for (const [agentIdRaw, entryPatch] of Object.entries(standupPatch.manualByAgentId)) {
          const agentId = coerceString(agentIdRaw);
          if (!agentId) continue;
          if (entryPatch === null) {
            delete nextManualByAgentId[agentId];
            continue;
          }
          const manualFallback =
            nextManualByAgentId[agentId] ?? defaultStudioStandupManualEntry();
          nextManualByAgentId[agentId] = normalizeStandupManualEntry(
            {
              ...manualFallback,
              ...entryPatch,
            },
            manualFallback
          );
        }
      }
      nextStandup[gatewayKey] = normalizeStandupPreference(
        {
          ...fallback,
          ...standupPatch,
          schedule: {
            ...fallback.schedule,
            ...(isRecord(standupPatch.schedule) ? standupPatch.schedule : {}),
          },
          jira: {
            ...fallback.jira,
            ...(isRecord(standupPatch.jira) ? standupPatch.jira : {}),
          },
          manualByAgentId: nextManualByAgentId,
        },
        fallback
      );
    }
  }
  return {
    version: SETTINGS_VERSION,
    gateway: nextGateway ?? null,
    focused: nextFocused,
    avatars: nextAvatars,
    deskAssignments: nextDeskAssignments,
    analytics: nextAnalytics,
    voiceReplies: nextVoiceReplies,
    office: nextOffice,
    standup: nextStandup,
  };
};

export const resolveFocusedPreference = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioFocusedPreference | null => {
  const key = normalizeGatewayKey(gatewayUrl);
  if (!key) return null;
  return settings.focused[key] ?? null;
};

export const resolveAgentAvatarSeed = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string,
  agentId: string
): string | null => {
  const profile = resolveAgentAvatarProfile(settings, gatewayUrl, agentId);
  return profile?.seed ?? null;
};

export const resolveAgentAvatarProfile = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string,
  agentId: string
): AgentAvatarProfile | null => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return null;
  const agentKey = coerceString(agentId);
  if (!agentKey) return null;
  return settings.avatars[gatewayKey]?.[agentKey] ?? null;
};

export const resolveDeskAssignments = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioDeskAssignments => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return {};
  return settings.deskAssignments[gatewayKey] ?? {};
};

export const resolveAnalyticsPreference = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioAnalyticsPreference => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return defaultStudioAnalyticsPreference();
  return settings.analytics[gatewayKey] ?? defaultStudioAnalyticsPreference();
};

export const resolveVoiceRepliesPreference = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioVoiceRepliesPreference => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return defaultStudioVoiceRepliesPreference();
  return settings.voiceReplies[gatewayKey] ?? defaultStudioVoiceRepliesPreference();
};

export const resolveOfficePreference = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioOfficePreference => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return defaultStudioOfficePreference();
  return settings.office[gatewayKey] ?? defaultStudioOfficePreference();
};

export const resolveStandupPreference = (
  settings: StudioSettings | StudioSettingsPublic,
  gatewayUrl: string
): StudioStandupPreference => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return defaultStudioStandupPreference();
  return settings.standup?.[gatewayKey] ?? defaultStudioStandupPreference();
};
