---
name: claw3d-voice
description: Make voice calls and generate voice replies through the Claw3D office phone booth.
metadata: {"openclaw":{"skillKey":"claw3d-voice"}}
---

# Claw3D Voice Skill

Make voice calls and generate voice replies through the Claw3D office phone booth.

## Trigger

```json
{
  "activation": {
    "anyPhrases": ["call", "phone call", "voice call", "call someone", "phone someone"]
  },
  "movement": {
    "target": "phone_booth",
    "skipIfAlreadyThere": true
  }
}
```

When this skill is activated, the agent walks to the phone booth in the office before handling the request.

- If the user asks from Telegram or any other external surface to make a call, phone someone, or leave a voice message, treat that as a trigger for this skill.
- The physical behavior for this skill is: walk to the phone booth, then perform the voice call workflow.
- If the agent is already at the phone booth, continue without adding extra movement narration.

## Prerequisites

- A running Claw3D Studio instance
- For voice generation: `ELEVENLABS_API_KEY` configured on the Studio host
- For transcription: Audio file upload support
- Shell scripts use `python3` for JSON encoding — ensure it is available

## Configuration

### Required

```bash
export CLAW3D_STUDIO_URL="http://localhost:3000"
```

### Optional (for voice generation)

```bash
# Set on the Studio host (not the agent host)
export ELEVENLABS_API_KEY="your-key"
export ELEVENLABS_VOICE_ID="your-voice-id"      # Optional, uses default
export ELEVENLABS_MODEL_ID="eleven_turbo_v2_5"   # Optional
```

If Studio is behind authentication:

```bash
export STUDIO_ACCESS_TOKEN="your-token"
```

## Usage

### Make a phone call

```bash
# Two-step flow: initiate then speak
# Step 1: Initiate call (get prompt)
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/call" \
  -H "Content-Type: application/json" \
  -d '{"callee": "Mom"}'

# Step 2: Call with message
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/call" \
  -H "Content-Type: application/json" \
  -d '{"callee": "Mom", "message": "I will be late for dinner"}'
```

### Helper script

```bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/make-call.sh "Mom" "I will be late for dinner"
```

### Call response format

```json
{
  "scenario": {
    "phase": "ready_to_call",
    "callee": "Mom",
    "dialNumber": "973-619-4672",
    "spokenText": "Hi, this is Luke assistant. He told me to tell you I will be late for dinner. Thank you.",
    "recipientReply": "Okay, thanks for letting me know.",
    "statusLine": "Connected to Mom.",
    "voiceAvailable": true
  }
}
```

### Generate a voice reply

```bash
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/voice/reply" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am your AI assistant speaking from the office."}'
```

### Voice reply helper script

```bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/voice-reply.sh "Hello, I am your AI assistant speaking from the office."
```

### Transcribe audio

```bash
curl -s -X POST "${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/voice/transcribe" \
  -F "audio=@recording.webm"
```

## Phases

### Call phases

| Phase | Meaning |
|-------|---------|
| `needs_message` | Callee set, awaiting what to say |
| `ready_to_call` | Message composed, call scenario ready |

### Key fields

| Field | Description |
|-------|-------------|
| `voiceAvailable` | Whether ElevenLabs TTS is configured on Studio |
| `spokenText` | The formatted text the agent would speak |
| `recipientReply` | Simulated recipient response |
| `dialNumber` | The phone number for the call |

## Error Handling

- **400**: Missing or oversized callee/message (max 120 chars callee, 1000 chars message)
- **413**: Voice upload exceeds 20 MB limit
- **500**: Studio internal error or ElevenLabs API failure

## Integration with Office

- The phone booth in the 3D office triggers agent movement when this skill is used
- The SMS booth is a separate entity — use `claw3d-text` for text messages
- Voice replies play through the office audio system when available
- Transcription uses the Studio-side Whisper/provider integration

## Limitations

- Current call delivery uses mock scenarios — real telephony requires Twilio configuration (future)
- Voice transcription buffers the upload server-side (size limit enforced pre-buffer per PR #22)
- Maximum audio upload: 20 MB

## Future Enhancements

- Real outbound calling via Twilio
- Inbound call routing to agents
- Real-time voice conversation (WebRTC)
- Call recording and transcript storage
- Multiple voice persona support
- Conference call / multi-agent voice meetings
