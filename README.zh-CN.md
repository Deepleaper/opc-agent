# OPC Agent

**开放 Agent 框架 — 构建、测试和运行面向企业工作站的 AI Agent。**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)

OPC Agent 是一个开源框架，用于构建生产级 AI Agent。提供声明式 Agent 定义格式（OAD）、可插拔技能、多通道支持，以及渐进式信任模型确保安全部署。

## 架构

```
┌─────────────────────────────────────────────────┐
│                   OPC Agent                      │
├─────────────┬──────────┬────────────────────────┤
│    通道      │   技能   │        记忆            │
│  ┌────────┐ │ ┌──────┐ │  ┌──────────────────┐  │
│  │  Web   │ │ │ FAQ  │ │  │  短期记忆         │  │
│  │  WS    │ │ │ 自定义│ │  │  长期记忆         │  │
│  │  CLI   │ │ │ ...  │ │  └──────────────────┘  │
│  └────────┘ │ └──────┘ │                        │
├─────────────┴──────────┴────────────────────────┤
│              Agent 运行时                        │
│  ┌──────────┐ ┌────────┐ ┌────────────────────┐ │
│  │ 生命周期  │ │ 路由器 │ │   LLM 提供商       │ │
│  │ 管理器    │ │        │ │ OpenAI/DeepSeek/   │ │
│  │          │ │        │ │ Qwen (agentkits)   │ │
│  └──────────┘ └────────┘ └────────────────────┘ │
├─────────────────────────────────────────────────┤
│              DTV 框架                            │
│  数据（只读）│ 信任（沙箱→上架）│ 价值（指标追踪）│
└─────────────────────────────────────────────────┘
```

## 快速开始

```bash
# 安装
npm install -g opc-agent

# 创建新的 Agent 项目
opc init my-agent --template customer-service

# 进入项目目录
cd my-agent

# 验证 Agent 定义
opc build

# 沙箱测试
opc test

# 运行 Agent
opc run
```

## OAD — 开放 Agent 定义

Agent 使用声明式 YAML 格式定义：

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
  description: "我的第一个 Agent"
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen]
  model: deepseek-chat
  systemPrompt: "你是一个有用的助手。"
  skills:
    - name: faq-lookup
      description: "查询常见问题"
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm: false
  dtv:
    trust:
      level: sandbox
    value:
      metrics: [response_time, satisfaction_score]
```

## 核心概念

| 概念 | 说明 |
|------|------|
| **Agent** | 自治 AI 实体，具有生命周期（init → ready → running → stopped） |
| **Skill（技能）** | 模块化能力（FAQ、工单创建等） |
| **Channel（通道）** | 用户接口（Web HTTP、WebSocket、CLI） |
| **Memory（记忆）** | 短期（会话内）和长期（持久化） |
| **OAD** | 声明式 YAML Agent 定义格式 |

## DTV 框架

**D**ata（数据）— **T**rust（信任）— **V**alue（价值）：Agent 运营治理框架。

- **数据**：通过 MRGConfig 只读访问业务数据
- **信任**：渐进式级别控制 Agent 能力
  - `sandbox`（沙箱）→ `verified`（已验证）→ `certified`（已认证）→ `listed`（已上架）
- **价值**：ROI 指标追踪（响应时间、满意度、解决率）

## CLI 命令

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 初始化新的 Agent 项目 |
| `opc create <name>` | 从模板创建 Agent |
| `opc build` | 验证 OAD 定义 |
| `opc test` | 沙箱模式测试 |
| `opc run` | 启动 Agent |
| `opc publish` | 打包到注册中心（即将推出） |

## 许可证

[Apache-2.0](LICENSE)

---

由 [Deepleaper](https://github.com/Deepleaper) 构建 🚀
