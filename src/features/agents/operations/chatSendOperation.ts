import {
  isWebchatSessionMutationBlockedError,
  syncGatewaySessionSettings,
  type GatewayClient,
} from "@/lib/gateway/GatewayClient";
import {
  buildAgentInstruction,
  isMetaMarkdown,
  parseMetaMarkdown,
} from "@/lib/text/message-extract";
import type { AgentState } from "@/features/agents/state/store";
import { randomUUID } from "@/lib/uuid";
import type { TranscriptAppendMeta } from "@/features/agents/state/transcript";
import type { RuntimeAttachment } from "@/lib/runtime/types";

type SendDispatchAction =
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendOutput"; agentId: string; line: string; transcript?: TranscriptAppendMeta };

type SendDispatch = (action: SendDispatchAction) => void;

type GatewayClientLike = {
  call: (method: string, params: unknown) => Promise<unknown>;
};

const extractImmediateAssistantText = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as {
    text?: unknown;
    content?: unknown;
    message?: unknown;
  };
  if (typeof value.text === "string" && value.text.trim()) {
    return value.text.trim();
  }
  if (typeof value.content === "string" && value.content.trim()) {
    return value.content.trim();
  }
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }
  return null;
};

const resolveLatestTranscriptTimestampMs = (agent: AgentState): number | null => {
  const entries = agent.transcriptEntries;
  let latest: number | null = null;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const ts = entry?.timestampMs;
      if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
      latest = latest === null ? ts : Math.max(latest, ts);
    }
  }
  if (latest !== null) return latest;
  const lines = agent.outputLines;
  for (const line of lines) {
    if (!isMetaMarkdown(line)) continue;
    const parsed = parseMetaMarkdown(line);
    const ts = parsed?.timestamp;
    if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
    latest = latest === null ? ts : Math.max(latest, ts);
  }
  return latest;
};

const resolveChatSendCompletionMode = (
  payload: unknown,
  optimisticRunId: string
): "streaming-expected" | "terminal-immediate" => {
  if (!payload || typeof payload !== "object") {
    return "terminal-immediate";
  }
  const value = payload as { status?: unknown; runId?: unknown };
  const status = typeof value.status === "string" ? value.status.trim().toLowerCase() : "";
  const runId = typeof value.runId === "string" ? value.runId.trim() : "";
  if ((status === "started" || status === "in_flight") && runId === optimisticRunId) {
    return "streaming-expected";
  }
  return "terminal-immediate";
};

export async function sendChatMessageViaStudio(params: {
  client: GatewayClientLike;
  dispatch: SendDispatch;
  getAgent: (agentId: string) => AgentState | null;
  agentId: string;
  sessionKey: string;
  message: string;
  attachments?: RuntimeAttachment[];
  clearRunTracking?: (runId: string) => void;
  echoUserMessage?: boolean;
  now?: () => number;
  generateRunId?: () => string;
}): Promise<void> {
  const trimmed = params.message.trim();
  const attachments = params.attachments ?? [];
  if (!trimmed && attachments.length === 0) return;
  const echoUserMessage = params.echoUserMessage !== false;

  const generateRunId = params.generateRunId ?? (() => randomUUID());
  const now = params.now ?? (() => Date.now());

  const agentId = params.agentId;
  const runId = generateRunId();

  params.clearRunTracking?.(runId);

  const agent = params.getAgent(agentId);
  if (!agent) {
    params.dispatch({
      type: "appendOutput",
      agentId,
      line: "Error: Agent not found.",
    });
    return;
  }

  const isResetCommand = /^\/(reset|new)(\s|$)/i.test(trimmed);
  if (isResetCommand) {
    params.dispatch({
      type: "updateAgent",
      agentId,
      patch: {
        outputLines: [],
        streamText: null,
        thinkingTrace: null,
        lastResult: null,
        sessionEpoch: (agent.sessionEpoch ?? 0) + 1,
        transcriptEntries: [],
        lastHistoryRequestRevision: null,
        lastAppliedHistoryRequestId: null,
      },
    });
  }

  const userTimestamp = now();
  const latestTranscriptTimestamp = resolveLatestTranscriptTimestampMs(agent);
  const optimisticUserOrderTimestamp =
    typeof latestTranscriptTimestamp === "number"
      ? Math.max(userTimestamp, latestTranscriptTimestamp + 1)
      : userTimestamp;
  params.dispatch({
    type: "updateAgent",
    agentId,
    patch: {
      status: "running",
      runId,
      runStartedAt: userTimestamp,
      streamText: "",
      thinkingTrace: null,
      draft: "",
      ...(echoUserMessage ? { lastUserMessage: trimmed } : {}),
      lastActivityAt: userTimestamp,
    },
  });
  if (echoUserMessage) {
    params.dispatch({
      type: "appendOutput",
      agentId,
      line: `> ${trimmed}`,
      transcript: {
        source: "local-send",
        runId,
        sessionKey: params.sessionKey,
        timestampMs: optimisticUserOrderTimestamp,
        role: "user",
        kind: "user",
      },
    });
  }

  try {
    if (!params.sessionKey) {
      throw new Error("Missing session key for agent.");
    }

    let createdSession = agent.sessionCreated;
    if (!agent.sessionSettingsSynced) {
      try {
        await syncGatewaySessionSettings({
          client: params.client as unknown as GatewayClient,
          sessionKey: params.sessionKey,
          model: agent.model ?? null,
          thinkingLevel: agent.thinkingLevel ?? null,
          execHost: agent.sessionExecHost,
          execSecurity: agent.sessionExecSecurity,
          execAsk: agent.sessionExecAsk,
        });
        createdSession = true;
        params.dispatch({
          type: "updateAgent",
          agentId,
          patch: { sessionSettingsSynced: true, sessionCreated: true },
        });
      } catch (syncError) {
        if (!isWebchatSessionMutationBlockedError(syncError)) {
          throw syncError;
        }
        createdSession = true;
        params.dispatch({
          type: "updateAgent",
          agentId,
          patch: { sessionSettingsSynced: true, sessionCreated: true },
        });
      }
    }

    const sendResult = await params.client.call("chat.send", {
      sessionKey: params.sessionKey,
      message: buildAgentInstruction({ message: trimmed }),
      ...(attachments.length > 0 ? { attachments } : {}),
      deliver: false,
      idempotencyKey: runId,
    });

    if (!createdSession) {
      params.dispatch({
        type: "updateAgent",
        agentId,
        patch: { sessionCreated: true },
      });
    }

    if (resolveChatSendCompletionMode(sendResult, runId) === "terminal-immediate") {
      const assistantText = extractImmediateAssistantText(sendResult);
      if (assistantText) {
        const assistantTimestamp = now();
        params.dispatch({
          type: "appendOutput",
          agentId,
          line: assistantText,
          transcript: {
            source: "local-send",
            runId,
            sessionKey: params.sessionKey,
            timestampMs: assistantTimestamp,
            role: "assistant",
            kind: "assistant",
          },
        });
        params.dispatch({
          type: "updateAgent",
          agentId,
          patch: {
            lastResult: assistantText,
            latestPreview: assistantText,
            lastAssistantMessageAt: assistantTimestamp,
            lastActivityAt: assistantTimestamp,
          },
        });
      }
      params.dispatch({
        type: "updateAgent",
        agentId,
        patch: {
          status: "idle",
          runId: null,
          runStartedAt: null,
          streamText: null,
          thinkingTrace: null,
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gateway error";
    params.dispatch({
      type: "updateAgent",
      agentId,
      patch: { status: "error", runId: null, runStartedAt: null, streamText: null, thinkingTrace: null },
    });
    params.dispatch({
      type: "appendOutput",
      agentId,
      line: `Error: ${msg}`,
    });
  }
}
