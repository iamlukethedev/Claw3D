type PackagedSkillFile = {
  relativePath: string;
  content: string;
};

// Keep this string synchronized with assets/skills/todo-board/SKILL.md.
const TODO_BOARD_SKILL_MD = `---
name: todo
description: Maintain a shared workspace TODO list with blocked tasks.
metadata: {"openclaw":{"skillKey":"todo-board"}}
---

# TODO Board

Use this skill when the user wants to manage a shared task list for the current workspace.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": [
      "todo",
      "todo list",
      "blocked task",
      "blocked tasks",
      "add to my todo",
      "show my todo"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent should return to its assigned desk before handling the request.

- If the user asks from Telegram or any other external surface to add, block, unblock, remove, or read TODO items, treat that as a trigger for this skill.
- The physical behavior for this skill is: go sit at the assigned desk, then perform the TODO board workflow.
- If the agent is already at the desk, continue without adding extra movement narration.

## Storage location

The authoritative task file is \`todo-skill/todo-list.json\` in the workspace root.

- Always treat that file as the source of truth.
- Never rely on chat memory alone for the latest task state.
- Create the \`todo-skill\` directory and \`todo-list.json\` file if they do not exist.

## Required workflow

1. Read \`todo-skill/todo-list.json\` before answering any task-management request.
2. If the file does not exist, create it with the schema in this document before continuing.
3. After every add, remove, block, or unblock action, write the full updated JSON back to disk.
4. If the file exists but is invalid JSON or does not match the schema, repair it into a valid structure, preserve any recoverable items, and mention that repair in your response.
5. If the user request is ambiguous, ask a clarifying question instead of guessing.

## Supported actions

- Add a task.
  Create a new item unless an equivalent active item already exists.
- Block a task.
  Change the matching item to \`status: "blocked"\`. If the task does not exist and the request is clear, create it directly as blocked.
- Unblock a task.
  Change the matching item back to \`status: "todo"\` and clear \`blockReason\`.
- Remove a task.
  Delete only the matching item. If multiple items could match, ask for clarification.
- Read the list.
  Summarize tasks grouped into \`TODO\` and \`BLOCKED\`.

## File format

Use this JSON shape:

\`\`\`json
{
  "version": 1,
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "items": [
    {
      "id": "task-1",
      "title": "Example task",
      "status": "todo",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": null
    }
  ]
}
\`\`\`

## Field rules

- Keep \`version\` at \`1\`.
- Generate stable, human-readable IDs such as \`prepare-demo\` or \`task-2\`.
- Keep titles concise and preserve the user's intent.
- Use only \`todo\` or \`blocked\` for \`status\`.
- Use ISO timestamps for \`createdAt\`, item \`updatedAt\`, and top-level \`updatedAt\`.
- Keep \`blockReason\` as \`null\` unless the user gave a reason or a short precise reason is clearly implied.

## Mutation rules

- Avoid duplicate active items that describe the same work.
- Preserve existing IDs and \`createdAt\` values for unchanged items.
- Update the touched item's \`updatedAt\` whenever you modify it.
- Update the top-level \`updatedAt\` on every write.
- Keep untouched items in their original order unless there is a strong reason to reorder them.

## Response style

- After each mutation, say what changed.
- When showing the list, group tasks into \`TODO\` and \`BLOCKED\`.
- Include each blocked task's reason when one exists.
`;

// Keep this string synchronized with assets/skills/todo-board/todo-list.example.json.
const TODO_BOARD_EXAMPLE_JSON = `{
  "version": 1,
  "updatedAt": "2026-03-22T00:00:00.000Z",
  "items": [
    {
      "id": "draft-roadmap",
      "title": "Draft the TODO skill roadmap",
      "status": "todo",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": null
    },
    {
      "id": "gateway-access",
      "title": "Confirm gateway install access",
      "status": "blocked",
      "createdAt": "2026-03-22T00:00:00.000Z",
      "updatedAt": "2026-03-22T00:00:00.000Z",
      "blockReason": "Waiting for gateway credentials"
    }
  ]
}
`;

// Keep this string synchronized with assets/skills/soundclaw/SKILL.md.
const SOUNDCLAW_SKILL_MD = `---
name: soundclaw
description: Control Spotify playback, search music, and return shareable music links.
metadata: {"openclaw":{"skillKey":"soundclaw"}}
---

# SOUNDCLAW

Use this skill when the user wants an agent to search for music, play a song or playlist, control Spotify playback, or send back a shareable Spotify link on the same channel the request came from.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": [
      "spotify",
      "play a song",
      "play this song",
      "play music",
      "play a playlist",
      "find a song",
      "queue this song",
      "music link"
    ]
  },
  "movement": {
    "target": "jukebox",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent should walk to the office jukebox before handling the request.

- Treat requests from Telegram or any other external surface as valid triggers when they ask for Spotify playback, search, queueing, or music-link sharing.
- The physical behavior for this skill is: go to the jukebox, perform the music-selection workflow, then report the result.
- If the agent is already at the jukebox, continue without adding extra movement narration.

## Channel behavior

- Reply on the same active channel or session that received the request.
- If playback cannot start but a matching track, album, or playlist is found, send back the best Spotify link instead of failing silently.
- If multiple matches are plausible, ask a clarifying question instead of guessing.

---

## OpenClaw Gateway Skill Contract

> This section is for developers implementing the backend skill handler in OpenClaw.
> The Claw3D UI handles authentication via Spotify PKCE OAuth in the browser.
> The gateway skill handles agent-driven requests via the \`soundclaw.*\` RPC namespace.

### Authentication model

The user authenticates directly in the browser (PKCE, no secret required).
The access token is stored in browser \`localStorage\` under the key \`soundclaw_token\`.

For **agent-driven** playback (e.g. "play Jazz for me"), the gateway skill should either:
- Use a server-side Spotify app token (Client Credentials) for search-only actions, or
- Instruct the agent to tell the user to use the jukebox panel for actual playback

### RPC methods the gateway skill should expose

\`\`\`ts
// Search for tracks. Returns a list of { name, artist, album, uri, spotifyUrl }.
soundclaw.search({ query: string }): SpotifySearchResult[]

// Get a shareable Spotify link for a query (for Telegram/chat replies).
soundclaw.getLink({ query: string }): { url: string; title: string }

// Report current playback state (reads from Spotify API).
soundclaw.playerStatus(): PlayerStatus | null

// Request playback of a URI (requires user to be authenticated in browser).
soundclaw.play({ uri: string }): { ok: boolean; message?: string }

// Pause / resume / skip.
soundclaw.pause(): void
soundclaw.resume(): void
soundclaw.next(): void
soundclaw.previous(): void
\`\`\`

### Agent workflow

1. Agent receives a music request ("play some jazz", "find this song", etc.)
2. Agent walks to the jukebox (\`movement.target: "jukebox"\`)
3. Agent calls \`soundclaw.search\` to find the best match
4. If the request came from a chat channel (Telegram, etc.): call \`soundclaw.getLink\` and reply with the link
5. If the request came from the office UI: call \`soundclaw.play\` to start playback
6. Agent reports back what was played or linked
`;

// Keep this string synchronized with assets/skills/claw3d-text/SKILL.md.
const CLAW3D_TEXT_SKILL_MD = `---
name: claw3d-text
description: Send text messages through the Claw3D office SMS booth.
metadata: {"openclaw":{"skillKey":"claw3d-text"}}
---

# Claw3D Text Skill

Send text messages through the Claw3D office SMS booth.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": ["text", "send a text", "send a message", "sms"]
  },
  "movement": {
    "target": "sms_booth",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent walks to the SMS booth in the office before handling the request.

- If the user asks from Telegram or any other external surface to send a text, SMS, or message, treat that as a trigger for this skill.
- The physical behavior for this skill is: walk to the SMS booth, then perform the text messaging workflow.
- If the agent is already at the SMS booth, continue without adding extra movement narration.

## Prerequisites

- A running Claw3D Studio instance (the text API is served by Studio)
- Studio URL reachable from the agent host (typically \`http://localhost:3000\`)
- Shell scripts use \`python3\` for JSON encoding — ensure it is available

## Configuration

Set the Studio URL via environment variable (defaults to \`http://localhost:3000\`):

\`\`\`bash
export CLAW3D_STUDIO_URL="http://localhost:3000"
\`\`\`

If Studio is behind authentication, set the access token:

\`\`\`bash
export STUDIO_ACCESS_TOKEN="your-token"
\`\`\`

## Usage

### Send a text message

\`\`\`bash
# Two-step flow: first get the prompt, then send with message
# Step 1: Initiate (get prompt for what to say)
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/text" \\
  -H "Content-Type: application/json" \\
  -d '{"recipient": "Mom"}'

# Step 2: Send with message content
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/text" \\
  -H "Content-Type: application/json" \\
  -d '{"recipient": "Mom", "message": "Running late, be there in 20 minutes"}'
\`\`\`

### Helper script

\`\`\`bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/send-text.sh "Mom" "Running late, be there in 20 minutes"
\`\`\`

### Response format

\`\`\`json
{
  "scenario": {
    "phase": "ready_to_send",
    "recipient": "Mom",
    "messageText": "Running late, be there in 20 minutes",
    "confirmationText": "Thanks for letting me know.",
    "statusLine": "Text queued for Mom."
  }
}
\`\`\`

### Phases

| Phase | Meaning |
|-------|---------|
| \`needs_message\` | Recipient set, awaiting message content |
| \`ready_to_send\` | Message composed and queued for delivery |

## Error Handling

- **400**: Missing or oversized recipient/message (max 120 chars recipient, 1000 chars message)
- **500**: Studio internal error

## Integration Notes

- This skill wraps the Claw3D Studio \`/api/office/text\` endpoint
- The current implementation uses a mock delivery system — actual SMS delivery requires Twilio or similar provider configuration (future enhancement)
- The SMS booth in the 3D office triggers agent movement to the booth when this skill is invoked
- Messages are limited to 1,000 characters per the Studio API contract

## Future Enhancements

- Real SMS delivery via Twilio/Vonage provider
- Delivery status callbacks
- Contact book integration
- Message history/threading
`;

// Keep this string synchronized with assets/skills/claw3d-text/scripts/send-text.sh.
const CLAW3D_TEXT_SEND_SH = `#!/usr/bin/env bash
# send-text.sh — Send a text message via Claw3D Studio text API.
#
# Usage:
#   ./send-text.sh <recipient> [message]
#
# Environment:
#   CLAW3D_STUDIO_URL   Studio base URL (default: http://localhost:3000)
#   STUDIO_ACCESS_TOKEN  Optional Studio access token
#
# Examples:
#   ./send-text.sh "Mom"                              # Initiate (get prompt)
#   ./send-text.sh "Mom" "Running late, 20 minutes"   # Send with message

set -euo pipefail

STUDIO_URL="\${CLAW3D_STUDIO_URL:-http://localhost:3000}"
RECIPIENT="\${1:?Usage: send-text.sh <recipient> [message]}"
MESSAGE="\${2:-}"

# Build JSON payload
if [ -n "\$MESSAGE" ]; then
  PAYLOAD=\$(printf '{"recipient": %s, "message": %s}' \\
    "\$(printf '%s' "\$RECIPIENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \\
    "\$(printf '%s' "\$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
else
  PAYLOAD=\$(printf '{"recipient": %s}' \\
    "\$(printf '%s' "\$RECIPIENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
fi

# Build curl args
CURL_ARGS=(-s -X POST "\${STUDIO_URL}/api/office/text" -H "Content-Type: application/json" -d "\$PAYLOAD")
if [ -n "\${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=\${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=\$(curl "\${CURL_ARGS[@]}")
echo "\$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "\$RESPONSE"
`;

// Keep this string synchronized with assets/skills/claw3d-voice/SKILL.md.
const CLAW3D_VOICE_SKILL_MD = `---
name: claw3d-voice
description: Make voice calls and generate voice replies through the Claw3D office phone booth.
metadata: {"openclaw":{"skillKey":"claw3d-voice"}}
---

# Claw3D Voice Skill

Make voice calls and generate voice replies through the Claw3D office phone booth.

## Trigger

\`\`\`json
{
  "activation": {
    "anyPhrases": ["call", "phone call", "voice call", "call someone", "phone someone"]
  },
  "movement": {
    "target": "phone_booth",
    "skipIfAlreadyThere": true
  }
}
\`\`\`

When this skill is activated, the agent walks to the phone booth in the office before handling the request.

- If the user asks from Telegram or any other external surface to make a call, phone someone, or leave a voice message, treat that as a trigger for this skill.
- The physical behavior for this skill is: walk to the phone booth, then perform the voice call workflow.
- If the agent is already at the phone booth, continue without adding extra movement narration.

## Prerequisites

- A running Claw3D Studio instance
- For voice generation: \`ELEVENLABS_API_KEY\` configured on the Studio host
- For transcription: Audio file upload support
- Shell scripts use \`python3\` for JSON encoding — ensure it is available

## Configuration

### Required

\`\`\`bash
export CLAW3D_STUDIO_URL="http://localhost:3000"
\`\`\`

### Optional (for voice generation)

\`\`\`bash
# Set on the Studio host (not the agent host)
export ELEVENLABS_API_KEY="your-key"
export ELEVENLABS_VOICE_ID="your-voice-id"      # Optional, uses default
export ELEVENLABS_MODEL_ID="eleven_turbo_v2_5"   # Optional
\`\`\`

If Studio is behind authentication:

\`\`\`bash
export STUDIO_ACCESS_TOKEN="your-token"
\`\`\`

## Usage

### Make a phone call

\`\`\`bash
# Two-step flow: initiate then speak
# Step 1: Initiate call (get prompt)
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/call" \\
  -H "Content-Type: application/json" \\
  -d '{"callee": "Mom"}'

# Step 2: Call with message
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/call" \\
  -H "Content-Type: application/json" \\
  -d '{"callee": "Mom", "message": "I will be late for dinner"}'
\`\`\`

### Helper script

\`\`\`bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/make-call.sh "Mom" "I will be late for dinner"
\`\`\`

### Call response format

\`\`\`json
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
\`\`\`

### Generate a voice reply

\`\`\`bash
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/voice/reply" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Hello, I am your AI assistant speaking from the office."}'
\`\`\`

### Voice reply helper script

\`\`\`bash
# Via the bundled script (uses python3 for JSON encoding):
./scripts/voice-reply.sh "Hello, I am your AI assistant speaking from the office."
\`\`\`

### Transcribe audio

\`\`\`bash
curl -s -X POST "\${CLAW3D_STUDIO_URL:-http://localhost:3000}/api/office/voice/transcribe" \\
  -F "audio=@recording.webm"
\`\`\`

## Phases

### Call phases

| Phase | Meaning |
|-------|---------|
| \`needs_message\` | Callee set, awaiting what to say |
| \`ready_to_call\` | Message composed, call scenario ready |

### Key fields

| Field | Description |
|-------|-------------|
| \`voiceAvailable\` | Whether ElevenLabs TTS is configured on Studio |
| \`spokenText\` | The formatted text the agent would speak |
| \`recipientReply\` | Simulated recipient response |
| \`dialNumber\` | The phone number for the call |

## Error Handling

- **400**: Missing or oversized callee/message (max 120 chars callee, 1000 chars message)
- **413**: Voice upload exceeds 20 MB limit
- **500**: Studio internal error or ElevenLabs API failure

## Integration with Office

- The phone booth in the 3D office triggers agent movement when this skill is used
- The SMS booth is a separate entity — use \`claw3d-text\` for text messages
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
`;

// Keep this string synchronized with assets/skills/claw3d-voice/scripts/make-call.sh.
const CLAW3D_VOICE_MAKE_CALL_SH = `#!/usr/bin/env bash
# make-call.sh — Initiate a voice call via Claw3D Studio call API.
#
# Usage:
#   ./make-call.sh <callee> [message]
#
# Environment:
#   CLAW3D_STUDIO_URL    Studio base URL (default: http://localhost:3000)
#   STUDIO_ACCESS_TOKEN  Optional Studio access token
#
# Examples:
#   ./make-call.sh "Mom"                                  # Initiate (get prompt)
#   ./make-call.sh "Mom" "I will be late for dinner"      # Call with message

set -euo pipefail

STUDIO_URL="\${CLAW3D_STUDIO_URL:-http://localhost:3000}"
CALLEE="\${1:?Usage: make-call.sh <callee> [message]}"
MESSAGE="\${2:-}"

# Build JSON payload
if [ -n "\$MESSAGE" ]; then
  PAYLOAD=\$(printf '{"callee": %s, "message": %s}' \\
    "\$(printf '%s' "\$CALLEE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \\
    "\$(printf '%s' "\$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
else
  PAYLOAD=\$(printf '{"callee": %s}' \\
    "\$(printf '%s' "\$CALLEE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
fi

# Build curl args
CURL_ARGS=(-s -X POST "\${STUDIO_URL}/api/office/call" -H "Content-Type: application/json" -d "\$PAYLOAD")
if [ -n "\${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=\${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=\$(curl "\${CURL_ARGS[@]}")
echo "\$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "\$RESPONSE"
`;

// Keep this string synchronized with assets/skills/claw3d-voice/scripts/voice-reply.sh.
const CLAW3D_VOICE_REPLY_SH = `#!/usr/bin/env bash
# voice-reply.sh — Generate a voice reply via Claw3D Studio voice API.
#
# Usage:
#   ./voice-reply.sh <text>
#
# Environment:
#   CLAW3D_STUDIO_URL    Studio base URL (default: http://localhost:3000)
#   STUDIO_ACCESS_TOKEN  Optional Studio access token
#
# Requires ELEVENLABS_API_KEY configured on the Studio host.
#
# Example:
#   ./voice-reply.sh "Hello, I'm speaking from the office."

set -euo pipefail

STUDIO_URL="\${CLAW3D_STUDIO_URL:-http://localhost:3000}"
TEXT="\${1:?Usage: voice-reply.sh <text>}"

PAYLOAD=\$(printf '{"text": %s}' \\
  "\$(printf '%s' "\$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")

# Build curl args
CURL_ARGS=(-s -X POST "\${STUDIO_URL}/api/office/voice/reply" -H "Content-Type: application/json" -d "\$PAYLOAD")
if [ -n "\${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=\${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=\$(curl "\${CURL_ARGS[@]}")
echo "\$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "\$RESPONSE"
`;

const PACKAGED_SKILL_FILES: Record<string, PackagedSkillFile[]> = {
  "todo-board": [
    {
      relativePath: "SKILL.md",
      content: TODO_BOARD_SKILL_MD,
    },
    {
      relativePath: "todo-list.example.json",
      content: TODO_BOARD_EXAMPLE_JSON,
    },
  ],
  soundclaw: [
    {
      relativePath: "SKILL.md",
      content: SOUNDCLAW_SKILL_MD,
    },
  ],
  "claw3d-text": [
    {
      relativePath: "SKILL.md",
      content: CLAW3D_TEXT_SKILL_MD,
    },
    {
      relativePath: "scripts/send-text.sh",
      content: CLAW3D_TEXT_SEND_SH,
    },
  ],
  "claw3d-voice": [
    {
      relativePath: "SKILL.md",
      content: CLAW3D_VOICE_SKILL_MD,
    },
    {
      relativePath: "scripts/make-call.sh",
      content: CLAW3D_VOICE_MAKE_CALL_SH,
    },
    {
      relativePath: "scripts/voice-reply.sh",
      content: CLAW3D_VOICE_REPLY_SH,
    },
  ],
};

export const readPackagedSkillFiles = (
  packageId: string,
): PackagedSkillFile[] => {
  const files = PACKAGED_SKILL_FILES[packageId];
  if (!files || files.length === 0) {
    throw new Error(`Packaged skill assets are missing: ${packageId}`);
  }
  if (!files.some((file) => file.relativePath === "SKILL.md")) {
    throw new Error(`Packaged skill is missing SKILL.md: ${packageId}`);
  }
  return files.map((file) => ({ ...file }));
};
