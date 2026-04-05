# Agent State Model Spec

> Seventh concrete office-system feature for Claw3D, formalizing operational agent states before any deeper simulation or affective layer is introduced.

## Goal

Add a public, office-visible agent state model that explains how an agent is currently operating.

The state model should answer:

- what is this agent doing right now?
- are they available?
- are they blocked?
- are they overloaded?
- should the office route more work to them?

This state model should be understandable to users and stable across backends.

## Core Principle

Start with operational states, not emotional roleplay.

That means the visible model should describe work conditions such as:

- focused
- idle
- blocked
- overloaded
- waiting
- recovering
- degraded

The office should show states that are useful for coordination.

Any richer or more proprietary internal signal stack can feed these states later, but should not be required to understand them.

## Why This Matters

Claw3D already visualizes activity, presence, and meeting participation.

What is still missing is a reliable office-wide language for work condition and agent load.

A proper state model would improve:

- delegation
- meeting routing
- desk progression meaning
- team visibility
- office atmosphere

It also gives a clean place for future internal state systems to map into.

## Product Position

The agent state model is:

- a public coordination surface
- not a hidden internal metric system
- not a mood simulator in V1

It should help the user make decisions quickly.

## Recommended Visible States

Suggested initial state set:

- `idle`
- `focused`
- `working`
- `waiting`
- `blocked`
- `overloaded`
- `recovering`
- `degraded`
- `meeting`
- `error`

### Idle

The agent is available and not actively engaged in a task.

### Focused

The agent is actively working and should not be interrupted casually.

### Working

The agent is doing normal active work without special load concerns.

### Waiting

The agent is paused on a dependency, approval, or external result.

### Blocked

The agent cannot make forward progress because a required condition is missing.

### Overloaded

The agent has too much work, too much context pressure, or too many active demands.

### Recovering

The agent has recently completed intense work or a failure state and should stabilize before taking more on.

### Degraded

The agent is operational but impaired in quality, speed, or confidence.

### Meeting

The agent is participating in a coordination workflow and is temporarily occupied there.

### Error

The agent encountered a concrete failure or unrecoverable problem and needs attention.

## Relationship To Existing Presence

Claw3D already uses simpler presence states such as:

- idle
- working
- meeting
- error

This spec should extend that concept rather than replace it abruptly.

The new states should be layered so older/fallback providers can still map into the simpler model.

## Public vs Internal State

This distinction matters.

### Public State

What Claw3D shows in the office:

- stable
- understandable
- backend-neutral
- useful for coordination

### Internal State

What a stack like Vera might use internally:

- latent regime
- coherence
- confidence or control signals
- advanced routing/load heuristics

Internal state can be richer.

Public state should remain simpler and more durable.

## Suggested Mapping Model

Recommended structure:

```ts
type OfficeAgentState =
  | "idle"
  | "focused"
  | "working"
  | "waiting"
  | "blocked"
  | "overloaded"
  | "recovering"
  | "degraded"
  | "meeting"
  | "error";

type AgentStateReason =
  | "task_active"
  | "approval_pending"
  | "dependency_wait"
  | "meeting_active"
  | "high_load"
  | "recent_failure"
  | "runtime_signal"
  | "manual_override"
  | "unknown";

type OfficeAgentStateSnapshot = {
  state: OfficeAgentState;
  reason: AgentStateReason;
  updatedAt: string;
  note?: string | null;
  confidence?: number | null;
};
```

The `reason` is important because it prevents the state from feeling arbitrary.

## V1 Derivation Rules

The first version should use straightforward observable signals.

Examples:

- active run -> `working` or `focused`
- pending approval -> `waiting`
- unresolved dependency or explicit blocker -> `blocked`
- too many simultaneous demands -> `overloaded`
- active standup/meeting -> `meeting`
- recent hard failure -> `error` or `degraded`
- no recent work -> `idle`

This gives immediate utility without needing a deeper cognitive model.

## Relationship To Other Office Systems

### Meetings

Meeting participation should temporarily dominate many other states.

Example:

- a focused agent who joins a standup becomes `meeting` while the meeting is active

### Bulletin Board

The bulletin board should be able to surface meaningful state changes.

Examples:

- "Alice blocked waiting on approval"
- "Bob overloaded during release push"
- "Hermes degraded after provider failure"

### Whiteboard

Planning workflows can use state to decide:

- who is available
- who should not be interrupted
- who is the right candidate for next actions

### QA Department

QA and state should influence each other.

Examples:

- repeated QA failures may push an agent or workflow into `degraded`
- review-ready but approval-blocked work can show `waiting`

### Desk Progression / Hierarchy

More mature roles may tolerate:

- more context
- more delegation
- higher review authority

But the visible state model should still be shared across all roles.

## Visual Expression

States should be visible in restrained ways.

Examples:

- nameplate subtitle or badge
- desk lighting/accent
- movement pacing
- speech bubble framing
- office panel badges

Examples by state:

- `focused`: sharper or brighter work signal
- `waiting`: subdued idle with pending marker
- `blocked`: warning tone
- `overloaded`: high activity / stress marker
- `meeting`: meeting-specific signal
- `degraded`: weakened signal, slower feel

Keep the visual language readable, not noisy.

## Human Interaction Model

The human should be able to:

- see current state
- understand why the state was chosen
- optionally override state in limited cases

The user should not have to guess what "degraded" or "blocked" means.

## Provider / Backend Considerations

Different runtimes will expose different levels of insight.

That is fine.

The public state model should support:

- direct provider-native state
- derived state from Claw3D activity
- optional custom stack enrichments

This is especially important for:

- OpenClaw
- Hermes
- Demo mode
- future custom providers

## Vera / Coherence / Latent-Regime Compatibility

This spec intentionally leaves room for deeper internal models without exposing them directly.

Good future pattern:

- internal stack computes richer latent regime / coherence / workload state
- adapter maps that into public office states
- Claw3D shows the public office state plus optional note/reason

This preserves:

- clean UX
- backend neutrality
- proprietary implementation freedom

## V1 Scope

Recommended V1 scope:

- define expanded office agent state enum
- derive state from observable office/runtime signals
- surface state in UI and office visuals
- show a short reason or note when helpful

Do not build the full simulation layer yet.

## Out of Scope For V1

- emotional simulation
- arbitrary personality modeling
- hidden scoring systems shown as fake moods
- deep physiological metaphors

Those can come later if they remain useful and readable.

## Implementation Strategy

Recommended order:

1. Define public state model and reason codes.
2. Add derivation rules from current runtime/task/meeting signals.
3. Update office visuals and badges.
4. Add optional state note/reason surfaces.
5. Leave room for future provider-specific enrichments.

## Existing Code Seams

This should likely align with:

- current office presence/state handling
- runtime event bridge and latest-update logic
- standup meeting state
- task and approval signals
- office visual systems

## Success Criteria

V1 is successful if:

- users can tell what condition each agent is in
- state changes help routing and coordination
- the model works without any proprietary backend
- the design still leaves room for richer future internal stacks

## Summary

The agent state model should become the office’s shared language for work condition.

It should be simple enough to understand immediately, but structured enough to accept richer future inputs from advanced runtime stacks.
