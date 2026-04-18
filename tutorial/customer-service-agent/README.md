# Build a Customer Service Agent with OPC Agent

A step-by-step guide covering **every** major feature of OPC Agent — from project setup to production deployment.

> 🌐 中英双语注释 | Bilingual comments throughout

## Table of Contents

1. [Project Setup](#chapter-1-project-setup)
2. [Agent Configuration (OAD)](#chapter-2-agent-configuration)
3. [Skills](#chapter-3-skills)
4. [Memory with DeepBrain](#chapter-4-memory-with-deepbrain)
5. [Channels (Web, Telegram, Discord)](#chapter-5-channels)
6. [Workflow Engine](#chapter-6-workflow-engine)
7. [Built-in Tools](#chapter-7-built-in-tools)
8. [Sub-Agents](#chapter-8-sub-agents)
9. [Plugin System](#chapter-9-plugin-system)
10. [Scheduled Jobs (Cron)](#chapter-10-scheduled-jobs)
11. [Security](#chapter-11-security)
12. [Packaging & Publishing](#chapter-12-packaging--publishing)
13. [Monitoring & Analytics](#chapter-13-monitoring--analytics)

---

## Chapter 1: Project Setup

### Prerequisites

- Node.js >= 18
- npm or yarn
- (Optional) Ollama for local LLM inference

### Install & Initialize

```bash
# 安装 OPC Agent CLI / Install the CLI globally
npm install -g opc-agent

# 检查环境 / Verify your environment
opc doctor

# 创建项目 / Scaffold a new agent project
opc init customer-service
cd customer-service
npm install
```

`opc doctor` checks for Node version, required dependencies, and optional integrations (Ollama, Docker, etc.).

### Project Structure

After initialization, you'll have:

```
customer-service/
├── agent.yaml          # Agent configuration (OAD spec)
├── SOUL.md             # Agent personality & behavior guide
├── package.json        # Node.js dependencies
├── tsconfig.json       # TypeScript config
└── src/
    ├── index.ts        # Entry point
    └── skills/         # Custom skills
        ├── faq.ts
        └── ticket.ts
```

---

## Chapter 2: Agent Configuration

The `agent.yaml` file is the heart of your agent — it follows the **OAD (Open Agent Definition)** spec.

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: customer-service
  version: 1.0.0
  description: 智能客服 Agent — Smart Customer Service Agent
  author: your-name
  license: MIT

spec:
  # LLM 配置 / LLM Configuration
  model: qwen2.5
  provider:
    default: ollama

  # 系统提示词 / System Prompt
  systemPrompt: |
    你是一个专业的客服助手，代表我们的电商平台为客户提供帮助。
    You are a professional customer service assistant.

    规则 / Rules:
    - 用中文回答，必要时使用英文术语
    - 始终保持礼貌和耐心
    - 如果不确定，创建工单转人工
    - 不要编造信息

  # 频道配置 / Channel Configuration
  channels:
    - type: web
      port: 3000

  # 记忆系统 / Memory System
  memory:
    shortTerm: true

  # 技能列表 / Skills
  skills:
    - name: faq
    - name: ticket

  # 调度任务 / Scheduled Jobs
  scheduler:
    jobs:
      - name: daily-report
        schedule: "0 9 * * *"
        task: "Generate daily customer service report"

  # 安全配置 / Security
  security:
    approval: dangerous
    sandbox:
      maxFileSize: 10485760
```

### Key Sections Explained

| Section | Purpose |
|---------|---------|
| `metadata` | Agent identity — name, version, description |
| `spec.model` | Which LLM to use |
| `spec.provider` | LLM provider (ollama, openai, etc.) |
| `spec.systemPrompt` | Base personality and rules |
| `spec.channels` | How users interact with the agent |
| `spec.memory` | Conversation memory settings |
| `spec.skills` | Registered skill modules |
| `spec.scheduler` | Cron-based scheduled tasks |
| `spec.security` | Permission and sandbox settings |

---

## Chapter 3: Skills

Skills are modular capabilities your agent can invoke. Each skill has a name, description, trigger patterns, and an `execute` method.

### FAQ Skill — `src/skills/faq.ts`

```typescript
import { BaseSkill } from 'opc-agent';

// FAQ 查询技能 / FAQ Lookup Skill
export class FAQSkill extends BaseSkill {
  name = 'faq';
  description = 'Look up frequently asked questions';
  triggers = [/常见问题|FAQ|怎么退款|退货|配送|支付/i];

  async execute(input: string): Promise<string> {
    // 常见问题知识库 / FAQ Knowledge Base
    const faqs: Record<string, string> = {
      '退款': '退款将在3-5个工作日内到账。如超时未到账，请联系银行确认。',
      '退货': '请在收到商品7天内申请退货。商品需保持原包装，未使用。',
      '配送': '标准配送3-5天，加急配送1-2天。偏远地区可能延迟1-2天。',
      '支付': '支持支付宝、微信支付、银行卡（Visa/Mastercard/银联）。',
    };

    for (const [key, answer] of Object.entries(faqs)) {
      if (input.includes(key)) return answer;
    }

    return '请问您想了解什么？我们有以下常见问题：退款、退货、配送、支付';
  }
}
```

### Ticket Skill — `src/skills/ticket.ts`

```typescript
import { BaseSkill } from 'opc-agent';

// 工单创建技能 / Support Ticket Skill
export class TicketSkill extends BaseSkill {
  name = 'ticket';
  description = 'Create a support ticket for human follow-up';
  triggers = [/创建工单|提交问题|人工客服|投诉/i];

  async execute(input: string): Promise<string> {
    // 生成唯一工单号 / Generate unique ticket ID
    const ticketId = `TK-${Date.now().toString(36).toUpperCase()}`;

    // 实际项目中这里会写入数据库
    // In production, this would write to a database
    console.log(`[Ticket Created] ${ticketId}: ${input}`);

    return `已创建工单 ${ticketId}，客服团队将在2小时内联系您。\nTicket ${ticketId} created. Our team will contact you within 2 hours.`;
  }
}
```

### Registering Skills

Skills listed in `agent.yaml` under `spec.skills` are auto-discovered from `src/skills/`. The agent matches incoming messages against `triggers` and routes to the appropriate skill.

---

## Chapter 4: Memory with DeepBrain

OPC Agent integrates with **DeepBrain** for persistent memory — enabling your agent to learn from past conversations.

```typescript
// src/index.ts
import { Agent } from 'opc-agent';
import { Brain } from 'deepbrain';

// 初始化 DeepBrain / Initialize DeepBrain
const brain = new Brain({
  database: './data/customer-brain.db',
  embedding_provider: 'ollama',
});
await brain.connect();

const agent = new Agent('./agent.yaml');

// 存储对话用于学习 / Store conversations for learning
agent.on('message', async (msg, response) => {
  await brain.put(
    `conv-${msg.id}`,
    `Q: ${msg.content}\nA: ${response.content}`
  );
});

// 语义搜索历史对话 / Semantic search past conversations
agent.on('beforeReply', async (ctx) => {
  const relevant = await brain.query(ctx.message, { limit: 3 });
  if (relevant.length > 0) {
    ctx.additionalContext = relevant.map(r => r.content).join('\n');
  }
});

await agent.start();
```

### What DeepBrain Provides

- **Semantic search** — Find relevant past conversations by meaning, not just keywords
- **Persistent storage** — SQLite-based, survives restarts
- **Embedding support** — Works with Ollama, OpenAI, or Gemini embeddings

---

## Chapter 5: Channels

Channels define how users interact with your agent. OPC Agent supports multiple simultaneous channels.

### Web (Built-in)

```yaml
spec:
  channels:
    - type: web
      port: 3000
```

Launches a web chat UI at `http://localhost:3000`.

### Telegram

```yaml
spec:
  channels:
    - type: web
      port: 3000
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}
      mode: polling
```

Set the environment variable `TELEGRAM_BOT_TOKEN` from [@BotFather](https://t.me/BotFather).

### Discord

```yaml
spec:
  channels:
    - type: discord
      token: ${DISCORD_BOT_TOKEN}
      guildId: "your-server-id"
```

### Multi-Channel

All channels share the same agent logic, skills, and memory. A message from Telegram triggers the same FAQ skill as one from the web UI.

---

## Chapter 6: Workflow Engine

For multi-step interactions, use the **Workflow Engine** to define conversation flows with branching logic.

```typescript
import { WorkflowBuilder } from 'opc-agent';

// 客户引导流程 / Customer Onboarding Workflow
const onboarding = new WorkflowBuilder()
  .start('greet')
  .addAction('greet', async (ctx) => {
    return '欢迎！请问您是新客户还是老客户？\nWelcome! Are you a new or returning customer?';
  }, { next: 'check-type' })
  .addCondition('check-type',
    (ctx) => ctx.variables.get('isNewCustomer'),
    'new-flow',       // true 分支 / true branch
    'existing-flow'   // false 分支 / false branch
  )
  .addAction('new-flow', async (ctx) => {
    return '让我帮您注册账号。请提供您的邮箱地址。';
  }, { next: 'collect-email' })
  .addAction('collect-email', async (ctx) => {
    const email = ctx.message;
    ctx.variables.set('email', email);
    return `注册成功！欢迎加入，${email}`;
  }, { next: 'done' })
  .addAction('existing-flow', async (ctx) => {
    return '欢迎回来！有什么可以帮您？';
  }, { next: 'done' })
  .addAction('done', async () => 'Onboarding complete')
  .build();

// 注册工作流 / Register the workflow
agent.registerWorkflow('onboarding', onboarding);
```

### Workflow Features

- **Branching** — Conditional paths based on user input or variables
- **State management** — `ctx.variables` persists across steps
- **Composable** — Workflows can trigger other workflows

---

## Chapter 7: Built-in Tools

OPC Agent comes with built-in tools that your agent can use autonomously.

```typescript
import { getBuiltinTools } from 'opc-agent';

// 加载内置工具 / Load built-in tools
const tools = getBuiltinTools('./workspace');
```

### Available Tools

| Tool | Description |
|------|-------------|
| `readFile` | Read file contents |
| `writeFile` | Write/create files |
| `fetchUrl` | HTTP requests to external APIs |
| `runCommand` | Execute shell commands (sandboxed) |
| `getTime` | Current date/time |
| `listFiles` | Directory listing |

### Example: Agent Uses Tools

```typescript
// Agent can autonomously decide to use tools
// 例如查询订单状态时，agent 可以调用 API
const agent = new Agent('./agent.yaml', { tools });
```

The agent decides which tools to invoke based on the user's request and the tool descriptions.

---

## Chapter 8: Sub-Agents

For complex tasks, spawn specialized sub-agents that work independently and report back.

```typescript
import { SubAgentManager } from 'opc-agent';

const manager = new SubAgentManager();

// 委派研究任务给子 Agent / Delegate research to a sub-agent
const result = await agent.spawnSubAgent({
  name: 'researcher',
  task: 'Find the return policy for order #12345',
  systemPrompt: 'You are a research specialist. Find accurate information.',
  model: 'qwen2.5',
});

console.log(result.output); // Sub-agent's findings
```

### Sub-Agent Use Cases

- **Research** — Look up order details, policies, product info
- **Translation** — Translate customer messages
- **Analysis** — Analyze sentiment or categorize issues
- **Escalation** — Prepare summaries for human agents

---

## Chapter 9: Plugin System

Extend your agent with plugins for cross-cutting concerns.

```typescript
import { loggerPlugin, rateLimiterPlugin } from 'opc-agent';

const agent = new Agent('./agent.yaml', {
  plugins: [
    // 日志插件 / Logger — logs all messages
    loggerPlugin({ level: 'info', output: './logs/agent.log' }),

    // 限流插件 / Rate limiter — prevent abuse
    rateLimiterPlugin({ maxRequests: 60, windowMs: 60000 }),
  ],
});
```

### Plugin Lifecycle Hooks

Plugins can hook into:
- `onMessage` — Before processing a message
- `onReply` — Before sending a reply
- `onError` — When an error occurs
- `onStart` / `onStop` — Agent lifecycle

### Writing a Custom Plugin

```typescript
import { Plugin } from 'opc-agent';

// 自定义插件示例 / Custom plugin example
export const metricsPlugin: Plugin = {
  name: 'metrics',
  onMessage: async (msg) => {
    console.log(`[${new Date().toISOString()}] Received: ${msg.content.slice(0, 50)}`);
  },
  onReply: async (msg, reply) => {
    console.log(`[${new Date().toISOString()}] Replied in ${reply.latencyMs}ms`);
  },
};
```

---

## Chapter 10: Scheduled Jobs

Run tasks on a schedule using cron syntax.

```yaml
# agent.yaml
spec:
  scheduler:
    jobs:
      - name: daily-report
        schedule: "0 9 * * *"          # 每天早上9点 / Daily at 9 AM
        task: "Generate daily customer service report"

      - name: cleanup-old-tickets
        schedule: "0 2 * * 0"          # 每周日凌晨2点 / Sunday 2 AM
        task: "Archive tickets older than 30 days"

      - name: health-check
        schedule: "*/15 * * * *"       # 每15分钟 / Every 15 minutes
        task: "Check all channel connections are alive"
```

### Managing Jobs

```bash
# 查看所有任务 / List all scheduled jobs
opc jobs list

# 手动触发 / Manually trigger a job
opc jobs run daily-report

# 查看历史 / View job history
opc jobs history
```

---

## Chapter 11: Security

OPC Agent provides multiple security layers.

```yaml
spec:
  security:
    # 危险操作需要审批 / Dangerous actions require approval
    approval: dangerous

    # 沙箱限制 / Sandbox constraints
    sandbox:
      maxFileSize: 10485760          # 10MB max file size
      allowedCommands:               # Whitelist commands
        - "curl"
        - "node"
      blockedPaths:                  # Protect sensitive paths
        - "/etc"
        - "~/.ssh"
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Approval mode** | `dangerous` ops need human approval |
| **Sandbox** | File size limits, command whitelist |
| **Path blocking** | Prevent access to sensitive directories |
| **Rate limiting** | Via plugin (Chapter 9) |
| **Token rotation** | Channel tokens via env vars, not hardcoded |

### Best Practices

- Never hardcode API keys — use `${ENV_VAR}` syntax in `agent.yaml`
- Enable `approval: dangerous` in production
- Set `maxFileSize` to prevent resource exhaustion
- Use `allowedCommands` to restrict what the agent can execute

---

## Chapter 12: Packaging & Publishing

Share your agent with others via the OPC registry.

```bash
# 预览打包内容 / Preview what will be packaged
opc pack --list

# 试运行发布 / Dry run — see what would happen
opc publish --dry-run

# 正式发布 / Publish to the registry
opc publish
```

### What Gets Packaged

- `agent.yaml` — Configuration
- `SOUL.md` — Personality
- `src/` — Skills and logic
- `package.json` — Dependencies

### Versioning

Follow semver in `metadata.version`. Bump before each publish:

```bash
# Update version in agent.yaml
# metadata:
#   version: 1.1.0
opc publish
```

---

## Chapter 13: Monitoring & Analytics

### Running Your Agent

```bash
# 开发模式 / Development — interactive CLI chat
opc chat

# 服务模式 / Server — starts web server + all channels
opc run

# 生产模式 / Production — runs as daemon
opc start

# 检查状态 / Check status
opc status

# 查看日志 / View logs
opc logs --tail 100

# 停止 / Stop
opc stop
```

### Monitoring

- **`opc status`** — Shows agent health, active channels, memory usage
- **`opc jobs list`** — Cron job status and next run times
- **Logs** — Structured JSON logs for integration with ELK, Grafana, etc.
- **Metrics plugin** — Custom metrics (see Chapter 9)

### Production Checklist

- [ ] Set `approval: dangerous` in security config
- [ ] Configure all channel tokens via environment variables
- [ ] Enable logging plugin with file output
- [ ] Set up cron jobs for maintenance tasks
- [ ] Test all skills with edge cases
- [ ] Run `opc doctor` to verify environment
- [ ] Use `opc start` (daemon mode) instead of `opc run`

---

## Next Steps

- 📖 Read the [OPC Agent Documentation](https://github.com/Deepleaper/opc-agent)
- 🧩 Explore community skills on the OPC registry
- 🤝 Join the community on Discord/Telegram

---

*Built with ❤️ using [OPC Agent](https://github.com/Deepleaper/opc-agent)*
