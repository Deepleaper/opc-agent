# Configuration

## OAD File Structure

The `oad.yaml` file is the heart of your agent configuration:

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
  description: My AI agent
spec:
  provider:
    default: openai
    allowed: [openai, deepseek, qwen]
  model: gpt-4o-mini
  systemPrompt: "You are a helpful assistant."
  skills: []
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm: false
  testing:
    cases:
      - name: greeting-test
        input: "Hello"
        expect:
          contains: ["hello", "help"]
          maxLatencyMs: 5000
  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000
    perProvider:
      maxRequests: 100
      windowMs: 60000
  cache:
    enabled: true
    ttlMs: 3600000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPC_LLM_API_KEY` | LLM API key | — |
| `OPC_LLM_BASE_URL` | LLM API base URL | `https://api.openai.com/v1` |
| `OPC_LLM_MODEL` | Model name | `gpt-4o-mini` |

## Rate Limiting

Configure per-user and per-provider rate limits in `oad.yaml`:

```yaml
spec:
  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000
    perProvider:
      maxRequests: 100
      windowMs: 60000
```

## Caching

Enable LLM response caching to reduce API costs:

```yaml
spec:
  cache:
    enabled: true
    ttlMs: 3600000  # 1 hour
    maxEntries: 1000
```
