---
name: claw3d-text
description: Send text messages through the Claw3D office SMS booth.
metadata: {"openclaw":{"skillKey":"claw3d-text"}}
---

# Claw3D Text Skill

Send text messages through the Claw3D office SMS booth.

## Trigger

```json
{
  "activation": {
    "anyPhrases": ["text", "send a text", "send a message", "sms"]
  },
  "movement": {
    "target": "sms_booth",
    "skipIfAlreadyThere": true
  }
}
```

When this skill is activated, the agent walks to the SMS booth in the office before handling the request.

- If the user asks from Telegram or any other external surface to send a text, SMS, or message, treat that as a trigger for this skill.
- The physical behavior for this skill is: walk to the SMS booth, then perform the text messaging workflow.
- If the agent is already at the SMS booth, continue without adding extra movement narration.

## Prerequisites

- A running Claw3D Studio instance (the text API is served by Studio)
- Studio URL reachable from the agent host (typically `http://localhost:3000`)
- Shell scripts use `python3` for JSON encoding — ensure it is available

## Configuration

Set the Studio URL via environment variable (defaults to `http://localhost:3000`):

```bash
export CLAW3D_STUDIO_URL="http://localhost:3000"
```

If Studio is behind authentication, set the access token:

```bash
export STUDIO_ACCESS_TOKEN="your-token"
```

## Usage

### Send a text message

```bash
# Two-step flow: first get the prompt, then send with message
# Step 1: Initiate (get prompt for what to say)
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/text" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "Mom"}'

# Step 2: Send with message content
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/text" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "Mom", "message": "Running late, be there in 20 minutes"}'
```

### Helper script

```bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/send-text.sh "Mom" "Running late, be there in 20 minutes"
```

### Response format

```json
{
  "scenario": {
    "phase": "ready_to_send",
    "recipient": "Mom",
    "messageText": "Running late, be there in 20 minutes",
    "confirmationText": "Thanks for letting me know.",
    "statusLine": "Text queued for Mom."
  }
}
```

### Phases

| Phase | Meaning |
|-------|---------|
| `needs_message` | Recipient set, awaiting message content |
| `ready_to_send` | Message composed and queued for delivery |

## Error Handling

- **400**: Missing or oversized recipient/message (max 120 chars recipient, 1000 chars message)
- **500**: Studio internal error

## Integration Notes

- This skill wraps the Claw3D Studio `/api/office/text` endpoint
- The current implementation uses a mock delivery system — actual SMS delivery requires Twilio or similar provider configuration (future enhancement)
- The SMS booth in the 3D office triggers agent movement to the booth when this skill is invoked
- Messages are limited to 1,000 characters per the Studio API contract

## Future Enhancements

- Real SMS delivery via Twilio/Vonage provider
- Delivery status callbacks
- Contact book integration
- Message history/threading
