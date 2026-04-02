# Crypto Launch Production Notes

This document covers the additional setup required to run the Pump.fun token launch flow safely in production.

## Modes

`user_approved`

- The browser prepares the Pump.fun transaction.
- Phantom signs the transaction locally.
- The server only receives the signed transaction for submission.

`server_side`

- The frontend must expose `NEXT_PUBLIC_CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`.
- The server must expose `CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`.
- An operator must authenticate in the Launch tab before server-side launch APIs are allowed.
- The server signer comes from `PUMPFUN_SERVER_SECRET_KEY`.

## Required Environment Variables

For wallet-approved launches:

- `NEXT_PUBLIC_SOLANA_RPC_URL` or `HELIUS_MAINNET_RPC_URL` / `HELIUS_DEVNET_RPC_URL`

For server-side launches:

- `NEXT_PUBLIC_CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`
- `CRYPTO_LAUNCH_SERVER_MODE_ENABLED=true`
- `PUMPFUN_SERVER_SECRET_KEY`
- `CRYPTO_LAUNCH_OPERATOR_PASSWORD`
- `CRYPTO_LAUNCH_SESSION_SECRET`

Recommendations:

- Use a dedicated launch wallet with explicit funding limits.
- Generate `CRYPTO_LAUNCH_SESSION_SECRET` from a long random value, for example `openssl rand -hex 32`.
- Rotate `CRYPTO_LAUNCH_OPERATOR_PASSWORD` and `CRYPTO_LAUNCH_SESSION_SECRET` together if operator access is ever in doubt.

## Persistence

Prepared launches and audit logs are stored under the Claw3D/OpenClaw state directory:

- `~/.openclaw/claw3d/crypto-launch/prepared-launches.json`
- `~/.openclaw/claw3d/crypto-launch/launch-audit.jsonl`

If you override `OPENCLAW_STATE_DIR`, these files move under that directory instead.

Operational expectations:

- Persist this directory on durable storage if the deployment is containerized.
- Treat the audit log as operational data and ship it to centralized log storage when possible.
- Keep file permissions restricted to the app user because prepared launches include serialized transactions and launch metadata.

## Security Controls

The launch flow now includes:

- durable prepared-launch storage instead of process memory only.
- one-time submit tokens for prepared launch submission.
- HTTP-only signed operator sessions for server-side mode.
- per-IP request throttling on prepare and submit routes.
- HTTPS-only remote logo fetches.
- DNS and private-network checks to reduce SSRF risk during logo ingestion.
- logo size and content-type validation.

## Deployment Checklist

1. Set production Solana RPC endpoints.
2. Decide whether server-side launches should be enabled at all.
3. If server-side launches are enabled, configure the five launch env vars above.
4. Persist `OPENCLAW_STATE_DIR` across restarts.
5. Restrict access to the Claw3D deployment with `STUDIO_ACCESS_TOKEN` or an equivalent reverse-proxy/auth layer.
6. Monitor `launch-audit.jsonl` for failed launches, rate limiting, and unauthorized server-side attempts.
7. Test both `devnet` and `mainnet` flows before allowing operators to use the production signer.

## Remaining Gaps

This is materially safer than the prototype flow, but it is not a replacement for full user accounts, RBAC, or centralized secrets management.

If you need multi-user production readiness, the next layer should be:

- real user identity instead of a shared operator password.
- role-based authorization for server-side launches.
- external secret storage for the server signer.
- centralized metrics/logging for launch attempts and outcomes.
