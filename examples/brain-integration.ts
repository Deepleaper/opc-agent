/**
 * OPC Agent Example: DeepBrain Memory Integration
 *
 * Shows how to use DeepBrainMemoryStore for persistent agent memory.
 * Requires a running DeepBrain instance (or falls back to InMemory).
 *
 * Run: npx tsx examples/brain-integration.ts
 */

import {
  BaseAgent,
  AgentRuntime,
  InMemoryStore,
  DeepBrainMemoryStore,
} from 'opc-agent';

async function main() {
  console.log('🧠 OPC Agent — DeepBrain Memory Integration\n');

  try {
    const agent = new BaseAgent({
      name: 'brain-agent',
      description: 'Agent with DeepBrain-powered memory',
      version: '1.0.0',
    });

    // Try DeepBrain first, fall back to InMemory
    let memory;
    let memoryType: string;

    try {
      memory = new DeepBrainMemoryStore({
        brainUrl: process.env.DEEPBRAIN_URL || 'http://localhost:3333',
        agentId: 'brain-agent',
      });
      memoryType = 'DeepBrain';
      console.log('✅ Using DeepBrain memory store');
    } catch {
      memory = new InMemoryStore();
      memoryType = 'InMemory';
      console.log('⚠️  DeepBrain unavailable, using InMemory fallback');
    }

    const runtime = new AgentRuntime(agent, { memory });

    console.log(`\n📦 Memory store: ${memoryType}`);
    console.log('\nDeepBrain vs InMemory:');
    console.log('  ┌─────────────────┬────────────┬──────────────┐');
    console.log('  │ Feature         │ InMemory   │ DeepBrain    │');
    console.log('  ├─────────────────┼────────────┼──────────────┤');
    console.log('  │ Persistence     │ ❌ (RAM)   │ ✅ (SQLite)  │');
    console.log('  │ Semantic search │ ❌         │ ✅           │');
    console.log('  │ Evolve          │ ❌         │ ✅           │');
    console.log('  │ Multi-agent     │ ❌         │ ✅           │');
    console.log('  │ Zero config     │ ✅         │ ✅           │');
    console.log('  └─────────────────┴────────────┴──────────────┘\n');

    console.log('✅ Done! To use DeepBrain:');
    console.log('  npm install deepbrain');
    console.log('  deepbrain serve  # starts on :3333');
    console.log('  DEEPBRAIN_URL=http://localhost:3333 npx tsx examples/brain-integration.ts\n');
  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}\n`);
  process.exit(1);
});
