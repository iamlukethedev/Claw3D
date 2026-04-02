# Security Hardening

Changes applied to the upstream Claw3D codebase for production use.

## Critical Fixes

### 1. Telemetry Removed
- `@vercel/otel` dependency removed from package.json
- `src/instrumentation.ts` replaced with no-op
- No data is sent to Vercel or any external telemetry service

### 2. Constant-Time Token Comparison
- `server/access-gate.js` now uses `crypto.timingSafeEqual()` for
  token validation, preventing timing attacks

### 3. Auth Rate Limiting
- In-memory rate limiter added to access gate for failed auth attempts
  only (10 failures per IP per 60 seconds)
- Prevents brute-force token guessing

### 4. WebSocket Frame Validation
- Maximum frame size: 256 KB (prevents resource exhaustion)
- Per-connection rate limit: 30 frames/second
- Connections closed on violation

### 5. Upstream URL Allowlist
- `UPSTREAM_ALLOWLIST` env var restricts which gateway hosts the
  WebSocket proxy can connect to
- Prevents DNS hijacking or SSRF through the proxy
- Required in production; empty allowlist is permitted in dev only

### 6. Custom Runtime Proxy Allowlist
- `/api/runtime/custom` now enforces `CUSTOM_RUNTIME_ALLOWLIST`
- Falls back to `UPSTREAM_ALLOWLIST` if no custom-specific allowlist is set
- Required in production; empty allowlist is permitted in dev only

### 7. Security Headers
- Baseline response headers now set from `next.config.ts`
- Includes CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and cross-origin isolation headers

### 8. Media Route Symlink Rejection
- `/api/gateway/media` now rejects symlinked local files
- Realpath is verified inside the allowed root before reading bytes

## Remaining Items (Phase 2)

- Encrypt gateway tokens at rest
- Add Zod schema validation for all API inputs
- Implement secure cookie flags (HttpOnly, Secure, SameSite)
- Sanitize error messages before sending to clients
