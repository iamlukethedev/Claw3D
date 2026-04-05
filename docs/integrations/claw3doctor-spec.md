# Claw3Doctor Spec

> First-pass diagnostics plan for Claw3D deployments so users stop chasing the same setup failures manually.

## Goal

Provide a single diagnostics surface for the common "Claw3D cannot connect"
or "runtime support looks broken" cases.

The intent is similar to:

- `openclaw doctor`
- `hermes doctor`

but focused on Claw3D's integration points across providers.

## Primary Outcomes

`claw3doctor` should:

- identify the selected runtime profile/provider
- verify the gateway is reachable
- identify common auth/config mistakes
- surface provider-specific hints without making the whole app provider-specific
- reduce issue-thread back-and-forth

## First-Pass Scope

### Claw3D Settings / Environment

Checks:

- current runtime profile selection
- gateway URL presence
- token presence when required
- adapter/provider selection
- obvious `.env` misconfiguration

Outputs:

- selected provider/profile
- missing env or token warnings
- suspicious profile precedence warnings

### Gateway Reachability

Checks:

- can the configured gateway URL be reached?
- can Studio proxy the selected gateway?
- does the endpoint respond like a Claw3D-compatible gateway?

Outputs:

- reachable / unreachable
- timeout / refused / bad handshake
- wrong backend contract warning

### OpenClaw Checks

Checks:

- OpenClaw version
- pairing/device-approval state hints
- common remote secure-context failures
- common `1008`, `1011`, `1012` patterns

Outputs:

- version found / not found
- device approval guidance
- remote/Tailscale/public tunnel guidance

### Hermes Checks

Checks:

- Hermes adapter running
- Hermes API reachable
- Hermes model present
- auth key configured if required
- adapter env loaded correctly

Outputs:

- adapter found / missing
- API reachable / unreachable
- `401` / bad model / bad URL hints

### Auth / Token Checks

Checks:

- missing Studio access token
- gateway token missing
- invalid API key patterns
- profile says tokened backend but token is absent

Outputs:

- precise missing-token messages
- auth mismatch guidance

### WebSocket / Origin / Secure-Context Checks

Checks:

- localhost vs remote
- secure-context expectations
- browser/origin hints for public/tunneled deployments
- Cloudflare/ngrok/reverse-proxy warning patterns

Outputs:

- websocket handshake guidance
- origin/secure-context notes
- public tunnel caution notes

## Recommended Output Shape

`claw3doctor` should produce:

- short headline result
- categorized checks
- pass / warn / fail per item
- copy-pasteable next actions

Example:

```text
Claw3Doctor: WARN

[pass] Runtime profile: OpenClaw Default
[pass] Gateway URL reachable: ws://localhost:18789
[warn] OpenClaw version: 2026.4.2
[fail] Device approval required for remote browser
[warn] Secure-context mismatch for public remote setup

Suggested next actions:
1. openclaw devices approve --latest
2. retry from an approved browser/device
3. if using a public tunnel, test local/LAN direct first
```

## Runtime-Profile Awareness

`claw3doctor` should be designed against the runtime-profile model:

- provider
- runtime profile
- floor binding

That means the doctor should never assume:

- one backend
- one port
- one global runtime mode

Instead it should inspect the currently selected profile and run the
appropriate checks for that provider.

## Provider-Specific Guidance Rules

### OpenClaw

Focus on:

- pairing
- device identity
- remote websocket setup
- public/tunnel secure-context issues

### Hermes

Focus on:

- adapter process
- Hermes API reachability
- model/config correctness
- auth key presence

### Custom Runtime

Focus on:

- gateway contract compatibility
- reachability
- auth
- profile configuration

## Suggested Implementation Order

### PR 1: CLI / Script Scaffold

Add:

- doctor command entrypoint or script
- report formatter
- shared result types

### PR 2: Runtime Profile Checks

Add:

- selected profile inspection
- settings/env parsing
- gateway URL/token checks

### PR 3: Provider Checks

Add:

- OpenClaw checks
- Hermes checks
- custom runtime checks

### PR 4: Common Failure Classifiers

Add:

- websocket close-code guidance
- secure-context/origin hints
- reverse-proxy/tunnel notes

## Relationship To Office Systems

`claw3doctor` should land before more runtime complexity because it will
make debugging:

- multi-runtime support
- floor-to-profile binding
- public remote deployment

much less painful.

This is why it is sequenced ahead of deeper Office Systems feature work.

## V1 Delivery Boundary

`claw3doctor` v1 should be considered complete when it provides:

- selected-profile diagnostics with optional per-profile probing
- grouped terminal output with clear pass / warn / fail results
- JSON output for automation and issue reporting
- provider-aware checks for OpenClaw, Hermes, demo, and custom runtimes
- common failure classification for transport and auth problems
- concrete remediation for local, remote, tunneled, and adapter-backed setups

This keeps v1 reviewable as deployment diagnostics rather than letting it
turn into a full runtime orchestration project.

## V2 Expansion Backlog

After v1 lands, the next doctor-specific expansion should focus on better
diagnosis depth and better operator ergonomics rather than broader scope.

### Higher-Signal Runtime Heuristics

- deeper OpenClaw pairing and device-approval detection
- stronger close-code interpretation from real-world failures
- provider-specific contract validation for demo and custom runtimes
- better wrong-model / wrong-adapter mismatch detection

### Tunnel / Proxy Guidance

- Cloudflare-specific websocket and origin remediation
- Tailscale-specific remote deployment guidance
- reverse-proxy fingerprinting and likely-misconfiguration hints
- public-host checks when auth or secure-context expectations are missing

### Output / Workflow Improvements

- richer terminal presentation
- issue-template or bundle-friendly export
- in-app diagnostics panel later, reusing the same JSON report
- optional doctor autofix for safe configuration repairs

### Runtime-Profile Follow-Through

`claw3doctor` v2 should also benefit from the separate runtime-profile work:

- simultaneous runtime profile visibility
- per-profile health history
- floor-to-profile diagnosis once Office Systems binding is live

## Follow-Up Docs

After this spec, the next planning doc should be:

- floor schema and builder plan

That doc should define the metadata model before any admin-side floor
builder is implemented.
