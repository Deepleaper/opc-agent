# 快速开始

## 安装

```bash
npm install -g opc-agent
```

## 创建第一个智能体

```bash
# 交互式创建（会让你选模板和配置）
opc init my-agent
cd my-agent
```

或者直接用模板：

```bash
opc init my-bot --template customer-service
opc init my-bot --template sales-assistant
opc init my-bot --template knowledge-base
```

## 配置

编辑 `.env` 文件，填入你的大语言模型 API Key：

```bash
OPC_LLM_API_KEY=your-api-key
OPC_LLM_BASE_URL=https://api.deepseek.com/v1    # DeepSeek
OPC_LLM_MODEL=deepseek-chat
```

支持的供应商和对应的 Base URL：

| 供应商 | Base URL | 推荐模型 |
|--------|----------|---------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama (本地) | `http://localhost:11434/v1` | `llama3` |

## 启动

```bash
# 启动 Web 对话服务
opc run

# 或者用命令行对话
opc chat

# 开发模式（改代码自动重启）
opc dev
```

访问 `http://localhost:3000` 即可看到对话界面。

## 校验配置

```bash
opc build
```

## 运行测试

```bash
opc test
```

## 查看数据分析

```bash
opc analytics
```

## 下一步

- [核心概念](/zh/guide/concepts) — 理解 OAD、技能、渠道等概念
- [模板列表](/zh/guide/templates) — 查看全部 12 个场景模板
- [配置详解](/zh/guide/configuration) — OAD 文件的完整配置项
- [部署指南](/zh/guide/deployment) — Docker、OpenClaw、Hermes 部署
