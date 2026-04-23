# Desk Progression Spec

> Fifth concrete office-system feature for Claw3D, connecting visible office presence to role maturity, permissions, and capability growth.

## Goal

Add a desk progression system so agents visibly grow from limited office members into more capable contributors.

Desk progression should connect:

- role maturity
- workspace/tool access
- permissions
- office identity
- visible progression in the environment

The goal is not just cosmetics.

The goal is to make office growth legible and meaningful.

## Product Position

Desk progression should be the physical expression of organizational state.

It answers questions like:

- is this agent an intern or a fully trusted contributor?
- what tools can they use?
- how much autonomy do they have?
- how much context or responsibility should they carry?

In other words:

- desk progression = visible capability ladder

## Why This Feature Matters

Without progression, all agents tend to feel flat.

Desk progression creates:

- visible hierarchy without requiring a complex org chart first
- a natural path for permissions and access
- stronger office storytelling
- motivation for role specialization and promotion systems later

It also gives you a much cleaner bridge between:

- abstract policy
- physical office layout
- agent identity

## Core Principle

Do not start with fake game stats.

Start with operational capability tiers that can later gain more playful flavor.

That means progression should first affect:

- tool access
- workspace access
- review requirements
- ability to spawn/delegate
- context budget or workload tolerance

The visual office layer should reflect those operational differences.

## Example Role Ladder

Recommended initial tiers:

- `intern`
- `probation`
- `employee`
- `senior`
- `lead`
- `contractor`

These are examples, not hard-coded lore.

### Intern

Characteristics:

- limited tools
- limited workspace access
- small or shared desk
- requires close oversight

### Probation

Characteristics:

- basic desk
- restricted autonomy
- still under review for sensitive actions

### Employee

Characteristics:

- normal desk
- normal task ownership
- standard office access

### Senior

Characteristics:

- stronger autonomy
- wider task scope
- can mentor or review others

### Lead

Characteristics:

- can coordinate others
- can trigger certain meetings
- can manage or route work more broadly

### Contractor

Characteristics:

- useful specialist
- limited long-term authority
- constrained workspace and access model

## Suggested Capability Model

V1 should describe progression in terms of clear capability flags.

Example:

```ts
type DeskTier =
  | "intern"
  | "probation"
  | "employee"
  | "senior"
  | "lead"
  | "contractor";

type DeskCapabilityProfile = {
  tier: DeskTier;
  canUseFileTools: boolean;
  canUseWebTools: boolean;
  canInstallSkills: boolean;
  canRequestApprovalsDirectly: boolean;
  canReviewOthers: boolean;
  canTriggerMeetings: boolean;
  canCreateTasks: boolean;
  canDelegateTasks: boolean;
  workspaceAccess: "none" | "limited" | "standard" | "extended";
  contextBudgetClass: "small" | "normal" | "large";
};
```

The exact values can evolve, but the idea should remain:

- tier drives visible access differences

## Visual Expression

Each tier should map to a clear desk/environment feel.

Examples:

### Intern Desk

- minimal desk
- no dedicated computer or weaker setup
- fewer personal objects
- close to a shared area or support station

### Probation Desk

- basic computer
- little customization
- modest footprint

### Employee Desk

- normal workstation
- standard office setup
- stable identity in the room

### Senior Desk

- expanded desk
- more equipment / screens / references
- visually established presence

### Lead Desk

- premium workstation
- visibility within the office
- closer proximity to planning or meeting surfaces

### Contractor Desk

- temporary station
- portable or isolated feel
- clearly functional but not deeply embedded

## Relationship To Existing Systems

Desk progression should integrate with real Claw3D systems rather than sit beside them.

### Permissions

Claw3D already has permission and approval surfaces.

Desk progression should act as a higher-level office policy layer that influences:

- what defaults an agent gets
- whether sensitive actions need review
- what tools or flows are emphasized

Important:

This does not need to replace existing permission logic.

It should help explain and structure it.

### Workspace Access

Agents already have real workspaces.

Desk progression should help determine:

- how much workspace freedom an agent gets
- whether they operate in restricted or normal modes
- whether some installs or edits require higher tiers

### QA Department

More mature agents can naturally interact differently with QA.

Examples:

- interns more often route into review
- seniors can participate in review
- leads can mark certain work as ready for higher-level signoff

### Meeting Room

Meeting behavior can reflect progression.

Examples:

- leads can call planning meetings
- seniors can present or facilitate review
- interns may attend but not control outcomes

### Bulletin Board / Whiteboard

More mature tiers may:

- author higher-priority office notes
- post official announcements
- create planning documents for others

Again, this should be treated as office behavior, not roleplay for its own sake.

## Promotion / Progression Logic

V1 does not need automatic leveling.

Start with:

- manual assignment
- explicit promotion/demotion
- visible tier on the agent profile

Later, progression can be influenced by:

- successful task completion
- review outcomes
- reliability
- blockers created vs resolved
- trust level

## Suggested Data Model

Example V1 shape:

```ts
type AgentDeskProfile = {
  agentId: string;
  tier: DeskTier;
  assignedDeskUid?: string | null;
  promotedAt?: string | null;
  notes?: string | null;
};
```

Office-level data:

```ts
type OfficePreference = {
  deskProgression?: {
    byAgentId: Record<string, AgentDeskProfile>;
    updatedAt?: string;
  };
};
```

## Human Interaction Model

The human should be able to:

- view an agent’s desk tier
- promote or demote an agent
- reassign desk placement
- understand what the tier changes operationally

This should be clear and reversible.

Do not hide progression behind mystery rules.

## Agent Interaction Model

Agents may later:

- request promotion
- request better tools
- recommend another agent for a role upgrade
- be restricted from actions based on tier

But V1 should not depend on autonomous progression requests.

## V1 Scope

Recommended V1 scope:

- define desk tiers
- persist per-agent desk tier
- show desk tier in UI
- apply visual desk differentiation
- connect tier to a small number of capability differences

Good first capability differences:

- review / approval expectations
- delegation rights
- desk computer presence

## Out of Scope For V1

Do not include these initially:

- hidden progression XP systems
- complex morale simulation
- salary/economy systems
- automatic performance scoring
- punitive systems that make agents unusable

Keep V1 understandable and operational.

## Implementation Strategy

Recommended order:

1. Define desk tier model and profile storage.
2. Add UI for viewing and assigning tier.
3. Add retro-office visual differences by tier.
4. Connect tier to a small capability profile.
5. Surface tier in agent details and office presence.

## Existing Code Seams

This feature should likely align with:

- office desk assignment systems
- agent settings / permissions UI
- approval and policy surfaces
- retro office desk rendering
- office preferences persistence

This matters because progression should feel native to the office, not bolted on.

## Success Criteria

V1 is successful if:

- desk tier is visible and understandable
- the office reflects agent maturity visually
- tier differences have real operational meaning
- the user can promote/demote intentionally
- the system reinforces office identity instead of distracting from it

## Future Extensions

Once V1 is stable, later systems can add:

- promotion ceremonies or office events
- hierarchy-aware desk placement
- department-specific workstation styles
- probation rules
- contractor/offsite variants
- context / workload tuning by tier

## Summary

Desk progression should turn office growth into something visible and operational.

It is the cleanest way to connect hierarchy, permissions, workspace access, and office identity without jumping straight into heavy simulation.
