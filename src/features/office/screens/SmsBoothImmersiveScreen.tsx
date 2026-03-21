"use client";

import { CheckCheck, MessageSquareText, Send, Smartphone } from "lucide-react";
import type { MockTextMessageScenario } from "@/lib/office/text/types";

const PROVIDER_LABEL: Record<string, string> = {
  twilio: "Twilio SMS", whatsapp: "WhatsApp", telegram: "Telegram", imessage: "iMessage",
};
const ACTIVE_PROVIDER_LABEL =
  PROVIDER_LABEL[process.env.NEXT_PUBLIC_MESSAGING_PROVIDER ?? "twilio"] ?? "Twilio SMS";

export type TextMessageStep =
  | "selecting_contact" | "composing" | "sending"
  | "delivered" | "reply" | "complete";

export function SmsBoothImmersiveScreen({
  scenario, step, typedMessage, activeKey, contacts, activeContactIndex,
}: {
  scenario: MockTextMessageScenario;
  step: TextMessageStep;
  typedMessage: string;
  activeKey: string | null;
  contacts: string[];
  activeContactIndex: number | null;
}) {
  const statusLabel =
    step === "selecting_contact" ? "Selecting contact" :
    step === "composing"         ? "Composing" :
    step === "sending"           ? "Sending" :
    step === "delivered"         ? "Delivered" :
    step === "reply"             ? "Reply received" :
                                   "Message complete";

  const messageBody = typedMessage || scenario.messageText || "";
  const isSent = step === "delivered" || step === "reply" || step === "complete";

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#0f1b3d_0%,#060916_42%,#020409_100%)] text-white">

      {/* header */}
      <div className="border-b border-violet-400/12 bg-[#06101f]/82 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/18 bg-violet-300/8">
            <MessageSquareText className="h-5 w-5 text-violet-200" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-violet-200/65">SMS Booth · {ACTIVE_PROVIDER_LABEL}</div>
            <div className="text-lg font-semibold text-white">
              {isSent ? `Message sent to ${scenario.recipient}.` : `Messaging ${scenario.recipient}.`}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`rounded-full border px-4 py-1.5 text-[12px] uppercase tracking-[0.2em] transition-all ${
              isSent
                ? "border-violet-300/30 bg-violet-300/12 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.15)]"
                : step === "sending"
                  ? "border-amber-300/20 bg-amber-300/8 text-amber-100/80"
                  : "border-white/10 bg-white/5 text-white/55"
            }`}>
              {statusLabel}
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-0">

        {/* left — compose details */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-8">

          {/* recipient card */}
          <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Recipient</div>
            <div className="text-4xl font-semibold tracking-[0.06em] text-white">{scenario.recipient}</div>
            <div className="mt-4 flex items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                isSent ? "border-violet-300/20 bg-violet-300/8 text-violet-100/80" : "border-white/10 bg-white/5 text-white/45"
              }`}>
                {isSent ? <CheckCheck className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                {isSent ? "Delivered" : "Drafting"}
              </div>
            </div>
          </div>

          {/* message body */}
          <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Message</div>
            <div className="min-h-[80px] rounded-2xl border border-white/6 bg-black/20 px-5 py-4 text-[15px] leading-7 text-white/80">
              {messageBody || <span className="text-white/25">Waiting for the first characters.</span>}
              {step === "composing" && <span className="ml-1 inline-block animate-pulse text-white/60">|</span>}
            </div>
          </div>

          {/* reply */}
          {(step === "reply" || step === "complete") && scenario.confirmationText && (
            <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">{scenario.recipient}</div>
              <p className="text-[15px] leading-7 text-white/80">{scenario.confirmationText}</p>
            </div>
          )}

          {/* contact list (selecting phase) */}
          {step === "selecting_contact" && contacts.length > 0 && (
            <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Contacts</div>
              <div className="space-y-2">
                {contacts.slice(0, 5).map((contact, idx) => {
                  const active = idx === (activeContactIndex ?? 0);
                  return (
                    <div key={`${contact}-${idx}`}
                      className={`rounded-2xl border px-4 py-3 transition-all ${
                        active
                          ? "border-violet-300/24 bg-violet-300/10 text-white"
                          : "border-white/6 bg-white/4 text-white/65"
                      }`}>
                      <div className="text-sm font-medium">{contact}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/35">
                        {active ? "Opening conversation" : "Recent thread"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* status line */}
          <div className="rounded-2xl border border-white/6 bg-white/4 px-5 py-3 text-sm text-white/55">
            {scenario.statusLine}
          </div>
        </div>

        {/* right — phone mockup */}
        <div className="flex items-center justify-center border-l border-white/6 bg-[#081122]/50 p-8">
          <div className="relative h-[68vh] max-h-[660px] w-[320px] rounded-[44px] border border-white/12 bg-[#020617] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.8)]">
            <div className="absolute left-1/2 top-3 h-1.5 w-24 -translate-x-1/2 rounded-full bg-white/10" />
            <div className="flex h-full flex-col overflow-hidden rounded-[34px] border border-white/6 bg-[linear-gradient(180deg,#0d1225_0%,#020617_100%)] px-5 py-7">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/40">
                <span>Messages</span>
                <Smartphone className="h-3.5 w-3.5" />
              </div>

              <div className="mt-5 text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-white/35">{statusLabel}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{scenario.recipient}</div>
              </div>

              <div className="mt-6 flex-1 space-y-3">
                {step === "selecting_contact" ? (
                  <ContactList contacts={contacts} activeContactIndex={activeContactIndex} />
                ) : (
                  <>
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl border border-violet-300/14 bg-violet-300/8 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">Agent</div>
                        <div className="text-sm leading-6 text-white/85">
                          {messageBody || "Starting draft."}
                        </div>
                      </div>
                    </div>
                    {isSent && (
                      <div className="flex justify-end">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-violet-300/50">
                          <CheckCheck className="h-3 w-3" /> Delivered
                        </div>
                      </div>
                    )}
                    {(step === "reply" || step === "complete") && scenario.confirmationText && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl border border-white/6 bg-white/5 px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">{scenario.recipient}</div>
                          <div className="text-sm leading-6 text-white/75">{scenario.confirmationText}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* keyboard */}
              <div className="mt-3 rounded-2xl border border-white/6 bg-black/25 p-2.5">
                <PhoneKeyboard activeKey={activeKey} />
              </div>

              <div className="mt-2 rounded-2xl border border-white/6 bg-black/30 px-4 py-2.5 text-[11px] text-white/45">
                {scenario.statusLine}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactList({ contacts, activeContactIndex }: { contacts: string[]; activeContactIndex: number | null }) {
  const selectedIndex = activeContactIndex ?? 0;
  const windowStart = Math.max(0, Math.min(selectedIndex - 2, Math.max(contacts.length - 5, 0)));
  const visible = contacts.slice(windowStart, windowStart + 5);

  return (
    <div className="space-y-2">
      {visible.map((contact, index) => {
        const absoluteIndex = windowStart + index;
        const active = absoluteIndex === selectedIndex;
        return (
          <div key={`${contact}-${absoluteIndex}`}
            className={`rounded-2xl border px-4 py-3 transition-all duration-150 ${
              active
                ? "border-violet-300/28 bg-violet-300/12 text-white shadow-[0_0_16px_rgba(167,139,250,0.15)]"
                : "border-white/6 bg-white/4 text-white/60"
            }`}>
            <div className="text-sm font-medium">{contact}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
              {active ? "Opening conversation" : "Recent thread"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const KEYBOARD_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m",",",".","?"],
] as const;

function PhoneKeyboard({ activeKey }: { activeKey: string | null }) {
  return (
    <div className="space-y-1.5">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={row.join("")} className={`flex gap-1 ${rowIndex === 1 ? "px-3" : rowIndex === 2 ? "px-5" : ""}`}>
          {row.map((keyValue) => (
            <KeyboardKey key={keyValue} label={keyValue} active={activeKey === keyValue} />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1">
        <KeyboardKey label="123" active={false} className="w-[18%]" />
        <KeyboardKey label="space" active={activeKey === "space"} className="flex-1" />
        <KeyboardKey label="return" active={activeKey === "return"} className="w-[22%]" />
      </div>
    </div>
  );
}

function KeyboardKey({ label, active, className = "" }: { label: string; active: boolean; className?: string }) {
  return (
    <div className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-xl border text-[11px] font-medium uppercase tracking-[0.1em] transition-all duration-100 ${
      active
        ? "border-violet-300/35 bg-violet-300/18 text-white shadow-[0_0_12px_rgba(167,139,250,0.2)]"
        : "border-white/8 bg-white/5 text-white/55"
    } ${className}`}>
      {label}
    </div>
  );
}
