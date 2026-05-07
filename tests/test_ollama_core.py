"""Tests for opc.core.ollama — recommend_model, get_ram_info, detect_device."""
from unittest.mock import patch, MagicMock
from opc.core.ollama import recommend_model, get_ram_info


def _mock_device(ram_gb, gpu_type="none", vram_gb=0):
    """Create a mock device dict."""
    return {
        "os": "Linux", "arch": "x86_64", "cpu": "test",
        "ram_gb": ram_gb, "ram_available_gb": ram_gb * 0.7,
        "gpu": {"type": gpu_type, "name": "test", "vram_gb": vram_gb},
    }


def test_recommend_model_high_ram_nvidia():
    device = _mock_device(32, "nvidia", 24)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:32b"


def test_recommend_model_mid_vram_nvidia():
    device = _mock_device(32, "nvidia", 12)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:14b"


def test_recommend_model_low_vram_nvidia():
    device = _mock_device(16, "nvidia", 8)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:7b"


def test_recommend_model_apple_silicon():
    device = _mock_device(48, "apple_silicon", 48)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:32b"  # 48GB < 64GB threshold for 72b


def test_recommend_model_apple_silicon_16gb():
    device = _mock_device(16, "apple_silicon", 16)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:14b"


def test_recommend_model_cpu_only():
    device = _mock_device(8, "none", 0)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:3b"


def test_recommend_model_cpu_only_low():
    device = _mock_device(4, "none", 0)
    rec = recommend_model(device)
    assert rec["model"] == "qwen2.5:1.5b"


def test_recommend_model_returns_dict():
    device = _mock_device(16, "nvidia", 12)
    rec = recommend_model(device)
    assert "model" in rec
    assert "display_name" in rec
    assert "size_note" in rec
    assert "device_summary" in rec


def test_get_ram_info():
    with patch("opc.core.ollama.psutil") as mock_psutil:
        mock_psutil.virtual_memory.return_value = MagicMock(
            total=16e9, available=8e9, percent=50.0
        )
        info = get_ram_info()
        assert info["total_gb"] == 16.0
        assert info["available_gb"] == 8.0
        assert info["used_percent"] == 50.0
