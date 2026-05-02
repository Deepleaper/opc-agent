<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center">
    <strong>纯本地 AI 智能体。越用越聪明，一分钱不花。</strong><br>
    <em>A pure-local AI agent that learns and improves from every conversation. Zero cost.</em>
  </p>
</p>

<p align="center">
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/v/opc-agent?color=%2334D058&label=PyPI" alt="PyPI"></a>
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/dm/opc-agent" alt="Downloads"></a>
  <a href="https://github.com/Deepleaper/opc-agent"><img src="https://img.shields.io/github/stars/Deepleaper/opc-agent?style=social" alt="Stars"></a>
  <a href="https://github.com/Deepleaper/opc-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-green" alt="License"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10+-blue" alt="Python"></a>
</p>

<p align="center">
  <a href="#一分钟上手">一分钟上手</a> ·
  <a href="#自学习原理">自学习原理</a> ·
  <a href="#api">API</a> ·
  <a href="./docs/README_EN.md">English</a>
</p>

---

## 和 ChatGPT 的区别

| | ChatGPT | **OPC Agent** |
|---|---|---|
| 记住你 | ❌ 每次重来（或有限记忆） | ✅ 自动学习每次对话 |
| 费用 | $20/月 起 | **$0 永久免费** |
| 数据 | 在 OpenAI 服务器 | **在你自己电脑** |
| 网络 | 必须联网 | **完全离线可用** |
| 定制化 | 有限 | 完全自定义人格和记忆 |

---

## 一分钟上手

```bash
# 1. 装 Ollama（本地 AI 引擎）
# macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: https://ollama.com/download
ollama pull qwen2.5:7b

# 2. 装 OPC Agent
pip install opc-agent

# 3. 启动
opc start
```

打开 **http://localhost:3000** —— 你的私人 AI 助手已上线。

**三步搞定。不需要注册账号，不需要 API Key，不需要信用卡。**

---

## 自学习原理

OPC Agent 不是普通的聊天界面——**它从每次对话中自动学习你的信息。**

```
你: "我们公司用 React + TypeScript，团队 8 个人"

     ┌──────────────────────────────────────┐
     │  后台自动提取：                        │
     │  [fact] 公司技术栈: React + TypeScript  │
     │  [fact] 团队规模: 8 人                  │
     └──────────────────────────────────────┘

下次对话:
你: "帮我写个前端组件"
AI: (自动回忆你用 React + TS) → 直接给 React TypeScript 代码
```

### 技术细节

- **提取**: 对话结束后，本地 Ollama 异步提取关键信息
- **分类**: 每条知识标注类型（事实/偏好/约束）
- **存储**: 写入本地 `~/.opc/brain.db`（SQLite）
- **回忆**: 下次对话前，关键词匹配相关知识，注入 context
- **进化**: 知识自动聚合、去重、衰减

---

## 功能

### 💬 Web UI 对话
- Markdown + 代码高亮渲染
- 流式实时输出
- 多对话管理

### 🧠 自学习记忆
- 对话自动提取知识
- 跨对话记忆积累
- 越用越了解你

### 🎯 智能模型推荐
- 检测你的硬件配置
- 根据 RAM/VRAM 推荐最优模型

### 📁 工作区自定义
- `~/.opc/workspace/SOUL.md` — 定义 AI 人格
- `~/.opc/workspace/MEMORY.md` — 初始记忆
- `~/.opc/workspace/TOOLS.md` — 工具说明

### 🔒 完全本地
- 零网络请求
- 数据全在 `~/.opc/`
- 可以断网使用

---

## API

OPC Agent 提供完整 REST API，可以嵌入你自己的应用：

```bash
# 系统
GET  /api/system/status
POST /api/system/setup

# 模型
GET  /api/models                  # 可用模型
GET  /api/models/recommend        # 智能推荐
POST /api/models/pull             # 拉取新模型
PUT  /api/models/active           # 切换模型

# 对话
GET    /api/conversations         # 列表
POST   /api/conversations         # 新建
GET    /api/conversations/{id}    # 详情
DELETE /api/conversations/{id}    # 删除

# 知识库
GET  /api/brain/entries           # 所有知识
GET  /api/brain/stats             # 统计

# 实时对话
WS   /ws/chat                     # WebSocket 流式
```

### Python 调用示例

```python
import httpx

# 新建对话
r = httpx.post("http://localhost:3000/api/conversations", json={"title": "test"})
cid = r.json()["id"]

# WebSocket 对话
import websockets, asyncio, json

async def chat():
    async with websockets.connect("ws://localhost:3000/ws/chat") as ws:
        await ws.send(json.dumps({"conversation_id": cid, "message": "你好"}))
        async for msg in ws:
            data = json.loads(msg)
            if data["type"] == "token":
                print(data["content"], end="")
            elif data["type"] == "done":
                break

asyncio.run(chat())
```

---

## 系统要求

| 项目 | 最低 | 推荐 |
|------|------|------|
| Python | 3.10 | 3.12+ |
| 内存 | 8 GB | 16 GB+（模型越大越好） |
| Ollama | 必需 | 最新版 |
| GPU | 不需要 | 有则更快 |
| 浏览器 | 任意现代浏览器 | — |

**硬件-模型对照：**
| 内存 | 推荐模型 | 效果 |
|------|---------|------|
| 8 GB | qwen2.5:3b | 基础对话 |
| 16 GB | qwen2.5:7b | 良好体验 |
| 32 GB | qwen2.5:14b | 优秀体验 |
| 64 GB+ | qwen2.5:32b | 接近 GPT-4 |

---

## 配置

```yaml
# ~/.opc/config.yaml（首次启动自动生成）
ollama:
  base_url: http://localhost:11434
  model: qwen2.5:7b

server:
  port: 3000
  host: 0.0.0.0

brain:
  enabled: true
  auto_extract: true    # 对话后自动提取知识
  max_context: 2000     # 注入 context 的字符上限
```

---

## 路线图

- [x] Web UI 对话
- [x] 自学习记忆引擎
- [x] 智能模型推荐
- [x] 完整 REST API
- [x] 工作区自定义
- [ ] RAG 文档问答
- [ ] 插件系统
- [ ] 语音输入
- [ ] 移动端 PWA
- [ ] 多模态（图片理解）

---

## 生态

```
┌─────────────────────────────────────────────┐
│  🚀 Leaper Agent — 自进化 AI 员工团队         │
├─────────────────────────────────────────────┤
│  🤖 OPC Agent — 纯本地 AI 助手 ← 你在这里     │
├─────────────────────────────────────────────┤
│  🧠 OPC DeepBrain — 知识库引擎               │
└─────────────────────────────────────────────┘
```

| 你需要… | 用这个 |
|---------|--------|
| 只要知识库 | [OPC DeepBrain](https://github.com/Deepleaper/opc-deepbrain) |
| 要本地 AI 助手 | **OPC Agent**（本项目，内置 DeepBrain） |
| 要 AI 员工团队 | [Leaper Agent](https://github.com/Deepleaper/leaper-agent) |

---

## 许可证

[Apache-2.0](LICENSE) — 自由使用，商用无限制。

---

<p align="center">
  <a href="https://github.com/Deepleaper"><strong>Deepleaper 跃盟开源</strong></a><br>
  <sub>让每个人都有 AI 超能力。</sub>
</p>

<p align="center">
  ⭐ 如果 OPC Agent 对你有用，请给个 Star。
</p>
