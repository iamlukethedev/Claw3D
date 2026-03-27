# Hermes Gateway Adapter

Claw3D supports any gateway that implements its WebSocket protocol. This document explains how to use **Hermes** as an alternative to OpenClaw.

## What is Hermes?

Hermes is a local AI agent runtime. The Hermes adapter (`server/hermes-gateway-adapter.js`) acts as a bridge between Claw3D and the Hermes HTTP API — translating the Claw3D WebSocket protocol into Hermes API calls so the frontend works without any changes.

```
Claw3D browser ←→ WebSocket ←→ hermes-gateway-adapter.js ←→ HTTP ←→ Hermes API
```

## Quick Start

### 1. Start Hermes

Start your Hermes API server (default: `http://localhost:8642`).

Alternatively, use the all-in-one startup script which handles Hermes, the adapter, and the dev server automatically:

```bash
bash scripts/clawd3d-start.sh
```

You can alias it for convenience:

```bash
alias claw3d="bash /path/to/clawd3d/scripts/clawd3d-start.sh"
```

### 2. Configure environment

Copy `.env.example` to `.env` and set the Hermes vars:

```env
NEXT_PUBLIC_GATEWAY_URL=ws://localhost:18789

HERMES_API_URL=http://localhost:8642
HERMES_API_KEY=                        # optional bearer token
HERMES_ADAPTER_PORT=18789
HERMES_MODEL=hermes
HERMES_AGENT_NAME=Hermes
```

### 3. Start the adapter and dev server

In two separate terminals:

```bash
# Terminal 1 — Hermes adapter
npm run hermes-adapter

# Terminal 2 — Claw3D dev server
npm run dev
```

Then open `http://localhost:3000`.

## Multi-Agent Orchestration

The main Hermes agent is an orchestrator with built-in team management tools:

| Tool | Description |
|------|-------------|
| `spawn_agent` | Create a new specialist sub-agent with a name, role, and instructions |
| `delegate_task` | Send a task to another agent |
| `list_team` | List all active agents and their roles |
| `configure_agent` | Update an agent's name, role, instructions, or settings |
| `dismiss_agent` | Remove an agent from the team |

Sub-agents automatically appear as 3D characters in the office and have their own conversation history.

## Conversation History

Chat history is persisted locally at `~/.hermes/clawd3d-history.json`. History survives server restarts and is loaded automatically on reconnect.

## Protocol Compatibility

The Hermes adapter implements the full Claw3D gateway protocol, including:

- Agent listing (`agents.list`, `agents.create`, `agents.delete`, `agents.update`)
- Session management (`sessions.list`, `sessions.preview`, `sessions.patch`)
- Chat streaming (`chat.send` with delta/final events, `chat.abort`)
- Config (`config.get`, `config.set`)
- Cron jobs (`cron.list`, `cron.add`, `cron.remove`, `cron.patch`, `cron.run`)
- Skills, models, approvals

## Using OpenClaw instead

To use OpenClaw, configure the SSH vars in `.env` and do **not** set `HERMES_API_URL`. The app will connect to OpenClaw as usual.

```env
OPENCLAW_GATEWAY_SSH_TARGET=...
OPENCLAW_GATEWAY_SSH_USER=...
```
