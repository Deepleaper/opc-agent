# 模板

## 内置模板

OPC Agent 附带 12 个生产就绪模板。使用 `opc init` 创建：

```bash
opc init my-agent --role <模板名>
```

列出所有可用模板：

```bash
opc init --list-roles
```

### 模板参考

| 模板 | 角色 | 核心技能 |
|------|------|---------|
| `customer-service` | 客服 | 订单查询、FAQ、升级、情感分析 |
| `sales-assistant` | 销售助手 | CRM 集成、产品推荐、跟进 |
| `knowledge-base` | 知识库助手 | 文档搜索、问答、来源引用 |
| `code-reviewer` | 代码审查 | Git 集成、代码分析、PR 评论 |
| `hr-recruiter` | HR 招聘 | 简历筛选、面试安排、候选人问答 |
| `project-manager` | 项目经理 | 任务跟踪、状态报告、迭代规划 |
| `content-writer` | 内容创作 | 博客文章、社交媒体、SEO 优化 |
| `legal-assistant` | 法律助手 | 合同审查、合规检查、案例研究 |
| `financial-advisor` | 财务顾问 | 投资组合分析、市场数据、风险评估 |
| `executive-assistant` | 行政助理 | 日程管理、邮件起草、会议记录 |
| `data-analyst` | 数据分析 | SQL 查询、图表生成、趋势分析 |
| `teacher` | 教师 | 课程规划、测验生成、自适应学习 |

### 示例：客服

```bash
opc init support-bot --role customer-service
cd support-bot && npm install
opc run
```

### 示例：代码审查

```bash
opc init reviewer --role code-reviewer
cd reviewer && npm install
opc run
```

## Agent 工位角色

除内置模板外，OPC 支持**工位角色** —— 为特定组织职能预配置的智能体：

```bash
opc init --list-roles
```

## OPC Hub 模板

[OPC Hub](https://hub.opc.dev) 托管社区贡献的模板。直接安装：

```bash
opc init my-agent --from hub:acme/sales-template
```

搜索 Hub：

```bash
opc search templates --query "电商"
```

## 创建自己的模板

任何 OPC 智能体项目都可以打包为模板：

```bash
opc pack --output my-template.tgz
opc publish  # 发布到 OPC Hub
```

## 下一步

- [配置](/zh/guide/configuration) — 自定义模板
- [测试](/zh/guide/testing) — 测试智能体
- [部署](/zh/guide/deployment) — 部署到生产环境
