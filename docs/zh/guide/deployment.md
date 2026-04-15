# 部署指南

## 本地开发

```bash
# 热重载开发模式
opc dev

# 普通启动
opc run
```

## Docker 部署

每个 `opc init` 创建的项目都自带 `Dockerfile` 和 `docker-compose.yml`：

```bash
docker compose up -d
```

### 自定义 Docker 配置

```yaml
# docker-compose.yml
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    restart: unless-stopped
```

## 部署到 OpenClaw

```bash
# 部署
opc deploy --target openclaw

# 部署并注册到配置
opc deploy --target openclaw --install
```

## 部署到 Hermes 云

```bash
# 直接部署
opc deploy --target hermes

# 生成部署文件到指定目录
opc deploy --target hermes --output ./my-deploy
```

## 环境变量

在 `.env` 文件中配置：

```bash
# 大语言模型配置
OPC_LLM_API_KEY=sk-xxx
OPC_LLM_BASE_URL=https://api.deepseek.com/v1
OPC_LLM_MODEL=deepseek-chat

# Telegram 机器人（可选）
TELEGRAM_BOT_TOKEN=xxx

# 微信公众号（可选）
WECHAT_APP_ID=xxx
WECHAT_APP_SECRET=xxx
```

## 上线检查清单

- [ ] 在 `.env` 中配置正确的 API Key
- [ ] 在 `oad.yaml` 中配置限流策略
- [ ] 开启缓存以降低 API 成本
- [ ] 配置监控和告警
- [ ] 运行 `opc test` 确保测试通过
- [ ] 检查 DTV 信任等级设置
- [ ] 配置 CORS 和安全头
- [ ] 准备回滚方案
