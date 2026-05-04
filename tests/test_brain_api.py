"""Tests for /api/brain/* endpoints."""
import pytest
import pytest_asyncio
from opc.core.brain import init_brain_db


@pytest.mark.asyncio
async def test_learn_and_list(client):
    # Learn a fact
    resp = await client.post("/api/brain/learn", json={"content": "Test fact", "type": "fact"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "fact"
    assert data["slug"]

    # List entries
    resp = await client.get("/api/brain/entries")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1


@pytest.mark.asyncio
async def test_learn_invalid_type(client):
    resp = await client.post("/api/brain/learn", json={"content": "x", "type": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_learn_empty_content(client):
    resp = await client.post("/api/brain/learn", json={"content": "  ", "type": "fact"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recall_endpoint(client):
    await client.post("/api/brain/learn", json={"content": "User likes sushi", "type": "preference"})
    resp = await client.get("/api/brain/recall", params={"q": "sushi"})
    assert resp.status_code == 200
    assert len(resp.json()["results"]) >= 1


@pytest.mark.asyncio
async def test_recall_empty_query(client):
    resp = await client.get("/api/brain/recall", params={"q": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_stats_endpoint(client):
    resp = await client.get("/api/brain/stats")
    assert resp.status_code == 200
    assert "total" in resp.json()


@pytest.mark.asyncio
async def test_delete_entry(client):
    resp = await client.post("/api/brain/learn", json={"content": "Delete me", "type": "fact"})
    slug = resp.json()["slug"]
    resp = await client.delete(f"/api/brain/entries/{slug}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == slug
