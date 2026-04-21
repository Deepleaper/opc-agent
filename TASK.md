# Task: Tool 执行闭环

## 目标
`opc chat` 时用户问"现在几点了"，Agent 调用 datetime tool 返回时间。

## 当前状态
- opc chat 已能用 Ollama 聊天（刚验证通过）
- src/tools/ 下有 datetime.ts, calculator.ts 等
- src/tools/builtin/ 下有注册逻辑

## 需要做的
1. 在 chat.ts 的 pipe 模式中，发送消息给 LLM 时带上 tools 定义
2. 如果 LLM 返回 tool_calls，执行对应 tool，把结果喂回 LLM
3. LLM 根据 tool 结果生成最终回复

### 具体实现
在 src/cli/chat.ts 的 pipe 模式中：
1. 从 src/tools/builtin/index.ts 获取 builtin tools（getBuiltinTools 或 getBuiltinToolsByName）
2. 把 tools 转成 OpenAI function calling 格式，放在 chat 请求的 tools 字段
3. 检查响应是否有 tool_calls
4. 如果有：执行 tool → 把 tool result 加入 messages → 再调一次 LLM
5. 打印最终回复

### 注意
- qwen2.5:0.5b 可能不支持 function calling，如果不支持就用 qwen2.5:7b 或忽略 tool 直接回复
- Ollama OpenAI 兼容 API 支持 tools 参数
- 先试，不行就降级

## 验证
```powershell
cd C:\Users\mingjwan\opc-e2e-v2\my-agent
echo "现在几点了？" | node C:\Users\mingjwan\opc-agent\dist\cli.js chat
```
期望：返回当前时间。

## 约束
- npx tsc 零报错
- 完成后 git commit
