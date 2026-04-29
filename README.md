# OPC Agent

**本地优先的 AI Agent，零云端依赖。**

一台标准 Mac/PC 跑起来的完整 AI 助手。本地 LLM + 本地知识库 + 本地 Web UI，数据永远不出你的机器。

## 功能

- 🧠 **本地 LLM 对话** — 通过 Ollama 运行，支持 Qwen/Llama/Mistral 等所有主流模型
- 💬 **流式 WebSocket** — 逐 token 实时响应
- 📚 **知识库** — brain.db 本地知识管理
- 📝 **工作区** — Markdown 文件读写
- 🖥️ **Web UI** — 内置前端，开箱即用
- 🔒 **完全离线** — 零云端 API、零数据上传

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
