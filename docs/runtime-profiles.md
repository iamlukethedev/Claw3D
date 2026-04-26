# Runtime Profiles

Claw3D now treats runtime backends as named saved profiles instead of one global URL/token pair.

## Current Profiles

- `openclaw`
- `hermes`
- `demo`
- `local`
- `claw3d`
- `custom`

Each profile keeps its own saved URL and token in Studio settings.

## What Each Profile Means

### `openclaw`

The normal OpenClaw gateway flow over Studio's WebSocket bridge.

This is the provider-rich path. OpenClaw already knows how to sit in front of many upstream model providers, so Claw3D should treat it as a first-class gateway adapter rather than flattening it into `custom`.

Typical URL:

```text
ws://localhost:18789
```

### `hermes`

The bundled Hermes adapter over the same gateway-shaped WebSocket flow.

This is also a provider-aware runtime path. Hermes can own its own provider/account setup behind the gateway boundary.

Typical URL:

```text
ws://localhost:18789
```

### `demo`

The built-in demo gateway for a no-framework office.

If that gateway is not available, the office can still fall back to a seeded local `main` agent so the scene is explorable instead of dead-ending on the connect overlay.

Typical URL:

```text
ws://localhost:18789
```

### `local`

A direct HTTP runtime boundary for local orchestrators or local model routers.

Typical URL:

```text
http://localhost:7770
```

### `claw3d`

A Claw3D-shaped HTTP runtime profile for stacks that want to keep Claw3D transcript and chat conventions while still using the direct runtime seam.

Typical URL:

```text
http://localhost:3000/api/runtime/custom
```

### `custom`

The generic HTTP runtime seam when you want to point Claw3D at any compatible orchestrator boundary.

Typical URL:

```text
http://localhost:7770
```

## Current Runtime Contract

The direct runtime seam currently probes for:

- `GET /health`
- `GET /state`
- `GET /registry`
- `POST /v1/chat/completions`

That means `local`, `claw3d`, and `custom` are first-class saved profiles today.

On top of the normal chat/session calls, runtime providers now expose a shared multi-agent message seam:

- `agents.message`
- `agents.handoff`

These methods currently route through the existing gateway/runtime session model rather than inventing a second transcript transport.

## Multi-Agent Message Contract

`agents.message` supports:

- `targetAgentId`
- `message`
- `mode: "direct" | "interval"`
- optional `sourceAgentId`
- optional `sourceLabel`
- optional `cadenceHint`

`agents.handoff` supports:

- `targetAgentId`
- `task`
- optional `context`
- optional `deliverables`
- optional `acceptanceCriteria`
- optional `sourceAgentId`
- optional `sourceLabel`

The intent is to keep one stable message/handoff contract while different runtime adapters decide how to deliver it.

## What Is Not Wired Yet

These are not first-class connection profiles yet in this branch:

- Anthropic
- Claude Code
- OpenRouter
- other provider-native transports

Those should land as real adapters, not as buttons that pretend the HTTP runtime seam already understands provider-specific auth and event semantics.

The current provider review path should borrow from existing Hermes/OpenClaw wizard flows where possible, but land as Claw3D-native adapters instead of hard-coupling Claw3D UI state to another project's connector code.

## Why This Matters For Multi-Agent Work

The profile split is the first step toward:

- separate per-runtime saved connection state
- agent-to-agent chat and handoff across backends
- shared-floor and coworking flows without flattening every runtime into one transport
- future provider adapters that do not require rewriting Studio UI state
