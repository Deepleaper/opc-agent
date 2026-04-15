# SDK 参考

## 核心类

### AgentRuntime — 智能体运行时

```typescript
import { AgentRuntime } from 'opc-agent';

const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');   // 加载 OAD 配置
const agent = await runtime.initialize(); // 初始化智能体
await runtime.start();                    // 启动服务
```

### AnalyticsEngine — 分析引擎

```typescript
import { AnalyticsEngine } from 'opc-agent';

const engine = new AnalyticsEngine('.');
engine.trackMessage('user-1', 250, 100, 50);  // 追踪消息
engine.trackToolUse('search', true, 120);       // 追踪工具调用
const stats = engine.getStats();                // 获取统计数据
```

### RateLimiter — 限流器

```typescript
import { RateLimiter } from 'opc-agent';

const limiter = new RateLimiter({
  userLimit: { maxRequests: 60, windowMs: 60000 },
  providerLimit: { maxRequests: 100, windowMs: 60000 },
});

await limiter.acquire('user-1', 'openai'); // 获取令牌，超限时抛出异常
```

### LLMCache — LLM 响应缓存

```typescript
import { LLMCache } from 'opc-agent';

const cache = new LLMCache({ ttlMs: 3600000 }); // 1 小时过期
const key = LLMCache.makeKey(messages, systemPrompt);
const cached = cache.get(key);
if (!cached) {
  const response = await callLLM(messages);
  cache.set(key, response);
}
```

### KnowledgeBase — 知识库

```typescript
import { KnowledgeBase } from 'opc-agent';

const kb = new KnowledgeBase('./docs');
await kb.addFile('产品手册.pdf');    // 添加文件
await kb.addFile('FAQ.md');
const results = await kb.search('退货政策'); // 语义搜索
```

### Orchestrator — 多智能体编排

```typescript
import { Orchestrator } from 'opc-agent';

const orchestrator = new Orchestrator({
  agents: [triageAgent, salesAgent, supportAgent],
  strategy: 'route-by-intent', // 按意图路由
});

const response = await orchestrator.handle(message);
```

### Testing — 测试工具

```typescript
import { runTests, formatReport } from 'opc-agent';

const report = await runTests('oad.yaml');
console.log(formatReport(report));
```

## 模板列表

| 模板 | 说明 |
|------|------|
| `customer-service` | 客服：FAQ + 人工转接 |
| `sales-assistant` | 销售：产品问答 + 线索捕获 |
| `knowledge-base` | 知识库：RAG 语义检索 |
| `code-reviewer` | 代码审查：Bug 检测 + 风格检查 |
| `hr-recruiter` | HR：简历筛选 + 面试 |
| `project-manager` | 项目管理：任务 + 会议纪要 |
| `content-writer` | 内容创作：博客 + 社媒 + SEO |
| `legal-assistant` | 法务：合同审查 + 合规 |
| `financial-advisor` | 财务：预算 + 支出 |
| `executive-assistant` | 行政：日程 + 邮件 + 会议 |
| `data-analyst` | 数据分析：查询 + 可视化 |
| `teacher` | 教学：课程 + 出题 |
