# Claw3D OpenClaw Skills

This directory contains OpenClaw agent skills that integrate with Claw3D Studio.

## Available Skills

| Skill | Description | Issue |
|-------|-------------|-------|
| `claw3d-text` | Send text/SMS messages through the office SMS booth | [#9](https://github.com/iamlukethedev/Claw3D/issues/9) |
| `claw3d-voice` | Voice calls and replies through the office phone booth | [#10](https://github.com/iamlukethedev/Claw3D/issues/10) |

## Installation

Copy the skill directory into your OpenClaw workspace skills folder:

```bash
# From this repo
cp -r skills/claw3d-text ~/.openclaw/skills/
cp -r skills/claw3d-voice ~/.openclaw/skills/
```

Or install via ClawHub once published:

```bash
clawhub install claw3d-text
clawhub install claw3d-voice
```

## Prerequisites

- A running Claw3D Studio instance (provides the API endpoints)
- `curl` available on the agent host
- For voice features: `ELEVENLABS_API_KEY` configured on the Studio host

## Configuration

Set `CLAW3D_STUDIO_URL` on the agent host to point to your Studio instance:

```bash
export CLAW3D_STUDIO_URL="http://localhost:3000"
```

If Studio requires authentication, set:

```bash
export STUDIO_ACCESS_TOKEN="your-token"
```

## Architecture

```
Agent (OpenClaw)  →  Skill scripts  →  Claw3D Studio API  →  Provider (Twilio/ElevenLabs)
                                              ↓
                                    3D Office visualization
                                    (booth animations, etc.)
```

Skills route through the Studio API layer, which:
1. Handles the request and builds a scenario
2. Triggers office visualization (booth movement, animations)
3. Routes to the delivery provider when configured
4. Returns the result to the agent

## Current Limitations

Both skills currently use **mock delivery** — the Studio API builds realistic
scenarios but does not deliver real SMS or make real phone calls. Provider
integration (Twilio for calls/SMS, ElevenLabs for voice) is the next step.

## Contributing

When adding new skills:
1. Follow the [OpenClaw skill spec](https://docs.openclaw.ai)
2. Include a `SKILL.md` with YAML frontmatter
3. Add helper scripts in `scripts/`
4. Keep skills focused — one capability per skill
5. Update this README
