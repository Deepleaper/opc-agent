你的任务是完全重写 OPC Studio 的前端 UI (src/studio-ui/index.html)。这是一个单文件 HTML（含 CSS + JS），不能拆分。

## 第一步：读取参考文件
1. 读 `C:\Users\mingjwan\.openclaw\agents\ray-cto\workspace\tmp\opc-studio-prd-v1.2.html` — PRD mockup 设计
2. 读 `src/studio/server.ts` — 后端 API 接口
3. 读当前 `src/studio-ui/index.html` — 了解现有结构

## 设计规范

### 视觉风格
- 亮色 Material 3 风格（白底 + Google Blue #1a73e8）
- 字体: system-ui, -apple-system, 'Segoe UI'
- 圆角: 12px
- 字体大小: >= 14px
- 卡片阴影: 0 1px 3px rgba(0,0,0,0.08)
- hover: 加深阴影 + 蓝色边框

### 侧边栏结构（固定不变）
```
⚡ OPC Studio（logo）

🧑‍💻 OPC 助手（置顶，全局助理）
─────────
🤖 OPC AGENT（section label）
  [动态 Agent 列表]
  ➕ 新建 Agent
  👥 新建群组
  📡 渠道配置
─────────
🧩 AGENTKITS（section label）
  模型配置
─────────
🧠 DEEPBRAIN（section label）
  知识库浏览
─────────
🖥️ WORKSTATION（section label）
  岗位模板库
```

### 页面列表

1. **OPC 助手聊天页** — SSE 流式聊天，首次打开默认进入
2. **Agent 聊天页** — 左 60% 聊天 + 右 40% 设置面板（可折叠，点 ⚙️ 展开）
   - 设置面板 5 个 tab: 角色 / 模型 / 渠道 / 记忆 / 技能
   - 模型 tab: 只显示已配通的模型供选择
3. **AgentKits 模型配置页** — 三区: Ollama 本地模型 / 云端 API Key（填Key→验证按钮→解锁）/ Agent 模型分配表
   - 核心规则：没配通 Key 的 Provider，其模型不出现在 Agent 的模型选择列表
4. **DeepBrain 知识库页** — 拖拽上传区 + 统计卡片 + 搜索 + 三层浏览（行业/岗位/工位）
5. **Workstation 岗位模板库页** — 面包屑导航 + 三级钻取（行业→岗位→工位）+ 每层显示 Skill 标签 + 底部 Skill 自动叠加说明
6. **渠道配置页** — Telegram/微信/飞书/Slack 等 Token 配置
7. **新建 Agent 页** — 简单表单（名称+描述+选模板）

### 后端 API（已有）
- GET /api/agents — Agent 列表
- GET /api/agents/:id — Agent 详情
- PUT /api/agents/:id — 更新 Agent
- POST /api/agents — 创建 Agent
- DELETE /api/agents/:id — 删除 Agent
- POST /api/agents/:id/chat — 聊天（SSE 流式）
- GET /api/config — 全局配置
- PUT /api/config — 更新配置
- GET /api/skills — 技能列表
- GET /api/schedules — 调度列表
- GET /api/status — 系统状态
- GET /api/memory — 记忆

### 关键约束
1. 单文件 HTML，CSS 和 JS 全内联
2. `const API = '';` 开头（空字符串，相对路径）
3. 聊天用 SSE 流式（fetch + ReadableStream），打字机效果
4. 首次打开（无 Agent 时）自动导航到 OPC 助手
5. Agent 列表轮询刷新（5s）
6. 所有按钮必须有 onclick 处理
7. Markdown 渲染（代码块、列表、粗体等）

完成后不需要运行测试，直接告诉我你写完了。
