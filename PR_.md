## Summary

This PR hardens the Claw3D server and proxy surface for production-oriented deployments.

Base branch note:

- this branch should be aligned against `upstream/main` before opening the PR
- package version has been bumped to `0.1.5` for this release train

## What this includes

- remove `@vercel/otel` and make instrumentation a true no-op
- harden Studio access-gate token checks with timing-safe comparison
- limit auth throttling to failed attempts only
- enforce upstream allowlists for the gateway proxy
- enforce allowlists for `/api/runtime/custom`
- add WebSocket frame size and frame rate guards
- reject symlinked local media paths and verify realpath stays inside allowed roots
- add baseline security headers in Next config
- add targeted regression coverage for the hardened paths
- update security and deployment docs
- bump package version to `0.1.5`

## Production notes

- set `UPSTREAM_ALLOWLIST` in production
- set `CUSTOM_RUNTIME_ALLOWLIST` in production if using `/api/runtime/custom`
- empty allowlists are dev-only
- `STUDIO_ACCESS_TOKEN` still relies on deployment-side cookie issuance; built-in login/cookie issuance is not part of this PR
- local `main` may lag `upstream/main`; rebase/merge against `upstream/main` before opening

## Validation

- `npm run typecheck`
- `pnpm exec vitest run tests/unit/accessGate.test.ts tests/unit/gatewayProxy.test.ts tests/unit/gatewayMediaRoute.test.ts tests/unit/customRuntimeRoute.test.ts tests/unit/studioSettingsRoute.test.ts`

## Follow-up

- secure cookie issuance flow
- broader API error sanitization
- schema validation for route inputs
- wider security tests for additional API routes
