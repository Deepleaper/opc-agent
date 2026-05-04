"""Shared fixtures for OPC Agent tests."""
import asyncio
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def _mock_opc_dir(tmp_path, monkeypatch):
    """Redirect all DB paths to tmp dir so tests never touch real ~/.opc."""
    fake_opc = tmp_path / ".opc"
    fake_opc.mkdir()
    # Patch brain DB path
    monkeypatch.setattr("opc.core.brain._BRAIN_DB", fake_opc / "brain.db")
    # Patch chat DB path
    monkeypatch.setattr("opc.api.chat._DB_PATH", fake_opc / "conversations.db")
    # Patch brain API DB path
    monkeypatch.setattr("opc.api.brain._BRAIN_DB", fake_opc / "brain.db")
    # Patch system API DB path
    monkeypatch.setattr("opc.api.system._BRAIN_DB", fake_opc / "brain.db")
    # Patch config
    monkeypatch.setattr("opc.core.config.OPC_DIR", fake_opc)
    monkeypatch.setattr("opc.core.config.CONFIG_PATH", fake_opc / "config.yaml")


@pytest_asyncio.fixture
async def client():
    """AsyncClient talking to the FastAPI app with mocked Ollama."""
    with patch("opc.core.ollama.detect_ollama", new_callable=AsyncMock, return_value=True):
        from opc.server import app
        from opc.api.chat import init_db
        from opc.core.brain import init_brain_db
        await init_db()
        await init_brain_db()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
