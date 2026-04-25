# 部署

## 快速部署

### OpenClaw 集成

部署到 [OpenClaw](https://openclaw.dev) 托管运行：

```bash
opc deploy --target openclaw
```

### Hermes

部署到 [Hermes](https://hermes.dev) 边缘节点：

```bash
opc deploy --target hermes
```

### 发布到 OPC Hub

打包智能体用于分发：

```bash
opc publish
```

## Docker

每个 `opc init` 项目都包含 Docker 支持。

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

### 构建和运行

```bash
docker compose up -d
```

## 生产环境变量

```bash
# 必需
OPENAI_API_KEY=sk-...

# 可选
NODE_ENV=production
OPC_PORT=4000
OPC_LOG_LEVEL=info
OPC_DATA_DIR=/app/data
OPC_BRAIN_AUTO_LEARN=true

# 通道 Token
TELEGRAM_BOT_TOKEN=...
SLACK_BOT_TOKEN=...
```

## 生产检查清单

- [ ] 设置 `NODE_ENV=production`
- [ ] 所有密钥使用环境变量
- [ ] 配置健康检查端点（`GET /health`）
- [ ] 设置日志聚合
- [ ] 启用自动重启
- [ ] 挂载持久化卷用于 `data/` 目录
- [ ] 设置资源限制
- [ ] 配置 HTTPS/TLS 反向代理
- [ ] 上线前测试所有通道

## 下一步

- [测试](/zh/guide/testing) — 部署前测试
- [CLI 参考](/zh/api/cli) — `opc deploy` 参数
