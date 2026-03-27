#!/usr/bin/env bash
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

STUDIO_URL="${CLAW3D_STUDIO_URL:-http://localhost:3000}"
TEXT="${1:?Usage: voice-reply.sh <text>}"

PAYLOAD=$(printf '{"text": %s}' \
  "$(printf '%s' "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")

# Build curl args
CURL_ARGS=(-s -X POST "${STUDIO_URL}/api/office/voice/reply" -H "Content-Type: application/json" -d "$PAYLOAD")
if [ -n "${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=$(curl "${CURL_ARGS[@]}")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
