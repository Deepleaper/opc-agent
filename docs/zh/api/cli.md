# CLI 命令参考

## 完整命令列表

| 命令 | 说明 |
|------|------|
| `opc init [name]` | 创建新智能体项目（交互式） |
| `opc create <name>` | 从模板快速创建 |
| `opc run` | 启动智能体（Web 服务） |
| `opc chat` | 命令行交互对话 |
| `opc test` | 运行测试用例 |
| `opc analytics` | 查看使用分析 |
| `opc info` | 查看智能体信息 |
| `opc build` | 校验 OAD 配置 |
| `opc dev` | 热重载开发模式 |
| `opc deploy` | 部署智能体 |
| `opc publish` | 发布到市场 |
| `opc install <source>` | 从包安装智能体 |
| `opc search <query>` | 搜索 OPC 市场 |
| `opc stats` | 查看运行时统计 |
| `opc kb add <file>` | 添加知识库文件 |
| `opc kb search <query>` | 搜索知识库 |
| `opc tool list` | 列出 MCP 工具 |
| `opc workflow run <name>` | 运行工作流 |
| `opc version-mgmt list` | 列出保存的版本 |

## 通用选项

- `-f, --file <file>` — OAD 文件路径（默认：`oad.yaml`）
- `-t, --template <name>` — 模板名称
- `-p, --port <port>` — 端口覆盖
- `--json` — JSON 格式输出（用于 test/analytics）

## 常用示例

```bash
# 用模板创建项目
opc init my-bot -t teacher

# 运行测试，输出 JSON
opc test --json

# 查看分析数据
opc analytics

# 部署到 OpenClaw
opc deploy --target openclaw --install

# 添加文件到知识库
opc kb add ./docs/product-manual.pdf

# 搜索知识库
opc kb search "退货政策"
```
