import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { RuntimeAgentMessageMode } from "@/lib/runtime/agentMessaging";

export type RemoteAgentChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestampMs: number;
};

type RemoteAgentChatPanelProps = {
  agentName: string;
  canSend: boolean;
  sending: boolean;
  handoffing?: boolean;
  draft: string;
  mode: RuntimeAgentMessageMode;
  handoffContext?: string;
  handoffDeliverables?: string;
  handoffAcceptance?: string;
  error: string | null;
  messages: RemoteAgentChatMessage[];
  disabledReason?: string | null;
  onDraftChange: (value: string) => void;
  onModeChange: (value: RuntimeAgentMessageMode) => void;
  onHandoffContextChange: (value: string) => void;
  onHandoffDeliverablesChange: (value: string) => void;
  onHandoffAcceptanceChange: (value: string) => void;
  onSend: (message: string) => void;
  onHandoff: (message: string) => void;
};

const formatTimestamp = (timestampMs: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestampMs));

export const RemoteAgentChatPanel = memo(function RemoteAgentChatPanel({
  agentName,
  canSend,
  sending,
  handoffing = false,
  draft,
  mode,
  handoffContext = "",
  handoffDeliverables = "",
  handoffAcceptance = "",
  error,
  messages,
  disabledReason,
  onDraftChange,
  onModeChange,
  onHandoffContextChange,
  onHandoffDeliverablesChange,
  onHandoffAcceptanceChange,
  onSend,
  onHandoff,
}: RemoteAgentChatPanelProps) {
  const [draftValue, setDraftValue] = useState(draft);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const sendDisabled = !canSend || sending || handoffing || !draftValue.trim();
  const handoffDisabled = !canSend || sending || handoffing || !draftValue.trim();
  const helperText = useMemo(() => {
    if (disabledReason?.trim()) return disabledReason.trim();
    if (sending) return "Forwarding your message to the remote gateway.";
    if (mode === "interval") {
      return "Interval thread. Use this for ongoing coordination and checkpoints.";
    }
    return "Direct relay. Remote replies are not mirrored here yet.";
  }, [disabledReason, mode, sending]);

  useEffect(() => {
    setDraftValue(draft);
  }, [draft]);

  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSend = () => {
    const trimmed = draftValue.trim();
    if (!trimmed || sendDisabled) return;
    onSend(trimmed);
  };

  const handleHandoff = () => {
    const trimmed = draftValue.trim();
    if (!trimmed || handoffDisabled) return;
    onHandoff(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSend();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0e0a04]">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
          Remote Agent
        </div>
        <div className="mt-1 text-sm font-medium text-white">{agentName}</div>
        <div className="mt-2 font-mono text-[11px] text-white/45">{helperText}</div>
      </div>

      <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded border border-dashed border-white/10 bg-black/10 px-3 py-3 font-mono text-[11px] text-white/35">
            Send a plain-text note to this remote agent.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded px-3 py-2 ${
                message.role === "user"
                  ? "ml-auto bg-cyan-500/15 text-cyan-50"
                  : message.role === "assistant"
                    ? "bg-emerald-500/12 text-emerald-50"
                  : "bg-white/6 text-white/80"
              }`}
            >
              <div className="whitespace-pre-wrap break-words text-[13px] leading-5">
                {message.text}
              </div>
              <div className="mt-2 font-mono text-[10px] text-white/35">
                {formatTimestamp(message.timestampMs)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        {error ? (
          <div className="mb-3 rounded border border-red-500/35 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-100">
            {error}
          </div>
        ) : null}
        <div className="mb-3 flex items-center gap-2">
          {(["direct", "interval"] as const).map((entry) => {
            const selected = mode === entry;
            return (
              <button
                key={entry}
                type="button"
                onClick={() => onModeChange(entry)}
                className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                  selected
                    ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-100"
                    : "border-white/10 bg-black/10 text-white/55 hover:border-cyan-400/25 hover:text-cyan-50"
                }`}
              >
                {entry}
              </button>
            );
          })}
        </div>
        <textarea
          value={draftValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftValue(nextValue);
            onDraftChange(nextValue);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message the remote agent."
          className="min-h-[92px] w-full resize-none rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50"
        />
        <div className="mt-3 grid gap-2">
          <textarea
            value={handoffContext}
            onChange={(event) => onHandoffContextChange(event.target.value)}
            placeholder="Handoff context"
            className="min-h-[68px] w-full resize-none rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400/40"
          />
          <input
            value={handoffDeliverables}
            onChange={(event) => onHandoffDeliverablesChange(event.target.value)}
            placeholder="Deliverables, comma-separated"
            className="h-10 w-full rounded border border-white/10 bg-black/20 px-3 text-xs text-white outline-none transition focus:border-amber-400/40"
          />
          <input
            value={handoffAcceptance}
            onChange={(event) => onHandoffAcceptanceChange(event.target.value)}
            placeholder="Acceptance criteria"
            className="h-10 w-full rounded border border-white/10 bg-black/20 px-3 text-xs text-white outline-none transition focus:border-amber-400/40"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-white/35">Enter sends. Shift+Enter adds a line.</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHandoff}
              disabled={handoffDisabled}
              className="rounded border border-amber-400/30 bg-amber-500/8 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/55 hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {handoffing ? "Handing off..." : "Handoff"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendDisabled}
              className="rounded border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
