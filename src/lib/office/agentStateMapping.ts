import type { AgentState } from "@/features/agents/state/store";
import type { OfficeAgentState } from "@/lib/office/schema";

export const OFFICE_RENDERABLE_AGENT_STATUSES = [
  "idle",
  "working",
  "error",
] as const;

export type OfficeRenderableAgentStatus =
  (typeof OFFICE_RENDERABLE_AGENT_STATUSES)[number];

export const LOCAL_OFFICE_STATE_SIGNALS = [
  "idle",
  "running",
  "error",
] as const;

export type LocalOfficeStateSignal = (typeof LOCAL_OFFICE_STATE_SIGNALS)[number];

export const REMOTE_OFFICE_STATE_SIGNALS = [
  "idle",
  "working",
  "meeting",
  "error",
] as const;

export type RemoteOfficeStateSignal =
  (typeof REMOTE_OFFICE_STATE_SIGNALS)[number];

export type OfficeAgentStateMapping = {
  local: Record<LocalOfficeStateSignal, OfficeRenderableAgentStatus>;
  remote: Record<RemoteOfficeStateSignal, OfficeRenderableAgentStatus>;
};

export type OfficeAgentStateMappingPatch = {
  local?: Partial<Record<LocalOfficeStateSignal, OfficeRenderableAgentStatus>>;
  remote?: Partial<Record<RemoteOfficeStateSignal, OfficeRenderableAgentStatus>>;
};

export const DEFAULT_OFFICE_AGENT_STATE_MAPPING: OfficeAgentStateMapping = {
  local: {
    idle: "idle",
    running: "working",
    error: "error",
  },
  remote: {
    idle: "idle",
    working: "working",
    meeting: "working",
    error: "error",
  },
};

const isRenderableStatus = (
  value: unknown,
): value is OfficeRenderableAgentStatus =>
  typeof value === "string" &&
  OFFICE_RENDERABLE_AGENT_STATUSES.includes(
    value as OfficeRenderableAgentStatus,
  );

const normalizeLocalMapping = (
  value: unknown,
  fallback: Record<LocalOfficeStateSignal, OfficeRenderableAgentStatus>,
): Record<LocalOfficeStateSignal, OfficeRenderableAgentStatus> => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    idle: isRenderableStatus(source.idle) ? source.idle : fallback.idle,
    running: isRenderableStatus(source.running)
      ? source.running
      : fallback.running,
    error: isRenderableStatus(source.error) ? source.error : fallback.error,
  };
};

const normalizeRemoteMapping = (
  value: unknown,
  fallback: Record<RemoteOfficeStateSignal, OfficeRenderableAgentStatus>,
): Record<RemoteOfficeStateSignal, OfficeRenderableAgentStatus> => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    idle: isRenderableStatus(source.idle) ? source.idle : fallback.idle,
    working: isRenderableStatus(source.working)
      ? source.working
      : fallback.working,
    meeting: isRenderableStatus(source.meeting)
      ? source.meeting
      : fallback.meeting,
    error: isRenderableStatus(source.error) ? source.error : fallback.error,
  };
};

export const normalizeOfficeAgentStateMapping = (
  value: unknown,
  fallback: OfficeAgentStateMapping = DEFAULT_OFFICE_AGENT_STATE_MAPPING,
): OfficeAgentStateMapping => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    local: normalizeLocalMapping(source.local, fallback.local),
    remote: normalizeRemoteMapping(source.remote, fallback.remote),
  };
};

export const mergeOfficeAgentStateMapping = (
  fallback: OfficeAgentStateMapping,
  patch: OfficeAgentStateMappingPatch | null | undefined,
): OfficeAgentStateMapping => {
  if (!patch) {
    return normalizeOfficeAgentStateMapping(fallback, fallback);
  }
  return normalizeOfficeAgentStateMapping(
    {
      local: {
        ...fallback.local,
        ...(patch.local ?? {}),
      },
      remote: {
        ...fallback.remote,
        ...(patch.remote ?? {}),
      },
    },
    fallback,
  );
};

export const resolveLocalOfficeStateSignal = (
  agent: Pick<AgentState, "status" | "runId">,
): LocalOfficeStateSignal => {
  if (agent.status === "error") {
    return "error";
  }
  if (agent.status === "running" || Boolean(agent.runId)) {
    return "running";
  }
  return "idle";
};

export const resolveLocalOfficeRenderableStatus = (
  agent: Pick<AgentState, "status" | "runId">,
  mapping: OfficeAgentStateMapping = DEFAULT_OFFICE_AGENT_STATE_MAPPING,
): OfficeRenderableAgentStatus =>
  mapping.local[resolveLocalOfficeStateSignal(agent)];

export const resolveRemoteOfficeRenderableStatus = (
  state: OfficeAgentState,
  mapping: OfficeAgentStateMapping = DEFAULT_OFFICE_AGENT_STATE_MAPPING,
): OfficeRenderableAgentStatus => mapping.remote[state];
