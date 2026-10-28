# Known Issues

Current publication caveats and unresolved follow-up items. Keep this list short and factual; remove entries when they are fixed.

## Build and tooling

- `npm run build` prints `Can't resolve 'openclaw'`. The `openclaw` package is resolved optionally at runtime and is not bundled. The warning is harmless.
- `npm run lint` reports zero errors but still has a few dozen warnings (mostly unused variables and `react-hooks/exhaustive-deps`). Clean them up when you touch the affected file.
- On Windows, the symlink case in `tests/unit/gatewayMediaRoute.test.ts` is skipped unless the account may create symlinks (Developer Mode or elevated shell). It runs on Linux and macOS.
- npm 10.9 can crash with `Cannot read properties of null (reading 'edgesOut')` while upgrading some dev dependencies (an `@npmcli/arborist` peer-set bug). Workaround: `npx npm@11 install <pkg>`. The lockfile format (v3) is unchanged, so `npm ci` with npm 10 still works afterwards.

## Security posture

- The browser loads the configured upstream gateway URL and token into memory at runtime, so the browser is part of the active trust boundary. Tokens are never written to client-side persistent storage.
- Studio has no user accounts. Bind it to `localhost`, or set `STUDIO_ACCESS_TOKEN` before exposing it on a network. The server refuses to bind to a public host without that token.

## Product gaps

- Heartbeat runs cannot be stopped from Studio yet. The stop button is disabled with an explanation while a heartbeat run is active.
- Phone and SMS booth voice replies use ElevenLabs directly. A runtime-neutral Claw3D voice/text skill is still to be built (see the TODO in `src/lib/voiceReply/provider.ts`).

## Code health

- `src/features/retro-office/RetroOffice3D.tsx` (~7k lines) and `src/features/office/screens/OfficeScreen.tsx` (~6k lines) are monoliths. Build new office systems as feature modules and wire them in through props rather than growing these files.

## Assets and licensing

- The bundled furniture models in `public/office-assets/models` do not have their provenance or licenses documented in the repository yet. Confirm and record them before a tagged release (also tracked in `docs/roadmap.md`).
