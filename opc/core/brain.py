"""Local Knowledge Engine — self-learning brain backed by brain.db."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
import httpx

_BRAIN_DB = Path.home() / ".opc" / "brain.db"
_OLLAMA_BASE = "http://localhost:11434"
_log = logging.getLogger(__name__)

_EXTRACT_PROMPT = """\
You are a knowledge extraction engine. Analyze the conversation below and extract useful facts.

Output format — respond with ONLY a JSON array like this example:
[{{"type":"fact","content":"User's name is Alice"}},{{"type":"preference","content":"User prefers dark mode"}}]

Type must be one of: fact, preference, experience, skill
If nothing useful, respond with: []
Do NOT wrap in markdown code blocks. Do NOT add explanation.

Conversation:
{conversation}

JSON array:"""


async def init_brain_db() -> None:
    _BRAIN_DB.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(_BRAIN_DB) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                id            TEXT PRIMARY KEY,
                slug          TEXT UNIQUE NOT NULL,
                type          TEXT NOT NULL,
                content       TEXT NOT NULL,
                source        TEXT NOT NULL,
                confidence    REAL DEFAULT 1.0,
                access_count  INTEGER DEFAULT 0,
                last_accessed TEXT,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type)")
        await db.execute("PRAGMA journal_mode=WAL")
        await db.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(content: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", content.lower())[:60].strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


async def store_entry(type: str, content: str, source: str) -> str:
    eid = str(uuid.uuid4())
    slug = _slugify(content)
    now = _now()
    async with aiosqlite.connect(_BRAIN_DB) as db:
        await db.execute(
            """INSERT OR IGNORE INTO entries
               (id, slug, type, content, source, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)""",
            (eid, slug, type, content, source, now, now),
        )
        await db.commit()
    return slug


async def recall(query: str, limit: int = 5) -> list[dict]:
    if not _BRAIN_DB.exists():
        return []
    # Strip punctuation before splitting
    clean_query = re.sub(r"[^\w\s]", "", query)
    keywords = [kw for kw in clean_query.split()[:8] if len(kw) > 2 and kw.lower() not in _STOP_WORDS]
    
    async with aiosqlite.connect(_BRAIN_DB) as db:
        db.row_factory = aiosqlite.Row
        rows = []
        
        if keywords:
            conditions = " OR ".join(["content LIKE ?" for _ in keywords])
            params: list = [f"%{kw}%" for kw in keywords]
            # Fetch more candidates, then rank by keyword hit count
            async with db.execute(
                f"SELECT * FROM entries WHERE {conditions} "
                f"ORDER BY access_count DESC, updated_at DESC LIMIT ?",
                params + [limit * 4],
            ) as cur:
                candidates = [dict(r) for r in await cur.fetchall()]

            # Score by number of distinct keywords matched (relevance)
            def _match_score(entry: dict) -> float:
                content_lower = entry["content"].lower()
                hits = sum(1 for kw in keywords if kw.lower() in content_lower)
                # Combine: 60% keyword relevance + 40% recency/popularity
                return hits * 0.6 + min(entry.get("access_count", 0), 10) * 0.04

            candidates.sort(key=_match_score, reverse=True)
            rows = candidates[:limit]

        # Fallback: if keyword search found nothing, return most recent
        if not rows:
            async with db.execute(
                "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]

    if rows:
        ids = [r["id"] for r in rows]
        now = _now()
        async with aiosqlite.connect(_BRAIN_DB) as db:
            placeholders = ",".join("?" * len(ids))
            await db.execute(
                f"UPDATE entries SET access_count = access_count + 1, last_accessed = ? "
                f"WHERE id IN ({placeholders})",
                [now, *ids],
            )
            await db.commit()

    return rows


_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "what", "who", "whom",
    "which", "that", "this", "these", "those", "how", "when", "where",
    "why", "not", "and", "but", "for", "nor", "yet", "with", "from",
    "about", "into", "through", "during", "before", "after", "above",
    "below", "between", "out", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "all", "each", "every", "both",
    "few", "more", "most", "other", "some", "such", "only", "own",
    "same", "than", "too", "very", "just", "because", "know", "you",
    "your", "yourself", "me", "my", "mine", "myself",
}


async def extract_knowledge(messages: list[dict], model: str) -> list[dict]:
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages[-6:]  # last 6 messages max
    )
    prompt = _EXTRACT_PROMPT.format(conversation=conversation_text)

    # Prefer larger model for extraction if available
    extract_model = model
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{_OLLAMA_BASE}/api/tags")
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                # Prefer capable models for extraction (ordered by preference)
                for preferred in [
                    "qwen3:14b", "qwen3:8b", "gemma4:26b", "gemma4:12b",
                    "qwen2.5:32b", "qwen2.5:14b", "qwen2.5:7b",
                ]:
                    if preferred in models:
                        extract_model = preferred
                        break
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_OLLAMA_BASE}/api/generate",
                json={"model": extract_model, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            raw = resp.json().get("response", "").strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())

        # Try to find JSON array in response
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        items = json.loads(raw)
        if not isinstance(items, list):
            return []
        return [
            i for i in items
            if isinstance(i, dict) and "type" in i and "content" in i
        ]
    except Exception as exc:
        _log.debug("Knowledge extraction failed: %s", exc)
        return []


async def extract_and_store(messages: list[dict], model: str) -> None:
    """Fire-and-forget: extract knowledge from a completed conversation and store it."""
    try:
        items = await extract_knowledge(messages, model)
        for item in items:
            await store_entry(
                type=item.get("type", "fact"),
                content=item["content"],
                source=item.get("source", "conversation"),
            )
        if items:
            _log.info("Brain: stored %d knowledge entries", len(items))
    except Exception as exc:
        _log.debug("extract_and_store failed: %s", exc)


async def get_stats() -> dict:
    if not _BRAIN_DB.exists():
        return {"exists": False, "total": 0, "types": {}, "size_mb": 0}
    async with aiosqlite.connect(_BRAIN_DB) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT COUNT(*) AS c FROM entries") as cur:
            row = await cur.fetchone()
            total: int = row["c"] if row else 0
        async with db.execute(
            "SELECT type, COUNT(*) AS c FROM entries GROUP BY type"
        ) as cur:
            types = {r["type"]: r["c"] for r in await cur.fetchall()}
    size_mb = round(_BRAIN_DB.stat().st_size / 1e6, 2)
    return {"exists": True, "total": total, "types": types, "size_mb": size_mb}
