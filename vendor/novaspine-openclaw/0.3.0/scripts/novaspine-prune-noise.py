#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import datetime, timezone
import os
from pathlib import Path


def _data_dir() -> Path:
    return Path(os.environ.get("C3AE_DATA_DIR", Path.home() / ".local" / "share" / "novaspine"))


def _db_path() -> Path:
    return _data_dir() / "db" / "c3ae.db"


def _backup_path(db_path: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target_dir = db_path.parent.parent / "backups"
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir / f"{db_path.stem}-before-noise-prune-{stamp}{db_path.suffix}"


def _fetch_ids(conn: sqlite3.Connection, table: str, where_sql: str) -> list[str]:
    rows = conn.execute(f"SELECT id FROM {table} WHERE {where_sql}").fetchall()
    return [str(row[0]) for row in rows]


def _delete_by_ids(conn: sqlite3.Connection, table: str, ids: list[str]) -> int:
    if not ids:
        return 0
    placeholders = ",".join("?" for _ in ids)
    cursor = conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids)
    return int(cursor.rowcount or 0)


def _delete_memory_access(conn: sqlite3.Connection, ids: list[str]) -> int:
    if not ids:
        return 0
    placeholders = ",".join("?" for _ in ids)
    cursor = conn.execute(f"DELETE FROM memory_access WHERE memory_id IN ({placeholders})", ids)
    return int(cursor.rowcount or 0)


def main() -> int:
    db_path = _db_path()
    if not db_path.exists():
        raise SystemExit(f"NovaSpine DB not found: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA busy_timeout = 5000")
        conn.execute("PRAGMA foreign_keys = OFF")

        chunk_rules = {
            "thread_continuity": "metadata LIKE '%\"bridgeRecordId\":\"thread-memory-%'",
            "prompt_capture": "metadata LIKE '%prompt_capture%'",
        }
        promoted_rules = {
            "consolidated_noise": (
                "consolidated_memories",
                "summary LIKE '%Continuity for [%' "
                "OR summary LIKE '%LAB_LOOP_%' "
                "OR summary LIKE '[NovaSpine Recall]%' "
                "OR summary LIKE 'Consciousness continuity context:%' "
                "OR summary LIKE 'Relevant memories:%' "
                "OR summary LIKE '%<relevant-memories>%'"
            ),
            "reasoning_noise": (
                "reasoning_bank",
                "title LIKE 'Continuity for %' "
                "OR content LIKE '%LAB_LOOP_%' "
                "OR content LIKE '[NovaSpine Recall]%' "
                "OR content LIKE 'Consciousness continuity context:%'"
            ),
        }
        noise_profile = str(os.environ.get("NOVASPINE_NOISE_PROFILE", "")).strip().lower()
        agent_name = str(os.environ.get("NOVASPINE_AGENT_NAME", "")).strip()
        agent_aliases = [value.strip() for value in os.environ.get("NOVASPINE_AGENT_ALIASES", "").split(",") if value.strip()]
        reply_markers = [value.strip() for value in os.environ.get("NOVASPINE_REPLY_MARKERS", "").split(",") if value.strip()]
        if noise_profile in {"arc", "nova", "gemma4"} or agent_name:
            profile_name = {
                "arc": "Arc",
                "nova": "Nova",
                "gemma4": "Gemma4",
            }.get(noise_profile, agent_name or "Agent")
            profile_reply_ok = {
                "arc": "ARC_OK",
                "nova": "NOVA_PRIVATE_OK",
                "gemma4": "GEMMA4_OK",
            }.get(noise_profile, "")
            profile_aliases = [profile_name, *agent_aliases]
            if noise_profile == "arc":
                profile_aliases.append("Agent3")
            if noise_profile == "gemma4":
                profile_aliases.append("Saga")
            profile_reply_markers = reply_markers or ([profile_reply_ok] if profile_reply_ok else [])
            recall_wrapper_terms = [
                "content LIKE '[NovaSpine Recall]%'",
                "content LIKE 'Consciousness continuity context:%'",
                *[
                    f"content LIKE '%You are {alias}, an OpenClaw agent connected to The Lab%'"
                    for alias in profile_aliases
                ],
                f"content LIKE '%You are {profile_name}, a persistent AI partner with durable NovaSpine memory%'",
                *[f"content LIKE '%Reply with exactly {marker}%'" for marker in profile_reply_markers],
            ]
            chunk_rules.update({
                f"{noise_profile or 'custom'}_recall_wrapper": " OR ".join(recall_wrapper_terms),
            })
            promoted_rules.update({
                f"{noise_profile or 'custom'}_reasoning_wrapper": (
                    "reasoning_bank",
                    "content LIKE '[NovaSpine Recall]%' OR content LIKE 'Consciousness continuity context:%'",
                ),
            })

        chunk_ids: dict[str, list[str]] = {
            name: _fetch_ids(conn, "chunks", where_sql)
            for name, where_sql in chunk_rules.items()
        }
        chunk_delete_ids = sorted({item for values in chunk_ids.values() for item in values})

        promoted_ids: dict[str, list[str]] = {
            name: _fetch_ids(conn, table, where_sql)
            for name, (table, where_sql) in promoted_rules.items()
        }

        matched = {
            "thread_continuity_chunks": len(chunk_ids["thread_continuity"]),
            "prompt_capture_chunks": len(chunk_ids["prompt_capture"]),
            "noisy_consolidated_memories": len(promoted_ids["consolidated_noise"]),
            "noisy_reasoning_entries": len(promoted_ids["reasoning_noise"]),
        }
        if noise_profile in {"arc", "nova", "gemma4"} or agent_name:
            profile_key = noise_profile or "custom"
            matched[f"{profile_key}_recall_wrapper_chunks"] = len(chunk_ids[f"{profile_key}_recall_wrapper"])
            matched[f"{profile_key}_reasoning_wrapper_entries"] = len(promoted_ids[f"{profile_key}_reasoning_wrapper"])
        total_matches = sum(matched.values())
        if total_matches == 0:
            print(
                json.dumps(
                    {
                        "status": "ok",
                        "db_path": str(db_path),
                        "backup_path": None,
                        "deleted": {
                            "chunks": 0,
                            "chunk_memory_access": 0,
                            "consolidated_noise": 0,
                            "promoted_memory_access": 0,
                            "reasoning_noise": 0,
                        },
                        "matched": matched,
                    },
                    indent=2,
                    sort_keys=True,
                )
            )
            return 0

        backup_path = _backup_path(db_path)
        shutil.copy2(db_path, backup_path)
        conn.execute("BEGIN")

        deleted_chunks = _delete_by_ids(conn, "chunks", chunk_delete_ids)
        deleted_chunk_access = _delete_memory_access(conn, chunk_delete_ids)

        deleted_promoted: dict[str, int] = {}
        deleted_promoted_access = 0
        for name, (table, _) in promoted_rules.items():
            ids = promoted_ids[name]
            deleted_promoted[name] = _delete_by_ids(conn, table, ids)
            deleted_promoted_access += _delete_memory_access(conn, ids)

        try:
            conn.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize')")
        except sqlite3.OperationalError:
            pass
        conn.commit()

        print(
            json.dumps(
                {
                    "status": "ok",
                    "db_path": str(db_path),
                    "backup_path": str(backup_path),
                    "deleted": {
                        "chunks": deleted_chunks,
                        "chunk_memory_access": deleted_chunk_access,
                        **deleted_promoted,
                        "promoted_memory_access": deleted_promoted_access,
                    },
                    "matched": matched,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
