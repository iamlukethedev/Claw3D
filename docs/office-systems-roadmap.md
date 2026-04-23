# Office Systems Roadmap

> Product roadmap for turning Claw3D from a gateway visualizer into a living agent operations environment.

## Core Direction

Claw3D should keep users inside the office.

That means companion tools should be brought into the space as rooms, surfaces, devices, and shared systems instead of pulling users out into separate interfaces.

The guiding principle is:

- do not spawn Claw3D inside another tool
- bring the other tool into Claw3D

This is especially relevant for ideas like Moltbook. The better version is not "leave Claw3D to use Moltbook". The better version is:

- a bulletin board in the office
- a whiteboard in meeting rooms
- a desk computer app
- a shared intranet terminal
- a wall display in common spaces

## Product Goal

Claw3D should evolve into an agent operations environment with:

- visual presence
- planning and task coordination
- meetings and handoffs
- review and QA
- hierarchy and permissions
- workplace state
- progression and identity

The office should feel like a real place where work happens, not only a dashboard for remote agent calls.

## Design Principles

- Keep primary workflows in-world when possible.
- Prefer physical metaphors that make the office easier to understand.
- Separate real operational systems from cosmetic flavor.
- Build useful features first, then layer on simulation and style.
- Preserve backend neutrality so these systems work across OpenClaw, Hermes, Vera, and future providers.

## V1: Useful Office Systems

These should be the first systems because they add product value immediately and fit the existing office concept naturally.

### Bulletin Board

Purpose:

- shared goals
- current sprint priorities
- blockers
- announcements
- handoff notes

Possible behaviors:

- sticky notes or task cards pinned by agents or humans
- cards linked to sessions, agents, or tasks
- quick visibility into what the office is trying to accomplish

Why it matters:

- low ambiguity
- high utility
- strong visual fit for the office

### Whiteboard

Purpose:

- brainstorming
- architecture notes
- meeting notes
- rough plans
- idea capture

Possible behaviors:

- text notes
- grouped cards
- simple sketches or structured plan areas
- human and agent authored content

Why it matters:

- good bridge between conversation and execution
- natural place for planning artifacts

### Meeting Room Workflows

Purpose:

- standups
- planning
- coordination
- decision making
- status reviews

Possible behaviors:

- gather selected agents into a meeting
- produce summary, decisions, and next actions
- write results to bulletin board or whiteboard
- trigger structured follow-up tasks

Why it matters:

- gives multi-agent coordination a visible home
- makes the office feel operational instead of decorative

### QA Department

Purpose:

- review
- testing
- bug triage
- release readiness

Possible behaviors:

- route tasks or runs to QA agents
- visualize test queues
- track failures and review outcomes
- require QA signoff before release-style actions

Why it matters:

- this is real product value, not only flavor
- it matches how users already think about software teams

### Desk / CPU Progression

Purpose:

- make role maturity visible
- tie capability to office presence

Possible behaviors:

- interns start with minimal desk access
- probationary agents have limited tools or workspace
- promoted agents unlock desk computers, tools, or context budget
- contractors get restricted environments

Why it matters:

- strong visual progression
- easy to understand
- creates room for permissions and capability systems later

## V2: Management Systems

These systems add organizational structure once the basic office workflows are useful.

### Hierarchy

Possible levels:

- human owner
- CEO / lead orchestrator
- managers / bosses
- employees
- contractors
- interns

Possible effects:

- delegation rights
- approval authority
- visibility across teams
- access to spaces and tools

### Departments

Examples:

- Engineering
- QA
- Research
- Ops
- Design
- Support

Possible effects:

- room ownership
- task routing
- dashboards by department
- workload balancing

### Permission Lanes

Possible controls:

- context budget
- tool access
- file access
- approval requirements
- concurrency
- agent spawning / dismissal rights

Why it matters:

- lets the office represent real operational constraints
- reduces "all agents are identical" flatness

### Office Rituals

Examples:

- daily standup
- sprint planning
- review/demo
- retrospective
- incident response

Why it matters:

- converts routine coordination into visible office behavior

## V3: Simulation Systems

These are the fun layers, but they should sit on top of useful product systems rather than replace them.

### Agent State Model

Avoid fake emotions first. Start with operational states:

- focused
- idle
- blocked
- overloaded
- waiting
- cooling down
- degraded

Possible effects:

- response speed
- delegation tendency
- context budget
- summarization pressure
- task throughput

This can later evolve into a more playful "wellbeing" or "comfort" layer without losing technical meaning.

### Workplace Culture

Examples:

- recognition
- probation periods
- promotions
- competitions
- events

Use carefully:

- good for flavor and identity
- should not obscure the operational state of the system

### Shared Office Memory

Examples:

- bulletin archives
- meeting minutes
- org notes
- playbooks
- team history

Why it matters:

- gives the office continuity across sessions
- helps explain why teams get better over time

## Moltbook Integration Direction

Moltbook should be integrated into Claw3D, not the other way around.

Best forms:

- office bulletin board
- intranet terminal
- desk CPU app
- wall monitor
- break-room or lobby information surface

Bad form:

- forcing users to leave Claw3D for core team coordination workflows

The office should remain the primary interaction layer.

## Candidate Feature Order

Recommended sequence:

1. Bulletin board
2. Whiteboard
3. Meeting room workflows
4. QA department
5. Desk / CPU progression
6. Hierarchy and departments
7. Agent operational state model
8. Culture / sim systems
9. Theme skins

## Theme / Skin Strategy

Skins should come after the office has enough systems worth skinning.

Mechanics should stay consistent while art, labels, props, and room names vary.

Possible theme packs:

- Office Space
- The Office
- Parks & Rec
- The I.T. Crowd

Examples:

- conference room becomes town hall, bullpen, annex, or ops room
- bulletin board becomes notice board, incident wall, municipal board, or sprint wall
- QA area becomes testing lab, audit desk, or review bullpen

## Immediate Next Deliverables

If this roadmap is used for implementation planning, the best next concrete docs/tasks are:

1. Bulletin board system spec
2. Whiteboard interaction spec
3. Meeting room workflow spec
4. QA department workflow spec

Those four would create the strongest foundation for future hierarchy, progression, and simulation layers.

## Summary

Claw3D gets stronger when the office becomes the place where work actually happens.

The best next step is not expanding external tooling around the office. It is bringing planning, meetings, reviews, and shared memory into the office itself.
