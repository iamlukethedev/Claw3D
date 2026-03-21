"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, ChevronDown, Mic } from "lucide-react";
import { RetroOffice3D } from "@/features/retro-office/RetroOffice3D";
import type { OfficeAgent } from "@/features/retro-office/core/types";
import { GatewayConnectScreen } from "@/features/agents/components/GatewayConnectScreen";
import { useAgentStore, type AgentState } from "@/features/agents/state/store";
import {
  useGatewayConnection,
  type EventFrame,
  isSameSessionKey,
  parseAgentIdFromSessionKey,
} from "@/lib/gateway/GatewayClient";
import {
  createStudioSettingsCoordinator,
  type StudioSettingsLoadOptions,
} from "@/lib/studio/coordinator";
import { resolveDeskAssignments } from "@/lib/studio/settings";
import { renameGatewayAgent } from "@/lib/gateway/agentConfig";
import {
  runStudioBootstrapLoadOperation,
  executeStudioBootstrapLoadCommands,
} from "@/features/agents/operations/studioBootstrapOperation";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  buildHistoryLines,
  classifyGatewayEventKind,
  isReasoningRuntimeAgentStream,
  type AgentEventPayload,
  type ChatEventPayload,
  type SummaryPreviewSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import {
  extractText,
  extractThinking,
  extractToolLines,
  isHeartbeatPrompt,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import { resolveOfficeIntentSnapshot } from "@/lib/office/deskDirectives";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import {
  AgentEditorModal,
  type AgentEditorSection,
} from "@/features/agents/components/AgentEditorModal";
import { useChatInteractionController } from "@/features/agents/operations/useChatInteractionController";
import {
  executeHistorySyncCommands,
  runHistorySyncOperation,
} from "@/features/agents/operations/historySyncOperation";
import {
  RUNTIME_SYNC_DEFAULT_HISTORY_LIMIT,
  RUNTIME_SYNC_MAX_HISTORY_LIMIT,
} from "@/features/agents/operations/runtimeSyncControlWorkflow";
import {
  TRANSCRIPT_V2_ENABLED,
  logTranscriptDebugMetric,
} from "@/features/agents/state/transcript";
import {
  buildGatewayModelChoices,
  type GatewayModelChoice,
} from "@/lib/gateway/models";
import type { GatewayModelPolicySnapshot } from "@/lib/gateway/models";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import { randomUUID } from "@/lib/uuid";
import {
  HQSidebar,
  type HQSidebarTab,
} from "@/features/office/components/HQSidebar";
import { AnalyticsPanel } from "@/features/office/components/panels/AnalyticsPanel";
import { HistoryPanel } from "@/features/office/components/panels/HistoryPanel";
import { InboxPanel } from "@/features/office/components/panels/InboxPanel";
import { PlaybooksPanel } from "@/features/office/components/panels/PlaybooksPanel";
import { SkillsMarketplacePanel } from "@/features/office/components/panels/SkillsMarketplacePanel";
import { useOfficeSkillsMarketplace } from "@/features/office/hooks/useOfficeSkillsMarketplace";
import { useOfficeStandupController } from "@/features/office/hooks/useOfficeStandupController";
import { useRunLog } from "@/features/office/hooks/useRunLog";
import {
  OnboardingWizard,
  useOnboardingState,
} from "@/features/onboarding";
import { useFinalizedAssistantReplyListener } from "@/hooks/useFinalizedAssistantReplyListener";
import { useStudioOfficePreference } from "@/hooks/useStudioOfficePreference";
import { useStudioVoiceRepliesPreference } from "@/hooks/useStudioVoiceRepliesPreference";
import {
  useVoiceRecorder,
  type VoiceSendPayload,
} from "@/hooks/useVoiceRecorder";
import { useVoiceReplyPlayback } from "@/hooks/useVoiceReplyPlayback";
import {
  buildOfficeAnimationState,
  clearOfficeAnimationTriggerHold,
  createOfficeAnimationTriggerState,
  reconcileOfficeAnimationTriggerState,
  reduceOfficeAnimationTriggerEvent,
  type OfficePhoneCallRequest,
  type OfficeTextMessageRequest,
} from "@/lib/office/eventTriggers";
import type { MockPhoneCallScenario } from "@/lib/office/call/types";
import type { MockTextMessageScenario } from "@/lib/office/text/types";
import {
  buildOfficeDeskMonitor,
  type OfficeDeskMonitor,
} from "@/lib/office/deskMonitor";
import type { StandupAgentSnapshot } from "@/lib/office/standup/types";
import type { SkillStatusEntry } from "@/lib/skills/types";

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

const ITEMS = [
  "globe",
  "books",
  "coffee",
  "palette",
  "camera",
  "waveform",
  "shield",
  "fire",
  "plant",
  "laptop",
];
const GYM_WORKOUT_LATCH_MS = 60_000;
const MAIN_AGENT_ID = "main";
const MAX_OPENCLAW_LOG_ENTRIES = 200;
const MAX_OPENCLAW_AGENT_OUTPUT_LINES = 12;

type OpenClawLogEntry = {
  id: string;
  timestamp: string;
  eventName: string;
  eventKind: string;
  summary: string;
  role: string | null;
  messageText: string | null;
  thinkingText: string | null;
  streamText: string | null;
  toolText: string | null;
  payloadText: string;
};

type PreparedPhoneCallEntry = {
  requestKey: string;
  scenario: MockPhoneCallScenario;
};

type PreparedTextMessageEntry = {
  requestKey: string;
  scenario: MockTextMessageScenario;
};

type PhoneCallSpeakPayload = {
  agentId: string;
  requestKey: string;
  scenario: MockPhoneCallScenario;
};

const createOpenClawLogEntry = (params: {
  eventName: string;
  eventKind: string;
  summary: string;
  payload?: unknown;
  role?: string | null;
  messageText?: string | null;
  thinkingText?: string | null;
  streamText?: string | null;
  toolText?: string | null;
}): OpenClawLogEntry => ({
  id: randomUUID(),
  timestamp: formatOpenClawTimestamp(Date.now()),
  eventName: params.eventName,
  eventKind: params.eventKind,
  summary: params.summary,
  role: params.role ?? null,
  messageText: params.messageText ?? null,
  thinkingText: params.thinkingText ?? null,
  streamText: params.streamText ?? null,
  toolText: params.toolText ?? null,
  payloadText: safeJsonStringify(params.payload ?? null),
});

const formatOpenClawTimestamp = (timestampMs: number) => {
  const date = new Date(timestampMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatOpenClawValue = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || "-";
};

const buildPhoneCallOutputLine = (text: string) => `[phone booth] ${text}`;
const buildTextMessageOutputLine = (text: string) => `[messaging booth] ${text}`;

const PHONE_BOOTH_ASSISTANT_FALLBACK_RE =
  /\b(?:i\s+)?can(?:not|['’]t)\s+(?:place|make)\s+(?:phone\s+)?calls?\b/i;

const shouldSuppressPhoneBoothAssistantReply = (params: {
  agents: AgentState[];
  event: EventFrame;
  phoneCallByAgentId: Record<string, OfficePhoneCallRequest>;
}): boolean => {
  if (classifyGatewayEventKind(params.event.event) !== "runtime-chat") return false;
  const payload = params.event.payload as ChatEventPayload | undefined;
  if (!payload?.sessionKey) return false;
  const message =
    typeof payload.message === "object" && payload.message !== null
      ? (payload.message as Record<string, unknown>)
      : null;
  const role = typeof message?.role === "string" ? message.role : null;
  if (role !== "assistant") return false;
  const text = extractText(payload.message)?.trim() ?? "";
  if (!text || !PHONE_BOOTH_ASSISTANT_FALLBACK_RE.test(text)) return false;
  const agentId =
    params.agents.find((agent) => agent.sessionKey === payload.sessionKey)?.agentId ??
    parseAgentIdFromSessionKey(payload.sessionKey);
  if (!agentId) return false;
  return Boolean(params.phoneCallByAgentId[agentId]);
};

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch (error) {
    return `[unserializable payload: ${error instanceof Error ? error.message : "unknown error"}]`;
  }
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderOpenClawHighlightedText = (
  value: string,
  query: string,
): ReactNode => {
  if (!query) return value;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return value;
  const pattern = new RegExp(`(${escapeRegExp(trimmedQuery)})`, "gi");
  return value.split(pattern).map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-300/25 px-0.5 text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

const resolveMessageRole = (message: unknown) =>
  message && typeof message === "object"
    ? ((message as Record<string, unknown>).role ?? null)
    : null;

const formatOpenClawEventLogEntry = (event: EventFrame): OpenClawLogEntry => {
  const eventKind = classifyGatewayEventKind(event.event);
  const baseSummary = `seq=${event.seq ?? "-"} stateVersion=${safeJsonStringify(event.stateVersion ?? null)}`;
  let summary = baseSummary;
  let role: string | null = null;
  let messageText: string | null = null;
  let thinkingText: string | null = null;
  let streamText: string | null = null;
  let toolText: string | null = null;

  if (eventKind === "runtime-chat") {
    const payload = event.payload as ChatEventPayload | undefined;
    if (payload) {
      role =
        typeof resolveMessageRole(payload.message) === "string"
          ? String(resolveMessageRole(payload.message))
          : null;
      const text = extractText(payload.message);
      const thinking = extractThinking(payload.message ?? payload);
      const toolLines = extractToolLines(payload.message ?? payload);
      summary = `chat session=${payload.sessionKey || "-"} run=${payload.runId || "-"} state=${payload.state} role=${String(role ?? "-")} stopReason=${payload.stopReason ?? "-"} | ${baseSummary}`;
      if (text) {
        messageText = stripUiMetadata(text).trim() || text.trim();
      }
      if (thinking) {
        thinkingText = thinking.trim();
      }
      if (toolLines.length > 0) {
        toolText = toolLines.join(" | ");
      }
    }
  } else if (eventKind === "runtime-agent") {
    const payload = event.payload as AgentEventPayload | undefined;
    if (payload) {
      const data =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : null;
      const phase = typeof data?.phase === "string" ? data.phase : "-";
      const text =
        typeof data?.text === "string"
          ? data.text
          : typeof data?.delta === "string"
            ? data.delta
            : "";
      const extractedThinking = extractThinking(data ?? payload);
      summary = `agent session=${payload.sessionKey || "-"} run=${payload.runId || "-"} stream=${payload.stream || "-"} phase=${phase} reasoning=${String(isReasoningRuntimeAgentStream(payload.stream ?? ""))} | ${baseSummary}`;
      if (extractedThinking) {
        thinkingText = extractedThinking.trim();
      } else if (text.trim()) {
        streamText = text.trim();
      }
    }
  }

  return createOpenClawLogEntry({
    eventName: event.event,
    eventKind,
    summary,
    role,
    messageText,
    thinkingText,
    streamText,
    toolText,
    payload: event.payload ?? null,
  });
};

const resolveLatestUserTextFromPreview = (
  previewResult: SummaryPreviewSnapshot | null | undefined,
  sessionKey: string,
): string | null => {
  const previews = Array.isArray(previewResult?.previews)
    ? previewResult.previews
    : [];
  const preview = previews.find((entry) => entry.key === sessionKey);
  if (!preview || !Array.isArray(preview.items)) return null;
  for (let index = preview.items.length - 1; index >= 0; index -= 1) {
    const item = preview.items[index];
    if (!item) continue;
    if (item.role === "assistant") continue;
    if (item.role === "user") {
      const text = item.text.trim();
      if (text) return text;
    }
  }
  return null;
};

const getDeterministicItem = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ITEMS[Math.abs(hash) % ITEMS.length];
};

const mapAgentToOffice = (agent: AgentState): OfficeAgent => {
  if (agent.status === "error") {
    return {
      id: agent.agentId,
      name: agent.name || "Unknown",
      status: "error",
      color: stringToColor(agent.agentId),
      item: getDeterministicItem(agent.agentId),
      avatarProfile: agent.avatarProfile ?? null,
    };
  }
  const isWorking = agent.status === "running" || Boolean(agent.runId);
  return {
    id: agent.agentId,
    name: agent.name || "Unknown",
    status: isWorking ? "working" : "idle",
    color: stringToColor(agent.agentId),
    item: getDeterministicItem(agent.agentId),
    avatarProfile: agent.avatarProfile ?? null,
  };
};

type ChatHistoryResult = {
  messages?: Array<Record<string, unknown>>;
};

type SessionsListEntry = {
  key?: string;
  updatedAt?: number | null;
  origin?: { label?: string | null } | null;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

type SessionsPreviewItem = {
  role?: string;
  text?: string;
};

type SessionsPreviewEntry = {
  key?: string;
  status?: string;
  items?: SessionsPreviewItem[];
};

type SessionsPreviewResult = {
  previews?: SessionsPreviewEntry[];
};

type HistoryInferenceResult = {
  inferredRunning: boolean;
  lastRole: string;
  lastText: string;
  messageCount: number;
};

type OfficeDebugRow = {
  agentId: string;
  name: string;
  storeStatus: AgentState["status"];
  runId: string | null;
  inferredRunning: boolean;
  lastRole: string;
  lastText: string;
  messageCount: number;
  detectedSessionKey: string;
  inspectedSessions: string;
  inferenceSource: string;
  at: string;
};

type OfficeFeedEvent = {
  id: string;
  name: string;
  text: string;
  ts: number;
  kind?: "status" | "reply";
};

const normalizeOfficeFeedText = (
  value: string | null | undefined,
  maxChars?: number,
): string => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (
    typeof maxChars !== "number" ||
    !Number.isFinite(maxChars) ||
    maxChars <= 0
  ) {
    return normalized;
  }
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

const resolveHistoryInference = (
  messages: Array<Record<string, unknown>>,
): HistoryInferenceResult => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    const role = typeof entry.role === "string" ? entry.role : "";
    if (role === "system" || role === "tool" || role === "toolResult") continue;
    const text =
      typeof entry.text === "string"
        ? entry.text.trim()
        : typeof entry.content === "string"
          ? entry.content.trim()
          : "";
    if (role === "assistant") {
      return {
        inferredRunning: false,
        lastRole: "assistant",
        lastText: text.slice(0, 120),
        messageCount: messages.length,
      };
    }
    if (role === "user") {
      const rawText = typeof entry.text === "string" ? entry.text : text;
      if (rawText && isHeartbeatPrompt(rawText)) continue;
      return {
        inferredRunning: true,
        lastRole: "user",
        lastText: rawText.slice(0, 120),
        messageCount: messages.length,
      };
    }
  }
  return {
    inferredRunning: false,
    lastRole: "none",
    lastText: "",
    messageCount: messages.length,
  };
};

const inferRunningFromAgentSessions = async (params: {
  client: {
    call: <T = unknown>(method: string, args: unknown) => Promise<T>;
  };
  agentId: string;
}): Promise<{
  inferredRunning: boolean;
  sessionKey: string;
  lastRole: string;
  lastText: string;
  messageCount: number;
  latestSessionUpdatedAtMs: number;
  inspectedSessions: string[];
  inferenceSource: string;
}> => {
  const sessionsResult = await params.client.call<SessionsListResult>(
    "sessions.list",
    {
      agentId: params.agentId,
      includeGlobal: false,
      includeUnknown: true,
      limit: 8,
    },
  );
  const sessions = (
    Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions : []
  )
    .filter(
      (entry) => typeof entry.key === "string" && entry.key.trim().length > 0,
    )
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, 4);
  const latestSessionUpdatedAtMs =
    typeof sessions[0]?.updatedAt === "number" &&
    Number.isFinite(sessions[0].updatedAt)
      ? sessions[0].updatedAt
      : 0;
  const inspectedSessions = sessions.map((entry) => {
    const key = entry.key?.trim() ?? "";
    const label = entry.origin?.label?.trim() ?? "";
    const updatedAt =
      typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
        ? new Date(entry.updatedAt).toISOString()
        : "n/a";
    const base = label ? `${key} [${label}]` : key;
    return `${base} @${updatedAt}`;
  });
  const sessionKeys = sessions
    .map((entry) => entry.key?.trim() ?? "")
    .filter((key) => key.length > 0);

  if (sessionKeys.length > 0) {
    const previewResult = await params.client.call<SessionsPreviewResult>(
      "sessions.preview",
      {
        keys: sessionKeys,
        limit: 8,
        maxChars: 240,
      },
    );
    const previews = Array.isArray(previewResult.previews)
      ? previewResult.previews
      : [];
    for (const preview of previews) {
      const key = typeof preview.key === "string" ? preview.key.trim() : "";
      const items = Array.isArray(preview.items) ? preview.items : [];
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];
        if (!item) continue;
        const role = typeof item.role === "string" ? item.role : "";
        const text = typeof item.text === "string" ? item.text.trim() : "";
        if (role === "system" || role === "tool" || role === "toolResult") {
          continue;
        }
        if (role === "assistant") break;
        if (role === "user") {
          if (text && isHeartbeatPrompt(text)) continue;
          return {
            inferredRunning: true,
            sessionKey: key,
            lastRole: "user",
            lastText: text.slice(0, 120),
            messageCount: items.length,
            latestSessionUpdatedAtMs,
            inspectedSessions,
            inferenceSource: "sessions.preview.user-tail",
          };
        }
      }
    }
  }

  for (const session of sessions) {
    const key = session.key?.trim() ?? "";
    if (!key) continue;
    const history = await params.client.call<ChatHistoryResult>(
      "chat.history",
      {
        sessionKey: key,
        limit: 24,
      },
    );
    const messages = Array.isArray(history.messages) ? history.messages : [];
    const inference = resolveHistoryInference(messages);
    if (inference.inferredRunning) {
      return {
        inferredRunning: true,
        sessionKey: key,
        lastRole: inference.lastRole,
        lastText: inference.lastText,
        messageCount: inference.messageCount,
        latestSessionUpdatedAtMs,
        inspectedSessions,
        inferenceSource: "chat.history.user-tail",
      };
    }
  }

  return {
    inferredRunning: false,
    sessionKey: "",
    lastRole: "assistant",
    lastText: "",
    messageCount: 0,
    latestSessionUpdatedAtMs,
    inspectedSessions,
    inferenceSource: "none",
  };
};

type OfficeScreenProps = {
  showOpenClawConsole?: boolean;
};

export function OfficeScreen({
  showOpenClawConsole = true,
}: OfficeScreenProps) {
  const searchParams = useSearchParams();
  const debugEnabled = searchParams.get("officeDebug") === "1";
  const [settingsCoordinator] = useState(() =>
    createStudioSettingsCoordinator(),
  );
  const {
    client,
    status,
    connectPromptReady,
    shouldPromptForConnect,
    gatewayUrl,
    token,
    localGatewayDefaults,
    error: gatewayError,
    connect,
    disconnect,
    useLocalGatewayDefaults,
    setGatewayUrl,
    setToken,
  } =
    useGatewayConnection(settingsCoordinator);
  const { state, dispatch, hydrateAgents, setError, setLoading } =
    useAgentStore();
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [didAttemptGatewayConnect, setDidAttemptGatewayConnect] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [debugRows, setDebugRows] = useState<OfficeDebugRow[]>([]);
  const [feedEvents, setFeedEvents] = useState<OfficeFeedEvent[]>([]);
  const officeAgentCacheRef = useRef<
    Map<
      string,
      {
        agent: AgentState;
        deskHeld: boolean;
        gymHeld: boolean;
        latchedWorking: boolean;
        officeAgent: OfficeAgent;
        phoneBoothHeld: boolean;
        qaHeld: boolean;
        smsBoothHeld: boolean;
      }
    >
  >(new Map());
  const deskMonitorCacheRef = useRef<
    Map<string, { agent: AgentState; monitor: OfficeDeskMonitor }>
  >(new Map());
  const [openClawLogEntries, setOpenClawLogEntries] = useState<
    OpenClawLogEntry[]
  >([]);
  const [openClawConsoleCollapsed, setOpenClawConsoleCollapsed] =
    useState(true);
  const [openClawConsoleSearch, setOpenClawConsoleSearch] = useState("");
  const [openClawConsoleCopyStatus, setOpenClawConsoleCopyStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const [officeTriggerState, setOfficeTriggerState] = useState(() =>
    createOfficeAnimationTriggerState(),
  );
  const prevWorkingRef = useRef<Record<string, boolean>>({});
  const prevAssistantPreviewRef = useRef<
    Record<string, { ts: number; text: string }>
  >({});
  const [runCountByAgentId, setRunCountByAgentId] = useState<
    Record<string, number>
  >({});
  const [lastSeenByAgentId, setLastSeenByAgentId] = useState<
    Record<string, number>
  >({});
  const [marketplaceGymHoldByAgentId, setMarketplaceGymHoldByAgentId] =
    useState<Record<string, boolean>>({});
  const [gymCooldownUntilByAgentId, setGymCooldownUntilByAgentId] = useState<
    Record<string, number>
  >({});
  const prevImmediateGymHoldRef = useRef<Record<string, boolean>>({});
  const [monitorAgentId, setMonitorAgentId] = useState<string | null>(null);
  const [githubReviewAgentId, setGithubReviewAgentId] = useState<string | null>(
    null,
  );
  const [qaTestingAgentId, setQaTestingAgentId] = useState<string | null>(null);
  const gatewayConfigSnapshot = useRef<GatewayModelPolicySnapshot | null>(null);
  const loadAgentsInFlightRef = useRef<Promise<void> | null>(null);
  const connectionEpochRef = useRef(0);
  const lastLoadAgentsStartedAtRef = useRef(0);
  const lastGatewayActivityAtRef = useRef(0);
  const stateRef = useRef(state);
  const officeTriggerStateRef = useRef(officeTriggerState);
  const historyInFlightRef = useRef<Set<string>>(new Set());
  const lastTransportHistoryRefreshKeyRef = useRef<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedChatAgentId, setSelectedChatAgentId] = useState<string | null>(
    null,
  );
  const [agentEditorAgentId, setAgentEditorAgentId] = useState<string | null>(null);
  const [agentEditorInitialSection, setAgentEditorInitialSection] =
    useState<AgentEditorSection>("avatar");
  const [preparedPhoneCallsByAgentId, setPreparedPhoneCallsByAgentId] = useState<
    Record<string, PreparedPhoneCallEntry>
  >({});
  const [preparedTextMessagesByAgentId, setPreparedTextMessagesByAgentId] = useState<
    Record<string, PreparedTextMessageEntry>
  >({});
  const promptedPhoneCallKeysRef = useRef<Set<string>>(new Set());
  const preparedPhoneCallKeysRef = useRef<Set<string>>(new Set());
  const spokenPhoneCallKeysRef = useRef<Set<string>>(new Set());
  const promptedTextMessageKeysRef = useRef<Set<string>>(new Set());
  const preparedTextMessageKeysRef = useRef<Set<string>>(new Set());
  const [deskAssignmentByDeskUid, setDeskAssignmentByDeskUid] = useState<
    Record<string, string>
  >({});
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<HQSidebarTab>("inbox");
  const router = useRouter();
  const { showOnboarding, completeOnboarding, resetOnboarding } =
    useOnboardingState();
  const [forceShowOnboarding, setForceShowOnboarding] = useState(false);
  const {
    loaded: officeTitleLoaded,
    title: officeTitle,
    setTitle: setOfficeTitle,
  } = useStudioOfficePreference({
    gatewayUrl,
    settingsCoordinator,
  });
  const {
    loaded: voiceRepliesLoaded,
    preference: voiceRepliesPreference,
    enabled: voiceRepliesEnabled,
    voiceId: voiceRepliesVoiceId,
    speed: voiceRepliesSpeed,
    setEnabled: setVoiceRepliesEnabled,
    setVoiceId: setVoiceRepliesVoiceId,
    setSpeed: setVoiceRepliesSpeed,
  } = useStudioVoiceRepliesPreference({
    gatewayUrl,
    settingsCoordinator,
  });
  const {
    enqueue: enqueueVoiceReply,
    preview: previewVoiceReply,
    stop: stopVoiceReplyPlayback,
  } = useVoiceReplyPlayback({
    enabled: voiceRepliesEnabled,
    provider: voiceRepliesPreference.provider,
    voiceId: voiceRepliesPreference.voiceId,
    speed: voiceRepliesPreference.speed,
  });
  const showOnboardingWizard = showOnboarding || forceShowOnboarding;
  const handleOpenOnboarding = useCallback(() => {
    resetOnboarding();
    setForceShowOnboarding(true);
  }, [resetOnboarding]);
  const handleCompleteOnboarding = useCallback(() => {
    completeOnboarding();
    setForceShowOnboarding(false);
  }, [completeOnboarding]);

  const handleAvatarProfileSave = useCallback(
    (agentId: string, profile: AgentAvatarProfile) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { avatarProfile: profile, avatarSeed: profile.seed },
      });
      const key = gatewayUrl.trim();
      if (!key) return;
      settingsCoordinator.schedulePatch(
        { avatars: { [key]: { [agentId]: profile } } },
        0,
      );
    },
    [dispatch, gatewayUrl, settingsCoordinator],
  );
  const openAgentEditor = useCallback(
    (agentId: string, initialSection: AgentEditorSection = "avatar") => {
      setAgentEditorAgentId(agentId);
      setAgentEditorInitialSection(initialSection);
      setSelectedChatAgentId(agentId);
      dispatch({ type: "selectAgent", agentId });
    },
    [dispatch],
  );

  const handleDeskAssignmentChange = useCallback(
    (deskUid: string, agentId: string | null) => {
      const key = gatewayUrl.trim();
      const normalizedDeskUid = deskUid.trim();
      if (!key || !normalizedDeskUid) return;
      setDeskAssignmentByDeskUid((previous) => {
        const next = { ...previous };
        if (agentId) {
          for (const [existingDeskUid, existingAgentId] of Object.entries(
            next,
          )) {
            if (
              existingDeskUid !== normalizedDeskUid &&
              existingAgentId === agentId
            ) {
              delete next[existingDeskUid];
            }
          }
          next[normalizedDeskUid] = agentId;
        } else {
          delete next[normalizedDeskUid];
        }
        return next;
      });
      settingsCoordinator.schedulePatch(
        {
          deskAssignments: {
            [key]: {
              [normalizedDeskUid]: agentId,
            },
          },
        },
        0,
      );
    },
    [gatewayUrl, settingsCoordinator],
  );

  const handleDeskAssignmentsReset = useCallback(
    (deskUids: string[]) => {
      const key = gatewayUrl.trim();
      if (!key || deskUids.length === 0) return;
      setDeskAssignmentByDeskUid((previous) => {
        const next = { ...previous };
        for (const deskUid of deskUids) delete next[deskUid];
        return next;
      });
      settingsCoordinator.schedulePatch(
        {
          deskAssignments: {
            [key]: Object.fromEntries(
              deskUids.map((deskUid) => [deskUid, null]),
            ),
          },
        },
        0,
      );
    },
    [gatewayUrl, settingsCoordinator],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    officeTriggerStateRef.current = officeTriggerState;
  }, [officeTriggerState]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 2000);
    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (status === "connecting") {
      setDidAttemptGatewayConnect(true);
    }
  }, [status]);

  useEffect(() => {
    if (gatewayError) {
      setDidAttemptGatewayConnect(true);
    }
  }, [gatewayError]);

  const loadStudioSettings = useCallback(
    (options?: StudioSettingsLoadOptions) => settingsCoordinator.loadSettings(options),
    [settingsCoordinator],
  );

  useEffect(() => {
    let cancelled = false;
    const key = gatewayUrl.trim();
    if (!key) {
      setDeskAssignmentByDeskUid({});
      return;
    }
    void (async () => {
      try {
        const settings = await loadStudioSettings();
        if (cancelled) return;
        setDeskAssignmentByDeskUid(
          settings ? resolveDeskAssignments(settings, key) : {},
        );
      } catch {
        if (cancelled) return;
        setDeskAssignmentByDeskUid({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, loadStudioSettings]);

  const loadAgents = useCallback(async (options?: {
    forceSettings?: boolean;
    minIntervalMs?: number;
    onlyWhenIdleForMs?: number;
    settingsMaxAgeMs?: number;
    silent?: boolean;
  }) => {
    if (status !== "connected") return;
    if (loadAgentsInFlightRef.current) return loadAgentsInFlightRef.current;
    const now = Date.now();
    const minIntervalMs = options?.minIntervalMs ?? 0;
    if (
      minIntervalMs > 0 &&
      now - lastLoadAgentsStartedAtRef.current < minIntervalMs
    ) {
      return;
    }
    const onlyWhenIdleForMs = options?.onlyWhenIdleForMs ?? 0;
    if (
      onlyWhenIdleForMs > 0 &&
      now - lastGatewayActivityAtRef.current < onlyWhenIdleForMs
    ) {
      return;
    }
    lastLoadAgentsStartedAtRef.current = now;
    const connectionEpochAtStart = connectionEpochRef.current;
    const task = (async () => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const settingsLoadOptions: StudioSettingsLoadOptions | undefined =
          options?.forceSettings
            ? { force: true }
            : { maxAgeMs: options?.settingsMaxAgeMs ?? 60_000 };
        const commands = await runStudioBootstrapLoadOperation({
          client,
          gatewayUrl,
          cachedConfigSnapshot: gatewayConfigSnapshot.current,
          loadStudioSettings: () => loadStudioSettings(settingsLoadOptions),
          isDisconnectLikeError: isGatewayDisconnectLikeError,
          preferredSelectedAgentId: null,
          hasCurrentSelection: false,
          logError: console.error,
        });
        if (connectionEpochAtStart !== connectionEpochRef.current) {
          return;
        }
        executeStudioBootstrapLoadCommands({
          commands,
          setGatewayConfigSnapshot: (val: GatewayModelPolicySnapshot) => {
            gatewayConfigSnapshot.current = val;
          },
          hydrateAgents,
          dispatchUpdateAgent: (agentId, patch) => {
            dispatch({ type: "updateAgent", agentId, patch });
          },
          setError,
        });
        if (connectionEpochAtStart !== connectionEpochRef.current) {
          return;
        }
        const refreshedAgents = stateRef.current.agents;
        const debugCollector: OfficeDebugRow[] = [];
        const inferredByAgentId = new Map<string, boolean>();
        await Promise.all(
          refreshedAgents.map(async (agent) => {
          if (connectionEpochAtStart !== connectionEpochRef.current) {
            return;
          }
          try {
            const inference = await inferRunningFromAgentSessions({
              client,
              agentId: agent.agentId,
            });
            if (connectionEpochAtStart !== connectionEpochRef.current) {
              return;
            }
            const inferredRunning = inference.inferredRunning;
            inferredByAgentId.set(agent.agentId, inferredRunning);
            if (inference.latestSessionUpdatedAtMs > 0) {
              setLastSeenByAgentId((prev) => ({
                ...prev,
                [agent.agentId]: inference.latestSessionUpdatedAtMs,
              }));
            }
            const nextStatus: AgentState["status"] = inferredRunning
              ? "running"
              : "idle";
            if (agent.status !== nextStatus) {
              dispatch({
                type: "updateAgent",
                agentId: agent.agentId,
                patch: {
                  status: nextStatus,
                  runId: inferredRunning
                    ? (agent.runId ?? `inferred-${agent.agentId}`)
                    : null,
                },
              });
            }
            if (debugEnabled) {
              debugCollector.push({
                agentId: agent.agentId,
                name: agent.name,
                storeStatus: agent.status,
                runId: agent.runId,
                inferredRunning,
                lastRole: inference.lastRole,
                lastText: inference.lastText,
                messageCount: inference.messageCount,
                detectedSessionKey: inference.sessionKey,
                inspectedSessions: inference.inspectedSessions.join(" | "),
                inferenceSource: inference.inferenceSource,
                at: new Date().toISOString(),
              });
            }
          } catch (error) {
            if (!isGatewayDisconnectLikeError(error)) {
              console.warn(
                "Failed to infer agent run state from history.",
                error,
              );
            }
          }
          }),
        );
        if (connectionEpochAtStart !== connectionEpochRef.current) {
          return;
        }
        if (debugEnabled) {
          setDebugRows(debugCollector);
          console.info("[office-debug] Reconciled agent state.", debugCollector);
        }
        lastGatewayActivityAtRef.current = Date.now();
        setAgentsLoaded(true);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
        loadAgentsInFlightRef.current = null;
      }
    })();
    loadAgentsInFlightRef.current = task;
    return task;
  }, [
    client,
    debugEnabled,
    dispatch,
    gatewayUrl,
    hydrateAgents,
    loadStudioSettings,
    setError,
    setLoading,
    status,
  ]);

  const requestAgentHistoryRefresh = useCallback(
    async (params: {
      agentId: string;
      reason: "chat-final-no-trace" | "run-start-no-chat";
      sessionKey?: string;
    }) => {
      if (status !== "connected") return;
      const requestedSessionKey = params.sessionKey?.trim() ?? "";
      if (requestedSessionKey) {
        try {
          const history = await client.call<{
            messages?: Record<string, unknown>[];
          }>("chat.history", {
            sessionKey: requestedSessionKey,
            limit: RUNTIME_SYNC_DEFAULT_HISTORY_LIMIT,
          });
          const messages = Array.isArray(history.messages)
            ? history.messages
            : [];
          const derived = buildHistoryLines(messages);
          let lastUser = derived.lastUser?.trim() ?? "";
          if (!lastUser) {
            const previewResult = await client.call<SummaryPreviewSnapshot>(
              "sessions.preview",
              {
                keys: [requestedSessionKey],
                limit: 12,
                maxChars: 400,
              },
            );
            lastUser =
              resolveLatestUserTextFromPreview(
                previewResult,
                requestedSessionKey,
              ) ?? "";
          }
          const targetAgentId =
            parseAgentIdFromSessionKey(requestedSessionKey) ?? params.agentId;
          const patch: Partial<AgentState> = {};
          if (lastUser) {
            patch.lastUserMessage = lastUser;
          }
          if (derived.lastAssistant) {
            patch.latestPreview = derived.lastAssistant;
          }
          if (typeof derived.lastAssistantAt === "number") {
            patch.lastAssistantMessageAt = derived.lastAssistantAt;
          }
          if (typeof derived.lastUserAt === "number") {
            patch.lastActivityAt = derived.lastUserAt;
          }
          if (Object.keys(patch).length > 0) {
            dispatch({
              type: "updateAgent",
              agentId: targetAgentId,
              patch,
            });
          }
          // Do not replay movement directives from history refresh.
          // History can include old transport commands; replaying them causes auto-walks on load.
          setOpenClawLogEntries((previous) => {
            const next = [
              ...previous,
              createOpenClawLogEntry({
                eventName: "history-refresh",
                eventKind: "derived",
                summary: `session=${requestedSessionKey} reason=${params.reason} lastUser=${formatOpenClawValue(lastUser)} lastAssistant=${formatOpenClawValue(derived.lastAssistant)}`,
                messageText: lastUser || null,
                streamText: derived.lastAssistant ?? null,
                payload: {
                  sessionKey: requestedSessionKey,
                  reason: params.reason,
                  historyMessageCount: messages.length,
                  lastUser: lastUser || null,
                  lastAssistant: derived.lastAssistant ?? null,
                },
              }),
            ];
            return next.slice(-MAX_OPENCLAW_LOG_ENTRIES);
          });
          if (debugEnabled) {
            console.info(
              "[office-debug] Refreshed transport session history.",
              {
                agentId: targetAgentId,
                requestedSessionKey,
                reason: params.reason,
                lastUser: lastUser || null,
              },
            );
          }
        } catch (error) {
          setOpenClawLogEntries((previous) => {
            const next = [
              ...previous,
              createOpenClawLogEntry({
                eventName: "history-refresh",
                eventKind: "error",
                summary: `session=${requestedSessionKey} reason=${params.reason} refresh failed`,
                payload: {
                  sessionKey: requestedSessionKey,
                  reason: params.reason,
                  error: error instanceof Error ? error.message : String(error),
                },
              }),
            ];
            return next.slice(-MAX_OPENCLAW_LOG_ENTRIES);
          });
          if (!isGatewayDisconnectLikeError(error)) {
            console.error(
              "Failed to refresh transport session history.",
              error,
            );
          }
        }
        return;
      }
      const commands = await runHistorySyncOperation({
        client,
        agentId: params.agentId,
        getAgent: (agentId) =>
          stateRef.current.agents.find((entry) => entry.agentId === agentId) ??
          null,
        inFlightSessionKeys: historyInFlightRef.current,
        requestId: randomUUID(),
        loadedAt: Date.now(),
        defaultLimit: RUNTIME_SYNC_DEFAULT_HISTORY_LIMIT,
        maxLimit: RUNTIME_SYNC_MAX_HISTORY_LIMIT,
        transcriptV2Enabled: TRANSCRIPT_V2_ENABLED,
      });
      executeHistorySyncCommands({
        commands,
        dispatch,
        logMetric: (metric, meta) => logTranscriptDebugMetric(metric, meta),
        isDisconnectLikeError: isGatewayDisconnectLikeError,
        logError: (message, error) => console.error(message, error),
      });
      if (debugEnabled) {
        console.info("[office-debug] Requested agent history refresh.", {
          agentId: params.agentId,
          reason: params.reason,
        });
      }
    },
    [client, debugEnabled, dispatch, status],
  );

  const refreshRecentTransportSessionHistory = useCallback(
    (event: EventFrame) => {
      if (event.event !== "health") return;
      const payload =
        event.payload as
          | {
              agents?: Array<{
                agentId?: unknown;
                sessions?: {
                  recent?: Array<{ key?: unknown; updatedAt?: unknown }>;
                };
              }>;
            }
          | undefined;
      const gatewayAgents = Array.isArray(payload?.agents) ? payload.agents : [];
      if (gatewayAgents.length === 0) return;
      for (const gatewayAgent of gatewayAgents) {
        const agentId =
          typeof gatewayAgent?.agentId === "string"
            ? gatewayAgent.agentId.trim()
            : "";
        if (!agentId) continue;
        const localAgent = stateRef.current.agents.find(
          (agent) => agent.agentId === agentId,
        );
        if (!localAgent?.sessionKey) continue;
        const recentSessions = Array.isArray(gatewayAgent.sessions?.recent)
          ? gatewayAgent.sessions.recent
          : [];
        const latestTransportSession = recentSessions.find((entry) => {
          const sessionKey =
            typeof entry?.key === "string" ? entry.key.trim() : "";
          if (!sessionKey) return false;
          if (isSameSessionKey(sessionKey, localAgent.sessionKey)) return false;
          return parseAgentIdFromSessionKey(sessionKey) === agentId;
        });
        if (!latestTransportSession) continue;
        const sessionKey =
          typeof latestTransportSession.key === "string"
            ? latestTransportSession.key.trim()
            : "";
        if (!sessionKey) continue;
        const updatedAt =
          typeof latestTransportSession.updatedAt === "number" &&
          Number.isFinite(latestTransportSession.updatedAt)
            ? latestTransportSession.updatedAt
            : 0;
        const refreshKey = `${sessionKey}:${updatedAt}`;
        if (lastTransportHistoryRefreshKeyRef.current[agentId] === refreshKey) {
          continue;
        }
        lastTransportHistoryRefreshKeyRef.current[agentId] = refreshKey;
        void requestAgentHistoryRefresh({
          agentId,
          reason: "run-start-no-chat",
          sessionKey,
        });
      }
    },
    [requestAgentHistoryRefresh],
  );

  useEffect(() => {
    if (status !== "connected" || agentsLoaded) return;
    void loadAgents({ forceSettings: true });
  }, [agentsLoaded, loadAgents, status]);

  useEffect(() => {
    if (status !== "connected") return;
    if (state.loading) return;
    if (state.agents.length > 0) return;
    const timeoutId = window.setTimeout(() => {
      void loadAgents({ forceSettings: true });
    }, 500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAgents, state.agents.length, state.loading, status]);

  useEffect(() => {
    if (status === "disconnected") {
      connectionEpochRef.current += 1;
      setAgentsLoaded(false);
      loadAgentsInFlightRef.current = null;
      gatewayConfigSnapshot.current = null;
      lastLoadAgentsStartedAtRef.current = 0;
      hydrateAgents([]);
      setFeedEvents([]);
      setDebugRows([]);
      setRunCountByAgentId({});
      setLastSeenByAgentId({});
      prevAssistantPreviewRef.current = {};
      lastGatewayActivityAtRef.current = 0;
    }
  }, [hydrateAgents, status]);

  useEffect(() => {
    if (!agentsLoaded) return;
    const previousByAgentId = prevAssistantPreviewRef.current;
    const nextByAgentId: Record<string, { ts: number; text: string }> = {};
    let initialized = Object.keys(previousByAgentId).length > 0;

    for (const agent of state.agents) {
      const previewText = normalizeOfficeFeedText(
        agent.lastResult ?? agent.latestPreview,
      );
      const previewTs = agent.lastAssistantMessageAt ?? 0;
      if (!previewText || previewTs <= 0) continue;
      nextByAgentId[agent.agentId] = { ts: previewTs, text: previewText };
      const previous = previousByAgentId[agent.agentId];
      if (!previous) continue;
      initialized = true;
      if (previous.ts === previewTs && previous.text === previewText) continue;
      if (previewTs < previous.ts) continue;
      setFeedEvents((prev) =>
        [
          {
            id: agent.agentId,
            name: agent.name || "Agent",
            text: previewText,
            ts: previewTs,
            kind: "reply" as const,
          },
          ...prev,
        ].slice(0, 6),
      );
    }

    if (!initialized) {
      prevAssistantPreviewRef.current = nextByAgentId;
      return;
    }
    prevAssistantPreviewRef.current = nextByAgentId;
  }, [agentsLoaded, state.agents]);

  useEffect(() => {
    if (status !== "connected" || !agentsLoaded) return;
    const runtimeHandler = createGatewayRuntimeEventHandler({
      getStatus: () => status,
      getAgents: () => stateRef.current.agents,
      dispatch: (action) => {
        dispatch(action as never);
      },
      queueLivePatch: (agentId, patch) => {
        dispatch({ type: "updateAgent", agentId, patch });
        if ("status" in patch || "runId" in patch) {
          const agent = stateRef.current.agents.find(
            (entry) => entry.agentId === agentId,
          );
          if (agent) {
            const wasWorking = prevWorkingRef.current[agentId] ?? false;
            const isNowWorking =
              patch.status === "running" || Boolean(patch.runId);
            if (isNowWorking !== wasWorking) {
              prevWorkingRef.current[agentId] = isNowWorking;
              const text = isNowWorking ? "started working" : "went idle";
              setFeedEvents((prev) =>
                [
                  {
                    id: agentId,
                    name: agent.name || "Agent",
                    text,
                    ts: Date.now(),
                    kind: "status" as const,
                  },
                  ...prev,
                ].slice(0, 6),
              );
              if (isNowWorking) {
                setRunCountByAgentId((prev) => ({
                  ...prev,
                  [agentId]: (prev[agentId] ?? 0) + 1,
                }));
              }
            }
          }
        }
      },
      clearPendingLivePatch: () => {},
      loadSummarySnapshot: async () => {
        await loadAgents({
          minIntervalMs: 3_000,
          settingsMaxAgeMs: 60_000,
          silent: true,
        });
      },
      requestHistoryRefresh: requestAgentHistoryRefresh,
      refreshHeartbeatLatestUpdate: () => {},
      bumpHeartbeatTick: () => {},
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logWarn: (message, meta) => console.warn(message, meta),
      updateSpecialLatestUpdate: () => {},
    });

    // Run reconciliation before subscribing to events so dedup keys are
    // populated in the trigger state. This prevents stale gateway event
    // replays from setting timed room holds on page load.
    setOfficeTriggerState((previous) =>
      reconcileOfficeAnimationTriggerState({
        state: previous,
        agents: stateRef.current.agents,
      }),
    );
    const unsubscribeEvent = client.onEvent((event) => {
      lastGatewayActivityAtRef.current = Date.now();
      setOpenClawLogEntries((previous) => {
        const next = [...previous, formatOpenClawEventLogEntry(event)];
        return next.slice(-MAX_OPENCLAW_LOG_ENTRIES);
      });
      refreshRecentTransportSessionHistory(event);
      setOfficeTriggerState((previous) =>
        reduceOfficeAnimationTriggerEvent({
          state: previous,
          event,
          agents: stateRef.current.agents,
        }),
      );
      if (debugEnabled) {
        console.info("[office-debug] Gateway event.", {
          event: event.event,
          seq: event.seq,
          payload:
            typeof event.payload === "object" && event.payload !== null
              ? JSON.stringify(event.payload).slice(0, 220)
              : (event.payload ?? null),
        });
      }
      if (
        shouldSuppressPhoneBoothAssistantReply({
          event,
          agents: stateRef.current.agents,
          phoneCallByAgentId: officeTriggerStateRef.current.phoneCallByAgentId,
        })
      ) {
        return;
      }
      runtimeHandler.handleEvent(event);
    });
    const unsubscribeGap = client.onGap(() => {
      void loadAgents({
        minIntervalMs: 5_000,
        settingsMaxAgeMs: 30_000,
        silent: true,
      });
    });

    return () => {
      unsubscribeEvent();
      unsubscribeGap();
      runtimeHandler.dispose();
    };
  }, [
    agentsLoaded,
    client,
    debugEnabled,
    dispatch,
    loadAgents,
    refreshRecentTransportSessionHistory,
    requestAgentHistoryRefresh,
    status,
  ]);

  useEffect(() => {
    if (status !== "connected" || !agentsLoaded) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadAgents({
        minIntervalMs: 60_000,
        onlyWhenIdleForMs: 120_000,
        settingsMaxAgeMs: 180_000,
        silent: true,
      });
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [agentsLoaded, loadAgents, status]);

  useEffect(() => {
    if (status !== "connected" || !agentsLoaded) return;
    const handleFocus = () => {
      if (document.visibilityState !== "visible") return;
      void loadAgents({
        minIntervalMs: 15_000,
        settingsMaxAgeMs: 30_000,
        silent: true,
      });
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [agentsLoaded, loadAgents, status]);

  useEffect(() => {
    setOfficeTriggerState((previous) =>
      reconcileOfficeAnimationTriggerState({
        state: previous,
        agents: state.agents,
      }),
    );
  }, [state.agents]);

  useEffect(() => {
    setMarketplaceGymHoldByAgentId((previous) => {
      const activeAgentIds = new Set(
        state.agents.map((agent) => agent.agentId),
      );
      const next = Object.fromEntries(
        Object.entries(previous).filter(
          ([agentId, held]) => held && activeAgentIds.has(agentId),
        ),
      );
      if (
        Object.keys(previous).length === Object.keys(next).length &&
        Object.keys(previous).every(
          (agentId) => previous[agentId] === next[agentId],
        )
      ) {
        return previous;
      }
      return next;
    });
  }, [state.agents]);

  useEffect(() => {
    if (!monitorAgentId) return;
    if (state.agents.some((agent) => agent.agentId === monitorAgentId)) return;
    setMonitorAgentId(null);
  }, [monitorAgentId, state.agents]);

  useEffect(() => {
    if (!githubReviewAgentId) return;
    if (state.agents.some((agent) => agent.agentId === githubReviewAgentId)) {
      return;
    }
    setGithubReviewAgentId(null);
  }, [githubReviewAgentId, state.agents]);

  useEffect(() => {
    if (!qaTestingAgentId) return;
    if (state.agents.some((agent) => agent.agentId === qaTestingAgentId)) {
      return;
    }
    setQaTestingAgentId(null);
  }, [qaTestingAgentId, state.agents]);

  useEffect(() => {
    if (status !== "connected") return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await client.call<{ models: GatewayModelChoice[] }>(
          "models.list",
          {},
        );
        if (!cancelled) {
          setGatewayModels(
            buildGatewayModelChoices(
              Array.isArray(result.models) ? result.models : [],
              null,
            ),
          );
        }
      } catch {
        // Models are optional - chat still works without model selection.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, client]);

  useEffect(() => {
    if (chatOpen && !selectedChatAgentId && state.agents.length > 0) {
      setSelectedChatAgentId(state.agents[0].agentId);
    }
  }, [chatOpen, selectedChatAgentId, state.agents]);

  const chatController = useChatInteractionController({
    client,
    status,
    agents: state.agents,
    dispatch: (action) => dispatch(action as never),
    setError,
    getAgents: () => stateRef.current.agents,
    clearRunTracking: () => {},
    clearHistoryInFlight: () => {},
    clearSpecialUpdateMarker: () => {},
    clearSpecialLatestUpdateInFlight: () => {},
    setInspectSidebarNull: () => {},
    setMobilePaneChat: () => {},
  });

  const focusedChatAgent = selectedChatAgentId
    ? (state.agents.find((agent) => agent.agentId === selectedChatAgentId) ??
      null)
    : null;
  const agentEditorAgent = agentEditorAgentId
    ? (state.agents.find((agent) => agent.agentId === agentEditorAgentId) ?? null)
    : null;
  const mainAgent =
    state.agents.find((agent) => agent.agentId === MAIN_AGENT_ID) ?? null;
  const runLog = useRunLog({ client, status, agents: state.agents });
  const standupAgentSnapshots = useMemo<StandupAgentSnapshot[]>(
    () =>
      state.agents.map((agent) => ({
        agentId: agent.agentId,
        name: agent.name || agent.agentId,
        latestPreview: agent.latestPreview,
        lastUserMessage: agent.lastUserMessage,
      })),
    [state.agents],
  );
  const standupController = useOfficeStandupController({
    gatewayUrl,
    agents: standupAgentSnapshots,
  });
  const handleMarketplaceGymStart = useCallback((agentId: string) => {
    setMarketplaceGymHoldByAgentId((previous) => ({
      ...previous,
      [agentId]: true,
    }));
  }, []);
  const handleMarketplaceGymEnd = useCallback((agentId: string) => {
    setMarketplaceGymHoldByAgentId((previous) => {
      if (!previous[agentId]) return previous;
      const next = { ...previous };
      delete next[agentId];
      return next;
    });
  }, []);
  const marketplace = useOfficeSkillsMarketplace({
    client,
    status,
    agents: state.agents,
    preferredAgentId: selectedChatAgentId,
    onSkillActivityStart: handleMarketplaceGymStart,
    onSkillActivityEnd: handleMarketplaceGymEnd,
  });
  const animationNowMs = Date.now();
  const officeAnimationState = useMemo(
    () =>
      buildOfficeAnimationState({
        state: officeTriggerState,
        agents: state.agents,
        marketplaceGymHoldByAgentId,
        nowMs: animationNowMs,
      }),
    [
      animationNowMs,
      marketplaceGymHoldByAgentId,
      officeTriggerState,
      state.agents,
    ],
  );
  const {
    deskHoldByAgentId,
    githubHoldByAgentId,
    manualGymUntilByAgentId,
    pendingStandupRequest,
    phoneBoothHoldByAgentId,
    phoneCallByAgentId,
    qaHoldByAgentId,
    smsBoothHoldByAgentId,
    skillGymHoldByAgentId,
    textMessageByAgentId,
    workingUntilByAgentId,
  } = officeAnimationState;
  const immediateGymHoldByAgentId = useMemo(
    () => ({
      ...marketplaceGymHoldByAgentId,
      ...skillGymHoldByAgentId,
    }),
    [marketplaceGymHoldByAgentId, skillGymHoldByAgentId],
  );

  useEffect(() => {
    const now = Date.now();
    setGymCooldownUntilByAgentId((previous) => {
      const next: Record<string, number> = {};
      for (const agent of state.agents) {
        const agentId = agent.agentId;
        const immediateHeld = Boolean(immediateGymHoldByAgentId[agentId]);
        const wasImmediateHeld =
          prevImmediateGymHoldRef.current[agentId] ?? false;
        const previousUntil = previous[agentId] ?? 0;
        if (immediateHeld) {
          if (previousUntil > now) {
            next[agentId] = previousUntil;
          }
          continue;
        }
        if (wasImmediateHeld) {
          next[agentId] = now + GYM_WORKOUT_LATCH_MS;
          continue;
        }
        if (previousUntil > now) {
          next[agentId] = previousUntil;
        }
      }
      prevImmediateGymHoldRef.current = Object.fromEntries(
        state.agents.map((agent) => [
          agent.agentId,
          Boolean(immediateGymHoldByAgentId[agent.agentId]),
        ]),
      );
      return next;
    });
  }, [immediateGymHoldByAgentId, state.agents]);

  const activeGithubReviewAgentId = useMemo(
    () =>
      state.agents.find((agent) => githubHoldByAgentId[agent.agentId])
        ?.agentId ?? null,
    [githubHoldByAgentId, state.agents],
  );
  const activeQaTestingAgentId = useMemo(
    () =>
      state.agents.find((agent) => qaHoldByAgentId[agent.agentId])?.agentId ??
      null,
    [qaHoldByAgentId, state.agents],
  );
  useEffect(() => {
    setGithubReviewAgentId(activeGithubReviewAgentId);
  }, [activeGithubReviewAgentId]);

  useEffect(() => {
    if (!activeGithubReviewAgentId) return;
    setSelectedChatAgentId(activeGithubReviewAgentId);
    dispatch({ type: "selectAgent", agentId: activeGithubReviewAgentId });
  }, [activeGithubReviewAgentId, dispatch]);

  useEffect(() => {
    setQaTestingAgentId(activeQaTestingAgentId);
  }, [activeQaTestingAgentId]);

  useEffect(() => {
    if (!activeQaTestingAgentId) return;
    setSelectedChatAgentId(activeQaTestingAgentId);
    dispatch({ type: "selectAgent", agentId: activeQaTestingAgentId });
  }, [activeQaTestingAgentId, dispatch]);

  useEffect(() => {
    const activeKeys = new Set(
      Object.values(phoneCallByAgentId).map((request) => request.key),
    );
    promptedPhoneCallKeysRef.current = new Set(
      [...promptedPhoneCallKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    preparedPhoneCallKeysRef.current = new Set(
      [...preparedPhoneCallKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    spokenPhoneCallKeysRef.current = new Set(
      [...spokenPhoneCallKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    setPreparedPhoneCallsByAgentId((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([, entry]) => activeKeys.has(entry.requestKey)),
      );
      if (
        Object.keys(previous).length === Object.keys(next).length &&
        Object.keys(previous).every((agentId) => previous[agentId] === next[agentId])
      ) {
        return previous;
      }
      return next;
    });
  }, [phoneCallByAgentId]);

  useEffect(() => {
    const requests = Object.entries(phoneCallByAgentId);
    if (requests.length === 0) return;

    const appendPromptForAgent = (agentId: string, request: OfficePhoneCallRequest) => {
      const agent = state.agents.find((entry) => entry.agentId === agentId);
      if (!agent) return;
      promptedPhoneCallKeysRef.current.add(request.key);
      void fetch("/api/office/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callee: request.callee,
          message: null,
        }),
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as {
            scenario?: MockPhoneCallScenario;
          } | null;
          const promptText = body?.scenario?.promptText?.trim();
          if (!response.ok || !promptText) {
            promptedPhoneCallKeysRef.current.delete(request.key);
            return;
          }
          setSelectedChatAgentId(agentId);
          setChatOpen(true);
          dispatch({ type: "selectAgent", agentId });
          dispatch({
            type: "appendOutput",
            agentId,
            line: buildPhoneCallOutputLine(promptText),
          });
        })
        .catch(() => {
          promptedPhoneCallKeysRef.current.delete(request.key);
        });
    };

    const prepareScenarioForAgent = (agentId: string, request: OfficePhoneCallRequest) => {
      preparedPhoneCallKeysRef.current.add(request.key);
      void fetch("/api/office/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callee: request.callee,
          message: request.message,
        }),
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as {
            scenario?: MockPhoneCallScenario;
          } | null;
          const scenario = body?.scenario;
          if (!response.ok || !scenario) {
            preparedPhoneCallKeysRef.current.delete(request.key);
            return;
          }
          setPreparedPhoneCallsByAgentId((previous) => ({
            ...previous,
            [agentId]: {
              requestKey: request.key,
              scenario,
            },
          }));
        })
        .catch(() => {
          preparedPhoneCallKeysRef.current.delete(request.key);
        });
    };

    for (const [agentId, request] of requests) {
      if (
        request.phase === "needs_message" &&
        !promptedPhoneCallKeysRef.current.has(request.key)
      ) {
        appendPromptForAgent(agentId, request);
      }
      if (
        request.phase === "ready_to_call" &&
        !preparedPhoneCallKeysRef.current.has(request.key)
      ) {
        prepareScenarioForAgent(agentId, request);
      }
    }
  }, [dispatch, phoneCallByAgentId, state.agents]);

  const activePhoneBoothAgentId = useMemo(
    () =>
      state.agents.find((agent) => {
        if (!phoneBoothHoldByAgentId[agent.agentId]) return false;
        const prepared = preparedPhoneCallsByAgentId[agent.agentId];
        const request = phoneCallByAgentId[agent.agentId];
        return Boolean(prepared && request && prepared.requestKey === request.key);
      })?.agentId ?? null,
    [phoneBoothHoldByAgentId, phoneCallByAgentId, preparedPhoneCallsByAgentId, state.agents],
  );

  const activePhoneCallScenario = useMemo(() => {
    if (!activePhoneBoothAgentId) return null;
    return preparedPhoneCallsByAgentId[activePhoneBoothAgentId]?.scenario ?? null;
  }, [activePhoneBoothAgentId, preparedPhoneCallsByAgentId]);

  const handlePhoneCallSpeak = useCallback(
    ({ agentId, requestKey }: PhoneCallSpeakPayload) => {
      if (spokenPhoneCallKeysRef.current.has(requestKey)) return;
      spokenPhoneCallKeysRef.current.add(requestKey);
      setSelectedChatAgentId(agentId);
      dispatch({ type: "selectAgent", agentId });
    },
    [dispatch],
  );

  const handlePhoneCallComplete = useCallback(
    (agentId: string) => {
      setPreparedPhoneCallsByAgentId((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      const request = phoneCallByAgentId[agentId];
      if (request) {
        dispatch({
          type: "appendOutput",
          agentId,
          line: buildPhoneCallOutputLine(`Call with ${request.callee} finished.`),
        });
      }
      setOfficeTriggerState((previous) =>
        clearOfficeAnimationTriggerHold({
          state: previous,
          hold: "call",
          agentId,
        }),
      );
    },
    [dispatch, phoneCallByAgentId],
  );

  useEffect(() => {
    const activeKeys = new Set(
      Object.values(textMessageByAgentId).map((request) => request.key),
    );
    promptedTextMessageKeysRef.current = new Set(
      [...promptedTextMessageKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    preparedTextMessageKeysRef.current = new Set(
      [...preparedTextMessageKeysRef.current].filter((key) => activeKeys.has(key)),
    );
    setPreparedTextMessagesByAgentId((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([, entry]) => activeKeys.has(entry.requestKey)),
      );
      if (
        Object.keys(previous).length === Object.keys(next).length &&
        Object.keys(previous).every((agentId) => previous[agentId] === next[agentId])
      ) {
        return previous;
      }
      return next;
    });
  }, [textMessageByAgentId]);

  useEffect(() => {
    const requests = Object.entries(textMessageByAgentId);
    if (requests.length === 0) return;

    const appendPromptForAgent = (agentId: string, request: OfficeTextMessageRequest) => {
      const agent = state.agents.find((entry) => entry.agentId === agentId);
      if (!agent) return;
      promptedTextMessageKeysRef.current.add(request.key);
      void fetch("/api/office/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: request.recipient,
          message: null,
        }),
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as {
            scenario?: MockTextMessageScenario;
          } | null;
          const promptText = body?.scenario?.promptText?.trim();
          if (!response.ok || !promptText) {
            promptedTextMessageKeysRef.current.delete(request.key);
            return;
          }
          setSelectedChatAgentId(agentId);
          setChatOpen(true);
          dispatch({ type: "selectAgent", agentId });
          dispatch({
            type: "appendOutput",
            agentId,
            line: buildTextMessageOutputLine(promptText),
          });
        })
        .catch(() => {
          promptedTextMessageKeysRef.current.delete(request.key);
        });
    };

    const prepareScenarioForAgent = (agentId: string, request: OfficeTextMessageRequest) => {
      preparedTextMessageKeysRef.current.add(request.key);
      void fetch("/api/office/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: request.recipient,
          message: request.message,
        }),
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as {
            scenario?: MockTextMessageScenario;
          } | null;
          const scenario = body?.scenario;
          if (!response.ok || !scenario) {
            preparedTextMessageKeysRef.current.delete(request.key);
            return;
          }
          setPreparedTextMessagesByAgentId((previous) => ({
            ...previous,
            [agentId]: {
              requestKey: request.key,
              scenario,
            },
          }));
        })
        .catch(() => {
          preparedTextMessageKeysRef.current.delete(request.key);
        });
    };

    for (const [agentId, request] of requests) {
      if (
        request.phase === "needs_message" &&
        !promptedTextMessageKeysRef.current.has(request.key)
      ) {
        appendPromptForAgent(agentId, request);
      }
      if (
        request.phase === "ready_to_send" &&
        !preparedTextMessageKeysRef.current.has(request.key)
      ) {
        prepareScenarioForAgent(agentId, request);
      }
    }
  }, [dispatch, state.agents, textMessageByAgentId]);

  const activeSmsBoothAgentId = useMemo(
    () =>
      state.agents.find((agent) => {
        if (!smsBoothHoldByAgentId[agent.agentId]) return false;
        const prepared = preparedTextMessagesByAgentId[agent.agentId];
        const request = textMessageByAgentId[agent.agentId];
        return Boolean(prepared && request && prepared.requestKey === request.key);
      })?.agentId ?? null,
    [preparedTextMessagesByAgentId, smsBoothHoldByAgentId, state.agents, textMessageByAgentId],
  );

  const activeTextMessageScenario = useMemo(() => {
    if (!activeSmsBoothAgentId) return null;
    return preparedTextMessagesByAgentId[activeSmsBoothAgentId]?.scenario ?? null;
  }, [activeSmsBoothAgentId, preparedTextMessagesByAgentId]);

  const handleTextMessageComplete = useCallback(
    (agentId: string) => {
      setPreparedTextMessagesByAgentId((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      const request = textMessageByAgentId[agentId];
      if (request) {
        dispatch({
          type: "appendOutput",
          agentId,
          line: buildTextMessageOutputLine(`Message to ${request.recipient} sent.`),
        });
      }
      setOfficeTriggerState((previous) =>
        clearOfficeAnimationTriggerHold({
          state: previous,
          hold: "text",
          agentId,
        }),
      );
    },
    [dispatch, textMessageByAgentId],
  );

  const gymHoldByAgentId = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const agent of state.agents) {
      const agentId = agent.agentId;
      if (
        immediateGymHoldByAgentId[agentId] ||
        (manualGymUntilByAgentId[agentId] ?? 0) > animationNowMs ||
        (gymCooldownUntilByAgentId[agentId] ?? 0) > animationNowMs
      ) {
        next[agentId] = true;
      }
    }
    return next;
  }, [
    animationNowMs,
    gymCooldownUntilByAgentId,
    immediateGymHoldByAgentId,
    manualGymUntilByAgentId,
    state.agents,
  ]);

  const handleOpenAgentChat = useCallback(
    (agentId: string) => {
      setSelectedChatAgentId(agentId);
      setChatOpen(true);
      dispatch({ type: "selectAgent", agentId });
    },
    [dispatch],
  );

  const lastStandupTriggerKeyRef = useRef<string | null>(null);
  const triggerStandupMeeting = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return false;
      if (
        standupController.meeting &&
        standupController.meeting.phase !== "complete"
      ) {
        return false;
      }
      await standupController.startMeeting("manual");
      return true;
    },
    [standupController],
  );

  const handleGithubReviewDismiss = useCallback(() => {
    if (!githubReviewAgentId) return;
    setOfficeTriggerState((previous) =>
      clearOfficeAnimationTriggerHold({
        state: previous,
        hold: "github",
        agentId: githubReviewAgentId,
      }),
    );
  }, [githubReviewAgentId]);

  const handleQaDismiss = useCallback(() => {
    if (!qaTestingAgentId) return;
    setOfficeTriggerState((previous) =>
      clearOfficeAnimationTriggerHold({
        state: previous,
        hold: "qa",
        agentId: qaTestingAgentId,
      }),
    );
  }, [qaTestingAgentId]);

  const handleChatSend = useCallback(
    async (agentId: string, sessionKey: string, message: string) => {
      stopVoiceReplyPlayback();
      const trimmed = message.trim();
      if (!trimmed) return;

      const intentSnapshot = resolveOfficeIntentSnapshot(trimmed);
      setOpenClawLogEntries((previous) => {
        const next = [
          ...previous,
          createOpenClawLogEntry({
            eventName: "office-intent",
            eventKind: "derived",
            summary: `agent=${agentId} gym=${intentSnapshot.gym?.source ?? "-"} qa=${intentSnapshot.qa ?? "-"} github=${intentSnapshot.github ?? "-"} desk=${intentSnapshot.desk ?? "-"} text=${intentSnapshot.text?.phase ?? "-"}`,
            payload: {
              agentId,
              message: trimmed,
              normalized: intentSnapshot.normalized,
              intentSnapshot,
            },
          }),
        ];
        return next.slice(-MAX_OPENCLAW_LOG_ENTRIES);
      });
      const pendingPhoneCall = phoneCallByAgentId[agentId] ?? null;
      const pendingTextMessage = textMessageByAgentId[agentId] ?? null;
      const hasImmediateOfficeTrigger = Boolean(
        intentSnapshot.desk ||
          intentSnapshot.github ||
          intentSnapshot.gym ||
          intentSnapshot.qa ||
          intentSnapshot.standup ||
          intentSnapshot.text,
      );
      const isPhoneCallFollowUp =
        pendingPhoneCall?.phase === "needs_message" &&
        !intentSnapshot.call &&
        !intentSnapshot.text &&
        !intentSnapshot.desk &&
        !intentSnapshot.github &&
        !intentSnapshot.gym &&
        !intentSnapshot.qa &&
        !intentSnapshot.standup;
      const isTextMessageFollowUp =
        pendingTextMessage?.phase === "needs_message" &&
        !intentSnapshot.call &&
        !intentSnapshot.text &&
        !intentSnapshot.desk &&
        !intentSnapshot.github &&
        !intentSnapshot.gym &&
        !intentSnapshot.qa &&
        !intentSnapshot.standup;

      if (
        hasImmediateOfficeTrigger &&
        !intentSnapshot.call &&
        !isPhoneCallFollowUp &&
        !isTextMessageFollowUp
      ) {
        const nowMs = Date.now();
        const runId = randomUUID();
        setOfficeTriggerState((previous) =>
          reduceOfficeAnimationTriggerEvent({
            state: previous,
            agents: stateRef.current.agents,
            nowMs,
            event: {
              type: "event",
              event: "chat",
              payload: {
                runId,
                sessionKey,
                state: "final",
                message: {
                  role: "user",
                  content: trimmed,
                },
              },
            },
          }),
        );
      }

      if (intentSnapshot.call || isPhoneCallFollowUp) {
        const nowMs = Date.now();
        const runId = randomUUID();
        dispatch({
          type: "updateAgent",
          agentId,
          patch: {
            draft: "",
            lastUserMessage: trimmed,
            lastActivityAt: nowMs,
          },
        });
        dispatch({
          type: "appendOutput",
          agentId,
          line: `> ${trimmed}`,
          transcript: {
            source: "local-send",
            runId,
            sessionKey,
            timestampMs: nowMs,
            role: "user",
            kind: "user",
            confirmed: true,
          },
        });
        setOfficeTriggerState((previous) =>
          reduceOfficeAnimationTriggerEvent({
            state: previous,
            agents: stateRef.current.agents,
            nowMs,
            event: {
              type: "event",
              event: "chat",
              payload: {
                runId,
                sessionKey,
                state: "final",
                message: {
                  role: "user",
                  content: trimmed,
                },
              },
            },
          }),
        );
        return;
      }

      await chatController.handleSend(agentId, sessionKey, trimmed);
    },
    [
      chatController,
      dispatch,
      phoneCallByAgentId,
      stopVoiceReplyPlayback,
      textMessageByAgentId,
    ],
  );

  useEffect(() => {
    if (!pendingStandupRequest) return;
    if (lastStandupTriggerKeyRef.current === pendingStandupRequest.key) return;
    if (
      standupController.meeting &&
      standupController.meeting.phase !== "complete"
    ) {
      return;
    }
    lastStandupTriggerKeyRef.current = pendingStandupRequest.key;
    void triggerStandupMeeting(pendingStandupRequest.message).catch((error) => {
      console.error("Failed to trigger standup meeting.", error);
    });
  }, [pendingStandupRequest, standupController.meeting, triggerStandupMeeting]);

  const transcribeVoicePayload = useCallback(
    async (payload: VoiceSendPayload) => {
      const file = new File([payload.blob], payload.fileName, {
        type: payload.mimeType,
      });
      const formData = new FormData();
      formData.set("audio", file);
      const response = await fetch("/api/office/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as {
        transcript?: string | null;
        error?: string;
        ignored?: boolean;
      } | null;
      if (!response.ok) {
        throw new Error(
          result?.error?.trim() || "Failed to transcribe voice input.",
        );
      }
      if (result?.ignored) {
        return null;
      }
      const transcript = result?.transcript?.trim() ?? "";
      if (!transcript) {
        throw new Error("OpenClaw returned an empty transcript.");
      }
      return transcript;
    },
    [],
  );

  const sendVoicePayloadToAgent = useCallback(
    async (
      agent: Pick<AgentState, "agentId" | "sessionKey"> | null,
      payload: VoiceSendPayload,
    ) => {
      if (!agent) {
        throw new Error("Target agent not found.");
      }
      const transcript = await transcribeVoicePayload(payload);
      if (!transcript) return;
      await handleChatSend(agent.agentId, agent.sessionKey, transcript);
    },
    [handleChatSend, transcribeVoicePayload],
  );

  const handleVoiceSend = useCallback(
    async (payload: VoiceSendPayload) => {
      if (!focusedChatAgent) {
        throw new Error("Select an agent before using push-to-talk.");
      }
      await sendVoicePayloadToAgent(focusedChatAgent, payload);
    },
    [focusedChatAgent, sendVoicePayloadToAgent],
  );

  const {
    state: mainVoiceState,
    error: mainVoiceError,
    supported: mainVoiceSupported,
    start: startMainVoiceRecording,
    stop: stopMainVoiceRecording,
    clearError: clearMainVoiceError,
  } = useVoiceRecorder({
    enabled: status === "connected" && Boolean(mainAgent),
    onVoiceSend: async (payload) => {
      if (!mainAgent) {
        throw new Error("Main agent not found.");
      }
      await sendVoicePayloadToAgent(mainAgent, payload);
    },
  });

  useFinalizedAssistantReplyListener(state.agents, ({ text }) => {
    if (!voiceRepliesLoaded || !voiceRepliesEnabled) return;
    enqueueVoiceReply({
      text,
      provider: voiceRepliesPreference.provider,
      voiceId: voiceRepliesPreference.voiceId,
    });
  });

  useEffect(() => {
    const optionHeldRef = { current: false };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Alt" || event.repeat || optionHeldRef.current) return;
      optionHeldRef.current = true;
      event.preventDefault();
      void startMainVoiceRecording();
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Alt") return;
      optionHeldRef.current = false;
      event.preventDefault();
      stopMainVoiceRecording();
    };
    const handleWindowBlur = () => {
      optionHeldRef.current = false;
      stopMainVoiceRecording();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [startMainVoiceRecording, stopMainVoiceRecording]);

  useEffect(() => {
    if (!mainVoiceError) return;
    const timer = window.setTimeout(() => {
      clearMainVoiceError();
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [clearMainVoiceError, mainVoiceError]);

  const officeAgents = useMemo(() => {
    void clockTick;
    const now = Date.now();
    const nextCache = new Map<
      string,
      {
        agent: AgentState;
        deskHeld: boolean;
        gymHeld: boolean;
        latchedWorking: boolean;
        officeAgent: OfficeAgent;
        phoneBoothHeld: boolean;
        qaHeld: boolean;
        smsBoothHeld: boolean;
      }
    >();
    const nextOfficeAgents = state.agents.map((agent) => {
      const latchedWorking = (workingUntilByAgentId[agent.agentId] ?? 0) > now;
      const deskHeld = Boolean(deskHoldByAgentId[agent.agentId]);
      const gymHeld = Boolean(gymHoldByAgentId[agent.agentId]);
      const phoneBoothHeld = Boolean(phoneBoothHoldByAgentId[agent.agentId]);
      const qaHeld = Boolean(qaHoldByAgentId[agent.agentId]);
      const smsBoothHeld = Boolean(smsBoothHoldByAgentId[agent.agentId]);
      const cached = officeAgentCacheRef.current.get(agent.agentId);
      if (
        cached &&
        cached.agent === agent &&
        cached.latchedWorking === latchedWorking &&
        cached.deskHeld === deskHeld &&
        cached.gymHeld === gymHeld &&
        cached.phoneBoothHeld === phoneBoothHeld &&
        cached.qaHeld === qaHeld &&
        cached.smsBoothHeld === smsBoothHeld
      ) {
        nextCache.set(agent.agentId, cached);
        return cached.officeAgent;
      }
      const effectiveAgent: AgentState =
        latchedWorking && agent.status !== "error"
          ? {
              ...agent,
              status: "running",
              runId: agent.runId ?? `latched-${agent.agentId}`,
            }
          : (deskHeld || gymHeld || qaHeld || phoneBoothHeld || smsBoothHeld) &&
              agent.status !== "error"
            ? {
                ...agent,
                status: "running",
                runId:
                  agent.runId ??
                  (qaHeld
                    ? `qa-hold-${agent.agentId}`
                    : smsBoothHeld
                      ? `text-hold-${agent.agentId}`
                    : phoneBoothHeld
                      ? `call-hold-${agent.agentId}`
                    : gymHeld
                      ? `gym-hold-${agent.agentId}`
                      : `desk-hold-${agent.agentId}`),
              }
            : agent;
      const officeAgent = mapAgentToOffice(effectiveAgent);
      nextCache.set(agent.agentId, {
        agent,
        deskHeld,
        gymHeld,
        latchedWorking,
        officeAgent,
        phoneBoothHeld,
        qaHeld,
        smsBoothHeld,
      });
      return officeAgent;
    });
    officeAgentCacheRef.current = nextCache;
    return nextOfficeAgents;
  }, [
    clockTick,
    deskHoldByAgentId,
    gymHoldByAgentId,
    phoneBoothHoldByAgentId,
    qaHoldByAgentId,
    smsBoothHoldByAgentId,
    state.agents,
    workingUntilByAgentId,
  ]);
  const openClawLiveStateText = useMemo(() => {
    const lines = ["== LIVE OPENCLAW STATE =="];
    if (state.agents.length === 0) {
      lines.push("No agents loaded yet.");
      return lines.join("\n");
    }

    for (const agent of state.agents) {
      lines.push("");
      lines.push(`[${agent.agentId}] ${agent.name || "Agent"}`);
      lines.push(
        `status=${agent.status} runId=${agent.runId ?? "-"} session=${agent.sessionKey}`,
      );
      lines.push(
        `lastActivity=${agent.lastActivityAt ? formatOpenClawTimestamp(agent.lastActivityAt) : "-"} lastAssistant=${agent.lastAssistantMessageAt ? formatOpenClawTimestamp(agent.lastAssistantMessageAt) : "-"}`,
      );
      lines.push(
        `latestPreview=${formatOpenClawValue(agent.latestPreview)} lastUser=${formatOpenClawValue(agent.lastUserMessage)}`,
      );
      if (agent.thinkingTrace?.trim()) {
        lines.push("thinking>");
        lines.push(agent.thinkingTrace.trim());
      }
      if (agent.streamText?.trim()) {
        lines.push("assistant_stream>");
        lines.push(agent.streamText.trim());
      }
      const recentOutput = agent.outputLines
        .slice(-MAX_OPENCLAW_AGENT_OUTPUT_LINES)
        .map((line) => line.trimEnd())
        .filter(Boolean);
      if (recentOutput.length > 0) {
        lines.push("recent_output>");
        lines.push(...recentOutput);
      }
    }

    return lines.join("\n");
  }, [state.agents]);
  const normalizedOpenClawConsoleSearch = openClawConsoleSearch
    .trim()
    .toLowerCase();
  const filteredOpenClawLogEntries = useMemo(() => {
    if (!normalizedOpenClawConsoleSearch) return openClawLogEntries;
    return openClawLogEntries.filter((entry) =>
      [
        entry.timestamp,
        entry.eventName,
        entry.eventKind,
        entry.summary,
        entry.role ?? "",
        entry.messageText ?? "",
        entry.thinkingText ?? "",
        entry.streamText ?? "",
        entry.toolText ?? "",
        entry.payloadText,
      ]
        .join("\n")
        .toLowerCase()
        .includes(normalizedOpenClawConsoleSearch),
    );
  }, [normalizedOpenClawConsoleSearch, openClawLogEntries]);
  const openClawLiveStateMatchesSearch = useMemo(() => {
    if (!normalizedOpenClawConsoleSearch) return true;
    return openClawLiveStateText
      .toLowerCase()
      .includes(normalizedOpenClawConsoleSearch);
  }, [normalizedOpenClawConsoleSearch, openClawLiveStateText]);
  const openClawConsoleExportJson = useMemo(
    () =>
      safeJsonStringify({
        exportedAt: new Date().toISOString(),
        searchQuery: openClawConsoleSearch,
        visibleEventCount: filteredOpenClawLogEntries.length,
        totalEventCount: openClawLogEntries.length,
        liveStateMatchesSearch: openClawLiveStateMatchesSearch,
        liveStateText: openClawLiveStateText,
        events: filteredOpenClawLogEntries,
      }),
    [
      filteredOpenClawLogEntries,
      openClawConsoleSearch,
      openClawLiveStateMatchesSearch,
      openClawLiveStateText,
      openClawLogEntries.length,
    ],
  );

  const handleClearOpenClawConsole = useCallback(() => {
    setOpenClawLogEntries([]);
  }, []);
  const handleCopyOpenClawConsoleJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(openClawConsoleExportJson);
      setOpenClawConsoleCopyStatus("copied");
      window.setTimeout(() => {
        setOpenClawConsoleCopyStatus("idle");
      }, 1800);
    } catch (error) {
      console.error("Failed to copy OpenClaw console JSON.", error);
      setOpenClawConsoleCopyStatus("error");
      window.setTimeout(() => {
        setOpenClawConsoleCopyStatus("idle");
      }, 1800);
    }
  }, [openClawConsoleExportJson]);
  const handleDownloadOpenClawConsoleJson = useCallback(() => {
    const blob = new Blob([openClawConsoleExportJson], {
      type: "application/json;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `openclaw-events-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [openClawConsoleExportJson]);

  const monitorByAgentId = useMemo(
    () => {
      const nextCache = new Map<
        string,
        { agent: AgentState; monitor: OfficeDeskMonitor }
      >();
      const nextMonitorByAgentId: Record<string, OfficeDeskMonitor> = {};

      for (const agent of state.agents) {
        const cached = deskMonitorCacheRef.current.get(agent.agentId);
        if (cached && cached.agent === agent) {
          nextCache.set(agent.agentId, cached);
          nextMonitorByAgentId[agent.agentId] = cached.monitor;
          continue;
        }

        const monitor = buildOfficeDeskMonitor(agent);
        const entry = { agent, monitor };
        nextCache.set(agent.agentId, entry);
        nextMonitorByAgentId[agent.agentId] = monitor;
      }

      deskMonitorCacheRef.current = nextCache;
      return nextMonitorByAgentId;
    },
    [state.agents],
  );
  const githubSkill = useMemo<SkillStatusEntry | null>(
    () =>
      marketplace.skillsReport?.skills.find((skill) => {
        const normalizedKey = skill.skillKey.trim().toLowerCase();
        const normalizedName = skill.name.trim().toLowerCase();
        return normalizedKey === "github" || normalizedName === "github";
      }) ?? null,
    [marketplace.skillsReport],
  );

  if (
    !agentsLoaded &&
    (!connectPromptReady ||
      (gatewayUrl.trim().length > 0 &&
        !shouldPromptForConnect &&
        (!didAttemptGatewayConnect || status === "connecting")))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-[#4FC3F7]">
        CONNECTING TO GATEWAY...
      </div>
    );
  }

  if (
    connectPromptReady &&
    status === "disconnected" &&
    !agentsLoaded &&
    (shouldPromptForConnect || didAttemptGatewayConnect)
  ) {
    return (
      <main className="min-h-screen bg-black px-4 py-10">
        <GatewayConnectScreen
          gatewayUrl={gatewayUrl}
          token={token}
          localGatewayDefaults={localGatewayDefaults}
          status={status}
          error={gatewayError}
          showApprovalHint={didAttemptGatewayConnect}
          onGatewayUrlChange={setGatewayUrl}
          onTokenChange={setToken}
          onUseLocalDefaults={useLocalGatewayDefaults}
          onConnect={() => void connect()}
        />
      </main>
    );
  }

  const runningCount = state.agents.filter(
    (agent) =>
      agent.status === "running" ||
      deskHoldByAgentId[agent.agentId] ||
      gymHoldByAgentId[agent.agentId] ||
      phoneBoothHoldByAgentId[agent.agentId] ||
      smsBoothHoldByAgentId[agent.agentId] ||
      qaHoldByAgentId[agent.agentId],
  ).length;
  const unseenInboxCount = state.agents.filter(
    (agent) => agent.hasUnseenActivity,
  ).length;
  const showEmptyFleetBanner =
    status === "connected" && agentsLoaded && state.agents.length === 0;
  const emptyFleetMessage =
    state.error?.trim() ||
    "Connected to the gateway, but no agents were loaded into the office.";

  return (
    <main className="h-full w-full overflow-hidden bg-black">
      <RetroOffice3D
        agents={officeAgents}
        animationState={officeAnimationState}
        deskAssignmentByDeskUid={deskAssignmentByDeskUid}
        githubReviewAgentId={githubReviewAgentId}
        qaTestingAgentId={qaTestingAgentId}
        phoneBoothAgentId={activePhoneBoothAgentId}
        phoneCallScenario={activePhoneCallScenario}
        smsBoothAgentId={activeSmsBoothAgentId}
        textMessageScenario={activeTextMessageScenario}
        monitorAgentId={monitorAgentId}
        monitorByAgentId={monitorByAgentId}
        githubSkill={githubSkill}
        officeTitle={officeTitle}
        officeTitleLoaded={officeTitleLoaded}
        voiceRepliesEnabled={voiceRepliesEnabled}
        voiceRepliesVoiceId={voiceRepliesVoiceId}
        voiceRepliesSpeed={voiceRepliesSpeed}
        voiceRepliesLoaded={voiceRepliesLoaded}
        onOfficeTitleChange={setOfficeTitle}
        onVoiceRepliesToggle={setVoiceRepliesEnabled}
        onVoiceRepliesVoiceChange={setVoiceRepliesVoiceId}
        onVoiceRepliesSpeedChange={setVoiceRepliesSpeed}
        onVoiceRepliesPreview={(voiceId, voiceName) => {
          void previewVoiceReply({
            text: `Hi, how can I help you? My name is ${voiceName}.`,
            provider: voiceRepliesPreference.provider,
            voiceId,
            speed: voiceRepliesSpeed,
          });
        }}
        atmAnalytics={{
          client,
          status,
          agents: state.agents,
          gatewayUrl,
          settingsCoordinator,
        }}
        onGatewayDisconnect={disconnect}
        onOpenOnboarding={handleOpenOnboarding}
        feedEvents={feedEvents}
        gatewayStatus={status}
        runCountByAgentId={runCountByAgentId}
        lastSeenByAgentId={lastSeenByAgentId}
        standupMeeting={standupController.meeting}
        standupAutoOpenBoard={standupController.openBoardByDefault}
        onStandupArrivalsChange={(arrivedAgentIds) => {
          void standupController.reportArrivals(arrivedAgentIds);
        }}
        onStandupStartRequested={() => {
          if (
            !standupController.meeting ||
            standupController.meeting.phase === "complete"
          ) {
            void standupController.startMeeting("manual");
          }
        }}
        onMonitorSelect={(agentId) => {
          setMonitorAgentId(agentId);
          if (agentId) {
            setSelectedChatAgentId(agentId);
            dispatch({ type: "selectAgent", agentId });
          }
        }}
        onAgentEdit={(agentId) => {
          openAgentEditor(agentId, "avatar");
        }}
        onDeskAssignmentChange={handleDeskAssignmentChange}
        onDeskAssignmentsReset={handleDeskAssignmentsReset}
        onGithubReviewDismiss={() => {
          handleGithubReviewDismiss();
        }}
        onQaLabDismiss={() => {
          handleQaDismiss();
        }}
        onPhoneCallSpeak={handlePhoneCallSpeak}
        onPhoneCallComplete={handlePhoneCallComplete}
        onTextMessageComplete={handleTextMessageComplete}
        onOpenGithubSkillSetup={() => {
          setSidebarOpen(true);
          setActiveSidebarTab("marketplace");
        }}
      />

      {showEmptyFleetBanner ? (
        <div className="pointer-events-none fixed left-1/2 top-16 z-40 w-full max-w-xl -translate-x-1/2 px-4">
          <div className="pointer-events-auto rounded-lg border border-amber-400/35 bg-black/80 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
                  Office fleet status
                </p>
                <p className="mt-1 text-sm text-amber-50">{emptyFleetMessage}</p>
              </div>
              <button
                type="button"
                className="ui-btn-secondary shrink-0 px-3 py-2 text-xs font-semibold tracking-[0.05em] text-foreground"
                onClick={() => {
                  void loadAgents({ forceSettings: true });
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!debugEnabled ? (
        <HQSidebar
          open={sidebarOpen}
          activeTab={activeSidebarTab}
          inboxCount={unseenInboxCount}
          onToggle={() => setSidebarOpen((prev) => !prev)}
          onTabChange={setActiveSidebarTab}
          inboxPanel={
            <InboxPanel
              agents={state.agents}
              onSelectAgent={(agentId) => {
                handleOpenAgentChat(agentId);
                setActiveSidebarTab("inbox");
              }}
            />
          }
          historyPanel={
            <HistoryPanel
              runs={runLog}
              agents={state.agents}
              onSelectAgent={(agentId) => {
                handleOpenAgentChat(agentId);
                setActiveSidebarTab("history");
              }}
            />
          }
          playbooksPanel={
            <PlaybooksPanel
              client={client}
              status={status}
              agents={state.agents}
              standup={standupController}
            />
          }
          marketplacePanel={
            <SkillsMarketplacePanel
              marketplace={marketplace}
              onSelectAgent={handleOpenAgentChat}
              onOpenAgentSettings={(agentId) => {
                handleOpenAgentChat(agentId);
                router.push("/office");
              }}
            />
          }
          analyticsPanel={
            <AnalyticsPanel
              client={client}
              status={status}
              agents={state.agents}
              runLog={runLog}
              gatewayUrl={gatewayUrl}
              settingsCoordinator={settingsCoordinator}
              onSelectAgent={(agentId) => {
                handleOpenAgentChat(agentId);
                setActiveSidebarTab("analytics");
              }}
            />
          }
        />
      ) : null}

      {showOnboardingWizard ? (
        <OnboardingWizard
          gatewayConnected={status === "connected"}
          agentCount={state.agents.length}
          gatewayUrl={gatewayUrl}
          token={token}
          onGatewayUrlChange={setGatewayUrl}
          onTokenChange={setToken}
          onConnect={() => {
            void connect();
          }}
          onComplete={handleCompleteOnboarding}
          connectionError={gatewayError}
          connecting={status === "connecting"}
        />
      ) : null}

      {showOpenClawConsole ? (
        <section className="pointer-events-auto fixed bottom-3 left-3 z-30 flex w-[520px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded border border-cyan-500/25 bg-black/78 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-cyan-500/15 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
            <span>OpenClaw Event Console</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-100/45">
                agents {state.agents.length} | events{" "}
                {filteredOpenClawLogEntries.length}/{openClawLogEntries.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleCopyOpenClawConsoleJson();
                }}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                {openClawConsoleCopyStatus === "copied"
                  ? "Copied"
                  : openClawConsoleCopyStatus === "error"
                    ? "Copy Failed"
                    : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={handleDownloadOpenClawConsoleJson}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={handleClearOpenClawConsole}
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() =>
                  setOpenClawConsoleCollapsed((previous) => !previous)
                }
                className="rounded border border-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
              >
                {openClawConsoleCollapsed ? "Expand" : "Minimize"}
              </button>
            </div>
          </div>
          {!openClawConsoleCollapsed ? (
            <div className="flex h-[320px] flex-col gap-3 overflow-y-auto bg-[#02090b]/96 px-3 py-2 font-mono text-[10px] leading-4">
            <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={openClawConsoleSearch}
                  onChange={(event) =>
                    setOpenClawConsoleSearch(event.target.value)
                  }
                  placeholder="Search logs, payloads, thinking, user text."
                  className="min-w-0 flex-1 rounded border border-cyan-500/20 bg-black/35 px-2 py-1 text-[10px] normal-case tracking-normal text-cyan-50 placeholder:text-cyan-100/30 focus:border-cyan-400/40 focus:outline-none"
                />
                {openClawConsoleSearch ? (
                  <button
                    type="button"
                    onClick={() => setOpenClawConsoleSearch("")}
                    className="rounded border border-cyan-500/20 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-cyan-100/70 transition-colors hover:border-cyan-400/45 hover:text-cyan-50"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
            {openClawLiveStateMatchesSearch ? (
              <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2">
                <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
                  Live OpenClaw State
                </div>
                <pre className="whitespace-pre-wrap break-words text-cyan-100/80">
                  {renderOpenClawHighlightedText(
                    openClawLiveStateText,
                    openClawConsoleSearch,
                  )}
                </pre>
              </div>
            ) : (
              <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2 text-cyan-100/45">
                Live OpenClaw state does not match the current search.
              </div>
            )}
            <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
              Raw OpenClaw Gateway Events
            </div>
            {filteredOpenClawLogEntries.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-cyan-950/10 p-2 text-cyan-100/45">
                {openClawLogEntries.length === 0
                  ? "No OpenClaw gateway events received yet."
                  : "No OpenClaw events match the current search."}
              </div>
            ) : (
              filteredOpenClawLogEntries.map((entry) => {
                const isUserMessage = entry.role === "user";
                return (
                  <div
                    key={entry.id}
                    className={`rounded border p-2 ${
                      isUserMessage
                        ? "border-amber-400/30 bg-amber-950/12"
                        : "border-cyan-500/12 bg-cyan-950/8"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className={`text-[9px] uppercase tracking-[0.16em] ${
                          isUserMessage
                            ? "text-amber-300/85"
                            : "text-cyan-300/75"
                        }`}
                      >
                        {renderOpenClawHighlightedText(
                          `[${entry.timestamp}] ${entry.eventName} / ${entry.eventKind}`,
                          openClawConsoleSearch,
                        )}
                      </div>
                      {entry.role ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${
                            isUserMessage
                              ? "bg-amber-400/15 text-amber-200"
                              : "bg-cyan-400/10 text-cyan-200/80"
                          }`}
                        >
                          {entry.role}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-cyan-100/55">
                      {renderOpenClawHighlightedText(
                        entry.summary,
                        openClawConsoleSearch,
                      )}
                    </div>
                    {entry.messageText ? (
                      <div className="mt-2 rounded border border-amber-400/20 bg-amber-950/25 px-2 py-1 text-amber-100">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-amber-300/75">
                          User / Message Text
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {renderOpenClawHighlightedText(
                            entry.messageText,
                            openClawConsoleSearch,
                          )}
                        </div>
                      </div>
                    ) : null}
                    {entry.thinkingText ? (
                      <div className="mt-2 rounded border border-fuchsia-400/15 bg-fuchsia-950/15 px-2 py-1 text-fuchsia-100/90">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-fuchsia-300/70">
                          Thinking
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {renderOpenClawHighlightedText(
                            entry.thinkingText,
                            openClawConsoleSearch,
                          )}
                        </div>
                      </div>
                    ) : null}
                    {entry.streamText ? (
                      <div className="mt-2 rounded border border-cyan-400/15 bg-cyan-950/18 px-2 py-1 text-cyan-50/90">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
                          Stream
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {renderOpenClawHighlightedText(
                            entry.streamText,
                            openClawConsoleSearch,
                          )}
                        </div>
                      </div>
                    ) : null}
                    {entry.toolText ? (
                      <div className="mt-2 rounded border border-violet-400/15 bg-violet-950/15 px-2 py-1 text-violet-100/90">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-violet-300/70">
                          Tool Output
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {renderOpenClawHighlightedText(
                            entry.toolText,
                            openClawConsoleSearch,
                          )}
                        </div>
                      </div>
                    ) : null}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[9px] uppercase tracking-[0.16em] text-cyan-300/55">
                        Raw Payload
                      </summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-cyan-100/45">
                        {renderOpenClawHighlightedText(
                          entry.payloadText,
                          openClawConsoleSearch,
                        )}
                      </pre>
                    </details>
                  </div>
                );
              })
            )}
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className={`fixed bottom-3 z-30 flex flex-col items-end gap-2 ${sidebarOpen ? "right-84" : "right-3"} ${
          debugEnabled ? "hidden" : ""
        }`}
      >
        {chatOpen && (
          <div
            className="flex overflow-hidden rounded border border-white/10 bg-[#0e0a04] shadow-2xl"
            style={{ width: 560, height: 520 }}
          >
            <div className="flex w-44 shrink-0 flex-col border-r border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white/60">
                  Agents
                </span>
                <span className="font-mono text-[10px] text-white/40">
                  {state.agents.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {state.agents.length === 0 ? (
                  <div className="px-3 py-4 font-mono text-[11px] text-white/30">
                    No agents.
                  </div>
                ) : (
                  state.agents.map((agent) => {
                    const isSelected = agent.agentId === selectedChatAgentId;
                    const isRunning = agent.status === "running";
                    return (
                      <button
                        key={agent.agentId}
                        type="button"
                        onClick={() => handleOpenAgentChat(agent.agentId)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${isRunning ? "bg-emerald-400" : "bg-white/20"}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                          {agent.name || agent.agentId}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {focusedChatAgent ? (
                <AgentChatPanel
                  agent={focusedChatAgent}
                  isSelected={false}
                  canSend={status === "connected"}
                  models={gatewayModels}
                  stopBusy={
                    chatController.stopBusyAgentId === focusedChatAgent.agentId
                  }
                  onLoadMoreHistory={() => {}}
                  onOpenSettings={() => {
                    router.push("/office");
                  }}
                  onNewSession={() =>
                    chatController.handleNewSession(focusedChatAgent.agentId)
                  }
                  onModelChange={(value) =>
                    dispatch({
                      type: "updateAgent",
                      agentId: focusedChatAgent.agentId,
                      patch: { model: value ?? undefined },
                    })
                  }
                  onThinkingChange={(value) =>
                    dispatch({
                      type: "updateAgent",
                      agentId: focusedChatAgent.agentId,
                      patch: { thinkingLevel: value ?? undefined },
                    })
                  }
                  onDraftChange={(value) =>
                    chatController.handleDraftChange(
                      focusedChatAgent.agentId,
                      value,
                    )
                  }
                  onSend={(message) => {
                    void handleChatSend(
                      focusedChatAgent.agentId,
                      focusedChatAgent.sessionKey,
                      message,
                    );
                  }}
                  onRemoveQueuedMessage={(index) =>
                    chatController.removeQueuedMessage(
                      focusedChatAgent.agentId,
                      index,
                    )
                  }
                  onStopRun={() => {
                    void chatController.handleStopRun(
                      focusedChatAgent.agentId,
                      focusedChatAgent.sessionKey,
                    );
                  }}
                  onAvatarShuffle={() =>
                    openAgentEditor(focusedChatAgent.agentId, "avatar")
                  }
                  onVoiceSend={handleVoiceSend}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center font-mono text-[12px] text-white/30">
                  Select an agent to chat.
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          className="flex items-center gap-1.5 rounded border border-amber-700/50 bg-[#0e0a04]/90 px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider text-amber-500/80 shadow-lg backdrop-blur transition-colors hover:border-amber-600/70 hover:text-amber-400"
        >
          {chatOpen ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>HIDE CHAT</span>
            </>
          ) : (
            <>
              <MessageSquare className="h-3.5 w-3.5" />
              <span>CHAT</span>
              {runningCount > 0 ? (
                <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-400">
                  {runningCount}
                </span>
              ) : null}
            </>
          )}
        </button>
      </div>

      {mainVoiceState !== "idle" || mainVoiceError ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div
            className={`flex min-w-[220px] items-center gap-3 rounded-full border px-4 py-3 font-mono text-[12px] shadow-2xl backdrop-blur ${
              mainVoiceError
                ? "border-red-500/45 bg-red-950/75 text-red-100"
                : "border-cyan-400/35 bg-black/70 text-white"
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                mainVoiceState === "recording"
                  ? "bg-red-500/25 text-red-200"
                  : mainVoiceState === "transcribing"
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "bg-white/10 text-white"
              }`}
            >
              <Mic className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                Main agent
              </span>
              <span className="text-[12px] font-medium text-white">
                {mainVoiceError
                  ? mainVoiceError
                  : mainVoiceState === "recording"
                    ? "Listening. Release Option to send."
                    : mainVoiceState === "transcribing"
                      ? "Transcribing your voice note."
                      : mainVoiceState === "requesting"
                        ? "Requesting microphone access."
                        : !mainVoiceSupported
                          ? "Voice shortcuts are not supported in this browser."
                          : "Voice shortcut ready."}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {debugEnabled ? (
        <section className="fixed bottom-3 right-3 z-50 max-h-[45vh] w-[560px] overflow-auto rounded border border-slate-700 bg-black/90 p-3 font-mono text-[11px] text-slate-100">
          <div className="mb-2 font-semibold text-cyan-300">office debug</div>
          <div className="mb-2 text-slate-400">
            status: {status} | agents: {state.agents.length}
          </div>
          {debugRows.length === 0 ? (
            <div className="text-slate-500">No debug data yet.</div>
          ) : (
            <div className="space-y-2">
              {debugRows.map((row) => (
                <div
                  key={row.agentId}
                  className="rounded border border-slate-800 p-2"
                >
                  <div className="text-cyan-200">
                    {row.name} ({row.agentId})
                  </div>
                  <div>
                    storeStatus={row.storeStatus} runId={row.runId ?? "null"}{" "}
                    inferredRunning=
                    {String(row.inferredRunning)}
                  </div>
                  <div>
                    lastRole={row.lastRole} messages={row.messageCount}
                  </div>
                  <div className="truncate text-slate-400">
                    detectedSession={row.detectedSessionKey || "-"}
                  </div>
                  <div className="truncate text-slate-400">
                    lastText={row.lastText || "-"}
                  </div>
                  <div className="truncate text-slate-500">
                    sessions={row.inspectedSessions || "-"}
                  </div>
                  <div className="text-slate-500">
                    source={row.inferenceSource}
                  </div>
                  <div className="text-slate-500">at={row.at}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {agentEditorAgent ? (
        <AgentEditorModal
          open
          client={client}
          agents={state.agents}
          agent={agentEditorAgent}
          initialSection={agentEditorInitialSection}
          onClose={() => {
            setAgentEditorAgentId(null);
          }}
          onAvatarSave={handleAvatarProfileSave}
          onRename={async (agentId, name) => {
            if (!client) return false;
            try {
              await renameGatewayAgent({ client, agentId, name });
              dispatch({ type: "updateAgent", agentId, patch: { name } });
              return true;
            } catch {
              return false;
            }
          }}
        />
      ) : null}
    </main>
  );
}
