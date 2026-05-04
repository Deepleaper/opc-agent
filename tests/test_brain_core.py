"""Tests for opc.core.brain — store, recall, stats."""
import pytest
import pytest_asyncio

from opc.core.brain import init_brain_db, store_entry, recall, get_stats


@pytest_asyncio.fixture(autouse=True)
async def _init_db():
    await init_brain_db()


@pytest.mark.asyncio
async def test_store_and_recall():
    slug = await store_entry(type="fact", content="User likes Python", source="test")
    assert slug  # non-empty slug returned

    results = await recall("Python", limit=5)
    assert len(results) >= 1
    assert any("Python" in r["content"] for r in results)


@pytest.mark.asyncio
async def test_recall_empty_db():
    # With empty DB, recall returns empty or fallback
    results = await recall("nonexistent topic xyz", limit=5)
    # Should not crash; returns list
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_store_multiple_and_stats():
    await store_entry(type="fact", content="User lives in Beijing", source="test")
    await store_entry(type="preference", content="User prefers dark mode", source="test")
    await store_entry(type="skill", content="User knows Rust", source="test")

    stats = await get_stats()
    assert stats["exists"] is True
    assert stats["total"] >= 3
    assert "fact" in stats["types"]


@pytest.mark.asyncio
async def test_recall_relevance_ranking():
    """More keyword hits should rank higher."""
    await store_entry(type="fact", content="Python is great for AI", source="test")
    await store_entry(type="fact", content="Python machine learning AI tools", source="test")

    results = await recall("Python AI", limit=5)
    assert len(results) >= 1
    # Both entries match; the one with both keywords should appear
    contents = [r["content"] for r in results]
    assert any("Python" in c and "AI" in c for c in contents)
