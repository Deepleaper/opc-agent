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

    def init(self) -> None:
        """Initialize OPC Agent — detect device, check Ollama, auto-pull best model."""
        import asyncio
        from rich.progress import Progress, SpinnerColumn, TextColumn
        from opc.core import ollama as ollama_core

        console.print("[bold cyan]OPC Agent Init[/bold cyan]\n")

        # 1. Detect device
        console.print("[bold]Step 1:[/bold] Detecting device...")
        device = ollama_core.detect_device()
        gpu = device["gpu"]
        if gpu["type"] == "apple_silicon":
            console.print(f"  [green]OK[/green] {gpu['name']} — {device['ram_gb']:.0f}GB unified memory")
        elif gpu["type"] == "nvidia":
            console.print(f"  [green]OK[/green] NVIDIA {gpu['name']} — {gpu['vram_gb']:.0f}GB VRAM")
        elif gpu["type"] == "amd":
            console.print(f"  [green]OK[/green] AMD {gpu['name']} — {gpu['vram_gb']:.0f}GB VRAM")
        else:
            console.print(f"  [yellow]![/yellow] No GPU detected — CPU mode ({device['ram_gb']:.0f}GB RAM)")
        console.print(f"  OS: {device['os']} {device['arch']}\n")

        # 2. Check Ollama
        console.print("[bold]Step 2:[/bold] Checking Ollama...")
        ollama_ok = asyncio.run(ollama_core.detect_ollama())
        if not ollama_ok:
            console.print("  [red]X[/red] Ollama not detected")
            console.print("  Install from: [cyan]https://ollama.com[/cyan]")
            console.print("  Then run: [bold]ollama serve[/bold]")
            return
        console.print("  [green]OK[/green] Ollama is running\n")

        # 3. Recommend & pull model
        console.print("[bold]Step 3:[/bold] Setting up models...")
        rec = ollama_core.recommend_model(device)
        models = asyncio.run(ollama_core.list_models())
        model_names = [m["name"] for m in models] if models else []

        # Check if recommended model is already available
        rec_model = rec["model"]
        has_chat_model = any(rec_model.split(":")[0] in n for n in model_names)
        has_embed_model = any(ollama_core.EMBED_MODEL in n for n in model_names)

        if has_chat_model:
            console.print(f"  [green]OK[/green] Chat model ready: {rec['display_name']}")
        else:
            console.print(f"  [cyan]>>>[/cyan] Best model for your device: [bold]{rec['display_name']}[/bold] ({rec['size_note']})")
            console.print(f"  Pulling [bold]{rec_model}[/bold]...")
            try:
                with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
                    task = progress.add_task("Downloading...", total=None)
                    def _on_progress(data: dict) -> None:
                        status = data.get("status", "")
                        if "pulling" in status:
                            total = data.get("total", 0)
                            completed = data.get("completed", 0)
                            if total > 0:
                                pct = int(completed / total * 100)
                                progress.update(task, description=f"Downloading... {pct}%")
                    asyncio.run(ollama_core.pull_model(rec_model, _on_progress))
                console.print(f"  [green]OK[/green] {rec['display_name']} ready")
            except Exception as e:
                console.print(f"  [red]X[/red] Failed to pull: {e}")
                console.print(f"  Try manually: [bold]ollama pull {rec_model}[/bold]")
                return

        # Pull embedding model for DeepBrain
        if has_embed_model:
            console.print(f"  [green]OK[/green] Embedding model ready: {ollama_core.EMBED_MODEL}")
        else:
            console.print(f"  Pulling embedding model [bold]{ollama_core.EMBED_MODEL}[/bold]...")
            try:
                asyncio.run(ollama_core.pull_model(ollama_core.EMBED_MODEL))
                console.print(f"  [green]OK[/green] {ollama_core.EMBED_MODEL} ready")
            except Exception as e:
                console.print(f"  [yellow]![/yellow] Embedding pull failed: {e}")
                console.print("  Memory search will use keyword fallback")

        # 4. Init workspace & brain
        console.print(f"\n[bold]Step 4:[/bold] Setting up workspace...")
        _OPC_DIR.mkdir(parents=True, exist_ok=True)

        # Write config with recommended model
        config_path = _OPC_DIR / "config.json"
        if not config_path.exists():
            import json
            config = {
                "model": rec_model,
                "device": {
                    "gpu_type": gpu["type"],
                    "gpu_name": gpu.get("name", ""),
                    "vram_gb": gpu.get("vram_gb", 0),
                    "ram_gb": device["ram_gb"],
                },
            }
            config_path.write_text(json.dumps(config, indent=2))
            console.print(f"  [green]OK[/green] Config: {config_path}")
        else:
            console.print(f"  [green]OK[/green] Config exists: {config_path}")

        console.print(f"  [green]OK[/green] Workspace: {_OPC_DIR}")
        console.print(f"\n[bold green]Ready![/bold green] Run [bold]opc start[/bold] to launch.")
        console.print(f"  Model: {rec['display_name']} ({rec['device_summary']})")

    def chat(self, port: int = 3000) -> None:
        """Open OPC Agent chat in browser (starts server if not running)."""
        import webbrowser

        pid = _read_pid()
        if pid is not None and _is_alive(pid):
            console.print(f"[green]OK[/green] OPC Agent running — opening browser")
            webbrowser.open(f"http://localhost:{port}")
        else:
            console.print("Starting OPC Agent...")
            self.start(port=port)

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
