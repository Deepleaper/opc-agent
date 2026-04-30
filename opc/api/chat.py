"""Chat API — WebSocket streaming + conversation CRUD."""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()

_DB_PATH = Path.home() / ".opc" / "conversations.db"


async def init_db() -> None:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                model       TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id                  TEXT PRIMARY KEY,
                conversation_id     TEXT NOT NULL,
                role                TEXT NOT NULL,
                content             TEXT NOT NULL,
                created_at          TEXT NOT NULL,
                FOREIGN KEY (conversation_id)
                    REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        await db.execute("PRAGMA journal_mode=WAL")
        await db.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket) -> None:
    from opc.core.config import config
    from opc.core.engine import get_engine

    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            user_message: str = data.get("message", "")
            conversation_id: str | None = data.get("conversation_id")
            model: str = data.get("model") or config.get("active_model", "qwen2.5:7b")

            # Load prior history from DB
            messages: list[dict] = []
            if conversation_id:
                async with aiosqlite.connect(_DB_PATH) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute(
                        "SELECT role, content FROM messages "
                        "WHERE conversation_id=? ORDER BY created_at",
                        (conversation_id,),
                    ) as cur:
                        messages = [
                            {"role": r["role"], "content": r["content"]}
                            for r in await cur.fetchall()
                        ]

            messages.append({"role": "user", "content": user_message})

            # Stream tokens
            full_response = ""
            engine = get_engine()
            async for token in engine.stream_chat(messages, model):
                full_response += token
                await websocket.send_json({"token": token, "done": False})
            await websocket.send_json({"token": "", "done": True})

            # Persist if we have a conversation
            if conversation_id and full_response:
                now = _now()
                async with aiosqlite.connect(_DB_PATH) as db:
                    await db.execute(
                        "INSERT INTO messages VALUES (?,?,?,?,?)",
                        (str(uuid.uuid4()), conversation_id, "user", user_message, now),
                    )
                    await db.execute(
                        "INSERT INTO messages VALUES (?,?,?,?,?)",
                        (str(uuid.uuid4()), conversation_id, "assistant", full_response, now),
                    )
                    await db.execute(
                        "UPDATE conversations SET updated_at=? WHERE id=?",
                        (now, conversation_id),
                    )
                    await db.commit()

            # Fire-and-forget: learn from this exchange (always, even without conversation_id)
            if full_response:
                from opc.core.brain import extract_and_store
                asyncio.create_task(extract_and_store(messages, model))

    except WebSocketDisconnect:
        pass


# ── Conversations CRUD ────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: str = "New Conversation"
    model: str = "qwen2.5:7b"


@router.post("/api/conversations")
async def create_conversation(body: ConversationCreate) -> dict:
    cid = str(uuid.uuid4())
    now = _now()
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            "INSERT INTO conversations VALUES (?,?,?,?,?)",
            (cid, body.title, body.model, now, now),
        )
        await db.commit()
    return {"id": cid, "title": body.title, "model": body.model,
            "created_at": now, "updated_at": now}


@router.get("/api/conversations")
async def list_conversations() -> list[dict]:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


@router.get("/api/conversations/{cid}")
async def get_conversation(cid: str) -> dict:
    async with aiosqlite.connect(_DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM conversations WHERE id=?", (cid,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")
        async with db.execute(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at",
            (cid,),
        ) as cur:
            msgs = [dict(m) for m in await cur.fetchall()]
    return {"conversation": dict(row), "messages": msgs}


@router.delete("/api/conversations/{cid}")
async def delete_conversation(cid: str) -> dict:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute("DELETE FROM conversations WHERE id=?", (cid,))
        await db.commit()
    return {"deleted": cid}
