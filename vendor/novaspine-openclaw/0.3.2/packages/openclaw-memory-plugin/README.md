# NovaSpine OpenClaw Memory Plugin

This plugin gives OpenClaw a native `memory` slot backed by NovaSpine's local
HTTP API. It is the low-risk integration path: OpenClaw stays in control of the
agent loop, while NovaSpine provides recall tools and optional auto-recall /
auto-capture.

## What It Covers

- native OpenClaw `memory` plugin scaffold
- `novaspine_recall` and `novaspine_store` tools
- automatic recall via `before_prompt_build`
- optional post-run capture of recent user messages
- `openclaw novaspine health|status|recall` CLI commands

## What It Does Not Replace

The plugin does not replace NovaSpine's session watcher or USC compression
pipeline. If you want transcript ingestion, session-level compression, and the
full "memory from raw agent logs" story, keep using the NovaSpine server plus
session hook / watcher path described in [docs/openclaw-plugin.md](../../docs/openclaw-plugin.md).

## Install

From the NovaSpine repo root:

```bash
./integrations/openclaw/install.sh
```

That installs the plugin packages into OpenClaw, patches the config safely when
`~/.openclaw/openclaw.json` exists, and writes an example config snippet.

## Minimal Config

```json
{
  "plugins": {
    "allow": ["novaspine-memory"],
    "slots": {
      "memory": "novaspine-memory"
    },
    "entries": {
      "novaspine-memory": {
        "enabled": true,
        "config": {
          "baseUrl": "http://127.0.0.1:8420",
          "autoRecall": true,
          "autoCapture": false,
          "sessionSnapshotMaxPerDay": 6,
          "recallTopK": 5,
          "recallMinScore": 0.005,
          "recallFormat": "xml",
          "timeoutMs": 12000
        }
      }
    }
  }
}
```

If your NovaSpine API is protected with `C3AE_API_TOKEN`, also set `apiToken`
in the plugin config.

## Validation

```bash
openclaw plugins list
openclaw plugins doctor
openclaw novaspine health
```
