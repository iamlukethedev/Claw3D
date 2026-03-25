import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type RemoteAgentChatMessage = {
  id: string;
  role: "user" | "system";
  text: string;
  timestampMs: number;
};

type RemoteAgentChatPanelProps = {
  agentName: string;
  canSend: boolean;
  sending: boolean;
  draft: string;
  error: string | null;
  messages: RemoteAgentChatMessage[];
  disabledReason?: string | null;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
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
  draft,
  error,
  messages,
  disabledReason,
  onDraftChange,
  onSend,
}: RemoteAgentChatPanelProps) {
  const [draftValue, setDraftValue] = useState(draft);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const sendDisabled = !canSend || sending || !draftValue.trim();
  const helperText = useMemo(() => {
    if (disabledReason?.trim()) return disabledReason.trim();
    if (sending) return "Forwarding your message to the remote gateway.";
    return "Text-only relay. Remote replies are not mirrored here yet.";
  }, [disabledReason, sending]);

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
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-white/35">Enter sends. Shift+Enter adds a line.</div>
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
  );
});
