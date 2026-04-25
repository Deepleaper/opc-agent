# OAD Schema Specification

**OAD** (Open Agent Definition) is a declarative YAML/JSON format for defining AI agents. Version: 1.0.

## Top-Level Structure

```yaml
oad: "1.0"           # Schema version (required)
metadata: {}         # Agent metadata (required)
spec: {}             # Agent specification (required)
tests: []            # Test cases (optional)
```

## metadata

```yaml
metadata:
  name: string           # Agent name (required, kebab-case)
  version: string        # Semantic version (required)
  description: string    # Short description
  author: string         # Author name or email
  license: string        # SPDX license identifier
  tags: string[]         # Searchable tags
  homepage: string       # Project URL
  repository: string     # Git repository URL
```

## spec

### Core

```yaml
spec:
  model: string          # Model identifier (required)
  provider: string       # Provider name (required)
  temperature: number    # 0.0 - 2.0 (default: 0.7)
  maxTokens: number      # Max response tokens (default: 4096)
  topP: number           # Top-p sampling (default: 1.0)
  systemPrompt: string   # System prompt (supports multiline with |)
  language: string       # Default language (default: "en")
```

### spec.channels

```yaml
spec:
  channels:
    - type: string       # Channel type (required)
      # Type-specific options below
```

**Channel types and options:**

| Type | Required Fields | Optional Fields |
|------|----------------|-----------------|
| `web` | — | `port`, `cors`, `auth` |
| `telegram` | `token` | `webhook`, `allowedUsers` |
| `slack` | `token`, `signingSecret` | `channels` |
| `discord` | `token` | `guildId`, `channels` |
| `wechat` | `appId`, `appSecret` | `token`, `encodingAESKey` |
| `whatsapp` | `token`, `phoneNumberId` | `webhookVerifyToken` |
| `email` | `imap`, `smtp` | `pollInterval`, `filter` |
| `line` | `channelAccessToken`, `channelSecret` | — |
| `teams` | `appId`, `appPassword` | — |
| `websocket` | — | `port`, `path` |
| `webhook` | `path` | `secret`, `method` |
| `voice` | `provider` | `twilioAccountSid`, `twilioAuthToken` |

### spec.skills

```yaml
spec:
  skills:
    - name: string       # Skill name (required)
      path: string       # Path to skill file
      builtin: boolean   # Use built-in skill
      package: string    # npm package name
      config: object     # Skill-specific configuration
```

### spec.mcp

```yaml
spec:
  mcp:
    servers:
      - name: string     # Server name (required)
        command: string   # Command to run (required)
        args: string[]    # Command arguments
        env: object       # Environment variables
```

### spec.a2a

```yaml
spec:
  a2a:
    expose: boolean       # Expose this agent via A2A (default: false)
    port: number          # A2A server port
    agents:
      - url: string       # Remote agent URL (required)
        name: string      # Agent name (required)
        skills: string[]  # Skills to delegate
```

### spec.workflows

```yaml
spec:
  workflows:
    - name: string       # Workflow name (required)
      description: string
      trigger: string    # Natural language trigger condition
      steps:
        - skill: string  # Skill to execute (required)
          input: object   # Input mapping
          condition: string  # Handlebars condition
          onError: string    # "skip" | "abort" | "retry"
          retries: number    # Max retries (default: 0)
```

### spec.scheduler

```yaml
spec:
  scheduler:
    - name: string       # Job name (required)
      cron: string       # Cron expression (required)
      action: string     # "workflow" | "skill" (required)
      workflow: string   # Workflow name (if action=workflow)
      skill: string      # Skill name (if action=skill)
      input: object      # Input data
      timezone: string   # IANA timezone (default: UTC)
```

### spec.brain

```yaml
spec:
  brain:
    autoLearn: boolean       # Auto-learn from conversations (default: true)
    evolveSchedule: string   # Cron for knowledge evolution
    seeds: string            # Path to brain-seeds directory
    maxMemory: number        # Max memory entries
    embedding:
      provider: string      # Embedding provider
      model: string          # Embedding model
```

## tests

```yaml
tests:
  - name: string           # Test name (required)
    input: string           # User message
    conversation:           # Multi-turn test (alternative to input)
      - user: string
        expect: object
    expect:
      contains: string[]
      notContains: string[]
      matches: string       # Regex
      skillCalled: string
      workflowTriggered: string
      maxTokens: number
      maxLatency: number    # Milliseconds
```

## Environment Variable Interpolation

Any value in `oad.yaml` can reference environment variables:

```yaml
spec:
  channels:
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}     # Required — fails if not set
      webhook: ${WEBHOOK_URL:-}        # Optional — empty string if not set
```

## Validation

Validate your OAD file:

```bash
opc info  # Parses and validates oad.yaml
```

## Full Example

See [Configuration Guide](/guide/configuration) for a complete annotated example.
