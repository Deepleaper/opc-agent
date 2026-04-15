# 核心概念

## 智能体 (Agent)

智能体是一个有完整生命周期的 AI 实体：

```
初始化 (init) → 就绪 (ready) → 运行中 (running) → 已停止 (stopped)
```

每个智能体有以下属性：
- **名称** — 唯一标识符
- **系统提示词** — 定义智能体的角色和行为
- **技能** — 智能体能做的事（如 FAQ 查询、转人工）
- **渠道** — 用户和智能体交互的方式（如 Web、Telegram）
- **记忆** — 对话历史和长期知识

## OAD (Open Agent Definition)

OAD 是智能体的声明式定义格式，用 YAML 编写。一个 OAD 文件就是一个完整的智能体定义。

```yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: my-agent
  version: 1.0.0
spec:
  provider:
    default: deepseek
  model: deepseek-chat
  systemPrompt: "你是一个专业的客服助手。"
  skills: [...]
  channels: [...]
```

这个设计理念参考了 Kubernetes 的资源定义：声明你想要的状态，框架帮你实现。

## 技能 (Skill)

技能是智能体的模块化能力。每个技能：
- 有 `name` 和 `description`
- 接收对话上下文和当前消息
- 返回是否处理了这条消息，以及置信度

内置技能包括：
- **FAQ 查询** — 从预设问答库匹配答案
- **人工转接** — 置信度低时转给人工客服
- **知识库检索** — 从文档中语义搜索相关内容

你也可以继承 `BaseSkill` 实现自定义技能。

## 渠道 (Channel)

渠道是用户和智能体交互的接口：

| 渠道 | 说明 |
|------|------|
| **Web** | HTTP API + SSE 流式响应，自带对话 UI |
| **WebSocket** | 实时双向通信 + 广播 |
| **Telegram** | Telegram Bot API Webhook |
| **Slack** | Slack 应用集成 |
| **微信** | 微信公众号消息处理 |
| **飞书** | 飞书机器人 |
| **邮件** | 邮件收发 |
| **语音** | 语音识别（STT）+ 语音合成（TTS） |
| **Webhook** | 接收外部系统回调 |

## 记忆 (Memory)

智能体有两种记忆：

- **短期记忆** — 单次会话内的对话历史，会话结束即清除
- **长期记忆** — 跨会话的持久化知识，支持 DeepBrain 语义搜索

```yaml
spec:
  memory:
    shortTerm: true       # 开启对话上下文
    longTerm: true        # 开启长期记忆
    provider: deepbrain   # 长期记忆后端
```

## DTV 框架 (Data / Trust / Value)

DTV 框架管理智能体的数据访问、信任等级和价值度量：

### 数据 (Data)
智能体对业务数据的只读访问。可以读取配置，但不能修改源系统。

### 信任 (Trust)
渐进式信任等级控制智能体的能力范围：

| 等级 | 说明 |
|------|------|
| `sandbox` | 沙箱模式，无网络访问，能力受限 |
| `verified` | 身份已验证，基础能力 |
| `certified` | 通过安全审计，完整能力 |
| `listed` | 已发布到 OPC 市场 |

### 价值 (Value)
性能和 ROI 指标追踪：
- 响应时间、满意度评分、解决率
- 自动化报表和仪表盘
