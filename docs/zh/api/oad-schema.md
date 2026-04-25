# OAD Schema 规范

**OAD**（Open Agent Definition）是声明式 YAML/JSON 格式，用于定义 AI 智能体。版本：1.0。

## 顶层结构

```yaml
oad: "1.0"           # Schema 版本（必需）
metadata: {}         # 智能体元数据（必需）
spec: {}             # 智能体规格（必需）
tests: []            # 测试用例（可选）
```

## metadata

```yaml
metadata:
  name: string           # 智能体名称（必需，kebab-case）
  version: string        # 语义化版本（必需）
  description: string    # 简短描述
  author: string         # 作者
  license: string        # SPDX 许可证标识
  tags: string[]         # 可搜索标签
  homepage: string       # 项目 URL
  repository: string     # Git 仓库 URL
```

## spec

### 核心

```yaml
spec:
  model: string          # 模型标识（必需）
  provider: string       # 提供商名称（必需）
  temperature: number    # 0.0 - 2.0（默认：0.7）
  maxTokens: number      # 最大响应 token（默认：4096）
  topP: number           # Top-p 采样（默认：1.0）
  systemPrompt: string   # 系统提示词（支持 | 多行）
  language: string       # 默认语言（默认："en"）
```

### spec.channels

```yaml
spec:
  channels:
    - type: string       # 通道类型（必需）
```

**通道类型和选项：**

| 类型 | 必需字段 | 可选字段 |
|------|---------|---------|
| `web` | — | `port`, `cors`, `auth` |
| `telegram` | `token` | `webhook`, `allowedUsers` |
| `slack` | `token`, `signingSecret` | `channels` |
| `discord` | `token` | `guildId`, `channels` |
| `wechat` | `appId`, `appSecret` | `token`, `encodingAESKey` |
| `whatsapp` | `token`, `phoneNumberId` | `webhookVerifyToken` |
| `email` | `imap`, `smtp` | `pollInterval`, `filter` |
| `websocket` | — | `port`, `path` |
| `webhook` | `path` | `secret`, `method` |
| `voice` | `provider` | `twilioAccountSid`, `twilioAuthToken` |

### spec.skills

```yaml
spec:
  skills:
    - name: string       # 技能名称（必需）
      path: string       # 技能文件路径
      builtin: boolean   # 使用内置技能
      package: string    # npm 包名
      config: object     # 技能特定配置
```

### spec.mcp

```yaml
spec:
  mcp:
    servers:
      - name: string     # 服务器名称（必需）
        command: string   # 运行命令（必需）
        args: string[]    # 命令参数
        env: object       # 环境变量
```

### spec.a2a

```yaml
spec:
  a2a:
    expose: boolean       # 通过 A2A 暴露此智能体（默认：false）
    port: number          # A2A 服务器端口
    agents:
      - url: string       # 远程智能体 URL（必需）
        name: string      # 智能体名称（必需）
        skills: string[]  # 委派的技能
```

### spec.workflows

```yaml
spec:
  workflows:
    - name: string       # 工作流名称（必需）
      description: string
      trigger: string    # 自然语言触发条件
      steps:
        - skill: string  # 要执行的技能（必需）
          input: object
          condition: string
          onError: string    # "skip" | "abort" | "retry"
          retries: number
```

### spec.scheduler

```yaml
spec:
  scheduler:
    - name: string       # 任务名称（必需）
      cron: string       # Cron 表达式（必需）
      action: string     # "workflow" | "skill"（必需）
      workflow: string   # 工作流名称
      skill: string      # 技能名称
      input: object
      timezone: string   # IANA 时区（默认：UTC）
```

### spec.brain

```yaml
spec:
  brain:
    autoLearn: boolean       # 自动从对话学习（默认：true）
    evolveSchedule: string   # 知识进化的 cron
    seeds: string            # brain-seeds 目录路径
    maxMemory: number        # 最大记忆条目
    embedding:
      provider: string
      model: string
```

## 环境变量插值

`oad.yaml` 中的任何值都可以引用环境变量：

```yaml
spec:
  channels:
    - type: telegram
      token: ${TELEGRAM_BOT_TOKEN}     # 必需 — 未设置则失败
      webhook: ${WEBHOOK_URL:-}        # 可选 — 未设置则为空
```

## 验证

```bash
opc info  # 解析并验证 oad.yaml
```
