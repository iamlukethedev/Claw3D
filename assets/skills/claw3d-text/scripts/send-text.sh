#!/usr/bin/env bash
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

STUDIO_URL="${CLAW3D_STUDIO_URL:-http://localhost:3000}"
RECIPIENT="${1:?Usage: send-text.sh <recipient> [message]}"
MESSAGE="${2:-}"

# Build JSON payload
if [ -n "$MESSAGE" ]; then
  PAYLOAD=$(printf '{"recipient": %s, "message": %s}' \
    "$(printf '%s' "$RECIPIENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
else
  PAYLOAD=$(printf '{"recipient": %s}' \
    "$(printf '%s' "$RECIPIENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
fi

# Build curl args
CURL_ARGS=(-s -X POST "${STUDIO_URL}/api/office/text" -H "Content-Type: application/json" -d "$PAYLOAD")
if [ -n "${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=$(curl "${CURL_ARGS[@]}")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
