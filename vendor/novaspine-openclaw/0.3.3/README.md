This directory vendors the NovaSpine OpenClaw integration assets used by Claw3D.

Source snapshot:
- repo: `maddwiz/NovaSpine`
- version: `0.3.3`

Why this exists:
- Claw3D uses a pinned NovaSpine package version for Python install time, preferring the bundled wheel.
- Claw3D also needs a stable, reviewable snapshot of the OpenClaw plugin assets and config patcher.
- Vendoring these assets avoids cloning a moving GitHub repo during user setup.

Update policy:
- bump the pinned NovaSpine version intentionally
- refresh this asset bundle from the matching NovaSpine release
- rerun Claw3D typecheck and tests before shipping

Included in this snapshot:
- OpenClaw `2026.4.12` compatibility fixes already carried by NovaSpine
- personal-memory retrieval boosting for first-person questions
- structured current-state routing for changed facts like old city -> current city
