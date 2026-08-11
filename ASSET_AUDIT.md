# Asset and vendored-code audit

Status at the pre-deletion checkpoint. No uncertain asset has been declared safe
merely because the repository itself is MIT-licensed.

## Repository license

The root MIT license and `Copyright (c) 2026 Luke The Dev` are preserved.
`UPSTREAM_SOURCE.md` records the exact source repository and commit.

## GLB furniture models

The 17 GLB files under `public/office-assets/models/furniture/` are from Kenney's
Furniture Kit 1.0. Every retained binary was SHA-256 compared with the matching
file in the explicitly named `kenney_furniture-kit/Models/GLTF format` mirror at
RetroDECK/RetroQUEST commit
`dfa19a5602a31f64bd890d15279a61f43b127328`: 17 of 17 are exact matches.

Kenney's official Furniture Kit page identifies the pack as Creative Commons
CC0 and the official support page confirms that assets on those pages are public
domain licensed and may be used in commercial projects:

- https://kenney.nl/assets/furniture-kit
- https://kenney.nl/support
- https://creativecommons.org/publicdomain/zero/1.0/

Decision: retain the 17 GLB files, record them in `THIRD_PARTY_NOTICES.md`, and
serve them only through the Claw3D same-origin asset allowlist. The scene receives
their URLs through `AssetResolver`; the visual package does not own a hard-coded
route.

## Office background and image assets

`public/office-assets/backgrounds/office-bg.png`, the root screenshots, and the
branding images have no asset-specific provenance record. They are not required
by the autonomous UI.

Decision: the office background and non-validation images remain classified for
removal. The restored scene does not request the background image. Validation
screenshots created by this refactor remain as project evidence and are clearly
identified as such.

## Vendored Multiavatar code

`src/lib/avatars/vendor/multiavatar.js` is minified and has no embedded license,
copyright, version, or source URL. The wrapper and tests do not establish the
vendored file's provenance.

Decision: replace it with deterministic code-native initials/colors and remove
the vendored file after checkpoint approval.

## Fonts and remaining third-party assets

No tracked WOFF, WOFF2, TTF, or OTF files were found. The remaining SVGs are
framework starter assets and are not needed by the final product; they are
classified for removal.

Before deletion, the manifest verifier must still prove that every asset path is
assigned to exactly one of KEEP, REFACTOR, or REMOVE.
