# 模板

OPC Agent 提供 12 个开箱即用的场景模板，覆盖常见的企业智能体需求。

## 模板列表

| 模板 | 说明 | 适用场景 |
|------|------|---------|
| `customer-service` | 客服智能体 | FAQ 自动回答 + 转人工 |
| `sales-assistant` | 销售助手 | 产品问答 + 线索捕获 + 预约 |
| `knowledge-base` | 知识库问答 | 基于文档的 RAG 语义检索 |
| `code-reviewer` | 代码审查 | Bug 检测 + 代码风格检查 |
| `hr-recruiter` | HR 招聘助手 | 简历筛选 + 面试安排 |
| `project-manager` | 项目管理 | 任务跟踪 + 会议纪要 |
| `content-writer` | 内容创作 | 博客写作 + 社媒运营 + SEO |
| `legal-assistant` | 法务助手 | 合同审查 + 合规检查 |
| `financial-advisor` | 财务顾问 | 预算管理 + 支出分析 |
| `executive-assistant` | 行政助理 | 日程管理 + 邮件处理 |
| `data-analyst` | 数据分析师 | SQL 查询 + 数据可视化 |
| `teacher` | 教学助手 | 课程设计 + 出题 + 互动 |

## 使用模板

```bash
# 创建时指定模板
opc init my-agent --template customer-service

# 或者用简写
opc init my-agent -t sales-assistant
```

## 客服智能体详解

```yaml
# customer-service/oad.yaml
apiVersion: opc/v1
kind: Agent
metadata:
  name: customer-service
  version: 1.0.0
  description: "客服智能体：FAQ 查询 + 人工转接"
spec:
  provider:
    default: deepseek
  model: deepseek-chat
  systemPrompt: |
    你是一个友好、专业的客服助手。
    帮助客户解答产品、订单、物流、退换货等问题。
    回答要简洁、有帮助、有同理心。
  skills:
    - name: faq-lookup
      description: "FAQ 知识库查询"
    - name: human-handoff
      description: "转接人工客服"
  channels:
    - type: web
      port: 3000
```

## 自定义模板

你可以基于现有模板修改，也可以从头创建：

1. 编写 `oad.yaml` 定义智能体
2. 继承 `BaseSkill` 实现自定义技能
3. 将 `oad.yaml` + `README.md` 打包成一个目录

```typescript
import { BaseSkill } from 'opc-agent';
import type { AgentContext, Message, SkillResult } from 'opc-agent';

export class MySkill extends BaseSkill {
  name = 'my-skill';
  description = '我的自定义技能';

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    // 你的技能逻辑
    if (message.content.includes('关键词')) {
      return this.match('这是我的回答', 0.9);
    }
    return this.noMatch();
  }
}
```
