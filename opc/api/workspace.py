"""Workspace file API — read/write .md files in the workspace directory."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


def _workspace() -> Path:
    from opc.core.config import config
    return Path(config.get("workspace_path", str(Path.cwd())))


def _safe_path(name: str) -> Path:
    if "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not name.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files allowed")
    return _workspace() / name


@router.get("/api/workspace/files")
async def list_files() -> list[dict]:
    ws = _workspace()
    files = []
    for p in sorted(ws.glob("*.md")):
        stat = p.stat()
        files.append({
            "name": p.name,
            "size_bytes": stat.st_size,
            "modified_at": stat.st_mtime,
        })
    return files


@router.get("/api/workspace/files/{name}")
async def read_file(name: str) -> dict:
    p = _safe_path(name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return {"name": name, "content": p.read_text(encoding="utf-8")}


class FileUpdate(BaseModel):
    content: str


@router.put("/api/workspace/files/{name}")
async def update_file(name: str, body: FileUpdate) -> dict:
    p = _safe_path(name)
    p.write_text(body.content, encoding="utf-8")
    return {"name": name, "saved": True}
