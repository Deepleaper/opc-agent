# Core Concepts

## Self-Evolution

OPC Agent is built around a **self-evolution** loop. Agents don't just respond — they learn, remember, and improve over time.

### The Learn → Recall → Evolve Loop

```
User Interaction
       ↓
   [ Learn ]  ←  Extract knowledge from conversations
       ↓
   [ Recall ] ←  Retrieve relevant knowledge before responding
       ↓
   [ Evolve ] ←  Consolidate, refine, and prune knowledge
       ↓
  Better Responses
```

- **Learn**: After each conversation, the agent extracts key facts, preferences, and patterns and stores them in its knowledge base.
- **Recall**: Before generating a response, the agent searches its knowledge base for relevant context.
- **Evolve**: Periodically, the agent consolidates fragmented knowledge, resolves contradictions, and prunes outdated information.

Use the CLI to interact with the brain directly:

```bash
opc brain learn "The customer prefers email communication"
opc brain recall "customer communication preferences"
opc brain evolve   # Consolidate all knowledge
```

## OAD (Open Agent Definition)

OAD is a declarative YAML schema that defines everything about an agent in a single file. Think of it as a `Dockerfile` for AI agents.

```yaml
oad: "1.0"
metadata:
  name: my-agent
  version: 1.0.0
  description: Customer service agent

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

→ [Full OAD Schema Reference](/api/oad-schema)

## Brain Seeds

Brain seeds are knowledge files placed in the `brain-seeds/` directory. They're loaded at startup and form the agent's foundational knowledge.

Three categories:
- **Industry knowledge** — domain-specific facts (e.g., e-commerce policies, healthcare regulations)
- **Job knowledge** — role-specific procedures (e.g., how to handle refunds, escalation paths)
- **Workstation knowledge** — organization-specific context (e.g., company products, team structure)

```
brain-seeds/
├── industry/
│   └── ecommerce-basics.md
├── job/
│   └── customer-service-procedures.md
└── workstation/
    └── company-products.md
```

These files are Markdown. The agent indexes them on startup and uses them as context.

## Channels

OPC Agent supports **25+ communication channels** out of the box:

| Category | Channels |
|----------|----------|
| Chat | Web, Telegram, Slack, Discord, WhatsApp, LINE, Teams, WeChat |
| Email | SMTP/IMAP, Gmail, Outlook |
| Voice | Twilio, WebRTC |
| API | REST, WebSocket, gRPC |
| Social | Twitter/X, Facebook Messenger, Instagram |
| Custom | Webhook, MQTT, AMQP |

Configure channels in `oad.yaml`:

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

## Protocols

OPC Agent implements three interoperability protocols:

### MCP (Model Context Protocol)
Connect to external tools and data sources. Any MCP-compatible server can be used as a tool.

```yaml
spec:
  mcp:
    servers:
      - name: filesystem
        command: npx
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
```

### A2A (Agent-to-Agent)
Communicate with other agents using Google's A2A protocol. Enables multi-agent orchestration.

```yaml
spec:
  a2a:
    agents:
      - url: http://localhost:4001
        name: research-agent
```

### AG-UI (Agent-User Interface)
Standardized protocol for agent-to-UI communication, enabling real-time streaming and interactive components.

## Skills

Skills are modular capabilities you add to your agent. They can be:

- **Built-in**: Included with OPC Agent (web-search, code-interpreter, file-manager)
- **Custom**: TypeScript/JavaScript files in `src/skills/`
- **MCP tools**: Any MCP server
- **Community**: Install from OPC Hub

```typescript
// src/skills/weather.ts
import { defineSkill } from 'opc-agent';

export default defineSkill({
  name: 'weather',
  description: 'Get current weather for a location',
  parameters: {
    location: { type: 'string', required: true },
  },
  async execute({ location }) {
    const res = await fetch(`https://wttr.in/${location}?format=j1`);
    return await res.json();
  },
});
```

## Workflows

Workflows chain skills together into multi-step processes. Define them in `oad.yaml` or run them from the CLI.

```yaml
spec:
  workflows:
    - name: onboarding
      trigger: "new customer signs up"
      steps:
        - skill: create-account
        - skill: send-welcome-email
        - skill: schedule-demo
          condition: "{{plan}} == 'enterprise'"
```

```bash
opc workflow run onboarding --input '{"name": "Alice", "plan": "enterprise"}'
```

## Agent Collaboration

Multiple agents can work together using five collaboration patterns:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Debate** | Agents argue positions, best argument wins | Decision-making, risk assessment |
| **Voting** | Agents vote on options, majority wins | Content moderation, classification |
| **Pipeline** | Output of one agent feeds into the next | Data processing, content creation |
| **Hierarchy** | Manager agent delegates to worker agents | Complex projects, task decomposition |
| **Shared Memory** | Agents read/write to a shared knowledge base | Research teams, collaborative analysis |

## Next Steps

- [Configuration](/guide/configuration) — Full `oad.yaml` reference
- [Templates](/guide/templates) — Pre-built agent templates
- [CLI Reference](/api/cli) — All commands and flags
