# OPC Agent

**本地优先的 AI Agent，零云端依赖。**

一台标准 Mac/PC 跑起来的完整 AI 助手。本地 LLM + 本地知识库 + 本地 Web UI，数据永远不出你的机器。

## 功能

- 🧠 **本地 LLM 对话** — 通过 Ollama 运行，支持 Qwen/Llama/Mistral 等所有主流模型
- 💬 **流式 WebSocket** — 逐 token 实时响应
- 📚 **自学习知识库** — 每次对话后自动提取知识，持续积累，越用越聪明
- 📝 **工作区** — Markdown 文件读写
- 🖥️ **Web UI** — 内置前端，开箱即用
- 🔒 **完全离线** — 零云端 API、零数据上传

## Self-Learning (自学习)

OPC Agent v0.2.0 introduces a fully local self-learning loop. Every time you finish a conversation, the agent silently extracts knowledge in the background and stores it in `~/.opc/brain.db`.

**How it works:**

```
You chat  →  Ollama answers  →  [background] Ollama extracts facts/preferences/skills
                                                        ↓
                                              Stored in brain.db
                                                        ↓
Next conversation: relevant entries injected into system prompt automatically
```

**Knowledge types stored:**
- `fact` — things you told the agent (your name, tech stack, project details)
- `preference` — how you like things done (code style, response format)
- `experience` — problems solved and decisions made
- `skill` — capabilities discovered or demonstrated

**Brain API:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/brain/entries` | GET | List stored knowledge |
| `/api/brain/stats` | GET | Knowledge base stats |
| `/api/brain/learn` | POST | Manually teach the agent `{"content": "...", "type": "fact"}` |
| `/api/brain/recall?q=...` | GET | Test what the agent recalls for a query |

All learning is 100% local — Ollama does the extraction, `brain.db` stores the result, nothing leaves your machine.

## 安装

### 前置条件

1. **Python 3.10+**
2. **Ollama** — https://ollama.ai 下载安装后运行 `ollama serve`
3. **拉取模型**：
   ```bash
   ollama pull qwen2.5:7b    # 推荐，4.7GB
   ```

### 安装 OPC Agent

```bash
pip install opc-agent
```

## 使用

```bash
# 启动（自动打开浏览器）
opc start

# 后台查看状态
opc status

# 停止
opc stop

# 指定端口
opc start --port 8080
```

启动后访问 `http://localhost:3000` 即可开始对话。

## 系统要求

| RAM | 推荐模型 | 效果 |
|-----|----------|------|
| 8GB+ | qwen2.5:7b | 基础对话 |
| 24GB+ | qwen2.5:14b | 良好 |
| 32GB+ | qwen2.5:32b | 优秀 |

## 项目结构

```
opc-agent/
├── opc/
│   ├── server.py          # FastAPI 应用入口
│   ├── core/
│   │   ├── brain.py       # 自学习知识引擎 (brain.db)
│   │   ├── config.py      # 配置管理 (~/.opc/config.yaml)
│   │   ├── engine.py      # Chat 引擎（Ollama 流式）
│   │   └── ollama.py      # Ollama 检测/模型管理
│   ├── api/
│   │   ├── chat.py        # WebSocket 对话 + 会话 CRUD
│   │   ├── models.py      # 模型管理 API
│   │   ├── brain.py       # 知识库 API
│   │   ├── workspace.py   # 工作区文件 API
│   │   └── system.py      # 系统状态 API
│   └── web/dist/          # 前端构建产物
├── opc_cli.py             # CLI 入口
└── pyproject.toml
```

## API 概览

| 端点 | 方法 | 功能 |
|------|------|------|
| `/ws/chat` | WebSocket | 流式对话 |
| `/api/conversations` | GET/POST | 会话列表/创建 |
| `/api/conversations/{id}` | GET/DELETE | 会话详情/删除 |
| `/api/models` | GET | 已安装模型 |
| `/api/models/recommend` | GET | RAM 推荐模型 |
| `/api/models/pull` | POST | 拉取新模型 |
| `/api/models/active` | PUT | 切换活跃模型 |
| `/api/brain/entries` | GET | 知识库列表 |
| `/api/brain/stats` | GET | 知识库统计 |
| `/api/brain/learn` | POST | 手动教导知识 |
| `/api/brain/recall?q=...` | GET | 测试知识召回 |
| `/api/workspace/files` | GET | 工作区文件 |
| `/api/system/status` | GET | 系统状态 |

## 配置

配置文件位于 `~/.opc/config.yaml`：

```yaml
active_model: qwen2.5:7b
port: 3000
workspace_path: /path/to/your/workspace
```

## License

Apache-2.0
