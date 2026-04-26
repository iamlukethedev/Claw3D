#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from c3ae.config import Config
from c3ae.memory_spine.spine import MemorySpine


def _env_path(*names: str) -> Path | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return Path(value).expanduser()
    return None


def _guess_root(data_dir: Path) -> Path:
    explicit = _env_path(
        "NOVASPINE_ROOT",
        "NOVA_PROFILE_ROOT",
        "ARC_PROFILE_ROOT",
        "GEMMA4_PROFILE_ROOT",
    )
    if explicit:
        return explicit
    try:
        return data_dir.parents[1]
    except IndexError:
        return data_dir.parent


def _guess_profile_label(root: Path) -> str:
    explicit = os.environ.get("NOVASPINE_PROFILE_LABEL", "").strip()
    if explicit:
        return explicit
    mapping = {
        ".openclaw": "nemo",
        ".openclaw-arc": "arc",
        ".openclaw-gemma4": "saga",
        ".openclaw-dev": "nova",
    }
    return mapping.get(root.name, root.name.lstrip(".") or "novaspine")


def _status_dir(root: Path) -> Path:
    return _env_path(
        "NOVASPINE_STATUS_DIR",
        "NOVA_STATUS_DIR",
        "ARC_STATUS_DIR",
        "GEMMA4_STATUS_DIR",
    ) or (root / "status")


def _workspace_dir(root: Path) -> Path:
    return _env_path("NOVASPINE_WORKSPACE_DIR") or (root / "workspace")


def _machine_dir(root: Path) -> Path:
    return _env_path("NOVASPINE_DREAM_MACHINE_DIR") or (root / "memory" / ".dreams")


def _dream_diary_path(workspace_dir: Path) -> Path:
    return _env_path("NOVASPINE_DREAM_DIARY_PATH") or (workspace_dir / "DREAMS.md")


def _dream_state_path(status_dir: Path) -> Path:
    return _env_path("NOVASPINE_DREAM_STATE_PATH") or (status_dir / "novaspine-dream-status.json")


def _top_contradictions(report: dict[str, Any], limit: int = 3) -> list[str]:
    items = report.get("contradictions") or []
    lines: list[str] = []
    for item in items[:limit]:
        entity = str(item.get("entity") or item.get("src_name") or "unknown")
        relation = str(item.get("relation") or "contradiction")
        value = str(item.get("value") or item.get("dst_name") or "").strip()
        line = f"{entity} {relation}"
        if value:
            line = f"{line} -> {value}"
        lines.append(line)
    return lines


def _top_skill_candidates(report: dict[str, Any], limit: int = 3) -> list[str]:
    items = report.get("skill_candidates") or []
    lines: list[str] = []
    for item in items[:limit]:
        if isinstance(item, dict):
            label = str(item.get("title") or item.get("name") or item.get("summary") or "").strip()
            if label:
                lines.append(label)
    return lines


def _render_summary(profile: str, generated_at: str, report: dict[str, Any]) -> dict[str, Any]:
    consolidation = report.get("consolidation") or {}
    forgetting = report.get("forgetting_preview") or {}
    recompression = report.get("recompression_preview") or {}
    novelty = report.get("novelty") or {}
    contradictions = report.get("contradictions") or []
    skill_candidates = report.get("skill_candidates") or []
    summary = {
        "status": "ok",
        "profile": profile,
        "generated_at": generated_at,
        "clusters_created": int(consolidation.get("clusters_created", 0) or 0),
        "consolidated_created": int(consolidation.get("consolidated_created", 0) or 0),
        "forget_candidate_count": int(forgetting.get("candidate_count", 0) or 0),
        "contradictions_count": len(contradictions),
        "skill_candidate_count": len(skill_candidates),
        "recompression_candidate_count": int(recompression.get("candidate_count", 0) or 0),
        "novelty_ratio": float(novelty.get("novelty_ratio", 0.0) or 0.0),
        "top_contradictions": _top_contradictions(report),
        "top_skill_candidates": _top_skill_candidates(report),
        "report": report,
    }
    return summary


def _append_diary_entry(diary_path: Path, summary: dict[str, Any]) -> None:
    diary_path.parent.mkdir(parents=True, exist_ok=True)
    generated_at = str(summary["generated_at"])
    lines = [
        f"## {generated_at}",
        f"- Profile: {summary['profile']}",
        f"- Clusters created: {summary['clusters_created']}",
        f"- Consolidated memories created: {summary['consolidated_created']}",
        f"- Forget preview candidates: {summary['forget_candidate_count']}",
        f"- Contradictions: {summary['contradictions_count']}",
        f"- Skill candidates: {summary['skill_candidate_count']}",
        f"- Recompression candidates: {summary['recompression_candidate_count']}",
        f"- Novelty ratio: {summary['novelty_ratio']:.4f}",
    ]
    contradictions = summary.get("top_contradictions") or []
    if contradictions:
        lines.append("- Top contradictions:")
        lines.extend(f"  - {line}" for line in contradictions)
    skills = summary.get("top_skill_candidates") or []
    if skills:
        lines.append("- Top skill candidates:")
        lines.extend(f"  - {line}" for line in skills)
    block = "\n".join(lines).rstrip() + "\n\n"
    if not diary_path.exists():
        diary_path.write_text("# NovaSpine Dream Diary\n\n", encoding="utf-8")
    with diary_path.open("a", encoding="utf-8") as handle:
        handle.write(block)


def main() -> int:
    data_dir = _env_path("C3AE_DATA_DIR") or (Path.home() / ".local" / "share" / "novaspine")
    root = _guess_root(data_dir)
    workspace_dir = _workspace_dir(root)
    status_dir = _status_dir(root)
    machine_dir = _machine_dir(root)
    profile = _guess_profile_label(root)
    dream_state_path = _dream_state_path(status_dir)
    dream_diary_path = _dream_diary_path(workspace_dir)

    config = Config()
    config.data_dir = data_dir
    spine = MemorySpine(config)
    try:
        report = spine.dream_consolidate()
    finally:
        asyncio.run(spine.close())

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    summary = _render_summary(profile, generated_at, report)

    status_dir.mkdir(parents=True, exist_ok=True)
    machine_dir.mkdir(parents=True, exist_ok=True)
    dream_state_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (machine_dir / "latest.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    _append_diary_entry(dream_diary_path, summary)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
