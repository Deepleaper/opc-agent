# Task: Telegram 渠道接入

## 目标
`opc run --channel telegram` 能接收 Telegram 消息，用 Ollama 回复。

## 当前状态
- src/channels/ 下已有 telegram.ts 文件
- Agent Loop 已跑通（chat + tool + memory）
- Ollama qwen2.5:0.5b 在 localhost:11434

## 需要做的
1. 检查 `src/channels/telegram.ts` 的 TelegramChannel class
2. 确保它能：
   - 用 bot token 连接 Telegram（long polling，不用 webhook）
   - 收到消息 → 调用 Agent Loop → 回复
3. 在 `src/cli.ts` 的 `run` 命令中，根据 oad.yaml 的 channels 配置启动 Telegram
4. 如果 oad.yaml 里没有 telegram token，跳过不报错

## 验证
```powershell
# 在 oad.yaml 里加：
# channels:
#   telegram:
#     token: "8663573684:AAHcqsfOO5wMVgTRaWcz7-Wg1_aJ1MOllTE"

cd C:\Users\mingjwan\opc-e2e-v2\my-agent
node C:\Users\mingjwan\opc-agent\dist\cli.js run
# 从 Telegram 给 bot 发消息，应该收到回复
```

## 约束
- 用 long polling（不需要 public URL）
- 不加新依赖，用内置 fetch 调 Telegram Bot API
- npx tsc 零报错
- 完成后 git commit
