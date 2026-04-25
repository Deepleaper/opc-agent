# 配置

## oad.yaml 参考

`oad.yaml` 是智能体的唯一配置来源。以下是完整参考。

### 最小示例

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0

spec:
  model: gpt-4o
  provider: openai
```

### 完整示例

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0
  description: Acme 公司客服智能体
  author: team@acme.com
  tags: [customer-service, support]

spec:
  model: gpt-4o
  provider: openai
  temperature: 0.7
  maxTokens: 4096
  systemPrompt: |
    你是 Acme 公司的客服智能体。
    始终保持礼貌和专业。

  channels:
    - type: web
      port: 4000
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}
    - type: slack
      token: ${SLACK_BOT_TOKEN}
      signingSecret: ${SLACK_SIGNING_SECRET}

  skills:
    - name: order-lookup
      path: ./src/skills/order-lookup.ts
    - name: web-search
      builtin: true

  mcp:
    servers:
      - name: database
        command: npx
        args: ["-y", "@modelcontextprotocol/server-postgres"]
        env:
          DATABASE_URL: ${DATABASE_URL}

  workflows:
    - name: escalation
      trigger: "客户情绪激动或3条消息后问题未解决"
      steps:
        - skill: sentiment-check
        - skill: escalate-to-human
          condition: "{{sentiment}} < 0.3"

  scheduler:
    - name: daily-report
      cron: "0 9 * * *"
      action: workflow
      workflow: generate-report

  brain:
    autoLearn: true
    evolveSchedule: "0 3 * * 0"
    seeds: ./brain-seeds/

  a2a:
    agents:
      - url: http://localhost:4001
        name: research-agent
```

## spec.model

使用的 LLM 模型：

```yaml
spec:
  model: gpt-4o           # OpenAI
  model: claude-sonnet-4-20250514   # Anthropic
  model: gemini-2.0-flash  # Google
  model: llama3.1          # Ollama（本地）
  model: deepseek-chat     # DeepSeek
```

## spec.provider

模型提供商：

| 提供商 | 值 | 环境变量 |
|--------|-----|---------|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| Google | `google` | `GOOGLE_API_KEY` |
| Azure OpenAI | `azure` | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| Ollama | `ollama` | —（本地，无需密钥） |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| Groq | `groq` | `GROQ_API_KEY` |
| Together | `together` | `TOGETHER_API_KEY` |
| 自定义 | `custom` | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` |

## spec.channels

通道配置数组。每个通道有 `type` 和类型特定选项。

## spec.skills

技能定义数组。技能可以是本地文件、内置或来自包。

## spec.scheduler

基于 cron 的定时任务：

```yaml
spec:
  scheduler:
    - name: daily-digest
      cron: "0 9 * * 1-5"    # 工作日 9 点
      action: workflow
      workflow: daily-digest
```

## 环境变量（.env）

在项目根目录放置 `.env` 文件。所有值可通过 `${VAR_NAME}` 在 `oad.yaml` 中引用。

```bash
# .env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...

# 可选
OPC_PORT=4000              # 覆盖默认 Studio 端口
OPC_LOG_LEVEL=debug        # debug | info | warn | error
OPC_DATA_DIR=./data        # 运行时数据目录
OPC_BRAIN_AUTO_LEARN=true  # 启用自动学习
```

## 全局配置（~/.opc/config.json）

机器级别设置，适用于所有项目：

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "telemetry": false,
  "editor": "code",
  "studioPort": 4000,
  "updateCheck": true
}
```

编辑：

```bash
opc config set defaultProvider anthropic
opc config get defaultProvider
```

## 下一步

- [模板](/zh/guide/templates) — 预置配置
- [部署](/zh/guide/deployment) — 部署到生产环境
- [OAD Schema 参考](/zh/api/oad-schema) — 完整 schema 规范
