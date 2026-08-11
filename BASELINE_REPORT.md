# Upstream baseline report

Captured on 2026-08-11 before any source deletion.

## Provenance and isolation

- Claw3D remote `main`: `70ba84c1b13322eb660a6f7f5c53e36e7067c412`.
- JarvisAPI remote `main`: `991c8e1a7f6a8e359fa76ade0e8f61876b7346b3`.
- JarvisAPI checkout was clean at the same SHA before work began.
- Working branch: `codex/jarvis-visual-ui`.
- Local source tag: `claw3d-upstream-70ba84c`.
- Claw3D remote retained as `upstream`.
- JarvisAPI was inspected read-only; no fetch, branch, tag, source edit, runtime
  invocation, or configuration change was performed there.

## Source measurements

- Tracked files: 608.
- Tracked bytes: 8,013,013.
- Text lines (binary files excluded): 153,478.
- Runtime dependencies: 17.
- Development dependencies: 19.
- Lockfile packages: 765.

## Toolchain observed

- Node used for the baseline: `v26.5.0`.
- npm used for the baseline: `11.17.0`.
- npm cache: `.claw3d/npm-cache`.
- Playwright browser destination: `.claw3d/playwright-browsers`.
- Project temporary directory for controlled validation: `.claw3d/tmp`.

The final repository will pin its supported Node release independently of the
machine version used for this upstream snapshot.

## Baseline commands and exact outcomes

| Command | Exit | Result |
| --- | ---: | --- |
| `npm ci --cache .claw3d/npm-cache` | 0 | 636 packages installed; npm reported 10 vulnerabilities (1 low, 8 high, 1 critical). |
| `npm run lint` | 1 | 35 findings: 9 errors and 26 warnings. |
| `npm run typecheck` | 0 | No TypeScript errors. |
| `npm run test -- --run` | 1 | 3 files failed, 168 passed; 5 tests failed, 1,073 passed. |
| `npm run build` | 0 | Next.js production build compiled successfully. |
| `npm run e2e` with repository-local Playwright paths | 1 | 12 tests failed before execution and 2 were skipped because the local Chromium executable was unavailable. |

Failing unit tests:

1. `agentFleetHydration.test.ts`: `maps_gateway_results_into_seeds_and_selects_latest_assistant_agent`.
2. `agentChatPanel-controls.test.ts`: `allows_send_while_running_so_follow_up_can_be_queued`.
3. `agentChatPanel-controls.test.ts`: `does_not_send_when_enter_is_pressed_during_composition`.
4. `useGatewayConnection.test.ts`: `does_not_auto_connect_without_a_last_known_good_state`.
5. `useGatewayConnection.test.ts`: `prefers_the_saved_selected_adapter_over_a_different_last_known_good_backend`.

The final retained code is not allowed to inherit these red results.

The repository-local Chromium download reached the full 170,206,961-byte archive
but the CDN stream did not close after more than two minutes at 100%. It was
stopped and Playwright correctly failed closed rather than using the pre-existing
machine cache. Final E2E validation remains mandatory after a successful confined
browser installation.

## Reference routes and screenshots

- `/office`: `artifacts/baseline/screenshots/office-upstream.jpg`.
- `/office/builder`: `artifacts/baseline/screenshots/builder-upstream.jpg`.

The upstream office attempts a local OpenClaw connection, exposes backend/token
controls, chat/approval/fleet actions, and numerous business integrations. Those
surfaces are evidence for removal, not part of the target UI contract.

The upstream builder renders successfully, but contains server-backed save and
publish mutations. The visual editing interaction is a refactor candidate; the
mutations are removal candidates.
