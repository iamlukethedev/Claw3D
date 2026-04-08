import type { AgentState } from "@/features/agents/state/store";
import { logTranscriptDebugMetric } from "@/features/agents/state/transcript";
import {
  classifyGatewayEventKind,
  getChatSummaryPatch,
  resolveAssistantCompletionTimestamp,
  type AgentEventPayload,
  type ChatEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import { decideSummaryRefreshEvent } from "@/features/agents/state/runtimeEventPolicy";
import { isClosedRun } from "@/features/agents/state/runtimeTerminalWorkflow";
import {
  createRuntimeEventCoordinatorState,
  markChatRunSeen,
  pruneRuntimeEventCoordinatorState,
  reduceClearRunTracking,
  reduceLifecycleFallbackFired,
  reduceMarkActivityThrottled,
  reduceRuntimeAgentWorkflowCommands,
  reduceRuntimeChatWorkflowCommands,
  reduceRuntimePolicyIntents,
  type RuntimeCoordinatorDispatchAction,
  type RuntimeCoordinatorEffectCommand,
} from "@/features/agents/state/runtimeEventCoordinatorWorkflow";
import {
  type EventFrame,
  isSameSessionKey,
} from "@/lib/gateway/GatewayClient";
import { parseAgentIdFromSessionKey } from "@/lib/gateway/sessionKeys";
import { normalizeAssistantDisplayText } from "@/lib/text/assistantText";
import {
  extractText,
  extractThinking,
  extractToolLines,
  isTraceMarkdown,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import { planRuntimeChatEvent } from "@/features/agents/state/runtimeChatEventWorkflow";
import { planRuntimeAgentEvent } from "@/features/agents/state/runtimeAgentEventWorkflow";

// This module is the runtime event orchestrator. It keeps one gateway intake path, maps
// transport-specific session keys back to agents, delegates stream-specific planning to the
// workflow modules, and executes the coordinator's dispatch/effect commands.
export type GatewayRuntimeEventHandlerDeps = {
  getStatus: () => "disconnected" | "connecting" | "connected";
  getAgents: () => AgentState[];
  dispatch: (action: RuntimeCoordinatorDispatchAction) => void;
  queueLivePatch: (agentId: string, patch: Partial<AgentState>) => void;
  clearPendingLivePatch: (agentId: string) => void;
  now?: () => number;

  loadSummarySnapshot: () => Promise<void>;
  requestHistoryRefresh: (command: {
    agentId: string;
    reason: "chat-final-no-trace" | "run-start-no-chat";
    sessionKey?: string;
  }) => Promise<void> | void;
  refreshHeartbeatLatestUpdate: () => void;
  bumpHeartbeatTick: () => void;

  setTimeout: (fn: () => void, delayMs: number) => number;
  clearTimeout: (id: number) => void;

  isDisconnectLikeError: (err: unknown) => boolean;
  logWarn?: (message: string, meta?: unknown) => void;
  shouldSuppressRunAbortedLine?: (params: {
    agentId: string;
    runId: string | null;
    sessionKey: string;
    stopReason: string | null;
  }) => boolean;

  updateSpecialLatestUpdate: (agentId: string, agent: AgentState, message: string) => void;
};

export type GatewayRuntimeEventHandler = {
  handleEvent: (event: EventFrame) => void;
  clearRunTracking: (runId?: string | null) => void;
  dispose: () => void;
};

const findAgentBySessionKey = (agents: AgentState[], sessionKey: string): string | null => {
  const exact = agents.find((agent) => isSameSessionKey(agent.sessionKey, sessionKey));
  if (exact) return exact.agentId;
  // Transport sessions such as Telegram or WhatsApp can extend the canonical main session key.
  // Falling back to the parsed agent id keeps runtime recovery transport-agnostic.
  const parsedAgentId = parseAgentIdFromSessionKey(sessionKey);
  if (!parsedAgentId) return null;
  return agents.some((agent) => agent.agentId === parsedAgentId) ? parsedAgentId : null;
};

const findAgentByRunId = (agents: AgentState[], runId: string): string | null => {
  const match = agents.find((agent) => agent.runId === runId);
  return match ? match.agentId : null;
};

const resolveRole = (message: unknown) =>
  message && typeof message === "object"
    ? (message as Record<string, unknown>).role
    : null;

export function createGatewayRuntimeEventHandler(
  deps: GatewayRuntimeEventHandlerDeps
): GatewayRuntimeEventHandler {
  const now = deps.now ?? (() => Date.now());
  const CLOSED_RUN_TTL_MS = 30_000;
  const LIFECYCLE_FALLBACK_DELAY_MS = 0;

  let coordinatorState = createRuntimeEventCoordinatorState();

  const lifecycleFallbackTimerIdByRun = new Map<string, number>();
  let summaryRefreshTimer: number | null = null;

  const toRunId = (runId?: string | null): string => runId?.trim() ?? "";

  const logWarn =
    deps.logWarn ??
    ((message: string, meta?: unknown) => {
      console.warn(message, meta);
    });

  const cancelLifecycleFallback = (runId?: string | null) => {
    const key = toRunId(runId);
    if (!key) return;
    const timerId = lifecycleFallbackTimerIdByRun.get(key);
    if (typeof timerId !== "number") return;
    deps.clearTimeout(timerId);
    lifecycleFallbackTimerIdByRun.delete(key);
  };

  const executeCoordinatorEffects = (effects: RuntimeCoordinatorEffectCommand[]) => {
    for (const effect of effects) {
      if (effect.kind === "dispatch") {
        deps.dispatch(effect.action);
        continue;
      }
      if (effect.kind === "queueLivePatch") {
        deps.queueLivePatch(effect.agentId, effect.patch);
        continue;
      }
      if (effect.kind === "clearPendingLivePatch") {
        deps.clearPendingLivePatch(effect.agentId);
        continue;
      }
      if (effect.kind === "requestHistoryRefresh") {
        deps.setTimeout(() => {
          void deps.requestHistoryRefresh({
            agentId: effect.agentId,
            reason: effect.reason,
            sessionKey: effect.sessionKey,
          });
        }, effect.deferMs);
        continue;
      }
      if (effect.kind === "scheduleSummaryRefresh") {
        if (effect.includeHeartbeatRefresh) {
          deps.bumpHeartbeatTick();
          deps.refreshHeartbeatLatestUpdate();
        }
        if (summaryRefreshTimer !== null) {
          deps.clearTimeout(summaryRefreshTimer);
        }
        summaryRefreshTimer = deps.setTimeout(() => {
          summaryRefreshTimer = null;
          void deps.loadSummarySnapshot();
        }, effect.delayMs);
        continue;
      }
      if (effect.kind === "cancelLifecycleFallback") {
        cancelLifecycleFallback(effect.runId);
        continue;
      }
      if (effect.kind === "scheduleLifecycleFallback") {
        const fallbackTimerId = deps.setTimeout(() => {
          lifecycleFallbackTimerIdByRun.delete(effect.runId);
          const fallbackReduced = reduceLifecycleFallbackFired({
            state: coordinatorState,
            runId: effect.runId,
            agentId: effect.agentId,
            sessionKey: effect.sessionKey,
            finalText: effect.finalText,
            transitionPatch: effect.transitionPatch,
            nowMs: now(),
            options: { closedRunTtlMs: CLOSED_RUN_TTL_MS },
          });
          coordinatorState = fallbackReduced.state;
          executeCoordinatorEffects(fallbackReduced.effects);
        }, effect.delayMs);
        lifecycleFallbackTimerIdByRun.set(effect.runId, fallbackTimerId);
        continue;
      }
      if (effect.kind === "appendAbortedIfNotSuppressed") {
        const suppressAbortedLine =
          deps.shouldSuppressRunAbortedLine?.({
            agentId: effect.agentId,
            runId: effect.runId,
            sessionKey: effect.sessionKey,
            stopReason: effect.stopReason,
          }) ?? false;
        if (!suppressAbortedLine) {
          deps.dispatch({
            type: "appendOutput",
            agentId: effect.agentId,
            line: "Run aborted.",
            transcript: {
              source: "runtime-chat",
              runId: effect.runId,
              sessionKey: effect.sessionKey,
              timestampMs: effect.timestampMs,
              role: "assistant",
              kind: "assistant",
            },
          });
        }
        continue;
      }
      if (effect.kind === "logMetric") {
        logTranscriptDebugMetric(effect.metric, effect.meta);
        continue;
      }
      if (effect.kind === "logWarn") {
        logWarn(effect.message, effect.meta);
        continue;
      }
      if (effect.kind === "updateSpecialLatest") {
        const agent =
          effect.agentSnapshot?.agentId === effect.agentId
            ? effect.agentSnapshot
            : deps.getAgents().find((entry) => entry.agentId === effect.agentId);
        if (agent) {
          void deps.updateSpecialLatestUpdate(effect.agentId, agent, effect.message);
        }
      }
    }
  };

  const clearRunTracking = (runId?: string | null) => {
    const cleared = reduceClearRunTracking({
      state: coordinatorState,
      runId,
    });
    coordinatorState = cleared.state;
    executeCoordinatorEffects(cleared.effects);
  };

  const pruneCoordinatorState = (at: number = now()) => {
    const pruned = pruneRuntimeEventCoordinatorState({
      state: coordinatorState,
      at,
    });
    coordinatorState = pruned.state;
    executeCoordinatorEffects(pruned.effects);
  };

  const dispose = () => {
    if (summaryRefreshTimer !== null) {
      deps.clearTimeout(summaryRefreshTimer);
      summaryRefreshTimer = null;
    }
    for (const timerId of lifecycleFallbackTimerIdByRun.values()) {
      deps.clearTimeout(timerId);
    }
    lifecycleFallbackTimerIdByRun.clear();
    coordinatorState = createRuntimeEventCoordinatorState();
  };

  const handleRuntimeChatEvent = (payload: ChatEventPayload) => {
    if (!payload.sessionKey) return;
    pruneCoordinatorState();

    if (
      payload.runId &&
      payload.state === "delta" &&
      isClosedRun(coordinatorState.runtimeTerminalState, payload.runId)
    ) {
      logTranscriptDebugMetric("late_event_ignored_closed_run", {
        stream: "chat",
        state: payload.state,
        runId: payload.runId,
      });
      return;
    }

    coordinatorState = markChatRunSeen(coordinatorState, payload.runId);

    const agentsSnapshot = deps.getAgents();
    const agentId = findAgentBySessionKey(agentsSnapshot, payload.sessionKey);
    if (!agentId) return;
    const agent = agentsSnapshot.find((entry) => entry.agentId === agentId);
    const activeRunId = agent?.runId?.trim() ?? "";
    const role = resolveRole(payload.message);
    const nowMs = now();

    if (payload.runId && activeRunId && activeRunId !== payload.runId) {
      clearRunTracking(payload.runId);
      return;
    }
    if (
      !activeRunId &&
      agent?.status !== "running" &&
      payload.state === "delta" &&
      role !== "user" &&
      role !== "system"
    ) {
      clearRunTracking(payload.runId ?? null);
      return;
    }

    const summaryPatch = getChatSummaryPatch(payload, nowMs);
    if (summaryPatch) {
      deps.dispatch({
        type: "updateAgent",
        agentId,
        patch: {
          ...summaryPatch,
          sessionCreated: true,
        },
      });
    }

    if (role === "user" || role === "system") {
      return;
    }

    const activityReduced = reduceMarkActivityThrottled({
      state: coordinatorState,
      agentId,
      at: nowMs,
    });
    coordinatorState = activityReduced.state;
    executeCoordinatorEffects(activityReduced.effects);

    const nextTextRaw = extractText(payload.message);
    const nextText = nextTextRaw ? stripUiMetadata(nextTextRaw) : null;
    const nextThinking = extractThinking(payload.message ?? payload);
    const toolLines = extractToolLines(payload.message ?? payload);
    const isToolRole = role === "tool" || role === "toolResult";
    const assistantCompletionAt = resolveAssistantCompletionTimestamp({
      role,
      state: payload.state,
      message: payload.message,
      now: now(),
    });
    const normalizedAssistantFinalText =
      payload.state === "final" &&
      role === "assistant" &&
      !isToolRole &&
      typeof nextText === "string"
        ? normalizeAssistantDisplayText(nextText)
        : null;
    const finalAssistantText =
      normalizedAssistantFinalText && normalizedAssistantFinalText.length > 0
        ? normalizedAssistantFinalText
        : null;

    const chatWorkflow = planRuntimeChatEvent({
      payload,
      agentId,
      agent,
      activeRunId: activeRunId || null,
      runtimeTerminalState: coordinatorState.runtimeTerminalState,
      role,
      nowMs,
      nextTextRaw,
      nextText,
      nextThinking,
      toolLines,
      isToolRole,
      assistantCompletionAt,
      finalAssistantText,
      hasThinkingStarted: payload.runId
        ? coordinatorState.thinkingStartedAtByRun.has(payload.runId)
        : false,
      hasTraceInOutput:
        agent?.outputLines.some((line) => isTraceMarkdown(line.trim())) ?? false,
      isThinkingDebugSessionSeen: coordinatorState.thinkingDebugBySession.has(
        payload.sessionKey
      ),
      thinkingStartedAtMs: payload.runId
        ? (coordinatorState.thinkingStartedAtByRun.get(payload.runId) ?? null)
        : null,
    });

    const reduced = reduceRuntimeChatWorkflowCommands({
      state: coordinatorState,
      payload,
      agentId,
      agent,
      commands: chatWorkflow.commands,
      nowMs,
      options: { closedRunTtlMs: CLOSED_RUN_TTL_MS },
    });
    coordinatorState = reduced.state;
    executeCoordinatorEffects(reduced.effects);
  };

  const handleRuntimeAgentEvent = (payload: AgentEventPayload) => {
    if (!payload.runId) return;
    pruneCoordinatorState();

    const agentsSnapshot = deps.getAgents();
    const directMatch = payload.sessionKey
      ? findAgentBySessionKey(agentsSnapshot, payload.sessionKey)
      : null;
    const agentId = directMatch ?? findAgentByRunId(agentsSnapshot, payload.runId);
    if (!agentId) return;
    const agent = agentsSnapshot.find((entry) => entry.agentId === agentId);
    if (!agent) return;

    const nowMs = now();
    const agentWorkflow = planRuntimeAgentEvent({
      payload,
      agent,
      activeRunId: agent.runId?.trim() || null,
      nowMs,
      runtimeTerminalState: coordinatorState.runtimeTerminalState,
      hasChatEvents: coordinatorState.chatRunSeen.has(payload.runId),
      hasPendingFallbackTimer: lifecycleFallbackTimerIdByRun.has(
        toRunId(payload.runId)
      ),
      previousThinkingRaw: coordinatorState.thinkingStreamByRun.get(payload.runId) ?? null,
      previousAssistantRaw:
        coordinatorState.assistantStreamByRun.get(payload.runId) ?? null,
      thinkingStartedAtMs:
        coordinatorState.thinkingStartedAtByRun.get(payload.runId) ?? null,
      historyRefreshRequested:
        coordinatorState.historyRefreshRequestedByRun.has(payload.runId),
      lifecycleFallbackDelayMs: LIFECYCLE_FALLBACK_DELAY_MS,
    });

    const reduced = reduceRuntimeAgentWorkflowCommands({
      state: coordinatorState,
      payload,
      agentId,
      agent,
      commands: agentWorkflow.commands,
      nowMs,
      options: { closedRunTtlMs: CLOSED_RUN_TTL_MS },
    });
    coordinatorState = reduced.state;
    executeCoordinatorEffects(reduced.effects);
  };

  const handleEvent = (event: EventFrame) => {
    const eventKind = classifyGatewayEventKind(event.event);

    // Summary refresh events share the same intake path, but they bypass stream planners and
    // go straight through policy intents because they do not carry transcript-bearing runtime data.
    if (eventKind === "summary-refresh") {
      const summaryIntents = decideSummaryRefreshEvent({
        event: event.event,
        status: deps.getStatus(),
      });
      const reduced = reduceRuntimePolicyIntents({
        state: coordinatorState,
        intents: summaryIntents,
        nowMs: now(),
        options: { closedRunTtlMs: CLOSED_RUN_TTL_MS },
      });
      coordinatorState = reduced.state;
      executeCoordinatorEffects(reduced.effects);
      return;
    }

    if (eventKind === "runtime-chat") {
      const payload = event.payload as ChatEventPayload | undefined;
      if (!payload) return;
      handleRuntimeChatEvent(payload);
      return;
    }

    if (eventKind === "runtime-agent") {
      const payload = event.payload as AgentEventPayload | undefined;
      if (!payload) return;
      handleRuntimeAgentEvent(payload);
    }
  };

  return { handleEvent, clearRunTracking, dispose };
}
