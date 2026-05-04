"""Tests for opc.core.engine — ChatEngine."""
import pytest
from pathlib import Path
from opc.core.engine import ChatEngine, _load_system_prompt


def test_load_system_prompt_default(tmp_path):
    prompt = _load_system_prompt(tmp_path)
    assert "OPC Agent" in prompt


def test_load_system_prompt_from_soul(tmp_path):
    (tmp_path / "SOUL.md").write_text("I am a custom agent.")
    prompt = _load_system_prompt(tmp_path)
    assert "custom agent" in prompt


def test_engine_system_prompt_cached(tmp_path):
    engine = ChatEngine(workspace_path=tmp_path)
    p1 = engine.system_prompt
    p2 = engine.system_prompt
    assert p1 is p2  # same object, cached


def test_engine_reload_prompt(tmp_path):
    engine = ChatEngine(workspace_path=tmp_path)
    _ = engine.system_prompt
    (tmp_path / "SOUL.md").write_text("Reloaded prompt")
    engine.reload_system_prompt()
    assert "Reloaded" in engine.system_prompt
