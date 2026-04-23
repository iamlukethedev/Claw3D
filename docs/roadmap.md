# Roadmap

This file captures the near-term direction for Claw3D so outside contributors can find work that aligns with current priorities.

## Now

- Open-source readiness: documentation, support routes, CI, disclosure files, and public-safe defaults.
- Runtime reliability: making gateway event handling, history reconciliation, and transport-specific recovery more predictable.
- Office architecture clarity: keeping the office intent layer centralized and reducing ad hoc room-specific behavior.

## Next

- Converge the immersive office and builder stack on a clearer shared model.
- Replace or fully clear unresolved bundled assets and dependency licensing risks.
- Improve security posture around Studio access bootstrap and runtime token handling.
- Expand runtime profiles from the new shared `agents.message` / `agents.handoff` contract into fuller provider adapters and richer multi-agent handoff flows.

## Later

- Broader office authoring workflows and richer world-building tools.
- Better contributor automation, release process, and publication tooling.
- More immersive agent/system surfaces that build on the existing office intent and runtime event model.

## Product Ideas To Reduce OpenClaw Dependency

- Expand the new agent wizard into reusable agent templates and presets, building on the existing playbook templates, onboarding flow, and agent creation steps.
- Turn the current onboarding and connection experience into a fuller workspace setup wizard that validates gateway access, permissions, local-vs-remote behavior, and common integrations in one place.
- Add a first-class heartbeat builder that unifies scheduled automations, `HEARTBEAT.md`, and related defaults into one guided UI instead of splitting that setup across multiple surfaces.
- Add a fleet-level tool access matrix with bulk controls so users can manage agent permissions and allowed tools across the whole office instead of one agent at a time.
- Add a shared user profile center that can manage and optionally sync `USER.md` defaults across multiple agents, rather than editing each agent independently.
- Add a real agent inbox and task queue that goes beyond the current results/inbox surfaces and lets users assign, retry, and route work between agents.
- Add a dedicated health dashboard that brings gateway status, failed runs, heartbeat issues, missing dependencies, and integration problems into one operational view.
- Add a broader prompt and playbook library on top of the current playbook template foundation so users can save, browse, and reuse recurring workflows more easily.
- Add visual office automation features that let users configure recurring behaviors and room-based actions directly from the office instead of relying on lower-level gateway concepts.
- Add an agent relationships and communication map so users can configure which agents collaborate, hand off work, or talk to each other without editing raw configuration.
- Add shared memory management for cross-agent context, since the current experience only exposes per-agent `MEMORY.md`.
- Add multi-agent orchestration and handoff workflows for common sequences such as PM -> Engineer -> QA, with explicit UI instead of relying on manual coordination.
- Add config diff and rollback tools so gateway-wide changes can be reviewed and safely reverted from Claw3D.
- Add conversation-to-agent bootstrap flows that can turn a successful chat or office interaction into a reusable new agent.
- Add a richer scenario simulator that extends the current mock phone/text scenarios into broader multi-agent rehearsal and testing flows.

## Already In Progress Or Partially Covered

- Skill installer compatibility checks already exist and should be expanded rather than reinvented.
- Playbook templates, scheduled automations, and onboarding flows already cover part of the templates/setup story.
- Per-agent capability controls and tool settings already exist, but not yet as a fleet-wide matrix.
- Analytics, connection status, and office activity surfaces already cover part of the future health dashboard story.
- The office builder, immersive office, and event-triggered behavior already cover part of the visual automation story.
- Runtime profiles now preserve separate per-backend URLs and tokens for gateway-style and direct-runtime slices.

## Good First Contribution Areas

- Documentation and developer-onboarding fixes.
- Focused unit-test additions around runtime workflows or office intent behavior.
- Small UI polish issues that stay inside one feature area.
- Replacing stale examples, placeholder text, or internal-only assumptions in public docs.

## Before Starting Bigger Work

- Read `README.md`, `CODE_DOCUMENTATION.md`, and `KNOWN_ISSUES.md`.
- Prefer opening or linking a GitHub issue before large architectural changes.
