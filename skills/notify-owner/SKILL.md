---
name: notify-owner
description: Notify the office owner via SMS or phone call using the Claw3D notification system. Use when something requires the owner's immediate attention and cannot wait for them to check their computer — such as a critical error, a completed task they asked to be informed about, or a blocker that requires their input.
---

# Notify Owner

Send an SMS or trigger a phone call to the office owner directly from Claw3D.

The messaging backend (Twilio, WhatsApp, Telegram, iMessage, …) is configured
server-side — you do not need to know which provider is active. The API is the
same regardless.

## When to use

- A task the owner explicitly asked to be notified about is complete
- A critical blocker requires their input and cannot be resolved autonomously
- An error or situation is time-sensitive and cannot wait

**Do not use for routine updates, progress reports, or anything the owner can read at their own pace.**

## How to send an SMS

```bash
curl -s -X POST http://127.0.0.1:3000/api/agent/notify \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"sms\", \"message\": \"Your message here.\", \"agentId\": \"$AGENT_ID\"}"
```

## How to trigger a phone call

```bash
curl -s -X POST http://127.0.0.1:3000/api/agent/notify \
  -H "Content-Type: application/json" \
  -d "{\"kind\": \"call\", \"message\": \"Your message here.\", \"agentId\": \"$AGENT_ID\"}"
```

The call will read the message aloud to the owner. Keep the message under 200 characters for calls.

## Response

Success:
```json
{ "ok": true, "kind": "sms" }
```

Rate limit reached:
```json
{ "error": "Rate limit reached. Try again in X minute(s)." }
```

Provider not configured:
```json
{ "error": "No messaging provider configured." }
```

## Constraints

- **Message limit**: 300 characters maximum
- **Rate limit**: 3 notifications per hour per agent, 10 per hour globally
- **Phone calls**: only available when the server uses Twilio — prefer SMS/message unless truly urgent
- **Messages** (SMS, WhatsApp, Telegram, iMessage): available depending on the configured provider
- The owner's phone number and messaging provider are managed server-side; you do not need to provide them
- Replace `$AGENT_ID` with your actual agent identifier if known, or omit the field

## Guardrails

- Never send more than one SMS for the same event
- Do not notify for something the owner will see when they next open Claw3D
- If the rate limit is hit, do not retry in a loop — wait and continue working
- Prefer a single clear sentence over a long explanation

## Supported messaging backends

The server routes notifications through the active messaging provider.
You do not need to select or configure the provider — this is handled in the server environment.

| Provider | Message | Call |
|---|---|---|
| Twilio | ✅ | ✅ |
| WhatsApp (via Twilio) | ✅ | ❌ |
| Telegram | ✅ | ❌ |
| iMessage (via BlueBubbles) | ✅ | ❌ |

Phone calls are only available when the server is configured with Twilio.
All other providers support messages only.
