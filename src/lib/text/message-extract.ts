const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  "WebChat",
  "WhatsApp",
  "Telegram",
  "Signal",
  "Slack",
  "Discord",
  "iMessage",
  "Teams",
  "Matrix",
  "Zalo",
  "Zalo Personal",
  "BlueBubbles",
];

const textCache = new WeakMap<object, string | null>();
const thinkingCache = new WeakMap<object, string | null>();

const THINKING_TAG_RE = /<\s*\/?\s*(think(?:ing)?|analysis)\s*>/gi;
const THINKING_OPEN_RE = /<\s*(think(?:ing)?|analysis)\s*>/i;
const THINKING_CLOSE_RE = /<\s*\/\s*(think(?:ing)?|analysis)\s*>/i;

const THINKING_BLOCK_RE =
  /<\s*(think(?:ing)?|analysis)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
const THINKING_STREAM_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
const TRACE_MARKDOWN_PREFIX = "[[trace]]";

const TOOL_CALL_PREFIX = "[[tool]]";
const TOOL_RESULT_PREFIX = "[[tool-result]]";
const META_PREFIX = "[[meta]]";

export type AgentInstructionParams = {
  message: string;
};

const EXEC_APPROVAL_WAIT_POLICY = [
  "Execution approval policy:",
  "- If any tool result says approval is required or pending, stop immediately.",
  "- Do not call additional tools and do not switch to alternate approaches.",
  'If approved command output is unavailable, reply exactly: "Waiting for approved command result."',
].join("\n");

const stripAppendedExecApprovalPolicy = (text: string): string => {
  const suffix = `\n\n${EXEC_APPROVAL_WAIT_POLICY}`;
  if (!text.endsWith(suffix)) return text;
  return text.slice(0, -suffix.length);
};

const ASSISTANT_PREFIX_RE = /^(?:\[\[reply_to_current\]\]|\[reply_to_current\])\s*(?:\|\s*)?/i;
const stripAssistantPrefix = (text: string): string => {
  if (!text) return text;
  if (!ASSISTANT_PREFIX_RE.test(text)) return text;
  return text.replace(ASSISTANT_PREFIX_RE, "").trimStart();
};

type ToolCallRecord = {
  id?: string;
  name?: string;
  arguments?: unknown;
};

type ToolResultRecord = {
  toolCallId?: string;
  toolName?: string;
  details?: Record<string, unknown> | null;
  isError?: boolean;
  text?: string | null;
};

const looksLikeEnvelopeHeader = (header: string): boolean => {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) return true;
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) return true;
  if (/[A-Za-z]{3} \d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) return true;
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
};

const stripEnvelope = (text: string): string => {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) return text;
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) return text;
  return text.slice(match[0].length);
};

const stripThinkingTagsFromAssistantText = (value: string): string => {
  if (!value) return value;
  const hasOpen = THINKING_OPEN_RE.test(value);
  const hasClose = THINKING_CLOSE_RE.test(value);
  if (!hasOpen && !hasClose) return value;
  if (hasOpen !== hasClose) {
    if (!hasOpen) return value.replace(THINKING_CLOSE_RE, "").trimStart();
    return value.replace(THINKING_OPEN_RE, "").trimStart();
  }

  if (!THINKING_TAG_RE.test(value)) return value;
  THINKING_TAG_RE.lastIndex = 0;

  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  for (const match of value.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    if (!inThinking) {
      result += value.slice(lastIndex, idx);
    }
    const tag = match[0].toLowerCase();
    inThinking = !tag.includes("/");
    lastIndex = idx + match[0].length;
  }
  if (!inThinking) {
    result += value.slice(lastIndex);
  }
  return result.trimStart();
};

const extractRawText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) return parts.join("\n");
  }
  if (typeof m.text === "string") return m.text;
  return null;
};

export const extractText = (message: unknown): string | null => {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  const content = m.content;

  const postProcess = (value: string): string => {
    if (role === "assistant") {
      return stripAssistantPrefix(stripThinkingTagsFromAssistantText(value));
    }
    return stripAppendedExecApprovalPolicy(stripEnvelope(value));
  };

  if (typeof content === "string") {
    return postProcess(content);
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");

    if (parts.length > 0) {
      return postProcess(parts.join("\n"));
    }
  }

  if (typeof m.text === "string") {
    return postProcess(m.text);
  }

  return null;
};

export const extractTextCached = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return extractText(message);
  const obj = message as object;
  if (textCache.has(obj)) return textCache.get(obj) ?? null;
  const value = extractText(message);
  textCache.set(obj, value);
  return value;
};

export const extractThinking = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  const content = m.content;
  const parts: string[] = [];

  const extractFromRecord = (record: Record<string, unknown>): string | null => {
    const directKeys = [
      "thinking",
      "analysis",
      "reasoning",
      "thinkingText",
      "analysisText",
      "reasoningText",
      "thinking_text",
      "analysis_text",
      "reasoning_text",
      "thinkingDelta",
      "analysisDelta",
      "reasoningDelta",
      "thinking_delta",
      "analysis_delta",
      "reasoning_delta",
    ] as const;
    for (const key of directKeys) {
      const value = record[key];
      if (typeof value === "string") {
        const cleaned = value.trim();
        if (cleaned) return cleaned;
      }
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        const nestedKeys = [
          "text",
          "delta",
          "content",
          "summary",
          "analysis",
          "reasoning",
          "thinking",
        ] as const;
        for (const nestedKey of nestedKeys) {
          const nestedValue = nested[nestedKey];
          if (typeof nestedValue === "string") {
            const cleaned = nestedValue.trim();
            if (cleaned) return cleaned;
          }
        }
      }
    }
    return null;
  };

  if (Array.isArray(content)) {
    for (const p of content) {
      const item = p as Record<string, unknown>;
      const type = typeof item.type === "string" ? item.type : "";
      if (type === "thinking" || type === "analysis" || type === "reasoning") {
        const extracted = extractFromRecord(item);
        if (extracted) {
          parts.push(extracted);
        } else if (typeof item.text === "string") {
          const cleaned = item.text.trim();
          if (cleaned) parts.push(cleaned);
        }
      } else if (typeof item.thinking === "string") {
        const cleaned = item.thinking.trim();
        if (cleaned) parts.push(cleaned);
      }
    }
  }
  if (parts.length > 0) return parts.join("\n");

  const direct = extractFromRecord(m);
  if (direct) return direct;

  const rawText = extractRawText(message);
  if (!rawText) return null;
  const matches = [...rawText.matchAll(THINKING_BLOCK_RE)];
  const extracted = matches
    .map((match) => (match[2] ?? "").trim())
    .filter(Boolean);
  if (extracted.length > 0) return extracted.join("\n");
  const openTagged = extractThinkingFromTaggedStream(rawText);
  return openTagged ? openTagged : null;
};

export function extractThinkingFromTaggedText(text: string): string {
  if (!text) return "";
  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  THINKING_STREAM_TAG_RE.lastIndex = 0;
  for (const match of text.matchAll(THINKING_STREAM_TAG_RE)) {
    const idx = match.index ?? 0;
    if (inThinking) {
      result += text.slice(lastIndex, idx);
    }
    const isClose = match[1] === "/";
    inThinking = !isClose;
    lastIndex = idx + match[0].length;
  }
  return result.trim();
}

export function extractThinkingFromTaggedStream(text: string): string {
  if (!text) return "";
  const closed = extractThinkingFromTaggedText(text);
  if (closed) return closed;
  const openRe = /<\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const closeRe = /<\s*\/\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const openMatches = [...text.matchAll(openRe)];
  if (openMatches.length === 0) return "";
  const closeMatches = [...text.matchAll(closeRe)];
  const lastOpen = openMatches[openMatches.length - 1];
  const lastClose = closeMatches[closeMatches.length - 1];
  if (lastClose && (lastClose.index ?? -1) > (lastOpen.index ?? -1)) {
    return closed;
  }
  const start = (lastOpen.index ?? 0) + lastOpen[0].length;
  return text.slice(start).trim();
}

export const extractThinkingCached = (message: unknown): string | null => {
  if (!message || typeof message !== "object") return extractThinking(message);
  const obj = message as object;
  if (thinkingCache.has(obj)) return thinkingCache.get(obj) ?? null;
  const value = extractThinking(message);
  thinkingCache.set(obj, value);
  return value;
};

export const formatThinkingMarkdown = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `_${line}_`);
  if (lines.length === 0) return "";
  return `${TRACE_MARKDOWN_PREFIX}\n${lines.join("\n\n")}`;
};

export const isTraceMarkdown = (line: string): boolean =>
  line.startsWith(TRACE_MARKDOWN_PREFIX);

export const stripTraceMarkdown = (line: string): string => {
  if (!isTraceMarkdown(line)) return line;
  return line.slice(TRACE_MARKDOWN_PREFIX.length).trimStart();
};

const formatJson = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stringify tool args.";
    console.warn(message);
    return String(value);
  }
};

const formatToolResultMeta = (details?: Record<string, unknown> | null, isError?: boolean) => {
  const parts: string[] = [];
  if (details && typeof details === "object") {
    const status = details.status;
    if (typeof status === "string" && status.trim()) {
      parts.push(status.trim());
    }
    const exitCode = details.exitCode;
    if (typeof exitCode === "number") {
      parts.push(`exit ${exitCode}`);
    }
    const durationMs = details.durationMs;
    if (typeof durationMs === "number") {
      parts.push(`${durationMs}ms`);
    }
    const cwd = details.cwd;
    if (typeof cwd === "string" && cwd.trim()) {
      parts.push(cwd.trim());
    }
  }
  if (isError) {
    parts.push("error");
  }
  return parts.length ? parts.join(" · ") : "";
};

export const extractToolCalls = (message: unknown): ToolCallRecord[] => {
  if (!message || typeof message !== "object") return [];
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) return [];
  const calls: ToolCallRecord[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "toolCall") continue;
    calls.push({
      id: typeof record.id === "string" ? record.id : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
      arguments: record.arguments,
    });
  }
  return calls;
};

export const extractToolResult = (message: unknown): ToolResultRecord | null => {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : "";
  if (role !== "toolResult" && role !== "tool") return null;
  const details =
    record.details && typeof record.details === "object"
      ? (record.details as Record<string, unknown>)
      : null;
  return {
    toolCallId: typeof record.toolCallId === "string" ? record.toolCallId : undefined,
    toolName: typeof record.toolName === "string" ? record.toolName : undefined,
    details,
    isError: typeof record.isError === "boolean" ? record.isError : undefined,
    text: extractText(record),
  };
};

export const formatToolCallMarkdown = (call: ToolCallRecord): string => {
  const name = call.name?.trim() || "tool";
  const suffix = call.id ? ` (${call.id})` : "";
  const args = formatJson(call.arguments).trim();
  if (!args) {
    return `${TOOL_CALL_PREFIX} ${name}${suffix}`;
  }
  return `${TOOL_CALL_PREFIX} ${name}${suffix}\n\`\`\`json\n${args}\n\`\`\``;
};

export const formatToolResultMarkdown = (result: ToolResultRecord): string => {
  const name = result.toolName?.trim() || "tool";
  const suffix = result.toolCallId ? ` (${result.toolCallId})` : "";
  const meta = formatToolResultMeta(result.details, result.isError);
  const header = `${name}${suffix}`;
  const bodyParts: string[] = [];
  if (meta) {
    bodyParts.push(meta);
  }
  const output = result.text?.trim();
  if (output) {
    bodyParts.push(`\`\`\`text\n${output}\n\`\`\``);
  }
  return bodyParts.length === 0
    ? `${TOOL_RESULT_PREFIX} ${header}`
    : `${TOOL_RESULT_PREFIX} ${header}\n${bodyParts.join("\n")}`;
};

export const extractToolLines = (message: unknown): string[] => {
  const lines: string[] = [];
  for (const call of extractToolCalls(message)) {
    lines.push(formatToolCallMarkdown(call));
  }
  const result = extractToolResult(message);
  if (result) {
    lines.push(formatToolResultMarkdown(result));
  }
  return lines;
};

export const isToolMarkdown = (line: string): boolean =>
  line.startsWith(TOOL_CALL_PREFIX) || line.startsWith(TOOL_RESULT_PREFIX);

export const isMetaMarkdown = (line: string): boolean => line.startsWith(META_PREFIX);

export const formatMetaMarkdown = (meta: {
  role: "user" | "assistant";
  timestamp: number;
  thinkingDurationMs?: number | null;
}): string => {
  return `${META_PREFIX}${JSON.stringify({
    role: meta.role,
    timestamp: meta.timestamp,
    ...(typeof meta.thinkingDurationMs === "number" ? { thinkingDurationMs: meta.thinkingDurationMs } : {}),
  })}`;
};

export const parseMetaMarkdown = (
  line: string
): { role: "user" | "assistant"; timestamp: number; thinkingDurationMs?: number } | null => {
  if (!isMetaMarkdown(line)) return null;
  const raw = line.slice(META_PREFIX.length).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const role = parsed.role === "user" || parsed.role === "assistant" ? parsed.role : null;
    const timestamp = typeof parsed.timestamp === "number" ? parsed.timestamp : null;
    if (!role || !timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return null;
    const thinkingDurationMs =
      typeof parsed.thinkingDurationMs === "number" && Number.isFinite(parsed.thinkingDurationMs)
        ? parsed.thinkingDurationMs
        : undefined;
    return thinkingDurationMs !== undefined
      ? { role, timestamp, thinkingDurationMs }
      : { role, timestamp };
  } catch {
    return null;
  }
};

export const parseToolMarkdown = (
  line: string
): { kind: "call" | "result"; label: string; body: string } => {
  const kind = line.startsWith(TOOL_RESULT_PREFIX) ? "result" : "call";
  const prefix = kind === "result" ? TOOL_RESULT_PREFIX : TOOL_CALL_PREFIX;
  const content = line.slice(prefix.length).trimStart();
  const [labelLine, ...rest] = content.split(/\r?\n/);
  return {
    kind,
    label: labelLine?.trim() || (kind === "result" ? "Tool result" : "Tool call"),
    body: rest.join("\n").trim(),
  };
};

export const buildAgentInstruction = ({
  message,
}: AgentInstructionParams): string => {
  return message.trim();
};

const PROJECT_PROMPT_BLOCK_RE = /^(?:Project|Workspace) path:[\s\S]*?\n\s*\n/i;
const PROJECT_PROMPT_INLINE_RE = /^(?:Project|Workspace) path:[\s\S]*?memory_search\.\s*/i;
const RESET_PROMPT_RE =
  /^A new session was started via \/new or \/reset[\s\S]*?reasoning\.\s*/i;
const SYSTEM_EVENT_BLOCK_RE = /^System:\s*\[[^\]]+\][\s\S]*?\n\s*\n/;
const MESSAGE_ID_RE = /\s*\[message_id:[^\]]+\]\s*/gi;
export const EXEC_APPROVAL_AUTO_RESUME_MARKER = "[[hermes3d:auto-resume-exec-approval]]";
const LEGACY_EXEC_APPROVAL_AUTO_RESUME_RE =
  /exec approval was granted[\s\S]*continue where you left off/i;
const UI_METADATA_PREFIX_RE =
  /^(?:Project path:|Workspace path:|A new session was started via \/new or \/reset)/i;
const HEARTBEAT_PROMPT_RE = /^Read HEARTBEAT\.md if it exists\b/i;
const HEARTBEAT_PATH_RE = /Heartbeat file path:/i;

export const stripUiMetadata = (text: string) => {
  if (!text) return text;
  if (
    text.includes(EXEC_APPROVAL_AUTO_RESUME_MARKER) ||
    LEGACY_EXEC_APPROVAL_AUTO_RESUME_RE.test(text)
  ) {
    return "";
  }
  let cleaned = text.replace(RESET_PROMPT_RE, "");
  cleaned = cleaned.replace(SYSTEM_EVENT_BLOCK_RE, "");
  const beforeProjectStrip = cleaned;
  cleaned = cleaned.replace(PROJECT_PROMPT_INLINE_RE, "");
  if (cleaned === beforeProjectStrip) {
    cleaned = cleaned.replace(PROJECT_PROMPT_BLOCK_RE, "");
  }
  cleaned = cleaned.replace(MESSAGE_ID_RE, "").trim();
  return stripEnvelope(cleaned);
};

export const isHeartbeatPrompt = (text: string) => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return HEARTBEAT_PROMPT_RE.test(trimmed) || HEARTBEAT_PATH_RE.test(trimmed);
};

export const isUiMetadataPrefix = (text: string) => UI_METADATA_PREFIX_RE.test(text);
