"""OPC Agent CLI — opc start / stop / status"""

import fire


def cmd_start(port: int = 3000, no_browser: bool = False):
    """Start OPC Agent server."""
    from rich.console import Console
    console = Console()
    console.print(f"\n[bold cyan]OPC Agent[/bold cyan] starting on [bold]http://localhost:{port}[/bold]\n")
    # TODO: Ollama detection, model check, FastAPI server
    console.print("[dim]Coming soon...[/dim]")


def cmd_stop():
    """Stop OPC Agent server."""
    print("Stopping OPC Agent...")
    # TODO: stop server


def cmd_status():
    """Show OPC Agent status."""
    print("OPC Agent status:")
    # TODO: show Ollama status, model, RAM, brain.db stats


class OPCCommands:
    """OPC Agent — Local-first AI Agent for Mac."""
    def start(self, port: int = 3000, no_browser: bool = False):
        cmd_start(port=port, no_browser=no_browser)

    def stop(self):
        cmd_stop()

    def status(self):
        cmd_status()


def main():
    fire.Fire(OPCCommands, name="opc")


if __name__ == "__main__":
    main()
