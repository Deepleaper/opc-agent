"""Tests for /api/workspace/* endpoints."""
import pytest
from unittest.mock import patch
from pathlib import Path


@pytest.mark.asyncio
async def test_list_files(client, tmp_path):
    (tmp_path / "README.md").write_text("hello")
    (tmp_path / "SOUL.md").write_text("soul")
    with patch("opc.api.workspace._workspace", return_value=tmp_path):
        resp = await client.get("/api/workspace/files")
        assert resp.status_code == 200
        names = [f["name"] for f in resp.json()]
        assert "README.md" in names


@pytest.mark.asyncio
async def test_read_file(client, tmp_path):
    (tmp_path / "TEST.md").write_text("content here")
    with patch("opc.api.workspace._workspace", return_value=tmp_path):
        resp = await client.get("/api/workspace/files/TEST.md")
        assert resp.status_code == 200
        assert resp.json()["content"] == "content here"


@pytest.mark.asyncio
async def test_read_file_not_found(client, tmp_path):
    with patch("opc.api.workspace._workspace", return_value=tmp_path):
        resp = await client.get("/api/workspace/files/NOPE.md")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_file(client, tmp_path):
    with patch("opc.api.workspace._workspace", return_value=tmp_path):
        resp = await client.put("/api/workspace/files/NEW.md", json={"content": "new content"})
        assert resp.status_code == 200
        assert (tmp_path / "NEW.md").read_text() == "new content"


@pytest.mark.asyncio
async def test_invalid_filename(client):
    # Path traversal with .. should be rejected
    resp = await client.get("/api/workspace/files/.hidden.md")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_non_md_rejected(client):
    resp = await client.get("/api/workspace/files/test.txt")
    assert resp.status_code == 400
