"""Tests for conversation CRUD endpoints."""
import pytest


@pytest.mark.asyncio
async def test_create_conversation(client):
    resp = await client.post("/api/conversations", json={"title": "Test Chat", "model": "qwen2.5:7b"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"]
    assert data["title"] == "Test Chat"


@pytest.mark.asyncio
async def test_list_conversations(client):
    await client.post("/api/conversations", json={"title": "Chat 1"})
    await client.post("/api/conversations", json={"title": "Chat 2"})
    resp = await client.get("/api/conversations")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_get_conversation(client):
    resp = await client.post("/api/conversations", json={"title": "Detail"})
    cid = resp.json()["id"]
    resp = await client.get(f"/api/conversations/{cid}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["conversation"]["id"] == cid
    assert isinstance(body["messages"], list)


@pytest.mark.asyncio
async def test_get_conversation_not_found(client):
    resp = await client.get("/api/conversations/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_conversation(client):
    resp = await client.post("/api/conversations", json={"title": "To Delete"})
    cid = resp.json()["id"]
    resp = await client.delete(f"/api/conversations/{cid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == cid
