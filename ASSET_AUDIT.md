# Asset and vendored-code audit

Status at the pre-deletion checkpoint. No uncertain asset has been declared safe
merely because the repository itself is MIT-licensed.

## Repository license

The root MIT license and `Copyright (c) 2026 Luke The Dev` are preserved.
`UPSTREAM_SOURCE.md` records the exact source repository and commit.

## GLB furniture models

The 17 GLB files under `public/office-assets/models/furniture/` contain only a
`UniGLTF-1.24` generator marker. They embed no author, source URL, license, or
attribution metadata, and the repository contains no separate attribution for
them.

Decision: provenance is not established. The target visual scene will use
code-native Three.js geometry. These GLB files are classified for removal after
checkpoint approval.

## Office background and image assets

`public/office-assets/backgrounds/office-bg.png`, the root screenshots, and the
branding images have no asset-specific provenance record. They are not required
by the autonomous UI.

Decision: the office background and non-validation images are classified for
removal. Validation screenshots created by this refactor remain as project
evidence and are clearly identified as such.

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
