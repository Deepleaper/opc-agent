"""Knowledge base API — read-only view of an existing brain.db."""

from __future__ import annotations

from pathlib import Path

import aiosqlite
from fastapi import APIRouter, HTTPException

router = APIRouter()

_BRAIN_DB = Path.home() / ".opc" / "brain.db"


def _brain_exists() -> bool:
    return _BRAIN_DB.exists()


@router.get("/api/brain/entries")
async def list_entries(
    page: int = 1,
    page_size: int = 20,
    type: str | None = None,
    namespace: str | None = None,
) -> dict:
    if not _brain_exists():
        return {"entries": [], "total": 0, "page": page, "page_size": page_size}

    try:
        async with aiosqlite.connect(_BRAIN_DB) as db:
            db.row_factory = aiosqlite.Row

            clauses: list[str] = []
            params: list = []
            if type:
                clauses.append("type = ?")
                params.append(type)
            if namespace:
                clauses.append("namespace = ?")
                params.append(namespace)
            where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

            async with db.execute(
                f"SELECT COUNT(*) AS c FROM entries {where}", params
            ) as cur:
                row = await cur.fetchone()
                total: int = row["c"] if row else 0

            offset = (page - 1) * page_size
            async with db.execute(
                f"SELECT slug, type, namespace, title, created_at "
                f"FROM entries {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                params + [page_size, offset],
            ) as cur:
                entries = [dict(r) for r in await cur.fetchall()]

        return {"entries": entries, "total": total, "page": page, "page_size": page_size}

    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


@router.get("/api/brain/entries/{slug:path}")
async def get_entry(slug: str) -> dict:
    if not _brain_exists():
        raise HTTPException(status_code=404, detail="Brain DB not found")
    try:
        async with aiosqlite.connect(_BRAIN_DB) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM entries WHERE slug=?", (slug,)
            ) as cur:
                row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Entry not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


@router.delete("/api/brain/entries/{slug:path}")
async def delete_entry(slug: str) -> dict:
    if not _brain_exists():
        raise HTTPException(status_code=404, detail="Brain DB not found")
    try:
        async with aiosqlite.connect(_BRAIN_DB) as db:
            await db.execute("DELETE FROM entries WHERE slug=?", (slug,))
            await db.commit()
        return {"deleted": slug}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")


@router.get("/api/brain/stats")
async def brain_stats() -> dict:
    if not _brain_exists():
        return {"exists": False, "total": 0, "types": {}, "size_mb": 0}
    try:
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
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Brain DB error: {exc}")
