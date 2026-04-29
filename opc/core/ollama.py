"""Ollama integration — detect, list, pull, recommend."""

from __future__ import annotations

from typing import Callable

import httpx
import psutil

OLLAMA_BASE = "http://localhost:11434"


async def detect_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def list_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{OLLAMA_BASE}/api/tags")
        r.raise_for_status()
        data = r.json()
    return [
        {
            "name": m["name"],
            "size_gb": round(m.get("size", 0) / 1e9, 1),
            "modified_at": m.get("modified_at", ""),
        }
        for m in data.get("models", [])
    ]


async def pull_model(
    name: str,
    progress_callback: Callable[[dict], None] | None = None,
) -> None:
    import json

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{OLLAMA_BASE}/api/pull", json={"name": name}
        ) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line and progress_callback:
                    try:
                        progress_callback(json.loads(line))
                    except Exception:
                        pass


def get_ram_info() -> dict:
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / 1e9, 1),
        "available_gb": round(mem.available / 1e9, 1),
        "used_percent": mem.percent,
    }


def recommend_model() -> str:
    total_gb = psutil.virtual_memory().total / 1e9
    if total_gb >= 32:
        return "qwen2.5:32b"
    elif total_gb >= 24:
        return "qwen2.5:14b"
    else:
        return "qwen2.5:7b"
