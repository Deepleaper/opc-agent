# OPC Agent 易用性问题清单

日期: 2026-04-20
目标: 易用性超过 OpenClaw 和 DeerFlow

## 🔴 Critical (新用户第一次就遇到)

### C1: .env 和 oad.yaml 配置矛盾
- .env 设了 `OPC_LLM_BASE_URL=https://api.openai.com/v1` 和 `OPC_LLM_MODEL=gpt-4o-mini`
- 但 oad.yaml 里 `provider: deepseek`, `model: deepseek-chat`
- 新用户困惑：到底听谁的？
- **修复**: init 时让用户选 provider，.env 和 oad.yaml 统一生成

### C2: .env 占位符 API key 导致 401
- 默认 `OPC_LLM_API_KEY=your-api-key-here` 导致第一次对话直接 401
- 用户看到 "Incorrect API key" 错误，不知道怎么修
- **修复**: init 时提示输入 API key 或选择 Ollama(免费本地)
- 如果没配 key，chat 应该给友好提示而不是 raw 401 JSON

### C3: agent.yaml vs oad.yaml 双配置文件
- init 生成了 agent.yaml 和 oad.yaml 两个文件
- doctor 检查 agent.yaml 但 runtime 读 oad.yaml
- **修复**: 统一用一个文件

## 🟡 Important (影响体验但不致命)

### I1: opc doctor 误报
- "agent.yaml exists: Not found" — 但实际有 oad.yaml
- "TypeScript installed: Not found" — 但 npx tsx 能跑
- "Ollama running: Not running" — 不是所有用户都用 Ollama
- "DeepBrain package: Not installed" — 但 opc-agent 自带内存 fallback
- **修复**: doctor 应该检查 oad.yaml，对非必须项给 warning 不给 ❌

### I2: Chat 401 错误消息不友好
- 返回 raw SSE `data: {"error":"LLM API error 401: {...}"}` 
- Web UI 应该显示 "请先配置 API Key" + 指引
- **修复**: 前端拦截 401，显示配置指引

### I3: Studio /api/dashboard 404
- Dashboard API 不存在
- **修复**: 实现或移除 dashboard 入口

### I4: DeepBrain fallback 无声失败
- 日志显示 `[DeepBrainMemory] deepbrain package not found, using in-memory fallback`
- 用户不知道记忆没有持久化
- **修复**: 首次运行时提示，或默认用文件存储

### I5: 没有一键安装脚本
- OpenClaw 有 `curl | sh` 一键安装
- 我们需要 `npm install -g opc-agent`，还要自己装 Node
- **修复**: 做一个安装脚本，检测 OS、装 Node、装 opc-agent

## 🟢 Nice-to-have

### N1: 没有 `opc quickstart` 命令
- OpenClaw 五分钟上手，我们还是多步手动流程
- **修复**: 做一个交互式 quickstart，一步到位

### N2: init 模板缺少 Ollama 选项
- 很多用户想用免费本地模型
- **修复**: init 时加 Ollama 选项，自动配 ollama provider

### N3: README.md 内容单薄
- 缺少截图、GIF、快速上手步骤
- **修复**: 丰富 README

### N4: Studio agent 数据来自旧缓存
- API 返回 "name: Updated Bot" 而不是 "my-first-agent"
- **修复**: 确保从 oad.yaml 实时读取

### N5: cron-engine 默认 9 个任务
- 新建的 agent 不应该有预设的 cron 任务
- **修复**: 新 agent 默认 0 个 cron 任务
