# ZEUS Gateway — Setup & Operations

## What Is This

ZEUS gateway bridges Claw3D's 3D office UI to real LLMs. When you click an agent in the 3D office and send a message, it goes:

```
Claw3D UI → WebSocket → zeus-gateway-adapter.js → LLM → back to UI
```

Port: **18789**

---

## Quick Start

```bash
# 1. Fill in keys
edit .env   # see Keys section below

# 2. Start with autorestart
pm2 start ecosystem.config.js

# 3. Verify
pm2 logs zeus-gateway --lines 5
# Should show: Ollama=✅ NVIDIA=✅ Anthropic=✅
```

---

## Keys (`.env` — gitignored, never commit)

| Variable | Source | Used for |
|---|---|---|
| `NVIDIA_API_KEY` | build.nvidia.com → API Key | DeepSeek R1, Llama 3.3 70B, Nemotron, Mistral Large |
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | Claude Haiku (last-resort fallback) |
| `OLLAMA_URL` | default: http://localhost:11434 | Local qwen3:8b |
| `LOCAL_MODEL` | default: qwen3:8b | Which Ollama model to use |

Keys already available in `C:/Projects/VOLAURA/apps/api/.env`:
- `NVIDIA_API_KEY` — ✅ filled in `.env`
- `ANTHROPIC_API_KEY` — not in VOLAURA .env, check console.anthropic.com

---

## Agent → Model Routing

Each of 39 agents is assigned a tier based on what it needs:

| Tier | Model | Agents |
|---|---|---|
| `reasoning` | DeepSeek R1 | security-agent, architecture-agent, risk-manager |
| `fast` | Llama 3.3 70B | product-agent, growth-agent, analytics-retention-agent |
| `multilingual` | Mistral Large | cultural-intelligence-strategist, linkedin-content-creator |
| `synthesis` | Nemotron 253B | (reserved for complex synthesis tasks) |
| `local` (default) | qwen3:8b (Ollama) | all other 35 agents |

**Fallback chain:**
- Ollama agents: Ollama → NVIDIA fast → Haiku
- NVIDIA agents: NVIDIA → Ollama → Haiku

---

## pm2 Commands

```bash
pm2 status              # see if online
pm2 logs zeus-gateway   # live logs
pm2 restart zeus-gateway --update-env  # reload after .env change
pm2 stop zeus-gateway   # stop
pm2 delete zeus-gateway # remove from pm2
pm2 start ecosystem.config.js  # fresh start
pm2 startup             # auto-start on Windows boot
```

---

## Troubleshooting

**EADDRINUSE: port 18789 already in use**
```powershell
# Find PID
netstat -ano | findstr :18789
# Kill it (replace 12345 with actual PID)
Stop-Process -Id 12345 -Force
pm2 restart zeus-gateway
```

**NVIDIA=❌ no NVIDIA_API_KEY after restart**
- pm2 uses `--env-file .env` (Node 24 native)
- Use `pm2 delete zeus-gateway && pm2 start ecosystem.config.js` for clean reload
- Check key is actually in `.env` (not just template)

**Agent responds with static mode message**
- ANTHROPIC_API_KEY is missing
- Not critical — agents use Ollama/NVIDIA, Haiku is last-resort only
- Add key to `.env` and do clean restart

---

## Testing the Gateway

```bash
# Quick connectivity test (product-agent, 1 word reply, ~1s)
node scripts/test-zeus-ws.js

# Test specific agent
node scripts/test-zeus-ws.js architecture-agent "What is your role?"

# Test with custom timeout (reasoning models are slow)
TIMEOUT_MS=120000 node scripts/test-zeus-ws.js architecture-agent "Critique X"
```

**WS Protocol (for manual testing):**
```json
// 1. Connect
{ "type": "req", "id": "r0", "method": "connect", "params": {} }

// 2. Send message
{ "type": "req", "id": "r1", "method": "chat.send", "params": {
  "sessionKey": "agent:product-agent:my-session",
  "message": "Hello",
  "idempotencyKey": "unique-key-123"
}}

// 3. Receive chunks (type=event, event=chat, payload.state=delta|final)
{ "type": "event", "event": "chat", "seq": 1, "payload": {
  "state": "delta", "message": { "role": "assistant", "content": "Hello..." }
}}
```

---

## File Map

```
claw3d-fork/
├── server/zeus-gateway-adapter.js   ← main gateway (WebSocket + HTTP, LLM routing)
├── ecosystem.config.js              ← pm2 config (--env-file .env, autorestart)
├── .env                             ← API keys (gitignored)
├── scripts/test-zeus-ws.js          ← WS test harness (verify gateway + agents)
├── logs/
│   ├── zeus-gateway-error.log
│   └── zeus-gateway.log
└── ZEUS-SETUP.md                    ← this file
```
