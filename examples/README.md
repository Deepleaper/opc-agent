# OPC Agent Examples

## Run Examples

```bash
# Basic agent with skills
npx tsx examples/basic-agent.ts

# Multi-channel setup (Web + Telegram)
npx tsx examples/multi-channel.ts

# DeepBrain memory integration
npx tsx examples/brain-integration.ts
```

## What Each Example Shows

| Example | Concepts |
|---------|----------|
| `basic-agent.ts` | `BaseAgent`, `AgentRuntime`, `BaseSkill`, message handling |
| `multi-channel.ts` | `WebChannel`, `TelegramChannel`, multi-channel config |
| `brain-integration.ts` | `DeepBrainMemoryStore`, `InMemoryStore`, memory backends |
