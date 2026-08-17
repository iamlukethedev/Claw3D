# Skills in OpenClaw + Hermes3D

This document explains skills from first principles, how they work in the OpenClaw runtime, and how Hermes3D currently exposes them in UX.

It is intended as design context for rethinking the Skills UX.

## 1) Why skills exist (first principles)

Skills are the mechanism OpenClaw uses to give agents reusable operational know-how without hardcoding that know-how into core runtime logic.

At a product level, a skill is:
- A unit of capability guidance (`SKILL.md`) that teaches an agent how to perform a job.
- A gated unit of readiness (only available when required binaries/env/config/OS are satisfied).
- A portable package format compatible with AgentSkills (`agentskills.io`) so skill content can be authored and shared outside a single product.

Without skills, every workflow instruction would need to live in prompts, app code, or ad hoc user messages. Skills create a middle layer: structured capability packs that are discoverable, filterable, and enforceable.

## 2) AgentSkills.io context

OpenClaw intentionally uses AgentSkills-compatible `SKILL.md` structure and semantics.

Why this matters:
- Interoperability: skills can move between ecosystems that understand AgentSkills.
- Community/network effects: external skill ecosystems (for OpenClaw specifically, ClawHub) can be leveraged instead of reinventing proprietary formats.
- UX consistency: users can reason about “a skill folder with `SKILL.md` + metadata gates” instead of app-specific abstractions.

OpenClaw adds product-specific metadata under `metadata.openclaw` (install specs, gating fields, primary env key, etc.) while keeping the base skill shape compatible.

## 3) Skill object model

A skill is loaded from a directory containing `SKILL.md` with frontmatter.

Minimum frontmatter:
- `name`
- `description`

Important optional fields used by OpenClaw:
- `metadata.openclaw.always`
- `metadata.openclaw.skillKey`
- `metadata.openclaw.primaryEnv`
- `metadata.openclaw.os`
- `metadata.openclaw.requires.{bins, anyBins, env, config}`
- `metadata.openclaw.install[]`
- `user-invocable`
- `disable-model-invocation`
- `command-dispatch`, `command-tool`, `command-arg-mode`

In runtime, this becomes a normalized `SkillEntry`:
- Raw skill (`name`, `description`, `source`, file paths)
- Parsed frontmatter
- Resolved OpenClaw metadata
- Invocation policy flags

## 4) Where skills come from (discovery + precedence)

OpenClaw merges multiple sources into one effective skill set.

Current merge precedence in code (lowest -> highest):
1. `skills.load.extraDirs` and plugin-contributed skill dirs (`source: openclaw-extra`)
2. Bundled skills (`openclaw-bundled`)
3. Managed/global local skills (`~/.openclaw/skills`, `openclaw-managed`)
4. Personal agents skills (`~/.agents/skills`, `agents-skills-personal`)
5. Project agents skills (`<workspace>/.agents/skills`, `agents-skills-project`)
6. Workspace skills (`<workspace>/skills`, `openclaw-workspace`)

Name conflicts are resolved by “last writer wins” according to this order.

## 5) Eligibility and gating model

Eligibility is not just “is this skill installed.” It is computed every load/snapshot using:
- Per-skill disable (`skills.entries.<skillKey>.enabled === false`)
- Bundled allowlist (`skills.allowBundled`) for bundled skills only
- Runtime requirements:
  - `requires.bins` (all required)
  - `requires.anyBins` (at least one)
  - `requires.env`
  - `requires.config`
  - `os`
- Remote node eligibility (macOS node bin probing can satisfy certain requirements)
- `always: true` short-circuiting requirement failures

Status output carries:
- `eligible` / `blocked`
- structured `missing` reasons
- `configChecks` with `{ path, satisfied }` (not secret values)
- install options derived from metadata

## 6) Agent-level filtering semantics

OpenClaw has a separate per-agent skill filter via `agents.list[].skills`:
- Missing `skills` key: all discovered skills are allowed
- `skills: []`: no skills allowed
- `skills: ["a", "b"]`: allowlist mode

This filter is normalized and passed into snapshot generation as `skillFilter`.

In practice this is the key UX distinction:
- Discovery/readiness is global + workspace-derived.
- “Can this specific agent use it?” is per-agent allowlist.

## 7) Snapshot + prompt lifecycle

Skills are snapshotted into session state (`skillsSnapshot`) to avoid re-scanning every turn.

Snapshot contains:
- prebuilt prompt block
- lightweight skill metadata (`name`, `primaryEnv`, required env names)
- normalized `skillFilter`
- resolved skills list
- version

Lifecycle:
1. First turn/new session builds snapshot.
2. File watcher / remote-node events bump snapshot version.
3. Later turns refresh snapshot only if version is newer.
4. Prompt injection uses snapshot prompt when present.

Watcher scope includes:
- workspace `skills/`
- workspace `.agents/skills`
- `~/.openclaw/skills`
- `~/.agents/skills`
- configured extra dirs
- plugin skill dirs

Watcher monitors `SKILL.md` patterns (not entire trees) and debounces changes.

## 8) Runtime execution behavior

During an agent run:
1. Skill env overrides are applied (`skills.entries.*.env` + `apiKey` mapping to `primaryEnv`).
2. Overrides are sanitized/guarded (dangerous host env keys blocked).
3. Skills prompt is injected.
4. Environment is restored after run.

Invocation behavior:
- `disable-model-invocation: true` keeps skill out of model prompt.
- `user-invocable: true` exposes slash commands.
- Optional direct tool dispatch can bypass model routing.

Sandbox nuance:
- For non-`rw` sandbox workspaces, OpenClaw syncs skills into sandbox workspace (best-effort) so skill files remain accessible.

## 9) Gateway API surface for skills

Core RPC methods:
- `skills.status` -> returns `SkillStatusReport` for an agent workspace.
- `skills.install` -> installs dependencies for a skill install option.
- `skills.update` -> updates `skills.entries.<skillKey>` config (`enabled`, `apiKey`, `env`).
- `skills.bins` -> aggregates required bins across agent workspaces.

Important scope behavior:
- `skills.install` is executed against the default agent workspace (not arbitrary selected agent workspace).
- `skills.update` writes gateway config (`openclaw.json`) and is gateway-wide state mutation.

Security detail:
- `skills.status` exposes config check satisfaction, not raw secret config values.

## 10) Hermes3D UX (current behavior)

### 10.1 Route and navigation model

Studio settings currently live on root route with a query-driven settings mode:
- Canonical settings state is `/?settingsAgentId=<agentId>`.
- `/agents/[agentId]/settings` currently redirects to that query route.

Left nav tabs in settings mode:
- Behavior
- Capabilities
- Skills
- Automations
- Advanced

### 10.2 Skills tab data and interactions

When either `Skills` or `System setup` tab is active and connected, Studio:
1. Calls `skills.status`.
2. Reads current per-agent allowlist from gateway config (`agents.list[].skills`).
3. Renders two distinct settings surfaces:

`Skills` tab (agent-scoped):
- Shows one list focused on “what this agent can use”.
- Per-skill allow toggle (`Skill <name>` switch) for agent access only.
- Simplified status chips (`Ready`, `Setup required`, `Not supported`).
- Search + status filters for scanning.
- Non-ready rows provide `Open System Setup` instead of inline setup actions.

`System setup` tab (gateway-scoped):
- Explicitly states that setup actions affect all agents.
- Shows setup queue and full readiness details.
- Per-skill `Configure` modal with setup/lifecycle actions:
  - install dependencies (`skills.install`)
  - save API key (`skills.update` with `apiKey`)
  - global enable/disable (`skills.update` with `enabled`)
  - remove removable skill directories via Studio remove route
- Supports transition handoff from agent row to preselected skill setup context.

### 10.3 Mutation wiring from Studio

Per-agent access mutations:
- `updateGatewayAgentSkillsAllowlist` in Studio writes `config.set` with retry-on-stale-hash behavior.
- Agent toggles continue to rely on allowlist semantics (`undefined` means all, explicit array means selected-only).

System setup mutations:
- Install -> `skills.install`
- API key save -> `skills.update`
- Remove files -> Studio route `/api/gateway/skills/remove` (local fs or SSH helper)

Removal has strict guards:
- Only specific sources removable (`openclaw-managed`, `openclaw-workspace`).
- Must stay inside allowed root.
- Cannot remove skills root directory.
- Must look like a real skill dir (`SKILL.md` exists).

### 10.4 Scope warning shown in Studio

Studio computes the default agent id and passes install-scope context into the system setup surface.

Current scope copy behavior:
- `Skills` tab copy states controls apply to the current agent.
- `System setup` tab copy states actions apply to all agents.
- Install target caveat (default-agent workspace behavior) is shown in system setup context and setup modal context, where install actions actually occur.

This keeps scope and install-target warnings accurate while minimizing noise in the agent access flow.

## 11) What recent `.agent/done` plans show

Sorted by most recent creation time in `hermes3d/.agent/done`, the latest items are mostly bugfix exec plans (streaming, proxy auth, stale config, cron rollback, etc.).

The most recent plan with explicit skills direction is:
- `ui-execplan-stuff.md` (2026-02-20 create time), which intentionally scoped skills as coming-soon during that IA pass.

Additional files with incidental skill mentions:
- `simplify-agent-creation-starter-kits.md`
- `ux-zero-agent-layout-consolidation.md`

Interpretation:
- The current Studio code now has a real Skills tab and mutation flow, but the older IA/doc language still contains “coming soon” assumptions in places.
- For redesign, trust current code behavior over older plan phrasing.

## 12) UX redesign constraints that are not optional

Any redesign should preserve these distinctions:

1. Three separate scopes:
- Agent allowlist scope (`agents.list[].skills`)
- Gateway setup scope (`skills.entries.*`, installs)
- Source/discovery scope (workspace/managed/bundled/extra/plugin)

2. Eligibility vs enablement:
- A skill can be enabled by allowlist but still blocked by missing requirements.
- A skill can be eligible but disabled by agent allowlist.

3. Session-snapshot behavior:
- Skills changes may not appear mid-turn; they apply on next turn/snapshot refresh.

4. Install target caveat:
- Install currently targets default agent workspace context in gateway path.

5. Security posture:
- Secret values should never be exposed in status surfaces.
- Removal must stay bounded to allowed roots and verified skill dirs.

## 13) Practical mental model for reviewing a Skills screenshot

If you hand a screenshot to another LLM for UX feedback, ask it to evaluate on three axes:

1. **Scope clarity**
- Can a user tell what is per-agent vs gateway-wide?

2. **Readiness clarity**
- Can a user tell blocked vs eligible and why?

3. **Action safety**
- Are destructive/setup actions clearly separated from allowlist toggles?

If a design fails any of those axes, users will misconfigure skills even if controls are technically correct.
