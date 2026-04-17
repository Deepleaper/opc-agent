# 🤖 OPC Agent — Agent OS

**Agent 全生命周期操作系统：创建、开发、测试、运行、监控。**

> 不只是 Harness，是比 Harness 高一维的 Agent OS。

## 为什么需要 OPC Agent？

| 维度 | 传统 Harness | OPC Agent OS |
|------|-------------|--------------|
| 创建 | 手写代码 | `opc init` 一键创建 |
| 开发 | 手动配置 | 热重载开发环境 |
| 测试 | 无标准 | 内置测试框架 |
| 运行 | 单渠道 | 11 渠道统一部署 |
| 监控 | 无 | Traces + Analytics |
| 记忆 | 无 | DeepBrain 集成 |

## Quick Start

```bash
npm install -g opc-agent

# 创建新 Agent
opc init my-agent
cd my-agent

# 开发
opc dev

# 测试
opc test

# 运行
opc run
```

## 核心特性

| 特性 | 说明 |
|------|------|
| 📋 OAD 配置 | 声明式 Agent 定义（YAML） |
| 📡 11 渠道 | Web、Telegram、Slack、Discord、微信、飞书、Email... |
| 🧪 测试框架 | 内置 Agent 行为测试 |
| 🔌 插件系统 | 可扩展技能和工具 |
| 📊 Traces | OpenTelemetry 风格的行为采集 |
| 🧠 DeepBrain | 自动学习和记忆 |
| 🌍 i18n | 多语言支持 |
| 🚀 一键部署 | OpenClaw 等平台部署 |

## OAD 配置示例

```yaml
id: my-agent
name: My Agent
version: "1.0.0"
model: deepseek-chat
skills:
  - web-search
  - code-review
channels:
  - type: web
    priority: primary
  - type: telegram
    priority: secondary
memory:
  shortTerm: true
  longTerm:
    provider: deepbrain
```

## CLI

```bash
opc init <name>    # 创建 Agent
opc dev            # 开发模式
opc test           # 运行测试
opc run            # 生产运行
opc logs           # 查看日志
opc brain          # 查看记忆状态
opc score          # 查看评分
```

## 146 Tests Passing ✅

```bash
npm test
```

## License

Apache-2.0

## Links

- [deepbrain](https://github.com/Deepleaper/deepbrain) — Agent 记忆引擎
- [agentkits](https://github.com/Deepleaper/agentkits) — 带记忆的 OpenRouter
- [agent-workstation](https://github.com/Deepleaper/agent-workstation) — 虚拟工位模板库
