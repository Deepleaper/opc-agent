# OPC vs OpenClaw vs Hermes — 体验差距对照表

## 状态说明
- ✅ OPC 已有且不差于竞品
- 🟡 OPC 有但不如竞品
- ❌ OPC 缺失，竞品有
- 🔵 OPC 独有优势

---

## 一、安装 & 初始化

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 1 | 一行安装 | `npx openclaw@latest init` | `curl \| sh` one-liner | `npm i -g opc-agent && opc init` | 🟡 两步 vs 一步 | P1 |
| 2 | 本地模型支持 | ✅ 支持 Ollama | ✅ 支持 | ✅ v4.1.4 Ollama-first | ✅ | - |
| 3 | 智能模型推荐 | ❌ 手动选 | ❌ 手动选 | ✅ 硬件检测 + 分级推荐 | 🔵 领先 | - |
| 4 | Setup Wizard | 交互式向导 | `hermes setup` 向导 | 交互式模板+LLM选择 | ✅ | - |
| 5 | 迁移工具 | - | 从 OpenClaw 迁移 | ❌ 无迁移工具 | ❌ | P3 |
| 6 | Doctor 诊断 | ❌ 无 | ❌ 无 | ✅ `opc doctor` 11项检查 | 🔵 领先 | - |
| 7 | `npx opc-agent init` 一行启动 | - | - | ❌ 需要先全局安装 | 🟡 | P1 |

## 二、自主学习 & 技能进化

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 8 | Agent 自写 Skill | ✅ AgentSkills | ✅ 自动创建 Skill MD | ❌ 代码未实现 | ❌ 关键差距 | P0 |
| 9 | 学习触发条件 | 自动 | 5步闭环(execute→evaluate→extract→refine→retrieve) | ❌ | ❌ | P0 |
| 10 | Skill 格式标准 | AgentSkills | agentskills.io MD | 无标准 | ❌ | P0 |
| 11 | 预置 Skill 数量 | 100+ ClawHub | 40+ bundled | 12 模板 | 🟡 | P2 |
| 12 | Skill 市场 | ClawHub | 社区共享 | ❌ 无 | ❌ | P3 |
| 13 | 知识进化(evolve) | ❌ | ❌ | ✅ DeepBrain evolve 架构 | 🔵 领先 | - |
| 14 | 多层知识体系 | ❌ | ❌ | ✅ 行业→岗位→工位→Agent | 🔵 领先 | - |

## 三、用户建模 & 记忆

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 15 | USER.md 用户画像 | Workspace MD | ✅ USER.md + Honcho | ❌ 无 | ❌ | P1 |
| 16 | SOUL.md 人格 | ✅ | ❌ | ✅ | ✅ | - |
| 17 | 持久记忆 | SQLite + Memory | SQLite + FTS5 | FileBackedStore JSON | 🟡 | P2 |
| 18 | 对话历史搜索 | ✅ | FTS5 全文搜索 | ❌ | ❌ | P2 |

## 四、渠道 & 交互

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 19 | 多渠道(TG/Discord/Slack) | ✅ 全部 | ✅ TG/Discord/Slack | ✅ 代码有 | ✅ | - |
| 20 | Web UI 聊天 | ✅ | ✅ | ✅ | ✅ | - |
| 21 | Studio 管理面板 | 无(CLI only) | 无(CLI only) | ✅ OPC Studio | 🔵 领先 | - |
| 22 | CLI 对话模式 | ❌ | ✅ `hermes chat` | ❌ | 🟡 | P2 |

## 五、开发者体验

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 23 | TypeScript SDK | ❌ | ❌ | ✅ | 🔵 领先 | - |
| 24 | A2A 协议 | ❌ | ❌ | ✅ | 🔵 领先 | - |
| 25 | MCP 协议 | ✅ | ✅ | ✅ | ✅ | - |
| 26 | Workstation 模板 | ❌ | ❌ | ✅ 100+ 角色 | 🔵 领先 | - |
| 27 | `npx opc-agent` 零安装运行 | ✅ npx openclaw | ❌ | ❌ | 🟡 | P1 |

## 六、自动化 & 调度

| # | 体验点 | OpenClaw | Hermes | OPC 现状 | 差距 | 优先级 |
|---|--------|----------|--------|----------|------|--------|
| 28 | Cron 定时任务 | ✅ Heartbeat | ❌ | ✅ cron-engine | ✅ | - |
| 29 | 主动触达 | ✅ Proactive | ❌ | 🟡 有 cron 但无主动逻辑 | 🟡 | P2 |

---

## 优先级行动计划

### P0 — 今天必须启动（自主学习闭环）
1. **#8 Agent 自写 Skill** — 实现 auto-skill-creation
2. **#9 学习触发条件** — 实现 5 步闭环
3. **#10 Skill 格式标准** — 采用 agentskills.io 兼容格式

### P1 — 今天尽量完成（安装体验 + 用户建模）
4. **#1/#7/#27 一行安装** — 支持 `npx opc-agent init`
5. **#15 USER.md 用户建模** — Agent 自动学习用户偏好

### P2 — 本周完成
6. **#11 更多预置 Skill** — 扩充到 40+
7. **#17 SQLite 持久记忆** — 替代 JSON
8. **#18 对话历史搜索** — FTS5
9. **#22 CLI 对话模式** — `opc chat`
10. **#29 主动触达** — Agent 主动发消息

### P3 — 后续
11. **#5 迁移工具** — 从 OpenClaw/Hermes 迁移
12. **#12 Skill 市场** — OPC Hub
