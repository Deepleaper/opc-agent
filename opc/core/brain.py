"""Local Knowledge Engine — self-learning brain backed by brain.db."""

from __future__ import annotations

import json
import logging
import re
import struct
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
import httpx

try:
    import numpy as np
    _NUMPY = True
except ImportError:
    _NUMPY = False

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
        await db.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                entry_id TEXT PRIMARY KEY,
                vector   BLOB
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


def _cosine_sim(a: list[float], b: list[float]) -> float:
    if _NUMPY:
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
        return float(np.dot(va, vb) / denom) if denom > 0 else 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


async def _embed(text: str) -> list[float] | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{_OLLAMA_BASE}/api/embed",
                json={"model": "nomic-embed-text", "input": text},
            )
            resp.raise_for_status()
            embeddings = resp.json().get("embeddings", [])
            if embeddings:
                return embeddings[0]
    except Exception as exc:
        _log.warning("Ollama embed unavailable: %s", exc)
    return None


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

    vector = await _embed(content)
    if vector is not None:
        blob = struct.pack(f"{len(vector)}f", *vector)
        async with aiosqlite.connect(_BRAIN_DB) as db:
            await db.execute(
                "INSERT OR REPLACE INTO embeddings (entry_id, vector) VALUES (?,?)",
                (eid, blob),
            )
            await db.commit()

    return slug


async def recall(query: str, limit: int = 5) -> list[dict]:
    if not _BRAIN_DB.exists():
        return []

    clean_query = re.sub(r"[^\w\s]", "", query)
    keywords = [kw for kw in clean_query.split()[:8] if len(kw) > 2 and kw.lower() not in _STOP_WORDS]

    async with aiosqlite.connect(_BRAIN_DB) as db:
        db.row_factory = aiosqlite.Row

        if keywords:
            conditions = " OR ".join(["content LIKE ?" for _ in keywords])
            params: list = [f"%{kw}%" for kw in keywords]
            async with db.execute(
                f"SELECT * FROM entries WHERE {conditions} "
                f"ORDER BY access_count DESC, updated_at DESC LIMIT ?",
                params + [limit * 10],
            ) as cur:
                candidates = [dict(r) for r in await cur.fetchall()]
        else:
            async with db.execute(
                "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?",
                (limit * 10,),
            ) as cur:
                candidates = [dict(r) for r in await cur.fetchall()]

        # Fallback: keyword search with results found nothing
        if not candidates:
            async with db.execute(
                "SELECT * FROM entries ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
            # Update access counts and return early
            if rows:
                ids = [r["id"] for r in rows]
                now = _now()
                placeholders = ",".join("?" * len(ids))
                await db.execute(
                    f"UPDATE entries SET access_count = access_count + 1, last_accessed = ? "
                    f"WHERE id IN ({placeholders})",
                    [now, *ids],
                )
                await db.commit()
            return rows

        # --- Keyword scoring ---
        def _kw_score(entry: dict) -> float:
            content_lower = entry["content"].lower()
            hits = sum(1 for kw in keywords if kw.lower() in content_lower)
            word_score = hits / len(keywords) if keywords else 0.0
            bigrams = [
                f"{keywords[i].lower()} {keywords[i + 1].lower()}"
                for i in range(len(keywords) - 1)
            ]
            bigram_bonus = sum(0.3 for bg in bigrams if bg in content_lower)
            clean_q = clean_query.lower().strip()
            phrase_bonus = 0.5 if clean_q and clean_q in content_lower else 0.0
            return word_score + bigram_bonus + phrase_bonus

        kw_sorted = sorted(candidates, key=_kw_score, reverse=True)
        kw_ranks: dict[str, int] = {e["id"]: i for i, e in enumerate(kw_sorted)}

        # --- Neighbor expansion: entries adjacent by rowid to top results ---
        top_ids = [e["id"] for e in kw_sorted[:limit]]
        if top_ids:
            id_ph = ",".join("?" * len(top_ids))
            async with db.execute(
                f"SELECT rowid FROM entries WHERE id IN ({id_ph})", top_ids
            ) as cur:
                rowid_rows = await cur.fetchall()
            neighbor_rowids = set()
            for (rowid,) in rowid_rows:
                neighbor_rowids.add(rowid - 1)
                neighbor_rowids.add(rowid + 1)
            if neighbor_rowids:
                nb_ph = ",".join("?" * len(neighbor_rowids))
                async with db.execute(
                    f"SELECT * FROM entries WHERE rowid IN ({nb_ph})",
                    list(neighbor_rowids),
                ) as cur:
                    existing_ids = {c["id"] for c in candidates}
                    for r in await cur.fetchall():
                        ne = dict(r)
                        if ne["id"] not in existing_ids:
                            candidates.append(ne)
                            kw_ranks[ne["id"]] = len(kw_sorted)

        # --- Embedding ranking ---
        query_vec = await _embed(query)
        emb_ranks: dict[str, int] = {}

        if query_vec is not None:
            ids = [c["id"] for c in candidates]
            emb_ph = ",".join("?" * len(ids))
            async with db.execute(
                f"SELECT entry_id, vector FROM embeddings WHERE entry_id IN ({emb_ph})",
                ids,
            ) as cur:
                emb_rows = await cur.fetchall()

            sims: list[tuple[str, float]] = []
            for entry_id, blob in emb_rows:
                n = len(blob) // 4
                vec = list(struct.unpack(f"{n}f", blob))
                sims.append((entry_id, _cosine_sim(query_vec, vec)))

            sims.sort(key=lambda x: x[1], reverse=True)
            emb_ranks = {eid: rank for rank, (eid, _) in enumerate(sims)}

        # --- RRF fusion (fallback to keyword-only when no embeddings) ---
        K = 60
        n_cands = len(candidates)
        if emb_ranks:
            def _rrf(entry: dict) -> float:
                eid = entry["id"]
                return 1.0 / (K + kw_ranks.get(eid, n_cands)) + 1.0 / (K + emb_ranks.get(eid, n_cands))
            candidates.sort(key=_rrf, reverse=True)
        else:
            candidates.sort(key=_kw_score, reverse=True)

        rows = candidates[:limit]

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
