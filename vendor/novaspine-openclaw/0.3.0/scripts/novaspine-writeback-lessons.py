#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
import json
import os
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from c3ae.config import Config
from c3ae.memory_spine.spine import MemorySpine


ACTION_ROLES = {"tool_error", "tool_fix", "tool_result"}


def _data_dir() -> Path:
    return Path(os.environ.get("C3AE_DATA_DIR", Path.home() / ".local" / "share" / "novaspine"))


def _trim(text: str, limit: int = 220) -> str:
    return " ".join(str(text or "").split())[:limit]


def _top_unique(values: list[str], limit: int = 5) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = _trim(value)
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
        if len(out) >= limit:
            break
    return out


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


async def main_async() -> int:
    config = Config()
    config.data_dir = _data_dir()
    config.ensure_dirs()
    spine = MemorySpine(config)
    min_fixes = max(1, int(os.environ.get("NOVASPINE_SESSION_LEARNING_MIN_FIXES", "1")))
    min_actions = max(1, int(os.environ.get("NOVASPINE_SESSION_LEARNING_MIN_ACTIONS", "2")))

    sessions_considered = 0
    sessions_written = 0
    sessions_updated = 0

    try:
        rows = spine.sqlite._conn.execute(
            """SELECT id, content, metadata
               FROM chunks
               WHERE json_extract(metadata, '$.session_id') IS NOT NULL
                 AND json_extract(metadata, '$.role') IN ('tool_error', 'tool_fix', 'tool_result')
               ORDER BY created_at DESC"""
        ).fetchall()

        grouped: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "roles": Counter(),
                "projects": Counter(),
                "modules": Counter(),
                "error_kinds": Counter(),
                "fix_methods": Counter(),
                "errors": [],
                "fixes": [],
                "results": [],
                "chunk_ids": [],
            }
        )

        for row in rows:
            metadata = json.loads(row["metadata"])
            session_id = str(metadata.get("session_id", "")).strip()
            if not session_id:
                continue
            group = grouped[session_id]
            role = str(metadata.get("role", "")).strip()
            group["roles"][role] += 1
            project_scope = str(metadata.get("project_scope", "")).strip()
            module_scope = str(metadata.get("module_scope", "")).strip()
            if project_scope:
                group["projects"][project_scope] += 1
            if module_scope:
                group["modules"][module_scope] += 1
            error_kind = str(
                metadata.get("resolved_error_kind")
                or metadata.get("error_kind")
                or ""
            ).strip()
            if error_kind:
                group["error_kinds"][error_kind] += 1
            fix_method = str(metadata.get("fix_method", "")).strip()
            if fix_method:
                group["fix_methods"][fix_method] += 1
            if role == "tool_error":
                group["errors"].append(str(row["content"]))
            elif role == "tool_fix":
                group["fixes"].append(str(row["content"]))
            elif role == "tool_result":
                group["results"].append(str(row["content"]))
            group["chunk_ids"].append(str(row["id"]))

        for session_id, group in grouped.items():
            sessions_considered += 1
            action_count = sum(group["roles"].values())
            if group["roles"]["tool_fix"] < min_fixes or action_count < min_actions:
                continue

            project_scope = group["projects"].most_common(1)[0][0] if group["projects"] else "global"
            module_scopes = [name for name, _ in group["modules"].most_common(4)]
            error_labels = [name.replace("_", " ") for name, _ in group["error_kinds"].most_common(4)]
            fix_methods = [name.replace("_", " ") for name, _ in group["fix_methods"].most_common(4)]
            fixes = _top_unique(group["fixes"], limit=4)
            errors = _top_unique(group["errors"], limit=3)
            results = _top_unique(group["results"], limit=2)

            title = (
                f"What worked in {project_scope} session {session_id[:8]}"
                if project_scope != "global"
                else f"What worked in session {session_id[:8]}"
            )
            body_lines = [
                f"This session produced {group['roles']['tool_fix']} successful repair episodes across {action_count} captured action memories.",
            ]
            if fixes:
                body_lines.extend(["Successful fixes:", *[f"- {line}" for line in fixes]])
            if errors:
                body_lines.extend(["Errors encountered:", *[f"- {line}" for line in errors]])
            if results:
                body_lines.extend(["Other useful outcomes:", *[f"- {line}" for line in results]])
            if module_scopes:
                body_lines.append(f"Modules touched: {', '.join(module_scopes)}")
            if error_labels:
                body_lines.append(f"Recurring issue types: {', '.join(error_labels)}")
            if fix_methods:
                body_lines.append(f"Successful fix methods: {', '.join(fix_methods)}")
            content = "\n".join(body_lines)

            tags = ["coding", "session_learning", "debug"]
            if project_scope != "global":
                tags.append(project_scope.lower())

            note_key = session_id
            metadata = {
                "automation": "writeback_lessons",
                "session_id": session_id,
                "project_scope": project_scope,
                "module_scope": module_scopes[0] if module_scopes else "",
                "error_kinds": list(group["error_kinds"].keys())[:6],
                "fix_methods": list(group["fix_methods"].keys())[:6],
                "action_count": action_count,
                "source_chunk_ids": group["chunk_ids"][:80],
            }
            exists = _find_reasoning_entry_by_metadata(spine, "session_learning_key", note_key) is not None
            await _upsert_knowledge_note(
                spine,
                key=note_key,
                key_field="session_learning_key",
                title=title,
                content=content,
                tags=tags,
                metadata=metadata,
                session_id=session_id,
            )
            if exists:
                sessions_updated += 1
            else:
                sessions_written += 1

        print(
            json.dumps(
                {
                    "status": "ok",
                    "sessions_considered": sessions_considered,
                    "sessions_written": sessions_written,
                    "sessions_updated": sessions_updated,
                    "min_fixes": min_fixes,
                    "min_actions": min_actions,
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
