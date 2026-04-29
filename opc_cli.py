"""OPC Agent CLI — opc start / stop / status"""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path

import fire
import psutil
from rich.console import Console

console = Console()

_OPC_DIR = Path.home() / ".opc"
_PID_FILE = _OPC_DIR / "opc.pid"


def _write_pid(pid: int) -> None:
    _OPC_DIR.mkdir(parents=True, exist_ok=True)
    _PID_FILE.write_text(str(pid))


def _read_pid() -> int | None:
    if not _PID_FILE.exists():
        return None
    try:
        return int(_PID_FILE.read_text().strip())
    except ValueError:
        return None


def _clear_pid() -> None:
    _PID_FILE.unlink(missing_ok=True)


def _is_alive(pid: int) -> bool:
    return psutil.pid_exists(pid)


class OPCCommands:
    """OPC Agent — Local-first AI Agent."""

    def start(self, port: int = 3000, no_browser: bool = False) -> None:
        """Start OPC Agent server (blocks until Ctrl+C)."""
        import uvicorn

        pid = _read_pid()
        if pid is not None and _is_alive(pid):
            console.print(f"[yellow]OPC Agent already running[/yellow] (PID {pid})")
            console.print(f"  → [cyan]http://localhost:{port}[/cyan]")
            return

        _clear_pid()

        # Quick Ollama check
        try:
            import httpx
            r = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
            if r.status_code == 200:
                console.print("[green]OK[/green] Ollama is running")
            else:
                console.print("[yellow]![/yellow]  Ollama not responding — run: [bold]ollama serve[/bold]")
        except Exception:
            console.print("[yellow]![/yellow]  Ollama not detected — run: [bold]ollama serve[/bold]")

        console.print(
            f"\n[bold cyan]OPC Agent[/bold cyan] -> "
            f"[cyan]http://localhost:{port}[/cyan]\n"
        )

        _write_pid(os.getpid())

        if not no_browser:
            def _open() -> None:
                time.sleep(1.5)
                import webbrowser
                webbrowser.open(f"http://localhost:{port}")
            threading.Thread(target=_open, daemon=True).start()

        try:
            uvicorn.run(
                "opc.server:app",
                host="0.0.0.0",
                port=port,
                log_level="info",
            )
        finally:
            _clear_pid()

    def stop(self) -> None:
        """Stop OPC Agent server."""
        pid = _read_pid()
        if pid is None:
            console.print("[yellow]OPC Agent is not running[/yellow]")
            return
        if not _is_alive(pid):
            console.print("[yellow]Process not found — clearing stale PID[/yellow]")
            _clear_pid()
            return
        try:
            proc = psutil.Process(pid)
            proc.terminate()
            _clear_pid()
            console.print(f"[green]OK[/green] Stopped OPC Agent (PID {pid})")
        except psutil.NoSuchProcess:
            console.print("[yellow]Process already gone — clearing PID[/yellow]")
            _clear_pid()

    def status(self) -> None:
        """Show OPC Agent status — process, Ollama, RAM, model."""
        import asyncio

        from opc.core import ollama as ollama_core

        pid = _read_pid()
        if pid is not None and _is_alive(pid):
            console.print(f"[green][ON] OPC Agent running[/green] (PID {pid})")
        elif pid is not None:
            console.print("[red][OFF] OPC Agent stopped[/red] (stale PID cleared)")
            _clear_pid()
        else:
            console.print("[dim][OFF] OPC Agent not running[/dim]")

        ollama_ok = asyncio.run(ollama_core.detect_ollama())
        if ollama_ok:
            console.print("[green]OK[/green] Ollama running")
            try:
                models = asyncio.run(ollama_core.list_models())
                if models:
                    names = ", ".join(m["name"] for m in models)
                    console.print(f"  Models: [cyan]{names}[/cyan]")
            except Exception:
                pass
        else:
            console.print("[yellow]X[/yellow] Ollama not running")

        ram = ollama_core.get_ram_info()
        console.print(
            f"  RAM: [cyan]{ram['available_gb']} GB[/cyan] free "
            f"/ {ram['total_gb']} GB total"
        )
        console.print(
            f"  Recommended model: [cyan]{ollama_core.recommend_model()}[/cyan]"
        )


def main() -> None:
    fire.Fire(OPCCommands, name="opc")


if __name__ == "__main__":
    main()
