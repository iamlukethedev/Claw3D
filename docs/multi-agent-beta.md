# Multi-Agent Beta

This document explains the current multi-agent beta in Claw3D: what it does, how the two connection modes work, and how to connect a second office.

## What This Beta Does

Claw3D can render a second office inside the same 3D scene so you can visualize agents from another machine.

Today the beta supports:

- showing a second office in the same world;
- displaying remote agents as read-only presence;
- optionally sending a plain-text message to a remote agent;
- keeping the remote side isolated from your local files and office controls.

This is a beta feature. It is designed for visibility and lightweight cross-office messaging, not full shared-state collaboration.

## Mental Model

There are always two roles:

- **Local office**: the Claw3D instance you are currently using;
- **Remote office**: another Claw3D instance or another OpenClaw gateway you want to visualize.

The remote office can be connected in one of two ways:

1. **Remote Claw3D presence endpoint**.
2. **Remote OpenClaw gateway**.

## Connection Modes

### 1. Remote Claw3D Presence Endpoint

Use this when the other machine is also running Claw3D.

How it works:

- your local Claw3D server polls the remote Claw3D `presence` endpoint;
- it also tries to load the remote office `layout` snapshot;
- the local 3D scene renders the remote office as a read-only clone inside the same world.

Typical URL:

```text
https://other-office.example.com/api/office/presence
```

This mode is best when you want the remote side to feel like another full Claw3D office.

### 2. Remote OpenClaw Gateway

Use this when the other machine only runs OpenClaw and does not run Claw3D.

How it works:

- the browser connects directly to the remote gateway;
- Claw3D derives a read-only presence snapshot from gateway data such as `agents.list`, `status`, and `sessions.preview`;
- because there is no remote Claw3D layout endpoint, the second office uses a fallback office visualization.

Typical URL:

```text
ws://remote-host:18789
```

or:

```text
wss://remote-host.example.com
```

If you paste an `http://` or `https://` URL into gateway mode, Claw3D normalizes it to `ws://` or `wss://` before connecting.

This mode is best when you want remote agent visibility without requiring a second Claw3D deployment.

## What You Can See

When the beta is enabled, you can:

- see a second office in the same environment;
- see remote agents appear in that office;
- see remote agents move and change basic activity state;
- click a remote agent and open a text-only messaging panel.

## What You Cannot See

The remote office is intentionally limited.

You cannot:

- inspect the remote machine filesystem;
- browse the remote agent chat history in full;
- control the remote office furniture or builder state;
- take over the remote instance as if it were local.

The goal is cross-office visualization, not remote workstation access.

## Remote Messaging

Remote messaging is currently a lightweight relay with two send modes.

What it does:

- lets you send a plain-text note to a remote agent;
- lets you choose `direct` or `interval` delivery in the remote chat panel;
- is available from the remote agent chat panel;
- is designed to avoid exposing remote files or tool output in the Claw3D UI.

`direct` is for one-off pings.

`interval` is for an ongoing coordination thread where you expect short periodic updates or checkpoints.

Current limitations:

- remote replies are not mirrored back into the panel yet;
- the panel currently shows your sent message plus delivery/system feedback;
- this is not a shared transcript viewer.

## Runtime Message And Handoff Layer

Under the hood, Claw3D now uses a shared runtime contract for:

- `agents.message`
- `agents.handoff`

OpenClaw, Hermes, Demo, and direct custom/local/claw3d runtime profiles can all target the same message/handoff seam. Provider-native adapters such as Anthropic or Claude Code are still a follow-up slice.

## How To Connect

### Prerequisites

Before enabling the second office, make sure:

- your local Claw3D is already working with your local OpenClaw gateway;
- you know which remote mode you want to use;
- the remote machine is reachable from your machine or browser;
- any required token, origin allowlist, or private-network access is already configured.

### Setup Steps

1. Start your local Claw3D instance.
2. Open the office UI.
3. Open the office settings panel.
4. Turn on `Show second office`.
5. Choose the correct `Source type`.
6. Fill the matching connection fields.

### Setup For `Remote Claw3D presence endpoint`

Use:

- `Source type`: `Remote Claw3D presence endpoint`.
- `Presence URL`: the remote `/api/office/presence` URL.
- `Optional token`: only if that remote Claw3D endpoint is protected.

Example:

```text
https://other-office.example.com/api/office/presence
```

Expected behavior:

- the second office appears inside the world;
- remote agents show up when the remote office has active presence;
- if the remote layout snapshot is unavailable, Claw3D falls back to a default/fallback office rendering for the remote side.

### Setup For `Remote OpenClaw gateway`

Use:

- `Source type`: `Remote OpenClaw gateway`.
- `Gateway URL`: the remote gateway WebSocket URL.
- `Shared gateway token`: optional when the gateway already allows your Control UI origin and connection model.

Examples:

```text
ws://remote-host:18789
```

```text
wss://remote-host.example.com
```

Expected behavior:

- the second office appears inside the world;
- remote agents are derived from gateway presence data;
- the office shell is a fallback visualization, not a true remote layout clone from another Claw3D instance.

## Recommended Network Patterns

### Same private network

Use a reachable private IP or local hostname for the remote Claw3D endpoint or OpenClaw gateway.

### Tailscale

Tailscale is a good fit for this beta because it lets both sides connect over a private network without exposing services publicly.

Common patterns:

- remote Claw3D endpoint over `https://<machine>.ts.net/api/office/presence`;
- remote OpenClaw gateway over `wss://<machine>.ts.net` if you are proxying the gateway through HTTPS/WSS;
- direct gateway over `ws://<machine>:18789` when both devices can reach the service privately.

## Disable Behavior

If you turn `Show second office` off:

- the extra office should disappear from the 3D scene;
- the path/outdoor connection should disappear;
- remote office presence and layout hooks should stop driving the scene.

This lets you return to a single-office view.

## Troubleshooting

### No remote agents appear

Check:

- the remote URL is correct;
- the remote machine is actually reachable;
- the remote service is running;
- the selected `Source type` matches the service you are pointing at.

### Presence endpoint works but the remote layout does not

That usually means the other machine has Claw3D presence available but not a layout snapshot yet. The beta should still render a fallback remote office.

### Gateway mode connects but messaging fails

In gateway mode, the browser connects directly to the remote gateway. That means the remote gateway may still reject the connection based on origin policy or other gateway-side security rules.

If that happens, check:

- the remote gateway URL;
- whether the remote gateway allows your Control UI origin;
- whether the remote gateway expects a token or device-auth flow you have not configured.

### You can reach an HTTPS page but gateway mode still fails

Opening a web page in the browser does not automatically mean the OpenClaw gateway WebSocket is reachable.

Examples:

- `https://host` may be reachable while `ws://host:18789` is not;
- a website reverse proxy may exist even though the raw gateway port is closed;
- the remote side may need a dedicated WSS proxy path for the gateway.

## Current Beta Limitations

- The second office is read-only.
- Remote replies are not mirrored into the local remote-chat panel yet.
- Gateway mode derives presence from gateway snapshots rather than a real remote Claw3D layout.
- Browser-based gateway mode depends on the remote gateway allowing the connection from your Control UI origin.
- This feature is still evolving and should be treated as beta, not final production-grade multi-tenant collaboration.

## Summary

Use `Remote Claw3D presence endpoint` when the other side runs Claw3D and you want the most complete office visualization.

Use `Remote OpenClaw gateway` when the other side only runs OpenClaw and you mainly want remote agent presence plus lightweight text messaging.
