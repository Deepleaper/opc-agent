# CLI Commands

## Overview

```bash
opc <command> [options]
```

Global flags:
- `--help`, `-h` — Show help
- `--version`, `-v` — Show version
- `--verbose` — Verbose output
- `--quiet`, `-q` — Suppress output

---

## Agent Lifecycle

### `opc init`

Create a new agent project.

```bash
opc init <name> [options]
```

| Flag | Description |
|------|-------------|
| `--role <role>` | Use a built-in template |
| `--list-roles` | List all available templates |
| `--from <source>` | Use template from hub, URL, or local path |
| `--no-install` | Skip `npm install` |

```bash
opc init my-agent                          # Interactive
opc init my-agent --role customer-service  # From template
opc init my-agent --from hub:acme/sales    # From hub
opc init --list-roles                      # List templates
```

### `opc run`

Start the agent runtime. Launches all configured channels and opens Studio.

```bash
opc run [options]
```

| Flag | Description |
|------|-------------|
| `--port <n>` | Override Studio port (default: 4000) |
| `--no-studio` | Don't open Studio |
| `--channel <type>` | Only start specific channel |

### `opc dev`

Start in development mode with hot-reload.

```bash
opc dev [options]
```

Same flags as `opc run`, plus:
| Flag | Description |
|------|-------------|
| `--watch` | Watch for file changes (default: true) |

### `opc serve`

Start the agent as an API server only (no Studio, no channels).

```bash
opc serve [options]
```

| Flag | Description |
|------|-------------|
| `--port <n>` | API server port (default: 3000) |

### `opc build`

Build the agent for production.

```bash
opc build
```

### `opc test`

Run test cases.

```bash
opc test [options]
```

| Flag | Description |
|------|-------------|
| `--name <name>` | Run specific test |
| `--verbose` | Show detailed output |
| `--format <fmt>` | Output format: `text` \| `json` |
| `--model <model>` | Override model for tests |

---

## Chat & Studio

### `opc chat`

Interactive CLI chat with your agent.

```bash
opc chat [options]
```

| Flag | Description |
|------|-------------|
| `--model <model>` | Override model |
| `--system <prompt>` | Override system prompt |
| `--no-history` | Don't persist conversation |

### `opc studio`

Open OPC Studio web UI.

```bash
opc studio [options]
```

| Flag | Description |
|------|-------------|
| `--port <n>` | Port (default: 4000) |

---

## Tools & Skills

### `opc tool list`

List all available tools (built-in + MCP + skills).

```bash
opc tool list
```

### `opc tool add`

Add a tool or MCP server.

```bash
opc tool add <name> [options]
```

```bash
opc tool add web-search --builtin
opc tool add postgres --mcp "@modelcontextprotocol/server-postgres"
```

---

## Workflows

### `opc workflow run`

Execute a workflow.

```bash
opc workflow run <name> [options]
```

| Flag | Description |
|------|-------------|
| `--input <json>` | Input data as JSON string |
| `--dry-run` | Show steps without executing |

### `opc workflow list`

List all defined workflows.

```bash
opc workflow list
```

---

## Knowledge Base

### `opc kb add`

Add content to the knowledge base.

```bash
opc kb add <file-or-url> [options]
```

| Flag | Description |
|------|-------------|
| `--tag <tag>` | Tag the content |
| `--recursive` | Add directory recursively |

```bash
opc kb add ./docs/
opc kb add https://example.com/faq
opc kb add ./data.pdf --tag product-docs
```

### `opc kb search`

Search the knowledge base.

```bash
opc kb search "query string"
```

### `opc kb stats`

Show knowledge base statistics.

```bash
opc kb stats
```

### `opc kb clear`

Clear the knowledge base.

```bash
opc kb clear [--confirm]
```

---

## Brain (Self-Evolution)

### `opc brain learn`

Teach the agent something.

```bash
opc brain learn "The refund policy allows returns within 30 days"
opc brain learn --file ./policies.md
```

### `opc brain recall`

Query the agent's learned knowledge.

```bash
opc brain recall "refund policy"
```

### `opc brain evolve`

Trigger knowledge consolidation.

```bash
opc brain evolve [options]
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would change |

---

## Deployment & Distribution

### `opc deploy`

Deploy the agent.

```bash
opc deploy [options]
```

| Flag | Description |
|------|-------------|
| `--target <target>` | Deploy target: `openclaw` \| `hermes` \| `docker` |
| `--env <env>` | Environment: `staging` \| `production` |

### `opc publish`

Publish to OPC Hub.

```bash
opc publish [options]
```

| Flag | Description |
|------|-------------|
| `--private` | Publish as private |
| `--org <org>` | Publish under organization |

### `opc pack`

Package agent as a tarball.

```bash
opc pack [options]
```

| Flag | Description |
|------|-------------|
| `--output <file>` | Output file path |

### `opc install`

Install an agent from OPC Hub.

```bash
opc install <name>
```

### `opc search`

Search OPC Hub.

```bash
opc search <query> [options]
```

| Flag | Description |
|------|-------------|
| `--type <type>` | Filter: `agents` \| `templates` \| `skills` |

---

## Utilities

### `opc info`

Show agent info (parsed from oad.yaml).

```bash
opc info
```

### `opc stats`

Show runtime statistics.

```bash
opc stats
```

### `opc doctor`

Check environment and diagnose issues.

```bash
opc doctor
```

### `opc version-mgmt list`

List agent versions.

```bash
opc version-mgmt list
```

### `opc version-mgmt rollback`

Rollback to a previous version.

```bash
opc version-mgmt rollback <version>
```

### `opc create`

Scaffolding sub-command for creating skills, workflows, etc.

```bash
opc create skill <name>
opc create workflow <name>
opc create channel <type>
```
