#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AgentRuntime } from './core/runtime';
import { createCustomerServiceConfig } from './templates/customer-service';
import { FAQSkill, HandoffSkill } from './templates/customer-service';

const program = new Command();

program
  .name('opc')
  .description('OPC Agent — Open Agent Framework for business workstations')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new OPC agent project')
  .argument('[name]', 'Project name', 'my-agent')
  .option('-t, --template <template>', 'Template to use', 'customer-service')
  .action(async (name: string, opts: { template: string }) => {
    const dir = path.resolve(name);
    if (fs.existsSync(dir)) {
      console.error(`Directory ${name} already exists.`);
      process.exit(1);
    }

    fs.mkdirSync(dir, { recursive: true });

    const config = createCustomerServiceConfig();
    config.metadata.name = name;

    fs.writeFileSync(
      path.join(dir, 'oad.yaml'),
      yaml.dump(config, { lineWidth: 120 }),
    );

    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${name}\n\nCreated with OPC Agent.\n\n## Run\n\n\`\`\`bash\nopc run\n\`\`\`\n`,
    );

    console.log(`✅ Created agent project: ${name}/`);
    console.log(`   📄 oad.yaml — Agent definition`);
    console.log(`   📖 README.md`);
    console.log(`\nNext: cd ${name} && opc run`);
  });

program
  .command('create')
  .description('Create an agent from a template')
  .argument('<name>', 'Agent name')
  .option('-t, --template <template>', 'Template', 'customer-service')
  .action(async (name: string) => {
    const config = createCustomerServiceConfig();
    config.metadata.name = name;
    const outFile = `${name}-oad.yaml`;
    fs.writeFileSync(outFile, yaml.dump(config, { lineWidth: 120 }));
    console.log(`✅ Created ${outFile}`);
  });

program
  .command('build')
  .description('Validate OAD and compile')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    try {
      const runtime = new AgentRuntime();
      const config = await runtime.loadConfig(opts.file);
      console.log(`✅ Valid OAD: ${config.metadata.name} v${config.metadata.version}`);
    } catch (err) {
      console.error('❌ Invalid OAD:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run agent in sandbox mode')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    console.log('🧪 Running agent in sandbox mode...');
    const runtime = new AgentRuntime();
    await runtime.loadConfig(opts.file);
    const agent = await runtime.initialize();
    runtime.registerSkill(new FAQSkill());
    runtime.registerSkill(new HandoffSkill());
    console.log(`✅ Agent "${agent.name}" initialized in sandbox.`);
    console.log(`   State: ${agent.state}`);
    console.log(`   Send test message...`);

    const response = await agent.handleMessage({
      id: 'test_1',
      role: 'user',
      content: 'What are your business hours?',
      timestamp: Date.now(),
    });
    console.log(`   Response: ${response.content}`);
    console.log('✅ Sandbox test passed.');
  });

program
  .command('run')
  .description('Start agent with channels')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    const runtime = new AgentRuntime();
    await runtime.loadConfig(opts.file);
    await runtime.initialize();
    runtime.registerSkill(new FAQSkill());
    runtime.registerSkill(new HandoffSkill());
    await runtime.start();
    const agent = runtime.getAgent();
    console.log(`🚀 Agent "${agent?.name}" is running.`);

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await runtime.stop();
      process.exit(0);
    });
  });

program
  .command('publish')
  .description('Validate and package for OPC Registry')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    try {
      const runtime = new AgentRuntime();
      const config = await runtime.loadConfig(opts.file);
      const trust = config.spec.dtv?.trust?.level ?? 'sandbox';

      console.log(`\n📦 Publishing: ${config.metadata.name} v${config.metadata.version}`);
      console.log(`   ✅ OAD validation passed`);
      console.log(`   🔐 Trust level: ${trust}`);

      if (trust === 'sandbox') {
        console.log(`   ⚠️  Trust level is 'sandbox'. Upgrade to 'verified' or higher for marketplace listing.`);
      }

      // Generate manifest
      const manifest = {
        name: config.metadata.name,
        version: config.metadata.version,
        description: config.metadata.description,
        author: config.metadata.author,
        license: config.metadata.license,
        trust,
        category: config.metadata.marketplace?.category,
        pricing: config.metadata.marketplace?.pricing ?? 'free',
        tags: config.metadata.marketplace?.tags ?? [],
        channels: config.spec.channels.map(c => c.type),
        skills: config.spec.skills.map(s => s.name),
        publishedAt: new Date().toISOString(),
      };

      fs.writeFileSync('opc-manifest.json', JSON.stringify(manifest, null, 2));
      console.log(`   📄 Generated opc-manifest.json`);
      console.log(`\n🚧 OPC Registry is coming soon. Manifest saved locally.`);
    } catch (err) {
      console.error('❌ Publish failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search OPC Registry for agents and skills')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    console.log(`\n🔍 Searching OPC Registry for "${query}"...`);
    console.log(`\n🚧 OPC Registry coming soon!`);
    console.log(`   The marketplace is under development.`);
    console.log(`   In the meantime, browse templates with: opc init --template <name>`);
    console.log(`\n   Available templates: customer-service, sales-assistant, knowledge-base, code-reviewer`);
  });

program.parse();
