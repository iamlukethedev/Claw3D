# Contributing

Thanks for helping improve Claw3D.

Please use GitHub Issues for bugs, feature requests, and questions about planned work.

## Before you start
- Install OpenClaw and confirm the gateway runs locally.
- This repo is UI-only and reads config from `~/.openclaw` with legacy fallback to `~/.moltbot` or `~/.clawdbot`.
- It does not run or build the gateway from source.
- Read `CODE_DOCUMENTATION.md` for the repo code map, extension points, and the recommended onboarding order through the codebase.
- Use `ROADMAP.md` if you are looking for starter work or near-term priorities.

## Local setup
```bash
git clone https://github.com/iamlukethedev/Claw3D.git
cd Claw3D
npm install
cp .env.example .env
npm run dev
```

## Support And Routing
- Use the GitHub bug and feature templates for normal public contributions.
- Use `SUPPORT.md` for help-routing and maintainer contact guidance.
- Use `SECURITY.md` for sensitive security reports, and avoid posting exploit details in public issues.

## Testing
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run e2e` (requires `npx playwright install`)

If your change touches generated UX audit artifacts, clean them before committing with `npm run cleanup:ux-artifacts`.

## Pull requests
- Keep PRs focused and small.
- Prefer one task per PR.
- Include the tests you ran.
- Link to the relevant issue when possible.
- If you changed gateway behavior, call it out explicitly.
- Update docs when the user-facing behavior or architecture changes.
- If you touched bundled assets, vendored code, or dependency/licensing posture, update the relevant `THIRD_PARTY_*` documentation in the same PR.

## Reporting issues
When filing an issue, please include:
- Reproduction steps
- OS and Node version
- Any relevant logs or screenshots

## Minimal PR template
```md
## Summary
- 

## Testing
- [ ] Not run (explain why)
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run e2e`

## AI-assisted
- [ ] AI-assisted (briefly describe what and include prompts/logs if helpful)
```

## Minimal issue template
```md
## Summary

## Steps to reproduce
1.

## Expected

## Actual

## Environment
- OS:
- Node:
- UI version/commit:
- Gateway running? (yes/no)

## Logs/screenshots
```
