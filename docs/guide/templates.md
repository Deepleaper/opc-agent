# Templates

Templates are pre-built agent configurations for common use cases.

## Customer Service

A complete customer service agent with:
- FAQ lookup skill
- Human handoff when confidence is low
- Web channel for HTTP integration

```bash
opc init my-service --template customer-service
```

## Creating Custom Templates

Templates are OAD YAML files with optional skill implementations. To create your own:

1. Define `oad.yaml` with your agent specification
2. Implement custom skills extending `BaseSkill`
3. Package as a directory with `oad.yaml` + `README.md`

More templates coming soon:
- Sales Assistant
- Internal IT Help Desk
- Data Analysis Agent
- Content Moderation Agent
