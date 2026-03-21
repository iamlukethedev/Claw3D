"use client";

import { AudioLines, PhoneCall, Smartphone } from "lucide-react";
import type { MockPhoneCallScenario } from "@/lib/office/call/types";

export type PhoneCallStep = "dialing" | "ringing" | "speaking" | "reply" | "complete";

export function PhoneBoothImmersiveScreen({
  scenario, step, typedDigits,
}: {
  scenario: MockPhoneCallScenario;
  step: PhoneCallStep;
  typedDigits: string;
}) {
  const statusLabel =
    step === "dialing"   ? "Dialing" :
    step === "ringing"   ? "Waiting for answer" :
    step === "speaking"  ? "Connected" :
    step === "reply"     ? "On the line" :
                           "Call complete";

  const isLive = step === "speaking" || step === "reply";

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#0f1b3d_0%,#060916_42%,#020409_100%)] text-white">

      {/* header */}
      <div className="border-b border-emerald-400/12 bg-[#06101f]/82 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/18 bg-emerald-300/8">
            <PhoneCall className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/65">Phone Booth · via Twilio</div>
            <div className="text-lg font-semibold text-white">
              {isLive ? `Connected to ${scenario.callee}.` : `Calling ${scenario.callee}.`}
            </div>
          </div>
          <div className="ml-auto">
            <div className={`rounded-full border px-4 py-1.5 text-[12px] uppercase tracking-[0.2em] transition-all ${
              isLive
                ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                : "border-white/10 bg-white/5 text-white/55"
            }`}>
              {statusLabel}
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-0">

        {/* left — call details */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-8">

          {/* callee card */}
          <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">Recipient</div>
            <div className="text-4xl font-semibold tracking-[0.06em] text-white">{scenario.callee}</div>
            <div className="mt-2 font-mono text-lg text-white/50 tracking-[0.14em]">
              {typedDigits || scenario.dialNumber}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50">
                {scenario.voiceAvailable ? "ElevenLabs ready" : "Text-to-speech"}
              </div>
            </div>
          </div>

          {/* keypad display */}
          <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-4">Dial pad</div>
            <div className="grid grid-cols-3 gap-2.5">
              {["1","2","3","4","5","6","7","8","9","*","0","#"].map((digit) => (
                <div key={digit}
                  className={`flex h-12 items-center justify-center rounded-2xl border text-lg font-light transition-all ${
                    typedDigits.includes(digit)
                      ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100"
                      : "border-white/6 bg-white/4 text-white/55"
                  }`}>
                  {digit}
                </div>
              ))}
            </div>
          </div>

          {/* spoken message */}
          {scenario.spokenText && (
            <div className="rounded-3xl border border-emerald-300/14 bg-emerald-300/5 p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/55 mb-3">Voice message</div>
              <p className="text-[15px] leading-7 text-white/85">{scenario.spokenText}</p>
            </div>
          )}

          {/* recipient reply */}
          {(step === "reply" || step === "complete") && scenario.recipientReply && (
            <div className="rounded-3xl border border-white/6 bg-[#081122]/72 p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-3">{scenario.callee}</div>
              <p className="text-[15px] leading-7 text-white/80">{scenario.recipientReply}</p>
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
            <div className="flex h-full flex-col overflow-hidden rounded-[34px] border border-white/6 bg-[linear-gradient(180deg,#081b35_0%,#020617_100%)] px-5 py-7">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/40">
                <span>Cellular</span>
                <Smartphone className="h-3.5 w-3.5" />
              </div>

              <div className="mt-8 flex flex-col items-center">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full border ${
                  isLive
                    ? "border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_30px_rgba(52,211,153,0.2)]"
                    : "border-white/10 bg-white/5"
                }`}>
                  {isLive
                    ? <AudioLines className="h-11 w-11 text-emerald-300" />
                    : <PhoneCall className="h-11 w-11 text-white/50" />}
                </div>
                <div className="mt-5 text-center">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/35">{statusLabel}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{scenario.callee}</div>
                  <div className="mt-1 font-mono text-sm text-white/40 tracking-[0.12em]">{scenario.dialNumber}</div>
                </div>
              </div>

              <div className="mt-8 flex-1 space-y-3">
                <Bubble label="Agent" tone="primary"
                  text={
                    step === "dialing"  ? `Dialling ${typedDigits || scenario.dialNumber}…` :
                    step === "ringing"  ? `Ringing ${scenario.callee}…` :
                    scenario.spokenText ?? "Preparing the line."
                  } />
                {(step === "reply" || step === "complete") && (
                  <Bubble label={scenario.callee} tone="secondary"
                    text={scenario.recipientReply ?? "The line is quiet."} />
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-white/6 bg-black/30 px-4 py-3 text-[12px] text-white/55">
                {scenario.statusLine}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ label, text, tone }: { label: string; text: string; tone: "primary"|"secondary" }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${
      tone === "primary"
        ? "border-emerald-300/14 bg-emerald-300/6 text-white"
        : "border-white/6 bg-white/4 text-white/80"
    }`}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-1.5">{label}</div>
      <div className="text-sm leading-6">{text}</div>
    </div>
  );
}
