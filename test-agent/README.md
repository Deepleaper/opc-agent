# test-agent

Created with [OPC Agent](https://github.com/Deepleaper/opc-agent) using the `customer-service` template.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run with Ollama (default):**
   ```bash
   # Make sure Ollama is running with qwen2.5 model
   ollama pull qwen2.5
   npx tsx src/index.ts
   ```

3. **Or use OpenAI/other providers:**
   ```bash
   # Edit .env and set your API key
   npx opc run
   ```

4. **Open browser:** [http://localhost:3000](http://localhost:3000)

## Development

```bash
npx opc dev    # Hot-reload mode
npx opc chat   # CLI chat
```

## Project Structure

```
test-agent/
├── agent.yaml          # OAD agent config (used by src/index.ts)
├── oad.yaml            # OAD config (used by opc CLI)
├── src/
│   ├── index.ts        # Entry point
│   └── skills/
│       └── echo.ts     # Example skill
├── package.json
└── tsconfig.json
```

## Configuration

Edit `agent.yaml` to customize your agent's personality, skills, and behavior.
