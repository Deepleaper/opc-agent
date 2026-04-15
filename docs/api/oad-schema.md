# OAD Schema v1 Specification

**OAD** (Open Agent Definition) is a declarative YAML/JSON format for defining AI agents.

## Full Schema

```yaml
apiVersion: opc/v1          # Required. Must be "opc/v1"
kind: Agent                  # Required. Must be "Agent"

metadata:
  name: string               # Required. Agent identifier
  version: string            # Semver. Default: "1.0.0"
  description: string        # Optional. Human-readable description
  author: string             # Optional. Author name
  license: string            # Default: "Apache-2.0"
  marketplace:               # Optional. Marketplace settings
    certified: boolean       # Default: false
    category: string         # e.g., "customer-service"

spec:
  provider:                  # LLM provider configuration
    default: string          # Default provider. Default: "deepseek"
    allowed: string[]        # Allowed providers. Default: ["openai", "deepseek", "qwen"]
  model: string              # Model name. Default: "deepseek-chat"
  systemPrompt: string       # System prompt for the agent

  skills:                    # List of skills
    - name: string           # Skill identifier
      description: string    # What the skill does
      config: object         # Optional skill-specific config

  channels:                  # Communication channels
    - type: web|websocket|cli
      port: number           # Port for web channels
      config: object         # Optional channel config

  memory:
    shortTerm: boolean       # Enable conversation memory. Default: true
    longTerm: boolean        # Enable persistent memory. Default: false
    provider: string         # Memory backend (optional)

  dtv:
    trust:
      level: sandbox|verified|certified|listed  # Default: "sandbox"
    value:
      metrics: string[]      # Metrics to track. Default: []
```

## Validation

OAD files are validated using Zod schemas. Use the CLI to validate:

```bash
opc build -f oad.yaml
```

Or programmatically:

```typescript
import { validateOAD } from 'opc-agent';

const config = validateOAD(yamlData);
```
