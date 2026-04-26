import { fetchJson } from "@/lib/http";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import type {
  StudioAnalyticsPreferencePatch,
  StudioFocusedPreference,
  StudioGatewaySettings,
  StudioGatewaySettingsPublic,
  StudioGatewaySettingsPatch,
  StudioOfficePreferencePatch,
  StudioSettingsPublic,
  StudioSettingsPatch,
  StudioStandupPreferencePatch,
  StudioTaskBoardPreferencePatch,
  StudioVoiceRepliesPreferencePatch,
} from "@/lib/studio/settings";

export type StudioSettingsResponse = {
  settings: StudioSettingsPublic;
  localGatewayDefaults?: StudioGatewaySettingsPublic | null;
  gatewayPrivate?: StudioGatewaySettings | null;
  localGatewayDefaultsPrivate?: StudioGatewaySettings | null;
};

export type StudioSettingsLoadOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

type FocusedPatch = Record<string, Partial<StudioFocusedPreference> | null>;
type AvatarsPatch = Record<string, Record<string, AgentAvatarProfile | null> | null>;
type DeskAssignmentsPatch = Record<string, Record<string, string | null> | null>;
type AnalyticsPatch = Record<string, StudioAnalyticsPreferencePatch | null>;
type VoiceRepliesPatch = Record<string, StudioVoiceRepliesPreferencePatch | null>;
type OfficePatch = Record<string, StudioOfficePreferencePatch | null>;
type StandupPatch = Record<string, StudioStandupPreferencePatch | null>;
type TaskBoardPatch = Record<string, StudioTaskBoardPreferencePatch | null>;

export type StudioSettingsCoordinatorTransport = {
  fetchSettings: () => Promise<StudioSettingsResponse>;
  updateSettings: (patch: StudioSettingsPatch) => Promise<StudioSettingsResponse>;
};

const mergeFocusedPatch = (
  current: FocusedPatch | undefined,
  next: FocusedPatch | undefined
): FocusedPatch | undefined => {
  if (!current && !next) return undefined;
  return {
    ...(current ?? {}),
    ...(next ?? {}),
  };
};

const mergeAvatarsPatch = (
  current: AvatarsPatch | undefined,
  next: AvatarsPatch | undefined
): AvatarsPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: AvatarsPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = { ...existing, ...value };
      continue;
    }
    merged[gatewayKey] = { ...value };
  }
  return merged;
};

const mergeDeskAssignmentsPatch = (
  current: DeskAssignmentsPatch | undefined,
  next: DeskAssignmentsPatch | undefined
): DeskAssignmentsPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: DeskAssignmentsPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = { ...existing, ...value };
      continue;
    }
    merged[gatewayKey] = { ...value };
  }
  return merged;
};

const mergeAnalyticsPatch = (
  current: AnalyticsPatch | undefined,
  next: AnalyticsPatch | undefined
): AnalyticsPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: AnalyticsPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = {
        ...existing,
        ...value,
        ...(value.budgets || existing.budgets
          ? {
              budgets: {
                ...(existing.budgets ?? {}),
                ...(value.budgets ?? {}),
              },
            }
          : {}),
      };
      continue;
    }
    merged[gatewayKey] = {
      ...value,
      ...(value.budgets ? { budgets: { ...value.budgets } } : {}),
    };
  }
  return merged;
};

const mergeVoiceRepliesPatch = (
  current: VoiceRepliesPatch | undefined,
  next: VoiceRepliesPatch | undefined
): VoiceRepliesPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: VoiceRepliesPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = {
        ...existing,
        ...value,
      };
      continue;
    }
    merged[gatewayKey] = { ...value };
  }
  return merged;
};

const mergeOfficePatch = (
  current: OfficePatch | undefined,
  next: OfficePatch | undefined
): OfficePatch | undefined => {
  if (!current && !next) return undefined;
  const merged: OfficePatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = {
        ...existing,
        ...value,
      };
      continue;
    }
    merged[gatewayKey] = { ...value };
  }
  return merged;
};

const mergeStandupPatch = (
  current: StandupPatch | undefined,
  next: StandupPatch | undefined
): StandupPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: StandupPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = {
        ...existing,
        ...value,
        ...(value.schedule || existing.schedule
          ? {
              schedule: {
                ...(existing.schedule ?? {}),
                ...(value.schedule ?? {}),
              },
            }
          : {}),
        ...(value.jira || existing.jira
          ? {
              jira: {
                ...(existing.jira ?? {}),
                ...(value.jira ?? {}),
              },
            }
          : {}),
        ...(value.manualByAgentId || existing.manualByAgentId
          ? {
              manualByAgentId: {
                ...(existing.manualByAgentId ?? {}),
                ...(value.manualByAgentId ?? {}),
              },
            }
          : {}),
      };
      continue;
    }
    merged[gatewayKey] = {
      ...value,
      ...(value.schedule ? { schedule: { ...value.schedule } } : {}),
      ...(value.jira ? { jira: { ...value.jira } } : {}),
      ...(value.manualByAgentId
        ? { manualByAgentId: { ...value.manualByAgentId } }
        : {}),
    };
  }
  return merged;
};

const mergeTaskBoardPatch = (
  current: TaskBoardPatch | undefined,
  next: TaskBoardPatch | undefined
): TaskBoardPatch | undefined => {
  if (!current && !next) return undefined;
  const merged: TaskBoardPatch = { ...(current ?? {}) };
  for (const [gatewayKey, value] of Object.entries(next ?? {})) {
    if (value === null) {
      merged[gatewayKey] = null;
      continue;
    }
    const existing = merged[gatewayKey];
    if (existing && existing !== null) {
      merged[gatewayKey] = {
        ...existing,
        ...value,
        ...(value.cards ? { cards: [...value.cards] } : {}),
      };
      continue;
    }
    merged[gatewayKey] = {
      ...value,
      ...(value.cards ? { cards: [...value.cards] } : {}),
    };
  }
  return merged;
};

const mergeOfficeFloorsPatch = (
  current: StudioSettingsPatch["officeFloors"],
  next: StudioSettingsPatch["officeFloors"],
): StudioSettingsPatch["officeFloors"] => {
  if (!next) return current;
  if (!current) return { ...next };
  return { ...current, ...next };
};

const mergeGatewayProfilesPatch = (
  current: StudioGatewaySettingsPatch["profiles"],
  next: StudioGatewaySettingsPatch["profiles"],
): StudioGatewaySettingsPatch["profiles"] => {
  if (next === undefined) return current;
  if (next === null) return null;
  if (!current || current === null) return { ...next };
  const merged: NonNullable<StudioGatewaySettingsPatch["profiles"]> = {
    ...current,
  };
  for (const [adapterType, profilePatch] of Object.entries(next)) {
    if (profilePatch === null) {
      merged[adapterType as keyof typeof merged] = null;
      continue;
    }
    const existing = merged[adapterType as keyof typeof merged];
    merged[adapterType as keyof typeof merged] =
      existing && existing !== null
        ? { ...existing, ...profilePatch }
        : { ...profilePatch };
  }
  return merged;
};

const mergeGatewayConnectionPatch = (
  current: StudioGatewaySettingsPatch["lastKnownGood"],
  next: StudioGatewaySettingsPatch["lastKnownGood"],
): StudioGatewaySettingsPatch["lastKnownGood"] => {
  if (next === undefined) return current;
  if (next === null) return null;
  if (!current || current === null) return { ...next };
  return { ...current, ...next };
};

const mergeGatewayPatch = (
  current: StudioSettingsPatch["gateway"],
  next: StudioSettingsPatch["gateway"],
): StudioSettingsPatch["gateway"] => {
  if (next === undefined) return current;
  if (next === null) return null;
  if (!current || current === null) {
    return {
      ...next,
      ...(next.profiles !== undefined
        ? { profiles: mergeGatewayProfilesPatch(undefined, next.profiles) }
        : {}),
      ...(next.lastKnownGood !== undefined
        ? {
            lastKnownGood: mergeGatewayConnectionPatch(
              undefined,
              next.lastKnownGood,
            ),
          }
        : {}),
    };
  }

  const profiles = mergeGatewayProfilesPatch(current.profiles, next.profiles);
  const lastKnownGood = mergeGatewayConnectionPatch(
    current.lastKnownGood,
    next.lastKnownGood,
  );
  return {
    ...current,
    ...next,
    ...(profiles !== undefined ? { profiles } : {}),
    ...(lastKnownGood !== undefined ? { lastKnownGood } : {}),
  };
};

const mergeStudioPatch = (
  current: StudioSettingsPatch | null,
  next: StudioSettingsPatch
): StudioSettingsPatch => {
  if (!current) {
    return {
      ...(next.gateway !== undefined ? { gateway: mergeGatewayPatch(undefined, next.gateway) } : {}),
      ...(next.activeFloorId !== undefined ? { activeFloorId: next.activeFloorId } : {}),
      ...(next.focused ? { focused: { ...next.focused } } : {}),
      ...(next.avatars ? { avatars: { ...next.avatars } } : {}),
      ...(next.deskAssignments ? { deskAssignments: { ...next.deskAssignments } } : {}),
      ...(next.analytics ? { analytics: { ...next.analytics } } : {}),
      ...(next.voiceReplies ? { voiceReplies: { ...next.voiceReplies } } : {}),
      ...(next.office ? { office: { ...next.office } } : {}),
      ...(next.standup ? { standup: { ...next.standup } } : {}),
      ...(next.officeFloors ? { officeFloors: { ...next.officeFloors } } : {}),
    };
  }
  const focused = mergeFocusedPatch(current.focused, next.focused);
  const avatars = mergeAvatarsPatch(current.avatars, next.avatars);
  const deskAssignments = mergeDeskAssignmentsPatch(
    current.deskAssignments,
    next.deskAssignments
  );
  const analytics = mergeAnalyticsPatch(current.analytics, next.analytics);
  const voiceReplies = mergeVoiceRepliesPatch(current.voiceReplies, next.voiceReplies);
  const office = mergeOfficePatch(current.office, next.office);
  const standup = mergeStandupPatch(current.standup, next.standup);
  const taskBoard = mergeTaskBoardPatch(current.taskBoard, next.taskBoard);
  const officeFloors = mergeOfficeFloorsPatch(current.officeFloors, next.officeFloors);
  const gateway = mergeGatewayPatch(current.gateway, next.gateway);
  return {
    ...(next.gateway !== undefined
      ? { gateway }
      : gateway !== undefined
        ? { gateway }
        : {}),
    ...(next.activeFloorId !== undefined
      ? { activeFloorId: next.activeFloorId }
      : current.activeFloorId !== undefined
        ? { activeFloorId: current.activeFloorId }
        : {}),
    ...(focused ? { focused } : {}),
    ...(avatars ? { avatars } : {}),
    ...(deskAssignments ? { deskAssignments } : {}),
    ...(analytics ? { analytics } : {}),
    ...(voiceReplies ? { voiceReplies } : {}),
    ...(office ? { office } : {}),
    ...(standup ? { standup } : {}),
    ...(taskBoard ? { taskBoard } : {}),
    ...(officeFloors ? { officeFloors } : {}),
  };
};

export class StudioSettingsCoordinator {
  private pendingPatch: StudioSettingsPatch | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private cachedEnvelope: StudioSettingsResponse | null = null;
  private cachedAtMs = 0;
  private pendingLoadPromise: Promise<StudioSettingsResponse> | null = null;

  constructor(
    private readonly transport: StudioSettingsCoordinatorTransport,
    private readonly defaultDebounceMs: number = 350,
    private readonly defaultCacheTtlMs: number = 5_000
  ) {}

  private primeCache(response: StudioSettingsResponse): StudioSettingsResponse {
    this.cachedEnvelope = response;
    this.cachedAtMs = Date.now();
    return response;
  }

  private getCachedEnvelope(maxAgeMs: number = this.defaultCacheTtlMs) {
    if (!this.cachedEnvelope) return null;
    if (maxAgeMs >= 0 && Date.now() - this.cachedAtMs > maxAgeMs) {
      return null;
    }
    return this.cachedEnvelope;
  }

  async loadSettings(
    options?: StudioSettingsLoadOptions,
  ): Promise<StudioSettingsPublic | null> {
    const result = await this.loadSettingsEnvelope(options);
    return result.settings ?? null;
  }

  async loadSettingsEnvelope(
    options?: StudioSettingsLoadOptions,
  ): Promise<StudioSettingsResponse> {
    const force = options?.force === true;
    const maxAgeMs = options?.maxAgeMs ?? this.defaultCacheTtlMs;
    if (!force) {
      const cached = this.getCachedEnvelope(maxAgeMs);
      if (cached) {
        return cached;
      }
      if (this.pendingLoadPromise) {
        return this.pendingLoadPromise;
      }
    }
    // force=true bypasses both cache and any in-flight request so callers
    // that need authoritative state (e.g. useGatewayConnection on startup)
    // always get a fresh fetch rather than a possibly-stale pending one.

    const loadPromise = this.transport
      .fetchSettings()
      .then((response) => this.primeCache(response))
      .finally(() => {
        if (this.pendingLoadPromise === loadPromise) {
          this.pendingLoadPromise = null;
        }
      });
    this.pendingLoadPromise = loadPromise;
    return loadPromise;
  }

  schedulePatch(patch: StudioSettingsPatch, debounceMs: number = this.defaultDebounceMs): void {
    if (this.disposed) return;
    this.pendingPatch = mergeStudioPatch(this.pendingPatch, patch);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flushPending().catch((err) => {
        console.error("Failed to flush pending studio settings patch.", err);
      });
    }, debounceMs);
  }

  async applyPatchNow(patch: StudioSettingsPatch): Promise<void> {
    if (this.disposed) return;
    this.pendingPatch = mergeStudioPatch(this.pendingPatch, patch);
    await this.flushPending();
  }

  async flushPending(): Promise<void> {
    if (this.disposed) {
      return this.queue;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const patch = this.pendingPatch;
    this.pendingPatch = null;
    if (!patch) {
      return this.queue;
    }
    const write = this.queue.then(async () => {
      const response = await this.transport.updateSettings(patch);
      this.primeCache(response);
    });
    this.queue = write.catch((err) => {
      console.error("Failed to persist studio settings patch.", err);
    });
    return write;
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingPatch = null;
    this.pendingLoadPromise = null;
    this.disposed = true;
  }
}

export const fetchStudioSettings = async (): Promise<StudioSettingsResponse> => {
  return fetchJson<StudioSettingsResponse>("/api/studio", { cache: "no-store" });
};

export const updateStudioSettings = async (
  patch: StudioSettingsPatch
): Promise<StudioSettingsResponse> => {
  return fetchJson<StudioSettingsResponse>("/api/studio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
};

export const createStudioSettingsCoordinator = (options?: {
  debounceMs?: number;
  cacheTtlMs?: number;
}): StudioSettingsCoordinator => {
  return new StudioSettingsCoordinator(
    {
      fetchSettings: fetchStudioSettings,
      updateSettings: updateStudioSettings,
    },
    options?.debounceMs,
    options?.cacheTtlMs,
  );
};
