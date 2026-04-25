# SDK Reference

## Overview

The OPC Agent SDK allows you to embed agents programmatically in your Node.js/TypeScript applications.

```bash
npm install opc-agent
```

## Quick Start

```typescript
import { createAgent, loadOAD } from 'opc-agent';

const oad = await loadOAD('./oad.yaml');
const agent = await createAgent(oad);

const response = await agent.chat('Hello, how can I help?');
console.log(response.text);

await agent.shutdown();
```

## Core API

### `loadOAD(path)`

Load and validate an OAD file.

```typescript
import { loadOAD } from 'opc-agent';

const oad = await loadOAD('./oad.yaml');
// Returns parsed and validated OAD object
```

### `createAgent(oad, options?)`

Create an agent instance from an OAD definition.

```typescript
import { createAgent } from 'opc-agent';

const agent = await createAgent(oad, {
  dataDir: './data',
  logLevel: 'info',
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dataDir` | `string` | `./data` | Runtime data directory |
| `logLevel` | `string` | `info` | Log level |
| `autoLearn` | `boolean` | `true` | Enable auto-learning |

### `agent.chat(message, context?)`

Send a message and get a response.

```typescript
const response = await agent.chat('What is your return policy?', {
  userId: 'user-123',
  channel: 'api',
  metadata: { source: 'website' },
});

console.log(response.text);          // Response text
console.log(response.skills);        // Skills invoked
console.log(response.tokens);        // Token usage
console.log(response.latency);       // Response time (ms)
```

### `agent.stream(message, context?)`

Stream a response.

```typescript
const stream = agent.stream('Tell me about your products');

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### `agent.runWorkflow(name, input?)`

Execute a named workflow.

```typescript
const result = await agent.runWorkflow('onboarding', {
  customerName: 'Alice',
  plan: 'enterprise',
});

console.log(result.steps);     // Step results
console.log(result.output);    // Final output
```

### `agent.brain`

Access the self-evolution brain.

```typescript
// Learn
await agent.brain.learn('Customer prefers email');

// Recall
const memories = await agent.brain.recall('customer preferences');

// Evolve
await agent.brain.evolve();
```

### `agent.kb`

Access the knowledge base.

```typescript
// Add content
await agent.kb.add('./docs/faq.md', { tags: ['faq'] });
await agent.kb.addText('Returns accepted within 30 days', { tags: ['policy'] });

// Search
const results = await agent.kb.search('return policy');

// Stats
const stats = await agent.kb.stats();
```

### `agent.shutdown()`

Gracefully shut down the agent.

```typescript
await agent.shutdown();
```

## Skills API

### `defineSkill(config)`

Define a custom skill.

```typescript
import { defineSkill } from 'opc-agent';

export default defineSkill({
  name: 'weather',
  description: 'Get weather for a location',
  parameters: {
    location: {
      type: 'string',
      description: 'City name or coordinates',
      required: true,
    },
    unit: {
      type: 'string',
      enum: ['celsius', 'fahrenheit'],
      default: 'celsius',
    },
  },
  async execute({ location, unit }, context) {
    // context.agent — access to parent agent
    // context.userId — current user
    // context.channel — current channel
    const data = await fetchWeather(location, unit);
    return {
      text: `It's ${data.temp}° in ${location}`,
      data,
    };
  },
});
```

## Events

```typescript
agent.on('message', (msg) => {
  console.log(`[${msg.channel}] ${msg.userId}: ${msg.text}`);
});

agent.on('skill:called', (event) => {
  console.log(`Skill ${event.name} called with`, event.input);
});

agent.on('workflow:complete', (event) => {
  console.log(`Workflow ${event.name} completed in ${event.duration}ms`);
});

agent.on('brain:learned', (event) => {
  console.log(`Learned: ${event.summary}`);
});

agent.on('error', (err) => {
  console.error('Agent error:', err);
});
```

## TypeScript Types

```typescript
import type {
  OAD,
  Agent,
  ChatResponse,
  StreamChunk,
  SkillDefinition,
  WorkflowResult,
  BrainMemory,
  KBSearchResult,
} from 'opc-agent';
```
