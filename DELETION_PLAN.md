# Exact post-checkpoint deletion plan

No deletion described here has been executed. Explicit user approval of the
checkpoint is required first.

## Authoritative path set

`REMOVE_MANIFEST.md` is the exact, path-by-path deletion set. At the checkpoint,
the generator assigns every non-ignored repository file to exactly one manifest.
The deletion phase will refuse to run if regeneration changes the set or if any
path is absent from all three manifests.

## Ordered procedure after approval

1. Re-run `node scripts/generate-manifests.mjs` and verify unique full coverage.
2. Record the current checkpoint commit and `git status --short`.
3. For every exact path in `REMOVE_MANIFEST.md`, resolve its canonical parent,
   reject symbolic links/reparse escapes, require containment under the Claw3D
   root, then delete only that path in the dedicated branch.
4. Move refactored visual consumers fully to `packages/**` and `apps/claw3d-ui/**`.
5. Remove now-unused dependencies and regenerate `package-lock.json` with the
   repository-local npm cache and temporary directory.
6. Re-run manifest coverage; no deleted path may remain and no retained path may
   be unclassified.
7. Run all final install, static, unit, browser, containment and reversibility
   gates before committing the deletion slice.

## Removal categories represented by exact manifest paths

- custom Node gateway server, generic WebSocket proxy, Hermes/demo gateways;
- OpenClaw gateway clients, runtime providers, SSH/filesystem and skill install;
- agent CRUD/configuration, chat, approvals, cron, models, permissions and stores;
- GitHub/Jira, Spotify, calling, SMS, TTS/STT and other business integrations;
- obsolete same-origin APIs, server stores, scripts, docs and tests for those areas;
- unverified background/vendor avatar assets and framework starter assets;
- all 17 verified CC0 Kenney Furniture Kit GLBs remain in the exact KEEP set;
- root screenshots, marketing material and development utilities unrelated to the
  autonomous visual product.

No broad directory glob is an authorization to delete. The exact paths printed in
`REMOVE_MANIFEST.md` remain the controlling set.
