#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_IDS = ("novaspine-memory", "novaspine-context", "nova-consciousness")
COMMON_ACTIVE_MEMORY_AGENTS = ("main", "main-lab", "discord-private", "discord-shared")


def _merge_missing(target: dict, defaults: dict) -> None:
    for key, value in defaults.items():
        if isinstance(value, dict):
            current = target.get(key)
            if not isinstance(current, dict):
                target[key] = deepcopy(value)
                continue
            _merge_missing(current, value)
            continue
        target.setdefault(key, deepcopy(value))


def _recommended_active_memory_agents(config_data: dict) -> list[str]:
    agents = config_data.get("agents")
    listed: list[str] = []
    if isinstance(agents, dict):
        entries = agents.get("list")
        if isinstance(entries, list):
            for item in entries:
                if not isinstance(item, dict):
                    continue
                agent_id = item.get("id") or item.get("name")
                if isinstance(agent_id, str) and agent_id and agent_id not in listed:
                    listed.append(agent_id)

    if not listed:
        return ["main"]

    common = [agent_id for agent_id in COMMON_ACTIVE_MEMORY_AGENTS if agent_id in listed]
    if common:
        return common

    return [listed[0]]


def _default_plugin_entries(base_url: str, consciousness_base_url: str, active_memory_agents: list[str]) -> dict:
    active_memory_config = {
        "enabled": True,
        "agents": active_memory_agents,
        "allowedChatTypes": ["direct", "group"],
        "queryMode": "recent",
        "promptStyle": "balanced",
        "timeoutMs": 12000,
        "maxSummaryChars": 220,
        "recentUserTurns": 2,
        "recentAssistantTurns": 1,
        "recentUserChars": 220,
        "recentAssistantChars": 180,
        "logging": False,
        "persistTranscripts": False,
        "transcriptDir": "active-memory",
    }
    return {
        "novaspine-memory": {
            "enabled": True,
            "config": {
                "baseUrl": base_url,
                "autoRecall": True,
                "autoCapture": True,
                "sessionIngestOnReset": True,
                "sessionSnapshotOnReset": True,
                "guidance": True,
                "recallTopK": 6,
                "recallMinScore": 0.005,
                "recallFormat": "xml",
                "timeoutMs": 20000,
                "captureCooldownMs": 300000,
                "ticketsTtlMs": 86400000,
                "activeMemory": active_memory_config,
            },
        },
        "novaspine-context": {
            "enabled": True,
            "config": {
                "baseUrl": base_url,
                "autoRecall": False,
                "sessionIngestOnBootstrap": False,
                "sessionIngestOnAfterTurn": False,
                "recallTopK": 6,
                "recallMinScore": 0.005,
                "recallFormat": "xml",
                "recentMessages": 8,
                "reserveTokens": 4096,
                "defaultTokenBudget": 36000,
                "timeoutMs": 20000,
                "mode": "balanced",
                "includeWorkspaceMemory": True,
                "recentMemoryFiles": 2,
            },
        },
        "nova-consciousness": {
            "enabled": True,
            "config": {
                "baseUrl": consciousness_base_url,
                "passiveCapture": True,
                "injectContinuity": True,
                "injectDashboard": False,
                "guidance": True,
                "requestTimeoutMs": 5000,
                "maxRecentMessages": 4,
                "maxRecentMessageChars": 240,
                "maxConversationContextChars": 2200,
                "maxMessageChars": 4200,
                "maxInjectedOpenLoops": 2,
                "maxInjectedNextActions": 2,
                "maxInjectedFacts": 2,
            },
        },
    }


def _default_paths(install_root: Path) -> list[str]:
    return [
        str(install_root / "packages" / "openclaw-memory-plugin"),
        str(install_root / "packages" / "openclaw-context-engine"),
        str(install_root / "packages" / "openclaw-consciousness"),
    ]


def _merge_plugin_entries(plugins: dict, defaults_map: dict[str, dict]) -> None:
    entries = plugins.setdefault("entries", {})

    if isinstance(entries, dict):
        for plugin_id, defaults in defaults_map.items():
            current = entries.get(plugin_id)
            if not isinstance(current, dict):
                entries[plugin_id] = deepcopy(defaults)
                continue
            _merge_missing(current, defaults)
        return

    if isinstance(entries, list):
        by_id: dict[str, dict] = {}
        for item in entries:
            if not isinstance(item, dict):
                continue
            plugin_id = item.get("name") or item.get("id") or item.get("plugin")
            if isinstance(plugin_id, str) and plugin_id:
                by_id[plugin_id] = item

        for plugin_id, defaults in defaults_map.items():
            current = by_id.get(plugin_id)
            if current is None:
                item = {"name": plugin_id}
                _merge_missing(item, defaults)
                entries.append(item)
                by_id[plugin_id] = item
                continue
            _merge_missing(current, defaults)
        return

    plugins["entries"] = deepcopy(defaults_map)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Patch an OpenClaw config with NovaSpine plugins.")
    parser.add_argument("--config", required=True, help="Path to openclaw.json")
    parser.add_argument("--install-root", required=True, help="Stable install root created by the NovaSpine installer")
    parser.add_argument("--base-url", default="http://127.0.0.1:8420", help="NovaSpine API base URL")
    parser.add_argument(
        "--consciousness-base-url",
        default="http://127.0.0.1:4111",
        help="Consciousness suite base URL",
    )
    parser.add_argument("--force-slots", action="store_true", help="Replace existing memory/contextEngine slot bindings")
    parser.add_argument("--no-backup", action="store_true", help="Do not create a timestamped backup before writing")
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    config_path = Path(args.config).expanduser()
    install_root = Path(args.install_root).expanduser()

    if not config_path.exists():
        raise SystemExit(f"OpenClaw config not found: {config_path}")

    original_text = config_path.read_text()
    data = json.loads(original_text)
    if not isinstance(data, dict):
        raise SystemExit("OpenClaw config must be a JSON object")

    plugins = data.setdefault("plugins", {})
    allow = plugins.setdefault("allow", [])
    for plugin_id in PLUGIN_IDS:
        if plugin_id not in allow:
            allow.append(plugin_id)

    load = plugins.setdefault("load", {})
    paths = load.setdefault("paths", [])
    for plugin_path in _default_paths(install_root):
        if plugin_path not in paths:
            paths.append(plugin_path)

    slots = plugins.setdefault("slots", {})
    if args.force_slots or "memory" not in slots:
        slots["memory"] = "novaspine-memory"
    if args.force_slots or "contextEngine" not in slots:
        slots["contextEngine"] = "novaspine-context"

    _merge_plugin_entries(
        plugins,
        _default_plugin_entries(
            args.base_url,
            args.consciousness_base_url,
            _recommended_active_memory_agents(data),
        ),
    )

    rendered = json.dumps(data, indent=2) + "\n"
    changed = rendered != original_text

    if changed and not args.no_backup:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        backup_path = config_path.with_name(f"{config_path.name}.bak.{stamp}")
        backup_path.write_text(original_text)

    if changed:
        config_path.write_text(rendered)

    print(
        json.dumps(
            {
                "status": "ok" if changed else "unchanged",
                "config": str(config_path),
                "install_root": str(install_root),
                "plugins_enabled": list(PLUGIN_IDS),
                "load_paths": _default_paths(install_root),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
