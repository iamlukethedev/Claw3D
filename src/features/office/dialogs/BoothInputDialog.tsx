"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PhoneCall,
  MessageSquareText,
  Loader2,
  Delete,
  UserPlus,
  Clock,
  Users,
  X,
  Check,
  Phone,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react";
import type { MockPhoneCallScenario } from "@/lib/office/call/types";
import type { MockTextMessageScenario } from "@/lib/office/text/types";
import {
  loadContacts,
  loadHistory,
  addContact,
  addHistoryEntry,
  findContactByPhone,
  formatRelativeTime,
  type BoothContact,
  type BoothHistoryEntry,
} from "@/lib/office/boothContacts";

type Props =
  | { kind: "phone"; onSuccess: (scenario: MockPhoneCallScenario) => void; onClose: () => void }
  | { kind: "sms"; onSuccess: (scenario: MockTextMessageScenario) => void; onClose: () => void };

// 3×4 keypad — backspace replaces #
const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "⌫"],
];

function AddContactModal({
  initialPhone,
  onSave,
  onClose,
}: {
  initialPhone: string;
  onSave: (c: BoothContact) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[24px] bg-black/70 backdrop-blur-sm">
      <div className="w-72 rounded-2xl border border-white/10 bg-[#0b1a2e] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-slate-100">New Contact</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500/50 focus:bg-white/8"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 867-5309"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs uppercase tracking-widest text-slate-400 hover:border-white/20 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || !phone.trim()}
            onClick={() => {
              const c = addContact(name.trim(), phone.trim());
              onSave(c);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600/30 border border-sky-500/30 py-2.5 text-xs uppercase tracking-widest text-sky-200 hover:bg-sky-600/40 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function BoothInputDialog(props: Props) {
  const { kind, onClose } = props;
  const isPhone = kind === "phone";

  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [tab, setTab] = useState<"contacts" | "recent">("contacts");
  const [contacts, setContacts] = useState<BoothContact[]>([]);
  const [history, setHistory] = useState<BoothHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    setContacts(loadContacts());
    setHistory(loadHistory());
  }, []);

  const refreshContacts = useCallback(() => setContacts(loadContacts()), []);

  // Submit the number as typed — normalizePhoneNumber in twilio.ts handles formatting
  const fullNumber = digits.trim();

  const pressKey = (key: string) => {
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
    } else if (digits.length < 15) {
      setDigits((d) => d + key);
    }
  };

  const selectContact = (c: BoothContact) => {
    // Store the raw phone from contact, strip +33 prefix for display in prefix mode
    setDigits(c.phone);
  };

  const selectHistory = (h: BoothHistoryEntry) => {
    setDigits(h.phone);
    if (h.message) setMessage(h.message);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  const filteredHistory = history.filter(
    (h) =>
      (h.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      h.phone.includes(search),
  );

  const handleSubmit = async () => {
    if (!fullNumber) return;
    setLoading(true);
    setError(null);
    try {
      const url = isPhone ? "/api/office/call" : "/api/office/text";
      const body = isPhone
        ? { callee: fullNumber, message: message.trim() || null }
        : { recipient: fullNumber, message: message.trim() || null };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { scenario?: unknown; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const contactName = findContactByPhone(fullNumber)?.name ?? null;
      addHistoryEntry({
        kind: isPhone ? "call" : "sms",
        name: contactName,
        phone: fullNumber,
        message: message.trim() || null,
      });
      setHistory(loadHistory());
      setSuccess(true);

      setTimeout(() => {
        if (isPhone) {
          (props as Extract<Props, { kind: "phone" }>).onSuccess(data.scenario as MockPhoneCallScenario);
        } else {
          (props as Extract<Props, { kind: "sms" }>).onSuccess(data.scenario as MockTextMessageScenario);
        }
      }, 700);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-[6px]">
      <div className="relative flex overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#07101f] shadow-[0_40px_120px_rgba(0,0,0,0.95)]"
           style={{ width: 740, height: 540 }}>

        {/* ── LEFT PANEL ── */}
        <div className="flex w-56 flex-col bg-[#050d1a] border-r border-white/[0.06]">

          {/* Brand + privacy toggle */}
          <div className="flex items-center gap-2 px-4 pt-5 pb-4">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isPhone ? "bg-emerald-500/15" : "bg-sky-500/15"}`}>
              {isPhone
                ? <Phone className="h-3.5 w-3.5 text-emerald-400" />
                : <MessageSquare className="h-3.5 w-3.5 text-sky-400" />}
            </div>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              {isPhone ? "Phone" : "SMS"} Booth
            </span>
            <button
              title={privacyMode ? "Show numbers" : "Hide numbers"}
              onClick={() => setPrivacyMode((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
            >
              {privacyMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Tabs */}
          <div className="mx-3 mb-3 flex rounded-lg bg-white/[0.04] p-0.5">
            {(["contacts", "recent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                  tab === t
                    ? "bg-white/[0.08] text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "contacts" ? <Users className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {t === "contacts" ? "Contacts" : "Recent"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mx-3 mb-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/30 focus:bg-white/[0.06]"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-1">
            {tab === "contacts" ? (
              filteredContacts.length === 0 ? (
                <p className="mt-8 text-center text-[11px] text-slate-600">No contacts yet</p>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectContact(c)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-[11px] font-bold text-sky-400">
                      {c.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-slate-200">{c.name}</div>
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        {privacyMode ? "••• ••• ••••" : c.phone}
                      </div>
                    </div>
                  </button>
                ))
              )
            ) : (
              filteredHistory.length === 0 ? (
                <p className="mt-8 text-center text-[11px] text-slate-600">No recent activity</p>
              ) : (
                filteredHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => selectHistory(h)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${h.kind === "call" ? "bg-emerald-500/10" : "bg-violet-500/10"}`}>
                      {h.kind === "call"
                        ? <Phone className="h-3 w-3 text-emerald-500" />
                        : <MessageSquare className="h-3 w-3 text-violet-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-slate-200">
                        {h.name ?? (privacyMode ? "••• ••• ••••" : h.phone)}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-mono text-[10px] text-slate-600">
                          {privacyMode ? "••• ••• ••••" : (h.message ?? h.phone)}
                        </span>
                        <span className="shrink-0 pl-1 text-[10px] text-slate-700">{formatRelativeTime(h.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                ))
              )
            )}
          </div>

          {/* Add contact */}
          <div className="border-t border-white/[0.05] p-2.5">
            <button
              onClick={() => setShowAddContact(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] py-2 text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:border-white/[0.12] hover:text-slate-300"
            >
              <UserPlus className="h-3 w-3" />
              Add Contact
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex flex-1 flex-col px-6 py-5">

          {/* Header row: label + close button */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              {isPhone ? "Call" : "Send to"}
            </span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-500 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Number display */}
          <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <div className="font-mono text-xl font-light tracking-[0.14em] text-slate-100">
              {digits
                ? (privacyMode ? "••• ••• ••••" : digits)
                : <span className="text-[15px] font-sans tracking-normal text-slate-600">(555) 867-5309</span>}
            </div>
          </div>

          {/* Keypad */}
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {KEYPAD_ROWS.flat().map((key) => (
              <button
                key={key}
                onClick={() => pressKey(key)}
                className={`flex h-10 items-center justify-center rounded-xl border text-base font-light transition-all active:scale-95 ${
                  key === "⌫"
                    ? "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200"
                    : "border-white/[0.07] bg-white/[0.04] text-slate-200 hover:border-white/[0.14] hover:bg-white/[0.09]"
                }`}
              >
                {key === "⌫" ? <Delete className="h-4 w-4" /> : key}
              </button>
            ))}
          </div>

          {/* Message */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-slate-500">
              {isPhone ? "Voice message" : "Message"}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isPhone ? "Tell them I'll be late…" : "Hey, just checking in…"}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13px] text-slate-200 placeholder-slate-600 outline-none transition focus:border-sky-500/30 focus:bg-white/[0.05]"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-[12px] text-red-400">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            disabled={!digits.trim() || loading || success}
            onClick={handleSubmit}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-semibold uppercase tracking-[0.2em] transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
              success
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : isPhone
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/20"
                : "border-sky-500/25 bg-sky-500/10 text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/20"
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <Check className="h-4 w-4" />
            ) : isPhone ? (
              <PhoneCall className="h-4 w-4" />
            ) : (
              <MessageSquareText className="h-4 w-4" />
            )}
            {success ? "Done!" : isPhone ? "Call" : "Send SMS"}
          </button>
        </div>

        {/* Add contact overlay */}
        {showAddContact && (
          <AddContactModal
            initialPhone={digits}
            onSave={() => {
              refreshContacts();
              setShowAddContact(false);
            }}
            onClose={() => setShowAddContact(false)}
          />
        )}
      </div>
    </div>
  );
}
