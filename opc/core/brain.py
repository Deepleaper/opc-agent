"""OPC Brain — adapter wrapping opc-deepbrain (DeepBrain) as the knowledge engine.

This module provides the same async API that opc-agent expects, backed by
DeepBrain's 6-layer self-evolving memory with 4-Gate quality control.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

_log = logging.getLogger(__name__)
_BRAIN_DB = Path.home() / ".opc" / "brain.db"

# Global DeepBrain instance (lazy init)
_brain = None

_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "about", "what",
    "which", "who", "whom", "this", "that", "these", "those", "i", "me",
    "my", "myself", "we", "our", "you", "your", "he", "him", "his", "she",
    "her", "it", "its", "they", "them", "their",
}


def _get_brain():
    """Get or create the global DeepBrain instance."""
    global _brain
    if _brain is not None:
        return _brain

    try:
        from opc.core.deepbrain import DeepBrain
        _brain = DeepBrain(str(_BRAIN_DB))
        _log.info("DeepBrain initialized at %s", _BRAIN_DB)
        return _brain
    except ImportError:
        _log.warning("DeepBrain module not available, falling back to basic brain")
        return None


async def init_brain_db() -> None:
    """Initialize the brain database."""
    _BRAIN_DB.parent.mkdir(parents=True, exist_ok=True)
    brain = _get_brain()
    if brain is None:
        # Fallback: create minimal SQLite schema
        import aiosqlite
        async with aiosqlite.connect(_BRAIN_DB) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS entries (
                    id TEXT PRIMARY KEY,
                    slug TEXT,
                    type TEXT DEFAULT 'fact',
                    content TEXT NOT NULL,
                    source TEXT DEFAULT '',
                    confidence REAL DEFAULT 0.5,
                    access_count INTEGER DEFAULT 0,
                    last_accessed TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            await db.commit()
        return

    # DeepBrain handles its own schema initialization on first use
    _log.info("Brain DB ready: %s", _BRAIN_DB)


async def store_entry(type: str, content: str, source: str) -> str:
    """Store a knowledge entry. Returns the entry ID."""
    brain = _get_brain()
    if brain is None:
        return await _fallback_store(type, content, source)

    entry_id = brain.learn(
        content=content,
        source=source,
        entry_type=type,
        namespace="opc",
        claim_type="observation",
        confidence=0.5,
    )
    return entry_id


async def recall(query: str, limit: int = 5) -> list[dict]:
    """Recall knowledge relevant to the query."""
    if not _BRAIN_DB.exists():
        return []

    brain = _get_brain()
    if brain is None:
        return await _fallback_recall(query, limit)

    results = brain.search(query, top_k=limit, namespace="opc")

    # Map DeepBrain format to OPC format
    return [
        {
            "type": r.get("entry_type", "fact"),
            "content": r.get("content", ""),
            "confidence": r.get("confidence", 0.5),
            "source": r.get("source", ""),
            "id": r.get("id", ""),
        }
        for r in results
    ]


async def extract_knowledge(messages: list[dict], model: str) -> list[dict]:
    """Extract knowledge from conversation using LLM."""
    import httpx
    from opc.core.ollama import OLLAMA_BASE

    # Build conversation text
    text_parts = []
    for m in messages[-10:]:  # last 10 messages
        role = m.get("role", "user")
        content = m.get("content", "")
        if content:
            text_parts.append(f"{role}: {content}")
    conversation_text = "\n".join(text_parts)

    if not conversation_text.strip():
        return []

    prompt = f"""You are a knowledge extraction engine. Analyze the conversation below and extract useful facts.

Output format - respond with ONLY a JSON array like this example:
[{{"type":"fact","content":"User's name is Alice"}},{{"type":"preference","content":"User prefers dark mode"}}]

Valid types: fact, preference, experience, skill

If nothing worth extracting, respond with: []

Conversation:
{conversation_text}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
            )
            r.raise_for_status()
            response_text = r.json().get("response", "").strip()

        # Parse JSON from response
        # Find JSON array in response
        start = response_text.find("[")
        end = response_text.rfind("]")
        if start >= 0 and end > start:
            items = json.loads(response_text[start:end + 1])
            if isinstance(items, list):
                return items
    except Exception as exc:
        _log.warning("Knowledge extraction failed: %s", exc)

    return []


async def extract_and_store(messages: list[dict], model: str) -> None:
    """Extract knowledge from conversation and store it."""
    items = await extract_knowledge(messages, model)
    for item in items:
        content = item.get("content", "")
        entry_type = item.get("type", "fact")
        if content.strip():
            await store_entry(type=entry_type, content=content, source="conversation")

    # Trigger DeepBrain evolution if available
    brain = _get_brain()
    if brain is not None and items:
        try:
            result = brain.evolve()
            if any(v > 0 for v in result.values()):
                _log.info("Brain evolved: %s", result)
        except Exception as exc:
            _log.debug("Evolution skipped: %s", exc)


async def get_stats() -> dict:
    """Get brain statistics."""
    brain = _get_brain()
    if brain is None:
        return await _fallback_stats()

    try:
        stats = brain.stats()
        total = stats.get("total_entries", 0)

        # Get type breakdown for compatibility
        types = {}
        try:
            import aiosqlite
            async with aiosqlite.connect(_BRAIN_DB) as db:
                async with db.execute(
                    "SELECT entry_type, COUNT(*) FROM deepbrain GROUP BY entry_type"
                ) as cur:
                    for row in await cur.fetchall():
                        types[row[0]] = row[1]
                        total = max(total, sum(types.values()))
        except Exception:
            pass

        return {
            "exists": _BRAIN_DB.exists(),
            "total": total,
            "total_entries": total,
            "types": types,
            "by_type": types,
            "db_path": str(_BRAIN_DB),
            "db_size_mb": round(_BRAIN_DB.stat().st_size / 1e6, 2) if _BRAIN_DB.exists() else 0,
            "engine": "deepbrain",
            "layers": stats.get("by_layer", {}),
        }
    except Exception as exc:
        _log.warning("Stats failed: %s", exc)
        return {"error": str(exc)}


# ── Fallback implementations (when opc-deepbrain is not installed) ──────────

async def _fallback_store(type: str, content: str, source: str) -> str:
    import uuid
    import aiosqlite

    eid = str(uuid.uuid4())
    now = _now()
    async with aiosqlite.connect(_BRAIN_DB) as db:
        await db.execute(
            "INSERT OR IGNORE INTO entries (id, slug, type, content, source, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (eid, _slugify(content), type, content, source, now, now),
        )
        await db.commit()
    return eid


async def _fallback_recall(query: str, limit: int) -> list[dict]:
    import aiosqlite

    clean = re.sub(r"[^\w\s]", "", query)
    keywords = [kw for kw in clean.split()[:8] if len(kw) > 2 and kw.lower() not in _STOP_WORDS]

    if not keywords:
        return []

    async with aiosqlite.connect(_BRAIN_DB) as db:
        db.row_factory = aiosqlite.Row
        conditions = " OR ".join(["content LIKE ?" for _ in keywords])
        params = [f"%{kw}%" for kw in keywords]
        async with db.execute(
            f"SELECT * FROM entries WHERE {conditions} "
            f"ORDER BY access_count DESC, updated_at DESC LIMIT ?",
            params + [limit],
        ) as cur:
            rows = await cur.fetchall()
    return [{"type": r["type"], "content": r["content"], "id": r["id"]} for r in rows]


async def _fallback_stats() -> dict:
    import aiosqlite

    if not _BRAIN_DB.exists():
        return {"total_entries": 0, "engine": "fallback"}
    async with aiosqlite.connect(_BRAIN_DB) as db:
        async with db.execute("SELECT COUNT(*) FROM entries") as cur:
            row = await cur.fetchone()
            total = row[0] if row else 0
    return {"total_entries": total, "engine": "fallback", "db_path": str(_BRAIN_DB)}


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _slugify(content: str) -> str:
    return re.sub(r"\W+", "-", content[:50]).strip("-").lower()
