# 配置详解

## OAD 文件结构

`oad.yaml` 是智能体的核心配置文件，所有配置都在这里：

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
  description: 我的智能体
spec:
  provider:
    default: deepseek
    allowed: [openai, deepseek, qwen]
  model: deepseek-chat
  systemPrompt: "你是一个专业的助手。"
  skills: []
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm: false
  testing:
    cases:
      - name: 问候测试
        input: "你好"
        expect:
          contains: ["你好", "帮"]
          maxLatencyMs: 5000
  rateLimits:
    perUser:
      maxRequests: 60
      windowMs: 60000
    perProvider:
      maxRequests: 100
      windowMs: 60000
  cache:
    enabled: true
    ttlMs: 3600000
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPC_LLM_API_KEY` | 大语言模型 API Key | — |
| `OPC_LLM_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `OPC_LLM_MODEL` | 模型名称 | `gpt-4o-mini` |

## 模型供应商配置

```yaml
spec:
  provider:
    default: deepseek               # 默认供应商
    allowed: [deepseek, qwen, openai]  # 允许的供应商列表
  model: deepseek-chat              # 具体模型
```

运行时通过环境变量 `OPC_LLM_API_KEY` 和 `OPC_LLM_BASE_URL` 传入凭证。

## 限流配置

保护你的 API 配额和后端服务：

```yaml
spec:
  rateLimits:
    perUser:
      maxRequests: 60       # 每个用户每分钟最多 60 次请求
      windowMs: 60000
    perProvider:
      maxRequests: 100      # 每个供应商每分钟最多 100 次请求
      windowMs: 60000
```

## 缓存配置

开启 LLM 响应缓存，降低 API 调用成本：

```yaml
spec:
  cache:
    enabled: true
    ttlMs: 3600000    # 缓存有效期 1 小时
    maxEntries: 1000  # 最大缓存条数
```

## 渠道配置

```yaml
spec:
  channels:
    - type: web
      port: 3000
      config:
        cors: true
        sse: true           # 启用 SSE 流式响应

    - type: telegram
      config:
        token: ${TELEGRAM_BOT_TOKEN}

    - type: wechat
      config:
        appId: ${WECHAT_APP_ID}
        appSecret: ${WECHAT_APP_SECRET}
```

## 记忆配置

```yaml
spec:
  memory:
    shortTerm: true          # 对话上下文记忆
    longTerm: true           # 跨会话长期记忆
    provider: deepbrain      # 长期记忆后端
    config:
      collection: my-kb      # 知识库集合名称
```

## DTV 信任配置

```yaml
spec:
  dtv:
    trust:
      level: sandbox         # sandbox | verified | certified | listed
    value:
      metrics: [response_time, satisfaction_score]
```
