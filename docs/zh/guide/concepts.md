# 核心概念

## OAD（Open Agent Definition）

OAD 是智能体的声明式定义文件，使用 YAML 格式。包含：

- **metadata** — 名称、版本、描述
- **spec** — 模型、系统提示词、技能、渠道、记忆、DTV

## 技能（Skills）

技能是智能体的能力模块，每个技能处理特定类型的用户请求。

## 渠道（Channels）

渠道定义智能体与用户交互的方式：Web、Telegram、Slack、微信等。

## DTV（Data-Trust-Value）

DTV 框架确保智能体的数据安全、信任级别和价值追踪。

## 测试

在 OAD 中定义测试用例，使用 `opc test` 运行自动化测试。

## 缓存与限流

内置 LLM 响应缓存和多级限流，降低 API 成本，保护服务稳定性。
