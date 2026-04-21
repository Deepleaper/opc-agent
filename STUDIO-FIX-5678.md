# Studio 修复任务 — 4 项

## 项目路径
C:\Users\mingjwan\opc-agent

## 关键约束
- deepbrain/agentkits 是 ESM-only，必须用 `dynamicImport()` 加载（helper 在 `src/utils/dynamic-import.js`）
- agent-workstation 是 CJS，可以用 `require()`
- 所有中文字符串必须正确 UTF-8
- 修改完必须 `npm run build` 通过

## 任务 6: Agent 设置 tab 数据加载
Agent 详情页有多个 tab（记忆、知识库、技能等），但 tab 内容全是空的。

需要：
- 记忆 tab：调 `/api/memory/list` 或从 agent 的 `.opc/memory.json` 读取，显示记忆列表
- 知识库 tab：调 `/api/memory/stats` 显示 DeepBrain 连接状态和页面数
- 技能 tab：读 agent 目录下的 skills/，列出已有 skill
- 每个 tab 在切换时 fetch 对应 API 加载数据

前端在 `src/studio-ui/index.html`，后端在 `src/studio/server.ts`。

## 任务 7: Workstation 模板展示 Skill
模板列表和模板详情页需要展示该模板自带的 Skills。

agent-workstation 的 `getRole(category, roleName)` 返回的对象里应该有 skills 字段。
在前端模板卡片和详情里展示 skills 列表。

验证：
```bash
node -e "const ws=require('agent-workstation');const cats=ws.getCategories();const role=ws.getRole(cats[0].name,cats[0].roles[0]);console.log(JSON.stringify(role,null,2))"
```

## 任务 8: DeepBrain 拖拽上传
在 DeepBrain/知识库页面，用户应该能拖拽文件上传。

需要：
- 前端：在知识库区域添加 drag & drop zone
- 前端：拖入文件后调 POST `/api/memory/upload`（multipart/form-data）
- 后端：`/api/memory/upload` 路由接收文件，用 DeepBrain 的 `brain.learn()` 或 `DocumentParser` 解析并存入
- 支持 .md, .txt, .pdf 文件
- 上传后刷新知识库列表

后端已有 `handleDocumentUpload` 方法（server.ts），检查是否完整。

## 任务 5: OPC 助手 Function Calling（标记 TODO，不实现）
在 `handleAgentChat` 的 opc-assistant 分支里加注释：
```
// TODO: Add function calling tools for OPC assistant
// Tools needed: createAgent, deleteAgent, listAgents, configureChannel, updateAgent
// Reference: Hermes Agent pattern - expose Studio APIs as LLM tools
```

## 完成后
1. `npm run build` 必须通过
2. 启动 Studio 验证每个功能
3. 列出测试结果
