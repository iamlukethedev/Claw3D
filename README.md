# Claw3D

A 3D workspace for AI agents.

> Unofficial project: Claw3D is an independent community project and is not affiliated with, endorsed by, or maintained by the OpenClaw team. OpenClaw is a separate project, and this repository is not the official OpenClaw repository.

Claw3D turns AI automation into a visual workplace where agents collaborate, review code, run tests, train skills, and execute tasks inside a shared 3D environment.

Built and maintained by LukeTheDev. Follow on X: [@iamlukethedev](https://x.com/iamlukethedev).

Think of it as:

An office for your AI team.

## What you can do with Claw3D

• Watch your AI agents work in real time
• Run standups with agents connected to GitHub and Jira
• Review pull requests from inside the office
• Monitor QA pipelines and logs
• Train agents in the gym to develop new skills
• Reset sessions and clean context with the janitor system

Instead of managing automation through dashboards and logs…

You walk through your AI workplace.

[Vision](VISION.md) · [Architecture](ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## What Claw3D Is

OpenClaw is the intelligence and task-execution layer.

Claw3D is the visualization and interaction layer.

In practical terms, this app gives you:

- a live `/office` retro-office environment where agents appear as workers moving through a shared 3D world
- an `/office/builder` surface for editing and publishing office layouts
- a gateway-first architecture that keeps agent state in OpenClaw while Studio stores local UI preferences

This repository does not build or modify the OpenClaw runtime itself. It is the frontend and proxy layer that connects to an existing OpenClaw Gateway.

## Why It Exists

AI systems are becoming more capable, but their work is still usually hidden behind logs, terminal output, and dashboards.

Claw3D exists to make agent systems visible:

- inspect what agents are doing in real time
- monitor runs, approvals, history, and activity from one place
- interact with agents through chat and immersive UI surfaces
- move toward a world where AI systems are understandable through space, motion, and presence

For the broader direction of the project, see [`VISION.md`](VISION.md).

## What Exists Today

The current app already includes a substantial Claw3D surface:

- Fleet management and agent chat with runtime updates streamed from the gateway.
- Agent creation, settings, session controls, approvals, and gateway-backed configuration editing.
- A 3D retro office with desks, rooms, navigation, animations, and event-driven activity cues.
- Immersive operational spaces for standups, GitHub review flows, analytics, and system monitoring.
- Local Studio persistence for gateway connection details, focused-agent preferences, desk assignments, office state, and related UI settings.
- A custom same-origin WebSocket proxy so the browser talks to Studio, and Studio talks to the upstream OpenClaw Gateway.

## Quick Start

Requirements:

- Node.js 20+ recommended.
- npm 10+ recommended.
- A working OpenClaw installation with a reachable Gateway URL and token.

Prerequisite:

- Claw3D does not install, build, or run OpenClaw for you.
- Before starting Claw3D, make sure your OpenClaw gateway is already running and that you know the gateway URL and token you want Studio to use.
- This repository is the UI and Studio/proxy layer only.
- If you need a full cross-machine setup guide (OpenClaw + Tailscale + Claw3D), follow [`TUTORIAL.md`](TUTORIAL.md).

Run from source:

```bash
git clone <your-public-repo-url> claw3d
cd claw3d
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3000` and configure the gateway URL and token in Studio.

For a local gateway on the same machine, the usual upstream URL is:

```text
ws://localhost:18789
```

## How It Connects

Claw3D uses two separate network hops:

1. Browser -> Studio over HTTP and a same-origin WebSocket at `/api/gateway/ws`.
2. Studio -> OpenClaw Gateway over a second WebSocket opened by the Studio server.

That means `ws://localhost:18789` always refers to the gateway reachable from the Studio host, not necessarily from the browser device.

This design keeps gateway settings persisted on the Studio host and lets Studio open the upstream connection server-side. The current UI still loads the configured upstream URL/token into browser memory at runtime, so treat the browser as part of the active trust boundary.

## Common Setups

### Gateway local, Studio local

1. Start Studio with `npm run dev`.
2. Open `http://localhost:3000`.
3. Use `ws://localhost:18789` plus your OpenClaw gateway token.

### Gateway remote, Studio local

Use any gateway URL your machine can reach.

Recommended with Tailscale:

1. On the gateway host, run `tailscale serve --yes --bg --https 443 http://127.0.0.1:18789`.
2. In Studio, use `wss://<gateway-host>.ts.net`.

Alternative with SSH:

1. Run `ssh -L 18789:127.0.0.1:18789 user@<gateway-host>`.
2. In Studio, use `ws://localhost:18789`.

### Studio remote, Gateway remote

1. Run Studio on the remote host.
2. Expose Studio on a private network or over Tailscale.
3. Set `STUDIO_ACCESS_TOKEN` if Studio binds to a public host.
4. Configure the gateway URL and token inside Studio.

## Tech Stack

- Next.js App Router, React, and TypeScript for the main web application.
- A custom Node server for the Studio-side WebSocket proxy.
- Three.js, React Three Fiber, and Drei for the 3D office experience.
- Phaser for office/viewer-builder workflows and related interactive surfaces.
- Vitest for unit tests and Playwright for end-to-end coverage.

## Configuration

Important runtime paths:

- OpenClaw config: `~/.openclaw/openclaw.json`
- Studio settings: `~/.openclaw/claw3d/settings.json`

Common environment variables:

- `HOST` and `PORT` control the Studio server bind address and port.
- `STUDIO_ACCESS_TOKEN` protects Studio when binding to a public host.
- `NEXT_PUBLIC_GATEWAY_URL` provides the default upstream gateway URL when Studio settings are empty.
- `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` override the default OpenClaw paths.
- `OPENCLAW_GATEWAY_SSH_TARGET`, `OPENCLAW_GATEWAY_SSH_USER`, `OPENCLAW_GATEWAY_SSH_PORT`, and `OPENCLAW_GATEWAY_SSH_STRICT_HOST_KEY_CHECKING` support advanced gateway-host operations over SSH when needed.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL_ID` enable voice reply integration.

See [`.env.example`](.env.example) for the full local development template.

## Scripts

- `npm run dev` starts the Studio dev server.
- `npm run build` builds the production Next.js app.
- `npm run start` starts the production server.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting output.
- `npm run test` runs unit tests with Vitest.
- `npm run e2e` runs Playwright tests.
- `npm run studio:setup` prepares common local Studio prerequisites.
- `npm run smoke:dev-server` runs a basic dev-server smoke check.

## Documentation

- [`VISION.md`](VISION.md): project direction and long-term guardrails.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): system boundaries, data flow, and major trade-offs.
- [`TUTORIAL.md`](TUTORIAL.md): detailed step-by-step setup for OpenClaw + Tailscale + Claw3D.
- [`MULTI_AGENT_BETA.md`](MULTI_AGENT_BETA.md): remote office beta setup, connection modes, and limitations.
- [`CODE_DOCUMENTATION.md`](CODE_DOCUMENTATION.md): practical code map, extension points, and contributor onboarding order.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): local workflow, testing, and PR expectations.
- [`SUPPORT.md`](SUPPORT.md): where to ask for help and how to route reports.
- [`ROADMAP.md`](ROADMAP.md): near-term priorities and contributor-friendly work areas.
- [`docs/pi-chat-streaming.md`](docs/pi-chat-streaming.md): gateway runtime streaming and transcript rendering.
- [`docs/permissions-sandboxing.md`](docs/permissions-sandboxing.md): Studio permissions and OpenClaw behavior.

## Current Limitations

- The immersive retro office (`/office`) and the Phaser builder (`/office/builder`) are related but still separate stacks.
- The app keeps gateway secrets out of browser persistent storage, but the current connection flow still loads the upstream URL/token into browser memory at runtime.

## Troubleshooting

If the UI loads but Connect fails, the problem is usually on the Studio -> Gateway side:

- Confirm the upstream URL and token in Studio settings.
- `EPROTO` or `wrong version number` usually means `wss://` was used against a non-TLS endpoint.
- `401 Studio access token required` usually means `STUDIO_ACCESS_TOKEN` is enabled and the request is missing the expected `studio_access` cookie.
- Helpful proxy error codes include `studio.gateway_url_missing`, `studio.gateway_token_missing`, `studio.upstream_error`, and `studio.upstream_closed`.

Marketplace skill installs now use a gateway-native workspace flow and do not require enabling SSH on the user machine.

If you use other advanced gateway-host operations over SSH:

- macOS: enable `System Settings` -> `General` -> `Sharing` -> `Remote Login`, and make sure the target user is allowed.
- Windows: enable the `OpenSSH Server` optional feature, start the `sshd` service, and allow it through the firewall.
- Linux: make sure `sshd` is installed, running, and reachable from the Studio machine.

For first-time SSH connections, Claw3D uses `StrictHostKeyChecking=accept-new` by default so a new host key can be trusted automatically. If you need stricter behavior, set `OPENCLAW_GATEWAY_SSH_STRICT_HOST_KEY_CHECKING=yes`, or set it to `no` only if you explicitly want to skip host key checks.

## Contributing

Keep pull requests focused, run `npm run lint`, `npm run typecheck`, and `npm run test` before opening a PR, and update docs when behavior or architecture changes.

## AI Editing Guardrails

If you use Cursor or another AI-assisted workflow, review the committed project guardrails in [`.cursor/rules/claw3d-project-guardrails.mdc`](.cursor/rules/claw3d-project-guardrails.mdc).

That rule file captures the shared editing expectations for this repository, including the Claw3D-vs-OpenClaw boundary, code placement conventions, office-stack distinctions, and documentation/test update expectations.

Community expectations live in [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Security reporting instructions live in [`SECURITY.md`](SECURITY.md).
