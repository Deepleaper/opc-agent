# Deployment

## Quick Deploy

### OpenClaw Integration

Deploy directly to [OpenClaw](https://openclaw.dev) for managed hosting:

```bash
opc deploy --target openclaw
```

This packages your agent, uploads it, and provisions a runtime with your configured channels.

### Hermes

Deploy to [Hermes](https://hermes.dev) for edge deployment:

```bash
opc deploy --target hermes
```

### Publish to OPC Hub

Package your agent for distribution:

```bash
opc publish
```

This publishes to the OPC Hub, making it installable by others via `opc init --from hub:your-org/agent-name`.

## Docker

Every `opc init` project includes Docker support.

### Dockerfile

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["npx", "opc", "run"]
```

### docker-compose.yml

```yaml
version: "3.8"
services:
  agent:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - .env
    volumes:
      - agent-data:/app/data
    restart: unless-stopped

volumes:
  agent-data:
```

### Build and Run

```bash
docker compose up -d
```

## Environment Variables for Production

Set these in your deployment environment:

```bash
# Required
OPENAI_API_KEY=sk-...          # Or your provider's key

# Optional
NODE_ENV=production
OPC_PORT=4000
OPC_LOG_LEVEL=info
OPC_DATA_DIR=/app/data
OPC_BRAIN_AUTO_LEARN=true

# Channel tokens
TELEGRAM_BOT_TOKEN=...
SLACK_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...

# Database (if using persistent storage)
DATABASE_URL=postgres://...
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use environment variables for all secrets (no `.env` file in containers)
- [ ] Configure health check endpoint (`GET /health`)
- [ ] Set up log aggregation (`OPC_LOG_LEVEL=info`)
- [ ] Enable auto-restart (Docker `restart: unless-stopped` or process manager)
- [ ] Mount persistent volume for `data/` directory
- [ ] Set resource limits (memory, CPU)
- [ ] Configure HTTPS/TLS reverse proxy for web channel
- [ ] Test all channels before going live

## Scaling

OPC Agent is stateless by default (state lives in `data/`). For horizontal scaling:

1. Use a shared database for state (`DATABASE_URL`)
2. Use Redis for session management
3. Load balance across instances

```yaml
# docker-compose.yml with scaling
services:
  agent:
    build: .
    deploy:
      replicas: 3
    env_file:
      - .env
    volumes:
      - agent-data:/app/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Next Steps

- [Testing](/guide/testing) — Test before deploying
- [CLI Reference](/api/cli) — `opc deploy` flags and options
