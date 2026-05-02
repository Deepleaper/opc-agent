#!/usr/bin/env python3
"""OPC Agent Benchmark Suite — 5 dimensions, max 50 points.

Usage:
    python benchmark/run_benchmark.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

# Force UTF-8 output so Unicode box-drawing chars work on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def _colour(score: float, max_score: float) -> str:
    r = score / max_score if max_score else 0
    return GREEN if r >= 0.8 else YELLOW if r >= 0.5 else RED


# ─── shared mock builders ─────────────────────────────────────────────────────

def _brain_http_mock(response_text: str) -> MagicMock:
    """Mock httpx.AsyncClient for brain.py:
    - GET /api/tags  → empty model list (skips model-preference logic)
    - POST /api/generate → response_text
    """
    tags_resp = MagicMock()
    tags_resp.status_code = 200
    tags_resp.json.return_value = {"models": []}

    gen_resp = MagicMock()
    gen_resp.raise_for_status = MagicMock()
    gen_resp.json.return_value = {"response": response_text}

    inst = AsyncMock()
    inst.get  = AsyncMock(return_value=tags_resp)
    inst.post = AsyncMock(return_value=gen_resp)
    inst.__aenter__ = AsyncMock(return_value=inst)
    inst.__aexit__  = AsyncMock(return_value=False)

    return MagicMock(return_value=inst)


def _engine_http_mock(captured: dict | None = None) -> MagicMock:
    """Mock httpx.AsyncClient for engine.py:
    - client.stream("POST", ..., json=payload) → captures payload, yields 1 token then done
    """
    async def fake_aiter_lines():
        yield json.dumps({"message": {"content": "OK"}, "done": True})

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = fake_aiter_lines

    stream_cm = MagicMock()
    stream_cm.__aenter__ = AsyncMock(return_value=mock_response)
    stream_cm.__aexit__  = AsyncMock(return_value=False)

    mock_client = MagicMock()
    def _stream(method, url, **kw):
        if captured is not None:
            captured.update(kw.get("json", {}))
        return stream_cm
    mock_client.stream = _stream

    client_cm = MagicMock()
    client_cm.__aenter__ = AsyncMock(return_value=mock_client)
    client_cm.__aexit__  = AsyncMock(return_value=False)

    return MagicMock(return_value=client_cm)


# ═════════════════════════════════════════════════════════════════════════════
# D1 — Auto-extraction quality  (max 20)
# ═════════════════════════════════════════════════════════════════════════════

async def run_d1(tmp: Path) -> tuple[float, float, list[str]]:
    import opc.core.brain as B
    orig = B._BRAIN_DB
    B._BRAIN_DB = tmp / "d1.db"
    await B.init_brain_db()
    notes: list[str] = []
    score = 0.0

    # Case 1: personal info conversation — expect 3 facts (5 pts)
    resp1 = json.dumps([
        {"type": "fact", "content": "User's name is 张三"},
        {"type": "fact", "content": "User is 28 years old"},
        {"type": "fact", "content": "User is a software engineer"},
    ])
    with patch("httpx.AsyncClient", _brain_http_mock(resp1)):
        items1 = await B.extract_knowledge(
            [{"role": "user",      "content": "我叫张三，28岁，软件工程师"},
             {"role": "assistant", "content": "你好！"}],
            "qwen2.5:7b",
        )
    if len(items1) == 3 and all("type" in i and "content" in i for i in items1):
        score += 5; notes.append("✓ Case1 (个人信息): 正确提取 3 条知识")
    elif items1:
        score += 2; notes.append(f"~ Case1 (个人信息): 部分提取 {len(items1)} 条 (期望 3)")
    else:
        notes.append("✗ Case1 (个人信息): 未提取任何知识")

    # Case 2: preferences — expect preference type entries (5 pts)
    resp2 = json.dumps([
        {"type": "preference", "content": "User likes coffee"},
        {"type": "preference", "content": "User dislikes waking up early"},
    ])
    with patch("httpx.AsyncClient", _brain_http_mock(resp2)):
        items2 = await B.extract_knowledge(
            [{"role": "user", "content": "我喜欢咖啡，讨厌早起"}],
            "qwen2.5:7b",
        )
    prefs = [i for i in items2 if i.get("type") == "preference"]
    if len(prefs) >= 2:
        score += 5; notes.append("✓ Case2 (偏好): 正确识别 2 条 preference")
    elif prefs:
        score += 2; notes.append(f"~ Case2 (偏好): 只得到 {len(prefs)} 条 preference")
    else:
        notes.append("✗ Case2 (偏好): 未识别出 preference 类型")

    # Case 3: trivial weather chat — should return [] (5 pts)
    with patch("httpx.AsyncClient", _brain_http_mock("[]")):
        items3 = await B.extract_knowledge(
            [{"role": "user",      "content": "今天天气怎么样？"},
             {"role": "assistant", "content": "我无法实时查天气"}],
            "qwen2.5:7b",
        )
    if not items3:
        score += 5; notes.append("✓ Case3 (天气闲聊): 正确返回 [] 不应提取")
    else:
        notes.append(f"✗ Case3 (天气闲聊): 不该提取，但得到 {len(items3)} 条")

    # Case 4: LLM wraps answer in markdown code fence — must strip it (5 pts)
    resp4 = '```json\n[{"type":"skill","content":"User knows Python"}]\n```'
    with patch("httpx.AsyncClient", _brain_http_mock(resp4)):
        items4 = await B.extract_knowledge(
            [{"role": "user", "content": "我会Python"}],
            "qwen2.5:7b",
        )
    if len(items4) == 1 and items4[0].get("type") == "skill":
        score += 5; notes.append("✓ Case4 (Markdown剥离): 正确处理 ```json 代码块")
    else:
        notes.append(f"✗ Case4 (Markdown剥离): 期望 1 skill，实际得到 {items4}")

    B._BRAIN_DB = orig
    return score, 20.0, notes


# ═════════════════════════════════════════════════════════════════════════════
# D2 — Recall accuracy  (max 10)
# ═════════════════════════════════════════════════════════════════════════════

async def run_d2(tmp: Path) -> tuple[float, float, list[str]]:
    import opc.core.brain as B
    orig = B._BRAIN_DB
    B._BRAIN_DB = tmp / "d2.db"
    await B.init_brain_db()
    notes: list[str] = []
    score = 0.0

    # Seed known facts
    await B.store_entry("fact",       "User's name is Alice",                   "test")
    await B.store_entry("preference", "User loves Python programming",          "test")
    await B.store_entry("fact",       "User lives in Beijing",                  "test")
    await B.store_entry("experience", "User has 5 years backend experience",    "test")
    await B.store_entry("skill",      "User is proficient in machine learning", "test")

    cases = [
        ("Alice name",               "Alice",   "查询姓名"),
        ("Python programming",       "Python",  "查询编程偏好"),
        ("Beijing city location",    "Beijing", "查询地点"),
        ("backend experience years", "backend", "查询经验"),
        ("machine learning skill",   "machine", "查询技能"),
    ]
    for query, kw, label in cases:
        results = await B.recall(query, limit=5)
        if any(kw.lower() in r["content"].lower() for r in results):
            score += 2; notes.append(f"✓ {label}: 命中关键词 '{kw}'")
        else:
            snippet = " | ".join(r["content"][:40] for r in results) if results else "<空>"
            notes.append(f"✗ {label}: 未命中 '{kw}'，返回: {snippet}")

    B._BRAIN_DB = orig
    return score, 10.0, notes


# ═════════════════════════════════════════════════════════════════════════════
# D3 — Orchestration decisions  (max 10)
# ═════════════════════════════════════════════════════════════════════════════

async def run_d3(tmp: Path) -> tuple[float, float, list[str]]:
    import opc.core.brain as B
    from opc.core.engine import ChatEngine
    orig = B._BRAIN_DB
    B._BRAIN_DB = tmp / "d3.db"
    await B.init_brain_db()
    notes: list[str] = []
    score = 0.0

    # T1: meaningful message → extract_and_store should persist it (2 pts)
    with patch("httpx.AsyncClient", _brain_http_mock(
        json.dumps([{"type": "fact", "content": "User's name is 张三"}])
    )):
        await B.extract_and_store(
            [{"role": "user",      "content": "我叫张三"},
             {"role": "assistant", "content": "好的！"}],
            "qwen2.5:7b",
        )
    recalled = await B.recall("张三", limit=5)
    if any("张三" in r["content"] for r in recalled):
        score += 2; notes.append("✓ T1 (应存): '我叫张三' → 正确写入记忆")
    else:
        notes.append("✗ T1 (应存): '我叫张三' → 未写入记忆")

    # T2: weather small talk → extract returns [] → nothing should be stored (2 pts)
    before = (await B.get_stats())["total"]
    with patch("httpx.AsyncClient", _brain_http_mock("[]")):
        await B.extract_and_store(
            [{"role": "user",      "content": "今天天气怎么样"},
             {"role": "assistant", "content": "我无法查天气"}],
            "qwen2.5:7b",
        )
    after = (await B.get_stats())["total"]
    if after == before:
        score += 2; notes.append("✓ T2 (不应存): 天气闲聊 → DB 未增长")
    else:
        notes.append(f"✗ T2 (不应存): 天气闲聊 → 多写了 {after - before} 条")

    # T3: user asks about previous conversation → recall should return the stored fact (2 pts)
    recalled3 = await B.recall("我上次说我叫什么名字", limit=5)
    if any("张三" in r["content"] for r in recalled3):
        score += 2; notes.append("✓ T3 (应取): 历史查询 → 成功召回记忆")
    else:
        notes.append("✗ T3 (应取): 历史查询 → 未召回相关记忆")

    # T4: consecutive small talk → DB count must not grow (2 pts)
    before4 = (await B.get_stats())["total"]
    for content in ["哈哈", "好的", "再见"]:
        with patch("httpx.AsyncClient", _brain_http_mock("[]")):
            await B.extract_and_store(
                [{"role": "user",      "content": content},
                 {"role": "assistant", "content": "嗯"}],
                "qwen2.5:7b",
            )
    after4 = (await B.get_stats())["total"]
    if after4 == before4:
        score += 2; notes.append("✓ T4 (连续闲聊): 3 轮小对话 → DB 未增长")
    else:
        notes.append(f"✗ T4 (连续闲聊): 3 轮小对话 → 多写了 {after4 - before4} 条")

    # T5: stream_chat must call recall on every turn (2 pts)
    await B.store_entry("fact", "User loves hiking", "test")
    engine = ChatEngine(workspace_path=tmp)
    recall_calls: list[str] = []

    original_recall = B.recall
    async def spy_recall(query: str, limit: int = 5):
        recall_calls.append(query)
        return await original_recall(query, limit)

    captured_engine: dict = {}
    with patch("opc.core.brain.recall", spy_recall), \
         patch("httpx.AsyncClient", _engine_http_mock(captured_engine)):
        async for _ in engine.stream_chat(
            [{"role": "user", "content": "hiking mountains"}], "qwen2.5:7b"
        ):
            pass

    if recall_calls:
        score += 2
        notes.append(f"✓ T5 (触发recall): stream_chat 调用了 recall('{recall_calls[0]}')")
    else:
        notes.append("✗ T5 (触发recall): stream_chat 未调用 recall")

    B._BRAIN_DB = orig
    return score, 10.0, notes


# ═════════════════════════════════════════════════════════════════════════════
# D4 — Context injection quality  (max 5)
# ═════════════════════════════════════════════════════════════════════════════

async def run_d4(tmp: Path) -> tuple[float, float, list[str]]:
    import re
    import opc.core.brain as B
    from opc.core.engine import ChatEngine
    orig = B._BRAIN_DB
    B._BRAIN_DB = tmp / "d4.db"
    await B.init_brain_db()
    notes: list[str] = []
    score = 0.0

    await B.store_entry("fact",       "User's name is Bob",                      "test")
    await B.store_entry("preference", "User prefers TypeScript over JavaScript", "test")

    engine = ChatEngine(workspace_path=tmp)
    captured: dict = {}

    with patch("httpx.AsyncClient", _engine_http_mock(captured)):
        async for _ in engine.stream_chat(
            [{"role": "user", "content": "Bob TypeScript"}], "qwen2.5:7b"
        ):
            pass

    messages_sent = captured.get("messages", [])
    sys_msg = next((m for m in messages_sent if m["role"] == "system"), None)
    sys_content = sys_msg["content"] if sys_msg else ""

    # Check 1: knowledge section header present (2 pts)
    if "## Relevant Knowledge" in sys_content:
        score += 2; notes.append("✓ 包含 '## Relevant Knowledge' 标题")
    else:
        notes.append(f"✗ 缺少 '## Relevant Knowledge' 标题 (system末尾: {sys_content[-100:]!r})")

    # Check 2: entries use "- [type] content" format (2 pts)
    if re.search(r"- \[(fact|preference|skill|experience)\]", sys_content):
        score += 2; notes.append("✓ 格式正确: '- [type] content'")
    else:
        notes.append(f"✗ 格式错误，实际内容末尾: {sys_content[-200:]!r}")

    # Check 3: knowledge section capped at ≤2000 chars (1 pt)
    knowledge_section = sys_content.split("## Relevant Knowledge", 1)[-1] \
        if "## Relevant Knowledge" in sys_content else sys_content
    if len(knowledge_section) <= 2100:
        score += 1
        notes.append(f"✓ 知识注入在 2000 字符限制内 ({len(knowledge_section)} chars)")
    else:
        notes.append(f"✗ 知识注入超出限制: {len(knowledge_section)} chars")

    B._BRAIN_DB = orig
    return score, 5.0, notes


# ═════════════════════════════════════════════════════════════════════════════
# D5 — Fault tolerance  (max 5)
# ═════════════════════════════════════════════════════════════════════════════

async def run_d5(tmp: Path) -> tuple[float, float, list[str]]:
    import httpx
    import opc.core.brain as B
    orig = B._BRAIN_DB
    B._BRAIN_DB = tmp / "d5.db"
    await B.init_brain_db()
    await B.store_entry("fact", "User is Alice", "test")
    notes: list[str] = []
    score = 0.0

    # F1: extract_knowledge when Ollama is unreachable → must return [] without raising (2 pts)
    down = AsyncMock()
    down.get  = AsyncMock(side_effect=httpx.ConnectError("Ollama down"))
    down.post = AsyncMock(side_effect=httpx.ConnectError("Ollama down"))
    down.__aenter__ = AsyncMock(return_value=down)
    down.__aexit__  = AsyncMock(return_value=False)
    with patch("httpx.AsyncClient", MagicMock(return_value=down)):
        items = await B.extract_knowledge(
            [{"role": "user", "content": "test"}], "qwen2.5:7b"
        )
    if items == []:
        score += 2; notes.append("✓ F1: Ollama 不可用 → extract_knowledge 返回 [] 不崩溃")
    else:
        notes.append(f"✗ F1: Ollama 不可用时返回了 {items}")

    # F2: recall uses only SQLite — must work even when Ollama is down (2 pts)
    results = await B.recall("Alice", limit=5)
    if any("Alice" in r["content"] for r in results):
        score += 2; notes.append("✓ F2: Ollama 不可用时 recall 仍正常 (pure SQLite)")
    else:
        notes.append("✗ F2: recall 无法在 Ollama 不可用时工作")

    # F3: brain.db does not exist → recall returns [] without raising (1 pt)
    B._BRAIN_DB = tmp / "does_not_exist.db"
    results_empty = await B.recall("anything", limit=5)
    if results_empty == []:
        score += 1; notes.append("✓ F3: DB 不存在 → recall 返回 [] 不崩溃")
    else:
        notes.append(f"✗ F3: DB 不存在时返回了 {results_empty}")

    B._BRAIN_DB = orig
    return score, 5.0, notes


# ═════════════════════════════════════════════════════════════════════════════
# Runner + report
# ═════════════════════════════════════════════════════════════════════════════

_DIM_LABELS = {
    "D1": "自动提取质量",
    "D2": "召回准确率",
    "D3": "编排决策",
    "D4": "上下文注入质量",
    "D5": "容错性",
}


async def main() -> None:
    print(f"\n{BOLD}{'═' * 64}{RESET}")
    print(f"{BOLD}  OPC Agent Benchmark Suite  v1.0{RESET}")
    print(f"{BOLD}{'═' * 64}{RESET}\n")

    dims = [
        ("D1", run_d1),
        ("D2", run_d2),
        ("D3", run_d3),
        ("D4", run_d4),
        ("D5", run_d5),
    ]

    results: dict[str, tuple[float, float, list[str]]] = {}

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for key, fn in dims:
            label = _DIM_LABELS[key]
            t0 = time.perf_counter()
            try:
                score, max_s, notes = await fn(tmp)
            except Exception as exc:
                score, max_s, notes = 0.0, {"D1":20,"D2":10,"D3":10,"D4":5,"D5":5}[key], [f"✗ 运行时异常: {exc}"]
            elapsed = time.perf_counter() - t0
            results[key] = (score, max_s, notes)

            c = _colour(score, max_s)
            print(f"{BOLD}{key} {label}{RESET}  {c}{score:.0f}/{max_s:.0f}{RESET}  ({elapsed:.2f}s)")
            for n in notes:
                print(f"   {n}")
            print()

    total     = sum(v[0] for v in results.values())
    total_max = sum(v[1] for v in results.values())

    print(f"{BOLD}{'─' * 64}{RESET}")
    print(f"  {'维度':<4}  {'名称':<14}  {'得分':>5} {'满分':>4}   {'进度条'}")
    print(f"  {'─' * 60}")
    for key, (s, m, _) in results.items():
        filled = int(s / m * 20) if m else 0
        bar = "█" * filled + "░" * (20 - filled)
        c = _colour(s, m)
        print(f"  {key:<4}  {_DIM_LABELS[key]:<14}  {c}{s:>5.0f}{RESET} /{m:>3.0f}   [{bar}]")
    print(f"  {'─' * 60}")
    tc  = _colour(total, total_max)
    pct = total / total_max * 100 if total_max else 0
    print(f"  {'总计':<20}  {tc}{BOLD}{total:>5.0f}{RESET} /{total_max:>3.0f}   {tc}{pct:.1f}%{RESET}")
    print(f"{BOLD}{'═' * 64}{RESET}")
    print(f"\n  基线分: {tc}{BOLD}{total:.0f} / {total_max:.0f}{RESET}  ({pct:.1f}%)\n")


if __name__ == "__main__":
    asyncio.run(main())
