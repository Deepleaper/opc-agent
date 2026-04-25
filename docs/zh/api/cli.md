# CLI 命令

## 概述

```bash
opc <命令> [选项]
```

全局参数：
- `--help`, `-h` — 显示帮助
- `--version`, `-v` — 显示版本
- `--verbose` — 详细输出
- `--quiet`, `-q` — 静默输出

---

## 智能体生命周期

### `opc init`

创建新智能体项目。

```bash
opc init <名称> [选项]
```

| 参数 | 描述 |
|------|------|
| `--role <角色>` | 使用内置模板 |
| `--list-roles` | 列出所有可用模板 |
| `--from <来源>` | 从 Hub、URL 或本地路径使用模板 |
| `--no-install` | 跳过 `npm install` |

### `opc run`

启动智能体运行时，启动所有通道并打开 Studio。

```bash
opc run [选项]
```

| 参数 | 描述 |
|------|------|
| `--port <n>` | 覆盖 Studio 端口（默认：4000） |
| `--no-studio` | 不打开 Studio |
| `--channel <类型>` | 只启动指定通道 |

### `opc dev`

开发模式，支持热重载。

```bash
opc dev [选项]
```

### `opc serve`

仅启动 API 服务器（无 Studio，无通道）。

```bash
opc serve [--port <n>]
```

### `opc build`

构建生产版本。

### `opc test`

运行测试用例。

```bash
opc test [--name <名称>] [--verbose] [--format text|json] [--model <模型>]
```

---

## 对话与 Studio

### `opc chat`

交互式 CLI 对话。

```bash
opc chat [--model <模型>] [--system <提示词>] [--no-history]
```

### `opc studio`

打开 OPC Studio Web UI。

```bash
opc studio [--port <n>]
```

---

## 工具与技能

### `opc tool list`

列出所有可用工具。

### `opc tool add`

添加工具或 MCP 服务器。

```bash
opc tool add web-search --builtin
opc tool add postgres --mcp "@modelcontextprotocol/server-postgres"
```

---

## 工作流

### `opc workflow run`

执行工作流。

```bash
opc workflow run <名称> [--input <json>] [--dry-run]
```

### `opc workflow list`

列出所有已定义的工作流。

---

## 知识库

### `opc kb add`

添加内容到知识库。

```bash
opc kb add <文件或URL> [--tag <标签>] [--recursive]
```

### `opc kb search`

搜索知识库。

```bash
opc kb search "查询内容"
```

### `opc kb stats`

显示知识库统计。

### `opc kb clear`

清空知识库。

```bash
opc kb clear [--confirm]
```

---

## 大脑（自进化）

### `opc brain learn`

教智能体新知识。

```bash
opc brain learn "退款政策允许30天内退货"
opc brain learn --file ./policies.md
```

### `opc brain recall`

查询已学习的知识。

```bash
opc brain recall "退款政策"
```

### `opc brain evolve`

触发知识整合。

```bash
opc brain evolve [--dry-run]
```

---

## 部署与分发

### `opc deploy`

部署智能体。

```bash
opc deploy [--target openclaw|hermes|docker] [--env staging|production]
```

### `opc publish`

发布到 OPC Hub。

```bash
opc publish [--private] [--org <组织>]
```

### `opc pack`

打包为 tarball。

```bash
opc pack [--output <文件>]
```

### `opc install`

从 OPC Hub 安装。

```bash
opc install <名称>
```

### `opc search`

搜索 OPC Hub。

```bash
opc search <查询> [--type agents|templates|skills]
```

---

## 实用工具

### `opc info`

显示智能体信息。

### `opc stats`

显示运行时统计。

### `opc doctor`

检查环境并诊断问题。

### `opc version-mgmt list`

列出智能体版本。

### `opc version-mgmt rollback`

回滚到之前的版本。

```bash
opc version-mgmt rollback <版本>
```

### `opc create`

脚手架命令。

```bash
opc create skill <名称>
opc create workflow <名称>
opc create channel <类型>
```
