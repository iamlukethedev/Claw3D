# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Claw3D

Claw3D is a Next.js web app that renders a **3D retro isometric office** populated by OpenClaw AI agents. It connects to the **OpenClaw Gateway** (WebSocket at `ws://127.0.0.1:18789`) and visualises agent activity in real time — agents walk to desks, use the gym, play ping-pong, use the Phone/SMS Booth, attend standups, etc.

The app runs as a systemd service (`claw3d.service`) on the VPS at `127.0.0.1:3000`. Rebuild with `npm run build`, then `sudo systemctl restart claw3d.service`.

## Commands

```bash
npm run build        # Next.js production build (run before restarting service)
npm run dev          # Dev server (node server/index.js --dev)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest (unit)
npm run e2e          # playwright
```

Run a single vitest test: `npx vitest run tests/unit/myFile.test.ts`

## Architecture

### Two-server model

| Layer | Entry point | Role |
|---|---|---|
| Next.js app | `src/` | UI + API routes |
| Studio proxy | `server/index.js` | WebSocket proxy to OpenClaw gateway, auth, device management |

The browser talks to Next.js API routes (`/api/*`). Next.js server-side routes communicate with the OpenClaw gateway via `server/gateway-proxy.js`.

### 3D office engine (`src/features/retro-office/`)

`RetroOffice3D.tsx` is the root component (~1700 lines). It owns:
- A React Three Fiber `<Canvas>` scene
- Per-frame agent movement/animation loop (`useFrame`)
- All immersive screen overlays (Phone Booth, SMS Booth, ATM, GitHub, Standup…)
- The `BoothInputDialog` interceptor (opened before immersive screens)

Agent positions, walking targets, ping-pong sessions and other animation state are derived entirely from `buildOfficeAnimationState()` in `src/lib/office/eventTriggers.ts` — **do not manage animation state inside RetroOffice3D directly**.

### Office animation pipeline

```
OpenClaw gateway events
        │
        ▼
eventTriggers.ts  ──  reduceOfficeAnimationTriggerState()   (event latch)
        │
        ▼
        buildOfficeAnimationState()                          (reconciliation)
        │
        ▼
RetroOffice3D.tsx  (reads OfficeAnimationState, drives Three.js objects)
```

**`src/lib/office/deskDirectives.ts`** — single NLP entry point. Parses agent chat messages into `OfficeIntentSnapshot` (desk, github, gym, qa, standup, call, text, pingpong…). All regex patterns live here. Add new intents here, wire them in `eventTriggers.ts`.

**`src/lib/office/eventTriggers.ts`** — stateful reducer + reconciliation. Maintains `OfficeAnimationTriggerState` (latches) and builds `OfficeAnimationState` (the final snapshot consumed by the 3D scene). Also tracks per-agent holds (`pingPongHoldByAgentId`, `gymHoldByAgentId`, etc.).

### Office API routes (`src/app/api/office/`)

| Route | Purpose |
|---|---|
| `call/route.ts` | Phone Booth — calls Twilio `makeCall()` or falls back to mock |
| `text/route.ts` | SMS Booth — calls Twilio `sendSms()` or falls back to mock |
| `voice/transcribe/` | Whisper CLI transcription |
| `standup/` | Standup meeting orchestration |
| `github/` | GitHub integration |
| `presence/` | Agent presence |

### Phone/SMS Booth flow

1. User clicks booth in 3D scene → `RetroOffice3D` sets `boothInputKind` state
2. `BoothInputDialog` renders (numeric keypad, contacts, history)
3. On submit → POST to `/api/office/call` or `/api/office/text`
4. API calls **`src/lib/office/twilio.ts`** (`makeCall` / `sendSms`)
5. On success → immersive screen opens (`PhoneBoothImmersiveScreen` / `SmsBoothImmersiveScreen`)
6. History entry saved via `src/lib/office/boothContacts.ts` (localStorage)

### Twilio integration (`src/lib/office/twilio.ts`)

Uses Twilio REST API directly (no SDK). Requires env vars:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

Calls use inline TwiML with `<Say voice="alice" language="fr-FR">`. `normalizePhoneNumber()` handles FR (06→+33), US 10-digit, and E.164.

### Voice transcription (`src/lib/openclaw/voiceTranscription.ts`)

Calls the **whisper CLI** directly (OpenClaw 2026.3.13 removed the `runner-*.js` pattern). Configurable via:
- `WHISPER_BIN` (default `/home/sarcome/.local/bin/whisper`)
- `WHISPER_MODEL` (default `base`)

### Contacts & history (`src/lib/office/boothContacts.ts`)

localStorage-backed. Keys: `claw3d-booth-contacts`, `claw3d-booth-history` (limit 50). Types: `BoothContact`, `BoothHistoryEntry`.

### Agent → Owner notifications (`src/app/api/agent/notify/`)

Allows any OpenClaw agent to contact the owner directly via SMS or phone call, without knowing the owner's phone number.

**Route:** `POST /api/agent/notify`

```json
{ "kind": "sms" | "call", "message": "...", "agentId": "optional" }
```

- Owner's phone number is read from `OWNER_PHONE_NUMBER` env var (server-side only, never returned or logged in full)
- Delegates to `sendSms()` / `makeCall()` in `src/lib/office/twilio.ts`
- Rate limiting: 3 notifications/hour/agent, 10/hour global (in-memory, resets on restart)
- Optional allowlist: `NOTIFY_ALLOWED_AGENTS=id1,id2` (unset = all agents allowed)
- Message sanitised and capped at 300 chars

**Required env var (`.env.local` only — never commit):**
```
OWNER_PHONE_NUMBER=+33xxxxxxxxx
```

**Companion OpenClaw skill:** `~/.openclaw/workspace/skills/notify-owner/SKILL.md`

The skill is declared in the OpenClaw workspace so agents see it in their context and know to call this endpoint (via curl) when asked to notify the owner. The skill description tells agents:
- when to use it (urgent/important situations only)
- the exact curl command for SMS and call
- the rate limit and message constraints
- not to ask for a phone number (it's handled server-side)

The skill was created alongside this route and tested end-to-end: agents can send SMS and trigger calls on request from Discord or Claw3D chat, without the user providing any phone number.

**Adding this to a new deployment:**
1. Add `OWNER_PHONE_NUMBER` to `.env.local`
2. Ensure `TWILIO_*` vars are set
3. `npm run build && sudo systemctl restart claw3d.service`
4. The `notify-owner` skill must be present in the OpenClaw workspace skills directory

### Gateway client (`src/lib/gateway/GatewayClient.ts`)

WebSocket client that streams `EventFrame` objects from the OpenClaw gateway. Session keys encode `agentId`. `classifyGatewayEventKind()` in `runtimeEventBridge.ts` maps raw events to typed payloads.

## Environment variables

See `.env.example` for the base set. `.env.local` adds:

```
GITHUB_CURRENT_REPO=SarcomeLabs/mission-control
OPENCLAW_PACKAGE_ROOT=/home/sarcome/.npm-global/lib/node_modules/openclaw
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OWNER_PHONE_NUMBER=...          # owner's personal number — agents notify route only
WHISPER_BIN=/home/sarcome/.local/bin/whisper   # optional
WHISPER_MODEL=base              # optional
```

## Git remotes

| Remote | Repo | Role |
|---|---|---|
| `origin` | `iamlukethedev/Claw3D` | Upstream public fork |
| `sarcome` | `SarcomeLabs/claw3d` | Private deployment repo |

Push to the private repo: `git push sarcome main` (uses `gh` SSH auth as `SarcomeLabs`).
