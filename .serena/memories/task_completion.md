# Task Completion

- Run repository-local clean install, then a second install for idempotence.
- Required green gates: containment, lint, typecheck, unit tests, production build, Playwright, visual comparison, responsive checks, keyboard/basic accessibility, all mock scenarios, mapper fixtures, and blocked network in mock/null modes.
- Re-run containment after build/test/run and verify stop/cleanup leaves no Claw3D process, PID, socket, service, configuration, or project-owned data outside the root.
- Validate a clone/copy in a path containing spaces and an uninstall dry run on a controlled temporary copy.
- Confirm JarvisAPI SHA and worktree are unchanged; no push, PR, deployment, or full-source deletion without explicit authorization.
- Review final diff for accidental generated files, secrets, environment-specific paths, and stale docs/tests.