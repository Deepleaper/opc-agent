# Task: E2E 跑通 — opc init → opc run → opc studio

目标：让 v2 代码真正能跑起来，不是只编译通过。

## 测试流程
在一个干净的临时目录里执行：

```bash
mkdir /tmp/opc-e2e-test && cd /tmp/opc-e2e-test
node C:\Users\mingjwan\opc-agent\dist\cli.js init --yes
node C:\Users\mingjwan\opc-agent\dist\cli.js studio
# Studio 应该在 localhost:4000 启动
```

## 需要修复的问题

### 1. opc init
确保 init 命令能正常运行：
- 创建 EGO.md（如果用户没有 SOUL.md 也没有 EGO.md）
- 创建 DEEPBRAIN.md（或兼容已有 MEMORY.md）
- 创建 .opc/ 目录
- 创建 oad.yaml 配置文件
- 如果有 SOUL.md/MEMORY.md 不要覆盖，保持兼容

### 2. opc studio
确保 studio 命令能启动 Express server：
- server.ts 中的 StudioServer class 必须有 start() 方法
- 绑定端口 4000
- 返回 studio-ui/index.html 
- API routes: /api/agents, /api/models, /api/brain/stats 等
- 不要因为 Ollama 不可用就崩溃

### 3. opc chat
确保 TUI 聊天能工作（至少不崩溃）：
- 读取 EGO.md/DEEPBRAIN.md
- 初始化 DeepBrain
- 连接 model provider（Ollama 优先，不可用就报错提示）
- readline 循环

### 4. opc brain recall/stats
- brain recall "test" → 应该返回空结果（新数据库）
- brain stats → 应该返回 {total: 0, byLayer: {}, bySource: {}}

## 关键约束
- 不要改 tsconfig.json
- 修复运行时错误（import 路径、missing exports、undefined 变量等）
- 每修一个问题就重新 build (`npx tsc`) 验证
- 最终 `npx tsc` 零报错 + 上述 4 个命令都能跑
- 完成后 git commit
