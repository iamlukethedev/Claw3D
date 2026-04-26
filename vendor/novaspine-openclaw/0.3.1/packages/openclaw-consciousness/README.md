# novaspine-openclaw-consciousness

Nova Consciousness Suite integration for OpenClaw.

This plugin keeps the user-facing experience quiet while wiring in:

- passive continuity tracking
- thread preservation across resets
- goals, decisions, learning, and confidence logging
- compact resume injection when a prior thread exists

## Install

```bash
./integrations/openclaw/install.sh
```

This package now lives inside the main `NovaSpine` repo so the reusable
memory+cognition stack ships together.

## Live Tools

- `nova_consciousness_status`
- `nova_consciousness_dashboard`
- `nova_consciousness_resume`
- `nova_consciousness_interaction`

## Command

```bash
/novaconsciousness status
/novaconsciousness dashboard
```

## Notes

The plugin is designed to stay low-noise:

- it does not dump internal state into normal replies
- it injects only a compact continuity block when a thread already exists
- it keeps the suite passive unless the user explicitly asks for dashboard/resume details

## License

See `LICENSE.txt` in this package and the repo root licensing notes.
