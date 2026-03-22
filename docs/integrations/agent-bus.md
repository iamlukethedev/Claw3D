# Agent Bus Integration

> Visualize AI coding sessions in Claw3D's retro office — without OpenClaw.

[Agent Bus](https://github.com/emiliovos/agent-bus) is an open-source event routing system that bridges AI coding agents (Claude Code, Gemini, Codex, etc.) to Claw3D. Agents appear in the 3D office, animate when working, and go idle between tasks. Zero inference cost — pure data routing.

## How It Works

```
AI coding session → hook fires → Agent Bus hub → gateway :18789 → Claw3D renders in 3D
```

Agent Bus includes an **OpenClaw-compatible gateway** that speaks the same WebSocket protocol Claw3D already uses. No Claw3D code changes needed — just point `GATEWAY_URL` to the Agent Bus gateway.

### Architecture

```
┌───────────────────────────────────────────┐
│ Producers (any machine)                    │
│                                            │
│ Claude Code → PostToolUse hook → POST :4000│
│ Gemini CLI  → hook/script    → POST :4000 │
│ Any agent   → curl           → POST :4000 │
└────────────────────┬──────────────────────┘
                     │ HTTP POST /events
                     ▼
┌──────────────────────────────────────────┐
│ Agent Bus Hub (:4000)                     │
│ Validates → broadcasts → logs to JSONL   │
└────────────────────┬─────────────────────┘
                     │ WebSocket
                     ▼
┌──────────────────────────────────────────┐
│ Agent Bus Gateway (:18789)               │
│ OpenClaw protocol v2                     │
│ In-memory agent registry                 │
│ 10 RPC methods (connect, agents.list...) │
└────────────────────┬─────────────────────┘
                     │ WebSocket (OpenClaw frames)
                     ▼
┌──────────────────────────────────────────┐
│ Claw3D (:3000)                           │
│ Connects via GATEWAY_URL                 │
│ Renders agents in 3D retro office        │
└──────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Claw3D running on `:3000`

### Setup (5 minutes)

```bash
# Clone Agent Bus
git clone https://github.com/emiliovos/agent-bus.git
cd agent-bus
npm install

# Start the hub and gateway
npm run dev:all
```

This starts:
- Hub on `:4000` (event routing)
- Gateway on `:18789` (OpenClaw protocol)

### Connect Claw3D

Point Claw3D's gateway URL to Agent Bus:

```bash
# In your Claw3D .env or environment:
GATEWAY_URL=ws://localhost:18789
```

Restart Claw3D. It will connect to the Agent Bus gateway instead of OpenClaw.

### Send Your First Event

```bash
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"agent":"my-agent","project":"demo","event":"session_start"}'

# Agent appears in the 3D office!

curl -X POST http://localhost:4000/events \
  -d '{"agent":"my-agent","project":"demo","event":"tool_use","tool":"Edit","file":"app.ts"}'

# Agent animates "working" for 5 seconds
```

### Connect Claude Code Hooks

Agent Bus includes hook scripts that fire on every Claude Code tool use:

```bash
# Copy hooks
cp agent-bus/scripts/hook-post-tool-use.sh ~/.agent-bus/
cp agent-bus/scripts/hook-session-event.sh ~/.agent-bus/
chmod +x ~/.agent-bus/*.sh

# Set environment
export AGENT_BUS_AGENT="my-name"
export HUB_URL="http://localhost:4000"
```

Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [{ "type": "command", "command": "bash ~/.agent-bus/hook-post-tool-use.sh" }],
    "Stop": [{ "type": "command", "command": "bash ~/.agent-bus/hook-session-event.sh end" }]
  }
}
```

Every tool use in Claude Code now appears as agent activity in Claw3D.

## Gateway Protocol Compatibility

The Agent Bus gateway implements OpenClaw protocol v2:

| RPC Method | Supported | Notes |
|-----------|-----------|-------|
| `connect` | Yes | Returns `hello-ok` with agent snapshot |
| `health` | Yes | `{ ok: true }` |
| `agents.list` | Yes | Returns registered agents from hub events |
| `config.get` | Yes | Agent identity and configuration |
| `sessions.list` | Yes | Active sessions with message counts |
| `sessions.preview` | Yes | Recent chat messages (ring buffer, last 100) |
| `status` | Yes | Agent activity status |
| `exec.approvals.get` | Yes | Returns empty (no exec approval system) |
| `chat.send` | Partial | Logged, not delivered to agents (v1) |
| `chat.abort` | Partial | Logged, not delivered (v1) |

### Events Emitted

| Event | When |
|-------|------|
| `agent` (lifecycle) | Agent starts/stops working |
| `chat` (activity) | Tool use, task completion |
| `presence` | Agent registry changes |
| `tick` | Keepalive every 30 seconds |

## Remote Access

Agent Bus supports Cloudflare Tunnel for secure remote access:

```bash
# Automated setup
bash scripts/setup-cloudflare-tunnel.sh
```

This exposes the hub and Claw3D via HTTPS with service token authentication. Agents on remote machines (VPS, other PCs) can send events through the tunnel.

## Event Schema

```typescript
interface AgentEvent {
  ts?: number;        // Unix timestamp ms (auto-added if missing)
  agent: string;      // Agent identifier (e.g., "backend-dev")
  project: string;    // Project namespace (e.g., "my-app")
  event: string;      // "session_start" | "session_end" | "tool_use" | "task_complete" | "heartbeat"
  tool?: string;      // Tool name for tool_use events
  file?: string;      // File path for file operations
  message?: string;   // Human-readable description
}
```

## Key Differences from OpenClaw

| Feature | OpenClaw | Agent Bus |
|---------|----------|-----------|
| Cost | API tokens per inference | $0 (pure routing) |
| Agents | LLM-powered | Event-driven (any source) |
| Setup | Gateway + API keys | `npm install && npm run dev:all` |
| Chat interaction | Bidirectional | View-only (v1) |
| Agent sources | OpenClaw agents only | Any (Claude Code, Gemini, cron, etc.) |

## Links

- [Agent Bus Repository](https://github.com/emiliovos/agent-bus)
- [Getting Started Guide](https://github.com/emiliovos/agent-bus/blob/main/docs/GETTING_STARTED.md)
- [API Reference](https://github.com/emiliovos/agent-bus/blob/main/docs/api-reference.md)
- [Hook Integration Guide](https://github.com/emiliovos/agent-bus/blob/main/docs/hook-integration-guide.md)
