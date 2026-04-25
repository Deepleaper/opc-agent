# 快速开始

## 安装

### 一键安装（推荐）

::: code-group

```bash [macOS / Linux]
curl -fsSL https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.sh | bash
```

```powershell [Windows]
irm https://raw.githubusercontent.com/nicepkg/opc-agent/main/install.ps1 | iex
```

:::

### 手动安装

```bash
npm install -g opc-agent
```

验证：

```bash
opc --version
# opc-agent v4.1.1
```

## 创建智能体

### 交互模式

```bash
opc init my-agent
```

启动交互向导，引导你选择角色、模型提供商和通道。

### 从模板创建

```bash
opc init my-agent --role customer-service
```

查看所有可用模板：

```bash
opc init --list-roles
```

内置角色：`customer-service`（客服）、`sales-assistant`（销售助手）、`knowledge-base`（知识库）、`code-reviewer`（代码审查）、`hr-recruiter`（HR 招聘）、`project-manager`（项目经理）、`content-writer`（内容创作）、`legal-assistant`（法律助手）、`financial-advisor`（财务顾问）、`executive-assistant`（行政助理）、`data-analyst`（数据分析）、`teacher`（教师）。

## 运行智能体

```bash
cd my-agent
npm install
opc run
```

自动启动运行时并打开 **OPC Studio** [http://localhost:4000](http://localhost:4000)。

### CLI 对话

快速测试，无需 Web UI：

```bash
opc chat
```

### 单独启动 Studio

```bash
opc studio
```

## 项目结构

`opc init` 后的项目结构：

```
my-agent/
├── oad.yaml          # 智能体定义（模型、通道、技能等）
├── .env              # API 密钥和配置
├── package.json
├── brain-seeds/      # 行业/岗位/工位知识文件
│   └── README.md
├── src/
│   └── skills/       # 自定义技能
│       └── example.ts
├── data/             # 运行时数据（知识库、记忆、日志）
└── node_modules/
```

### 关键文件

| 文件 | 用途 |
|------|------|
| `oad.yaml` | 核心智能体定义 —— 模型、提供商、通道、技能、工作流 |
| `.env` | 环境变量（API 密钥、密钥） |
| `brain-seeds/` | 启动时加载的知识文件，用于自进化系统 |
| `src/skills/` | 自定义 TypeScript/JavaScript 技能 |
| `data/` | 运行时自动创建，存储知识库、记忆、分析数据 |

## 首次运行：模型配置

首次运行时，Studio 自动检测本地 [Ollama](https://ollama.ai) 实例。如果 Ollama 正在运行，可以直接用本地模型对话。

使用云端提供商，在 `.env` 中添加 API 密钥：

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google
GOOGLE_API_KEY=AIza...

# Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

然后在 `oad.yaml` 中设置提供商：

```yaml
spec:
  model: gpt-4o
  provider: openai
```

## 环境检查

验证环境配置：

```bash
opc doctor
```

检查 Node.js 版本、依赖、API 密钥有效性和通道连接性。

## 下一步

- [核心概念](/zh/guide/concepts) — 理解自进化、OAD、知识种子和协议
- [配置](/zh/guide/configuration) — 完整 `oad.yaml` 参考
- [模板](/zh/guide/templates) — 探索所有内置模板
- [CLI 参考](/zh/api/cli) — 完整命令参考
