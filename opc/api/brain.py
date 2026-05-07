"""Knowledge base API - read/write access via DeepBrain adapter."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from opc.core.brain import get_stats, recall, store_entry, _get_brain, _BRAIN_DB

router = APIRouter()


def _brain_exists() -> bool:
    return _BRAIN_DB.exists()


# 📋 List / Delete entries

@router.get("/api/brain/entries")
async def list_entries(
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
) -> dict:
    if not _brain_exists():
        return {"entries": [], "total": 0, "page": page, "page_size": page_size}

    brain = _get_brain()
    if brain is None:
        return {"entries": [], "total": 0, "page": page, "page_size": page_size, "error": "brain not available"}

    try:
        # DeepBrain uses table 'deepbrain', not 'entries'
        import aiosqlite
        async with aiosqlite.connect(_BRAIN_DB) as db:
            db.row_factory = aiosqlite.Row

            clauses: list[str] = []
            params: list = []
            if type:
                clauses.append("entry_type = ?")
                params.append(type)
            where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

            async with db.execute(
                f"SELECT COUNT(*) AS c FROM deepbrain {where}", params
            ) as cur:
                row = await cur.fetchone()
                total: int = row["c"] if row else 0

            offset = (page - 1) * page_size
            async with db.execute(
                f"SELECT id, entry_type as type, content, source, confidence, "
                f"layer, namespace, created_at, updated_at "
                f"FROM deepbrain {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                params + [page_size, offset],
            ) as cur:
                entries = [dict(r) for r in await cur.fetchall()]

        return {"entries": entries, "total": total, "page": page, "page_size": page_size}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


@router.delete("/api/brain/entries/{entry_id}")
async def delete_entry(entry_id: str) -> dict:
    if not _brain_exists():
        raise HTTPException(status_code=404, detail="Brain DB not found")
    try:
        import aiosqlite
        async with aiosqlite.connect(_BRAIN_DB) as db:
            await db.execute("DELETE FROM deepbrain WHERE id=?", (entry_id,))
            await db.commit()
        return {"deleted": entry_id}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


# 📊 Stats

@router.get("/api/brain/stats")
async def brain_stats() -> dict:
    try:
        return await get_stats()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


# 📝 Learn (manual teach)

class LearnBody(BaseModel):
    content: str
    type: str = "fact"


@router.post("/api/brain/learn")
async def learn(body: LearnBody) -> dict:
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="content must not be empty")
    valid_types = {"fact", "preference", "experience", "skill"}
    if body.type not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"type must be one of: {', '.join(sorted(valid_types))}",
        )
    try:
        entry_id = await store_entry(
            type=body.type, content=body.content.strip(), source="manual"
        )
        return {"id": entry_id, "slug": entry_id, "type": body.type, "content": body.content.strip()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


# 🔍 Recall

@router.get("/api/brain/recall")
async def recall_entries(q: str = "", limit: int = 5) -> dict:
    if not q.strip():
        raise HTTPException(status_code=422, detail="q must not be empty")
    try:
        results = await recall(q.strip(), limit=min(limit, 20))
        return {"query": q, "results": results}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


# 🧠 Evolve (trigger knowledge evolution)

@router.post("/api/brain/evolve")
async def evolve_brain() -> dict:
    brain = _get_brain()
    if brain is None:
        raise HTTPException(status_code=503, detail="DeepBrain not available")
    try:
        result = brain.evolve()
        return {"evolved": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Evolution failed: {exc}")
