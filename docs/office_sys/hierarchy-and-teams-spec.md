# Hierarchy And Teams Spec

> Sixth concrete office-system feature for Claw3D, turning visible office roles into an actual organizational model for delegation, permissions, and team coordination.

## Goal

Add a hierarchy and teams system so the office can express:

- who leads
- who reports where
- who can delegate
- who can approve
- who belongs to which team

The goal is to move from "a group of agents in one room" to "an actual organization with structure".

## Product Position

Hierarchy and teams should not exist only as labels.

They should affect:

- delegation
- review authority
- meeting participation
- bulletin/whiteboard authorship weight
- task routing
- desk progression meaning

This is the organizational layer that sits above desks and departments.

## Why This Feature Matters

Without hierarchy, all agents are peers by default.

That creates limits:

- delegation feels flat
- responsibility is ambiguous
- review authority is unclear
- the office lacks believable structure

Hierarchy and teams solve that by giving the office:

- reporting lines
- ownership boundaries
- authority surfaces
- coordination lanes

## Core Principle

Keep hierarchy operational, not theatrical.

Do not start with elaborate roleplay.

Start with real organizational questions:

- who can assign work?
- who can review work?
- who can call meetings?
- who can finalize outcomes?
- which agents belong together?

## Suggested Role Model

Recommended role classes:

- `owner`
- `executive`
- `manager`
- `lead`
- `member`
- `contractor`
- `intern`

These role classes are about authority and org structure.

They are distinct from:

- desk tier
- functional specialty
- department

### Owner

Characteristics:

- human-controlled top authority
- final signoff for high-impact actions
- can override structure

### Executive

Characteristics:

- broad office-level coordination
- can set direction across teams

### Manager

Characteristics:

- owns a team or department lane
- routes work
- coordinates reviews and meetings

### Lead

Characteristics:

- technical or functional authority inside a team
- can delegate and review

### Member

Characteristics:

- standard contributor role
- executes work inside team scope

### Contractor

Characteristics:

- scoped contributor
- limited authority outside assigned work

### Intern

Characteristics:

- low-authority contributor
- learning / supervised mode

## Team Model

Teams should be explicit groups, not only emergent behavior.

Suggested examples:

- Platform
- Frontend
- QA
- Research
- Ops
- Design

Suggested V1 shape:

```ts
type TeamId = string;

type OfficeTeam = {
  id: TeamId;
  name: string;
  description?: string;
  leadAgentId?: string | null;
  managerAgentId?: string | null;
  memberAgentIds: string[];
  departmentId?: string | null;
};
```

## Hierarchy Model

Suggested V1 shape:

```ts
type OfficeHierarchyRole =
  | "owner"
  | "executive"
  | "manager"
  | "lead"
  | "member"
  | "contractor"
  | "intern";

type AgentHierarchyProfile = {
  agentId: string;
  role: OfficeHierarchyRole;
  reportsToAgentId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  canDelegate?: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  canCallMeetings?: boolean;
};
```

The exact flags can be derived from role later.

V1 can store them explicitly for clarity if needed.

## Relationship To Desk Progression

Desk progression expresses maturity and capability in a physical way.

Hierarchy expresses authority and organizational position.

These should be related, but not identical.

Examples:

- a senior desk does not automatically make an agent a manager
- a contractor may have a strong workstation but still limited authority
- a lead may have more coordination authority than a senior member

That separation matters.

## Relationship To Departments

Departments are organizational domains.

Examples:

- Engineering
- QA
- Research
- Ops

Teams live inside or alongside departments.

Examples:

- Engineering -> Frontend Team
- Engineering -> Platform Team
- QA -> Release Team

Hierarchy determines authority.
Departments determine domain.
Teams determine working group.

## Relationship To Meetings

Hierarchy should affect meetings in practical ways.

Examples:

- managers or leads can call planning meetings
- review meetings may require a lead or manager present
- interns may attend but not finalize decisions
- executives may approve office-wide changes after summary

This gives meetings more structure without overcomplicating V1.

## Relationship To QA

Hierarchy should influence QA responsibility.

Examples:

- leads can review work
- managers can route items into QA
- members can request review
- interns more often require review
- owners/executives can override final readiness decisions when needed

QA should remain operationally distinct, but authority should not be flat.

## Relationship To Bulletin Board / Whiteboard

Hierarchy can shape information flow.

Examples:

- high-priority office announcements may come from leads/managers
- planning whiteboards may identify team ownership
- bulletin cards can show team and owner context

Important:

Do not hide information behind hierarchy.

Use hierarchy to improve clarity, not to make the office opaque.

## Delegation Model

Hierarchy becomes most useful when it changes delegation behavior.

Suggested operational rules:

- owners, executives, managers, and leads can delegate
- members can hand off but not broadly route work across the org
- contractors delegate only within limited scope
- interns usually cannot delegate except in restricted workflows

This should be represented both:

- in UI
- in agent-facing behavior and constraints where appropriate

## Visual Expression

Hierarchy should have visible but restrained expression in the office.

Examples:

- title/subtitle on agent nameplate
- seat/desk placement
- room proximity to planning areas
- meeting table positioning
- desk quality in combination with progression

The office should communicate structure without turning into a caricature.

## Human Interaction Model

The human should be able to:

- assign hierarchy role
- assign team
- set reporting line
- move agents between teams
- understand what organizational changes actually affect

This should be editable and transparent.

## Agent Interaction Model

Longer term, agents may:

- recommend reassignments
- request escalation
- request specialist support from another team
- suggest promotions or org changes

V1 does not need autonomous re-org behavior.

V1 should focus on:

- clear structure
- delegation paths
- UI visibility

## V1 Scope

Recommended V1 scope:

- explicit hierarchy role per agent
- explicit team membership
- simple reporting line
- visible title/subtitle
- delegation and meeting authority rules at a lightweight level

Keep V1 small enough that it improves office understanding immediately.

## Storage Model

Suggested shape:

```ts
type OfficePreference = {
  hierarchy?: {
    byAgentId: Record<string, AgentHierarchyProfile>;
    teams: OfficeTeam[];
    updatedAt?: string;
  };
};
```

This keeps the feature local, backend-neutral, and easy to evolve.

## Out of Scope For V1

Do not include these initially:

- automatic org chart optimization
- political simulation
- compensation/economy systems
- punitive management mechanics
- heavy workflow bureaucracy

The system should clarify work, not create needless friction.

## Implementation Strategy

Recommended order:

1. Define hierarchy profile and team schema.
2. Add office-level persistence.
3. Add UI for role/team assignment.
4. Show titles/subtitles and team membership in office/agent UI.
5. Apply lightweight authority rules to delegation and meeting actions.

## Existing Code Seams

This feature should likely align with:

- role/title flow already added for agents
- desk progression data and UI
- meeting room workflows
- QA routing
- bulletin board ownership/priority metadata

This is important because hierarchy should unify other office systems rather than stand apart from them.

## Success Criteria

V1 is successful if:

- the office can represent who leads and who belongs where
- delegation and review paths are clearer
- titles/teams are visible in the office
- hierarchy affects at least a small set of real office behaviors
- the system remains understandable and editable

## Future Extensions

Once V1 is stable, follow-up work can add:

- org chart views
- department dashboards
- automatic escalation paths
- team-specific meeting rituals
- richer approval chains
- promotion recommendations

## Summary

Hierarchy and teams should give Claw3D a real organizational model.

That model should support delegation, ownership, and coordination without losing the clarity and playfulness of the office metaphor.
