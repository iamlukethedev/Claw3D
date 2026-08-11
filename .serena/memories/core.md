# Core

- This repository owns a standalone visual UI only; backend/business orchestration is out of scope.
- Durable dependency direction: visual React/Three/Phaser → visual core → visual contract; adapters depend only on the contract; composition selects adapters.
- No cross-repository imports, packages, symlinks, submodules, volumes, source copies, data-file access, or runtime dependency on JARVIS.
- All project-owned runtime state and tooling artifacts must stay under the repository root.
- Read focused architecture rules in `mem:architecture/boundaries`; build tooling in `mem:tech_stack`; completion gates in `mem:task_completion`.