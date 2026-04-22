<div align="center">

# ⚡ OPC Agent — 瞬知 Studio

**你的 AI 劳动力，本地运行，零成本启动。**

一台电脑，一行命令，你自己的 AI 员工 — 7×24 学习、进化、工作。

[![npm](https://img.shields.io/npm/v/opc-agent/alpha)](https://www.npmjs.com/package/opc-agent)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[快速开始](#-快速开始) · [功能特性](#-功能特性) · [架构](#-架构) · [命令](#-命令) · [English](README.md)

</div>

---

## 🚀 快速开始

### 一行安装（推荐）

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/Deepleaper/opc-agent/main/install.ps1 | iex
```

自动安装 Node.js、OPC Agent、Ollama，并根据你的硬件推荐 AI 模型。

### 手动安装

```bash
npm install -g opc-agent@alpha
opc setup        # 交互式配置向导
```

### 30 秒上手

```bash
opc chat          # 终端对话
opc studio        # 打开网页管理 → localhost:4000
opc run           # 全部启动：Agent + Telegram + Web + Studio
```

---

## ✨ 功能特性

| 特性 | 说明 |
|------|------|
| 🧠 **自进化** | 四层进化引擎：经验 → 记忆 → 技能 → 群体智慧 |
| 💰 **零成本** | 本地 Ollama 运行，无需 API Key |
| 🎨 **Studio 管理界面** | 网页端管理：模型、渠道、知识库、模板 |
| 📱 **多渠道** | Telegram、Web、微信、飞书、Discord、Slack、Email |
| 🔧 **40 个内置技能** | 文件操作、网页搜索、代码执行、图片生成等 |
| 🤖 **A2A 协议** | Agent 间通信，多 Agent 协作 |
| 📦 **一体化** | DeepBrain（知识）+ AgentKits（模型）+ Workstation（模板）|
| 🔒 **隐私优先** | 数据留在本地，无遥测 |

---

## 🏗 架构

```
┌──────────────────────────────────────────┐
│              OPC Agent CLI               │
│   opc chat · opc studio · opc run       │
├──────────────────────────────────────────┤
│  Agent Loop    │  自进化引擎 (L1-L4)      │
│  上下文组装     │  L1 经验编译             │
│                │  L2 记忆巩固             │
│                │  L3 技能发现             │
│                │  L4 群体进化             │
├──────────────────────────────────────────┤
│  DeepBrain     │ AgentKits  │ Workstation │
│  （知识库）     │ （模型路由） │ （模板库）   │
├──────────────────────────────────────────┤
│  渠道                                    │
│  Telegram │ Web │ 微信 │ 飞书 │ ...       │
└──────────────────────────────────────────┘
```

---

## 💻 命令

| 命令 | 说明 |
|------|------|
| `opc setup` | 交互式配置向导 |
| `opc init [name]` | 创建 Agent 项目 |
| `opc chat` | 终端对话 |
| `opc studio` | 打开 Studio 管理界面 |
| `opc run` | 启动所有服务 |
| `opc brain stats` | 知识库统计 |
| `opc brain recall <query>` | 语义搜索 |
| `opc brain learn <file>` | 导入文档 |
| `opc doctor` | 诊断安装问题 |

---

## 📖 模型支持

### 本地（Ollama）— 零成本
根据 RAM 自动推荐：

| 内存 | 推荐模型 | 大小 |
|------|---------|------|
| ≤3 GB | qwen2.5:0.5b | 400MB |
| ≤7 GB | qwen2.5:1.5b | 1.0GB |
| ≤15 GB | qwen2.5:7b | 4.7GB |
| ≤31 GB | qwen2.5:14b | 9.0GB |
| 32+ GB | qwen2.5:32b | 19GB |

### 云端（通过 AgentKits）
在 Studio → 模型配置中添加：OpenAI、DeepSeek、Anthropic、通义千问、Gemini

---

## 🧬 自进化

OPC Agent 越用越聪明：

- **L1 经验编译**：原始对话 → 结构化洞察（本地 Ollama，零成本）
- **L2 记忆巩固**：洞察 → 精炼知识（云端 AgentKits）
- **L3 技能发现**：模式 → 自动生成技能（云端 AgentKits）
- **L4 群体进化**：个体知识 → 共享智慧（本地 Ollama，零成本）

---

## 📄 License

Apache-2.0 © [Deepleaper](https://github.com/Deepleaper)

---

<div align="center">

**由 [跃盟科技](https://www.deepleaper.com) 构建** — 让 AI 为每个人工作。

⭐ 觉得有用？给个 Star！

</div>
