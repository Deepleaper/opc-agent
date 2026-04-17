/**
 * OPC Agent Example: Basic Agent
 *
 * Create a simple agent with OAD config, register a skill, handle a message.
 *
 * Run: npx tsx examples/basic-agent.ts
 */

import {
  BaseAgent,
  AgentRuntime,
  BaseSkill,
  InMemoryStore,
  type Message,
  type AgentContext,
  type SkillResult,
} from 'opc-agent';

// Define a custom skill
class GreeterSkill extends BaseSkill {
  name = 'greeter';
  description = 'Responds to greetings';

  canHandle(message: Message): boolean {
    const text = message.content.toLowerCase();
    return text.includes('hello') || text.includes('hi') || text.includes('hey');
  }

  async execute(message: Message, context: AgentContext): Promise<SkillResult> {
    return {
      content: `Hello! I'm ${context.agent?.name || 'Agent'}. How can I help you today?`,
      confidence: 1.0,
    };
  }
}

async function main() {
  console.log('🤖 OPC Agent — Basic Agent Demo\n');

  try {
    // Create agent with OAD-style config
    const agent = new BaseAgent({
      name: 'demo-agent',
      description: 'A simple demo agent',
      version: '1.0.0',
    });

    // Set up memory store
    const memory = new InMemoryStore();

    // Create runtime
    const runtime = new AgentRuntime(agent, {
      memory,
    });

    // Register skill
    const greeter = new GreeterSkill();
    runtime.registerSkill(greeter);

    console.log(`✅ Agent "${agent.name}" created with ${1} skill\n`);

    // Simulate messages
    const testMessages: Message[] = [
      { role: 'user', content: 'Hello there!' },
      { role: 'user', content: 'What can you do?' },
      { role: 'user', content: 'Hey, nice to meet you' },
    ];

    for (const msg of testMessages) {
      console.log(`📨 User: ${msg.content}`);
      const response = await runtime.handleMessage(msg);
      console.log(`🤖 Agent: ${response?.content || '(no response)'}\n`);
    }

    console.log('✅ Done! OPC Agent supports:');
    console.log('  • OAD config (YAML/JSON agent definition)');
    console.log('  • Skill registration & routing');
    console.log('  • Multi-channel (Web, Telegram, Slack, etc.)');
    console.log('  • Memory stores (InMemory, DeepBrain)\n');
    console.log('Next: npx tsx examples/multi-channel.ts');
  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}\n`);
  process.exit(1);
});
