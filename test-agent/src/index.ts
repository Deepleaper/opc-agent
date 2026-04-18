import { AgentRuntime } from 'opc-agent';
import { EchoSkill } from './skills/echo';

async function main() {
  const runtime = new AgentRuntime();

  // Load OAD config
  await runtime.loadConfig('./agent.yaml');

  // Initialize agent with channels, memory, etc.
  const agent = await runtime.initialize();

  // Register custom skills
  runtime.registerSkill(new EchoSkill());

  // Start serving
  await runtime.start();

  console.log('🤖 Agent is running!');
  console.log('   Web UI: http://localhost:3000');
  console.log('   Press Ctrl+C to stop');
}

main().catch(console.error);
