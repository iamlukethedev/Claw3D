import {
  buildAgentChatItems,
  type AgentChatItem,
} from "@/features/agents/components/chatItems";
import type { AgentState } from "@/features/agents/state/store";
import { parseToolMarkdown } from "@/lib/text/message-extract";

export type OfficeDeskMonitorMode =
  | "coding"
  | "browser"
  | "waiting"
  | "idle"
  | "error";

export type OfficeDeskMonitorEntry = {
  kind: "user" | "assistant" | "thinking" | "tool";
  text: string;
  live?: boolean;
};

export type OfficeDeskMonitor = {
  agentId: string;
  agentName: string;
  mode: OfficeDeskMonitorMode;
  title: string;
  subtitle: string;
  browserUrl: string | null;
  updatedAt: number | null;
  live: boolean;
  entries: OfficeDeskMonitorEntry[];
  editor: {
    fileName: string;
    language: string;
    lines: string[];
    terminalLines: string[];
    cursorLine: number;
    cursorColumn: number;
  } | null;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const DOMAIN_RE =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?\b/gi;
const PATH_RE =
  /(?:^|[\s("'`])((?:src|app|components|pages|lib|tests|server|scripts)\/[^\s)"'`]+?\.(?:ts|tsx|js|jsx|html|css|json|md))/g;
const CODE_FENCE_RE = /```([a-z0-9_+-]+)?\n([\s\S]*?)```/i;
const BROWSER_KEYWORD_RE =
  /\b(browser|navigate|snapshot|screenshot|tab|click|console|cookies|storage|page|url)\b/i;
const BROWSER_INTENT_RE =
  /\b(browse|inspect|visit|navigate|open|go to|website|site|page)\b/i;
const MONITOR_HISTORY_LINE_LIMIT = 160;
const MONITOR_BROWSER_SCAN_ENTRY_LIMIT = 18;

const extractUrls = (value: string): string[] => {
  const matches = value.match(URL_RE);
  return matches ? matches.map((entry) => entry.trim()) : [];
};

const normalizeBrowserUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/[.,;!?]+$/g, "");
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.includes(".") || /\s/.test(trimmed)) return null;
  return `https://${trimmed}`;
};

const extractDomains = (value: string): string[] => {
  const matches = value.match(DOMAIN_RE);
  return matches ? matches.map((entry) => entry.trim()) : [];
};

const extractPath = (value: string): string | null => {
  const match = value.match(PATH_RE);
  if (!match || match.length === 0) return null;
  const last = match[match.length - 1];
  if (!last) return null;
  return last.trim().replace(/^[\s("'`]+/, "");
};

const normalizeEntryText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

const flattenMonitorEntry = (item: AgentChatItem): OfficeDeskMonitorEntry | null => {
  const text =
    item.kind === "tool"
      ? (() => {
          const parsed = parseToolMarkdown(item.text);
          const body = parsed.body.trim();
          return normalizeEntryText(body ? `${parsed.label}: ${body}` : parsed.label);
        })()
      : normalizeEntryText(item.text);
  if (!text) return null;
  return {
    kind: item.kind,
    text,
    ...("live" in item && item.live ? { live: true } : {}),
  };
};

const toCommentLine = (value: string): string => `  // ${value}`;

const derivePseudoEditor = (task: string): { fileName: string; language: string; lines: string[] } => {
  const normalized = task.trim().toLowerCase();
  if (normalized.includes("contact form")) {
    return {
      fileName: "ContactForm.tsx",
      language: "tsx",
      lines: [
        'export default function ContactForm() {',
        '  return (',
        '    <main className="mx-auto max-w-xl p-8">', 
        '      <h1 className="text-3xl font-semibold">Contact us</h1>',
        '      <form className="mt-6 space-y-4 rounded-2xl border p-6 shadow-sm">', 
        '        <input className="w-full rounded-lg border px-4 py-3" placeholder="Name" />',
        '        <input className="w-full rounded-lg border px-4 py-3" placeholder="Email" />',
        '        <textarea className="min-h-40 w-full rounded-lg border px-4 py-3" placeholder="Message" />',
        '        <button className="rounded-lg bg-black px-5 py-3 text-white">Send message</button>',
        '      </form>',
        '    </main>',
        '  );',
        '}',
      ],
    };
  }
  if (normalized.includes("hello world")) {
    return {
      fileName: "page.tsx",
      language: "tsx",
      lines: [
        'export default function Page() {',
        '  return (',
        '    <main className="flex min-h-screen items-center justify-center">', 
        '      <h1 className="text-5xl font-bold">Hello world</h1>',
        '    </main>',
        '  );',
        '}',
      ],
    };
  }
  if (normalized.includes("html")) {
    return {
      fileName: "index.html",
      language: "html",
      lines: [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '  <title>Working Draft</title>',
        '</head>',
        '<body>',
        `  <!-- ${task.trim()} -->`,
        '</body>',
        '</html>',
      ],
    };
  }
  return {
    fileName: "workbench.tsx",
    language: "tsx",
    lines: [
      'export function Workbench() {',
      toCommentLine(task.trim() || "Working on the requested task."),
      '  return (',
      '    <section>',
      '      <div>Implementing monitor preview...</div>',
      '    </section>',
      '  );',
      '}',
    ],
  };
};

const deriveEditorDocument = (params: {
  agent: AgentState;
  entries: OfficeDeskMonitorEntry[];
}): OfficeDeskMonitor["editor"] => {
  const codeSource = [...params.entries]
    .reverse()
    .find((entry) => entry.kind === "assistant" || entry.kind === "tool" || entry.kind === "thinking");
  const sourceText = codeSource?.text ?? "";
  const codeFence = sourceText.match(CODE_FENCE_RE);
  let fileName =
    extractPath(sourceText) ??
    extractPath(params.agent.lastUserMessage ?? "") ??
    null;
  let language = codeFence?.[1]?.trim() || "";
  let lines: string[] = [];

  if (codeFence?.[2]) {
    lines = codeFence[2].replace(/\r/g, "").split("\n");
  } else {
    const task =
      params.agent.lastUserMessage ??
      [...params.entries].reverse().find((entry) => entry.kind === "user")?.text ??
      "Working on the current request.";
    const pseudo = derivePseudoEditor(task);
    if (!fileName) fileName = pseudo.fileName;
    if (!language) language = pseudo.language;
    lines = pseudo.lines;
  }

  const resolvedFileName = fileName?.split("/").pop()?.trim() || "workbench.tsx";
  const resolvedLanguage =
    language ||
    resolvedFileName.split(".").pop()?.trim() ||
    "tsx";
  const terminalLines = params.entries
    .slice(-4)
    .map((entry) => `${entry.kind === "tool" ? "$ " : entry.kind === "user" ? "> " : ""}${entry.text}`);
  const cursorLine = Math.max(1, lines.length);
  const cursorColumn = Math.max(1, (lines[lines.length - 1]?.length ?? 0) + 1);

  return {
    fileName: resolvedFileName,
    language: resolvedLanguage,
    lines,
    terminalLines,
    cursorLine,
    cursorColumn,
  };
};

const summarizeMode = (params: {
  agent: AgentState;
  entries: OfficeDeskMonitorEntry[];
  browserUrl: string | null;
}): { mode: OfficeDeskMonitorMode; title: string; subtitle: string } => {
  const { agent, entries, browserUrl } = params;
  if (agent.status === "error") {
    return {
      mode: "error",
      title: "Run error",
      subtitle: agent.latestPreview ?? "The agent hit an error.",
    };
  }
  if (browserUrl) {
    let hostname = browserUrl;
    try {
      hostname = new URL(browserUrl).host || browserUrl;
    } catch {
      // Keep the raw URL when parsing fails.
    }
    return {
      mode: "browser",
      title: "Browsing",
      subtitle: hostname,
    };
  }
  if (agent.awaitingUserInput) {
    return {
      mode: "waiting",
      title: "Waiting",
      subtitle: agent.latestPreview ?? "Waiting for the next instruction.",
    };
  }
  if (
    agent.status === "running" ||
    agent.streamText ||
    agent.thinkingTrace ||
    entries.some((entry) => entry.live)
  ) {
    return {
      mode: "coding",
      title: "Working",
      subtitle: agent.latestPreview ?? "Live agent activity.",
    };
  }
  return {
    mode: "idle",
    title: "Idle",
    subtitle: agent.latestPreview ?? "No recent live activity.",
  };
};

export const buildOfficeDeskMonitor = (
  agent: AgentState,
): OfficeDeskMonitor => {
  const monitorOutputLines = agent.outputLines.slice(-MONITOR_HISTORY_LINE_LIMIT);
  const chatItems = buildAgentChatItems({
    outputLines: monitorOutputLines,
    streamText: agent.streamText,
    liveThinkingTrace: agent.thinkingTrace ?? "",
    showThinkingTraces: agent.showThinkingTraces,
    toolCallingEnabled: agent.toolCallingEnabled,
  });
  const flatEntries = chatItems
    .map(flattenMonitorEntry)
    .filter((entry): entry is OfficeDeskMonitorEntry => Boolean(entry));
  const latestEntries = flatEntries.slice(-6);
  const browserScanEntries = flatEntries.slice(-MONITOR_BROWSER_SCAN_ENTRY_LIMIT);
  const browserUrl =
    [
      agent.lastUserMessage ?? "",
      agent.latestPreview ?? "",
      ...latestEntries.map((entry) => entry.text),
      ...browserScanEntries.map((entry) => entry.text),
    ]
      .flatMap((text) => [
        ...extractUrls(text),
        ...extractDomains(text)
          .filter(() => BROWSER_KEYWORD_RE.test(text) || BROWSER_INTENT_RE.test(text)),
      ])
      .map((value) => normalizeBrowserUrl(value))
      .find((value): value is string => Boolean(value)) ??
    null;
  const modeSummary = summarizeMode({
    agent,
    entries: latestEntries,
    browserUrl,
  });
  return {
    agentId: agent.agentId,
    agentName: agent.name,
    mode: modeSummary.mode,
    title: modeSummary.title,
    subtitle: modeSummary.subtitle,
    browserUrl,
    updatedAt: agent.lastActivityAt ?? agent.lastAssistantMessageAt ?? null,
    live:
      agent.status === "running" ||
      Boolean(agent.streamText) ||
      Boolean(agent.thinkingTrace) ||
      latestEntries.some((entry) => entry.live),
    entries: latestEntries,
    editor: modeSummary.mode === "coding" ? deriveEditorDocument({ agent, entries: flatEntries }) : null,
  };
};
