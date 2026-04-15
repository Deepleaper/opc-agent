# OAD Schema v1 规范

**OAD**（Open Agent Definition）是智能体的声明式定义格式，支持 YAML 和 JSON。

## 完整 Schema

```yaml
apiVersion: opc/v1          # 必填。API 版本，目前固定为 "opc/v1"
kind: Agent                  # 必填。资源类型，目前固定为 "Agent"

metadata:
  name: string               # 必填。智能体标识名
  version: string            # 语义版本号，默认 "1.0.0"
  description: string        # 可选。人类可读的描述
  author: string             # 可选。作者
  license: string            # 默认 "Apache-2.0"
  marketplace:               # 可选。市场配置
    certified: boolean       # 默认 false
    category: string         # 如 "customer-service"

spec:
  provider:                  # 大语言模型供应商
    default: string          # 默认供应商，默认 "deepseek"
    allowed: string[]        # 允许的供应商列表，默认 ["openai", "deepseek", "qwen"]
  model: string              # 模型名称，默认 "deepseek-chat"
  systemPrompt: string       # 系统提示词

  skills:                    # 技能列表
    - name: string           # 技能标识
      description: string    # 技能说明
      config: object         # 可选。技能配置

  channels:                  # 通信渠道
    - type: web|websocket|telegram|slack|wechat|feishu|email|voice|webhook
      port: number           # Web 渠道的端口
      config: object         # 可选。渠道配置

  memory:
    shortTerm: boolean       # 开启对话记忆，默认 true
    longTerm: boolean        # 开启持久化记忆，默认 false
    provider: string         # 记忆后端（可选）

  testing:
    cases:                   # 测试用例
      - name: string
        input: string
        expect:
          contains: string[]
          notContains: string[]
          toolCalled: string[]
          maxLatencyMs: number

  rateLimits:
    perUser:
      maxRequests: number
      windowMs: number
    perProvider:
      maxRequests: number
      windowMs: number

  cache:
    enabled: boolean
    ttlMs: number
    maxEntries: number

  dtv:
    trust:
      level: sandbox|verified|certified|listed  # 默认 "sandbox"
    value:
      metrics: string[]      # 要追踪的指标，默认 []
```

## 校验

OAD 文件使用 Zod schema 校验。用 CLI 校验：

```bash
opc build -f oad.yaml
```

或在代码中校验：

```typescript
import { validateOAD } from 'opc-agent';

const config = validateOAD(yamlData);
```
