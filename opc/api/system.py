"""System status and first-time setup API."""

from __future__ import annotations

from pathlib import Path

import aiosqlite
from fastapi import APIRouter

from opc.core import ollama as ollama_core

router = APIRouter()

_BRAIN_DB = Path.home() / ".opc" / "brain.db"


@router.get("/api/system/status")
async def system_status() -> dict:
    from opc.core.config import config

    ollama_ok = await ollama_core.detect_ollama()
    models: list[dict] = []
    if ollama_ok:
        try:
            models = await ollama_core.list_models()
        except Exception:
            pass

    brain_stats: dict = {"exists": False, "total": 0}
    if _BRAIN_DB.exists():
        try:
            async with aiosqlite.connect(_BRAIN_DB) as db:
                async with db.execute("SELECT COUNT(*) FROM entries") as cur:
                    row = await cur.fetchone()
                    brain_stats = {"exists": True, "total": row[0] if row else 0}
        except Exception:
            pass

    return {
        "ollama": {"running": ollama_ok, "models": models},
        "ram": ollama_core.get_ram_info(),
        "active_model": config.get("active_model", "qwen2.5:7b"),
        "brain": brain_stats,
    }


@router.post("/api/system/setup")
async def first_time_setup() -> dict:
    ollama_ok = await ollama_core.detect_ollama()
    installed: list[dict] = []
    if ollama_ok:
        try:
            installed = await ollama_core.list_models()
        except Exception:
            pass

    return {
        "ollama_running": ollama_ok,
        "ram": ollama_core.get_ram_info(),
        "recommended_model": ollama_core.recommend_model(),
        "installed_models": installed,
    }
