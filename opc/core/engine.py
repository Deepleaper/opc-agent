"""Chat engine — streams tokens from Ollama, manages conversation history."""

from __future__ import annotations

import json
from pathlib import Path
from typing import AsyncIterator

import httpx

OLLAMA_BASE = "http://localhost:11434"
_DEFAULT_SYSTEM = "You are OPC Agent, a helpful local AI assistant running entirely on this machine."


def _load_system_prompt(workspace_path: Path) -> str:
    parts: list[str] = []
    for fname in ("SOUL.md", "EGO.md"):
        p = workspace_path / fname
        if p.exists():
            parts.append(p.read_text(encoding="utf-8").strip())
    return "\n\n".join(parts) if parts else _DEFAULT_SYSTEM


class ChatEngine:
    def __init__(self, workspace_path: Path | None = None) -> None:
        self.workspace_path = workspace_path or Path.cwd()
        self._system_prompt: str | None = None

    @property
    def system_prompt(self) -> str:
        if self._system_prompt is None:
            self._system_prompt = _load_system_prompt(self.workspace_path)
        return self._system_prompt

    def reload_system_prompt(self) -> None:
        self._system_prompt = None

    async def stream_chat(
        self, messages: list[dict], model: str
    ) -> AsyncIterator[str]:
        full_messages = [{"role": "system", "content": self.system_prompt}] + messages
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE}/api/chat",
                json={"model": model, "messages": full_messages, "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue


# Module-level singleton — initialized lazily so config is ready first.
_engine: ChatEngine | None = None


def get_engine() -> ChatEngine:
    global _engine
    if _engine is None:
        from opc.core.config import config

        workspace = Path(config.get("workspace_path", str(Path.cwd())))
        _engine = ChatEngine(workspace_path=workspace)
    return _engine
