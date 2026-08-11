# Architecture Boundaries

- `visual-core`: pure reducers, navigation, geometry, animation state, and view-models; no I/O, framework server APIs, environment reads, backend names, or routes.
- `visual-react`: props/callback-driven React, Three.js/React Three Fiber/Drei, and Phaser UI; no fetch/WebSocket/EventSource/filesystem/env access.
- Network DTO validation and translation belong in adapter-specific anti-corruption layers.
- Browser talks only to same-origin Claw3D endpoints and receives neutral visual contract data; no secrets or raw backend payloads.
- JARVIS integration is server-only, exact-route allowlisted, disabled closed unless explicitly enabled, and has no business-command capability.
- Auth mutations, if possible without weakening cookie security, live in a separately capability-gated `session-auth` boundary.