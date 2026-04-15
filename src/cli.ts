#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as readline from 'readline';
import { AgentRuntime } from './core/runtime';
import { createCustomerServiceConfig } from './templates/customer-service';
import { createSalesAssistantConfig } from './templates/sales-assistant';
import { createKnowledgeBaseConfig } from './templates/knowledge-base';
import { createCodeReviewerConfig } from './templates/code-reviewer';
import { createHRRecruiterConfig } from './templates/hr-recruiter';
import { createProjectManagerConfig } from './templates/project-manager';
import { createContentWriterConfig } from './templates/content-writer';
import { createLegalAssistantConfig } from './templates/legal-assistant';
import { createFinancialAdvisorConfig } from './templates/financial-advisor';
import { createExecutiveAssistantConfig } from './templates/executive-assistant';
import { FAQSkill, HandoffSkill } from './templates/customer-service';
import { Analytics } from './analytics';
import { WorkflowEngine } from './core/workflow';
import { VersionManager } from './core/versioning';

const program = new Command();

const color = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const icon = {
  success: color.green('✔'),
  error: color.red('✘'),
  warn: color.yellow('⚠'),
  info: color.blue('ℹ'),
  rocket: '🚀',
  package: '📦',
  search: '🔍',
  gear: '⚙️',
  file: '📄',
};

const TEMPLATES: Record<string, { label: string; factory: () => any }> = {
  'customer-service': { label: 'Customer Service - FAQ + human handoff', factory: createCustomerServiceConfig },
  'sales-assistant': { label: 'Sales Assistant - product Q&A + lead capture', factory: createSalesAssistantConfig },
  'knowledge-base': { label: 'Knowledge Base - RAG with DeepBrain', factory: createKnowledgeBaseConfig },
  'code-reviewer': { label: 'Code Reviewer - bug detection + style checks', factory: createCodeReviewerConfig },
  'hr-recruiter': { label: 'HR Recruiter - resume screening + interview scheduling', factory: createHRRecruiterConfig },
  'project-manager': { label: 'Project Manager - task tracking + meeting notes', factory: createProjectManagerConfig },
  'content-writer': { label: 'Content Writer - blog posts + social media + SEO', factory: createContentWriterConfig },
  'legal-assistant': { label: 'Legal Assistant - contract review + compliance + legal research', factory: createLegalAssistantConfig },
  'financial-advisor': { label: 'Financial Advisor - budget analysis + expense tracking + planning', factory: createFinancialAdvisorConfig },
  'executive-assistant': { label: 'Executive Assistant - calendar + email drafting + meeting prep', factory: createExecutiveAssistantConfig },
};

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` ${color.dim(`(${defaultValue})`)}` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function select(question: string, options: { value: string; label: string }[]): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    console.log(`  ${color.cyan(`${i + 1})`)} ${opt.label}`);
  });
  const answer = await prompt(`\nChoose ${color.dim('(1-' + options.length + ')')}`, '1');
  const idx = parseInt(answer) - 1;
  return options[Math.max(0, Math.min(idx, options.length - 1))].value;
}

program
  .name('opc')
  .description('OPC Agent - Open Agent Framework for business workstations')
  .version('0.4.0');

program
  .command('init')
  .description('Initialize a new OPC agent project (interactive)')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .action(async (nameArg: string | undefined, opts: { template?: string; yes?: boolean }) => {
    console.log(`\n${icon.rocket} ${color.bold('OPC Agent - Create New Project')}\n`);

    const name = opts.yes ? (nameArg ?? 'my-agent') : (nameArg ?? await prompt('Project name', 'my-agent'));
    const template = opts.yes
      ? (opts.template ?? 'customer-service')
      : (opts.template ?? await select('Select a template:', Object.entries(TEMPLATES).map(([value, { label }]) => ({ value, label }))));

    const dir = path.resolve(name);
    if (fs.existsSync(dir)) {
      console.error(`\n${icon.error} Directory ${color.bold(name)} already exists.`);
      process.exit(1);
    }

    fs.mkdirSync(dir, { recursive: true });
    const factory = TEMPLATES[template]?.factory ?? createCustomerServiceConfig;
    const config = factory();
    config.metadata.name = name;

    fs.writeFileSync(path.join(dir, 'oad.yaml'), yaml.dump(config, { lineWidth: 120 }));
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${name}\n\nCreated with OPC Agent using the \`${template}\` template.\n\n## Run\n\n\`\`\`bash\nopc run\n\`\`\`\n`,
    );

    console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')}`);
    console.log(`   ${icon.file} oad.yaml - Agent definition`);
    console.log(`   ${icon.file} README.md`);
    console.log(`\n   Template: ${color.cyan(template)}`);
    console.log(`\n${color.dim('Next:')} cd ${name} && opc run\n`);
  });

program
  .command('create')
  .description('Create an agent from a template')
  .argument('<name>', 'Agent name')
  .option('-t, --template <template>', 'Template', 'customer-service')
  .action(async (name: string, opts: { template: string }) => {
    const factory = TEMPLATES[opts.template]?.factory ?? createCustomerServiceConfig;
    const config = factory();
    config.metadata.name = name;
    const outFile = `${name}-oad.yaml`;
    fs.writeFileSync(outFile, yaml.dump(config, { lineWidth: 120 }));
    console.log(`${icon.success} Created ${color.bold(outFile)}`);
  });

program
  .command('info')
  .description('Show agent info from OAD')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    try {
      const runtime = new AgentRuntime();
      const config = await runtime.loadConfig(opts.file);
      const m = config.metadata;
      const s = config.spec;

      console.log(`\n${icon.gear} ${color.bold('Agent Info')}\n`);
      console.log(`  Name:        ${color.cyan(m.name)}`);
      console.log(`  Version:     ${m.version}`);
      console.log(`  Description: ${m.description ?? color.dim('(none)')}`);
      console.log(`  Author:      ${m.author ?? color.dim('(none)')}`);
      console.log(`  License:     ${m.license}`);
      console.log(`  Model:       ${s.model}`);
      console.log(`  Provider:    ${s.provider?.default ?? 'deepseek'}`);
      console.log(`  Channels:    ${s.channels.map(c => c.type).join(', ') || color.dim('(none)')}`);
      console.log(`  Skills:      ${s.skills.map(sk => sk.name).join(', ') || color.dim('(none)')}`);
      console.log(`  Trust:       ${s.dtv?.trust?.level ?? 'sandbox'}`);
      console.log(`  Streaming:   ${s.streaming ? 'enabled' : 'disabled'}`);
      console.log(`  Locale:      ${s.locale ?? 'en'}`);
      if (s.room) {
        console.log(`  Room:        ${s.room.name}`);
      }
      if (m.marketplace) {
        console.log(`  Category:    ${m.marketplace.category ?? color.dim('(none)')}`);
        console.log(`  Pricing:     ${m.marketplace.pricing ?? 'free'}`);
      }
      console.log();
    } catch (err) {
      console.error(`${icon.error} Failed to read OAD:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Validate OAD and compile')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    try {
      const runtime = new AgentRuntime();
      const config = await runtime.loadConfig(opts.file);
      console.log(`${icon.success} Valid OAD: ${color.bold(config.metadata.name)} v${config.metadata.version}`);
    } catch (err) {
      console.error(`${icon.error} Invalid OAD:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Run agent in sandbox mode')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    console.log(`\n${icon.gear} Running agent in sandbox mode...`);
    const runtime = new AgentRuntime();
    await runtime.loadConfig(opts.file);
    const agent = await runtime.initialize();
    runtime.registerSkill(new FAQSkill());
    runtime.registerSkill(new HandoffSkill());
    console.log(`${icon.success} Agent "${color.bold(agent.name)}" initialized in sandbox.`);
    console.log(`   State: ${agent.state}`);
    console.log(`   Sending test message...`);

    const response = await agent.handleMessage({
      id: 'test_1',
      role: 'user',
      content: 'What are your business hours?',
      timestamp: Date.now(),
    });
    console.log(`   Response: ${response.content}`);
    console.log(`${icon.success} Sandbox test passed.\n`);
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
    console.log(`\n${icon.rocket} Agent "${color.bold(agent?.name ?? 'unknown')}" is running.\n`);
  });

program
  .command('dev')
  .description('Hot-reload development mode')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    console.log(`\n${icon.gear} ${color.bold('Development mode')} - watching for changes...\n`);

    let runtime: AgentRuntime | null = null;

    const startAgent = async () => {
      try {
        if (runtime) await runtime.stop();
        runtime = new AgentRuntime();
        await runtime.loadConfig(opts.file);
        await runtime.initialize();
        runtime.registerSkill(new FAQSkill());
        runtime.registerSkill(new HandoffSkill());
        await runtime.start();
        const agent = runtime.getAgent();
        console.log(`${icon.success} Agent "${color.bold(agent?.name ?? 'unknown')}" restarted.`);
      } catch (err) {
        console.error(`${icon.error} Failed to start:`, err instanceof Error ? err.message : err);
      }
    };

    await startAgent();

    const watchPaths = [opts.file, 'src'];
    for (const watchPath of watchPaths) {
      if (fs.existsSync(watchPath)) {
        const isDir = fs.statSync(watchPath).isDirectory();
        fs.watch(watchPath, { recursive: isDir }, async (_event, filename) => {
          console.log(`\n${icon.info} ${color.dim(`Change detected: ${filename}`)} - restarting...`);
          await startAgent();
        });
      }
    }

    process.on('SIGINT', async () => {
      console.log(`\n${color.dim('Shutting down dev mode...')}`);
      if (runtime) await runtime.stop();
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

      console.log(`\n${icon.package} Publishing: ${color.bold(config.metadata.name)} v${config.metadata.version}`);
      console.log(`   ${icon.success} OAD validation passed`);
      console.log(`   🔐 Trust level: ${trust}`);

      if (trust === 'sandbox') {
        console.log(`   ${icon.warn} Trust level is 'sandbox'. Upgrade for marketplace listing.`);
      }

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
      console.log(`   ${icon.file} Generated opc-manifest.json`);
      console.log(`\n🚧 OPC Registry is coming soon. Manifest saved locally.\n`);
    } catch (err) {
      console.error(`${icon.error} Publish failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search OPC Registry for agents and skills')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    console.log(`\n${icon.search} Searching OPC Registry for "${color.bold(query)}"...`);
    console.log(`\n🚧 OPC Registry coming soon!`);
    console.log(`   The marketplace is under development.`);
    console.log(`   Browse templates with: ${color.cyan('opc init --template <name>')}`);
    console.log(`\n   Available templates: ${Object.keys(TEMPLATES).map(t => color.cyan(t)).join(', ')}\n`);
  });

// ── Tool commands ────────────────────────────────────────────

const toolCmd = program.command('tool').description('Manage MCP tools');

toolCmd
  .command('list')
  .description('List available MCP tools')
  .action(() => {
    console.log(`\n${icon.gear} ${color.bold('MCP Tools')}\n`);
    console.log(`  ${color.dim('No tools installed yet.')}`);
    console.log(`\n  Add tools with: ${color.cyan('opc tool add <name>')}\n`);
  });

toolCmd
  .command('add')
  .description('Add an MCP tool from registry')
  .argument('<name>', 'Tool name')
  .action((name: string) => {
    console.log(`\n🚧 Tool registry coming soon!`);
    console.log(`   Would add tool: ${color.cyan(name)}\n`);
  });

// ── Plugin commands ──────────────────────────────────────────

const pluginCmd = program.command('plugin').description('Manage plugins');

pluginCmd
  .command('list')
  .description('List installed plugins')
  .action(() => {
    console.log(`\n${icon.gear} ${color.bold('Installed Plugins')}\n`);
    console.log(`  ${color.dim('No plugins installed yet.')}`);
    console.log(`\n  Add plugins with: ${color.cyan('opc plugin add <name>')}\n`);
  });

pluginCmd
  .command('add')
  .description('Add a plugin')
  .argument('<name>', 'Plugin name')
  .action((name: string) => {
    console.log(`\n🚧 Plugin registry coming soon!`);
    console.log(`   Would add plugin: ${color.cyan(name)}\n`);
  });

// ── Stats command ────────────────────────────────────────────

program
  .command('stats')
  .description('Show agent analytics')
  .action(() => {
    const analytics = new Analytics();
    // Show demo stats
    const snap = analytics.getSnapshot();
    console.log(`\n${icon.gear} ${color.bold('Agent Analytics')}\n`);
    console.log(`  Messages Processed: ${snap.messagesProcessed}`);
    console.log(`  Avg Response Time:  ${snap.avgResponseTimeMs}ms`);
    console.log(`  Error Count:        ${snap.errorCount}`);
    console.log(`  Token Usage:        ${snap.tokenUsage.total} (in: ${snap.tokenUsage.input}, out: ${snap.tokenUsage.output})`);
    console.log(`  Uptime:             ${Math.round(snap.uptime / 1000)}s`);
    console.log(`\n  ${color.dim('Run an agent to collect analytics data.')}\n`);
  });

// 🔄 Workflow commands ────────────────────────────────────────

const workflowCmd = program.command('workflow').description('Manage workflows');

workflowCmd
  .command('run')
  .description('Run a workflow defined in OAD')
  .argument('<name>', 'Workflow name')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (name: string, opts: { file: string }) => {
    console.log(`\n${icon.gear} Running workflow "${color.bold(name)}"...`);
    const runtime = new AgentRuntime();
    const config = await runtime.loadConfig(opts.file);
    const workflows = config.spec.workflows ?? [];
    const wfDef = workflows.find((w: any) => w.name === name);
    if (!wfDef) {
      console.error(`${icon.error} Workflow "${name}" not found in OAD.`);
      process.exit(1);
    }
    const engine = new WorkflowEngine();
    engine.registerWorkflow(wfDef as any);
    console.log(`${icon.success} Workflow "${name}" loaded with ${(wfDef as any).steps?.length ?? 0} steps.`);
    console.log(`${color.dim('   Workflow execution requires a running agent context.')}\n`);
  });

workflowCmd
  .command('list')
  .description('List workflows in OAD')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    const runtime = new AgentRuntime();
    const config = await runtime.loadConfig(opts.file);
    const workflows = config.spec.workflows ?? [];
    console.log(`\n${icon.gear} ${color.bold('Workflows')}\n`);
    if (workflows.length === 0) {
      console.log(`  ${color.dim('No workflows defined.')}\n`);
    } else {
      for (const wf of workflows) {
        console.log(`  ${color.cyan((wf as any).name)} - ${(wf as any).description ?? color.dim('(no description)')}`);
      }
      console.log();
    }
  });

// 📦 Version commands ─────────────────────────────────────────

const versionCmd = program.command('version').description('Manage agent versions');

versionCmd
  .command('list')
  .description('List saved versions')
  .action(() => {
    const vm = new VersionManager();
    const versions = vm.list();
    console.log(`\n${icon.gear} ${color.bold('Agent Versions')}\n`);
    if (versions.length === 0) {
      console.log(`  ${color.dim('No versions saved.')}\n`);
    } else {
      for (const v of versions) {
        console.log(`  ${color.cyan(v.version)} - ${new Date(v.timestamp).toISOString()} ${v.description ?? ''}`);
      }
      console.log();
    }
  });

versionCmd
  .command('rollback')
  .description('Rollback to a saved version')
  .argument('<version>', 'Version to rollback to')
  .action((version: string) => {
    const vm = new VersionManager();
    const oad = vm.rollback(version);
    if (!oad) {
      console.error(`${icon.error} Version "${version}" not found.`);
      process.exit(1);
    }
    fs.writeFileSync('oad.yaml', oad);
    console.log(`${icon.success} Rolled back to version ${color.bold(version)}.`);
  });

program.parse();
