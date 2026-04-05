import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronRight, Clock, Mic, Pencil, Square, Trash2, X } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import { rewriteMediaLinesToMarkdown } from "@/lib/text/media-markdown";
import { normalizeAssistantDisplayText } from "@/lib/text/assistantText";
import { isNearBottom } from "@/lib/dom";
import { useVoiceRecorder, type VoiceRecorderState, type VoiceSendPayload } from "@/hooks/useVoiceRecorder";
import { AgentAvatar } from "./AgentAvatar";
import type {
  ExecApprovalDecision,
  PendingExecApproval,
} from "@/features/agents/approvals/types";
import {
  buildAgentChatRenderBlocks,
  buildFinalAgentChatItems,
  summarizeToolLabel,
  type AssistantTraceEvent,
  type AgentChatItem,
} from "./chatItems";

const formatChatTimestamp = (timestampMs: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestampMs));
};

const formatDurationLabel = (durationMs: number): string => {
  const seconds = durationMs / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
};

const SPINE_LEFT = "left-[15px]";
const ASSISTANT_GUTTER_CLASS = "pl-[44px]";
const ASSISTANT_MAX_WIDTH_DEFAULT_CLASS = "max-w-[68ch]";
const ASSISTANT_MAX_WIDTH_EXPANDED_CLASS = "max-w-[1120px]";
const CHAT_TOP_THRESHOLD_PX = 8;
const CHAT_SELECT_STYLE = {
  backgroundColor: "#17120a",
  color: "#ffffff",
} as const;
const EMPTY_CHAT_INTRO_MESSAGES = [
  "How can I help you today?",
  "What should we accomplish today?",
  "Ready when you are. What do you want to tackle?",
  "What are we working on today?",
  "I'm here and ready. What's the plan?",
];

const stableStringHash = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const resolveEmptyChatIntroMessage = (agentId: string, sessionEpoch: number | undefined): string => {
  if (EMPTY_CHAT_INTRO_MESSAGES.length === 0) return "How can I help you today?";
  const normalizedEpoch =
    typeof sessionEpoch === "number" && Number.isFinite(sessionEpoch)
      ? Math.max(0, Math.trunc(sessionEpoch))
      : 0;
  const offset = stableStringHash(agentId) % EMPTY_CHAT_INTRO_MESSAGES.length;
  const index = (offset + normalizedEpoch) % EMPTY_CHAT_INTRO_MESSAGES.length;
  return EMPTY_CHAT_INTRO_MESSAGES[index];
};

const looksLikePath = (value: string): boolean => {
  if (!value) return false;
  if (/(^|[\s(])(?:[A-Za-z]:\\|~\/|\/)/.test(value)) return true;
  if (/(^|[\s(])(src|app|packages|components)\//.test(value)) return true;
  if (/(^|[\s(])[\w.-]+\.(ts|tsx|js|jsx|json|md|py|go|rs|java|kt|rb|sh|yaml|yml)\b/.test(value)) {
    return true;
  }
  return false;
};

const isStructuredMarkdown = (text: string): boolean => {
  if (!text) return false;
  if (/```/.test(text)) return true;
  if (/^\s*#{1,6}\s+/m.test(text)) return true;
  if (/^\s*[-*+]\s+/m.test(text)) return true;
  if (/^\s*\d+\.\s+/m.test(text)) return true;
  if (/^\s*\|.+\|\s*$/m.test(text)) return true;
  if (looksLikePath(text) && text.split("\n").filter(Boolean).length >= 3) return true;
  return false;
};

const resolveAssistantMaxWidthClass = (text: string | null | undefined): string => {
  const value = (text ?? "").trim();
  if (!value) return ASSISTANT_MAX_WIDTH_DEFAULT_CLASS;
  if (isStructuredMarkdown(value)) return ASSISTANT_MAX_WIDTH_EXPANDED_CLASS;
  const nonEmptyLines = value.split("\n").filter((line) => line.trim().length > 0);
  const shortLineCount = nonEmptyLines.filter((line) => line.trim().length <= 44).length;
  if (nonEmptyLines.length >= 10 && shortLineCount / Math.max(1, nonEmptyLines.length) >= 0.65) {
    return ASSISTANT_MAX_WIDTH_EXPANDED_CLASS;
  }
  return ASSISTANT_MAX_WIDTH_DEFAULT_CLASS;
};

type AgentChatPanelProps = {
  agent: AgentRecord;
  isSelected: boolean;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  onLoadMoreHistory: () => void;
  onOpenSettings?: () => void;
  onRename?: (name: string) => Promise<boolean>;
  onNewSession?: () => Promise<void> | void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onToolCallingToggle?: (enabled: boolean) => void;
  onThinkingTracesToggle?: (enabled: boolean) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onRemoveQueuedMessage?: (index: number) => void;
  onStopRun: () => void;
  onAvatarShuffle: () => void;
  pendingExecApprovals?: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
  onVoiceSend?: (payload: VoiceSendPayload) => Promise<void>;
};

const formatApprovalExpiry = (timestampMs: number): string => {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
};

const ExecApprovalCard = memo(function ExecApprovalCard({
  approval,
  onResolve,
}: {
  approval: PendingExecApproval;
  onResolve?: (id: string, decision: ExecApprovalDecision) => void;
}) {
  const disabled = approval.resolving || !onResolve;
  return (
    <div
      className={`w-full ${ASSISTANT_MAX_WIDTH_EXPANDED_CLASS} ${ASSISTANT_GUTTER_CLASS} ui-badge-approval self-start rounded-md px-3 py-2 shadow-2xs`}
      data-testid={`exec-approval-card-${approval.id}`}
    >
      <div className="type-meta">
        Exec approval required
      </div>
      <div className="mt-2 rounded-md bg-surface-3 px-2 py-1.5 shadow-2xs">
        <div className="font-mono text-[10px] font-semibold text-foreground">{approval.command}</div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>Host: {approval.host ?? "unknown"}</div>
        <div>Expires: {formatApprovalExpiry(approval.expiresAtMs)}</div>
        {approval.cwd ? <div className="sm:col-span-2">CWD: {approval.cwd}</div> : null}
      </div>
      {approval.error ? (
        <div className="ui-alert-danger mt-2 rounded-md px-2 py-1 text-[11px] shadow-2xs">
          {approval.error}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-once")}
          disabled={disabled}
          aria-label={`Allow once for exec approval ${approval.id}`}
        >
          Allow once
        </button>
        <button
          type="button"
          className="rounded-md border border-border/70 bg-surface-3 px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "allow-always")}
          disabled={disabled}
          aria-label={`Always allow for exec approval ${approval.id}`}
        >
          Always allow
        </button>
        <button
          type="button"
          className="ui-btn-danger rounded-md px-2.5 py-1 font-mono text-[12px] font-medium tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onResolve?.(approval.id, "deny")}
          disabled={disabled}
          aria-label={`Deny exec approval ${approval.id}`}
        >
          Deny
        </button>
      </div>
    </div>
  );
});

const ToolCallDetails = memo(function ToolCallDetails({
  line,
  className,
}: {
  line: string;
  className?: string;
}) {
  const { summaryText, body, inlineOnly } = summarizeToolLabel(line);
  const [open, setOpen] = useState(false);
  const resolvedClassName =
    className ??
    `w-full ${ASSISTANT_MAX_WIDTH_EXPANDED_CLASS} ${ASSISTANT_GUTTER_CLASS} self-start rounded-md bg-surface-3 px-2 py-1 text-[10px] text-muted-foreground shadow-2xs`;
  if (inlineOnly) {
    return (
      <div className={resolvedClassName}>
        <div className="font-mono text-[10px] font-semibold tracking-[0.11em]">{summaryText}</div>
      </div>
    );
  }
  return (
    <details open={open} className={resolvedClassName}>
      <summary
        className="cursor-pointer select-none font-mono text-[10px] font-semibold tracking-[0.11em]"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        {summaryText}
      </summary>
      {open && body ? (
        <div className="agent-markdown agent-tool-markdown mt-1 text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {rewriteMediaLinesToMarkdown(body)}
          </ReactMarkdown>
        </div>
      ) : null}
    </details>
  );
});

const ThinkingDetailsRow = memo(function ThinkingDetailsRow({
  events,
  thinkingText,
  toolLines = [],
  durationMs,
  showTyping,
}: {
  events?: AssistantTraceEvent[];
  thinkingText?: string | null;
  toolLines?: string[];
  durationMs?: number;
  showTyping?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const traceEvents = (() => {
    if (events && events.length > 0) return events;
    const normalizedThinkingText = thinkingText?.trim() ?? "";
    const next: AssistantTraceEvent[] = [];
    if (normalizedThinkingText) {
      next.push({ kind: "thinking", text: normalizedThinkingText });
    }
    for (const line of toolLines) {
      next.push({ kind: "tool", text: line });
    }
    return next;
  })();
  if (traceEvents.length === 0) return null;
  return (
    <details
      open={open}
      className="ui-chat-thinking group rounded-md px-2 py-1.5 text-[10px] shadow-2xs"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 opacity-65 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
            Thinking (internal)
          </span>
          {typeof durationMs === "number" ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[0.02em] text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {formatDurationLabel(durationMs)}
            </span>
          ) : null}
          {showTyping ? (
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
        </span>
      </summary>
      {open ? (
        <div className="mt-2 space-y-2 pl-5">
          {traceEvents.map((event, index) =>
            event.kind === "thinking" ? (
              <div
                key={`thinking-event-${index}-${event.text.slice(0, 48)}`}
                className="agent-markdown min-w-0 text-foreground/85"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.text}</ReactMarkdown>
              </div>
            ) : (
              <ToolCallDetails
                key={`thinking-tool-${index}-${event.text.slice(0, 48)}`}
                line={event.text}
                className="rounded-md border border-border/45 bg-surface-2/65 px-2 py-1 text-[10px] text-muted-foreground/90 shadow-2xs"
              />
            )
          )}
        </div>
      ) : null}
    </details>
  );
});

const UserMessageCard = memo(function UserMessageCard({
  text,
  timestampMs,
}: {
  text: string;
  timestampMs?: number;
}) {
  return (
    <div className="ui-chat-user-card w-full max-w-[70ch] self-end overflow-hidden rounded-[var(--radius-small)] bg-[color:var(--chat-user-bg)]">
      <div className="flex items-center justify-between gap-3 bg-[color:var(--chat-user-header-bg)] px-3 py-2 dark:px-3.5 dark:py-2.5">
        <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
          You
        </div>
        {typeof timestampMs === "number" ? (
          <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/70">
            {formatChatTimestamp(timestampMs)}
          </time>
        ) : null}
      </div>
      <div className="agent-markdown type-body px-3 py-3 text-foreground dark:px-3.5 dark:py-3.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
});

const AssistantMessageCard = memo(function AssistantMessageCard({
  avatarSeed,
  avatarProfile,
  avatarUrl,
  name,
  timestampMs,
  thinkingEvents,
  thinkingText,
  thinkingToolLines,
  thinkingDurationMs,
  contentText,
  streaming,
}: {
  avatarSeed: string;
  avatarProfile?: AgentAvatarProfile | null;
  avatarUrl: string | null;
  name: string;
  timestampMs?: number;
  thinkingEvents?: AssistantTraceEvent[];
  thinkingText?: string | null;
  thinkingToolLines?: string[];
  thinkingDurationMs?: number;
  contentText?: string | null;
  streaming?: boolean;
}) {
  const resolvedTimestamp = typeof timestampMs === "number" ? timestampMs : null;
  const hasThinking = Boolean(
    (thinkingEvents?.length ?? 0) > 0 ||
      thinkingText?.trim() ||
      (thinkingToolLines?.length ?? 0) > 0
  );
  const widthClass = hasThinking
    ? ASSISTANT_MAX_WIDTH_EXPANDED_CLASS
    : resolveAssistantMaxWidthClass(contentText);
  const hasContent = Boolean(contentText?.trim());
  const compactStreamingIndicator = Boolean(streaming && !hasThinking && !hasContent);

  return (
    <div className="w-full self-start">
      <div className={`relative w-full ${widthClass} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar
            seed={avatarSeed}
            name={name}
            avatarProfile={avatarProfile}
            avatarUrl={avatarUrl}
            size={22}
          />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
          {resolvedTimestamp !== null ? (
            <time className="type-meta shrink-0 rounded-md bg-surface-3 px-2 py-0.5 font-mono text-muted-foreground/90">
              {formatChatTimestamp(resolvedTimestamp)}
            </time>
          ) : null}
        </div>

        {compactStreamingIndicator ? (
          <div
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-surface-3 px-3 py-2 text-[10px] text-muted-foreground/80 shadow-2xs"
            role="status"
            aria-live="polite"
            data-testid="agent-typing-indicator"
          >
            <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
              Thinking
            </span>
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : (
          <div className="mt-2 space-y-3 dark:space-y-5">
            {streaming && !hasThinking ? (
              <div
                className="flex items-center gap-2 text-[10px] text-muted-foreground/80"
                role="status"
                aria-live="polite"
                data-testid="agent-typing-indicator"
              >
                <span className="font-mono text-[10px] font-medium tracking-[0.02em]">
                  Thinking
                </span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            ) : null}

            {hasThinking ? (
              <ThinkingDetailsRow
                events={thinkingEvents}
                thinkingText={thinkingText}
                toolLines={thinkingToolLines ?? []}
                durationMs={thinkingDurationMs}
                showTyping={streaming}
              />
            ) : null}

            {contentText ? (
              <div className="ui-chat-assistant-card">
                {streaming ? (
                  (() => {
                    if (!contentText.includes("MEDIA:")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    const rewritten = rewriteMediaLinesToMarkdown(contentText);
                    if (!rewritten.includes("![](")) {
                      return (
                        <div className="whitespace-pre-wrap break-words text-foreground">
                          {contentText}
                        </div>
                      );
                    }
                    return (
                      <div className="agent-markdown text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{rewritten}</ReactMarkdown>
                      </div>
                    );
                  })()
                ) : (
                  <div className="agent-markdown text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {rewriteMediaLinesToMarkdown(contentText)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
});

const AssistantIntroCard = memo(function AssistantIntroCard({
  avatarSeed,
  avatarProfile,
  avatarUrl,
  name,
  title,
}: {
  avatarSeed: string;
  avatarProfile?: AgentAvatarProfile | null;
  avatarUrl: string | null;
  name: string;
  title: string;
}) {
  return (
    <div className="w-full self-start">
      <div className={`relative w-full ${ASSISTANT_MAX_WIDTH_DEFAULT_CLASS} ${ASSISTANT_GUTTER_CLASS}`}>
        <div className="absolute left-[4px] top-[2px]">
          <AgentAvatar
            seed={avatarSeed}
            name={name}
            avatarProfile={avatarProfile}
            avatarUrl={avatarUrl}
            size={22}
          />
        </div>
        <div className="flex items-center justify-between gap-3 py-0.5">
          <div className="type-meta min-w-0 truncate font-mono text-foreground/90">
            {name}
          </div>
        </div>
        <div className="ui-chat-assistant-card mt-2">
          <div className="text-[14px] leading-[1.65] text-foreground">{title}</div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.03em] text-muted-foreground/80">
            Try describing a task, bug, or question to get started.
          </div>
        </div>
      </div>
    </div>
  );
});

const AgentChatFinalItems = memo(function AgentChatFinalItems({
  agentId,
  name,
  avatarSeed,
  avatarProfile,
  avatarUrl,
  chatItems,
  running,
  runStartedAt,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarProfile?: AgentAvatarProfile | null;
  avatarUrl: string | null;
  chatItems: AgentChatItem[];
  running: boolean;
  runStartedAt: number | null;
}) {
  const blocks = buildAgentChatRenderBlocks(chatItems);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "user") {
          return (
            <UserMessageCard
              key={`chat-${agentId}-user-${index}`}
              text={block.text}
              timestampMs={block.timestampMs}
            />
          );
        }
        const streaming = running && index === blocks.length - 1 && !block.text;
        return (
          <AssistantMessageCard
            key={`chat-${agentId}-assistant-${index}`}
            avatarSeed={avatarSeed}
            avatarProfile={avatarProfile}
            avatarUrl={avatarUrl}
            name={name}
            timestampMs={block.timestampMs ?? (streaming ? runStartedAt ?? undefined : undefined)}
            thinkingEvents={block.traceEvents}
            thinkingDurationMs={block.thinkingDurationMs}
            contentText={block.text}
            streaming={streaming}
          />
        );
      })}
    </>
  );
});

const AgentChatTranscript = memo(function AgentChatTranscript({
  agentId,
  name,
  avatarSeed,
  avatarProfile,
  avatarUrl,
  status,
  historyMaybeTruncated,
  historyFetchedCount,
  historyFetchLimit,
  onLoadMoreHistory,
  chatItems,
  liveThinkingText,
  liveAssistantText,
  showTypingIndicator,
  outputLineCount,
  liveAssistantCharCount,
  liveThinkingCharCount,
  runStartedAt,
  scrollToBottomNextOutputRef,
  pendingExecApprovals,
  onResolveExecApproval,
  emptyStateTitle,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarProfile?: AgentAvatarProfile | null;
  avatarUrl: string | null;
  status: AgentRecord["status"];
  historyMaybeTruncated: boolean;
  historyFetchedCount: number | null;
  historyFetchLimit: number | null;
  onLoadMoreHistory: () => void;
  chatItems: AgentChatItem[];
  liveThinkingText: string;
  liveAssistantText: string;
  showTypingIndicator: boolean;
  outputLineCount: number;
  liveAssistantCharCount: number;
  liveThinkingCharCount: number;
  runStartedAt: number | null;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  pendingExecApprovals: PendingExecApproval[];
  onResolveExecApproval?: (id: string, decision: ExecApprovalDecision) => void;
  emptyStateTitle: string;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);
  const [isAtTop, setIsAtTop] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const scrollChatToBottom = useCallback(() => {
    if (!chatRef.current) return;
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ block: "end" });
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const nextAtTop = el.scrollTop <= CHAT_TOP_THRESHOLD_PX;
    setIsAtTop((current) => (current === nextAtTop ? current : nextAtTop));
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        48
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollChatToBottom();
    });
  }, [scrollChatToBottom]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  const showJumpToLatest =
    !isPinned && (outputLineCount > 0 || liveAssistantCharCount > 0 || liveThinkingCharCount > 0);

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      scheduleScrollToBottom();
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    liveAssistantCharCount,
    liveThinkingCharCount,
    outputLineCount,
    pendingExecApprovals.length,
    scheduleScrollToBottom,
    scrollToBottomNextOutputRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  const showLiveAssistantCard =
    status === "running" && Boolean(liveThinkingText || liveAssistantText || showTypingIndicator);
  const hasApprovals = pendingExecApprovals.length > 0;
  const hasTranscriptContent = chatItems.length > 0 || hasApprovals;

  useEffect(() => {
    if (status !== "running" || typeof runStartedAt !== "number" || !showLiveAssistantCard) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [runStartedAt, showLiveAssistantCard, status]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={chatRef}
        data-testid="agent-chat-scroll"
        className={`ui-chat-scroll ui-chat-scroll-borderless h-full overflow-auto p-4 dark:p-6 sm:p-5 dark:sm:p-7 ${showJumpToLatest ? "pb-20" : ""}`}
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="relative flex flex-col gap-6 dark:gap-8 text-[14px] leading-[1.65] text-foreground">
          <div aria-hidden className={`pointer-events-none absolute ${SPINE_LEFT} top-0 bottom-0 w-px bg-border/20`} />
          {historyMaybeTruncated && isAtTop ? (
            <div className="-mx-1 flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 shadow-2xs">
              <div className="type-meta min-w-0 truncate font-mono text-muted-foreground">
                Showing most recent {typeof historyFetchedCount === "number" ? historyFetchedCount : "?"} messages
                {typeof historyFetchLimit === "number" ? ` (limit ${historyFetchLimit})` : ""}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-border/70 bg-surface-3 px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2"
                onClick={onLoadMoreHistory}
              >
                Load more
              </button>
            </div>
          ) : null}
          {!hasTranscriptContent ? (
            <AssistantIntroCard
              avatarSeed={avatarSeed}
              avatarProfile={avatarProfile}
              avatarUrl={avatarUrl}
              name={name}
              title={emptyStateTitle}
            />
          ) : (
            <>
              <AgentChatFinalItems
                agentId={agentId}
                name={name}
                avatarSeed={avatarSeed}
                avatarProfile={avatarProfile}
                avatarUrl={avatarUrl}
                chatItems={chatItems}
                running={status === "running"}
                runStartedAt={runStartedAt}
              />
              {showLiveAssistantCard ? (
                <AssistantMessageCard
                  avatarSeed={avatarSeed}
                  avatarProfile={avatarProfile}
                  avatarUrl={avatarUrl}
                  name={name}
                  timestampMs={runStartedAt ?? undefined}
                  thinkingText={liveThinkingText || null}
                  thinkingDurationMs={
                    typeof runStartedAt === "number" && typeof nowMs === "number"
                      ? Math.max(0, nowMs - runStartedAt)
                      : undefined
                  }
                  contentText={liveAssistantText || null}
                  streaming={status === "running"}
                />
              ) : null}
              {pendingExecApprovals.map((approval) => (
                <ExecApprovalCard
                  key={approval.id}
                  approval={approval}
                  onResolve={onResolveExecApproval}
                />
              ))}
              <div ref={chatBottomRef} />
            </>
          )}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border/70 bg-card px-3 py-1.5 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground shadow-xs transition hover:bg-surface-2"
          onClick={() => {
            setPinned(true);
            scrollChatToBottom();
          }}
          aria-label="Jump to latest"
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
});

const noopToggle = () => {};
const InlineHoverTooltip = ({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) => {
  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 left-1/2 z-20 w-max max-w-none -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-card px-2 py-1 font-mono text-[10px] text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {text}
      </span>
    </div>
  );
};

const AgentChatComposer = memo(function AgentChatComposer({
  value,
  onChange,
  onKeyDown,
  onSend,
  onVoiceToggle,
  onStop,
  canSend,
  stopBusy,
  stopDisabledReason,
  running,
  sendDisabled,
  voiceEnabled,
  voiceSupported,
  voiceState,
  voiceError,
  queuedMessages,
  onRemoveQueuedMessage,
  inputRef,
  modelOptions,
  modelValue,
  allowThinking,
  thinkingValue,
  onModelChange,
  onThinkingChange,
  toolCallingEnabled,
  showThinkingTraces,
  onToolCallingToggle,
  onThinkingTracesToggle,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onVoiceToggle?: () => void;
  onStop: () => void;
  canSend: boolean;
  stopBusy: boolean;
  stopDisabledReason?: string | null;
  running: boolean;
  sendDisabled: boolean;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  voiceState: VoiceRecorderState;
  voiceError?: string | null;
  queuedMessages: string[];
  onRemoveQueuedMessage?: (index: number) => void;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  modelOptions: { value: string; label: string }[];
  modelValue: string;
  allowThinking: boolean;
  thinkingValue: string;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
}) {
  const stopReason = stopDisabledReason?.trim() ?? "";
  const stopDisabled = !canSend || stopBusy || Boolean(stopReason);
  const stopAriaLabel = stopReason ? `Stop unavailable: ${stopReason}` : "Stop";
  const voiceBusy = voiceState === "requesting" || voiceState === "transcribing";
  const voiceRecording = voiceState === "recording";
  const voiceDisabled = voiceRecording ? false : !voiceEnabled || !voiceSupported || !canSend || voiceBusy;
  const voiceLabel =
    voiceState === "recording"
      ? "Stop"
      : voiceState === "transcribing"
        ? "..."
        : voiceState === "requesting"
          ? "Mic..."
          : "Mic";
  const voiceStatusText =
    voiceState === "recording"
      ? "Recording. Tap stop to send."
      : voiceState === "transcribing"
        ? "Transcribing your voice note."
        : voiceState === "requesting"
          ? "Requesting microphone access."
          : !voiceSupported && voiceEnabled
            ? "This browser does not support microphone recording."
            : null;
  const modelSelectedLabel = useMemo(() => {
    if (modelOptions.length === 0) return "No models found";
    return modelOptions.find((option) => option.value === modelValue)?.label ?? modelValue;
  }, [modelOptions, modelValue]);
  const modelSelectWidthCh = Math.max(11, Math.min(44, modelSelectedLabel.length + 6));
  const thinkingSelectedLabel = useMemo(() => {
    switch (thinkingValue) {
      case "off":
        return "Off";
      case "minimal":
        return "Minimal";
      case "low":
        return "Low";
      case "medium":
        return "Medium";
      case "high":
        return "High";
      case "xhigh":
        return "XHigh";
      default:
        return "Default";
    }
  }, [thinkingValue]);
  const thinkingSelectWidthCh = Math.max(9, Math.min(22, thinkingSelectedLabel.length + 6));
  return (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <InlineHoverTooltip text="Choose model">
            <select
              className="ui-input ui-control-important h-6 min-w-0 rounded-md border-white/10 px-1.5 text-[10px] font-semibold text-white"
              aria-label="Model"
              value={modelValue}
              style={{ ...CHAT_SELECT_STYLE, width: `${modelSelectWidthCh}ch` }}
              onChange={(event) => {
                const nextValue = event.target.value.trim();
                onModelChange(nextValue ? nextValue : null);
                event.currentTarget.blur();
              }}
            >
              {modelOptions.length === 0 ? (
                <option value="">No models found</option>
              ) : null}
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </InlineHoverTooltip>
          {allowThinking ? (
            <InlineHoverTooltip text="Select reasoning effort">
              <select
                className="ui-input ui-control-important h-6 rounded-md border-white/10 px-1.5 text-[10px] font-semibold text-white"
                aria-label="Thinking"
                value={thinkingValue}
                style={{ ...CHAT_SELECT_STYLE, width: `${thinkingSelectWidthCh}ch` }}
                onChange={(event) => {
                  const nextValue = event.target.value.trim();
                  onThinkingChange(nextValue ? nextValue : null);
                }}
              >
                <option value="">Default</option>
                <option value="off">Off</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
            </InlineHoverTooltip>
          ) : null}
        </div>
        <div className="hidden">
          <span className="font-mono tracking-[0.02em]">Show</span>
          <button
            type="button"
            role="switch"
            aria-label="Show tool calls"
            aria-checked={toolCallingEnabled}
            className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-[10px] tracking-[0.01em] transition ${
              toolCallingEnabled
                ? "border-primary/45 bg-primary/14 text-foreground"
                : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onToolCallingToggle(!toolCallingEnabled)}
          >
            Tools
          </button>
          <button
            type="button"
            role="switch"
            aria-label="Show thinking"
            aria-checked={showThinkingTraces}
            className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-[10px] tracking-[0.01em] transition ${
              showThinkingTraces
                ? "border-primary/45 bg-primary/14 text-white"
                : "border-border/70 bg-surface-2/40 text-muted-foreground hover:text-white"
            }`}
            onClick={() => onThinkingTracesToggle(!showThinkingTraces)}
          >
            Thinking
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-border/65 bg-surface-2/45 px-3 py-2">
        {queuedMessages.length > 0 ? (
          <div
            className={`mb-2 grid items-start gap-2 ${
              running ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
            }`}
          >
            <div
              className="min-w-0 max-w-full space-y-1 overflow-hidden"
              data-testid="queued-messages-bar"
              aria-label="Queued messages"
            >
              {queuedMessages.map((queuedMessage, index) => (
                <div
                  key={`${index}-${queuedMessage}`}
                  className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-md border border-border/70 bg-card/80 px-2 py-1 text-[11px] text-foreground"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    Queued
                  </span>
                  <span
                    className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    title={queuedMessage}
                  >
                    {queuedMessage}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remove queued message ${index + 1}`}
                    onClick={() => onRemoveQueuedMessage?.(index)}
                    disabled={!onRemoveQueuedMessage}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {running ? (
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                disabled
                className="invisible rounded-md border border-border/70 bg-surface-3 px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground"
              >
                {stopBusy ? "Stopping" : "Stop"}
              </button>
            ) : null}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              disabled
              className="ui-btn-primary ui-btn-send invisible px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em]"
            >
              Send
            </button>
          </div>
        ) : null}
        {voiceStatusText || voiceError ? (
          <div
            className={`mb-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.02em] ${
              voiceError
                ? "ui-badge-status-error"
                : "ui-badge-status-approval"
            }`}
            data-testid="agent-voice-status"
          >
            {voiceError ?? voiceStatusText}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            className="chat-composer-input min-h-[64px] flex-1 resize-none border-0 bg-transparent px-0 py-1 text-[15px] leading-6 text-foreground outline-none shadow-none transition placeholder:text-muted-foreground/65 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="type a message"
          />
          {voiceEnabled ? (
            <button
              className={`rounded-md border px-2.5 py-2 font-mono text-[11px] font-medium tracking-[0.02em] transition ${
                voiceRecording
                  ? "ui-btn-danger"
                  : "border-border/70 bg-surface-3 text-white hover:bg-surface-2 hover:text-white"
              } disabled:cursor-not-allowed disabled:border-border/30 disabled:bg-muted/20 disabled:text-muted-foreground`}
              type="button"
              onClick={onVoiceToggle}
              disabled={voiceDisabled}
              data-testid="agent-voice-toggle"
              aria-label={voiceRecording ? "Stop voice recording" : "Start voice recording"}
              title={voiceRecording ? "Stop voice recording" : "Start voice recording"}
            >
              <span className="inline-flex items-center gap-1.5">
                {voiceRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span>{voiceLabel}</span>
              </span>
            </button>
          ) : null}
          {running ? (
            <span className="inline-flex" title={stopReason || undefined}>
              <button
                className="rounded-md border border-border/70 bg-surface-3 px-3 py-2 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                type="button"
                onClick={onStop}
                disabled={stopDisabled}
                aria-label={stopAriaLabel}
              >
                {stopBusy ? "Stopping" : "Stop"}
              </button>
            </span>
          ) : null}
          <button
            className="rounded border border-[color:var(--status-approval-border)] bg-[#0e0a04]/90 px-3 py-2 font-mono text-[12px] font-medium tracking-wider text-[color:var(--status-approval-fg)] shadow-lg backdrop-blur transition-colors hover:border-[color:var(--status-approval-border)] hover:text-[color:var(--status-approval-fg)] disabled:cursor-not-allowed disabled:border-border/30 disabled:bg-muted/20 disabled:text-muted-foreground"
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
});

export const AgentChatPanel = ({
  agent,
  isSelected,
  canSend,
  models,
  stopBusy,
  stopDisabledReason = null,
  onLoadMoreHistory,
  onOpenSettings,
  onRename,
  onNewSession,
  onModelChange,
  onThinkingChange,
  onToolCallingToggle = noopToggle,
  onThinkingTracesToggle = noopToggle,
  onDraftChange,
  onSend,
  onRemoveQueuedMessage,
  onStopRun,
  onAvatarShuffle,
  pendingExecApprovals = [],
  onResolveExecApproval,
  onVoiceSend,
}: AgentChatPanelProps) => {
  const [draftValue, setDraftValue] = useState(agent.draft);
  const [newSessionBusy, setNewSessionBusy] = useState(false);
  const [renameEditing, setRenameEditing] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameDraft, setRenameDraft] = useState(agent.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameEditorRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottomNextOutputRef = useRef(false);
  const plainDraftRef = useRef(agent.draft);
  const draftIdentityRef = useRef<{ agentId: string; sessionKey: string }>({
    agentId: agent.agentId,
    sessionKey: agent.sessionKey,
  });
  const pendingResizeFrameRef = useRef<number | null>(null);
  const {
    state: voiceState,
    error: voiceError,
    supported: voiceSupported,
    toggle: toggleVoiceRecording,
  } = useVoiceRecorder({
    enabled: Boolean(onVoiceSend),
    onVoiceSend,
  });

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  const handleDraftRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    draftRef.current = el instanceof HTMLTextAreaElement ? el : null;
  }, []);

  useEffect(() => {
    const previousIdentity = draftIdentityRef.current;
    const identityChanged =
      previousIdentity.agentId !== agent.agentId ||
      previousIdentity.sessionKey !== agent.sessionKey;
    if (identityChanged) {
      draftIdentityRef.current = {
        agentId: agent.agentId,
        sessionKey: agent.sessionKey,
      };
      plainDraftRef.current = agent.draft;
      setDraftValue(agent.draft);
      return;
    }
    if (agent.draft === plainDraftRef.current) return;
    if (agent.draft.length !== 0) return;
    plainDraftRef.current = "";
    setDraftValue("");
  }, [agent.agentId, agent.draft, agent.sessionKey]);

  useEffect(() => {
    setRenameEditing(false);
    setRenameSaving(false);
    setRenameError(null);
    setRenameDraft(agent.name);
  }, [agent.agentId, agent.name]);

  useEffect(() => {
    if (!renameEditing) return;
    const frameId = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [renameEditing]);

  useEffect(() => {
    if (pendingResizeFrameRef.current !== null) {
      cancelAnimationFrame(pendingResizeFrameRef.current);
    }
    pendingResizeFrameRef.current = requestAnimationFrame(() => {
      pendingResizeFrameRef.current = null;
      resizeDraft();
    });
    return () => {
      if (pendingResizeFrameRef.current !== null) {
        cancelAnimationFrame(pendingResizeFrameRef.current);
        pendingResizeFrameRef.current = null;
      }
    };
  }, [resizeDraft, draftValue]);

  const handleSend = useCallback(
    (message: string) => {
      if (!canSend) return;
      const trimmed = message.trim();
      if (!trimmed) return;
      plainDraftRef.current = "";
      setDraftValue("");
      onDraftChange("");
      scrollToBottomNextOutputRef.current = true;
      onSend(trimmed);
    },
    [canSend, onDraftChange, onSend]
  );

  const chatItems = useMemo(
    () =>
      buildFinalAgentChatItems({
        outputLines: agent.outputLines,
        showThinkingTraces: agent.showThinkingTraces,
        toolCallingEnabled: agent.toolCallingEnabled,
      }),
    [agent.outputLines, agent.showThinkingTraces, agent.toolCallingEnabled]
  );
  const running = agent.status === "running";
  const renderBlocks = useMemo(() => buildAgentChatRenderBlocks(chatItems), [chatItems]);
  const hasActiveStreamingTailInTranscript =
    running && renderBlocks.length > 0 && !renderBlocks[renderBlocks.length - 1].text;
  const liveAssistantText =
    running && agent.streamText ? normalizeAssistantDisplayText(agent.streamText) : "";
  const liveThinkingText =
    running && agent.showThinkingTraces && agent.thinkingTrace ? agent.thinkingTrace.trim() : "";
  const hasVisibleLiveThinking = Boolean(liveThinkingText.trim());
  const showTypingIndicator =
    running &&
    !hasVisibleLiveThinking &&
    !liveAssistantText &&
    !hasActiveStreamingTailInTranscript;

  const modelOptions = useMemo(
    () =>
      models.map((entry) => {
        const key = `${entry.provider}/${entry.id}`;
        const alias = typeof entry.name === "string" ? entry.name.trim() : "";
        return {
          value: key,
          label: !alias || alias === key ? key : alias,
          reasoning: entry.reasoning,
        };
      }),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  const avatarProfile = agent.avatarProfile ?? null;
  const emptyStateTitle = useMemo(
    () => resolveEmptyChatIntroMessage(agent.agentId, agent.sessionEpoch),
    [agent.agentId, agent.sessionEpoch]
  );
  const sendDisabled = !canSend || !draftValue.trim();

  const handleComposerChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      plainDraftRef.current = value;
      setDraftValue(value);
      onDraftChange(value);
    },
    [onDraftChange]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      handleSend(draftValue);
    },
    [draftValue, handleSend]
  );

  const handleComposerSend = useCallback(() => {
    handleSend(draftValue);
  }, [draftValue, handleSend]);

  const handleVoiceToggle = useCallback(
    () => {
      if (!canSend && voiceState !== "recording") return;
      void toggleVoiceRecording();
    },
    [canSend, toggleVoiceRecording, voiceState],
  );

  const beginRename = useCallback(() => {
    if (!onRename) return;
    setRenameEditing(true);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, onRename]);

  const cancelRename = useCallback(() => {
    if (renameSaving) return;
    setRenameEditing(false);
    setRenameDraft(agent.name);
    setRenameError(null);
  }, [agent.name, renameSaving]);

  useEffect(() => {
    if (!renameEditing) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (renameEditorRef.current?.contains(target)) return;
      cancelRename();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [cancelRename, renameEditing]);

  const submitRename = useCallback(async () => {
    if (!onRename || renameSaving) return;
    const nextName = renameDraft.trim();
    const currentName = agent.name.trim();
    if (!nextName) {
      setRenameError("Agent name is required.");
      return;
    }
    if (nextName === currentName) {
      setRenameEditing(false);
      setRenameError(null);
      setRenameDraft(agent.name);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const ok = await onRename(nextName);
      if (!ok) {
        setRenameError("Failed to rename agent.");
        return;
      }
      setRenameEditing(false);
      setRenameDraft(nextName);
    } finally {
      setRenameSaving(false);
    }
  }, [agent.name, onRename, renameDraft, renameSaving]);

  const handleRenameInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submitRename();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, submitRename]
  );

  const handleNewSession = useCallback(async () => {
    if (!onNewSession || newSessionBusy || !canSend) return;
    setNewSessionBusy(true);
    try {
      await onNewSession();
    } finally {
      setNewSessionBusy(false);
    }
  }, [canSend, newSessionBusy, onNewSession]);

  const newSessionDisabled = newSessionBusy || !canSend || !onNewSession;

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full flex-col">
      <div className="px-3 pt-2 sm:px-4 sm:pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="group/avatar relative">
              <AgentAvatar
                seed={avatarSeed}
                name={agent.name}
                avatarProfile={avatarProfile}
                avatarUrl={agent.avatarUrl ?? null}
                size={52}
                isSelected={isSelected}
              />
              <button
                className="nodrag ui-btn-icon ui-btn-icon-xs agent-avatar-shuffle-btn absolute bottom-0 right-0"
                style={{ "--ui-btn-icon-size": "1.1rem" } as React.CSSProperties}
                type="button"
                aria-label="Customize avatar"
                data-testid="agent-avatar-customize"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAvatarShuffle();
                }}
              >
                <Pencil className="h-2 w-2" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 w-[clamp(11rem,34vw,16rem)]">
                  {renameEditing ? (
                    <div ref={renameEditorRef} className="flex h-8 items-center gap-1.5">
                      <input
                        ref={renameInputRef}
                        className="ui-input agent-rename-input h-8 min-w-0 flex-1 rounded-md px-2 text-[12px] font-semibold text-foreground"
                        aria-label="Edit agent name"
                        data-testid="agent-rename-input"
                        value={renameDraft}
                        disabled={renameSaving}
                        onChange={(event) => {
                          setRenameDraft(event.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        onKeyDown={handleRenameInputKeyDown}
                      />
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Save agent name"
                        data-testid="agent-rename-save"
                        onClick={() => {
                          void submitRename();
                        }}
                        disabled={renameSaving}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="ui-btn-icon ui-btn-icon-sm agent-rename-control"
                        type="button"
                        aria-label="Cancel agent rename"
                        data-testid="agent-rename-cancel"
                        onClick={cancelRename}
                        disabled={renameSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-8 min-w-0 items-center gap-1.5">
                      <div className="type-agent-name min-w-0 truncate text-foreground">
                        {agent.name}
                      </div>
                      {onRename ? (
                        <button
                          className="ui-btn-icon ui-btn-icon-xs agent-rename-control shrink-0"
                          type="button"
                          aria-label="Rename agent"
                          data-testid="agent-rename-toggle"
                          onClick={beginRename}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              {renameError ? (
                <div className="ui-text-danger mt-1 text-[11px]">{renameError}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            {onOpenSettings ? (
              <button
                className="nodrag ui-btn-icon ui-btn-icon-sm shrink-0"
                type="button"
                data-testid="agent-settings-toggle"
                aria-label="Open behavior"
                title="Open behavior"
                onClick={onOpenSettings}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              className="nodrag inline-flex items-center whitespace-nowrap rounded border border-[color:var(--status-approval-border)] bg-[color:var(--status-approval-bg)] px-2 py-0.5 font-mono text-[9px] font-medium tracking-[0.02em] text-white transition hover:bg-[color:var(--status-approval-bg)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              data-testid="agent-new-session-toggle"
              aria-label="Start new session"
              title="Start new session"
              onClick={() => {
                void handleNewSession();
              }}
              disabled={newSessionDisabled}
            >
              {newSessionBusy ? "Starting..." : "New session"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-4 sm:pb-4">
        <AgentChatTranscript
          agentId={agent.agentId}
          name={agent.name}
          avatarSeed={avatarSeed}
          avatarProfile={avatarProfile}
          avatarUrl={agent.avatarUrl ?? null}
          status={agent.status}
          historyMaybeTruncated={agent.historyMaybeTruncated}
          historyFetchedCount={agent.historyFetchedCount}
          historyFetchLimit={agent.historyFetchLimit}
          onLoadMoreHistory={onLoadMoreHistory}
          chatItems={chatItems}
          liveThinkingText={liveThinkingText}
          liveAssistantText={liveAssistantText}
          showTypingIndicator={showTypingIndicator}
          outputLineCount={agent.outputLines.length}
          liveAssistantCharCount={liveAssistantText.length}
          liveThinkingCharCount={liveThinkingText.length}
          runStartedAt={agent.runStartedAt}
          scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
          pendingExecApprovals={pendingExecApprovals}
          onResolveExecApproval={onResolveExecApproval}
          emptyStateTitle={emptyStateTitle}
        />

        <div className="mt-3">
          <AgentChatComposer
            value={draftValue}
            inputRef={handleDraftRef}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDown}
            onSend={handleComposerSend}
            onVoiceToggle={handleVoiceToggle}
            onStop={onStopRun}
            canSend={canSend}
            stopBusy={stopBusy}
            stopDisabledReason={stopDisabledReason}
            running={running}
            sendDisabled={sendDisabled}
            voiceEnabled={Boolean(onVoiceSend)}
            voiceSupported={voiceSupported}
            voiceState={voiceState}
            voiceError={voiceError}
            queuedMessages={agent.queuedMessages ?? []}
            onRemoveQueuedMessage={onRemoveQueuedMessage}
            modelOptions={modelOptionsWithFallback.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            modelValue={modelValue}
            allowThinking={allowThinking}
            thinkingValue={agent.thinkingLevel ?? ""}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
            toolCallingEnabled={agent.toolCallingEnabled}
            showThinkingTraces={agent.showThinkingTraces}
            onToolCallingToggle={onToolCallingToggle}
            onThinkingTracesToggle={onThinkingTracesToggle}
          />
        </div>
      </div>
    </div>
  );
};
