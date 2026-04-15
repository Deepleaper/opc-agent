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
import { createDataAnalystConfig } from './templates/data-analyst';
import { createTeacherConfig } from './templates/teacher';
import { FAQSkill, HandoffSkill } from './templates/customer-service';
import { Analytics } from './analytics';
import { AnalyticsEngine } from './core/analytics-engine';
import { runTests, formatReport } from './testing';
import { deployToOpenClaw } from './deploy/openclaw';
import { deployToHermes } from './deploy/hermes';
import { WorkflowEngine } from './core/workflow';
import { VersionManager } from './core/versioning';
import { createProvider } from './providers';
import { KnowledgeBase } from './core/knowledge';
import { publishAgent, installAgent } from './marketplace';

import { PluginManager, createLoggingPlugin, createAnalyticsPlugin, createRateLimitPlugin } from './plugins';

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
  'data-analyst': { label: 'Data Analyst - data querying + visualization + insights', factory: createDataAnalystConfig },
  'teacher': { label: 'Teacher - lesson planning + quizzes + concept explanation', factory: createTeacherConfig },
};

async function promptUser(question: string, defaultValue?: string): Promise<string> {
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
  const answer = await promptUser(`\nChoose ${color.dim('(1-' + options.length + ')')}`, '1');
  const idx = parseInt(answer) - 1;
  return options[Math.max(0, Math.min(idx, options.length - 1))].value;
}

program
  .name('opc')
  .description('OPC Agent - Open Agent Framework for business workstations')
  .version('1.0.0');

// ── Init command ─────────────────────────────────────────────

program
  .command('init')
  .description('Initialize a new OPC agent project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .action(async (nameArg: string | undefined, opts: { template?: string; yes?: boolean }) => {
    console.log(`\n${icon.rocket} ${color.bold('OPC Agent - Create New Project')}\n`);

    const name = opts.yes ? (nameArg ?? 'my-agent') : (nameArg ?? await promptUser('Project name', 'my-agent'));
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

    // Ensure web channel exists
    if (!config.spec.channels.some((c: any) => c.type === 'web')) {
      config.spec.channels.push({ type: 'web', port: 3000 });
    }

    fs.writeFileSync(path.join(dir, 'oad.yaml'), yaml.dump(config, { lineWidth: 120 }));

    // .env.example
    fs.writeFileSync(
      path.join(dir, '.env.example'),
      `# LLM API Configuration
OPC_LLM_API_KEY=your-api-key-here
OPC_LLM_BASE_URL=https://api.openai.com/v1
OPC_LLM_MODEL=gpt-4o-mini

# For DeepSeek:
# OPC_LLM_BASE_URL=https://api.deepseek.com/v1
# OPC_LLM_MODEL=deepseek-chat

# For local Ollama:
# OPC_LLM_BASE_URL=http://localhost:11434/v1
# OPC_LLM_MODEL=llama3
`,
    );

    // .env (copy of example)
    fs.writeFileSync(
      path.join(dir, '.env'),
      `OPC_LLM_API_KEY=your-api-key-here
OPC_LLM_BASE_URL=https://api.openai.com/v1
OPC_LLM_MODEL=gpt-4o-mini
`,
    );

    // package.json
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        {
          name,
          version: '1.0.0',
          private: true,
          scripts: {
            start: 'opc run',
            chat: 'opc chat',
          },
          dependencies: {
            'opc-agent': '^0.5.0',
          },
        },
        null,
        2,
      ),
    );

    // .gitignore
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n.env\n.opc-knowledge.json\ndata/\n');

    // Dockerfile
    fs.writeFileSync(
      path.join(dir, 'Dockerfile'),
      `FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY oad.yaml .env* ./
COPY prompts/ ./prompts/ 2>/dev/null || true
EXPOSE 3000
CMD ["npx", "opc", "run"]
`,
    );

    // docker-compose.yml
    fs.writeFileSync(
      path.join(dir, 'docker-compose.yml'),
      `version: '3.8'
services:
  agent:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./oad.yaml:/app/oad.yaml:ro
    restart: unless-stopped
`,
    );

    // README.md
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${name}

Created with [OPC Agent](https://github.com/Deepleaper/opc-agent) using the \`${template}\` template.

## Quick Start

1. **Set your API key:**
   \`\`\`bash
   # Edit .env and add your API key
   cp .env.example .env
   # Then edit .env with your actual key
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

3. **Start the web server:**
   \`\`\`bash
   npx opc run
   \`\`\`

4. **Open browser:** [http://localhost:3000](http://localhost:3000)

## CLI Chat

\`\`\`bash
npx opc chat
\`\`\`

## Configuration

Edit \`oad.yaml\` to customize your agent's personality, skills, and behavior.
`,
    );

    console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')}`);
    console.log(`   ${icon.file} oad.yaml      - Agent definition`);
    console.log(`   ${icon.file} package.json  - Dependencies`);
    console.log(`   ${icon.file} .env.example  - Environment template`);
    console.log(`   ${icon.file} .env          - Environment config (edit this!)`);
    console.log(`   ${icon.file} .gitignore`);
    console.log(`   ${icon.file} Dockerfile`);
    console.log(`   ${icon.file} docker-compose.yml`);
    console.log(`   ${icon.file} README.md`);
    console.log(`\n   Template: ${color.cyan(template)}`);
    console.log(`\n${color.bold('Next steps:')}`);
    console.log(`   1. cd ${name}`);
    console.log(`   2. Edit .env — set your OPC_LLM_API_KEY`);
    console.log(`   3. npm install`);
    console.log(`   4. npx opc run`);
    console.log(`   5. Open http://localhost:3000\n`);
  });

// ── Chat command ─────────────────────────────────────────────

program
  .command('chat')
  .description('Interactive CLI chat with the agent')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    // Load .env if present
    loadDotEnv();

    let systemPrompt = 'You are a helpful AI agent.';
    let model: string | undefined;

    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      if (config?.spec?.systemPrompt) systemPrompt = config.spec.systemPrompt;
      if (config?.spec?.model) model = config.spec.model;
      console.log(`\n${icon.gear} Loaded agent: ${color.bold(config?.metadata?.name ?? 'unknown')}`);
    } catch {
      console.log(`\n${icon.info} No oad.yaml found, using defaults.`);
    }

    const provider = createProvider('openai', model);
    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    console.log(`${color.dim('Type your message. Press Ctrl+C to exit.')}\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (): void => {
      rl.question(color.cyan('You: '), async (input) => {
        const text = input.trim();
        if (!text) { ask(); return; }

        history.push({ role: 'user', content: text });

        // Build messages for provider
        const messages = history.map((m) => ({
          id: 'x',
          role: m.role as any,
          content: m.content,
          timestamp: Date.now(),
        }));

        process.stdout.write(color.green('Agent: '));
        let full = '';
        try {
          for await (const chunk of provider.chatStream(messages, systemPrompt)) {
            process.stdout.write(chunk);
            full += chunk;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(color.red(`\n[Error: ${msg}]`));
          full = `[Error: ${msg}]`;
        }
        console.log('\n');

        history.push({ role: 'assistant', content: full });

        // Trim history if too long (keep last 40 messages)
        if (history.length > 40) {
          history.splice(0, history.length - 40);
        }

        ask();
      });
    };

    rl.on('close', () => {
      console.log(`\n${color.dim('Goodbye!')}`);
      process.exit(0);
    });

    ask();
  });

// ── Run command ──────────────────────────────────────────────

program
  .command('run')
  .description('Start agent with web server')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('-p, --port <port>', 'Port override')
  .action(async (opts: { file: string; port?: string }) => {
    loadDotEnv();

    const runtime = new AgentRuntime();
    await runtime.loadConfig(opts.file);
    await runtime.initialize();
    await runtime.start();
    const agent = runtime.getAgent();
    console.log(`\n${icon.rocket} Agent "${color.bold(agent?.name ?? 'unknown')}" is running.`);
    console.log(`   ${color.dim('Web UI:')} http://localhost:3000`);
    console.log(`   ${color.dim('API:')}    POST http://localhost:3000/api/chat`);
    console.log(`\n   ${color.dim('Press Ctrl+C to stop.')}\n`);
  });

// ── Info command ─────────────────────────────────────────────

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
      console.log(`  Model:       ${s.model}`);
      console.log(`  Channels:    ${s.channels.map((c: any) => c.type).join(', ') || color.dim('(none)')}`);
      console.log(`  Skills:      ${s.skills.map((sk: any) => sk.name).join(', ') || color.dim('(none)')}`);
      console.log();
    } catch (err) {
      console.error(`${icon.error} Failed to read OAD:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── Build command ────────────────────────────────────────────

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

// ── Create command ───────────────────────────────────────────

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

// ── Test command ─────────────────────────────────────────────

program
  .command('test')
  .description('Run agent tests defined in OAD or tests.yaml')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('--json', 'Output as JSON')
  .action(async (opts: { file: string; json?: boolean }) => {
    loadDotEnv();
    console.log(`\n${icon.gear} Running agent tests...\n`);
    try {
      const report = await runTests(opts.file);
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatReport(report));
      }
      process.exit(report.failed > 0 ? 1 : 0);
    } catch (err) {
      console.error(`${icon.error} Test failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── Analytics command ────────────────────────────────────────

program
  .command('analytics')
  .description('Show agent analytics and usage stats')
  .option('--json', 'Output as JSON')
  .option('--clear', 'Clear analytics data')
  .action(async (opts: { json?: boolean; clear?: boolean }) => {
    const engine = new AnalyticsEngine('.');
    if (opts.clear) {
      engine.clear();
      console.log(`${icon.success} Analytics data cleared.`);
      return;
    }
    const stats = engine.getStats();
    if (opts.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(AnalyticsEngine.formatStats(stats));
    }
  });

// ── Dev command ──────────────────────────────────────────────

program
  .command('dev')
  .description('Hot-reload development mode')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    loadDotEnv();
    console.log(`\n${icon.gear} ${color.bold('Development mode')} - watching for changes...\n`);

    let runtime: AgentRuntime | null = null;

    const startAgent = async () => {
      try {
        if (runtime) await runtime.stop();
        runtime = new AgentRuntime();
        await runtime.loadConfig(opts.file);
        await runtime.initialize();
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

// ── Publish command ──────────────────────────────────────────

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

      const manifest = {
        name: config.metadata.name,
        version: config.metadata.version,
        description: config.metadata.description,
        author: config.metadata.author,
        license: config.metadata.license,
        trust,
        channels: config.spec.channels.map((c: any) => c.type),
        skills: config.spec.skills.map((s: any) => s.name),
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

// ── Deploy command ───────────────────────────────────────────

program
  .command('deploy')
  .description('Deploy agent to a target runtime')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('-t, --target <target>', 'Deploy target', 'openclaw')
  .option('-o, --output <dir>', 'Output directory')
  .option('--install', 'Also register in OpenClaw config')
  .action(async (opts: { file: string; target: string; output?: string; install?: boolean }) => {
    if (opts.target !== 'openclaw' && opts.target !== 'hermes') {
      console.error(`${icon.error} Unknown target: ${color.bold(opts.target)}. Supported: openclaw, hermes`);
      process.exit(1);
    }
    try {
      const runtime = new AgentRuntime();
      const config = await runtime.loadConfig(opts.file);

      if (opts.target === 'hermes') {
        const agentId = config.metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const outputDir = path.resolve(opts.output ?? `hermes-${agentId}`);
        console.log(`\n${icon.rocket} ${color.bold('Deploy to Hermes')}\n`);
        const result = deployToHermes({ oad: config, outputDir });
        console.log(`${icon.success} Generated ${result.files.length} files in ${color.bold(outputDir)}`);
        for (const f of result.files) console.log(`   ${icon.file} ${f}`);
        console.log();
        return;
      }

      const agentId = config.metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const defaultOutput = path.join(homeDir, '.openclaw', 'agents', agentId, 'workspace');
      const outputDir = path.resolve(opts.output ?? defaultOutput);

      console.log(`\n${icon.rocket} ${color.bold('Deploy to OpenClaw')}\n`);
      const result = deployToOpenClaw({ oad: config, outputDir, install: opts.install });
      console.log(`\n${icon.success} Generated ${result.files.length} files.`);
      if (result.installed) {
        console.log(`${icon.success} Registered in OpenClaw config.`);
      }
      console.log();
    } catch (err) {
      console.error(`${icon.error} Deploy failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── Search command ───────────────────────────────────────────

program
  .command('search')
  .description('Search OPC Registry for agents and skills')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    console.log(`\n${icon.search} Searching OPC Registry for "${color.bold(query)}"...`);
    console.log(`\n🚧 OPC Registry coming soon!`);
    console.log(`   Available templates: ${Object.keys(TEMPLATES).map(t => color.cyan(t)).join(', ')}\n`);
  });

// ── Stats command ────────────────────────────────────────────

program
  .command('stats')
  .description('Show agent analytics')
  .action(() => {
    const analytics = new Analytics();
    const snap = analytics.getSnapshot();
    console.log(`\n${icon.gear} ${color.bold('Agent Analytics')}\n`);
    console.log(`  Messages: ${snap.messagesProcessed}  |  Errors: ${snap.errorCount}  |  Uptime: ${Math.round(snap.uptime / 1000)}s\n`);
  });

// ── Tool commands ────────────────────────────────────────────

const toolCmd = program.command('tool').description('Manage MCP tools');
toolCmd.command('list').description('List MCP tools').action(() => {
  console.log(`\n${icon.gear} No tools installed. Add with: ${color.cyan('opc tool add <name>')}\n`);
});
toolCmd.command('add').argument('<name>').action((name: string) => {
  console.log(`🚧 Tool registry coming soon! Would add: ${color.cyan(name)}\n`);
});

// ── Workflow commands ────────────────────────────────────────

const workflowCmd = program.command('workflow').description('Manage workflows');
workflowCmd
  .command('run')
  .argument('<name>')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (name: string, opts: { file: string }) => {
    const runtime = new AgentRuntime();
    const config = await runtime.loadConfig(opts.file);
    const wf = (config.spec.workflows ?? []).find((w: any) => w.name === name);
    if (!wf) { console.error(`Workflow "${name}" not found.`); process.exit(1); }
    const engine = new WorkflowEngine();
    engine.registerWorkflow(wf as any);
    console.log(`${icon.success} Workflow "${name}" loaded.\n`);
  });

workflowCmd
  .command('list')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    const runtime = new AgentRuntime();
    const config = await runtime.loadConfig(opts.file);
    const wfs = config.spec.workflows ?? [];
    if (wfs.length === 0) { console.log('No workflows defined.'); return; }
    for (const wf of wfs) console.log(`  ${color.cyan((wf as any).name)}`);
  });

// ── Version commands ─────────────────────────────────────────

const versionCmd = program.command('version-mgmt').description('Manage agent versions');
versionCmd.command('list').action(() => {
  const vm = new VersionManager();
  const versions = vm.list();
  if (versions.length === 0) { console.log('No versions saved.'); return; }
  for (const v of versions) console.log(`  ${color.cyan(v.version)} - ${new Date(v.timestamp).toISOString()}`);
});
versionCmd.command('rollback').argument('<version>').action((version: string) => {
  const vm = new VersionManager();
  const oad = vm.rollback(version);
  if (!oad) { console.error(`Version "${version}" not found.`); process.exit(1); }
  fs.writeFileSync('oad.yaml', oad);
  console.log(`${icon.success} Rolled back to ${version}.`);
});

// ── Helpers ──────────────────────────────────────────────────

function loadDotEnv(): void {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

// 📚 Knowledge Base commands ────────────────────────────────

const kbCmd = program.command('kb').description('Manage knowledge base');
kbCmd
  .command('add')
  .argument('<file>', 'File to index')
  .action(async (file: string) => {
    try {
      const kb = new KnowledgeBase('.');
      const result = await kb.addFile(file);
      console.log(`${icon.success} Indexed ${color.bold(file)} → ${result.chunks} chunks`);
    } catch (err) {
      console.error(`${icon.error}`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

kbCmd
  .command('search')
  .argument('<query>', 'Search query')
  .option('-k, --top-k <n>', 'Number of results', '5')
  .action(async (query: string, opts: { topK: string }) => {
    const kb = new KnowledgeBase('.');
    const results = await kb.search(query, parseInt(opts.topK));
    if (results.length === 0) {
      console.log(`${icon.info} No results found.`);
      return;
    }
    console.log(`\n${icon.search} Results for "${color.bold(query)}":\n`);
    for (const r of results) {
      console.log(`  ${color.cyan(`[${(r.score * 100).toFixed(0)}%]`)} ${color.dim(`(${r.source})`)}`);
      console.log(`  ${r.content.slice(0, 200)}${r.content.length > 200 ? '...' : ''}\n`);
    }
  });

kbCmd.command('stats').action(() => {
  const kb = new KnowledgeBase('.');
  const stats = kb.getStats();
  console.log(`\n${icon.gear} Knowledge Base Stats\n`);
  console.log(`  Entries: ${stats.totalEntries}`);
  console.log(`  Sources: ${stats.sources.join(', ') || '(none)'}`);
  console.log(`  Updated: ${stats.updatedAt}\n`);
});

kbCmd.command('clear').action(() => {
  const kb = new KnowledgeBase('.');
  kb.clear();
  console.log(`${icon.success} Knowledge base cleared.`);
});

// 📦 Marketplace commands ───────────────────────────────────

program
  .command('publish')
  .description('Package agent for distribution')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('-o, --output <dir>', 'Output directory', '.')
  .option('--include-kb', 'Include knowledge base')
  .action(async (opts: { file: string; output: string; includeKb?: boolean }) => {
    try {
      console.log(`\n${icon.package} Packaging agent...\n`);
      const result = await publishAgent({
        oadPath: opts.file,
        outputDir: opts.output,
        includeKnowledge: opts.includeKb,
      });
      console.log(`${icon.success} Published: ${color.bold(result.archivePath)}`);
      console.log(`   Name:    ${result.manifest.name}`);
      console.log(`   Version: ${result.manifest.version}`);
      console.log(`   Files:   ${result.manifest.files.length}`);
      console.log();
    } catch (err) {
      console.error(`${icon.error} Publish failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install agent from package')
  .argument('<source>', 'Package file path or URL')
  .option('-d, --dir <dir>', 'Install directory')
  .action(async (source: string, opts: { dir?: string }) => {
    try {
      console.log(`\n${icon.package} Installing agent from ${color.bold(source)}...\n`);
      const result = await installAgent({ source, targetDir: opts.dir });
      console.log(`${icon.success} Installed: ${color.bold(result.manifest.name)} v${result.manifest.version}`);
      console.log(`   Directory: ${result.dir}`);
      console.log(`\n${color.bold('Next steps:')}`);
      console.log(`   cd ${result.dir}`);
      console.log(`   opc run\n`);
    } catch (err) {
      console.error(`${icon.error} Install failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// 🔌 Plugin commands ────────────────────────────────────────

const pluginCmd = program.command('plugin').description('Manage plugins');
pluginCmd.command('list')
  .description('List available built-in plugins')
  .action(() => {
    const builtIn = [
      { name: 'logging', description: 'Logs all messages and responses' },
      { name: 'analytics', description: 'Tracks message counts and error rates' },
      { name: 'rate-limit', description: 'Per-user rate limiting' },
    ];
    console.log(`\n${icon.gear} ${color.bold('Available Plugins')}\n`);
    for (const p of builtIn) {
      console.log(`  ${color.cyan(p.name.padEnd(16))} ${p.description}`);
    }
    console.log(`\n  Add to oad.yaml: ${color.dim('plugins: [{ name: "logging" }]')}\n`);
  });

pluginCmd.command('add')
  .argument('<name>', 'Plugin name')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .description('Add a plugin to your agent configuration')
  .action((name: string, opts: { file: string }) => {
    const validPlugins = ['logging', 'analytics', 'rate-limit'];
    if (!validPlugins.includes(name)) {
      console.error(`${icon.error} Unknown plugin: ${color.bold(name)}. Available: ${validPlugins.join(', ')}`);
      process.exit(1);
    }
    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      if (!config.spec.plugins) config.spec.plugins = [];
      if (config.spec.plugins.some((p: any) => p.name === name)) {
        console.log(`${icon.info} Plugin "${name}" already in config.`);
        return;
      }
      config.spec.plugins.push({ name });
      fs.writeFileSync(opts.file, yaml.dump(config, { lineWidth: 120 }));
      console.log(`${icon.success} Added plugin "${color.cyan(name)}" to ${opts.file}`);
    } catch (err) {
      console.error(`${icon.error} Failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// 🔄 Migrate command ────────────────────────────────────────

program
  .command('migrate')
  .description('Migrate OAD to latest schema version')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('--dry-run', 'Show changes without writing')
  .action(async (opts: { file: string; dryRun?: boolean }) => {
    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      let changed = false;

      // Migration: add apiVersion if missing
      if (!config.apiVersion) { config.apiVersion = 'opc/v1'; changed = true; }
      // Migration: add kind if missing
      if (!config.kind) { config.kind = 'Agent'; changed = true; }
      // Migration: ensure metadata.version
      if (!config.metadata?.version) {
        if (!config.metadata) config.metadata = {};
        config.metadata.version = '1.0.0';
        changed = true;
      }
      // Migration: ensure spec.channels is array
      if (config.spec?.channels && !Array.isArray(config.spec.channels)) {
        config.spec.channels = [config.spec.channels];
        changed = true;
      }
      // Migration: ensure spec.skills is array
      if (config.spec?.skills && !Array.isArray(config.spec.skills)) {
        config.spec.skills = [config.spec.skills];
        changed = true;
      }
      // Migration: old model format
      if (config.spec?.llm?.model && !config.spec?.model) {
        config.spec.model = config.spec.llm.model;
        delete config.spec.llm;
        changed = true;
      }

      if (!changed) {
        console.log(`${icon.success} OAD is already up to date.`);
        return;
      }

      if (opts.dryRun) {
        console.log(`\n${icon.info} Would migrate:\n`);
        console.log(yaml.dump(config, { lineWidth: 120 }));
      } else {
        // Backup
        fs.writeFileSync(opts.file + '.bak', raw);
        fs.writeFileSync(opts.file, yaml.dump(config, { lineWidth: 120 }));
        console.log(`${icon.success} Migrated ${color.bold(opts.file)} (backup: ${opts.file}.bak)`);
      }
    } catch (err) {
      console.error(`${icon.error} Migration failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
