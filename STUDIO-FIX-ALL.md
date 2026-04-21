# Studio 全面修复任务

## 工作目录
`C:\Users\mingjwan\opc-agent`

## 关键文件
- 前端: `src/studio-ui/index.html` (单文件 HTML，约 1000 行)
- 后端: `src/studio/server.ts` (约 1900 行)
- 模板数据: `src/studio/templates-data.ts`

## 必须修复的问题（按优先级）

### P0: 编码/乱码
1. **AgentKits 页面中文乱码** — `src/studio-ui/index.html` 中 AgentKits 相关的中文文本被编码损坏（如 `Φ*àoåÖ:` 应该是中文）。检查所有非 ASCII 字符，确保所有中文文本正确。
   - 重点区域：AgentKits 模型配置页的提示文字、标签、按钮
   - 也检查 DeepBrain、Workstation 等其他页面的中文

### P1: 功能修复
2. **AgentKits 模型配置中心** — 当前页面要能：
   - 显示本地 Ollama 已安装的模型（自动检测）
   - 配置云端 API Key（OpenAI、Anthropic、Google Gemini、DeepSeek、通义千问）
   - 填 Key → 验证 → 解锁对应模型
   - 全局默认模型选择
   - 后端 API: GET/PUT `/api/settings/models`, GET `/api/settings/models/local`, POST `/api/settings/models/test`

3. **渠道配置移到 Agent 设置里** — 
   - 在 Agent 设置的 tabs 里增加"渠道"tab
   - 从侧边栏移除顶级"渠道配置"菜单项
   - 每个 Agent 独立配置渠道（Telegram token、微信 AppID 等）

4. **Agent 设置 tab 加载数据** — 当前 Agent 有 7 个 tab 但很多是空的：
   - 基本信息 tab: 能编辑 name, systemPrompt, model, icon
   - 记忆 tab: 调 GET `/api/agents/{id}/memory` 显示记忆条目
   - 知识库 tab: 显示该 Agent 的知识文件列表
   - 技能 tab: 显示 Agent 配置的 skills
   - 渠道 tab: （新增）配置渠道
   - 日志 tab: 显示最近对话日志
   - 设置 tab: 高级设置（temperature, maxTokens 等）

5. **Workstation 模板展示 Skill** — 
   - 每个模板卡片上显示关联的 Skills
   - 三层 Skill 叠加展示：行业 Skill + 岗位 Skill + 工位 Skill
   - 后端 templates API 已有 skill 数据，前端需要渲染

6. **DeepBrain 拖拽上传** — 
   - 知识库页面的拖拽区域要真正能上传文件
   - 后端需要 POST `/api/memory/upload` 接口
   - 支持 .txt, .md, .pdf, .docx
   - 上传后显示在知识库列表中

### P2: 已修但需确认
7. **OPC 助手虚拟 Agent** — server.ts 已处理 `opc-assistant` 特殊 ID（v4.2.7），确认前端正确发送
8. **Ollama 模型自动检测** — providers/index.ts 已修（v4.2.6），确认 chat 能正常用 Ollama 模型

## 技术约束
- 前端是**单文件 HTML**，不能拆分
- 所有中文必须正确的 UTF-8
- 后端 Content-Type 必须带 `charset=utf-8`
- server.ts 的 `readFileSync` 必须指定 `'utf-8'`
- 不要用 PowerShell 的 `Set-Content` 写文件（会破坏编码）
- 构建: `npm run build`（自动 copy studio-ui 到 dist）

## 后端 API 参考
已有的 API 路由（server.ts）:
- GET `/api/agents` — 列出所有 agent
- GET `/api/agents/:id` — 获取单个 agent
- POST `/api/agents` — 创建 agent
- PUT `/api/agents/:id` — 更新 agent
- DELETE `/api/agents/:id` — 删除 agent
- POST `/api/agents/:id/chat` — SSE 流式聊天
- GET `/api/agents/:id/memory` — 获取 agent 记忆
- GET `/api/settings/models` — 获取模型配置
- PUT `/api/settings/models` — 保存模型配置
- GET `/api/settings/models/local` — 获取本地 Ollama 模型
- POST `/api/settings/models/test` — 测试 API Key
- GET `/api/memory` — 获取 DeepBrain 知识库
- GET `/api/templates` — 获取模板列表
- GET `/api/templates/:id` — 获取单个模板

### P1.5: Agent 设置完整覆盖 OAD Schema
Agent 设置页面需要覆盖 oad.yaml 的所有可配置项（参考 src/schema/oad.ts）：

**Tab 1 - 基本信息**: name, description, version, author, model, systemPrompt, provider, locale, icon
**Tab 2 - 技能**: skills[] (name, description, config)
**Tab 3 - 工具**: tools.builtin[] (选择内置工具), tools.mcp[] (添加 MCP server)
**Tab 4 - 渠道**: channels[] (type, port, config) — Telegram/微信/飞书/Slack/Discord/Email/Web/Voice/Webhook
**Tab 5 - 记忆**: memory.shortTerm, memory.longTerm (provider, collection, autoLearn, autoRecall, evolveInterval)
**Tab 6 - 语音**: voice.enabled, voice.sttProvider, voice.ttsProvider, voice.language
**Tab 7 - 安全**: auth (apiKeys, sessionIsolation), hitl (requireApproval, timeout, defaultAction), guardrails (input/output rules)
**Tab 8 - 高级**: streaming, telemetry, protocols (a2a, agui, mcp), dtv, plugins, workflows

每个 tab 要能编辑并保存（PUT /api/agents/:id）。

## 验收标准
1. 所有页面中文显示正常（零乱码）
2. OPC 助手能正常对话（用 Ollama 模型）
3. AgentKits 能看到 Ollama 模型 + 配置云端 Key
4. Agent 每个 tab 都有内容
5. Workstation 模板显示 Skill
6. 拖文件到 DeepBrain 能上传
7. `npm run build` 无错误
