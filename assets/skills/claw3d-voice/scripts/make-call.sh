#!/usr/bin/env bash
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

STUDIO_URL="${CLAW3D_STUDIO_URL:-http://localhost:3000}"
CALLEE="${1:?Usage: make-call.sh <callee> [message]}"
MESSAGE="${2:-}"

# Build JSON payload
if [ -n "$MESSAGE" ]; then
  PAYLOAD=$(printf '{"callee": %s, "message": %s}' \
    "$(printf '%s' "$CALLEE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
else
  PAYLOAD=$(printf '{"callee": %s}' \
    "$(printf '%s' "$CALLEE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")
fi

# Build curl args
CURL_ARGS=(-s -X POST "${STUDIO_URL}/api/office/call" -H "Content-Type: application/json" -d "$PAYLOAD")
if [ -n "${STUDIO_ACCESS_TOKEN:-}" ]; then
  CURL_ARGS+=(-H "Cookie: studio_access=${STUDIO_ACCESS_TOKEN}")
fi

# Send request
RESPONSE=$(curl "${CURL_ARGS[@]}")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
