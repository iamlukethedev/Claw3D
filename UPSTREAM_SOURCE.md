# Upstream source

This visual-UI extraction originates from Claw3D by Luke The Dev.

- Repository: https://github.com/iamlukethedev/Claw3D
- Source branch: `main`
- Source commit: `70ba84c1b13322eb660a6f7f5c53e36e7067c412`
- Local rollback tag: `claw3d-upstream-70ba84c`
- License: MIT; the original `LICENSE` and copyright notice are preserved.

The local tag is intentionally not pushed. To recreate a clean local branch at the
exact upstream source without changing the current worktree, run:

```bash
git branch restore/claw3d-upstream claw3d-upstream-70ba84c
```

To inspect that branch in a separate checkout, choose a path outside this repository
and run `git worktree add <path> restore/claw3d-upstream`.
