"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search, Trash2, X } from "lucide-react";

export type AgentLogEntry = {
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

const KIND_LABELS: Record<string, string> = {
  "runtime-chat": "Chat",
  "runtime-heartbeat": "Heartbeat",
  "runtime-tool": "Tool",
  "runtime-system": "System",
  "gateway-connect": "Connect",
  "gateway-disconnect": "Disconnect",
};

const KIND_COLORS: Record<string, string> = {
  "runtime-chat": "text-cyan-300 border-cyan-500/25 bg-cyan-500/8",
  "runtime-heartbeat": "text-white/30 border-white/8 bg-white/3",
  "runtime-tool": "text-amber-300 border-amber-500/25 bg-amber-500/8",
  "runtime-system": "text-violet-300 border-violet-500/25 bg-violet-500/8",
  "gateway-connect": "text-emerald-300 border-emerald-500/25 bg-emerald-500/8",
  "gateway-disconnect": "text-rose-300 border-rose-500/25 bg-rose-500/8",
};

const ROLE_COLORS: Record<string, string> = {
  assistant: "text-cyan-200",
  user: "text-emerald-200",
  system: "text-violet-200",
  tool: "text-amber-200",
};

const ALL_KINDS = [
  "runtime-chat",
  "runtime-tool",
  "runtime-system",
  "runtime-heartbeat",
  "gateway-connect",
  "gateway-disconnect",
] as const;

function LogRow({ entry }: { entry: AgentLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const kindColor = KIND_COLORS[entry.eventKind] ?? "text-white/40 border-white/8 bg-white/3";
  const roleColor = entry.role ? (ROLE_COLORS[entry.role] ?? "text-white/60") : null;
  const hasDetail =
    entry.messageText ||
    entry.thinkingText ||
    entry.streamText ||
    entry.toolText ||
    entry.payloadText;

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${hasDetail ? "hover:bg-white/[0.03]" : "cursor-default"}`}
      >
        <span className="mt-0.5 shrink-0 font-mono text-[9px] text-white/25">
          {entry.timestamp}
        </span>
        <span
          className={`mt-0.5 shrink-0 rounded border px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${kindColor}`}
        >
          {KIND_LABELS[entry.eventKind] ?? entry.eventKind}
        </span>
        {entry.role && (
          <span className={`mt-0.5 shrink-0 font-mono text-[9px] uppercase ${roleColor ?? ""}`}>
            {entry.role}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/55">
          {entry.messageText
            ? entry.messageText.slice(0, 120)
            : entry.summary}
        </span>
        {hasDetail && (
          <span className="mt-0.5 shrink-0 text-white/20">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </button>
      {expanded && hasDetail && (
        <div className="space-y-2 px-3 pb-3">
          {entry.messageText && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
                Message
              </div>
              <pre className="whitespace-pre-wrap rounded bg-black/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/70">
                {entry.messageText}
              </pre>
            </div>
          )}
          {entry.thinkingText && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300/40">
                Thinking
              </div>
              <pre className="whitespace-pre-wrap rounded bg-violet-500/5 px-3 py-2 font-mono text-[10px] leading-relaxed text-violet-200/60">
                {entry.thinkingText}
              </pre>
            </div>
          )}
          {entry.toolText && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300/40">
                Tool
              </div>
              <pre className="whitespace-pre-wrap rounded bg-amber-500/5 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/60">
                {entry.toolText}
              </pre>
            </div>
          )}
          {entry.streamText && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
                Stream
              </div>
              <pre className="whitespace-pre-wrap rounded bg-black/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/50">
                {entry.streamText}
              </pre>
            </div>
          )}
          {!entry.messageText && !entry.thinkingText && !entry.toolText && !entry.streamText && (
            <div>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
                Payload
              </div>
              <pre className="whitespace-pre-wrap rounded bg-black/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/40">
                {entry.payloadText.slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentLogsPanel({
  entries,
  onClear,
}: {
  entries: AgentLogEntry[];
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    new Set(ALL_KINDS.filter((k) => k !== "runtime-heartbeat")),
  );
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const toggleKind = (kind: string) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (!activeKinds.has(e.eventKind)) return false;
      if (activeRole && e.role !== activeRole) return false;
      if (!q) return true;
      return [
        e.timestamp,
        e.eventName,
        e.summary,
        e.role ?? "",
        e.messageText ?? "",
        e.thinkingText ?? "",
        e.streamText ?? "",
        e.toolText ?? "",
        e.payloadText,
      ]
        .join("\n")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, search, activeKinds, activeRole]);

  const handleDownload = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), entries: filtered }, null, 2)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const roles = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.role) seen.add(e.role);
    }
    return [...seen];
  }, [entries]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-transparent text-white">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-white/8 px-4 py-3">
        {/* Search + actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 font-mono text-[11px] text-white placeholder-white/25 outline-none focus:border-white/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownload}
            title="Download filtered logs as JSON"
            className="rounded border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Clear all logs"
            className="rounded border border-white/10 bg-white/5 p-1.5 text-white/50 hover:border-rose-400/30 hover:text-rose-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Kind filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                activeKinds.has(kind)
                  ? (KIND_COLORS[kind] ?? "text-white/60 border-white/15 bg-white/8")
                  : "border-white/8 bg-transparent text-white/20"
              }`}
            >
              {KIND_LABELS[kind] ?? kind}
            </button>
          ))}
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(activeRole === role ? null : role)}
              className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                activeRole === role
                  ? "border-white/20 bg-white/10 text-white/80"
                  : "border-white/8 bg-transparent text-white/20"
              }`}
            >
              {role}
            </button>
          ))}
          <span className="ml-auto font-mono text-[9px] text-white/25">
            {filtered.length}/{entries.length}
          </span>
        </div>
      </div>

      {/* Log rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/20">
            {entries.length === 0 ? "No events yet." : "No matching events."}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {[...filtered].reverse().map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
