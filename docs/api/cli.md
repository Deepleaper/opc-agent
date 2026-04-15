# CLI Commands

## Reference

| Command | Description |
|---------|-------------|
| `opc init [name]` | Initialize a new agent project |
| `opc run` | Start agent with web server |
| `opc chat` | Interactive CLI chat |
| `opc test` | Run agent tests |
| `opc analytics` | Show usage analytics |
| `opc info` | Show agent info from OAD |
| `opc build` | Validate OAD |
| `opc dev` | Hot-reload development mode |
| `opc create <name>` | Create agent from template |
| `opc deploy` | Deploy to OpenClaw or Hermes |
| `opc publish` | Package for distribution |
| `opc install <source>` | Install agent from package |
| `opc search <query>` | Search OPC Registry |
| `opc stats` | Show runtime stats |
| `opc kb add <file>` | Add file to knowledge base |
| `opc kb search <query>` | Search knowledge base |
| `opc tool list` | List MCP tools |
| `opc workflow run <name>` | Run a workflow |
| `opc version-mgmt list` | List saved versions |

## Common Options

- `-f, --file <file>` — OAD file path (default: `oad.yaml`)
- `-t, --template <name>` — Template name
- `-p, --port <port>` — Port override
- `--json` — JSON output (for test/analytics)

## Examples

```bash
# Create a new project
opc init my-bot -t teacher

# Run tests
opc test --json

# View analytics
opc analytics

# Deploy
opc deploy --target openclaw --install
```
