# Templates

## Built-in Templates

OPC Agent ships with 12 production-ready templates. Use them with `opc init`:

```bash
opc init my-agent --role <template-name>
```

List all available templates:

```bash
opc init --list-roles
```

### Template Reference

| Template | Role | Key Skills |
|----------|------|-----------|
| `customer-service` | Customer support agent | Order lookup, FAQ, escalation, sentiment analysis |
| `sales-assistant` | Sales & lead qualification | CRM integration, product recommendations, follow-up |
| `knowledge-base` | Internal knowledge assistant | Document search, Q&A, source citation |
| `code-reviewer` | Code review & analysis | Git integration, code analysis, PR comments |
| `hr-recruiter` | HR & recruitment assistant | Resume screening, interview scheduling, candidate Q&A |
| `project-manager` | Project management | Task tracking, status reports, sprint planning |
| `content-writer` | Content creation | Blog posts, social media, SEO optimization |
| `legal-assistant` | Legal research & analysis | Contract review, compliance checks, case research |
| `financial-advisor` | Financial analysis | Portfolio analysis, market data, risk assessment |
| `executive-assistant` | Executive support | Calendar management, email drafting, meeting notes |
| `data-analyst` | Data analysis & visualization | SQL queries, chart generation, trend analysis |
| `teacher` | Education & tutoring | Lesson planning, quiz generation, adaptive learning |

### Example: Customer Service

```bash
opc init support-bot --role customer-service
cd support-bot && npm install
opc run
```

This creates an agent pre-configured with:
- FAQ handling and knowledge base
- Order status lookup skill
- Escalation workflow
- Sentiment detection
- Multi-channel support (web + email)

### Example: Code Reviewer

```bash
opc init reviewer --role code-reviewer
cd reviewer && npm install
opc run
```

Pre-configured with:
- GitHub/GitLab integration
- Code analysis skills
- PR review workflow
- Security scan integration

## Agent Workstation Roles

Beyond the built-in templates, OPC supports **workstation roles** — pre-configured agents designed for specific organizational functions:

```bash
opc init --list-roles
```

Workstation roles include additional brain seeds, workflows, and channel configurations tailored to their function.

## OPC Hub Templates

The [OPC Hub](https://hub.opc.dev) hosts community-contributed templates. Install directly:

```bash
opc init my-agent --from hub:acme/sales-template
```

Search the hub:

```bash
opc search templates --query "e-commerce"
```

## Creating Your Own Template

Any OPC agent project can be packaged as a template:

```bash
opc pack --output my-template.tgz
opc publish  # Publish to OPC Hub
```

To use a local template:

```bash
opc init my-agent --from ./my-template.tgz
```

## Next Steps

- [Configuration](/guide/configuration) — Customize your template
- [Testing](/guide/testing) — Test your agent
- [Deployment](/guide/deployment) — Deploy to production
