"""OPC Agent FastAPI application."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from opc.core import ollama as ollama_core
from opc.core.config import OPC_DIR, config


@asynccontextmanager
async def _lifespan(app: FastAPI):
    # Ensure data directory exists
    OPC_DIR.mkdir(parents=True, exist_ok=True)

    # Init conversation DB
    from opc.api.chat import init_db
    await init_db()

    # Warm engine singleton
    from opc.core.engine import get_engine
    get_engine()

    # Log Ollama status
    if await ollama_core.detect_ollama():
        print("[OK] Ollama detected")
    else:
        print("[!]  Ollama not running -- start with: ollama serve")

    yield


app = FastAPI(title="OPC Agent", version="0.1.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from opc.api.brain import router as brain_router
from opc.api.chat import router as chat_router
from opc.api.models import router as models_router
from opc.api.system import router as system_router
from opc.api.workspace import router as workspace_router

app.include_router(chat_router)
app.include_router(models_router)
app.include_router(brain_router)
app.include_router(workspace_router)
app.include_router(system_router)

# ── Static frontend ───────────────────────────────────────────────────────────
_dist = Path(__file__).parent / "web" / "dist"
if _dist.exists() and any(_dist.iterdir()):
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
