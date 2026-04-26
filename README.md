# Claw3D — A 3D Workspace for AI Agents

<p align="center">
    <img src="assets/branding/claw3d-hero.png" alt="Claw3D" width="700">
</p>

<p align="center">
  <strong>AN OFFICE FOR YOUR AI TEAM!</strong>
</p>

<p align="center">
  <a href="https://github.com/iamlukethedev/Claw3D/actions/workflows/docker-publish.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/iamlukethedev/Claw3D/docker-publish.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/iamlukethedev/Claw3D/releases"><img src="https://img.shields.io/github/v/release/iamlukethedev/Claw3D?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/UzwNn5Zkhr"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="https://x.com/iamlukethedev"><img src="https://img.shields.io/badge/Follow-%40iamlukethedev-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow on X"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**Claw3D** is a _3D virtual office for AI agents_ you run on your own infrastructure.
Instead of watching automation through dashboards and logs, you walk through a live 3D office where your agents collaborate, review code, run standups, ship pull requests, and execute tasks side by side. The Gateway is just the control plane — the product is the office.

If you want a personal, self-hosted workspace that turns your AI workforce into something you can actually _see_, this is it.

Supported runtimes include: OpenClaw Gateway, Hermes, a direct HTTP `custom` runtime provider for orchestrator-backed stacks, and a built-in demo gateway for office exploration without a real agent framework.

[Website](https://www.claw3d.ai/) · [Vision](VISION.md) · [Architecture](ARCHITECTURE.md) · [Tutorial](TUTORIAL.md) · [Getting Started](#quick-start) · [Runtime Profiles](docs/runtime-profiles.md) · [Multi-Agent Beta](docs/multi-agent-beta.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Discord](https://discord.gg/UzwNn5Zkhr)

> **Unofficial project.** Claw3D is an independent, community-driven project and is not affiliated with, endorsed by, or maintained by the OpenClaw team. OpenClaw is a separate project, and this repository is not the official OpenClaw repository.

Built and maintained by **LukeTheDev**. Follow on X: [@iamlukethedev](https://x.com/iamlukethedev).

## What you can do with Claw3D

- **Watch your AI agents work in real time** inside a shared 3D office.
- **Run standups** with agents connected to GitHub and Jira.
- **Review pull requests** from inside the office.
- **Monitor QA pipelines** and logs without leaving the workspace.
- **Train agents in the gym** to develop new skills.
- **Reset sessions and clean context** with the janitor system.

## What Claw3D Is

Claw3D is the visualization and interaction layer.

Today it can sit on top of:

- OpenClaw through the existing gateway flow
- Hermes through the bundled WebSocket adapter
- a direct HTTP `custom` runtime provider for orchestrator-backed stacks
- a built-in demo gateway for office exploration without a real agent framework

In practical terms, this app gives you:

- a live `/office` retro-office environment where agents appear as workers moving through a shared 3D world
- an `/office/builder` surface for editing and publishing office layouts
- a gateway-first architecture that keeps runtime state in the connected backend while Studio stores local UI preferences
- a backend-neutral runtime seam inside Studio so additional providers can be integrated without rewriting the whole UI

This repository does not build the upstream runtimes themselves. It is the frontend, Studio, and adapter/proxy layer that connects to a runtime speaking the Claw3D gateway protocol.

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
- One of:
  - a working OpenClaw installation with a reachable Gateway URL and token
  - Hermes with the bundled adapter
  - the built-in demo gateway for local exploration

Prerequisite:

- Claw3D does not install or build OpenClaw or Hermes for you.
- Before starting Claw3D against a real backend, make sure your chosen runtime is already running and that you know the gateway URL and token Studio should use.
- For a no-framework local office demo, run the bundled demo gateway instead.
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
Studio now also persists the selected backend mode (`OpenClaw`, `Hermes`, `Demo`, `Local`, `Claw3D`, or `Custom`) and
shows the active backend reported by the connected gateway.

### Runtime profiles

If you are integrating an orchestrator-backed runtime through the direct
HTTP runtime seam, start your runtime first, then start Claw3D:

```bash
npm run dev
```

Then open `http://localhost:3000`, choose `Local runtime`, `Claw3D runtime`,
or `Custom backend`, and point the upstream URL at your runtime boundary.
Typical examples:

```text
http://127.0.0.1:7770
```

```text
http://localhost:3000/api/runtime/custom
```

Current direct-runtime expectations:

- `GET /health`
- `GET /state`
- `GET /registry`
- `POST /v1/chat/completions`

The browser does not call that runtime directly. Claw3D proxies the
`custom` provider through its own same-origin route at
`/api/runtime/custom`, which avoids browser-side CORS problems and keeps
the provider transport separate from the OpenClaw/Hermes gateway path.

### Demo mode

If you only want to see the office and agent interactions without installing OpenClaw or Hermes:

```bash
npm run demo-gateway
npm run dev
```

Then connect Studio to:

```text
ws://localhost:18789
```

This starts a mock local gateway with demo agents, streaming chat, session previews, and office presence.
In the connect screen, choose `Demo backend`, then connect.

### Hermes adapter

If you want to use Hermes instead of OpenClaw:

```bash
npm run hermes-adapter
npm run dev
```

See [`docs/hermes-gateway.md`](docs/hermes-gateway.md) for setup details and current scope.

For a local gateway on the same machine, the usual upstream URL is:

```text
ws://localhost:18789
```

In the connect screen, choose `Hermes backend`, then connect.

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

### Studio on LAN or Tailscale for other devices

1. Start Studio with `HOST=0.0.0.0` (or a specific LAN/Tailscale host).
2. Set `STUDIO_ACCESS_TOKEN` before exposing Studio beyond localhost.
3. Open Claw3D from the LAN/Tailscale address instead of `localhost`.
4. If you are connecting to a remote OpenClaw gateway, remember device approval is per browser/device. A new browser may still require:

```bash
openclaw devices approve --latest
```

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
- `UPSTREAM_ALLOWLIST` restricts which upstream gateway hosts Studio may proxy to. Set this in production.
- `CUSTOM_RUNTIME_ALLOWLIST` restricts which hosts `/api/runtime/custom` may fetch. If unset, it falls back to `UPSTREAM_ALLOWLIST`.
- `NEXT_PUBLIC_GATEWAY_URL` provides the default upstream gateway URL when Studio settings are empty. **Note:** this is a build-time variable — changes require `npm run build` to take effect.
- `CLAW3D_GATEWAY_URL` and `CLAW3D_GATEWAY_TOKEN` provide a runtime alternative to `NEXT_PUBLIC_GATEWAY_URL` that takes effect on server restart without a rebuild.
- `CLAW3D_GATEWAY_ADAPTER_TYPE` can pair with `CLAW3D_GATEWAY_URL` to mark those runtime defaults as `openclaw`, `hermes`, `demo`, `local`, `claw3d`, or `custom`.
- If `CLAW3D_GATEWAY_URL` is not set, Studio can still surface local Hermes or demo adapter defaults from `HERMES_ADAPTER_PORT` / `DEMO_ADAPTER_PORT`.
- OpenClaw file defaults still come from `~/.openclaw/openclaw.json` when present.
- `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH` override the default OpenClaw paths.
- `OPENCLAW_GATEWAY_SSH_TARGET`, `OPENCLAW_GATEWAY_SSH_USER`, `OPENCLAW_GATEWAY_SSH_PORT`, and `OPENCLAW_GATEWAY_SSH_STRICT_HOST_KEY_CHECKING` support advanced gateway-host operations over SSH when needed.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL_ID` enable voice reply integration.

See [`.env.example`](.env.example) for the full local development template.

## Scripts

- `npm run dev` starts the Studio dev server.
- `npm run hermes-adapter` starts the Hermes WebSocket adapter.
- `npm run demo-gateway` starts the built-in mock gateway for demo mode.
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
- [`docs/multi-agent-beta.md`](docs/multi-agent-beta.md): remote office beta setup, connection modes, and limitations.
- [`docs/runtime-profiles.md`](docs/runtime-profiles.md): saved backend/runtime profiles and the current HTTP runtime seam.
- [`CODE_DOCUMENTATION.md`](CODE_DOCUMENTATION.md): practical code map, extension points, and contributor onboarding order.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): local workflow, testing, and PR expectations.
- [`SUPPORT.md`](SUPPORT.md): where to ask for help and how to route reports.
- [`ROADMAP.md`](ROADMAP.md): near-term priorities and contributor-friendly work areas.
- [`docs/pi-chat-streaming.md`](docs/pi-chat-streaming.md): gateway runtime streaming and transcript rendering.
- [`docs/permissions-sandboxing.md`](docs/permissions-sandboxing.md): Studio permissions and OpenClaw behavior.
- [`docs/hermes-gateway.md`](docs/hermes-gateway.md): Hermes adapter setup, capabilities, and current limitations.

## Current Limitations

- The immersive retro office (`/office`) and the Phaser builder (`/office/builder`) are related but still separate stacks.
- The app keeps gateway secrets out of browser persistent storage, but the current connection flow still loads the upstream URL/token into browser memory at runtime.
- Local Spotify auth for `SOUNDCLAW` currently stores an access token only. Refresh-token handling is not implemented yet, so local Spotify auth may need to be repeated after the token expires.

## Troubleshooting

If the UI loads but Connect fails, the problem is usually on the Studio -> Gateway side:

- Confirm the upstream URL and token in Studio settings.
- `EPROTO` or `wrong version number` usually means `wss://` was used against a non-TLS endpoint.
- `INVALID_REQUEST` errors mentioning `minProtocol` or `maxProtocol` usually mean the gateway is too old for Claw3D protocol v3. Upgrade OpenClaw, use the Hermes adapter, or run `npm run demo-gateway`.
- `401 Studio access token required` usually means `STUDIO_ACCESS_TOKEN` is enabled and the request is missing the expected `studio_access` cookie.
- If `/api/runtime/custom` returns a blocked-host error in production, set `CUSTOM_RUNTIME_ALLOWLIST` or include the runtime host in `UPSTREAM_ALLOWLIST`.
- Helpful proxy error codes include `studio.gateway_url_missing`, `studio.gateway_token_missing`, `studio.upstream_error`, and `studio.upstream_closed`.

Marketplace skill installs now use a gateway-native workspace flow and do not require enabling SSH on the user machine.

### Spotify auth on localhost

If you are testing the `SOUNDCLAW` jukebox locally and Spotify OAuth does not accept your `localhost` callback, use an `ngrok` callback bridge:

1. Keep Claw3D running locally on `http://localhost:3000`.
2. Start `ngrok` for the local Studio server, for example `ngrok http 3000`.
3. In the jukebox setup UI, paste your public `ngrok` URL into the `ngrok Public URL` field.
4. In the Spotify developer dashboard, register `https://<your-ngrok-host>/spotify/callback` as the redirect URI.
5. Complete Spotify sign-in from the jukebox panel.

How it works:

- The main Claw3D app stays on `localhost`, so your normal local office state and agent state remain intact.
- Spotify redirects to the `ngrok` callback URL.
- The callback page passes the auth code back to the open local Claw3D window.

Current local limitation:

- Because only the Spotify access token is stored right now, you may need to repeat the `ngrok` auth flow when that token expires during local development.

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
