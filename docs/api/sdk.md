# SDK Reference

## Core Classes

### AgentRuntime

```typescript
import { AgentRuntime } from 'opc-agent';

const runtime = new AgentRuntime();
await runtime.loadConfig('oad.yaml');
const agent = await runtime.initialize();
await runtime.start();
```

### AnalyticsEngine

```typescript
import { AnalyticsEngine } from 'opc-agent';

const engine = new AnalyticsEngine('.');
engine.trackMessage('user-1', 250, 100, 50);
engine.trackToolUse('search', true, 120);
const stats = engine.getStats();
```

### RateLimiter

```typescript
import { RateLimiter } from 'opc-agent';

const limiter = new RateLimiter({
  userLimit: { maxRequests: 60, windowMs: 60000 },
  providerLimit: { maxRequests: 100, windowMs: 60000 },
});

await limiter.acquire('user-1', 'openai');
```

### LLMCache

```typescript
import { LLMCache } from 'opc-agent';

const cache = new LLMCache({ ttlMs: 3600000 });
const key = LLMCache.makeKey(messages, systemPrompt);
const cached = cache.get(key);
if (!cached) {
  const response = await callLLM(messages);
  cache.set(key, response);
}
```

### Testing

```typescript
import { runTests, formatReport } from 'opc-agent';

const report = await runTests('oad.yaml');
console.log(formatReport(report));
```

## Templates

13 built-in templates:

| Template | Description |
|----------|-------------|
| `customer-service` | FAQ + human handoff |
| `sales-assistant` | Product Q&A + lead capture |
| `knowledge-base` | RAG with DeepBrain |
| `code-reviewer` | Bug detection + style checks |
| `hr-recruiter` | Resume screening + interviews |
| `project-manager` | Task tracking + meeting notes |
| `content-writer` | Blog + social media + SEO |
| `legal-assistant` | Contract review + compliance |
| `financial-advisor` | Budget + expense tracking |
| `executive-assistant` | Calendar + email + meetings |
| `data-analyst` | Data querying + visualization |
| `teacher` | Lesson plans + quizzes |
