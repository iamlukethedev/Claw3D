# Paperclip Gateway Adapter

Claw3D can run against Paperclip through the bundled gateway adapter in
[`server/paperclip-gateway-adapter.js`](../server/paperclip-gateway-adapter.js).

## Architecture

```text
Browser UI <-> Studio runtime/client <-> Paperclip gateway adapter <-> Paperclip REST API
```

The frontend keeps speaking the Claw3D gateway protocol while the adapter
translates into Paperclip REST calls and emits compatible `chat` and
`presence` events.

## Quick start

### 1. Configure environment

Copy `.env.example` to `.env` and set Paperclip values:

```env
PAPERCLIP_API_URL=http://localhost:3001
PAPERCLIP_API_KEY=
PAPERCLIP_COMPANY_ID=
PAPERCLIP_ADAPTER_PORT=18791
PAPERCLIP_DEFAULT_MODEL=paperclip/default
```

### 2. Start Claw3D and adapter

In separate terminals:

```bash
npm run paperclip-adapter
npm run dev
```

Then open `[REDACTED]`, choose `Paperclip backend`, and connect to:

```text
ws://localhost:18791
```

## Supported gateway surfaces

The adapter currently provides:

- `agents.list`
- `sessions.list`
- `status`
- `chat.send`
- `chat.abort`
- `chat.history` (session-local memory)
- `models.list`

Write-heavy config/task/cron operations are currently returned as
`not_implemented` so the UI can show graceful errors rather than silently
failing.
