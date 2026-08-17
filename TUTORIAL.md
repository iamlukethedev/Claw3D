# Hermes3D + OpenClaw + Tailscale Setup Tutorial

This guide is a step-by-step runbook for the most common production-like setup:

- **Machine A** runs **OpenClaw Gateway**.
- **Machine B** runs **Hermes3D**.
- **Tailscale** connects both machines securely.

If you follow this exactly, people should avoid the most common confusion: **Hermes3D does not install or run OpenClaw for you.**

---

## 0) Architecture and Responsibilities

- **OpenClaw** is the runtime and Gateway.
- **Hermes3D** is the UI and Studio proxy.
- Hermes3D connects to an already running OpenClaw Gateway.
- In this tutorial, the Gateway lives on a different machine from Hermes3D.

---

## 1) Prerequisites

### Machine A (Gateway host)

- macOS, Linux, or WSL2.
- Internet access.
- Ability to install OpenClaw and Tailscale.

### Machine B (Hermes3D host)

- Node.js `20+` recommended for this repo.
- npm `10+` recommended.
- Internet access.
- Ability to install Tailscale.

### Accounts and permissions

- A Tailscale account for your tailnet.
- If your tailnet uses device approval, you need Owner/Admin/IT admin access in Tailscale admin.

---

## 2) Install and Start OpenClaw on Machine A

OpenClaw official install docs are here: [Install](https://docs.openclaw.ai/install/index.md) and [Getting Started](https://docs.openclaw.ai/start/getting-started.md).

### 2.1 Install OpenClaw

On **Machine A**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### 2.2 Run onboarding and install daemon

```bash
openclaw onboard --install-daemon
```

### 2.3 Verify Gateway health

```bash
openclaw gateway status
openclaw status
```

You want a healthy result such as runtime running and RPC probe ok.

### 2.4 Get your Gateway token

You will need this token in Hermes3D:

```bash
openclaw config get gateway.auth.token
```

Store it securely.

---

## 3) Install and Authorize Tailscale on Both Machines

Tailscale docs: [Serve overview](https://tailscale.com/kb/1312/serve), [Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve), and [Device approval](https://tailscale.com/kb/1099/device-approval).

### 3.1 Install Tailscale

Install Tailscale on **Machine A** and **Machine B** using official installers: [Tailscale downloads](https://tailscale.com/download).

### 3.2 Join both machines to the same tailnet

On each machine:

```bash
tailscale up
tailscale status
```

Confirm both machines appear in the same tailnet.

### 3.3 If your tailnet requires approval, approve devices

In Tailscale admin:

1. Open [Machines](https://login.tailscale.com/admin/machines).
2. Find devices marked **Needs approval**.
3. Approve both Machine A and Machine B.

Without this, the machines cannot communicate over tailnet traffic.

---

## 4) Expose OpenClaw Gateway Through Tailscale on Machine A

You have two valid ways. Pick one.

### Option A (simple and explicit): Tailscale Serve command

On **Machine A**, keep Gateway bound locally (`127.0.0.1:18789`) and publish through Serve:

```bash
tailscale serve --yes --bg --https=443 http://127.0.0.1:18789
tailscale serve status
```

Notes:

- Newer Tailscale CLI uses `--https=443`.
- If you are on older docs/commands, you may see syntax like `--https 443`. Use `tailscale serve --help` on your installed version.

### Option B (OpenClaw-managed Tailscale mode)

OpenClaw can manage Tailscale mode itself:

```bash
openclaw gateway --tailscale serve
```

OpenClaw Tailscale docs: [Gateway Tailscale](https://docs.openclaw.ai/gateway/tailscale.md).

### 4.1 Confirm the public tailnet URL

You need the `https://<gateway-host>.<tailnet>.ts.net` host.

This host is what Hermes3D will use as `wss://<gateway-host>.<tailnet>.ts.net`.

---

## 5) Install and Run Hermes3D on Machine B

On **Machine B**:

```bash
git clone https://github.com/iamlukethedev/Hermes3D.git hermes3d
cd hermes3d
npm install
cp .env.example .env
npm run dev
```

Then open:

- `http://localhost:3000`

---

## 6) Connect Hermes3D to OpenClaw

In Hermes3D connection UI:

1. Set **Gateway URL** to:
   - `wss://<gateway-host>.<tailnet>.ts.net`
2. Paste the token from Machine A (`openclaw config get gateway.auth.token`).
3. Click **Connect**.

Important:

- Use `wss://` for Tailscale HTTPS endpoints.
- Use `ws://localhost:18789` only when Gateway is local to the same machine as Hermes3D or when using an SSH tunnel.

---

## 7) Required Device-Pairing Approval Step

This is the step people often miss.

After Hermes3D is running and tries to connect for the first time, approve pending device pairing on **Machine A**:

```bash
openclaw devices list
openclaw devices approve --latest
```

OpenClaw devices docs: [openclaw devices](https://docs.openclaw.ai/cli/devices.md).

If multiple requests are pending, approve by id instead:

```bash
openclaw devices approve <requestId>
```

---

## 8) Verification Checklist

Run this checklist in order:

1. `openclaw gateway status` on Machine A shows healthy runtime.
2. `tailscale status` on both machines shows connected devices in same tailnet.
3. `tailscale serve status` on Machine A shows active Serve config for port `443` to `127.0.0.1:18789`.
4. Hermes3D connect UI uses `wss://...ts.net` plus valid token.
5. `openclaw devices approve --latest` has been run after first connect attempt.
6. Hermes3D UI shows gateway connected and loads agents.

---

## 9) Troubleshooting

### `EPROTO` or `wrong version number`

- Usually means protocol mismatch.
- Fix: if your endpoint is HTTPS/Tailscale Serve, use `wss://...`.
- Do not use `wss://` against a plain `ws://` endpoint.

### `401` or auth errors from Hermes3D

- Re-copy token from Machine A:
  - `openclaw config get gateway.auth.token`.
- Confirm Gateway auth mode and token are current.

### Hermes3D still cannot connect after token is correct

- Approve pending device:
  - `openclaw devices approve --latest`.
- Check pending requests:
  - `openclaw devices list`.

### Tailscale URL works nowhere

- Confirm both devices are approved in Tailscale admin if device approval is enabled.
- Re-run:
  - `tailscale status`.
  - `tailscale serve status`.
- Recreate serve config if needed:
  - `tailscale serve reset`.
  - `tailscale serve --yes --bg --https=443 http://127.0.0.1:18789`.

### Gateway itself is unhealthy

- Run:
  - `openclaw doctor`.
  - `openclaw gateway restart`.
  - `openclaw gateway status`.

---

## 10) Security Notes

- Keep Gateway bound to loopback unless you have a deliberate reason not to.
- Do not commit tokens into git or `.env` files intended for sharing.
- Prefer Tailscale Serve over exposing raw Gateway ports publicly.
- Treat OpenClaw device pairing approval as a security gate, not a one-time annoyance.

---

## References

- OpenClaw install: [docs.openclaw.ai/install/index.md](https://docs.openclaw.ai/install/index.md).
- OpenClaw getting started: [docs.openclaw.ai/start/getting-started.md](https://docs.openclaw.ai/start/getting-started.md).
- OpenClaw gateway runbook: [docs.openclaw.ai/gateway/index.md](https://docs.openclaw.ai/gateway/index.md).
- OpenClaw devices CLI: [docs.openclaw.ai/cli/devices.md](https://docs.openclaw.ai/cli/devices.md).
- OpenClaw tailscale gateway mode: [docs.openclaw.ai/gateway/tailscale.md](https://docs.openclaw.ai/gateway/tailscale.md).
- Tailscale Serve: [tailscale.com/kb/1312/serve](https://tailscale.com/kb/1312/serve).
- Tailscale serve CLI: [tailscale.com/docs/reference/tailscale-cli/serve](https://tailscale.com/docs/reference/tailscale-cli/serve).
- Tailscale device approval: [tailscale.com/kb/1099/device-approval](https://tailscale.com/kb/1099/device-approval).
