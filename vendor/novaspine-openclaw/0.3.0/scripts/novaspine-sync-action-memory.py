#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import sqlite3
import site
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(os.environ.get("NOVASPINE_REPO", Path(__file__).resolve().parents[3]))
VENV_PYTHON = Path(os.environ.get("NOVASPINE_PYTHON", ""))
if (
    os.environ.get("NOVASPINE_SYNC_BOOTSTRAPPED") != "1"
    and VENV_PYTHON.exists()
    and Path(sys.executable).resolve() != VENV_PYTHON.resolve()
):
    env = dict(os.environ)
    env["NOVASPINE_SYNC_BOOTSTRAPPED"] = "1"
    os.execve(str(VENV_PYTHON), [str(VENV_PYTHON), __file__, *sys.argv[1:]], env)

if VENV_PYTHON.exists():
    for candidate in VENV_PYTHON.resolve().parent.parent.glob("lib/python*/site-packages"):
        site.addsitedir(str(candidate))

sys.path.insert(0, str(REPO_ROOT / "src"))

from c3ae.config import Config
from c3ae.ingestion.session_parser import SessionParser
from c3ae.memory_spine.spine import MemorySpine
from c3ae.types import Chunk


INGEST_ROLES = {"user", "assistant", "tool_error", "tool_fix", "tool_result"}
WATCH_DIRS = [Path(os.environ.get("NOVASPINE_OPENCLAW_DIR", Path.home() / ".openclaw" / "agents"))]
STRONG_TECH_HINTS = (
    "codex",
    "openclaw",
    "github",
    "git ",
    "branch",
    "commit",
    "repo",
    "worktree",
    "build",
    "test",
    "release",
    "verify-release",
    "service",
    "plugin",
    "systemd",
    "launchd",
    "frontend",
    "backend",
    "api",
    "automation",
    "the lab",
    "ssh ",
    "runbook.md",
    "qa.md",
    "project_manifest.json",
)
ERROR_HINTS = (
    "error",
    "failed",
    "failing",
    "failure",
    "timeout",
    "timed out",
    "blocked",
    "exception",
    "traceback",
    "crash",
    "missing",
    "invalid",
    "rejected",
    "unauthorized",
    "disconnect",
    "stale",
)
FIX_HINTS = (
    "fixed",
    "fix ",
    "patched",
    "repair",
    "repaired",
    "resolved",
    "rewired",
    "restarted",
    "recovered",
    "corrected",
    "cleared",
    "merged",
    "hardened",
    "deployed",
    "deployed",
)
RESULT_HINTS = (
    "verified",
    "passes",
    "passing",
    "smoke test",
    "release ready",
    "online",
    "running",
    "pushed",
    "merged to main",
    "commit ",
    "healthy",
)
PROJECT_PATTERNS = [
    re.compile(r"apps/([a-z0-9][a-z0-9-]{1,80})", re.IGNORECASE),
    re.compile(r"\b(?:nemo|nova)/([a-z0-9][a-z0-9-]{1,80})\b", re.IGNORECASE),
    re.compile(r"\b([a-z0-9]+(?:-[a-z0-9]+){1,6})\b", re.IGNORECASE),
]
ERROR_KIND_PATTERNS = [
    (re.compile(r"timeout|timed out", re.IGNORECASE), "timeout"),
    (re.compile(r"unauthorized|forbidden|permission", re.IGNORECASE), "auth"),
    (re.compile(r"missing|not found|absent", re.IGNORECASE), "missing_artifact"),
    (re.compile(r"branch|merge|origin/main", re.IGNORECASE), "branch_state"),
    (re.compile(r"manifest|runbook|qa\.md|verify-release", re.IGNORECASE), "release_artifact"),
    (re.compile(r"disconnect|reconnect|stale", re.IGNORECASE), "connection"),
    (re.compile(r"plugin|acpx|codex", re.IGNORECASE), "tooling"),
    (re.compile(r"build|test|lint|typecheck", re.IGNORECASE), "build_validation"),
]
FIX_METHOD_PATTERNS = [
    (re.compile(r"restart", re.IGNORECASE), "restart_service"),
    (re.compile(r"merge", re.IGNORECASE), "merge_branch"),
    (re.compile(r"patch|patched|rewrite|rewire|correct", re.IGNORECASE), "code_patch"),
    (re.compile(r"harden|verify-release|qa\.md|runbook|manifest", re.IGNORECASE), "release_hardening"),
    (re.compile(r"deploy|pushed|push", re.IGNORECASE), "deploy"),
]
MODULE_PATTERNS = [
    re.compile(r"\b([A-Za-z0-9_.-]+\.(?:js|ts|mjs|py|json|md|sh|service|plist))\b"),
]

NOISE_CAPTURE_KINDS = {"standing_instruction"}
SANITIZE_PROFILE = str(os.environ.get("NOVASPINE_SANITIZE_PROFILE", "")).strip().lower()


def _data_dir() -> Path:
    return Path(os.environ.get("C3AE_DATA_DIR", Path.home() / ".local" / "share" / "novaspine"))


def _extend_watch_dirs() -> None:
    raw = str(os.environ.get("NOVASPINE_EXTRA_WATCH_DIRS", "")).strip()
    if not raw:
        return
    for chunk in re.split(r"[:\n,]+", raw):
        candidate = chunk.strip()
        if not candidate:
            continue
        WATCH_DIRS.append(Path(candidate).expanduser())


_extend_watch_dirs()


def _iter_session_files() -> list[Path]:
    files: list[Path] = []
    for watch_dir in WATCH_DIRS:
        if not watch_dir.exists():
            continue
        for path in watch_dir.rglob("*.jsonl"):
            try:
                if path.is_file():
                    files.append(path)
            except FileNotFoundError:
                continue
    return sorted(files)


def _stable_chunk_id(session_id: str, role: str, index: int, content: str) -> str:
    digest = hashlib.sha1(f"{session_id}|{role}|{index}|{content}".encode("utf-8", errors="ignore")).hexdigest()
    return f"session-{digest[:32]}"


def _stable_synthetic_id(session_id: str, role: str, index: int, source_chunk_id: str) -> str:
    digest = hashlib.sha1(f"{session_id}|{role}|{index}|{source_chunk_id}".encode("utf-8", errors="ignore")).hexdigest()
    return f"synthetic-{digest[:32]}"


def _normalize_space(text: str) -> str:
    return " ".join(str(text or "").split())


def _trim(text: str, limit: int = 420) -> str:
    compact = _normalize_space(text)
    return compact[:limit]


def _first_match(text: str, patterns: list[re.Pattern[str]]) -> str:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return match.group(1)
    return ""


def _derive_project_scope(text: str, metadata: dict[str, Any]) -> str:
    for key in ("project_scope", "workspace_dir"):
        value = _normalize_space(metadata.get(key, ""))
        if value and value != "/":
            if "/" not in value:
                return value.lower()
    for pattern in PROJECT_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        slug = match.group(1).strip().lower()
        if slug in {"origin", "systemd", "launchd", "codex", "openclaw"}:
            continue
        return slug
    return "global"


def _derive_module_scope(text: str, metadata: dict[str, Any]) -> str:
    explicit = _normalize_space(metadata.get("module_scope", ""))
    if explicit:
        return explicit
    source_file = _normalize_space(metadata.get("source_file", ""))
    if source_file:
        source_name = Path(source_file).name
        if source_name.endswith(".jsonl"):
            return source_name
    return _first_match(text, MODULE_PATTERNS)


def _derive_error_kind(text: str) -> str:
    for pattern, label in ERROR_KIND_PATTERNS:
        if pattern.search(text):
            return label
    return "runtime_error"


def _derive_fix_method(text: str) -> str:
    for pattern, label in FIX_METHOD_PATTERNS:
        if pattern.search(text):
            return label
    return "code_patch"


def _is_noise_metadata(metadata: dict[str, Any]) -> bool:
    source = _normalize_space(metadata.get("source", "")).lower()
    if source == "prompt_capture":
        return True

    capture_kind = _normalize_space(metadata.get("capture_kind", "")).lower()
    if capture_kind in NOISE_CAPTURE_KINDS:
        return True

    bridge_record_id = _normalize_space(metadata.get("bridgeRecordId", ""))
    bridge_title = _normalize_space(metadata.get("bridgeTitle", ""))
    memory_kind = _normalize_space(metadata.get("memoryKind", "")).lower()
    if bridge_record_id.startswith("thread-memory-"):
        return True
    if memory_kind == "detail" and bridge_title.lower().startswith("continuity for "):
        return True

    return False


def _sanitize_chunk_content(content: str, metadata: dict[str, Any]) -> str:
    text = _normalize_space(content)
    if not text:
        return ""
    if SANITIZE_PROFILE not in {"arc", "nova", "gemma4"} and not os.environ.get("NOVASPINE_AGENT_NAME"):
        return text

    profile_defaults = {
        "arc": ("Arc", ["arc", "agent3"], ["ARC_OK", "AGENT3_OK"]),
        "nova": ("Nova", ["nova"], ["NOVA_PRIVATE_OK", "MEMORY_OK"]),
        "gemma4": ("Saga", ["saga", "gemma4"], ["GEMMA4_OK", "SAGA_SPEED_OK"]),
    }
    default_name, default_handles, default_markers = profile_defaults.get(
        SANITIZE_PROFILE,
        (
            os.environ.get("NOVASPINE_AGENT_NAME", "Agent").strip() or "Agent",
            [],
            [],
        ),
    )
    profile_name = os.environ.get("NOVASPINE_AGENT_NAME", default_name).strip() or default_name
    profile_source_type = str(
        os.environ.get("NOVASPINE_SOURCE_TYPE", f"{SANITIZE_PROFILE or 'openclaw'}_session_message")
    ).strip()
    raw_handles = os.environ.get("NOVASPINE_AGENT_HANDLES", "")
    raw_markers = os.environ.get("NOVASPINE_REPLY_MARKERS", "")
    profile_at_handles = [value.strip().lower() for value in raw_handles.split(",") if value.strip()] or list(default_handles)
    profile_reply_markers = [value.strip() for value in raw_markers.split(",") if value.strip()] or list(default_markers)
    if SANITIZE_PROFILE == "arc":
        legacy_agent_label = "Agent" + "3"
    else:
        legacy_agent_label = ""

    cleaned = text
    if cleaned.startswith("[NovaSpine Recall]"):
        cleaned = re.sub(
            r"^\[NovaSpine Recall\]\s*(?:<relevant-memories>.*?</relevant-memories>\s*)+",
            "",
            cleaned,
            flags=re.DOTALL,
        ).strip()
    if cleaned.startswith("Consciousness continuity context:"):
        if "\nMessage:\n" in content:
            cleaned = content.split("\nMessage:\n", 1)[1].strip()
        elif "\n\n" in content:
            cleaned = content.split("\n\n", 1)[1].strip()
        cleaned = _normalize_space(cleaned)

    if (
        f"You are {profile_name}, an OpenClaw agent connected to The Lab" in content
        or (
            SANITIZE_PROFILE == "arc"
            and f"You are {legacy_agent_label}, an OpenClaw agent connected to The Lab" in content
        )
        or f"You are {profile_name}, a persistent AI partner with durable NovaSpine memory" in content
    ):
        if "Message:" in content:
            cleaned = _normalize_space(content.split("Message:", 1)[1].strip())
        else:
            cleaned = ""

    cleaned = re.sub(r"^\[DiscordRoute:[^\]]+\]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^\[DiscordMode:[^\]]+\]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^\[DiscordRequest:[^\]]+\]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^\[DiscordChannel:[^\]]+\]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^\[Discord:[^\]]+\]\s*", "", cleaned, flags=re.IGNORECASE).strip()
    if profile_at_handles:
        cleaned = re.sub(rf"^@(?:{'|'.join(profile_at_handles)})\s*", "", cleaned, flags=re.IGNORECASE).strip()

    if profile_reply_markers and re.search(
        rf"\bReply with exactly (?:{'|'.join(profile_reply_markers)})\.?\b",
        cleaned,
        flags=re.IGNORECASE,
    ):
        return ""
    if re.search(r"\breply exactly with NO_REPLY\.?\b", cleaned, flags=re.IGNORECASE):
        return ""

    if cleaned != text:
        metadata["sanitized_wrapper"] = True
    if SANITIZE_PROFILE:
        metadata[f"{SANITIZE_PROFILE}_profile"] = SANITIZE_PROFILE
    metadata.setdefault("source_type", profile_source_type)
    return cleaned


def _looks_technical(text: str, metadata: dict[str, Any]) -> bool:
    lowered = text.lower()
    source_file = str(metadata.get("source_file") or "").lower()
    if any(token in source_file for token in ("/autonomy/", "/autonomy-lab/", "/codex/", "/main-lab/")):
        return True
    return any(token in lowered for token in STRONG_TECH_HINTS)


def _classify_action(text: str, source_role: str, metadata: dict[str, Any]) -> dict[str, str] | None:
    summary = _trim(text)
    if len(summary) < 40 or not _looks_technical(summary, metadata):
        return None

    lowered = summary.lower()
    has_error = any(token in lowered for token in ERROR_HINTS)
    has_fix = any(token in lowered for token in FIX_HINTS)
    has_result = any(token in lowered for token in RESULT_HINTS)

    role = ""
    if source_role == "assistant":
        if has_fix:
            role = "tool_fix"
        elif has_result:
            role = "tool_result"
        elif has_error:
            role = "tool_error"
    elif source_role == "user":
        if has_error:
            role = "tool_error"

    if not role:
        return None

    project_scope = _derive_project_scope(summary, metadata)
    module_scope = _derive_module_scope(summary, metadata)
    error_kind = _derive_error_kind(summary) if has_error or role == "tool_fix" else ""
    fix_method = _derive_fix_method(summary) if role == "tool_fix" else ""
    error_signature = f"{project_scope}:{error_kind}:{module_scope or 'general'}"

    return {
        "role": role,
        "summary": summary,
        "project_scope": project_scope,
        "module_scope": module_scope,
        "error_kind": error_kind,
        "fix_method": fix_method,
        "error_signature": error_signature,
    }


async def _flush_embeddings(spine: MemorySpine, chunk_ids: list[str], texts: list[str]) -> None:
    if not chunk_ids:
        return
    await spine._embed_and_index(chunk_ids, texts)
    chunk_ids.clear()
    texts.clear()


def _find_existing_chunk(spine: MemorySpine, session_id: str, role: str, index: int):
    finder = getattr(spine.sqlite, "find_chunk_by_session_role_index", None)
    if callable(finder):
        return finder(session_id, role, index)

    row = spine.sqlite._conn.execute(
        """SELECT id, content, metadata
           FROM chunks
           WHERE json_extract(metadata, '$.session_id') = ?
             AND json_extract(metadata, '$.role') = ?
             AND json_extract(metadata, '$.index') = ?
           LIMIT 1""",
        (session_id, role, index),
    ).fetchone()
    if row is None:
        return None

    class ExistingChunk:
        def __init__(self, raw: Any):
            self.id = raw["id"]
            self.content = raw["content"]
            metadata = raw["metadata"]
            self.metadata = json.loads(metadata) if isinstance(metadata, str) else dict(metadata or {})

    return ExistingChunk(row)


def _upsert_chunk(spine: MemorySpine, chunk: Chunk, chunk_ids: list[str], texts: list[str]) -> tuple[bool, bool]:
    metadata = dict(chunk.metadata or {})
    existing = _find_existing_chunk(
        spine,
        str(metadata.get("session_id", "")),
        str(metadata.get("role", "")),
        int(metadata.get("index", -1)),
    )
    if existing is not None:
        existing_metadata = dict(existing.metadata or {})
        if existing.content == chunk.content and existing_metadata == metadata:
            return False, False
        content_changed = existing.content != chunk.content
        if content_changed:
            try:
                spine.faiss.remove(existing.id)
            except Exception:
                pass
        updater = getattr(spine.sqlite, "update_chunk", None)
        if callable(updater):
            updater(existing.id, content=chunk.content, metadata=metadata)
        else:
            spine.sqlite._conn.execute(
                "UPDATE chunks SET content = ?, metadata = ? WHERE id = ?",
                (chunk.content, json.dumps(metadata, sort_keys=True), existing.id),
            )
            spine.sqlite._conn.commit()
        if content_changed:
            chunk_ids.append(existing.id)
            texts.append(chunk.content)
        return False, True

    try:
        spine.sqlite.insert_chunk(chunk)
    except sqlite3.IntegrityError as exc:
        if "chunks.id" not in str(exc):
            raise
        return False, False
    if not bool(metadata.get("skip_graph_index")):
        spine._index_graph_chunk(chunk.id, chunk.content, metadata)
    if not bool(metadata.get("skip_fact_index")):
        spine._index_structured_facts(chunk.id, chunk.content, metadata)
    chunk_ids.append(chunk.id)
    texts.append(chunk.content)
    return True, False


async def main_async() -> int:
    config = Config()
    config.data_dir = _data_dir()
    config.ensure_dirs()
    spine = MemorySpine(config)
    parser = SessionParser()

    scanned_files = 0
    session_inserted = 0
    session_refreshed = 0
    synthetic_inserted = 0
    synthetic_refreshed = 0
    synthetic_by_role: dict[str, int] = {}
    chunk_ids: list[str] = []
    texts: list[str] = []

    try:
        for path in _iter_session_files():
            scanned_files += 1
            try:
                session_chunks = parser.parse_file(path)
            except Exception:
                continue

            for sc in session_chunks:
                if sc.role not in INGEST_ROLES:
                    continue

                metadata = {
                    "role": sc.role,
                    "session_id": sc.session_id,
                    "source_file": sc.source_file,
                    "index": sc.index,
                }
                metadata.update(sc.metadata)
                if _is_noise_metadata(metadata):
                    continue
                content = _sanitize_chunk_content(sc.content, metadata)
                if not content:
                    continue
                chunk = Chunk(
                    id=_stable_chunk_id(sc.session_id, sc.role, sc.index, content),
                    content=content,
                    source_id=f"session:{sc.session_id}",
                    metadata=metadata,
                )
                inserted, refreshed = _upsert_chunk(spine, chunk, chunk_ids, texts)
                session_inserted += int(inserted)
                session_refreshed += int(refreshed)

                if len(chunk_ids) >= 64:
                    await _flush_embeddings(spine, chunk_ids, texts)

        rows = spine.sqlite._conn.execute(
            """SELECT id, content, metadata
               FROM chunks
               WHERE json_extract(metadata, '$.source_file') IS NOT NULL
                 AND json_extract(metadata, '$.role') IN ('user', 'assistant')
               ORDER BY created_at DESC"""
        ).fetchall()

        for row in rows:
            metadata = json.loads(row["metadata"])
            if _is_noise_metadata(metadata):
                continue
            if metadata.get("synthetic_action_memory"):
                continue
            classification = _classify_action(str(row["content"]), str(metadata.get("role", "")), metadata)
            if not classification:
                continue

            synthetic_metadata = {
                "role": classification["role"],
                "session_id": metadata.get("session_id", ""),
                "source_file": metadata.get("source_file", ""),
                "index": metadata.get("index", -1),
                "source_role": metadata.get("role", ""),
                "source_chunk_id": row["id"],
                "synthetic_action_memory": True,
                "action_memory": True,
                "action_summary": classification["summary"],
                "project_scope": classification["project_scope"],
                "module_scope": classification["module_scope"],
                "skip_graph_index": False,
                "skip_fact_index": False,
            }
            if classification["role"] == "tool_error":
                synthetic_metadata["error_kind"] = classification["error_kind"]
                synthetic_metadata["error_signature"] = classification["error_signature"]
            elif classification["role"] == "tool_fix":
                synthetic_metadata["resolved_error_kind"] = classification["error_kind"]
                synthetic_metadata["resolved_error_signature"] = classification["error_signature"]
                synthetic_metadata["fix_method"] = classification["fix_method"]
                synthetic_metadata["resolved_failure"] = classification["summary"]
            else:
                synthetic_metadata["result_kind"] = "technical_progress"

            synthetic_content = classification["summary"]
            synthetic_chunk = Chunk(
                id=_stable_synthetic_id(
                    str(synthetic_metadata["session_id"]),
                    str(synthetic_metadata["role"]),
                    int(synthetic_metadata["index"]),
                    str(row["id"]),
                ),
                content=synthetic_content,
                source_id=f"session:{synthetic_metadata['session_id']}",
                metadata=synthetic_metadata,
            )
            inserted, refreshed = _upsert_chunk(spine, synthetic_chunk, chunk_ids, texts)
            synthetic_inserted += int(inserted)
            synthetic_refreshed += int(refreshed)
            if inserted or refreshed:
                role = classification["role"]
                synthetic_by_role[role] = synthetic_by_role.get(role, 0) + 1

            if len(chunk_ids) >= 64:
                await _flush_embeddings(spine, chunk_ids, texts)

        await _flush_embeddings(spine, chunk_ids, texts)
        if spine.config.faiss_dir:
            spine.faiss.save()

        print(
            json.dumps(
                {
                    "status": "ok",
                    "scanned_files": scanned_files,
                    "session_inserted": session_inserted,
                    "session_refreshed": session_refreshed,
                    "synthetic_inserted": synthetic_inserted,
                    "synthetic_refreshed": synthetic_refreshed,
                    "synthetic_by_role": synthetic_by_role,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    finally:
        await spine.close()


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
