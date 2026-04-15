# Deployment

## Docker

Every `opc init` project includes a `Dockerfile` and `docker-compose.yml`:

```bash
docker compose up -d
```

## Deploy to OpenClaw

```bash
opc deploy --target openclaw
opc deploy --target openclaw --install  # Also register in config
```

## Deploy to Hermes

```bash
opc deploy --target hermes
opc deploy --target hermes --output ./my-hermes-deploy
```

## Environment Variables

Set your API keys in `.env`:

```bash
OPC_LLM_API_KEY=sk-xxx
OPC_LLM_BASE_URL=https://api.openai.com/v1
OPC_LLM_MODEL=gpt-4o-mini
```

## Production Checklist

- [ ] Set proper API keys in `.env`
- [ ] Configure rate limits in `oad.yaml`
- [ ] Enable caching for cost reduction
- [ ] Set up analytics monitoring
- [ ] Run `opc test` before deployment
- [ ] Review trust/DTV settings
