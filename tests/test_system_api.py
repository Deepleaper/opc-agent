"""Tests for /api/system/* endpoints."""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_system_status(client):
    with patch("opc.api.system.ollama_core.detect_ollama", new_callable=AsyncMock, return_value=True), \
         patch("opc.api.system.ollama_core.list_models", new_callable=AsyncMock, return_value=[]), \
         patch("opc.api.system.ollama_core.get_ram_info", return_value={"total_gb": 16, "available_gb": 8, "used_percent": 50}):
        resp = await client.get("/api/system/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ollama"]["running"] is True
        assert "ram" in data
        assert "brain" in data


@pytest.mark.asyncio
async def test_first_time_setup(client):
    with patch("opc.api.system.ollama_core.detect_ollama", new_callable=AsyncMock, return_value=False), \
         patch("opc.api.system.ollama_core.get_ram_info", return_value={"total_gb": 8, "available_gb": 4, "used_percent": 50}), \
         patch("opc.api.system.ollama_core.recommend_model", return_value="qwen2.5:7b"):
        resp = await client.post("/api/system/setup")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ollama_running"] is False
        assert data["recommended_model"] == "qwen2.5:7b"
