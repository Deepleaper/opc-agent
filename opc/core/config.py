"""Config management — load/save ~/.opc/config.yaml."""

from pathlib import Path

import yaml

OPC_DIR = Path.home() / ".opc"
CONFIG_PATH = OPC_DIR / "config.yaml"

_DEFAULTS: dict = {
    "active_model": "qwen2.5:7b",
    "port": 3000,
    "workspace_path": str(Path.cwd()),
}

config: dict = {}


def load_config() -> dict:
    global config
    OPC_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        config = {**_DEFAULTS, **data}
    else:
        config = dict(_DEFAULTS)
    return config


def save_config() -> None:
    OPC_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False)


load_config()
