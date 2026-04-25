# SDK 参考

## 概述

OPC Agent SDK 允许你在 Node.js/TypeScript 应用中以编程方式嵌入智能体。

```bash
npm install opc-agent
```

## 快速开始

```typescript
import { createAgent, loadOAD } from 'opc-agent';

const oad = await loadOAD('./oad.yaml');
const agent = await createAgent(oad);

const response = await agent.chat('你好，有什么可以帮你的？');
console.log(response.text);

await agent.shutdown();
```

## 核心 API

### `loadOAD(path)`

加载并验证 OAD 文件。

```typescript
const oad = await loadOAD('./oad.yaml');
```

### `createAgent(oad, options?)`

从 OAD 定义创建智能体实例。

```typescript
const agent = await createAgent(oad, {
  dataDir: './data',
  logLevel: 'info',
});
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `dataDir` | `string` | `./data` | 运行时数据目录 |
| `logLevel` | `string` | `info` | 日志级别 |
| `autoLearn` | `boolean` | `true` | 启用自动学习 |

### `agent.chat(message, context?)`

发送消息并获取回应。

```typescript
const response = await agent.chat('退款政策是什么？', {
  userId: 'user-123',
  channel: 'api',
});

console.log(response.text);     // 回应文本
console.log(response.skills);   // 调用的技能
console.log(response.tokens);   // Token 使用量
console.log(response.latency);  // 响应时间（ms）
```

### `agent.stream(message, context?)`

流式回应。

```typescript
const stream = agent.stream('介绍一下你们的产品');

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### `agent.runWorkflow(name, input?)`

执行工作流。

```typescript
const result = await agent.runWorkflow('onboarding', {
  customerName: 'Alice',
  plan: 'enterprise',
});
```

### `agent.brain`

访问自进化大脑。

```typescript
await agent.brain.learn('客户偏好邮件沟通');
const memories = await agent.brain.recall('客户沟通偏好');
await agent.brain.evolve();
```

### `agent.kb`

访问知识库。

```typescript
await agent.kb.add('./docs/faq.md', { tags: ['faq'] });
const results = await agent.kb.search('退款政策');
const stats = await agent.kb.stats();
```

### `agent.shutdown()`

优雅关闭智能体。

## 技能 API

### `defineSkill(config)`

定义自定义技能。

```typescript
import { defineSkill } from 'opc-agent';

export default defineSkill({
  name: 'weather',
  description: '获取指定位置的天气',
  parameters: {
    location: {
      type: 'string',
      description: '城市名称或坐标',
      required: true,
    },
  },
  async execute({ location }, context) {
    const data = await fetchWeather(location);
    return { text: `${location} 当前温度 ${data.temp}°`, data };
  },
});
```

## 事件

```typescript
agent.on('message', (msg) => {
  console.log(`[${msg.channel}] ${msg.userId}: ${msg.text}`);
});

agent.on('skill:called', (event) => {
  console.log(`技能 ${event.name} 被调用`);
});

agent.on('error', (err) => {
  console.error('智能体错误:', err);
});
```

## TypeScript 类型

```typescript
import type {
  OAD, Agent, ChatResponse, StreamChunk,
  SkillDefinition, WorkflowResult, BrainMemory, KBSearchResult,
} from 'opc-agent';
```
