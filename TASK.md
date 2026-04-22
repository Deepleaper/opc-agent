# Task: Studio 彻底修活

## 现象
`opc studio` 打印 "[Studio] Listening on port 4000" 和 "OPC Studio ready" 后几秒内退出 (code 1)。Express server 绑端口成功但随后进程崩溃。

## 根因分析
1. server.ts start() 里有 unhandled rejection 导致进程退出
2. 可能在模块加载（DeepBrain/AgentKits/Workstation检测）时抛异常
3. 可能在 cron-engine 初始化时抛异常

## 修复要求

### 1. 在 cli.ts 的 studio 命令处理器最开始加全局错误捕获
```typescript
process.on('uncaughtException', (err) => {
  console.error('[Studio] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err: any) => {
  console.error('[Studio] Unhandled rejection:', err?.message || err);
});
```

### 2. 在 server.ts start() 里，所有 async 操作都 try-catch
特别是模块检测（DeepBrain/AgentKits/Workstation）和 cron-engine 启动。

### 3. 确保 app.listen 返回的 server 对象被存为 class 属性
```typescript
this.server = app.listen(port, () => { ... });
```
这样 server 不会被 GC。

### 4. 在 start() 最后确保返回一个永不 resolve 的 Promise
```typescript
await new Promise<never>(() => {});
```

## 验证
```powershell
cd C:\Users\mingjwan\opc-e2e-v2\my-agent
node C:\Users\mingjwan\opc-agent\dist\cli.js studio
# 等 10 秒，进程不应该退出
# 另一个终端：
curl http://localhost:4000/
curl -X POST http://localhost:4000/api/chat -H "Content-Type: application/json" -d '{"message":"hello"}'
```

进程必须持续运行直到 Ctrl+C。API 必须可达。

## 约束
- npx tsc 零报错
- 完成后 git commit
