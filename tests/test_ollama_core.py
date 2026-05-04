"""Tests for opc.core.ollama — recommend_model, get_ram_info."""
from unittest.mock import patch, MagicMock
from opc.core.ollama import recommend_model, get_ram_info


def test_recommend_model_high_ram():
    with patch("opc.core.ollama.psutil") as mock_psutil:
        mock_psutil.virtual_memory.return_value = MagicMock(total=34e9)
        assert recommend_model() == "qwen2.5:32b"


def test_recommend_model_mid_ram():
    with patch("opc.core.ollama.psutil") as mock_psutil:
        mock_psutil.virtual_memory.return_value = MagicMock(total=26e9)
        assert recommend_model() == "qwen2.5:14b"


def test_recommend_model_low_ram():
    with patch("opc.core.ollama.psutil") as mock_psutil:
        mock_psutil.virtual_memory.return_value = MagicMock(total=16e9)
        assert recommend_model() == "qwen2.5:7b"


def test_get_ram_info():
    with patch("opc.core.ollama.psutil") as mock_psutil:
        mock_psutil.virtual_memory.return_value = MagicMock(
            total=16e9, available=8e9, percent=50.0
        )
        info = get_ram_info()
        assert info["total_gb"] == 16.0
        assert info["available_gb"] == 8.0
        assert info["used_percent"] == 50.0
