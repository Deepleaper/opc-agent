/**
 * Customer Service Agent — Entry Point
 * 客服 Agent 入口文件
 *
 * Demonstrates: Agent init, DeepBrain memory, skills, tools, workflows, plugins
 */
import { Agent, getBuiltinTools, WorkflowBuilder } from 'opc-agent';
import { loggerPlugin, rateLimiterPlugin } from 'opc-agent';
import { Brain } from 'deepbrain';

// === 1. DeepBrain 记忆初始化 / Initialize Memory ===
const brain = new Brain({
  database: './data/customer-brain.db',
  embedding_provider: 'ollama',
});
await brain.connect();

// === 2. 内置工具 / Built-in Tools ===
const tools = getBuiltinTools('./workspace');

// === 3. 创建 Agent / Create Agent ===
const agent = new Agent('./agent.yaml', {
  tools,
  plugins: [
    loggerPlugin({ level: 'info', output: './logs/agent.log' }),
    rateLimiterPlugin({ maxRequests: 60, windowMs: 60000 }),
  ],
});

// === 4. 记忆钩子 / Memory Hooks ===
agent.on('message', async (msg, response) => {
  // 存储对话用于语义搜索 / Store conversations for semantic search
  await brain.put(
    `conv-${msg.id}`,
    `Q: ${msg.content}\nA: ${response.content}`
  );
});

agent.on('beforeReply', async (ctx) => {
  // 搜索相关历史对话 / Search relevant past conversations
  const relevant = await brain.query(ctx.message, { limit: 3 });
  if (relevant.length > 0) {
    ctx.additionalContext = relevant.map((r: { content: string }) => r.content).join('\n');
  }
});

// === 5. 工作流 / Workflow: Customer Onboarding ===
const onboarding = new WorkflowBuilder()
  .start('greet')
  .addAction('greet', async (_ctx) => {
    return '欢迎！请问您是新客户还是老客户？';
  }, { next: 'check-type' })
  .addCondition('check-type',
    (ctx) => ctx.variables.get('isNewCustomer'),
    'new-flow', 'existing-flow')
  .addAction('new-flow', async (_ctx) => {
    return '让我帮您注册账号。请提供您的邮箱地址。';
  }, { next: 'done' })
  .addAction('existing-flow', async (_ctx) => {
    return '欢迎回来！有什么可以帮您？';
  }, { next: 'done' })
  .addAction('done', async () => 'Onboarding complete')
  .build();

agent.registerWorkflow('onboarding', onboarding);

// === 6. 启动 / Start ===
await agent.start();
console.log('🚀 Customer Service Agent is running!');
