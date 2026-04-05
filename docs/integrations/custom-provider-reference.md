# Custom Provider Reference

> Reference implementation guide for plugging a non-OpenClaw, non-Hermes runtime into Claw3D through the upstream-safe `custom` provider seam.

## Goal

Show how a custom orchestration stack should plug into Claw3D without requiring:

- a named built-in provider
- OpenClaw emulation
- Hermes adapter semantics

The shape should be:

- Claw3D sees `custom`
- the external runtime stays implementation-specific
- Claw3D core remains generic

## Current Implementation Notes

The current `custom` branch path is deliberately conservative.

What exists today:

- provider selection and metadata flow through the Studio runtime seam
- same-origin runtime proxying through `/api/runtime/custom`
- health, state, and registry probing
- direct chat via `/v1/chat/completions`
- office/bootstrap/chat/model loading routed through the provider layer

What still needs to mature:

- true provider-native streaming
- stronger multi-session persistence semantics
- integration tests against a live custom runtime
- richer office presentation of runtime metadata, lanes, and model identity

## Position

A custom runtime should sit at the Claw3D boundary as an orchestrator-backed service.

That means:

- Claw3D should talk to one stable runtime boundary
- that boundary may route work to internal worker processes, models, or lanes
- those internal details should remain mostly hidden behind the provider

This keeps the integration:

- stable
- upstream-safe
- reusable for multiple custom stacks later

## Why The Custom Provider Exists

Not every useful runtime should need a named upstream provider branch.

Some stacks will be:

- internal
- experimental
- organization-specific
- built around custom orchestration

The `custom` provider exists so those stacks can integrate cleanly without forcing Claw3D core to absorb stack-specific assumptions.

## Recommended Boundary

Claw3D should integrate with the custom runtime's orchestrator or gateway layer, not with its individual workers.

Recommended public boundary:

- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/contracted-completions`
- `GET /health`
- `GET /state`
- `GET /registry`

These do not need to be mandatory for every implementation, but they are a strong reference shape because they provide:

- chat entry points
- reachability
- runtime summary
- model or role registry visibility

## Runtime Shape

Recommended mapping:

```text
Claw3D
  -> custom provider
    -> custom orchestrator / gateway
      -> internal routing
        -> workers / roles / models / tools
```

This means the custom provider should not need to know:

- worker ports
- shard startup semantics
- internal runtime policy
- proprietary state heuristics

It only needs:

- request/response surfaces
- route or session metadata
- health/state/registry metadata

## Provider Identity

Upstream-facing identity should remain:

- `providerId: "custom"`

Implementation-specific identity should appear as metadata, not provider class naming.

Suggested metadata:

```ts
type CustomRuntimeMetadata = {
  id: "custom";
  label: "Custom Runtime";
  runtimeName?: string | null;
  vendor?: string | null;
  runtimeVersion?: string | null;
  routeProfile?: string | null;
};
```

This gives the UI enough identity without forcing upstream Claw3D to branch on every runtime brand.

## Capability Profile

Initial `custom` provider capability claims should be conservative and honest.

Likely V1 support for many custom runtimes:

- `agents`
- `sessions`
- `chat`
- `streaming`
- `agent_roles`
- `config`

Possible later support depending on implementation:

- `files`
- `approvals`
- `skills`
- `cron`
- `session_settings`

Important rule:

Do not claim support just because the backend can theoretically do something. Claim support only where the provider exposes a stable Claw3D-facing behavior.

## Agent Mapping

Claw3D agents should not be modeled as one fixed backend process each unless the runtime truly behaves that way.

Instead, a custom runtime may map agents to:

- roles
- lanes
- strategies
- departments
- routed execution identities

Example office-facing identities:

- `Main`
- `Assistant`
- `Coder`
- `Reviewer`
- `Professor`

The exact labels are implementation-specific.

The important point is that the provider should expose office-meaningful identities rather than leaking raw backend topology.

## Session Mapping

Claw3D sessions should map to runtime conversations or execution threads, not to whichever backend storage structure happens to exist internally.

Recommended session metadata:

- `sessionKey`
- conversation or thread id
- active role
- lane
- requested model
- resolved model
- request id

The provider should normalize these into a stable session model no matter what the backend calls them internally.

## Event Mapping

The provider should translate runtime activity into the same normalized Claw3D runtime events used elsewhere.

Recommended mappings:

- runtime agent change -> `presence.changed`
- conversation/session update -> `session.activity`
- streaming token output -> `chat.delta`
- final assistant turn -> `chat.final`
- routed or backend failure -> `chat.error`
- request lifecycle -> `run.lifecycle`
- tool or workflow progress -> `tool.progress`

Implementation-specific metadata is allowed, but only as additive metadata.

## Route Metadata

Many custom runtimes will have useful execution metadata.

The provider may expose optional metadata such as:

- selected role
- candidate roles
- lane
- routing reason
- registry profile
- resolved model id
- worker or runtime health summary

This metadata should be visible in diagnostics or advanced panels, not required for basic user flow.

## State And Health Surfaces

The custom provider should prefer orchestrator-level health/state queries first.

Recommended usage:

- `/health`
  - basic runtime reachability
- `/state`
  - route profile, active roles, worker/runtime summary
- `/registry`
  - active model, role, or profile catalog

Worker-level status endpoints should stay behind the provider unless the UI needs a diagnostic drill-down.

## Relationship To Agent State

The custom provider is the right place to map richer internal runtime signals into Claw3D's public office state model.

Public office state should remain simple:

- `focused`
- `working`
- `blocked`
- `overloaded`
- `degraded`

Internally, a custom stack may derive those from richer signals such as:

- route stress
- worker saturation
- runtime policy
- confidence or control signals
- proprietary orchestration heuristics

That should remain implementation-private.

Claw3D only needs the resulting office-safe state and maybe a public reason label.

## Relationship To Office Systems

The custom provider should support office systems without Claw3D needing to know the backend's internals.

Examples:

- bulletin board gets agent/session/task context
- whiteboard gets planning-session context
- meetings get coordination state
- QA gets review or readiness metadata

Again, the provider should expose only what the office needs.

## Suggested V1 Scope

Recommended first `custom` provider scope:

1. Reach the custom orchestrator over `/v1/chat/completions`.
2. Pull metadata from `/health`, `/state`, and `/registry`.
3. Map runtime roles or routes into Claw3D agent identities.
4. Surface streaming and final turns.
5. Expose route metadata in a diagnostics-friendly way.
6. Map simple public office states from observable runtime conditions.

This is enough to make a custom runtime useful in Claw3D without overexposing internals.

## Suggested V2 Scope

Once the V1 provider is stable, add:

- richer session persistence
- role-aware office teams
- custom runtime diagnostics panel
- office state enrichment from internal stack signals
- hooks into bulletin board, whiteboard, QA, and meeting systems

## Explicit Non-Goals

This reference should not require:

- runtime-specific branches throughout Claw3D core
- OpenClaw compatibility shims
- routing logic duplicated in the frontend
- direct worker orchestration in the browser

The provider should remain the containment layer.
