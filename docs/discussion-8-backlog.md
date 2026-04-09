# Discussion #8 follow-up backlog.

This file captures the remaining items from the GitHub discussion so they stay visible after the first implementation pass.

## Done in this branch.

- Multi-agent visibility improvements in the office HUD.
- Config-driven office state mapping for local and remote agent presence.

## Remaining items.

### 3. Mobile-first office UX.

- Improve touch-first navigation for `/office`, especially camera movement and chat access on narrow screens.
- Verify iOS Safari behavior with a dedicated pass on touch gestures and viewport-safe overlays.

### 4. Sound and event cues.

- Add lightweight operational audio cues for important office events.
- Keep cues configurable so operators can mute or tailor them per environment.

### 5. Enterprise auth integration guidance.

- Document `oauth2-proxy` and Entra/OIDC deployment patterns around `STUDIO_ACCESS_TOKEN` and the `studio_access` cookie contract.
- Re-evaluate whether built-in OIDC is needed after documentation and operator feedback.

### 6. External event webhooks.

- Define an event-ingress API for external systems to trigger office reactions.
- Decide on payload schema, authentication, and rate-limiting before adding visual/audio reactions.
