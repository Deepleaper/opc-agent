"""Model management API — list, pull (SSE), delete, recommend, set active."""

from __future__ import annotations

from typing import AsyncIterator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from opc.core import ollama as ollama_core

router = APIRouter()

_OLLAMA_BASE = "http://localhost:11434"


@router.get("/api/models")
async def list_models() -> list[dict]:
    try:
        return await ollama_core.list_models()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/api/models/recommend")
async def recommend_model() -> dict:
    return {
        "recommended": ollama_core.recommend_model(),
        "ram": ollama_core.get_ram_info(),
    }


class PullRequest(BaseModel):
    name: str


@router.post("/api/models/pull")
async def pull_model(body: PullRequest) -> StreamingResponse:
    async def _sse() -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{_OLLAMA_BASE}/api/pull",
                json={"name": body.name},
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        yield f"data: {line}\n\n"
        yield 'data: {"done": true}\n\n'

    return StreamingResponse(_sse(), media_type="text/event-stream")


@router.delete("/api/models/{name:path}")
async def delete_model(name: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.request(
            "DELETE",
            f"{_OLLAMA_BASE}/api/delete",
            json={"name": name},
        )
    if r.status_code not in (200, 404):
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"deleted": name}


class ActiveModelBody(BaseModel):
    model: str


@router.put("/api/models/active")
async def set_active_model(body: ActiveModelBody) -> dict:
    from opc.core.config import config, save_config

    config["active_model"] = body.model
    save_config()
    return {"active_model": body.model}
