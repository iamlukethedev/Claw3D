# Suggested Commands

- Install through `scripts/install.sh`; it owns a repository-local npm cache and must be idempotent.
- Start through `scripts/start.sh`; stop through `scripts/stop.sh`.
- Remove generated artifacts through `scripts/uninstall.sh`; full source deletion is a separate interactive option and must never be exercised without explicit authorization.
- Validate confinement with `scripts/verify-containment.sh` before and after build/test/run.
- Static and runtime checks are exposed through repository npm scripts for lint, typecheck, unit tests, production build, and Playwright.