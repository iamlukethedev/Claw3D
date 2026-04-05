# Universal Backend Plan

> Backend-neutral Claw3D integration plan for OpenClaw, Hermes, Vera, and other runtimes.

## Recommendation

Do not treat PR #70 as the long-term integration architecture.

It is useful as a short-term compatibility shim and a source of a few good UX changes, but it does not make Claw3D backend-neutral. It keeps Claw3D OpenClaw-shaped and makes Hermes imitate OpenClaw.

That matters because:

- Hermes already has real control surfaces: ACP and an OpenAI-compatible API server.
- Vera already has a real orchestrator/gateway shape.
- Every future backend would otherwise need to keep emulating the OpenClaw gateway protocol.

The better path is:

1. Keep OpenClaw support intact.
2. Extract a backend-neutral runtime adapter inside Claw3D.
3. Add Hermes and Vera providers against their native surfaces where possible.
4. Cherry-pick the high-value UI pieces from PR #70 into that new architecture.

## What To Reuse From PR #70

These are worth keeping:

- Multi-agent UX concepts.
- `read_agent_context` as a coordination primitive.
- Agent `role` flowing into the 3D office nameplate.
- Click-to-chat behavior.
- Live speech bubble rendering for streaming text.
- Hermes-specific env var documentation.

These are not the right long-term seam:

- A full OpenClaw-protocol emulator as the primary Hermes integration.
- Fake-success implementations for `config.*` and approvals.
- Synthesizing runtime freshness from `Date.now()` instead of real event/message timestamps.

## Target Architecture

Claw3D should stop treating the browser gateway client as the backend abstraction.

Instead, Studio should expose a backend-neutral runtime service with provider adapters:

```text
Browser UI
  -> Studio runtime API
    -> OpenClaw provider
    -> Hermes provider
    -> Vera provider
```

The browser can still use WebSocket streaming from Studio, but the messages should be Claw3D-native runtime events rather than implicitly OpenClaw events.

## Core Adapter Contract

Suggested TypeScript shape:

```ts
export type RuntimeCapability =
  | "agents"
  | "sessions"
  | "chat"
  | "streaming"
  | "agent_roles"
  | "files"
  | "skills"
  | "cron"
  | "approvals"
  | "config"
  | "session_settings";

export type RuntimeEvent =
  | { type: "presence.changed"; agents: RuntimeAgentSummary[] }
  | { type: "session.activity"; sessionKey: string; agentId: string; at: number }
  | { type: "chat.delta"; runId: string; sessionKey: string; text: string; at: number }
  | { type: "chat.final"; runId: string; sessionKey: string; text: string; at: number }
  | { type: "chat.error"; runId: string; sessionKey: string; message: string; at: number }
  | { type: "run.lifecycle"; runId: string; sessionKey: string; phase: "start" | "end" | "error"; at: number }
  | { type: "tool.progress"; runId: string; sessionKey: string; label: string; at: number };

export interface RuntimeProvider {
  readonly id: string;
  readonly label: string;
  getCapabilities(): Promise<Set<RuntimeCapability>>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  listAgents(): Promise<RuntimeAgentSummary[]>;
  listSessions(input?: { agentId?: string }): Promise<RuntimeSessionSummary[]>;
  getSessionPreview(keys: string[]): Promise<RuntimeSessionPreview[]>;
  sendChat(input: { sessionKey: string; message: string; agentId?: string }): Promise<{ runId: string }>;
  abortRun(input: { runId?: string; sessionKey?: string }): Promise<void>;
  waitForRun(input: { runId: string; timeoutMs?: number }): Promise<"running" | "done">;
}
```

Optional features such as config editing, approvals, files, skills, and cron should sit behind capability checks instead of being assumed to exist.

## Capability Matrix

Initial expected support:

| Capability | OpenClaw | Hermes | Vera |
|---|---|---|---|
| Agents | Native | Native | Provider-defined |
| Sessions | Native | Native | Provider-defined |
| Chat send/abort/wait | Native | Native | Native via orchestrator |
| Streaming | Native | Native | Native |
| Agent roles | Native-ish | Native | Native |
| Files | Native | Partial | Optional |
| Skills | Native | Native | Optional |
| Cron | Native | Native | Optional |
| Approvals | Native | Partial | Optional |
| Config mutation | Native | Limited | Limited |

Important rule:

If a provider does not support a surface, Claw3D should disable or hide the UI for it. It should not fake a successful write.

## Provider Strategy

### OpenClaw Provider

Use the existing gateway client as the first provider implementation.

This keeps current behavior working while the rest of the app migrates to the adapter contract.

### Hermes Provider

Preferred order:

1. ACP for session-aware agent orchestration.
2. Hermes API server for OpenAI-compatible chat and streaming.
3. OpenClaw-protocol shim only as a temporary bridge.

Rationale:

- ACP is a better semantic fit for sessions, cancellation, fork/resume, approvals, and editor-style state.
- The Hermes API server is already stable and useful for chat, tool calling, and cron-backed service behavior.
- The OpenClaw shim should be treated as transitional compatibility, not the permanent contract.

### Vera Provider

Target the Vera orchestrator, not individual `vera-torch` workers.

Use:

- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/contracted-completions`
- `GET /health`
- `GET /state`
- `GET /registry`

The Vera provider should map Claw3D agent identities to routed roles or lanes rather than pretending Vera is an OpenClaw gateway.

## Event Model

Current Claw3D expects OpenClaw-flavored `chat`, `agent`, and `presence` events.

That is too narrow for universal providers. Studio should normalize provider-native updates into a Claw3D event model with explicit semantics:

- `presence.changed`
- `session.activity`
- `chat.delta`
- `chat.final`
- `chat.error`
- `run.lifecycle`
- `tool.progress`

Then the browser UI can consume one stable event shape no matter what backend is in use.

## High-Value PR Split

Recommended implementation order:

### PR 1: Runtime Abstraction

Scope:

- Introduce the provider interface.
- Wrap current OpenClaw behavior in an `openclaw` provider.
- Move capability checks into the UI state layer.
- Add a Studio-level runtime event normalization layer.

This is the most important PR.

### PR 2: Safe UX Cherry-Picks From PR #70

Scope:

- Agent `role` in store and office UI.
- Click-to-chat.
- Streaming speech bubbles.

These are good product improvements and do not require committing to the Hermes shim architecture.

### PR 3: Hermes Native Provider

Scope:

- Add a `hermes` provider using ACP where possible.
- Use Hermes API server for chat/streaming surfaces.
- Expose capabilities honestly.
- Persist and surface real timestamps from Hermes session/message state.

Keep the shim optional for compatibility, not required.

### PR 4: Vera Provider

Scope:

- Add a `vera` provider against the Vera orchestrator.
- Map Claw3D agents to Vera roles or lanes.
- Surface orchestrator state and routed worker identity.

### PR 5: Optional Compatibility Layer Cleanup

Scope:

- Retire or reduce the Hermes OpenClaw shim.
- Convert shim-only routes into provider-native routes where possible.

## Near-Term Guidance For Luke

If Luke wants "drop-in Hermes support right now", PR #70 is directionally useful.

If Luke wants "Claw3D should support any backend cleanly", PR #70 should not be the mainline architecture.

Best compromise:

- Do not merge PR #70 as the final backend architecture.
- Split out the UI improvements and any safe Hermes-specific pieces.
- Open a new architecture PR for the runtime provider seam.
- Rebase Hermes integration on top of that seam.

## Why This Also Helps Vera

This path avoids making Vera imitate OpenClaw.

Instead, Vera can appear as:

- a routed multi-role intelligence backend,
- with Claw3D visualizing agents, runs, status, and streamed text,
- while preserving Vera-specific routing, lane, and model identity.

That gives Claw3D a broader identity:

- similar to the OpenClaw ecosystem,
- but not subordinate to OpenClaw's protocol and assumptions.

## Proposed First Deliverable

The first concrete deliverable should be a new PR that does only this:

- add the provider interface,
- wrap existing OpenClaw integration behind it,
- add capability flags,
- make the UI stop assuming config/approval/file support from every backend.

That PR creates the seam both Hermes and Vera need.
