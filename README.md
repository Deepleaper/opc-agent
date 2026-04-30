<p align="center">
  <h1 align="center">🤖 OPC Agent</h1>
  <p align="center"><strong>纯本地 AI 智能体，零云端依赖，越用越聪明。</strong></p>
  <p align="center">A pure-local AI agent with self-learning memory. Runs entirely on your machine.</p>
</p>

<p align="center">
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/v/opc-agent?color=blue&label=PyPI" alt="PyPI"></a>
  <a href="https://pypi.org/project/opc-agent/"><img src="https://img.shields.io/pypi/dm/opc-agent?label=%E4%B8%8B%E8%BD%BD%E9%87%8F" alt="Downloads"></a>
  <a href="https://github.com/Deepleaper/opc-agent/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green" alt="License"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10+-blue" alt="Python"></a>
  <a href="https://github.com/Deepleaper/opc-agent/stargazers"><img src="https://img.shields.io/github/stars/Deepleaper/opc-agent?style=social" alt="Stars"></a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#核心特性">核心特性</a> ·
  <a href="#api-文档">API 文档</a> ·
  <a href="./README_EN.md">English</a>
</p>

---

## 这是什么？

一个跑在你自己电脑上的 AI 助手。打开浏览器就能对话，**不需要任何账号，不花一分钱，所有数据存在本地。**

跟 ChatGPT 的区别：
- **它会记住你**——对话过的信息自动提取学习，下次聊天就知道你是谁
- **零费用**——用本地模型（Ollama），不调任何云端 API
- **隐私安全**——数据在你的 `~/.opc/brain.db`，不上传任何地方
- **开箱即用**——一行命令启动，浏览器打开就能用

---

## 快速开始

### 第一步：安装 Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows：从 https://ollama.com/download 下载
```

```bash
# 拉取模型（推荐）
ollama pull qwen2.5:7b
```

### 第二步：安装 OPC Agent

```bash
pip install opc-agent
```

### 第三步：启动

```bash
opc start
```

打开浏览器访问 **http://localhost:3000** —— 开始对话。

**就这么简单。** 三步搞定，不需要任何配置。

---

## 核心特性

### 💬 自然对话
Web UI 对话界面，Markdown 渲染，代码高亮，实时流式输出。

### 🧠 自学习记忆
每次对话结束后，自动提取关键信息存入本地知识库。下次对话时自动回忆相关内容注入上下文。

```
第一次聊: "我们公司用 React + Node.js"
第二次聊: "帮我写个前端组件" → 它记得你用 React，直接写 React 代码
```

### 🔒 完全本地
- 模型：Ollama（在你电脑上跑）
- 存储：SQLite（`~/.opc/brain.db`）
- 网络：**零外发连接**

### 🎯 智能模型推荐
根据你的硬件配置（内存/显存）自动推荐最适合的模型。

### 📁 工作区文件
支持在 `~/.opc/workspace/` 放置引导文件（SOUL.md、MEMORY.md 等），自定义 AI 的人格和记忆。

---

## Web UI

启动后打开 http://localhost:3000 ：

- 💬 多轮对话，实时流式输出
- 📝 Markdown + 代码高亮
- 🗂️ 多对话管理
- 🧠 知识库浏览（查看 AI 学到了什么）
- ⚙️ 设置面板（模型切换、工作区管理）

---

## API 文档

OPC Agent 提供完整的 REST API：

```bash
# 系统状态
GET /api/system/status

# 模型管理
GET /api/models                    # 可用模型列表
GET /api/models/recommend          # 智能推荐
POST /api/models/pull              # 拉取模型
PUT /api/models/active             # 切换活跃模型

# 对话
GET /api/conversations             # 对话列表
POST /api/conversations            # 新建对话
GET /api/conversations/{id}        # 获取对话
DELETE /api/conversations/{id}     # 删除对话

# 知识库
GET /api/brain/entries             # 知识条目
GET /api/brain/stats               # 统计

# WebSocket 实时对话
WS /ws/chat
```

---

## 自学习原理

```
用户对话 → AI 回复 → 后台异步提取关键信息
                            ↓
                     写入 brain.db
                            ↓
              下次对话时自动 recall 注入 context
```

- 提取由 Ollama 本地模型执行，不调用云端
- 每条知识带有 claim_type（事实/偏好/约束）
- 关键词搜索匹配，上限 500 tokens 注入
- 越用越准——知识积累让 AI 越来越了解你

---

## 配置

```yaml
# ~/.opc/config.yaml（首次启动自动创建）
ollama:
  base_url: http://localhost:11434
  model: qwen2.5:7b

server:
  port: 3000
  host: 0.0.0.0

brain:
  enabled: true
  auto_extract: true
```

---

## 系统要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| Python | 3.10+ | 3.12+ |
| 内存 | 8 GB | 16 GB+ |
| Ollama | 任意版本 | 最新版 |
| 浏览器 | 任意现代浏览器 | Chrome / Edge |

---

## 与其他产品的关系

```
┌─────────────────────────────────┐
│  Leaper Agent (AI 员工团队)      │
├─────────────────────────────────┤
│  OPC Agent (本地 AI 助手) ← 你在这里
├─────────────────────────────────┤
│  OPC DeepBrain (知识库引擎)      │
└─────────────────────────────────┘
```

- **OPC Agent 内置了 DeepBrain** 作为记忆引擎
- 想要只用知识库？ → [OPC DeepBrain](https://github.com/Deepleaper/opc-deepbrain)
- 想要 AI 员工团队？ → [Leaper Agent](https://github.com/Deepleaper/leaper-agent)

---

## 路线图

- [x] 本地对话 + 流式输出
- [x] 自学习记忆
- [x] Web UI
- [x] 多对话管理
- [x] 智能模型推荐
- [ ] 插件系统
- [ ] RAG 文档问答
- [ ] 多模态（图片、语音）
- [ ] 移动端 PWA

---

## 许可证

[Apache-2.0](LICENSE) — 商用自由。

---

<p align="center">
  <strong><a href="https://github.com/Deepleaper">Deepleaper 跃盟开源</a></strong><br>
  🧠 <a href="https://github.com/Deepleaper/opc-deepbrain">DeepBrain</a> · 🤖 <a href="https://github.com/Deepleaper/opc-agent">OPC Agent</a> · 🚀 <a href="https://github.com/Deepleaper/leaper-agent">Leaper Agent</a>
</p>

<p align="center">⭐ 觉得有用？点个 Star 支持一下！</p>
