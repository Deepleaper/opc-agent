# OPC Studio 全面代码审查 + 穿行测试

## 背景
OPC Studio 有 4 个核心模块：
1. **OPC Agent** — 主控 Studio（server.ts + index.html）
2. **DeepBrain** — 知识库（npm: deepbrain，ESM-only）
3. **AgentKits** — 模型配置（npm: agentkits，ESM-only）
4. **Workstation** — 岗位模板（npm: agent-workstation，CJS）

当前问题：代码里有大量引用这些模块的地方，部分是假实现、部分包名错误、部分 ESM/CJS 不兼容。

## 任务

### 阶段 1: 全面代码扫描
1. 扫描 `src/` 所有 `.ts` 文件，列出每个对 `deepbrain`、`agentkits`、`agent-workstation` 的引用
2. 检查每个引用点：
   - 包名是否正确？（agentkits 不是 agent-kits）
   - 加载方式是否正确？（ESM 包必须用 `dynamicImport`，不能用 `require`）
   - 被调用的 API（类名/方法名）是否真实存在？
   - 错误处理是否合理？

### 阶段 2: 验证模块 API
对每个模块，实际检查导出了哪些类/函数：
```bash
node -e "import('deepbrain').then(m=>console.log(Object.keys(m)))"
node -e "import('agentkits').then(m=>console.log(Object.keys(m)))"
node -e "const m=require('agent-workstation');console.log(Object.keys(m))"
```
然后对比代码里调用的 API，标记哪些是假的。

### 阶段 3: 修复
- 所有 `require('deepbrain')` 和 `require('agentkits')` 改为 `const { dynamicImport } = require('../utils/dynamic-import')` + `await dynamicImport('xxx')`
- 包名错误全部纠正
- 调用不存在的 API → 要么实现，要么移除假代码
- 已有的 `dynamicImport` helper 在 `src/utils/dynamic-import.js`（纯 JS，用 `new Function('specifier', 'return import(specifier)')` 绕过 TS 编译）

### 阶段 4: 穿行测试
修复后，逐个测试每条 API 路径：

```bash
# 0. Build
npm run build

# 1. 启动 Studio（在 opc-agent 目录，不是 test 目录）
node -e "const{StudioServer}=require('./dist/studio/server');new StudioServer({port:4000,agentDir:process.cwd(),workDir:process.cwd()}).start()"

# 2. 测 Memory/DeepBrain APIs
curl http://localhost:4000/api/memory/stats
curl http://localhost:4000/api/memory/list
curl -X POST http://localhost:4000/api/memory/upload -F "file=@README.md"

# 3. 测 Agent CRUD
curl http://localhost:4000/api/agents
curl -X POST http://localhost:4000/api/agents -H "Content-Type: application/json" -d '{"name":"test","model":"auto"}'
curl http://localhost:4000/api/agents/test
curl -X DELETE http://localhost:4000/api/agents/test

# 4. 测 Agent Chat（OPC 助手）
curl -X POST http://localhost:4000/api/agents/opc-assistant/chat -H "Content-Type: application/json" -d '{"message":"你好"}'

# 5. 测模板
curl http://localhost:4000/api/templates

# 6. 测模型配置
curl http://localhost:4000/api/models
curl http://localhost:4000/api/models/ollama

# 7. 前端加载
curl -s http://localhost:4000/ | head -20
```

每个测试记录：HTTP status + 返回数据前 200 字符 + 是否有中文乱码。

### 阶段 5: 清理
- 移除所有死代码
- 确保 `npm run build` 零 error
- `postbuild.js` 已经处理 studio-ui + dynamic-import.js 复制

## 关键约束
- deepbrain 和 agentkits 是 ESM-only（`"type": "module"`）
- agent-workstation 是 CJS（无 `type` 字段）
- opc-agent 本身是 CJS（tsconfig `module: commonjs`）
- `dynamicImport()` helper 用 `new Function` 绕过 TS 编译
- 所有中文字符串必须正确 UTF-8 编码
- 不要改 tsconfig，不要把项目改成 ESM

## 文件位置
- 项目根目录: `C:\Users\mingjwan\opc-agent`
- Studio server: `src/studio/server.ts`
- CLI: `src/cli.ts`
- Doctor: `src/doctor.ts`
- Brain seed: `src/hub/brain-seed.ts`
- Dynamic import helper: `src/utils/dynamic-import.js`
- Postbuild: `scripts/postbuild.js`

完成后 commit message 格式: `v4.2.12: full code audit - fix module refs, remove dead code, pass all API tests`
