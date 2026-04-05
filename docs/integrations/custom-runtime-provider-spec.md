# Custom Runtime Provider Spec

> Generic extension seam for non-OpenClaw, non-Hermes stacks.

## Goal

Define a clean `custom` runtime provider class for Claw3D.

This provider should let external orchestration stacks integrate with Claw3D through a stable seam without requiring:

- OpenClaw emulation
- Hermes-specific semantics
- named first-class core support for every stack

The idea is:

- upstream concept: `custom` provider
- downstream implementations provide their own runtime behavior against that seam

## Current Branch Status

On `dev/vera_lane`, the `custom` provider is no longer just a design
placeholder.

Current implemented behavior:

- `custom` is a first-class provider ID in the runtime seam
- Studio persists the selected backend mode as `custom`
- the provider exposes runtime metadata such as `runtimeName`, `vendor`,
  `runtimeVersion`, and `routeProfile` when available
- Claw3D probes `GET /health`, `GET /state`, and `GET /registry`
- chat uses a direct HTTP path to `POST /v1/chat/completions`
- browser traffic is proxied through Claw3D's same-origin
  `/api/runtime/custom` route instead of calling the runtime directly

Still intentionally missing in this branch:

- normalized streaming event support
- richer session persistence beyond the synthetic provider session layer
- direct approvals/files/cron surfaces
- process auto-launch from Studio

## Why This Matters

Not every useful runtime should have to become a named built-in provider in upstream Claw3D.

A clean custom provider seam gives:

- extensibility
- lower upstream friction
- room for proprietary or stack-specific orchestration
- a path for advanced internal systems without polluting core abstractions

This is especially important when a stack is:

- internal
- organization-specific
- experimental
- orchestration-heavy

## Product Position

The `custom` provider should be treated as:

- a first-class extension seam
- not a hack
- not a vendor-specific side path

This is the upstream-safe abstraction.

## Relationship To Existing Provider Work

Claw3D’s runtime abstraction already points toward multiple providers:

- `openclaw`
- `hermes`
- future providers

The `custom` provider should sit alongside those as a generic lane for:

- external orchestrators
- private agent stacks
- organization-specific routing systems

## Core Principle

Do not leak implementation-specific internal logic into the generic provider contract.

The provider should expose:

- common runtime behaviors
- provider capabilities
- normalized events
- optional metadata

It should not require upstream Claw3D to know:

- runtime-specific routing internals
- proprietary state logic
- private planning models
- stack-specific heuristics

## Provider Identity

Suggested provider IDs:

- `openclaw`
- `hermes`
- `custom`

Then allow custom metadata such as:

```ts
type CustomRuntimeDescriptor = {
  providerId: "custom";
  runtimeName: string;
  runtimeVersion?: string | null;
  vendor?: string | null;
  capabilities?: string[];
};
```

This gives Claw3D enough identity for UI without hardcoding a brand into the provider class.

## Reference Implementation Strategy

The `custom` provider should exist as a generic extension seam.

That means:

- upstream Claw3D gets `custom`
- downstream stacks supply their own behavior
- others can later implement their own custom providers against the same seam

That is much easier to justify upstream than:

- adding a deeply stack-specific built-in provider before the generic extension seam exists

## Suggested Contract Shape

This should align with the existing runtime abstraction, but allow custom metadata.

Example:

```ts
type RuntimeProviderId = "openclaw" | "hermes" | "custom";

type RuntimeProviderMetadata = {
  id: RuntimeProviderId;
  label: string;
  runtimeName?: string | null;
  runtimeVersion?: string | null;
  vendor?: string | null;
};
```

The `custom` provider should still implement the same base runtime methods:

- list agents
- list sessions
- send chat
- abort run
- wait for run
- stream normalized events
- expose capabilities honestly

## Capability Philosophy

The custom provider should be capability-driven, not assumption-driven.

That means if a custom stack supports:

- roles
- approvals
- files
- cron
- whiteboard integration
- meeting signals

it should declare those clearly.

If it does not, the UI should degrade honestly.

## Event Model

The custom provider should emit the same normalized event categories as other providers.

Examples:

- `presence.changed`
- `session.activity`
- `chat.delta`
- `chat.final`
- `chat.error`
- `run.lifecycle`
- `tool.progress`

This keeps Claw3D stable even if the custom stack has richer private event semantics internally.

## Custom Metadata Surface

The custom provider may optionally expose richer metadata for display.

Examples:

- routed lane
- active model id
- strategy label
- execution mode
- custom stack status

Important:

This metadata should be additive and optional.

It should not change the core runtime contract.

## Reference Implementation Model

A custom provider can reasonably map:

- agents -> routed roles / lanes
- sessions -> runtime conversations
- streaming -> orchestrator or gateway output streams
- provider metadata -> runtime name, lane, model, or route state

The public upstream concept remains `custom`.

Implementation-specific mapping stays in the runtime layer.

## Relationship To Agent State Model

The custom provider is the right place for richer internal state to enter Claw3D.

For example:

- a custom runtime computes deeper control or state signals
- the provider maps them into public office states

This keeps:

- internal intelligence private
- public office state understandable

## Relationship To Office Systems

The custom provider should be able to support office systems without Claw3D needing to know the backend’s internals.

Examples:

- bulletin board gets agent/session/task context
- whiteboard gets planning-session context
- meetings get coordination state
- QA gets review or readiness metadata

Again, the custom provider should expose only what the office needs.

## V1 Scope

Recommended V1 scope:

- define `custom` provider identity
- allow custom provider metadata
- ensure capability-driven UI behavior
- make no runtime-specific assumptions in core Claw3D

Actual runtime adapters can be implemented separately against that seam.

## Out of Scope For V1

- embedding proprietary internal orchestration logic in Claw3D core
- hardcoding any one runtime as upstream architecture
- requiring all custom providers to support advanced signals

The point is generic extensibility first.

## Implementation Strategy

Recommended order:

1. Add `custom` as a first-class runtime provider identity.
2. Add a metadata surface for runtime name/vendor/version.
3. Ensure the provider factory supports `custom`.
4. Keep the runtime event and capability model normalized.
5. Implement Vera as the first reference adapter outside the generic contract.

## Success Criteria

This spec is successful if:

- upstream Claw3D gains a clean extension seam
- Vera can integrate without bloating core architecture
- future stacks can follow the same pattern
- the office systems continue to work against normalized runtime behavior

## Summary

The `custom` runtime provider is the right upstream abstraction for stack-specific orchestrators.

It gives Claw3D extensibility, gives Vera a clean path in, and avoids hardwiring a personal stack directly into the core product model.
