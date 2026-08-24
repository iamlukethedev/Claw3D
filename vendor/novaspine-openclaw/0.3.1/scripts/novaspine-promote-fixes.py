#!/usr/bin/env python3
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

from c3ae.config import Config
from c3ae.memory_spine.spine import MemorySpine


def _data_dir() -> Path:
    return Path(os.environ.get("C3AE_DATA_DIR", Path.home() / ".local" / "share" / "novaspine"))


def _normalize_label(raw: str) -> str:
    text = str(raw or "").strip().replace("_", " ")
    return " ".join(part for part in text.split() if part)


def _trim(text: str, limit: int = 220) -> str:
    compact = " ".join(str(text or "").split())
    return compact[:limit]


def _top_lines(rows: list[str], limit: int = 3) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for row in rows:
        line = _trim(row)
        if not line or line in seen:
            continue
        seen.add(line)
        out.append(line)
        if len(out) >= limit:
            break
    return out


def _label_for_group(error_kind: str, error_signature: str) -> str:
    kind = str(error_kind or "").strip()
    if kind and kind != "runtime_error":
        return _normalize_label(kind)

    signature_tokens = []
    for token in str(error_signature or "").replace("_", " ").split():
        lowered = token.strip().lower()
        if not lowered or lowered in {"runtime", "error", "tool", "use", "exit", "null"}:
            continue
        signature_tokens.append(token)
        if len(signature_tokens) >= 5:
            break
    label = " ".join(signature_tokens).strip()
    return _normalize_label(label or kind or error_signature or "runtime error")


def _find_reasoning_entry_by_metadata(spine: MemorySpine, key: str, value: str):
    finder = getattr(spine.sqlite, "find_reasoning_entry_by_metadata", None)
    if callable(finder):
        return finder(key, value)
    return spine.sqlite._conn.execute(
        f"""SELECT id
            FROM reasoning_bank
            WHERE json_extract(metadata, '$.{key}') = ?
            LIMIT 1""",
        (value,),
    ).fetchone()


def _find_skill_capsule_by_metadata(spine: MemorySpine, key: str, value: str):
    finder = getattr(spine.sqlite, "find_skill_capsule_by_metadata", None)
    if callable(finder):
        return finder(key, value)
    return spine.sqlite._conn.execute(
        f"""SELECT id
            FROM skill_capsules
            WHERE json_extract(metadata, '$.{key}') = ?
            LIMIT 1""",
        (value,),
    ).fetchone()


async def _upsert_knowledge_note(
    spine: MemorySpine,
    *,
    key: str,
    key_field: str,
    title: str,
    content: str,
    tags: list[str],
    metadata: dict[str, Any],
    session_id: str | None = None,
):
    upsert = getattr(spine, "upsert_knowledge_note", None)
    if callable(upsert):
        return await upsert(
            key=key,
            key_field=key_field,
            title=title,
            content=content,
            tags=tags,
            metadata=metadata,
            session_id=session_id,
        )

    existing = _find_reasoning_entry_by_metadata(spine, key_field, key)
    conn = spine.sqlite._conn
    payload_tags = json.dumps(tags)
    payload_metadata = json.dumps(metadata, sort_keys=True)
    now = datetime.now(timezone.utc).isoformat()
    if existing is not None:
        conn.execute(
            """UPDATE reasoning_bank
               SET title = ?, content = ?, tags = ?, metadata = ?, session_id = COALESCE(?, session_id)
               WHERE id = ?""",
            (title, content, payload_tags, payload_metadata, session_id, existing["id"]),
        )
        conn.commit()
        return existing

    entry_id = f"reasoning-{hashlib.sha1(f'{key_field}:{key}'.encode('utf-8', errors='ignore')).hexdigest()[:24]}"
    conn.execute(
        """INSERT INTO reasoning_bank(id, title, content, tags, evidence_ids, status, superseded_by, session_id, metadata, created_at)
           VALUES(?, ?, ?, ?, '[]', 'active', NULL, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             content = excluded.content,
             tags = excluded.tags,
             session_id = COALESCE(excluded.session_id, reasoning_bank.session_id),
             metadata = excluded.metadata""",
        (entry_id, title, content, payload_tags, session_id, payload_metadata, now),
    )
    conn.commit()
    return {"id": entry_id}


async def _upsert_skill_capsule(
    spine: MemorySpine,
    *,
    key: str,
    key_field: str,
    name: str,
    description: str,
    procedure: str,
    tags: list[str],
    metadata: dict[str, Any],
):
    upsert = getattr(spine, "upsert_skill_capsule", None)
    if callable(upsert):
        return await upsert(
            key=key,
            key_field=key_field,
            name=name,
            description=description,
            procedure=procedure,
            tags=tags,
            metadata=metadata,
        )

    existing = _find_skill_capsule_by_metadata(spine, key_field, key)
    conn = spine.sqlite._conn
    payload_tags = json.dumps(tags)
    payload_metadata = json.dumps(metadata, sort_keys=True)
    now = datetime.now(timezone.utc).isoformat()
    if existing is not None:
        conn.execute(
            """UPDATE skill_capsules
               SET name = ?, description = ?, procedure = ?, tags = ?, metadata = ?
               WHERE id = ?""",
            (name, description, procedure, payload_tags, payload_metadata, existing["id"]),
        )
        conn.commit()
        return existing

    capsule_id = f"skill-{hashlib.sha1(f'{key_field}:{key}'.encode('utf-8', errors='ignore')).hexdigest()[:24]}"
    conn.execute(
        """INSERT INTO skill_capsules(id, name, description, procedure, tags, version, metadata, created_at)
           VALUES(?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             procedure = excluded.procedure,
             tags = excluded.tags,
             metadata = excluded.metadata""",
        (capsule_id, name, description, procedure, payload_tags, payload_metadata, now),
    )
    conn.commit()
    return {"id": capsule_id}


async def main_async() -> int:
    config = Config()
    config.data_dir = _data_dir()
    config.ensure_dirs()
    spine = MemorySpine(config)
    min_occurrences = max(1, int(os.environ.get("NOVASPINE_PROMOTE_MIN_OCCURRENCES", "2")))
    min_distinct_sessions = max(1, int(os.environ.get("NOVASPINE_PROMOTE_MIN_DISTINCT_SESSIONS", "2")))

    promoted_notes = 0
    promoted_skills = 0
    groups_considered = 0
    groups_promoted = 0

    try:
        rows = spine.sqlite._conn.execute(
            """SELECT id, content, metadata
               FROM chunks
               WHERE json_extract(metadata, '$.role') = 'tool_fix'
               ORDER BY created_at DESC"""
        ).fetchall()

        groups: dict[str, dict[str, Any]] = {}
        for row in rows:
            metadata = json.loads(row["metadata"])
            project_scope = str(metadata.get("project_scope") or "global").strip() or "global"
            error_signature = str(
                metadata.get("resolved_error_signature")
                or metadata.get("error_signature")
                or metadata.get("resolved_error_kind")
                or metadata.get("error_kind")
                or ""
            ).strip()
            if not error_signature:
                continue
            promotion_key = hashlib.sha1(
                f"{project_scope}|{error_signature}".encode("utf-8", errors="ignore")
            ).hexdigest()[:20]
            group = groups.setdefault(
                promotion_key,
                {
                    "project_scope": project_scope,
                    "error_signature": error_signature,
                    "error_kind": str(
                        metadata.get("resolved_error_kind")
                        or metadata.get("error_kind")
                        or ""
                    ).strip(),
                    "modules": Counter(),
                    "fix_methods": Counter(),
                    "sessions": set(),
                    "errors": [],
                    "fixes": [],
                    "chunk_ids": [],
                },
            )
            group["sessions"].add(str(metadata.get("session_id", "")).strip())
            module_scope = str(metadata.get("module_scope", "")).strip()
            if module_scope:
                group["modules"][module_scope] += 1
            fix_method = str(metadata.get("fix_method", "")).strip()
            if fix_method:
                group["fix_methods"][fix_method] += 1
            if metadata.get("resolved_failure"):
                group["errors"].append(str(metadata["resolved_failure"]))
            group["fixes"].append(str(row["content"]))
            group["chunk_ids"].append(str(row["id"]))

        for promotion_key, group in groups.items():
            groups_considered += 1
            occurrence_count = len(group["fixes"])
            distinct_sessions = len({sid for sid in group["sessions"] if sid})
            if occurrence_count < min_occurrences and distinct_sessions < min_distinct_sessions:
                continue

            groups_promoted += 1
            project_scope = group["project_scope"]
            error_label = _label_for_group(group["error_kind"], group["error_signature"])
            title_project = f"{project_scope}: " if project_scope != "global" else ""
            title = f"{title_project}fix pattern for {error_label}"
            description = (
                f"Repeated debugging pattern for {error_label} in {project_scope}. "
                f"Observed {occurrence_count} times across {max(1, distinct_sessions)} sessions."
            )

            error_lines = _top_lines(group["errors"], limit=2)
            fix_lines = _top_lines(group["fixes"], limit=4)
            module_names = [name for name, _ in group["modules"].most_common(4)]
            fix_methods = [name.replace("_", " ") for name, _ in group["fix_methods"].most_common(4)]

            note_lines = [
                description,
                "Successful fixes:",
                *[f"- {line}" for line in fix_lines],
            ]
            if error_lines:
                note_lines.extend(["Representative failures:", *[f"- {line}" for line in error_lines]])
            if module_names:
                note_lines.append(f"Common modules: {', '.join(module_names)}")
            if fix_methods:
                note_lines.append(f"Common fix methods: {', '.join(fix_methods)}")
            note_content = "\n".join(note_lines)

            procedure_lines = []
            for line in fix_lines:
                procedure_lines.append(f"- {line}")
            if not procedure_lines:
                procedure_lines.append(f"- Reproduce the {error_label} issue in {project_scope}.")
                procedure_lines.append("- Apply the previously successful code/config fix.")
            procedure = "\n".join(procedure_lines)

            tags = [
                "coding",
                "debug",
                "fix",
                group["error_kind"] or "runtime_error",
            ]
            if project_scope != "global":
                tags.append(project_scope.lower())

            common_meta = {
                "automation": "promote_fixes",
                "project_scope": project_scope,
                "error_signature": group["error_signature"],
                "error_kind": group["error_kind"] or "runtime_error",
                "module_scope": module_names[0] if module_names else "",
                "fix_methods": fix_methods,
                "occurrences": occurrence_count,
                "distinct_sessions": distinct_sessions,
                "source_chunk_ids": group["chunk_ids"][:50],
            }

            note_exists = _find_reasoning_entry_by_metadata(spine, "promotion_key", promotion_key) is not None
            skill_exists = _find_skill_capsule_by_metadata(spine, "promotion_key", promotion_key) is not None

            await _upsert_knowledge_note(
                spine,
                key=promotion_key,
                key_field="promotion_key",
                title=title,
                content=note_content,
                tags=tags,
                metadata=common_meta,
            )
            await _upsert_skill_capsule(
                spine,
                key=promotion_key,
                key_field="promotion_key",
                name=f"Resolve {error_label}",
                description=description,
                procedure=procedure,
                tags=tags,
                metadata=common_meta,
            )
            promoted_notes += 0 if note_exists else 1
            promoted_skills += 0 if skill_exists else 1

        status = {
            "status": "ok",
            "groups_considered": groups_considered,
            "groups_promoted": groups_promoted,
            "min_occurrences": min_occurrences,
            "min_distinct_sessions": min_distinct_sessions,
            "new_reasoning_entries": promoted_notes,
            "new_skill_capsules": promoted_skills,
        }
        print(json.dumps(status, indent=2, sort_keys=True))
        return 0
    finally:
        await spine.close()


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
