# Phone Booth & SMS Booth — Messaging Integration

This document covers everything added by the Phone & SMS Booth feature:
architecture, setup, provider configuration, file reference, and the
companion OpenClaw skill.

---

## Overview

Claw3D's **Phone Booth** and **SMS Booth** went from read-only mock animations
to fully functional communication tools. Agents and users can now place real
outbound calls and send real SMS messages directly from the 3D office.

The feature is built around a **provider abstraction layer** so any user can
connect their preferred messaging backend — Twilio today, with WhatsApp and
Telegram support designed and documented for contributors.

---

## What changed at a glance

| Area | Before | After |
|---|---|---|
| Phone Booth | Mock animation only | Real outbound calls via messaging provider |
| SMS Booth | Mock animation only | Real SMS via messaging provider |
| Booth UI | Small modal | Full-screen 3-column layout |
| Provider support | Hardcoded Twilio | Pluggable (Twilio ✅ / WhatsApp 🔜 / Telegram 🔜) |
| Contacts | None | localStorage contacts + call/SMS history |
| Agent skill | None | `notify-owner` skill for autonomous notifications |

---

## Quick setup

### 1 — Pick a provider and set env vars

**Twilio** (default, fully implemented):

```bash
# .env.local
MESSAGING_PROVIDER=twilio          # optional — twilio is the default

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15005550006   # your Twilio number
```

Get your credentials at [console.twilio.com](https://console.twilio.com).
A free trial account works — note that trial accounts prepend a notice to
outbound calls before your message plays.

### 2 — (Optional) Owner notification route

If you want agents to be able to notify you directly without knowing your
personal number, add:

```bash
OWNER_PHONE_NUMBER=+1555...        # your number — never sent to agents
```

See [Agent → Owner notifications](#agent--owner-notifications) below.

### 3 — Rebuild and restart

```bash
npm run build
sudo systemctl restart claw3d.service   # or however you run Claw3D
```

### 4 — (Optional) Install the OpenClaw skill

```bash
cp -r skills/notify-owner ~/.openclaw/workspace/skills/
```

Then rebuild the skill bundle — see [`skills/README.md`](../skills/README.md).

---

## How the booth flow works

```
User clicks booth in 3D scene
        │
        ▼
BoothInputDialog opens (full-screen)
  ├── Left column  : contacts list / call history (localStorage)
  ├── Center column: number display + message composer
  └── Right column : numeric keypad
        │
        ▼ (submit)
POST /api/office/call  or  POST /api/office/text
        │
        ▼
messagingProviders.ts  →  dispatchMakeCall / dispatchSendSms
        │
        ├── provider = "twilio"  →  twilio.ts  →  Twilio REST API  →  real call/SMS
        └── provider = other     →  stub (not yet implemented)
        │
        ▼ (success)
Immersive screen opens
  Phone Booth → PhoneBoothImmersiveScreen (emerald accent)
  SMS Booth   → SmsBoothImmersiveScreen   (violet accent)
        │
        ▼ (phone call only)
playBoothVoice()  →  POST /api/office/voice/reply
        └── ElevenLabs TTS plays the spoken message in the browser
```

---

## Provider abstraction

### Active provider selection

The active provider is read from the `MESSAGING_PROVIDER` environment variable.
Individual API requests may pass a `provider` field to override it.

```
MESSAGING_PROVIDER=twilio     → Twilio REST API (default)
MESSAGING_PROVIDER=whatsapp   → WhatsApp (not yet implemented)
MESSAGING_PROVIDER=telegram   → Telegram (not yet implemented)
```

### Provider support matrix

| Provider | SMS | Call | Status | Notes |
|---|---|---|---|---|
| `twilio` | ✅ | ✅ | Implemented | Twilio REST API |
| `whatsapp` | 🔜 | 🔜 | Planned | Via Twilio WhatsApp or Meta Cloud API |
| `telegram` | 🔜 | — | Planned | Telegram Bot API |
| `imessage` | — | — | Not planned | No public API for outbound messages |

### Adding a new provider

1. Add its key to `MessagingProvider` in `src/lib/office/messagingProviders.ts`
2. Create `src/lib/office/providers/<name>.ts` with `sendSms()` / `makeCall()`
3. Wire it into `dispatchSendSms` / `dispatchMakeCall`
4. Document required env vars in `.env.example`

The stubs for WhatsApp and Telegram in `messagingProviders.ts` include the
relevant API links and env var shapes as a starting point.

---

## Phone number normalisation

`normalizePhoneNumber()` in `src/lib/office/twilio.ts` handles:

| Input | Output |
|---|---|
| `0612345678` | `+33612345678` (French 06/07) |
| `6121234567` | `+16121234567` (US 10-digit) |
| `16121234567` | `+16121234567` (US 11-digit) |
| `+33612345678` | `+33612345678` (E.164 passthrough) |

---

## File reference

### New files

| File | Description |
|---|---|
| `src/lib/office/twilio.ts` | Twilio REST client. `sendSms()`, `makeCall()`, `normalizePhoneNumber()`. Reads all credentials from env vars. |
| `src/lib/office/messagingProviders.ts` | Provider abstraction. `dispatchSendSms()`, `dispatchMakeCall()`, provider status helpers. |
| `src/lib/office/boothContacts.ts` | localStorage contacts (`claw3d-booth-contacts`) and history (`claw3d-booth-history`, capped at 50). |
| `src/features/office/dialogs/BoothInputDialog.tsx` | Full-screen booth input UI shared by Phone and SMS booths. |
| `skills/notify-owner/SKILL.md` | OpenClaw skill — teaches agents to send owner notifications. |
| `skills/README.md` | Skill installation guide. |

### Modified files

| File | What changed |
|---|---|
| `src/features/office/screens/PhoneBoothImmersiveScreen.tsx` | Full redesign. Two-column layout (call details + phone mockup). Emerald accent. Glow ring when connected. |
| `src/features/office/screens/SmsBoothImmersiveScreen.tsx` | Full redesign. Same layout. Violet accent. On-screen keyboard with active key highlight. |
| `src/app/api/office/call/route.ts` | Now routes through `dispatchMakeCall()`. Accepts optional `provider` field. Mock fallback unchanged. |
| `src/app/api/office/text/route.ts` | Now routes through `dispatchSendSms()`. Same pattern. |
| `src/features/retro-office/RetroOffice3D.tsx` | Wires `BoothInputDialog` to booth clicks. Opens immersive screens on success. Adds ping-pong directive. |
| `src/lib/office/deskDirectives.ts` | Ping-pong intent: agents sent to the table on "play ping-pong" messages. |
| `src/lib/office/eventTriggers.ts` | `pingPongHoldByAgentId` tracking. |
| `.env.example` | Documents `MESSAGING_PROVIDER`, `TWILIO_*`, and placeholder blocks for WhatsApp and Telegram. |

---

## BoothInputDialog

The new full-screen input replaces the previous small modal. It is shared
between both booths and adapts its accent colour per kind.

**Three-column layout:**

```
┌──────────────────┬──────────────────────┬──────────────────┐
│  Contacts list   │  Number display      │  Numeric keypad  │
│  ─────────────   │  ─────────────────   │  ─────────────── │
│  Recent history  │  Message composer    │  1  2  3         │
│                  │                      │  4  5  6         │
│  Search bar      │  [Call / Send SMS]   │  7  8  9         │
│                  │                      │  *  0  ⌫         │
│  + Add contact   │                      │                  │
└──────────────────┴──────────────────────┴──────────────────┘
```

**Features:**
- Privacy mode: masks phone numbers with `••• ••• ••••`
- Add contact: saves name + phone to localStorage
- History: last 50 calls/SMS with relative timestamps
- Contacts are shared across both booths

---

## Agent → Owner notifications

`POST /api/agent/notify` lets any OpenClaw agent contact the office owner
without knowing their phone number. The number is read from
`OWNER_PHONE_NUMBER` (server-side only, never returned or logged).

```json
{ "kind": "sms" | "call", "message": "...", "agentId": "optional" }
```

**Rate limiting:** 3 notifications/hour per agent, 10/hour globally (in-memory).
**Message cap:** 300 characters.
**Allowlist:** set `NOTIFY_ALLOWED_AGENTS=id1,id2` to restrict access (unset = all agents).

The companion OpenClaw skill (`skills/notify-owner/SKILL.md`) teaches agents
the exact curl commands so they can use this endpoint autonomously.

---

## ElevenLabs voice (optional)

When `ELEVENLABS_API_KEY` is set, the Phone Booth plays the spoken message
through the browser using ElevenLabs TTS as the call animation plays.

```bash
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...        # optional — defaults to Rachel (21m00Tcm4TlvDq8ikWAM)
ELEVENLABS_MODEL_ID=eleven_flash_v2_5   # optional
```

The voice is played via `POST /api/office/voice/reply` (existing route).
If the key is not set, the booth animation plays silently.

---

## Full environment variable reference

```bash
# ── Required for live messaging ───────────────────────────────────────────────
MESSAGING_PROVIDER=twilio          # twilio (default) | whatsapp | telegram

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15005550006

# ── Optional ──────────────────────────────────────────────────────────────────
OWNER_PHONE_NUMBER=+1555...        # for /api/agent/notify — never exposed

# ElevenLabs TTS (phone booth browser audio)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_flash_v2_5

# WhatsApp (planned)
# TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
# META_WHATSAPP_TOKEN=
# META_WHATSAPP_PHONE_NUMBER_ID=

# Telegram (planned)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
```

All sensitive values go in `.env.local` (gitignored). Never commit real credentials.
