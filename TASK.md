# Task: opc chat 用 Ollama 聊天（最小闭环）

## 唯一目标
运行 `node dist/cli.js chat`，用户输入文字，Agent 用 Ollama qwen2.5:0.5b 回复。

## 验证方法
```powershell
cd C:\Users\mingjwan\opc-e2e-v2\my-agent
echo "你好" | node C:\Users\mingjwan\opc-agent\dist\cli.js chat
```
期望：打印出 Agent 的回复文字，然后退出。

## 当前状态
- Ollama 运行在 http://localhost:11434，有 qwen2.5:0.5b 模型
- `src/providers/ollama.ts` 已存在 OllamaProvider class
- `src/cli/chat.ts` 已存在但可能不完整
- `src/core/agent-loop.ts` 已存在

## 需要确保的
1. `src/providers/ollama.ts` 的 chat() 方法能调通 `http://localhost:11434/v1/chat/completions`
2. `src/cli/chat.ts` 能读取 oad.yaml 中的 model，初始化 OllamaProvider，发送消息，打印回复
3. 如果 stdin 是 pipe（非 TTY），读完就退出；如果是 TTY，用 readline 循环
4. `npx tsc` 零报错

## 不要做的
- 不修测试
- 不改 Studio
- 不做 Tool 执行
- 不做 DeepBrain
- 只做最简单的：用户说话 → LLM 回复
