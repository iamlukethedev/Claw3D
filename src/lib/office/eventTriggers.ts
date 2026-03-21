"use client";

import type { AgentState } from "@/features/agents/state/store";
import type { TranscriptEntry } from "@/features/agents/state/transcript";
import {
  classifyGatewayEventKind,
  isReasoningRuntimeAgentStream,
  type AgentEventPayload,
  type ChatEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  resolveExecApprovalAgentId,
} from "@/features/agents/approvals/execApprovalEvents";
import type { EventFrame } from "@/lib/gateway/GatewayClient";
import {
  isSameSessionKey,
  parseAgentIdFromSessionKey,
} from "@/lib/gateway/GatewayClient";
import type {
  OfficeCleaningCue,
  SessionEpochSnapshot,
} from "@/lib/office/janitorReset";
import {
  buildSessionEpochSnapshot,
  resolveResetAgentIds,
} from "@/lib/office/janitorReset";
import {
  type OfficeCallDirective,
  type OfficeCallPhase,
  type OfficeTextDirective,
  type OfficeTextPhase,
  resolveOfficeIntentSnapshot,
  resolveOfficeCallDirective,
  resolveOfficeDeskDirective,
  resolveOfficeGithubDirective,
  resolveOfficeGymDirective,
  resolveOfficePingPongDirective,
  resolveOfficeQaDirective,
  resolveOfficeStandupDirective,
  resolveOfficeTextDirective,
} from "@/lib/office/deskDirectives";
import {
  extractText,
  extractThinking,
} from "@/lib/text/message-extract";
import { randomUUID } from "@/lib/uuid";

// Office animation is derived in two passes:
// 1. Event reduction records short-lived latches from fresh gateway traffic.
// 2. Reconciliation rebuilds durable holds from current agent and transcript state.
// The 3D scene only consumes the distilled result from `buildOfficeAnimationState()`.
const WORKING_LATCH_MS = 5_000;
const GYM_WORKOUT_LATCH_MS = 60_000;
const STREAM_ACTIVITY_LATCH_MS = 6_000;
const THINKING_ACTIVITY_LATCH_MS = 6_000;
const CLEANING_CUE_LIMIT = 24;
const TRANSIENT_BOOTH_RESTORE_MAX_AGE_MS = 2 * 60_000;

type BooleanByAgentId = Record<string, boolean>;
type NumberByAgentId = Record<string, number>;
type StringByAgentId = Record<string, string>;
export type OfficePhoneCallRequest = {
  key: string;
  callee: string;
  message: string | null;
  phase: OfficeCallPhase;
  requestedAt: number;
};
type PhoneCallByAgentId = Record<string, OfficePhoneCallRequest>;
export type OfficeTextMessageRequest = {
  key: string;
  recipient: string;
  message: string | null;
  phase: OfficeTextPhase;
  requestedAt: number;
};
type TextMessageByAgentId = Record<string, OfficeTextMessageRequest>;

type LatestDirective<TDirective> = {
  directive: TDirective;
  key: string;
  text: string;
};

export type OfficeStandupTriggerRequest = {
  key: string;
  message: string;
  requestedAt: number;
};

export type OfficeAnimationTriggerState = {
  cleaningCues: OfficeCleaningCue[];
  deskDirectiveKeyByAgentId: StringByAgentId;
  deskHoldByAgentId: BooleanByAgentId;
  githubDirectiveKeyByAgentId: StringByAgentId;
  githubHoldByAgentId: BooleanByAgentId;
  gymCooldownUntilByAgentId: NumberByAgentId;
  lastManualGymCommandKeyByAgentId: StringByAgentId;
  manualGymUntilByAgentId: NumberByAgentId;
  pendingStandupRequest: OfficeStandupTriggerRequest | null;
  phoneCallByAgentId: PhoneCallByAgentId;
  phoneCallDirectiveKeyByAgentId: StringByAgentId;
  pingPongDirectiveKeyByAgentId: StringByAgentId;
  pingPongHoldByAgentId: BooleanByAgentId;
  qaDirectiveKeyByAgentId: StringByAgentId;
  qaHoldByAgentId: BooleanByAgentId;
  sessionEpochSnapshot: SessionEpochSnapshot;
  skillGymDirectiveKeyByAgentId: StringByAgentId;
  skillGymHoldByAgentId: BooleanByAgentId;
  streamingUntilByAgentId: NumberByAgentId;
  suppressedPhoneCallDirectiveKeyByAgentId: StringByAgentId;
  suppressedGithubDirectiveKeyByAgentId: StringByAgentId;
  suppressedQaDirectiveKeyByAgentId: StringByAgentId;
  suppressedTextMessageDirectiveKeyByAgentId: StringByAgentId;
  textMessageByAgentId: TextMessageByAgentId;
  textMessageDirectiveKeyByAgentId: StringByAgentId;
  thinkingUntilByAgentId: NumberByAgentId;
  workingUntilByAgentId: NumberByAgentId;
};

export type OfficeAnimationState = {
  awaitingApprovalByAgentId: BooleanByAgentId;
  cleaningCues: OfficeCleaningCue[];
  deskHoldByAgentId: BooleanByAgentId;
  githubHoldByAgentId: BooleanByAgentId;
  gymHoldByAgentId: BooleanByAgentId;
  manualGymUntilByAgentId: NumberByAgentId;
  pendingStandupRequest: OfficeStandupTriggerRequest | null;
  phoneBoothHoldByAgentId: BooleanByAgentId;
  phoneCallByAgentId: PhoneCallByAgentId;
  pingPongHoldByAgentId: BooleanByAgentId;
  qaHoldByAgentId: BooleanByAgentId;
  smsBoothHoldByAgentId: BooleanByAgentId;
  skillGymHoldByAgentId: BooleanByAgentId;
  streamingByAgentId: BooleanByAgentId;
  textMessageByAgentId: TextMessageByAgentId;
  thinkingByAgentId: BooleanByAgentId;
  workingUntilByAgentId: NumberByAgentId;
};

const emptyObject = <T extends Record<string, unknown>>(): T => ({} as T);

const normalizeCommandText = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const buildStableLatestRequestSeed = (value: string): string => {
  const normalized = normalizeCommandText(value);
  return normalized ? `latest:${normalized}` : "latest";
};

const pruneBooleanMap = (
  source: BooleanByAgentId,
  activeAgentIds: Set<string>,
): BooleanByAgentId =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([agentId, active]) => Boolean(active) && activeAgentIds.has(agentId),
    ),
  );

const pruneStringMap = (
  source: StringByAgentId,
  activeAgentIds: Set<string>,
): StringByAgentId =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([agentId, value]) => activeAgentIds.has(agentId) && value.trim().length > 0,
    ),
  );

const prunePhoneCallMap = (
  source: PhoneCallByAgentId,
  activeAgentIds: Set<string>,
): PhoneCallByAgentId =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([agentId, request]) =>
        activeAgentIds.has(agentId) &&
        Boolean(request?.callee?.trim()) &&
        (request.phase === "needs_message" ||
          (request.phase === "ready_to_call" && Boolean(request.message?.trim()))),
    ),
  );

const pruneTextMessageMap = (
  source: TextMessageByAgentId,
  activeAgentIds: Set<string>,
): TextMessageByAgentId =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([agentId, request]) =>
        activeAgentIds.has(agentId) &&
        Boolean(request?.recipient?.trim()) &&
        (request.phase === "needs_message" ||
          (request.phase === "ready_to_send" && Boolean(request.message?.trim()))),
    ),
  );

const pruneFutureMap = (
  source: NumberByAgentId,
  activeAgentIds: Set<string>,
  nowMs: number,
): NumberByAgentId =>
  Object.fromEntries(
    Object.entries(source).filter(
      ([agentId, until]) =>
        activeAgentIds.has(agentId) &&
        typeof until === "number" &&
        Number.isFinite(until) &&
        until > nowMs,
    ),
  );

const resolveMessageRole = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;
  const role = (message as Record<string, unknown>).role;
  return typeof role === "string" ? role : null;
};

const resolveChatPayloadRole = (payload: ChatEventPayload | undefined): string | null => {
  if (!payload) return null;
  const messageRole = resolveMessageRole(payload.message);
  if (messageRole) return messageRole;
  const payloadRole =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).role
      : null;
  return typeof payloadRole === "string" ? payloadRole : null;
};

const isUserLikeChatRole = (role: string | null, state: ChatEventPayload["state"]): boolean => {
  if (role === "user" || role === "human" || role === "input") return true;
  if (role === "system") return state === "final";
  return role === null && state === "final";
};

const resolveLatestDirective = <TDirective>(
  params: {
    lastUserMessage: string | null | undefined;
    transcriptEntries: TranscriptEntry[] | undefined;
    resolver: (value: string | null | undefined) => TDirective | null;
  },
): LatestDirective<TDirective> | null => {
  const latestMessageDirective = params.resolver(params.lastUserMessage);
  if (latestMessageDirective) {
    const text = params.lastUserMessage?.trim() ?? "";
    return {
      directive: latestMessageDirective,
      key: `latest:${normalizeCommandText(text)}`,
      text,
    };
  }
  if (!Array.isArray(params.transcriptEntries) || params.transcriptEntries.length === 0) {
    return null;
  }
  for (let index = params.transcriptEntries.length - 1; index >= 0; index -= 1) {
    const entry = params.transcriptEntries[index];
    if (!entry || entry.role !== "user") continue;
    const directive = params.resolver(entry.text);
    if (!directive) continue;
    return {
      directive,
      key: `${entry.entryId || index}:${normalizeCommandText(entry.text)}`,
      text: entry.text.trim(),
    };
  }
  return null;
};

const isTransientBoothRequestFresh = (requestedAt: number, nowMs: number): boolean =>
  nowMs - requestedAt <= TRANSIENT_BOOTH_RESTORE_MAX_AGE_MS;

const maybeResolveCompletedPhoneCallRequest = (
  current: OfficePhoneCallRequest | null,
  line: string,
): OfficePhoneCallRequest | null => {
  if (!current) return null;
  const match = line.match(/^\[phone booth\]\s*Call with\s+(.+)\s+finished\.$/i);
  if (!match) return current;
  return normalizeCommandText(match[1]) === normalizeCommandText(current.callee) ? null : current;
};

const maybeResolveCompletedTextMessageRequest = (
  current: OfficeTextMessageRequest | null,
  line: string,
): OfficeTextMessageRequest | null => {
  if (!current) return null;
  const match = line.match(/^\[messaging booth\]\s*Message to\s+(.+)\s+sent\.$/i);
  if (!match) return current;
  return normalizeCommandText(match[1]) === normalizeCommandText(current.recipient)
    ? null
    : current;
};

const resolveLatestPhoneCallRequest = (params: {
  lastUserMessage: string | null | undefined;
  transcriptEntries: TranscriptEntry[] | undefined;
  nowMs: number;
}): OfficePhoneCallRequest | null => {
  const transcriptEntries = params.transcriptEntries ?? [];
  let current: OfficePhoneCallRequest | null = null;
  let latestTranscriptUserText = "";
  for (const entry of transcriptEntries) {
    if (!entry) continue;
    if (entry.role === "user") {
      latestTranscriptUserText = entry.text;
      const directCall = resolveOfficeCallDirective(entry.text);
      if (directCall) {
        current = createPhoneCallRequest({
          directive: directCall,
          requestedAt: entry.timestampMs ?? params.nowMs,
          requestSeed: entry.entryId || String(entry.sequenceKey),
        });
        continue;
      }
      const snapshot = resolveOfficeIntentSnapshot(entry.text);
      const followUp = resolvePhoneCallFollowUpRequest({
        current,
        message: entry.text,
        snapshot,
        requestedAt: entry.timestampMs ?? params.nowMs,
      });
      if (followUp) {
        current = followUp;
      }
      continue;
    }
    if (entry.role === "assistant") {
      current = maybeResolveCompletedPhoneCallRequest(current, entry.text);
    }
  }
  const latestMessage = params.lastUserMessage?.trim() ?? "";
  if (
    latestMessage &&
    normalizeCommandText(latestMessage) !==
      normalizeCommandText(latestTranscriptUserText)
  ) {
    const latestSeed = buildStableLatestRequestSeed(latestMessage);
    const directCall = resolveOfficeCallDirective(latestMessage);
    if (directCall) {
      current = createPhoneCallRequest({
        directive: directCall,
        requestedAt: params.nowMs,
        requestSeed: latestSeed,
      });
    } else {
      const snapshot = resolveOfficeIntentSnapshot(latestMessage);
      const followUp = resolvePhoneCallFollowUpRequest({
        current,
        message: latestMessage,
        snapshot,
        requestedAt: params.nowMs,
        requestSeed: latestSeed,
      });
      if (followUp) {
        current = followUp;
      }
    }
  }
  if (!current) return null;
  return isTransientBoothRequestFresh(current.requestedAt, params.nowMs) ? current : null;
};

const resolveLatestTextMessageRequest = (params: {
  lastUserMessage: string | null | undefined;
  transcriptEntries: TranscriptEntry[] | undefined;
  nowMs: number;
}): OfficeTextMessageRequest | null => {
  const transcriptEntries = params.transcriptEntries ?? [];
  let current: OfficeTextMessageRequest | null = null;
  let latestTranscriptUserText = "";
  for (const entry of transcriptEntries) {
    if (!entry) continue;
    if (entry.role === "user") {
      latestTranscriptUserText = entry.text;
      const directText = resolveOfficeTextDirective(entry.text);
      if (directText) {
        current = createTextMessageRequest({
          directive: directText,
          requestedAt: entry.timestampMs ?? params.nowMs,
          requestSeed: entry.entryId || String(entry.sequenceKey),
        });
        continue;
      }
      const snapshot = resolveOfficeIntentSnapshot(entry.text);
      const followUp = resolveTextMessageFollowUpRequest({
        current,
        message: entry.text,
        snapshot,
        requestedAt: entry.timestampMs ?? params.nowMs,
      });
      if (followUp) {
        current = followUp;
      }
      continue;
    }
    if (entry.role === "assistant") {
      current = maybeResolveCompletedTextMessageRequest(current, entry.text);
    }
  }
  const latestMessage = params.lastUserMessage?.trim() ?? "";
  if (
    latestMessage &&
    normalizeCommandText(latestMessage) !==
      normalizeCommandText(latestTranscriptUserText)
  ) {
    const latestSeed = buildStableLatestRequestSeed(latestMessage);
    const directText = resolveOfficeTextDirective(latestMessage);
    if (directText) {
      current = createTextMessageRequest({
        directive: directText,
        requestedAt: params.nowMs,
        requestSeed: latestSeed,
      });
    } else {
      const snapshot = resolveOfficeIntentSnapshot(latestMessage);
      const followUp = resolveTextMessageFollowUpRequest({
        current,
        message: latestMessage,
        snapshot,
        requestedAt: params.nowMs,
        requestSeed: latestSeed,
      });
      if (followUp) {
        current = followUp;
      }
    }
  }
  if (!current) return null;
  return isTransientBoothRequestFresh(current.requestedAt, params.nowMs) ? current : null;
};

const resolveAgentIdForSessionKey = (
  agents: AgentState[],
  sessionKey: string | null | undefined,
): string | null => {
  const trimmed = sessionKey?.trim() ?? "";
  if (!trimmed) return null;
  const matched = agents.find((agent) => isSameSessionKey(agent.sessionKey, trimmed));
  if (matched) return matched.agentId;
  return parseAgentIdFromSessionKey(trimmed);
};

const buildPhoneCallDirectiveKey = (
  directive: Pick<OfficeCallDirective, "callee" | "message" | "phase">,
  requestSeed: string,
): string =>
  [
    requestSeed,
    normalizeCommandText(directive.callee),
    directive.phase,
    normalizeCommandText(directive.message ?? ""),
  ].join("|");

const createPhoneCallRequest = (params: {
  directive: OfficeCallDirective;
  requestedAt: number;
  requestSeed?: string;
}): OfficePhoneCallRequest => ({
  key: buildPhoneCallDirectiveKey(
    params.directive,
    params.requestSeed ?? String(params.requestedAt),
  ),
  callee: params.directive.callee,
  message: params.directive.message,
  phase: params.directive.phase,
  requestedAt: params.requestedAt,
});

const buildTextMessageDirectiveKey = (
  directive: Pick<OfficeTextDirective, "recipient" | "message" | "phase">,
  requestSeed: string,
): string =>
  [
    requestSeed,
    normalizeCommandText(directive.recipient),
    directive.phase,
    normalizeCommandText(directive.message ?? ""),
  ].join("|");

const createTextMessageRequest = (params: {
  directive: OfficeTextDirective;
  requestedAt: number;
  requestSeed?: string;
}): OfficeTextMessageRequest => ({
  key: buildTextMessageDirectiveKey(
    params.directive,
    params.requestSeed ?? String(params.requestedAt),
  ),
  recipient: params.directive.recipient,
  message: params.directive.message,
  phase: params.directive.phase,
  requestedAt: params.requestedAt,
});

const hasOtherOfficeDirective = (
  snapshot: ReturnType<typeof resolveOfficeIntentSnapshot>,
): boolean =>
  Boolean(
    snapshot.desk ||
      snapshot.github ||
      snapshot.gym ||
      snapshot.qa ||
      snapshot.art ||
      snapshot.standup ||
      snapshot.call ||
      snapshot.text,
  );

const resolvePhoneCallFollowUpRequest = (params: {
  current: OfficePhoneCallRequest | null;
  message: string;
  snapshot: ReturnType<typeof resolveOfficeIntentSnapshot>;
  requestedAt: number;
  requestSeed?: string;
}): OfficePhoneCallRequest | null => {
  if (!params.current || params.current.phase !== "needs_message") return null;
  if (hasOtherOfficeDirective(params.snapshot)) return null;
  const message = params.message.trim();
  if (!message) return null;
  return {
    key: buildPhoneCallDirectiveKey({
      callee: params.current.callee,
      phase: "ready_to_call",
      message,
    }, params.requestSeed ?? String(params.requestedAt)),
    callee: params.current.callee,
    message,
    phase: "ready_to_call",
    requestedAt: params.requestedAt,
  };
};

const resolveTextMessageFollowUpRequest = (params: {
  current: OfficeTextMessageRequest | null;
  message: string;
  snapshot: ReturnType<typeof resolveOfficeIntentSnapshot>;
  requestedAt: number;
  requestSeed?: string;
}): OfficeTextMessageRequest | null => {
  if (!params.current || params.current.phase !== "needs_message") return null;
  if (hasOtherOfficeDirective(params.snapshot)) return null;
  const message = params.message.trim();
  if (!message) return null;
  return {
    key: buildTextMessageDirectiveKey(
      {
        recipient: params.current.recipient,
        phase: "ready_to_send",
        message,
      },
      params.requestSeed ?? String(params.requestedAt),
    ),
    recipient: params.current.recipient,
    message,
    phase: "ready_to_send",
    requestedAt: params.requestedAt,
  };
};

const applyHoldDirective = (
  currentHeld: boolean,
  directive: LatestDirective<"desk" | "github" | "qa_lab" | "release"> | null,
): boolean => {
  if (!directive) return currentHeld;
  if (directive.directive === "release") return false;
  return true;
};

const pruneOfficeAnimationTriggerState = (
  state: OfficeAnimationTriggerState,
  agents: AgentState[],
  nowMs: number,
): OfficeAnimationTriggerState => {
  const activeAgentIds = new Set(agents.map((agent) => agent.agentId));
  return {
    ...state,
    deskDirectiveKeyByAgentId: pruneStringMap(
      state.deskDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    deskHoldByAgentId: pruneBooleanMap(state.deskHoldByAgentId, activeAgentIds),
    githubDirectiveKeyByAgentId: pruneStringMap(
      state.githubDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    githubHoldByAgentId: pruneBooleanMap(state.githubHoldByAgentId, activeAgentIds),
    gymCooldownUntilByAgentId: pruneFutureMap(
      state.gymCooldownUntilByAgentId,
      activeAgentIds,
      nowMs,
    ),
    lastManualGymCommandKeyByAgentId: pruneStringMap(
      state.lastManualGymCommandKeyByAgentId,
      activeAgentIds,
    ),
    manualGymUntilByAgentId: pruneFutureMap(
      state.manualGymUntilByAgentId,
      activeAgentIds,
      nowMs,
    ),
    qaDirectiveKeyByAgentId: pruneStringMap(
      state.qaDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    phoneCallByAgentId: prunePhoneCallMap(state.phoneCallByAgentId, activeAgentIds),
    phoneCallDirectiveKeyByAgentId: pruneStringMap(
      state.phoneCallDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    qaHoldByAgentId: pruneBooleanMap(state.qaHoldByAgentId, activeAgentIds),
    skillGymDirectiveKeyByAgentId: pruneStringMap(
      state.skillGymDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    skillGymHoldByAgentId: pruneBooleanMap(
      state.skillGymHoldByAgentId,
      activeAgentIds,
    ),
    streamingUntilByAgentId: pruneFutureMap(
      state.streamingUntilByAgentId,
      activeAgentIds,
      nowMs,
    ),
    suppressedPhoneCallDirectiveKeyByAgentId: pruneStringMap(
      state.suppressedPhoneCallDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    suppressedGithubDirectiveKeyByAgentId: pruneStringMap(
      state.suppressedGithubDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    suppressedQaDirectiveKeyByAgentId: pruneStringMap(
      state.suppressedQaDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    suppressedTextMessageDirectiveKeyByAgentId: pruneStringMap(
      state.suppressedTextMessageDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    textMessageByAgentId: pruneTextMessageMap(
      state.textMessageByAgentId,
      activeAgentIds,
    ),
    textMessageDirectiveKeyByAgentId: pruneStringMap(
      state.textMessageDirectiveKeyByAgentId,
      activeAgentIds,
    ),
    thinkingUntilByAgentId: pruneFutureMap(
      state.thinkingUntilByAgentId,
      activeAgentIds,
      nowMs,
    ),
    workingUntilByAgentId: pruneFutureMap(
      state.workingUntilByAgentId,
      activeAgentIds,
      nowMs,
    ),
  };
};

const recordWorkingActivity = (
  current: NumberByAgentId,
  agentId: string,
  nowMs: number,
): NumberByAgentId => ({
  ...current,
  [agentId]: Math.max(current[agentId] ?? 0, nowMs + WORKING_LATCH_MS),
});

const recordStreamingActivity = (
  current: NumberByAgentId,
  agentId: string,
  nowMs: number,
): NumberByAgentId => ({
  ...current,
  [agentId]: Math.max(current[agentId] ?? 0, nowMs + STREAM_ACTIVITY_LATCH_MS),
});

const recordThinkingActivity = (
  current: NumberByAgentId,
  agentId: string,
  nowMs: number,
): NumberByAgentId => ({
  ...current,
  [agentId]: Math.max(current[agentId] ?? 0, nowMs + THINKING_ACTIVITY_LATCH_MS),
});

const applyUserMessageTriggers = (params: {
  state: OfficeAnimationTriggerState;
  agentId: string;
  message: string;
  nowMs: number;
}): OfficeAnimationTriggerState => {
  let next = params.state;
  // All room holds come from the unified office intent snapshot so every transport channel
  // shares the same command grammar and new rooms only need one parser entry point.
  const intentSnapshot = resolveOfficeIntentSnapshot(params.message);
  const deskDirective = intentSnapshot.desk;
  if (deskDirective) {
    next = {
      ...next,
      deskHoldByAgentId:
        deskDirective === "release"
          ? Object.fromEntries(
              Object.entries(next.deskHoldByAgentId).filter(
                ([agentId]) => agentId !== params.agentId,
              ),
            )
          : { ...next.deskHoldByAgentId, [params.agentId]: true },
    };
  }
  const githubDirective = intentSnapshot.github;
  if (githubDirective) {
    const directiveKey = normalizeCommandText(params.message);
    const isSuppressed =
      next.suppressedGithubDirectiveKeyByAgentId[params.agentId] === directiveKey;
    next = {
      ...next,
      githubDirectiveKeyByAgentId: {
        ...next.githubDirectiveKeyByAgentId,
        [params.agentId]: directiveKey,
      },
      githubHoldByAgentId:
        githubDirective === "release" || isSuppressed
          ? Object.fromEntries(
              Object.entries(next.githubHoldByAgentId).filter(
                ([agentId]) => agentId !== params.agentId,
              ),
            )
          : { ...next.githubHoldByAgentId, [params.agentId]: true },
    };
  }
  const qaDirective = intentSnapshot.qa;
  if (qaDirective) {
    const directiveKey = normalizeCommandText(params.message);
    const isSuppressed =
      next.suppressedQaDirectiveKeyByAgentId[params.agentId] === directiveKey;
    next = {
      ...next,
      qaDirectiveKeyByAgentId: {
        ...next.qaDirectiveKeyByAgentId,
        [params.agentId]: directiveKey,
      },
      qaHoldByAgentId:
        qaDirective === "release" || isSuppressed
          ? Object.fromEntries(
              Object.entries(next.qaHoldByAgentId).filter(
                ([agentId]) => agentId !== params.agentId,
              ),
            )
          : { ...next.qaHoldByAgentId, [params.agentId]: true },
    };
  }
  if (intentSnapshot.gym?.source === "manual") {
    const gymCommandKey = normalizeCommandText(params.message);
    next = {
      ...next,
      lastManualGymCommandKeyByAgentId: {
        ...next.lastManualGymCommandKeyByAgentId,
        [params.agentId]: gymCommandKey,
      },
      manualGymUntilByAgentId: {
        ...next.manualGymUntilByAgentId,
        [params.agentId]: params.nowMs + GYM_WORKOUT_LATCH_MS,
      },
    };
  }
  if (
    params.agentId === "main" &&
    intentSnapshot.standup === "standup"
  ) {
    const requestKey = normalizeCommandText(params.message);
    if (next.pendingStandupRequest?.key !== requestKey) {
      next = {
        ...next,
        pendingStandupRequest: {
          key: requestKey,
          message: params.message.trim(),
          requestedAt: params.nowMs,
        },
      };
    }
  }
  if (intentSnapshot.call) {
    const request = createPhoneCallRequest({
      directive: intentSnapshot.call,
      requestedAt: params.nowMs,
    });
    next = {
      ...next,
      phoneCallByAgentId: {
        ...next.phoneCallByAgentId,
        [params.agentId]: request,
      },
      phoneCallDirectiveKeyByAgentId: {
        ...next.phoneCallDirectiveKeyByAgentId,
        [params.agentId]: request.key,
      },
    };
  } else {
    const followUpRequest = resolvePhoneCallFollowUpRequest({
      current: next.phoneCallByAgentId[params.agentId] ?? null,
      message: params.message,
      snapshot: intentSnapshot,
      requestedAt: params.nowMs,
    });
    if (followUpRequest) {
      next = {
        ...next,
        phoneCallByAgentId: {
          ...next.phoneCallByAgentId,
          [params.agentId]: followUpRequest,
        },
        phoneCallDirectiveKeyByAgentId: {
          ...next.phoneCallDirectiveKeyByAgentId,
          [params.agentId]: followUpRequest.key,
        },
      };
    }
  }
  if (intentSnapshot.text) {
    const request = createTextMessageRequest({
      directive: intentSnapshot.text,
      requestedAt: params.nowMs,
    });
    next = {
      ...next,
      textMessageByAgentId: {
        ...next.textMessageByAgentId,
        [params.agentId]: request,
      },
      textMessageDirectiveKeyByAgentId: {
        ...next.textMessageDirectiveKeyByAgentId,
        [params.agentId]: request.key,
      },
    };
  } else {
    const followUpRequest = resolveTextMessageFollowUpRequest({
      current: next.textMessageByAgentId[params.agentId] ?? null,
      message: params.message,
      snapshot: intentSnapshot,
      requestedAt: params.nowMs,
    });
    if (followUpRequest) {
      next = {
        ...next,
        textMessageByAgentId: {
          ...next.textMessageByAgentId,
          [params.agentId]: followUpRequest,
        },
        textMessageDirectiveKeyByAgentId: {
          ...next.textMessageDirectiveKeyByAgentId,
          [params.agentId]: followUpRequest.key,
        },
      };
    }
  }
  return next;
};

export const createOfficeAnimationTriggerState = (): OfficeAnimationTriggerState => ({
  cleaningCues: [],
  deskDirectiveKeyByAgentId: emptyObject(),
  deskHoldByAgentId: emptyObject(),
  githubDirectiveKeyByAgentId: emptyObject(),
  githubHoldByAgentId: emptyObject(),
  gymCooldownUntilByAgentId: emptyObject(),
  lastManualGymCommandKeyByAgentId: emptyObject(),
  manualGymUntilByAgentId: emptyObject(),
  pendingStandupRequest: null,
  phoneCallByAgentId: emptyObject(),
  phoneCallDirectiveKeyByAgentId: emptyObject(),
  pingPongDirectiveKeyByAgentId: emptyObject(),
  pingPongHoldByAgentId: emptyObject(),
  qaDirectiveKeyByAgentId: emptyObject(),
  qaHoldByAgentId: emptyObject(),
  sessionEpochSnapshot: {},
  skillGymDirectiveKeyByAgentId: emptyObject(),
  skillGymHoldByAgentId: emptyObject(),
  streamingUntilByAgentId: emptyObject(),
  suppressedPhoneCallDirectiveKeyByAgentId: emptyObject(),
  suppressedGithubDirectiveKeyByAgentId: emptyObject(),
  suppressedQaDirectiveKeyByAgentId: emptyObject(),
  suppressedTextMessageDirectiveKeyByAgentId: emptyObject(),
  textMessageByAgentId: emptyObject(),
  textMessageDirectiveKeyByAgentId: emptyObject(),
  thinkingUntilByAgentId: emptyObject(),
  workingUntilByAgentId: emptyObject(),
});

export const reduceOfficeAnimationTriggerEvent = (params: {
  agents: AgentState[];
  event: EventFrame;
  nowMs?: number;
  state: OfficeAnimationTriggerState;
}): OfficeAnimationTriggerState => {
  const nowMs = params.nowMs ?? Date.now();
  let next = pruneOfficeAnimationTriggerState(params.state, params.agents, nowMs);
  const kind = classifyGatewayEventKind(params.event.event);

  if (kind === "runtime-chat") {
    const payload = params.event.payload as ChatEventPayload | undefined;
    const agentId = resolveAgentIdForSessionKey(
      params.agents,
      payload?.sessionKey,
    );
    if (!payload || !agentId) return next;
    const messageText = extractText(payload.message)?.trim() ?? "";
    const thinkingText = extractThinking(payload.message ?? payload)?.trim() ?? "";
    const role = resolveChatPayloadRole(payload);
    if (payload.runId) {
      next = {
        ...next,
        workingUntilByAgentId: recordWorkingActivity(
          next.workingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    }
    if (isUserLikeChatRole(role, payload.state) && messageText) {
      next = applyUserMessageTriggers({
        state: next,
        agentId,
        message: messageText,
        nowMs,
      });
    }
    if (role === "assistant" && messageText) {
      next = {
        ...next,
        streamingUntilByAgentId: recordStreamingActivity(
          next.streamingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    }
    if (thinkingText) {
      next = {
        ...next,
        thinkingUntilByAgentId: recordThinkingActivity(
          next.thinkingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    }
  } else if (kind === "runtime-agent") {
    const payload = params.event.payload as AgentEventPayload | undefined;
    const agentId = resolveAgentIdForSessionKey(
      params.agents,
      payload?.sessionKey,
    );
    if (!payload || !agentId) return next;
    if (payload.runId) {
      next = {
        ...next,
        workingUntilByAgentId: recordWorkingActivity(
          next.workingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    }
    const thinkingText = extractThinking(payload.data ?? payload)?.trim() ?? "";
    const streamText =
      payload.data && typeof payload.data === "object"
        ? typeof (payload.data as Record<string, unknown>).text === "string"
          ? String((payload.data as Record<string, unknown>).text).trim()
          : typeof (payload.data as Record<string, unknown>).delta === "string"
            ? String((payload.data as Record<string, unknown>).delta).trim()
            : ""
        : "";
    if (thinkingText || isReasoningRuntimeAgentStream(payload.stream ?? "")) {
      next = {
        ...next,
        thinkingUntilByAgentId: recordThinkingActivity(
          next.thinkingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    } else if (streamText) {
      next = {
        ...next,
        streamingUntilByAgentId: recordStreamingActivity(
          next.streamingUntilByAgentId,
          agentId,
          nowMs,
        ),
      };
    }
  }

  const requested = parseExecApprovalRequested(params.event);
  if (requested) {
    const approvalAgentId = resolveExecApprovalAgentId({
      requested,
      agents: params.agents,
    });
    if (approvalAgentId) {
      next = {
        ...next,
        workingUntilByAgentId: recordWorkingActivity(
          next.workingUntilByAgentId,
          approvalAgentId,
          nowMs,
        ),
      };
    }
  }

  const resolved = parseExecApprovalResolved(params.event);
  if (resolved) {
    const approvalAgentId = params.agents.find((agent) => agent.awaitingUserInput)?.agentId;
    if (approvalAgentId) {
      next = {
        ...next,
        workingUntilByAgentId: recordWorkingActivity(
          next.workingUntilByAgentId,
          approvalAgentId,
          nowMs,
        ),
      };
    }
  }

  return next;
};

export const reconcileOfficeAnimationTriggerState = (params: {
  agents: AgentState[];
  nowMs?: number;
  state: OfficeAnimationTriggerState;
}): OfficeAnimationTriggerState => {
  // Reconciliation is the durable source of truth. It replays the latest user-visible intent
  // from current agent state so recovered history can restore holds even when chat events were missed.
  const nowMs = params.nowMs ?? Date.now();
  const next = pruneOfficeAnimationTriggerState(params.state, params.agents, nowMs);

  const activeAgentIds = new Set(params.agents.map((agent) => agent.agentId));
  const currentImmediateGymKeys = pruneStringMap(
    next.lastManualGymCommandKeyByAgentId,
    activeAgentIds,
  );

  const deskHoldByAgentId: BooleanByAgentId = {};
  const deskDirectiveKeyByAgentId: StringByAgentId = {};
  const githubHoldByAgentId: BooleanByAgentId = {};
  const githubDirectiveKeyByAgentId: StringByAgentId = {};
  const phoneCallByAgentId: PhoneCallByAgentId = {};
  const phoneCallDirectiveKeyByAgentId: StringByAgentId = {};
  const pingPongHoldByAgentId: BooleanByAgentId = {};
  const pingPongDirectiveKeyByAgentId: StringByAgentId = {};
  const qaHoldByAgentId: BooleanByAgentId = {};
  const qaDirectiveKeyByAgentId: StringByAgentId = {};
  const skillGymHoldByAgentId: BooleanByAgentId = {};
  const skillGymDirectiveKeyByAgentId: StringByAgentId = {};
  const textMessageByAgentId: TextMessageByAgentId = {};
  const textMessageDirectiveKeyByAgentId: StringByAgentId = {};
  let workingUntilByAgentId = next.workingUntilByAgentId;
  const manualGymUntilByAgentId = next.manualGymUntilByAgentId;
  let pendingStandupRequest = next.pendingStandupRequest;

  for (const agent of params.agents) {
    const agentId = agent.agentId;
    const isAgentRunning = agent.status === "running" || Boolean(agent.runId);
    if (isAgentRunning) {
      workingUntilByAgentId = recordWorkingActivity(
        workingUntilByAgentId,
        agentId,
        nowMs,
      );
    }

    const deskDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: resolveOfficeDeskDirective,
    });
    if (deskDirective) {
      deskDirectiveKeyByAgentId[agentId] = deskDirective.key;
      if (
        applyHoldDirective(
          Boolean(next.deskHoldByAgentId[agentId]),
          deskDirective,
        )
      ) {
        deskHoldByAgentId[agentId] = true;
      }
    } else if (next.deskHoldByAgentId[agentId]) {
      deskHoldByAgentId[agentId] = true;
    }

    const githubDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: resolveOfficeGithubDirective,
    });
    if (githubDirective) {
      githubDirectiveKeyByAgentId[agentId] = githubDirective.key;
      const suppressedKey = next.suppressedGithubDirectiveKeyByAgentId[agentId] ?? "";
      if (
        githubDirective.directive !== "release" &&
        suppressedKey !== githubDirective.key
      ) {
        githubHoldByAgentId[agentId] = true;
      }
    } else if (next.githubHoldByAgentId[agentId]) {
      githubHoldByAgentId[agentId] = true;
    }

    const qaDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: resolveOfficeQaDirective,
    });
    if (qaDirective) {
      qaDirectiveKeyByAgentId[agentId] = qaDirective.key;
      const suppressedKey = next.suppressedQaDirectiveKeyByAgentId[agentId] ?? "";
      if (qaDirective.directive !== "release" && suppressedKey !== qaDirective.key) {
        qaHoldByAgentId[agentId] = true;
      }
    } else if (next.qaHoldByAgentId[agentId]) {
      qaHoldByAgentId[agentId] = true;
    }

    const pingPongDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: (value) => resolveOfficePingPongDirective(value) ? "pingpong" as const : null,
    });
    if (pingPongDirective) {
      pingPongDirectiveKeyByAgentId[agentId] = pingPongDirective.key;
      pingPongHoldByAgentId[agentId] = true;
    } else if (next.pingPongHoldByAgentId[agentId]) {
      pingPongHoldByAgentId[agentId] = true;
    }

    const skillGymDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: resolveOfficeGymDirective,
    });
    if (skillGymDirective) {
      skillGymDirectiveKeyByAgentId[agentId] = skillGymDirective.key;
      if (skillGymDirective.directive === "gym") {
        skillGymHoldByAgentId[agentId] = true;
      }
    } else if (next.skillGymHoldByAgentId[agentId]) {
      skillGymHoldByAgentId[agentId] = true;
    }

    const standupDirective = resolveLatestDirective({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      resolver: resolveOfficeStandupDirective,
    });
    if (
      agentId === "main" &&
      standupDirective &&
      pendingStandupRequest?.key !== standupDirective.key
    ) {
      pendingStandupRequest = {
        key: standupDirective.key,
        message: standupDirective.text,
        requestedAt: nowMs,
      };
    }

    const phoneCallRequest = resolveLatestPhoneCallRequest({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      nowMs,
    });
    if (phoneCallRequest) {
      phoneCallDirectiveKeyByAgentId[agentId] = phoneCallRequest.key;
      const suppressedKey =
        next.suppressedPhoneCallDirectiveKeyByAgentId[agentId] ?? "";
      if (suppressedKey !== phoneCallRequest.key) {
        phoneCallByAgentId[agentId] = phoneCallRequest;
      }
    }

    const textMessageRequest = resolveLatestTextMessageRequest({
      lastUserMessage: agent.lastUserMessage,
      transcriptEntries: agent.transcriptEntries,
      nowMs,
    });
    if (textMessageRequest) {
      textMessageDirectiveKeyByAgentId[agentId] = textMessageRequest.key;
      const suppressedKey =
        next.suppressedTextMessageDirectiveKeyByAgentId[agentId] ?? "";
      if (suppressedKey !== textMessageRequest.key) {
        textMessageByAgentId[agentId] = textMessageRequest;
      }
    }
  }

  const triggeredAgentIds = resolveResetAgentIds({
    previous: next.sessionEpochSnapshot,
    agents: params.agents,
  });
  const agentMap = new Map(params.agents.map((agent) => [agent.agentId, agent]));
  const cleaningCues = [...next.cleaningCues];
  for (const agentId of triggeredAgentIds) {
    const agent = agentMap.get(agentId);
    if (!agent) continue;
    cleaningCues.unshift({
      id: randomUUID(),
      agentId,
      agentName: agent.name || "Agent",
      ts: nowMs,
    });
  }

  return {
    ...next,
    cleaningCues: cleaningCues.slice(0, CLEANING_CUE_LIMIT),
    deskDirectiveKeyByAgentId,
    deskHoldByAgentId,
    githubDirectiveKeyByAgentId,
    githubHoldByAgentId,
    lastManualGymCommandKeyByAgentId: currentImmediateGymKeys,
    manualGymUntilByAgentId,
    pendingStandupRequest,
    phoneCallByAgentId,
    phoneCallDirectiveKeyByAgentId,
    pingPongDirectiveKeyByAgentId,
    pingPongHoldByAgentId,
    qaDirectiveKeyByAgentId,
    qaHoldByAgentId,
    sessionEpochSnapshot: buildSessionEpochSnapshot(params.agents),
    skillGymDirectiveKeyByAgentId,
    skillGymHoldByAgentId,
    textMessageByAgentId,
    textMessageDirectiveKeyByAgentId,
    workingUntilByAgentId,
  };
};

export const clearOfficeAnimationTriggerHold = (params: {
  agentId: string;
  hold: "github" | "qa" | "call" | "text";
  state: OfficeAnimationTriggerState;
}): OfficeAnimationTriggerState => {
  const next = { ...params.state };
  if (params.hold === "github") {
    const directiveKey = next.githubDirectiveKeyByAgentId[params.agentId] ?? "";
    const githubHoldByAgentId = { ...next.githubHoldByAgentId };
    delete githubHoldByAgentId[params.agentId];
    return {
      ...next,
      githubHoldByAgentId,
      suppressedGithubDirectiveKeyByAgentId: directiveKey
        ? {
            ...next.suppressedGithubDirectiveKeyByAgentId,
            [params.agentId]: directiveKey,
          }
        : next.suppressedGithubDirectiveKeyByAgentId,
    };
  }
  if (params.hold === "call") {
    const directiveKey = next.phoneCallDirectiveKeyByAgentId[params.agentId] ?? "";
    const phoneCallByAgentId = { ...next.phoneCallByAgentId };
    delete phoneCallByAgentId[params.agentId];
    return {
      ...next,
      phoneCallByAgentId,
      suppressedPhoneCallDirectiveKeyByAgentId: directiveKey
        ? {
            ...next.suppressedPhoneCallDirectiveKeyByAgentId,
            [params.agentId]: directiveKey,
          }
        : next.suppressedPhoneCallDirectiveKeyByAgentId,
    };
  }
  if (params.hold === "text") {
    const directiveKey = next.textMessageDirectiveKeyByAgentId[params.agentId] ?? "";
    const textMessageByAgentId = { ...next.textMessageByAgentId };
    delete textMessageByAgentId[params.agentId];
    return {
      ...next,
      textMessageByAgentId,
      suppressedTextMessageDirectiveKeyByAgentId: directiveKey
        ? {
            ...next.suppressedTextMessageDirectiveKeyByAgentId,
            [params.agentId]: directiveKey,
          }
        : next.suppressedTextMessageDirectiveKeyByAgentId,
    };
  }
  const directiveKey = next.qaDirectiveKeyByAgentId[params.agentId] ?? "";
  const qaHoldByAgentId = { ...next.qaHoldByAgentId };
  delete qaHoldByAgentId[params.agentId];
  return {
    ...next,
    qaHoldByAgentId,
    suppressedQaDirectiveKeyByAgentId: directiveKey
      ? {
          ...next.suppressedQaDirectiveKeyByAgentId,
          [params.agentId]: directiveKey,
        }
      : next.suppressedQaDirectiveKeyByAgentId,
  };
};

export const buildOfficeAnimationState = (params: {
  agents: AgentState[];
  marketplaceGymHoldByAgentId?: BooleanByAgentId;
  nowMs?: number;
  state: OfficeAnimationTriggerState;
}): OfficeAnimationState => {
  // This final projection is intentionally smaller than the trigger state because the scene
  // only needs present-tense booleans and timers, not the bookkeeping used to derive them.
  const nowMs = params.nowMs ?? Date.now();
  const marketplaceGymHoldByAgentId = params.marketplaceGymHoldByAgentId ?? {};
  const awaitingApprovalByAgentId: BooleanByAgentId = {};
  const deskHoldByAgentId: BooleanByAgentId = {};
  const gymHoldByAgentId: BooleanByAgentId = {};
  const phoneBoothHoldByAgentId: BooleanByAgentId = {};
  const phoneCallByAgentId: PhoneCallByAgentId = {};
  const smsBoothHoldByAgentId: BooleanByAgentId = {};
  const streamingByAgentId: BooleanByAgentId = {};
  const textMessageByAgentId: TextMessageByAgentId = {};
  const thinkingByAgentId: BooleanByAgentId = {};

  for (const agent of params.agents) {
    const agentId = agent.agentId;
    if (agent.awaitingUserInput) {
      awaitingApprovalByAgentId[agentId] = true;
    }
    if (
      params.state.skillGymHoldByAgentId[agentId] ||
      marketplaceGymHoldByAgentId[agentId] ||
      (params.state.manualGymUntilByAgentId[agentId] ?? 0) > nowMs ||
      (params.state.gymCooldownUntilByAgentId[agentId] ?? 0) > nowMs
    ) {
      gymHoldByAgentId[agentId] = true;
    }
    if ((params.state.streamingUntilByAgentId[agentId] ?? 0) > nowMs) {
      streamingByAgentId[agentId] = true;
    }
    if ((params.state.thinkingUntilByAgentId[agentId] ?? 0) > nowMs) {
      thinkingByAgentId[agentId] = true;
    }
    const phoneCallRequest = params.state.phoneCallByAgentId[agentId];
    if (phoneCallRequest) {
      phoneCallByAgentId[agentId] = phoneCallRequest;
      if (phoneCallRequest.phase === "ready_to_call") {
        phoneBoothHoldByAgentId[agentId] = true;
      }
    }
    const textMessageRequest = params.state.textMessageByAgentId[agentId];
    if (textMessageRequest) {
      textMessageByAgentId[agentId] = textMessageRequest;
      if (textMessageRequest.phase === "ready_to_send") {
        smsBoothHoldByAgentId[agentId] = true;
      }
    }
    if (params.state.deskHoldByAgentId[agentId] && !gymHoldByAgentId[agentId]) {
      deskHoldByAgentId[agentId] = true;
    }
  }

  return {
    awaitingApprovalByAgentId,
    cleaningCues: params.state.cleaningCues,
    deskHoldByAgentId,
    githubHoldByAgentId: params.state.githubHoldByAgentId,
    gymHoldByAgentId,
    manualGymUntilByAgentId: params.state.manualGymUntilByAgentId,
    pendingStandupRequest: params.state.pendingStandupRequest,
    phoneBoothHoldByAgentId,
    phoneCallByAgentId,
    pingPongHoldByAgentId: params.state.pingPongHoldByAgentId,
    qaHoldByAgentId: params.state.qaHoldByAgentId,
    smsBoothHoldByAgentId,
    skillGymHoldByAgentId: params.state.skillGymHoldByAgentId,
    streamingByAgentId,
    textMessageByAgentId,
    thinkingByAgentId,
    workingUntilByAgentId: params.state.workingUntilByAgentId,
  };
};
