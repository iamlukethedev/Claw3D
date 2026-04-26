# NovaSpine OpenClaw Context Engine

This plugin registers NovaSpine as an OpenClaw `contextEngine` slot. It is the
deeper integration path compared with the memory plugin:

- assembles model context under a token budget
- injects NovaSpine recall into the system prompt
- ingests session transcripts into NovaSpine on bootstrap and after each turn
- preserves OpenClaw's chat flow while giving NovaSpine a direct role in
  context assembly

## Install

From the NovaSpine repo root:

```bash
./integrations/openclaw/install.sh
```

## Minimal Config

```json
{
  "plugins": {
    "allow": ["novaspine-context"],
    "slots": {
      "contextEngine": "novaspine-context"
    },
    "entries": {
      "novaspine-context": {
        "enabled": true,
        "config": {
          "baseUrl": "http://127.0.0.1:8420",
          "autoRecall": true,
          "sessionIngestOnBootstrap": true,
          "sessionIngestOnAfterTurn": true,
          "recallTopK": 5,
          "recallMinScore": 0.005,
          "recentMessages": 6,
          "reserveTokens": 2048,
          "timeoutMs": 12000
        }
      }
    }
  }
}
```

## Validation

```bash
openclaw plugins doctor
openclaw novaspine-context health
```
