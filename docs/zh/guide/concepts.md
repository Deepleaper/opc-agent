# 核心概念

## 自进化

OPC Agent 围绕**自进化**循环构建。智能体不只是回应 —— 它们学习、记忆、持续进步。

### Learn → Recall → Evolve 闭环

```
用户交互
   ↓
[ Learn ]  ←  从对话中提取知识
   ↓
[ Recall ] ←  回应前检索相关知识
   ↓
[ Evolve ] ←  整合、精炼、修剪知识
   ↓
更好的回应
```

- **Learn（学习）**：每次对话后，智能体提取关键事实、偏好和模式，存入知识库。
- **Recall（回忆）**：生成回应前，智能体搜索知识库获取相关上下文。
- **Evolve（进化）**：定期整合碎片化知识、解决矛盾、修剪过时信息。

通过 CLI 直接操作大脑：

```bash
opc brain learn "客户偏好邮件沟通"
opc brain recall "客户沟通偏好"
opc brain evolve   # 整合所有知识
```

## OAD（Open Agent Definition）

OAD 是声明式 YAML schema，在一个文件中定义智能体的所有配置。类似 AI 智能体的 `Dockerfile`。

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0
  description: Acme 公司客服智能体

spec:
  model: gpt-4o
  provider: openai
  temperature: 0.7

  channels:
    - type: web
      port: 4000
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}

  skills:
    - name: order-lookup
      path: ./src/skills/order-lookup.ts

  workflows:
    - name: refund-process
      steps:
        - skill: order-lookup
        - skill: refund-approval
        - skill: notification
```

→ [完整 OAD Schema 参考](/zh/api/oad-schema)

## 知识种子（Brain Seeds）

知识种子是放在 `brain-seeds/` 目录中的知识文件，启动时加载，构成智能体的基础知识。

三个类别：
- **行业知识** — 领域特定的事实（如电商政策、医疗法规）
- **岗位知识** — 角色特定的流程（如退款处理、升级路径）
- **工位知识** — 组织特定的上下文（如公司产品、团队架构）

```
brain-seeds/
├── industry/
│   └── ecommerce-basics.md
├── job/
│   └── customer-service-procedures.md
└── workstation/
    └── company-products.md
```

## 通道

OPC Agent 开箱支持 **25+ 通信通道**：

| 类别 | 通道 |
|------|------|
| 聊天 | Web、Telegram、Slack、Discord、WhatsApp、LINE、Teams、微信 |
| 邮件 | SMTP/IMAP、Gmail、Outlook |
| 语音 | Twilio、WebRTC |
| API | REST、WebSocket、gRPC |
| 社交 | Twitter/X、Facebook Messenger、Instagram |
| 自定义 | Webhook、MQTT、AMQP |

在 `oad.yaml` 中配置通道：

```yaml
spec:
  channels:
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}
    - type: slack
      token: ${SLACK_BOT_TOKEN}
    - type: web
      port: 4000
```

## 协议

OPC Agent 实现三大互操作协议：

### MCP（Model Context Protocol）
连接外部工具和数据源。任何 MCP 兼容服务器都可作为工具使用。

### A2A（Agent-to-Agent）
使用 Google A2A 协议与其他智能体通信，实现多智能体编排。

### AG-UI（Agent-User Interface）
标准化的智能体到 UI 通信协议，支持实时流式传输和交互组件。

## 技能

技能是添加到智能体的模块化能力：

- **内置**：随 OPC Agent 提供（web-search、code-interpreter、file-manager）
- **自定义**：`src/skills/` 中的 TypeScript/JavaScript 文件
- **MCP 工具**：任何 MCP 服务器
- **社区**：从 OPC Hub 安装

```typescript
// src/skills/weather.ts
import { defineSkill } from 'opc-agent';

export default defineSkill({
  name: 'weather',
  description: '获取指定位置的天气',
  parameters: {
    location: { type: 'string', required: true },
  },
  async execute({ location }) {
    const res = await fetch(`https://wttr.in/${location}?format=j1`);
    return await res.json();
  },
});
```

## 工作流

工作流将技能串联成多步骤流程。在 `oad.yaml` 中定义或通过 CLI 运行。

```yaml
spec:
  workflows:
    - name: onboarding
      trigger: "新客户注册"
      steps:
        - skill: create-account
        - skill: send-welcome-email
        - skill: schedule-demo
          condition: "{{plan}} == 'enterprise'"
```

```bash
opc workflow run onboarding --input '{"name": "Alice", "plan": "enterprise"}'
```

## 多智能体协作

多个智能体可以使用五种协作模式协同工作：

| 模式 | 描述 | 场景 |
|------|------|------|
| **辩论** | 智能体各持立场，最佳论点胜出 | 决策、风险评估 |
| **投票** | 智能体投票，多数决 | 内容审核、分类 |
| **流水线** | 一个智能体的输出传给下一个 | 数据处理、内容创作 |
| **层级** | 管理者智能体分派任务给工作者 | 复杂项目、任务分解 |
| **共享记忆** | 智能体共享知识库读写 | 研究团队、协作分析 |

## 下一步

- [配置](/zh/guide/configuration) — 完整 `oad.yaml` 参考
- [模板](/zh/guide/templates) — 预置智能体模板
- [CLI 参考](/zh/api/cli) — 所有命令和参数
