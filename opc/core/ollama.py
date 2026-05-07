"""Ollama integration — detect, list, pull, recommend by device."""

from __future__ import annotations

import platform
import subprocess
from typing import Callable

import httpx
import psutil

OLLAMA_BASE = "http://localhost:11434"


async def detect_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def list_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{OLLAMA_BASE}/api/tags")
        r.raise_for_status()
        data = r.json()
    return [
        {
            "name": m["name"],
            "size_gb": round(m.get("size", 0) / 1e9, 1),
            "modified_at": m.get("modified_at", ""),
        }
        for m in data.get("models", [])
    ]


async def pull_model(
    name: str,
    progress_callback: Callable[[dict], None] | None = None,
) -> None:
    import json

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST", f"{OLLAMA_BASE}/api/pull", json={"name": name}
        ) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line and progress_callback:
                    try:
                        progress_callback(json.loads(line))
                    except Exception:
                        pass


def get_ram_info() -> dict:
    mem = psutil.virtual_memory()
    return {
        "total_gb": round(mem.total / 1e9, 1),
        "available_gb": round(mem.available / 1e9, 1),
        "used_percent": mem.percent,
    }


def _detect_gpu() -> dict:
    """Detect GPU type and VRAM."""
    result = {"type": "none", "name": "", "vram_gb": 0}
    system = platform.system()

    # Apple Silicon (unified memory)
    if system == "Darwin":
        try:
            out = subprocess.check_output(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                text=True, timeout=5,
            ).strip()
            if "Apple" in out:
                mem_gb = psutil.virtual_memory().total / 1e9
                result = {"type": "apple_silicon", "name": out, "vram_gb": mem_gb}
                return result
        except Exception:
            pass

    # NVIDIA GPU
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            text=True, timeout=10,
        ).strip()
        if out:
            parts = out.split(",")
            name = parts[0].strip()
            vram_mb = float(parts[1].strip()) if len(parts) > 1 else 0
            result = {"type": "nvidia", "name": name, "vram_gb": round(vram_mb / 1024, 1)}
            return result
    except Exception:
        pass

    # AMD GPU (ROCm)
    try:
        out = subprocess.check_output(
            ["rocm-smi", "--showmeminfo", "vram"],
            text=True, timeout=10,
        ).strip()
        if "Total" in out:
            # Rough parsing
            for line in out.split("\n"):
                if "Total" in line:
                    parts = line.split()
                    for p in parts:
                        try:
                            mb = float(p)
                            if mb > 512:  # likely MB
                                result = {"type": "amd", "name": "AMD GPU", "vram_gb": round(mb / 1024, 1)}
                                return result
                        except ValueError:
                            continue
    except Exception:
        pass

    return result


def detect_device() -> dict:
    """Full device detection: CPU, RAM, GPU, OS."""
    ram = get_ram_info()
    gpu = _detect_gpu()
    return {
        "os": platform.system(),
        "arch": platform.machine(),
        "cpu": platform.processor() or "unknown",
        "ram_gb": ram["total_gb"],
        "ram_available_gb": ram["available_gb"],
        "gpu": gpu,
    }


# Model recommendation table
# Format: (min_vram_or_ram, model_name, display_name, size_note)
_MODELS = {
    "apple_silicon": [
        (64, "qwen2.5:72b", "Qwen 2.5 72B", "~40GB, best quality"),
        (32, "qwen2.5:32b", "Qwen 2.5 32B", "~18GB, excellent"),
        (16, "qwen2.5:14b", "Qwen 2.5 14B", "~9GB, great balance"),
        (8,  "qwen2.5:7b",  "Qwen 2.5 7B",  "~4.5GB, fast"),
        (4,  "qwen2.5:3b",  "Qwen 2.5 3B",  "~2GB, lightweight"),
    ],
    "nvidia": [
        (24, "qwen2.5:32b", "Qwen 2.5 32B", "~18GB VRAM"),
        (12, "qwen2.5:14b", "Qwen 2.5 14B", "~9GB VRAM"),
        (8,  "qwen2.5:7b",  "Qwen 2.5 7B",  "~4.5GB VRAM"),
        (4,  "qwen2.5:3b",  "Qwen 2.5 3B",  "~2GB VRAM"),
    ],
    "amd": [
        (24, "qwen2.5:32b", "Qwen 2.5 32B", "~18GB VRAM"),
        (12, "qwen2.5:14b", "Qwen 2.5 14B", "~9GB VRAM"),
        (8,  "qwen2.5:7b",  "Qwen 2.5 7B",  "~4.5GB VRAM"),
        (4,  "qwen2.5:3b",  "Qwen 2.5 3B",  "~2GB VRAM"),
    ],
    "cpu_only": [
        (32, "qwen2.5:14b", "Qwen 2.5 14B", "~9GB RAM, slow but capable"),
        (16, "qwen2.5:7b",  "Qwen 2.5 7B",  "~4.5GB RAM"),
        (8,  "qwen2.5:3b",  "Qwen 2.5 3B",  "~2GB RAM, fastest"),
        (4,  "qwen2.5:1.5b","Qwen 2.5 1.5B", "~1GB RAM, minimal"),
    ],
}

# Embedding model for DeepBrain (always pull this too)
EMBED_MODEL = "nomic-embed-text"


def recommend_model(device: dict | None = None) -> dict:
    """Recommend best model for this device.

    Returns dict with: model, display_name, size_note, device_summary
    """
    if device is None:
        device = detect_device()

    gpu = device.get("gpu", {})
    gpu_type = gpu.get("type", "none")

    # Determine which table and available memory
    if gpu_type == "apple_silicon":
        table = _MODELS["apple_silicon"]
        available = device["ram_gb"]  # unified memory
        accel = f"Apple Silicon ({gpu['name']}), {available:.0f}GB unified"
    elif gpu_type == "nvidia":
        table = _MODELS["nvidia"]
        available = gpu["vram_gb"]
        accel = f"NVIDIA {gpu['name']}, {available:.0f}GB VRAM"
    elif gpu_type == "amd":
        table = _MODELS["amd"]
        available = gpu["vram_gb"]
        accel = f"AMD {gpu['name']}, {available:.0f}GB VRAM"
    else:
        table = _MODELS["cpu_only"]
        available = device["ram_gb"]
        accel = f"CPU only, {available:.0f}GB RAM"

    # Find best model that fits
    for min_mem, model, display, note in table:
        if available >= min_mem:
            return {
                "model": model,
                "display_name": display,
                "size_note": note,
                "device_summary": accel,
            }

    # Fallback: smallest model
    _, model, display, note = table[-1]
    return {
        "model": model,
        "display_name": display,
        "size_note": note,
        "device_summary": accel,
    }
