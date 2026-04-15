# OPC Agent

**开放 Agent 框架** — 构建、测试和运行企业级 AI Agent。

[![npm version](https://img.shields.io/npm/v/opc-agent.svg)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## 特性

- 🤖 **Agent 框架** — 带生命周期管理、技能和 LLM 集成的 BaseAgent
- 📋 **OAD Schema** — 声明式 Agent 定义（YAML/JSON），内置校验
- 🧠 **记忆系统** — 短期 + 长期记忆，支持 DeepBrain 集成
- 🔌 **多通道** — Web、WebSocket、Telegram 通道
- 🛡️ **DTV 框架** — 数据、信任、价值追踪
- 🎯 **技能系统** — 可插拔技能 + 注册表 + 优先级执行
- 📦 **模板** — 客服、销售助手、知识库、代码审查
- 🚀 **CLI** — 交互式创建、开发模式、构建、测试、运行

## 快速开始

```bash
# 全局安装
npm install -g opc-agent

# 创建新 Agent 项目（交互式）
opc init my-agent

# 使用指定模板
opc init my-bot --template sales-assistant

# 运行 Agent
cd my-agent
opc run
```

## 模板

| 模板 | 描述 |
|------|------|
| `customer-service` | FAQ 查询 + 人工转接 |
| `sales-assistant` | 产品问答 + 线索捕获 + 预约 |
| `knowledge-base` | 基于 DeepBrain 的 RAG 语义检索 |
| `code-reviewer` | Bug 检测 + 代码风格检查 |

## CLI 命令

| 命令 | 描述 |
|------|------|
| `opc init [name]` | 创建新项目（交互式） |
| `opc create <name>` | 从模板创建 Agent |
| `opc info` | 显示 Agent 信息 |
| `opc build` | 校验 OAD |
| `opc test` | 沙箱模式运行 |
| `opc run` | 启动 Agent |
| `opc dev` | 热重载开发模式 |
| `opc publish` | 校验并生成清单 |
| `opc search <query>` | 搜索 OPC 市场（即将推出） |

## 记忆提供者

### 内存（默认）
简单键值存储，重启后数据丢失。

### DeepBrain（可选）
语义搜索历史对话和知识。安装 `deepbrain` 包后配置：

```yaml
memory:
  longTerm:
    provider: deepbrain
    collection: my-collection
```

未安装 deepbrain 时自动降级为内存存储。

## 通道

- **Web** — Express HTTP 服务，`/chat` 接口 + SSE 流式
- **WebSocket** — 实时双向通信 + 广播
- **Telegram** — Telegram Bot API Webhook 处理

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

Apache-2.0 — 见 [LICENSE](LICENSE)。
