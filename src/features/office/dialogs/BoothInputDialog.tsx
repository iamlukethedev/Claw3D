"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PhoneCall, MessageSquareText, Loader2, Delete, UserPlus,
  Clock, Users, X, Check, Phone, MessageSquare, Eye, EyeOff, ChevronLeft,
} from "lucide-react";
import type { MockPhoneCallScenario } from "@/lib/office/call/types";
import type { MockTextMessageScenario } from "@/lib/office/text/types";
import {
  loadContacts, loadHistory, addContact, addHistoryEntry,
  findContactByPhone, formatRelativeTime,
  type BoothContact, type BoothHistoryEntry,
} from "@/lib/office/boothContacts";

type Props =
  | { kind: "phone"; onSuccess: (scenario: MockPhoneCallScenario) => void; onClose: () => void }
  | { kind: "sms";   onSuccess: (scenario: MockTextMessageScenario) => void; onClose: () => void };

const KEYPAD_ROWS = [["1","2","3"],["4","5","6"],["7","8","9"],["*","0","⌫"]];

// ── Design tokens per booth kind ──────────────────────────────────────────────
const tokens = {
  phone: {
    accent: "emerald",
    iconBg:      "bg-emerald-300/8 border-emerald-300/18",
    iconColor:   "text-emerald-200",
    tabActive:   "border-emerald-300/22 bg-emerald-300/12 text-white",
    headerBorder:"border-emerald-400/12",
    selected:    "border-emerald-300/24 bg-emerald-300/10",
    ctaBorder:   "border-emerald-400/40 bg-emerald-400/16 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.12)] hover:border-emerald-300/55 hover:bg-emerald-400/24",
    ctaSuccess:  "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
    badge:       "border-emerald-300/18 bg-emerald-300/8 text-emerald-100/85",
    label:       "text-emerald-200/65",
    numberBorder:"border-emerald-300/14",
  },
  sms: {
    accent: "violet",
    iconBg:      "bg-violet-300/8 border-violet-300/18",
    iconColor:   "text-violet-200",
    tabActive:   "border-violet-300/22 bg-violet-300/12 text-white",
    headerBorder:"border-violet-400/12",
    selected:    "border-violet-300/24 bg-violet-300/10",
    ctaBorder:   "border-violet-400/40 bg-violet-400/16 text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.12)] hover:border-violet-300/55 hover:bg-violet-400/24",
    ctaSuccess:  "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
    badge:       "border-violet-300/18 bg-violet-300/8 text-violet-100/85",
    label:       "text-violet-200/65",
    numberBorder:"border-violet-300/14",
  },
} as const;

// ── Add Contact overlay ───────────────────────────────────────────────────────
function AddContactModal({ initialPhone, onSave, onClose }: {
  initialPhone: string; onSave: (c: BoothContact) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-80 rounded-3xl border border-white/10 bg-[#081122] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">New Contact</span>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 hover:bg-white/8 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 focus:bg-white/8" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 867-5309"
            className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 focus:bg-white/8" />
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/4 py-3 text-xs uppercase tracking-widest text-white/55 hover:border-white/20 hover:text-white/80">
            Cancel
          </button>
          <button disabled={!name.trim() || !phone.trim()}
            onClick={() => { const c = addContact(name.trim(), phone.trim()); onSave(c); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/8 py-3 text-xs uppercase tracking-widest text-white hover:bg-white/12 disabled:opacity-35">
            <Check className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function BoothInputDialog(props: Props) {
  const { kind, onClose } = props;
  const isPhone = kind === "phone";
  const tk = tokens[kind];

  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<"contacts"|"recent">("contacts");
  const [contacts, setContacts] = useState<BoothContact[]>([]);
  const [history, setHistory] = useState<BoothHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => { setContacts(loadContacts()); setHistory(loadHistory()); }, []);
  const refreshContacts = useCallback(() => setContacts(loadContacts()), []);
  const fullNumber = digits.trim();

  const pressKey = (key: string) => {
    if (key === "⌫") setDigits((d) => d.slice(0, -1));
    else if (digits.length < 20) setDigits((d) => d + key);
  };

  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));
  const filteredHistory = history.filter(
    (h) => (h.name ?? "").toLowerCase().includes(search.toLowerCase()) || h.phone.includes(search));

  const handleSubmit = async () => {
    if (!fullNumber) return;
    setLoading(true); setError(null);
    try {
      const url = isPhone ? "/api/office/call" : "/api/office/text";
      const body = isPhone
        ? { callee: fullNumber, message: message.trim() || null }
        : { recipient: fullNumber, message: message.trim() || null };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { scenario?: unknown; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Something went wrong."); return; }
      addHistoryEntry({ kind: isPhone ? "call" : "sms", name: findContactByPhone(fullNumber)?.name ?? null, phone: fullNumber, message: message.trim() || null });
      setHistory(loadHistory()); setSuccess(true);
      setTimeout(() => {
        if (isPhone) (props as Extract<Props, { kind: "phone" }>).onSuccess(data.scenario as MockPhoneCallScenario);
        else (props as Extract<Props, { kind: "sms" }>).onSuccess(data.scenario as MockTextMessageScenario);
      }, 700);
    } catch { setError("Could not reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#0f1b3d_0%,#060916_42%,#020409_100%)] text-white">

      {/* ── TOP BAR ── */}
      <div className={`flex h-14 shrink-0 items-center gap-4 border-b ${tk.headerBorder} bg-[#06101f]/82 px-6 backdrop-blur-sm`}>
        <button onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/8 hover:text-white">
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl border ${tk.iconBg}`}>
          {isPhone
            ? <Phone className={`h-4 w-4 ${tk.iconColor}`} />
            : <MessageSquare className={`h-4 w-4 ${tk.iconColor}`} />}
        </div>

        <div>
          <div className={`text-[11px] uppercase tracking-[0.28em] ${tk.label}`}>
            {isPhone ? "Phone Booth" : "SMS Booth"}
          </div>
          <div className="text-[15px] font-semibold text-white">
            {isPhone ? "Place a call." : "Send a message."}
          </div>
        </div>

        <div className="flex-1" />

        <button title={privacyMode ? "Show numbers" : "Hide numbers"}
          onClick={() => setPrivacyMode((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/30 transition-colors hover:bg-white/8 hover:text-white/70">
          {privacyMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>

        <button onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/55 transition-colors hover:border-white/20 hover:text-white">
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px]">

        {/* ── COL 1 : CONTACTS ── */}
        <div className="flex min-h-0 flex-col border-r border-white/6 bg-[#081122]/72">

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 p-3">
            {(["contacts","recent"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  tab === t ? tk.tabActive + " border" : "border border-white/6 bg-white/4 text-white/55 hover:text-white"
                }`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-white/45">
                  {t === "contacts" ? <Users className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {t === "contacts" ? "Contacts" : "Recent"}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {t === "contacts" ? contacts.length : history.length}
                </div>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-2 text-[12px] text-white/85 placeholder-white/25 outline-none focus:border-white/16 focus:bg-white/6" />
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {tab === "contacts" ? (
              filteredContacts.length === 0
                ? <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4 text-sm text-white/40">No contacts yet.</div>
                : <div className="space-y-2">
                    {filteredContacts.map((c) => (
                      <button key={c.id} onClick={() => setDigits(c.phone)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                          digits === c.phone ? tk.selected + " border" : "border-white/6 bg-white/4 hover:border-white/12 hover:bg-white/6"
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tk.iconBg} text-[12px] font-bold ${tk.iconColor}`}>
                            {c.name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-white">{c.name}</div>
                            <div className="truncate font-mono text-[11px] text-white/45">
                              {privacyMode ? "••• ••• ••••" : c.phone}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
            ) : (
              filteredHistory.length === 0
                ? <div className="rounded-2xl border border-white/6 bg-white/4 px-4 py-4 text-sm text-white/40">No recent activity.</div>
                : <div className="space-y-2">
                    {filteredHistory.map((h) => (
                      <button key={h.id} onClick={() => { setDigits(h.phone); if (h.message) setMessage(h.message); }}
                        className="w-full rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-left transition-colors hover:border-white/12 hover:bg-white/6">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                            h.kind === "call" ? "border-emerald-300/18 bg-emerald-300/8" : "border-violet-300/18 bg-violet-300/8"
                          }`}>
                            {h.kind === "call"
                              ? <Phone className="h-3 w-3 text-emerald-300" />
                              : <MessageSquare className="h-3 w-3 text-violet-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-white">
                              {h.name ?? (privacyMode ? "••• ••• ••••" : h.phone)}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[10px] text-white/35">
                                {privacyMode ? "•••" : (h.message ?? h.phone)}
                              </span>
                              <span className="shrink-0 text-[10px] text-white/25">{formatRelativeTime(h.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
            )}
          </div>

          {/* Add contact */}
          <div className="border-t border-white/6 p-3">
            <button onClick={() => setShowAddContact(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/4 py-2.5 text-[11px] uppercase tracking-widest text-white/45 transition-colors hover:border-white/16 hover:text-white/70">
              <UserPlus className="h-3.5 w-3.5" /> Add Contact
            </button>
          </div>
        </div>

        {/* ── COL 2 : COMPOSE ── */}
        <div className="flex flex-col px-10 py-8">

          {/* Number display */}
          <div className="mb-6">
            <div className={`text-[11px] uppercase tracking-[0.28em] ${tk.label} mb-2`}>
              {isPhone ? "Call" : "Send to"}
            </div>
            <div className={`rounded-2xl border ${tk.numberBorder} bg-[#081122]/72 px-6 py-5`}>
              <div className="font-mono text-3xl font-light tracking-[0.18em] text-white">
                {digits
                  ? (privacyMode ? "••• ••• ••••" : digits)
                  : <span className="text-2xl font-sans tracking-normal text-white/22">(555) 867-5309</span>}
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="flex flex-1 flex-col">
            <div className={`text-[11px] uppercase tracking-[0.28em] ${tk.label} mb-2`}>
              {isPhone ? "Voice message" : "Message"}
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={isPhone ? "Tell them I'll be late…" : "Hey, just checking in…"}
              className="flex-1 w-full resize-none rounded-2xl border border-white/8 bg-[#081122]/72 px-6 py-5 text-[15px] leading-7 text-white/85 placeholder-white/22 outline-none transition focus:border-white/16 focus:bg-[#081122]/90" />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-2xl border border-rose-400/16 bg-rose-400/8 px-5 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {/* CTA */}
          <button disabled={!digits.trim() || loading || success} onClick={handleSubmit}
            className={`mt-5 flex h-14 items-center justify-center gap-3 rounded-2xl border text-[13px] font-semibold uppercase tracking-[0.22em] transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
              success ? tk.ctaSuccess + " border" : tk.ctaBorder + " border"
            }`}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" />
              : success ? <Check className="h-5 w-5" />
              : isPhone ? <PhoneCall className="h-5 w-5" />
              : <MessageSquareText className="h-5 w-5" />}
            {success ? "Done!" : isPhone ? "Call" : "Send SMS"}
          </button>
        </div>

        {/* ── COL 3 : KEYPAD ── */}
        <div className="flex flex-col items-center justify-center border-l border-white/6 bg-[#081122]/72 px-10 py-10">
          <div className={`mb-6 text-[11px] uppercase tracking-[0.28em] ${tk.label}`}>Keypad</div>
          <div className="grid w-full grid-cols-3 gap-3">
            {KEYPAD_ROWS.flat().map((key) => (
              <button key={key} onClick={() => pressKey(key)}
                className={`flex h-[72px] items-center justify-center rounded-2xl border text-xl font-light transition-all active:scale-95 ${
                  key === "⌫"
                    ? "border-white/6 bg-white/3 text-white/40 hover:border-white/12 hover:bg-white/6 hover:text-white/70"
                    : "border-white/8 bg-white/5 text-white/80 hover:border-white/18 hover:bg-white/10 hover:text-white"
                }`}>
                {key === "⌫" ? <Delete className="h-5 w-5" /> : key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showAddContact && (
        <AddContactModal initialPhone={digits}
          onSave={() => { refreshContacts(); setShowAddContact(false); }}
          onClose={() => setShowAddContact(false)} />
      )}
    </div>
  );
}
