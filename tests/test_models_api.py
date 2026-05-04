"""Tests for /api/models/* endpoints."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_list_models(client):
    mock_models = [{"name": "qwen2.5:7b", "size_gb": 4.5, "modified_at": "2025-01-01"}]
    with patch("opc.api.models.ollama_core.list_models", new_callable=AsyncMock, return_value=mock_models):
        resp = await client.get("/api/models")
        assert resp.status_code == 200
        assert resp.json() == mock_models


@pytest.mark.asyncio
async def test_recommend_model(client):
    with patch("opc.api.models.ollama_core.recommend_model", return_value="qwen2.5:7b"), \
         patch("opc.api.models.ollama_core.get_ram_info", return_value={"total_gb": 16, "available_gb": 8, "used_percent": 50}):
        resp = await client.get("/api/models/recommend")
        assert resp.status_code == 200
        data = resp.json()
        assert data["recommended"] == "qwen2.5:7b"
        assert "ram" in data


@pytest.mark.asyncio
async def test_set_active_model(client):
    with patch("opc.core.config.save_config"):
        resp = await client.put("/api/models/active", json={"model": "qwen2.5:14b"})
        assert resp.status_code == 200
        assert resp.json()["active_model"] == "qwen2.5:14b"


@pytest.mark.asyncio
async def test_delete_model(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = ""

    mock_client_instance = AsyncMock()
    mock_client_instance.request = AsyncMock(return_value=mock_resp)
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("opc.api.models.httpx.AsyncClient", return_value=mock_client_instance):
        resp = await client.delete("/api/models/qwen2.5:7b")
        assert resp.status_code == 200
        assert resp.json()["deleted"] == "qwen2.5:7b"
