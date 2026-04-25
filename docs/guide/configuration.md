# Configuration

## oad.yaml Reference

The `oad.yaml` file is the single source of truth for your agent. Here's the complete reference.

### Minimal Example

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0

spec:
  model: gpt-4o
  provider: openai
```

### Full Example

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0
  description: Customer service agent for Acme Corp
  author: team@acme.com
  tags: [customer-service, support]

spec:
  # Model configuration
  model: gpt-4o
  provider: openai
  temperature: 0.7
  maxTokens: 4096
  systemPrompt: |
    You are a helpful customer service agent for Acme Corp.
    Always be polite and professional.

  # Channels
  channels:
    - type: web
      port: 4000
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}
    - type: slack
      token: ${SLACK_BOT_TOKEN}
      signingSecret: ${SLACK_SIGNING_SECRET}
    - type: email
      imap:
        host: imap.gmail.com
        user: ${EMAIL_USER}
        password: ${EMAIL_PASSWORD}
      smtp:
        host: smtp.gmail.com
        user: ${EMAIL_USER}
        password: ${EMAIL_PASSWORD}

  # Skills
  skills:
    - name: order-lookup
      path: ./src/skills/order-lookup.ts
    - name: refund
      path: ./src/skills/refund.ts
    - name: web-search
      builtin: true

  # MCP servers
  mcp:
    servers:
      - name: database
        command: npx
        args: ["-y", "@modelcontextprotocol/server-postgres"]
        env:
          DATABASE_URL: ${DATABASE_URL}

  # Workflows
  workflows:
    - name: escalation
      trigger: "customer is angry or issue unresolved after 3 messages"
      steps:
        - skill: sentiment-check
        - skill: escalate-to-human
          condition: "{{sentiment}} < 0.3"

  # Scheduler (cron jobs)
  scheduler:
    - name: daily-report
      cron: "0 9 * * *"
      action: workflow
      workflow: generate-report
    - name: kb-sync
      cron: "0 */6 * * *"
      action: skill
      skill: sync-knowledge-base

  # Brain / Self-evolution
  brain:
    autoLearn: true
    evolveSchedule: "0 3 * * 0"  # Weekly at 3am Sunday
    seeds: ./brain-seeds/

  # A2A
  a2a:
    agents:
      - url: http://localhost:4001
        name: research-agent
```

## spec.model

The LLM model to use. Can be any model supported by your provider.

```yaml
spec:
  model: gpt-4o           # OpenAI
  model: claude-sonnet-4-20250514   # Anthropic
  model: gemini-2.0-flash  # Google
  model: llama3.1          # Ollama (local)
  model: deepseek-chat     # DeepSeek
```

## spec.provider

The model provider. Supported values:

| Provider | Value | Env Variable |
|----------|-------|-------------|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| Google | `google` | `GOOGLE_API_KEY` |
| Azure OpenAI | `azure` | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| Ollama | `ollama` | — (local, no key needed) |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| Groq | `groq` | `GROQ_API_KEY` |
| Together | `together` | `TOGETHER_API_KEY` |
| Custom | `custom` | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` |

## spec.channels

Array of channel configurations. Each channel has a `type` and type-specific options.

```yaml
spec:
  channels:
    - type: web
      port: 4000
      cors: true
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}
    - type: slack
      token: ${SLACK_BOT_TOKEN}
      signingSecret: ${SLACK_SIGNING_SECRET}
    - type: discord
      token: ${DISCORD_BOT_TOKEN}
    - type: wechat
      appId: ${WECHAT_APP_ID}
      appSecret: ${WECHAT_APP_SECRET}
    - type: websocket
      port: 4001
```

## spec.skills

Array of skill definitions. Skills can be local files, built-in, or from packages.

```yaml
spec:
  skills:
    # Local skill file
    - name: my-skill
      path: ./src/skills/my-skill.ts

    # Built-in skill
    - name: web-search
      builtin: true

    # From npm package
    - name: pdf-reader
      package: opc-skill-pdf-reader
```

## spec.scheduler

Cron-based scheduled tasks.

```yaml
spec:
  scheduler:
    - name: daily-digest
      cron: "0 9 * * 1-5"    # Weekdays at 9am
      action: workflow
      workflow: daily-digest
    - name: health-check
      cron: "*/30 * * * *"    # Every 30 minutes
      action: skill
      skill: health-check
```

## spec.workflows

Multi-step workflow definitions. See [Concepts → Workflows](/guide/concepts#workflows).

## Environment Variables (.env)

Place a `.env` file in your project root. All values are available as `${VAR_NAME}` in `oad.yaml`.

```bash
# .env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...
DATABASE_URL=postgres://localhost:5432/mydb

# Optional
OPC_PORT=4000              # Override default Studio port
OPC_LOG_LEVEL=debug        # debug | info | warn | error
OPC_DATA_DIR=./data        # Runtime data directory
OPC_BRAIN_AUTO_LEARN=true  # Enable auto-learning
```

## Global Config (~/.opc/config.json)

Machine-wide settings that apply to all projects:

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

Edit with:

```bash
opc config set defaultProvider anthropic
opc config set defaultModel claude-sonnet-4-20250514
opc config get defaultProvider
```

## Next Steps

- [Templates](/guide/templates) — Pre-built configurations
- [Deployment](/guide/deployment) — Deploy to production
- [OAD Schema Reference](/api/oad-schema) — Complete schema specification
