# Customer Service Agent Template

A ready-to-use customer service agent with:
- **FAQ Lookup** — Matches common questions to predefined answers
- **Human Handoff** — Detects when a customer wants a real person
- **Web Channel** — HTTP API for chat integration

## Quick Start

```bash
opc init my-service --template customer-service
cd my-service
opc run
```

## Customization

Edit `oad.yaml` to:
- Change the system prompt
- Add custom FAQ entries
- Switch LLM provider
- Adjust trust level
