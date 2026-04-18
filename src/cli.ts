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

import { PluginManager, createLoggingPlugin, createAnalyticsPlugin, createRateLimitPlugin } from './plugins';
import { runDoctor } from './doctor';
import { Scheduler } from './core/scheduler';
import type { CronJob } from './core/scheduler';
import type { Span } from './traces';
import { spawn } from 'child_process';
import { searchRoles, getPopularRoles, getRole, getCategories } from 'agent-workstation';

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
  .version('2.0.0');

// ── Init command ─────────────────────────────────────────────

program
  .command('init')
  .description('Initialize a new OPC agent project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Template to use')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .option('-r, --role <role>', 'Use an agent-workstation role template')
  .option('--list-roles', 'List available workstation roles')
  .action(async (nameArg: string | undefined, opts: { template?: string; yes?: boolean; role?: string; listRoles?: boolean }) => {
    console.log(`\n${icon.rocket} ${color.bold('OPC Agent - Create New Project')}\n`);

    // Handle --list-roles
    if (opts.listRoles) {
      const roles = getPopularRoles();
      console.log(`📋 ${color.bold('Available workstation roles:')}\n`);
      for (const r of roles) {
        const fullRole = getRole(r.category, r.role);
        let roleName = r.role;
        if (fullRole?.files?.['oad.yaml']) {
          try {
            const oadData = yaml.load(fullRole.files['oad.yaml']) as any;
            if (oadData?.name) roleName = oadData.name;
          } catch { /* ignore */ }
        }
        console.log(`  ${color.cyan((r.category + '/' + r.role).padEnd(45))} ${roleName}`);
      }
      console.log(`\n  Use: ${color.cyan('opc init my-agent --role <role-name>')}`);
      console.log(`  Example: ${color.cyan('opc init my-agent --role customer-service')}\n`);
      return;
    }

    // Handle --role: search and generate from workstation template
    if (opts.role) {
      const results = searchRoles(opts.role);
      if (results.length === 0) {
        console.error(`${icon.error} Role "${color.bold(opts.role)}" not found. Run '${color.cyan('opc init --list-roles')}' to see available roles.`);
        process.exit(1);
      }

      const matched = results[0];
      const roleData = getRole(matched.category, matched.role);
      if (!roleData || !roleData.files) {
        console.error(`${icon.error} Could not load role data for ${matched.category}/${matched.role}.`);
        process.exit(1);
      }

      const name = nameArg ?? matched.role;
      const dir = path.resolve(name);
      if (fs.existsSync(dir)) {
        console.error(`\n${icon.error} Directory ${color.bold(name)} already exists.`);
        process.exit(1);
      }

      // Parse role metadata from oad.yaml
      let roleMeta: any = {};
      if (roleData.files['oad.yaml']) {
        try { roleMeta = yaml.load(roleData.files['oad.yaml']) as any; } catch { /* ignore */ }
      }
      const roleDisplayName = roleMeta.name || matched.role;
      const roleDescription = roleMeta.name_zh ? `${roleMeta.name} (${roleMeta.name_zh})` : (roleMeta.name || matched.role);

      console.log(`  ${icon.info} Matched role: ${color.cyan(matched.category + '/' + matched.role)} — ${roleDisplayName}`);

      // Create directories
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(path.join(dir, 'src', 'skills'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'data'), { recursive: true });

      // Get system prompt content
      const systemPromptContent = roleData.files['system-prompt.md'] || roleData.files['prompts/system.md'] || '';

      // agent.yaml with role system prompt
      const firstLine = systemPromptContent.split('\n').find((l: string) => l.trim() && !l.startsWith('#'))?.trim() || 'You are a helpful AI assistant.';
      fs.writeFileSync(
        path.join(dir, 'agent.yaml'),
        `apiVersion: opc/v1
kind: Agent
metadata:
  name: ${name}
  version: 1.0.0
  description: ${roleDescription}
spec:
  model: qwen2.5
  provider:
    default: ollama
  systemPrompt: |
    ${systemPromptContent.split('\n').join('\n    ')}
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm:
      provider: deepbrain
      database: ./data/brain.db
  skills: []
`,
      );

      // SOUL.md from system-prompt.md
      fs.writeFileSync(path.join(dir, 'SOUL.md'), systemPromptContent);

      // CONTEXT.md
      const readmeContent = roleData.files['README.md'] || '';
      fs.writeFileSync(
        path.join(dir, 'CONTEXT.md'),
        `# Project Context\n\n## Role: ${roleDisplayName}\n\n${readmeContent}\n`,
      );

      // data/brain-seed.md if available
      if (roleData.files['brain-seed.md']) {
        fs.writeFileSync(path.join(dir, 'data', 'brain-seed.md'), roleData.files['brain-seed.md']);
      }

      // oad.yaml from role
      if (roleData.files['oad.yaml']) {
        fs.writeFileSync(path.join(dir, 'oad.yaml'), roleData.files['oad.yaml']);
      }

      // src/index.ts — entry point (same as generic)
      fs.writeFileSync(
        path.join(dir, 'src', 'index.ts'),
        `import { AgentRuntime } from 'opc-agent';
import { EchoSkill } from './skills/echo';
import { readFileSync, existsSync } from 'fs';

async function main() {
  const runtime = new AgentRuntime();
  const config = await runtime.loadConfig('./agent.yaml');

  const soul = existsSync('./SOUL.md') ? readFileSync('./SOUL.md', 'utf-8') : '';
  const context = existsSync('./CONTEXT.md') ? readFileSync('./CONTEXT.md', 'utf-8') : '';
  if (soul || context) {
    const fullPrompt = [soul, context, config.spec.systemPrompt].filter(Boolean).join('\\n\\n');
    config.spec.systemPrompt = fullPrompt;
  }

  const agent = await runtime.initialize(config);
  runtime.registerSkill(new EchoSkill());
  await runtime.start();

  console.log('🤖 Agent is running!');
  console.log('   Web UI: http://localhost:3000');
  console.log('   Press Ctrl+C to stop');
}

main().catch(console.error);
`,
      );

      // src/skills/echo.ts
      fs.writeFileSync(
        path.join(dir, 'src', 'skills', 'echo.ts'),
        `import { BaseSkill } from 'opc-agent';
import type { AgentContext, Message, SkillResult } from 'opc-agent';

export class EchoSkill extends BaseSkill {
  name = 'echo';
  description = 'Echo back the message (test skill)';

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    if (message.content.toLowerCase().startsWith('/echo ')) {
      const text = message.content.slice(6);
      return this.match(\`🔊 Echo: \${text}\`);
    }
    return this.noMatch();
  }
}
`,
      );

      // tsconfig.json
      fs.writeFileSync(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: { target: 'ES2022', module: 'commonjs', lib: ['ES2022'], outDir: 'dist', rootDir: 'src', strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true, declaration: true, sourceMap: true },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist'],
          },
          null,
          2,
        ),
      );

      // package.json
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify(
          { name, version: '1.0.0', private: true, scripts: { start: 'opc run', dev: 'opc dev', chat: 'opc chat', build: 'tsc' }, dependencies: { 'opc-agent': '^1.3.0' }, devDependencies: { typescript: '^5.5.0', tsx: '^4.0.0' } },
          null,
          2,
        ),
      );

      // .gitignore, .env.example, .env
      fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\ndist\n.env\n.opc-knowledge.json\ndata/\n');
      fs.writeFileSync(path.join(dir, '.env.example'), `# LLM API Configuration\nOPC_LLM_API_KEY=your-api-key-here\nOPC_LLM_BASE_URL=https://api.openai.com/v1\nOPC_LLM_MODEL=gpt-4o-mini\n`);
      fs.writeFileSync(path.join(dir, '.env'), `OPC_LLM_API_KEY=your-api-key-here\nOPC_LLM_BASE_URL=https://api.openai.com/v1\nOPC_LLM_MODEL=gpt-4o-mini\n`);

      // README.md
      fs.writeFileSync(
        path.join(dir, 'README.md'),
        `# ${name}\n\nCreated with [OPC Agent](https://github.com/Deepleaper/opc-agent) using the \`${matched.category}/${matched.role}\` workstation role.\n\n## Quick Start\n\n\`\`\`bash\nnpm install\nollama pull qwen2.5\nnpx tsx src/index.ts\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000)\n`,
      );

      // Dockerfile + docker-compose
      fs.writeFileSync(path.join(dir, 'Dockerfile'), `FROM node:22-alpine\nWORKDIR /app\nCOPY package.json package-lock.json* ./\nRUN npm ci --production 2>/dev/null || npm install --production\nCOPY oad.yaml agent.yaml .env* ./\nCOPY src/ ./src/\nCOPY prompts/ ./prompts/ 2>/dev/null || true\nEXPOSE 3000\nCMD ["npx", "opc", "run"]\n`);
      fs.writeFileSync(path.join(dir, 'docker-compose.yml'), `version: '3.8'\nservices:\n  agent:\n    build: .\n    ports:\n      - "3000:3000"\n    env_file:\n      - .env\n    volumes:\n      - ./agent.yaml:/app/agent.yaml:ro\n    restart: unless-stopped\n`);

      console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')} from role ${color.cyan(matched.category + '/' + matched.role)}`);
      console.log(`   ${icon.file} agent.yaml       - Agent definition with role system prompt`);
      console.log(`   ${icon.file} SOUL.md          - Role personality (${systemPromptContent.split('\n').length} lines)`);
      console.log(`   ${icon.file} CONTEXT.md       - Role context & documentation`);
      if (roleData.files['brain-seed.md']) {
        console.log(`   ${icon.file} data/brain-seed.md - Role brain seed knowledge`);
      }
      console.log(`   ${icon.file} src/index.ts     - Entry point`);
      console.log(`   ${icon.file} package.json     - Dependencies`);
      console.log(`\n${color.bold('Next steps:')}`);
      console.log(`   1. cd ${name}`);
      console.log(`   2. npm install`);
      console.log(`   3. npx tsx src/index.ts\n`);
      return;
    }

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
    fs.mkdirSync(path.join(dir, 'src', 'skills'), { recursive: true });

    const factory = TEMPLATES[template]?.factory ?? createCustomerServiceConfig;
    const config = factory();
    config.metadata.name = name;

    // Ensure web channel exists
    if (!config.spec.channels.some((c: any) => c.type === 'web')) {
      config.spec.channels.push({ type: 'web', port: 3000 });
    }

    fs.writeFileSync(path.join(dir, 'oad.yaml'), yaml.dump(config, { lineWidth: 120 }));

    // agent.yaml — standalone OAD config for runtime usage
    fs.writeFileSync(
      path.join(dir, 'agent.yaml'),
      `apiVersion: opc/v1
kind: Agent
metadata:
  name: ${name}
  version: 1.0.0
  description: My AI Agent
spec:
  model: qwen2.5
  provider:
    default: ollama
  systemPrompt: |
    You are a helpful AI assistant named ${name}.
    Be concise, helpful, and friendly.
  channels:
    - type: web
      port: 3000
  memory:
    shortTerm: true
    longTerm:
      provider: deepbrain
  skills:
    - name: echo
      description: Echo test skill
`,
    );

    // src/index.ts — entry point
    fs.writeFileSync(
      path.join(dir, 'src', 'index.ts'),
      `import { AgentRuntime } from 'opc-agent';
import { EchoSkill } from './skills/echo';
import { readFileSync, existsSync } from 'fs';

async function main() {
  const runtime = new AgentRuntime();

  // Load OAD config
  const config = await runtime.loadConfig('./agent.yaml');

  // Load personality and context files
  const soul = existsSync('./SOUL.md') ? readFileSync('./SOUL.md', 'utf-8') : '';
  const context = existsSync('./CONTEXT.md') ? readFileSync('./CONTEXT.md', 'utf-8') : '';
  if (soul || context) {
    const fullPrompt = [soul, context, config.spec.systemPrompt].filter(Boolean).join('\\n\\n');
    config.spec.systemPrompt = fullPrompt;
  }

  // Initialize agent with channels, memory, etc.
  const agent = await runtime.initialize(config);

  // Register custom skills
  runtime.registerSkill(new EchoSkill());

  // Start serving
  await runtime.start();

  console.log('🤖 Agent is running!');
  console.log('   Web UI: http://localhost:3000');
  console.log('   Press Ctrl+C to stop');
}

main().catch(console.error);
`,
    );

    // src/skills/echo.ts — example skill
    fs.writeFileSync(
      path.join(dir, 'src', 'skills', 'echo.ts'),
      `import { BaseSkill } from 'opc-agent';
import type { AgentContext, Message, SkillResult } from 'opc-agent';

export class EchoSkill extends BaseSkill {
  name = 'echo';
  description = 'Echo back the message (test skill)';

  async execute(context: AgentContext, message: Message): Promise<SkillResult> {
    if (message.content.toLowerCase().startsWith('/echo ')) {
      const text = message.content.slice(6);
      return this.match(\`🔊 Echo: \${text}\`);
    }
    return this.noMatch();
  }
}
`,
    );

    // tsconfig.json
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'commonjs',
            lib: ['ES2022'],
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            declaration: true,
            sourceMap: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2,
      ),
    );

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

# For local Ollama (default in agent.yaml):
# OPC_LLM_BASE_URL=http://localhost:11434/v1
# OPC_LLM_MODEL=qwen2.5
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
            dev: 'opc dev',
            chat: 'opc chat',
            build: 'tsc',
          },
          dependencies: {
            'opc-agent': '^1.3.0',
          },
          devDependencies: {
            typescript: '^5.5.0',
            tsx: '^4.0.0',
          },
        },
        null,
        2,
      ),
    );

    // .gitignore
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\ndist\n.env\n.opc-knowledge.json\ndata/\n');

    // Dockerfile
    fs.writeFileSync(
      path.join(dir, 'Dockerfile'),
      `FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production
COPY oad.yaml agent.yaml .env* ./
COPY src/ ./src/
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
      - ./agent.yaml:/app/agent.yaml:ro
    restart: unless-stopped
`,
    );

    // README.md
    fs.writeFileSync(
      path.join(dir, 'README.md'),
      `# ${name}

Created with [OPC Agent](https://github.com/Deepleaper/opc-agent) using the \`${template}\` template.

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Run with Ollama (default):**
   \`\`\`bash
   # Make sure Ollama is running with qwen2.5 model
   ollama pull qwen2.5
   npx tsx src/index.ts
   \`\`\`

3. **Or use OpenAI/other providers:**
   \`\`\`bash
   # Edit .env and set your API key
   npx opc run
   \`\`\`

4. **Open browser:** [http://localhost:3000](http://localhost:3000)

## Development

\`\`\`bash
npx opc dev    # Hot-reload mode
npx opc chat   # CLI chat
\`\`\`

## Project Structure

\`\`\`
${name}/
├── agent.yaml          # OAD agent config (used by src/index.ts)
├── oad.yaml            # OAD config (used by opc CLI)
├── src/
│   ├── index.ts        # Entry point
│   └── skills/
│       └── echo.ts     # Example skill
├── package.json
└── tsconfig.json
\`\`\`

## Configuration

Edit \`agent.yaml\` to customize your agent's personality, skills, and behavior.
`,
    );

    // SOUL.md — agent personality
    const createdDate = new Date().toISOString().split('T')[0];
    fs.writeFileSync(
      path.join(dir, 'SOUL.md'),
      `# ${name} Personality

## Identity
- Name: ${name}
- Role: AI Assistant
- Created: ${createdDate}

## Personality Traits
- Helpful and professional
- Concise but thorough
- Friendly tone

## Communication Style
- Use clear, simple language
- Be direct — answer the question first, then explain
- Use markdown formatting when helpful

## Rules
- Always be honest about limitations
- Ask for clarification when the request is ambiguous
- Never make up information
`,
    );

    // CONTEXT.md — project context
    fs.writeFileSync(
      path.join(dir, 'CONTEXT.md'),
      `# Project Context

## About This Agent
${name} is an AI agent built with OPC Agent Framework.

## Knowledge Base
Add project-specific context here. The agent reads this file
on startup to understand the project context.

## Important Notes
- Add domain knowledge here
- Add FAQ items here
- Add company policies here
`,
    );

    console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')}`);
    console.log(`   ${icon.file} agent.yaml       - Agent definition (OAD)`);
    console.log(`   ${icon.file} src/index.ts     - Entry point`);
    console.log(`   ${icon.file} src/skills/echo.ts - Example skill`);
    console.log(`   ${icon.file} SOUL.md          - Agent personality`);
    console.log(`   ${icon.file} CONTEXT.md       - Project context`);
    console.log(`   ${icon.file} package.json     - Dependencies`);
    console.log(`   ${icon.file} tsconfig.json    - TypeScript config`);
    console.log(`   ${icon.file} .env.example     - Environment template`);
    console.log(`   ${icon.file} .gitignore`);
    console.log(`   ${icon.file} Dockerfile`);
    console.log(`   ${icon.file} README.md`);
    console.log(`\n   Template: ${color.cyan(template)}`);
    console.log(`\n${color.bold('Next steps:')}`);
    console.log(`   1. cd ${name}`);
    console.log(`   2. npm install`);
    console.log(`   3. npx tsx src/index.ts   ${color.dim('# or: npx opc run')}`);
    console.log(`   4. Open http://localhost:3000\n`);
    console.log(`${color.dim('💡 Tip: Use --role to start from a workstation template:')}`);
    console.log(`${color.dim('   opc init my-agent --role customer-service')}`);
    console.log(`${color.dim('   opc init --list-roles  (see all roles)')}\n`);
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
    let agentName = 'Agent';
    let agentVersion = '1.0.0';
    let providerName = 'openai';
    let skillNames: string[] = [];

    // Try loading SOUL.md and CONTEXT.md for enriched system prompt
    const soulPath = path.resolve('SOUL.md');
    const contextPath = path.resolve('CONTEXT.md');
    const soulContent = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf-8') : '';
    const contextContent = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf-8') : '';

    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      if (config?.spec?.systemPrompt) systemPrompt = config.spec.systemPrompt;
      if (config?.spec?.model) model = config.spec.model;
      if (config?.metadata?.name) agentName = config.metadata.name;
      if (config?.metadata?.version) agentVersion = config.metadata.version;
      if (config?.spec?.provider?.default) providerName = config.spec.provider.default;
      if (config?.spec?.skills) skillNames = config.spec.skills.map((s: any) => s.name);
    } catch {
      // No config file, use defaults
    }

    // Prepend SOUL.md and CONTEXT.md to system prompt
    systemPrompt = [soulContent, contextContent, systemPrompt].filter(Boolean).join('\n\n');

    const provider = createProvider('openai', model);
    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    // Print startup banner
    const bannerLines = [
      '╔══════════════════════════════════════╗',
      '║  🤖 OPC Agent — Interactive Chat     ║',
      `║  Agent: ${(agentName + ' v' + agentVersion).padEnd(27)}║`,
      `║  Model: ${((providerName + '/' + (model ?? 'default')).slice(0, 27)).padEnd(27)}║`,
      `║  Skills: ${(String(skillNames.length) + ' loaded').padEnd(26)}║`,
      '║  Type /help for commands             ║',
      '╚══════════════════════════════════════╝',
    ];
    console.log('\n' + color.cyan(bannerLines.join('\n')) + '\n');

    if (soulContent) console.log(`  ${icon.info} Loaded SOUL.md`);
    if (contextContent) console.log(`  ${icon.info} Loaded CONTEXT.md`);
    if (soulContent || contextContent) console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 100,
    });

    const handleSlashCommand = (cmd: string): boolean => {
      const lower = cmd.toLowerCase().trim();
      if (lower === '/quit' || lower === '/exit') {
        console.log(`\n${color.dim('Goodbye! 👋')}`);
        process.exit(0);
      }
      if (lower === '/help') {
        console.log(`\n  ${color.bold('Available commands:')}`);
        console.log(`  ${color.cyan('/help')}    — Show this help`);
        console.log(`  ${color.cyan('/quit')}    — Exit chat (/exit also works)`);
        console.log(`  ${color.cyan('/clear')}   — Clear conversation history`);
        console.log(`  ${color.cyan('/skills')}  — List registered skills`);
        console.log(`  ${color.cyan('/memory')}  — Show memory stats`);
        console.log(`  ${color.cyan('/info')}    — Show agent info\n`);
        return true;
      }
      if (lower === '/clear') {
        history.length = 0;
        console.log(`\n  ${icon.success} Conversation history cleared.\n`);
        return true;
      }
      if (lower === '/skills') {
        if (skillNames.length === 0) {
          console.log(`\n  ${icon.info} No skills registered.\n`);
        } else {
          console.log(`\n  ${color.bold('Registered skills:')}`);
          skillNames.forEach((s) => console.log(`  • ${color.cyan(s)}`));
          console.log();
        }
        return true;
      }
      if (lower === '/memory') {
        console.log(`\n  ${color.bold('Memory stats:')}`);
        console.log(`  Messages in history: ${color.cyan(String(history.length))}`);
        console.log(`  Characters: ${color.cyan(String(history.reduce((a, m) => a + m.content.length, 0)))}\n`);
        return true;
      }
      if (lower === '/info') {
        console.log(`\n  ${color.bold('Agent Info:')}`);
        console.log(`  Name:     ${color.cyan(agentName)}`);
        console.log(`  Version:  ${color.cyan(agentVersion)}`);
        console.log(`  Provider: ${color.cyan(providerName)}`);
        console.log(`  Model:    ${color.cyan(model ?? 'default')}`);
        console.log(`  Skills:   ${color.cyan(String(skillNames.length))}\n`);
        return true;
      }
      return false;
    };

    const ask = (): void => {
      rl.question(color.cyan('You: '), async (input) => {
        const text = input.trim();
        if (!text) { ask(); return; }

        // Handle slash commands
        if (text.startsWith('/') && handleSlashCommand(text)) {
          ask();
          return;
        }

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
      console.log(`\n${color.dim('Goodbye! 👋')}`);
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

      // Memory info
      const memCfg = s.memory;
      const shortTermStatus = memCfg?.shortTerm !== false ? '✅' : '❌';
      console.log(`\n  ${color.bold('Memory:')}`);
      console.log(`    Short-term: ${shortTermStatus} InMemoryStore`);
      if (memCfg && typeof memCfg.longTerm === 'object' && memCfg.longTerm.provider === 'deepbrain') {
        const ltCfg = memCfg.longTerm.config as any ?? {};
        const dbPath = ltCfg.database || './data/brain.db';
        const autoLearn = ltCfg.autoLearn !== false ? '✅' : '❌';
        const autoRecall = ltCfg.autoRecall !== false ? '✅' : '❌';
        const evolveInterval = ltCfg.evolveInterval;
        console.log(`    Long-term:  ✅ DeepBrain (${dbPath})`);
        console.log(`    Auto-learn: ${autoLearn}`);
        console.log(`    Auto-recall: ${autoRecall}`);
        if (evolveInterval && evolveInterval > 0) {
          const hours = Math.floor(evolveInterval / 3600000);
          const mins = Math.floor((evolveInterval % 3600000) / 60000);
          const label = hours > 0 ? `every ${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `every ${mins}m`;
          console.log(`    Auto-evolve: ${label}`);
        } else {
          console.log(`    Auto-evolve: ❌ disabled`);
        }
      } else {
        console.log(`    Long-term:  ❌ disabled`);
      }

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

// (publish command moved to marketplace section below)

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

// 📦 Package commands ───────────────────────────────────

import { AgentPackager, AgentPublisher, AgentInstaller } from './publish';

program
  .command('publish')
  .description('Validate, pack, and publish agent package')
  .option('--dry-run', 'Show what would be published without actually publishing')
  .option('--tag <tag>', 'Publish tag (default: latest)', 'latest')
  .option('--access <access>', 'Package access level (public or private)', 'public')
  .option('--registry <url>', 'Registry URL')
  .action(async (opts: { dryRun?: boolean; tag: string; access: string; registry?: string }) => {
    const dir = process.cwd();
    const packager = new AgentPackager();
    const publisher = new AgentPublisher();

    // Validate first
    console.log(`\n${icon.gear} Validating agent project...`);
    const validation = await packager.validate(dir);
    for (const w of validation.warnings) console.log(`  ${icon.warn} ${color.yellow(w)}`);
    if (!validation.valid) {
      for (const e of validation.errors) console.log(`  ${icon.error} ${color.red(e)}`);
      console.log(`\n${icon.error} Validation failed. Fix errors above.\n`);
      process.exit(1);
    }
    console.log(`  ${icon.success} Validation passed.`);

    // Pack
    console.log(`\n${icon.package} Packing agent...`);
    const { path: pkgPath, manifest } = await packager.pack(dir);
    console.log(`  ${icon.success} Created ${color.bold(path.basename(pkgPath))} (${manifest.files.length} files)`);
    console.log(`  ${color.dim('Checksum:')} ${manifest.checksum}`);

    // Publish
    await publisher.publish(pkgPath, manifest, {
      dryRun: opts.dryRun,
      tag: opts.tag,
      access: opts.access as 'public' | 'private',
      registry: opts.registry,
    });
  });

program
  .command('pack')
  .description('Create .opc.tgz package without publishing')
  .option('--list', 'List files that would be included (do not create archive)')
  .action(async (opts: { list?: boolean }) => {
    const dir = process.cwd();
    const packager = new AgentPackager();

    if (opts.list) {
      const files = await packager.listFiles(dir);
      console.log(`\n${icon.package} ${color.bold('Files to include')} (${files.length}):\n`);
      for (const f of files) console.log(`  ${f}`);
      console.log();
      return;
    }

    // Validate
    const validation = await packager.validate(dir);
    for (const w of validation.warnings) console.log(`  ${icon.warn} ${color.yellow(w)}`);
    if (!validation.valid) {
      for (const e of validation.errors) console.log(`  ${icon.error} ${color.red(e)}`);
      process.exit(1);
    }

    console.log(`\n${icon.package} Packing agent...`);
    const { path: pkgPath, manifest } = await packager.pack(dir);
    console.log(`  ${icon.success} Created ${color.bold(path.basename(pkgPath))}`);
    console.log(`  Files:    ${manifest.files.length}`);
    console.log(`  Checksum: ${manifest.checksum}\n`);
  });

program
  .command('install')
  .description('Install agent from .opc.tgz package or npm')
  .argument('<source>', 'Package file path, URL, or npm package name')
  .option('-d, --dir <dir>', 'Install directory', '.')
  .action(async (source: string, opts: { dir: string }) => {
    const installer = new AgentInstaller();
    console.log(`\n${icon.package} Installing from ${color.bold(source)}...`);
    await installer.install(source, path.resolve(opts.dir));
    console.log();
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

// 🔌 Protocol commands ───────────────────────────────────────

const protocolCmd = program.command('protocol').description('Manage agent protocols (A2A, AG-UI)');

protocolCmd.command('list')
  .description('List supported protocols and their status')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action((opts: { file: string }) => {
    let config: any = {};
    try { config = yaml.load(fs.readFileSync(opts.file, 'utf-8')) as any; } catch { /* no file */ }
    const protocols = config?.spec?.protocols || {};
    const items = [
      { name: 'a2a', description: 'Agent-to-Agent protocol', enabled: !!protocols.a2a?.enabled, detail: protocols.a2a?.port ? `port ${protocols.a2a.port}` : '' },
      { name: 'agui', description: 'AG-UI — Agent-User Interaction (SSE)', enabled: !!protocols.agui?.enabled, detail: protocols.agui?.path || '/agui' },
    ];
    console.log(`\n${icon.gear} ${color.bold('Protocols')}\n`);
    for (const p of items) {
      const status = p.enabled ? color.green('enabled') : color.dim('disabled');
      console.log(`  ${color.cyan(p.name.padEnd(10))} ${status.padEnd(20)} ${p.description} ${p.detail ? color.dim(`(${p.detail})`) : ''}`);
    }
    console.log();
  });

protocolCmd.command('enable')
  .argument('<name>', 'Protocol name (a2a, agui)')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .description('Enable a protocol')
  .action((name: string, opts: { file: string }) => {
    const validProtocols = ['a2a', 'agui'];
    if (!validProtocols.includes(name)) {
      console.error(`${icon.error} Unknown protocol: ${color.bold(name)}. Available: ${validProtocols.join(', ')}`);
      process.exit(1);
    }
    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      if (!config.spec.protocols) config.spec.protocols = {};
      if (!config.spec.protocols[name]) config.spec.protocols[name] = {};
      config.spec.protocols[name].enabled = true;
      if (name === 'agui' && !config.spec.protocols[name].path) {
        config.spec.protocols[name].path = '/agui';
      }
      fs.writeFileSync(opts.file, yaml.dump(config, { lineWidth: 120 }));
      console.log(`${icon.success} Enabled protocol "${color.cyan(name)}" in ${opts.file}`);
    } catch (err) {
      console.error(`${icon.error} Failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

protocolCmd.command('disable')
  .argument('<name>', 'Protocol name (a2a, agui)')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .description('Disable a protocol')
  .action((name: string, opts: { file: string }) => {
    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      if (config?.spec?.protocols?.[name]) {
        config.spec.protocols[name].enabled = false;
        fs.writeFileSync(opts.file, yaml.dump(config, { lineWidth: 120 }));
        console.log(`${icon.success} Disabled protocol "${color.cyan(name)}" in ${opts.file}`);
      } else {
        console.log(`${icon.info} Protocol "${name}" was not configured.`);
      }
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

// ── Brain command ────────────────────────────────────────────

program
  .command('brain')
  .description('Show agent memory/brain status from DeepBrain')
  .option('--url <url>', 'DeepBrain server URL', 'http://localhost:3333')
  .action(async (opts: { url: string }) => {
    console.log(`\n${icon.gear} ${color.bold('DeepBrain Status')} — ${color.dim(opts.url)}\n`);
    try {
      const res = await fetch(`${opts.url}/api/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const stats = (await res.json()) as Record<string, any>;
      const rows: [string, string][] = [
        ['Total Pages', String(stats.totalPages ?? stats.pages ?? '-')],
        ['Total Chunks', String(stats.totalChunks ?? stats.chunks ?? '-')],
        ['Memory Tiers', String(stats.memoryTiers ?? stats.tiers ?? '-')],
        ['Index Size', stats.indexSize ?? '-'],
        ['Last Updated', stats.lastUpdated ?? stats.updatedAt ?? '-'],
      ];
      const maxKey = Math.max(...rows.map(([k]) => k.length));
      for (const [key, val] of rows) {
        console.log(`  ${color.cyan(key.padEnd(maxKey))}  ${val}`);
      }
      console.log();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        console.log(`  ${icon.warn} Cannot connect to DeepBrain at ${opts.url}`);
        console.log(`  ${color.dim('Is the server running? Start with: deepbrain serve')}\n`);
      } else {
        console.error(`  ${icon.error} ${msg}\n`);
      }
    }
  });

// ── Logs command ─────────────────────────────────────────────

program
  .command('logs')
  .description('Show recent agent traces')
  .option('-n, --limit <n>', 'Number of spans to show', '20')
  .option('-f, --follow', 'Keep watching for new spans')
  .action(async (opts: { limit: string; follow?: boolean }) => {
    const { TraceCollector } = await import('./traces');
    const collector = new TraceCollector();
    const limit = parseInt(opts.limit) || 20;

    const printSpans = (spans: readonly Span[]) => {
      const slice = spans.slice(-limit);
      if (slice.length === 0) {
        console.log(`  ${icon.info} No traces yet. Interact with the agent to generate traces.`);
        return;
      }
      for (const span of slice) {
        const duration = span.endTime
          ? `${span.endTime.getTime() - span.startTime.getTime()}ms`
          : 'ongoing';
        const statusIcon = span.status === 'ok' ? icon.success : span.status === 'error' ? icon.error : color.dim('○');
        const time = span.startTime.toLocaleTimeString();
        console.log(`  ${statusIcon} ${color.dim(time)} ${color.bold(span.name)} ${color.dim(duration)}`);
      }
    };

    console.log(`\n${icon.gear} ${color.bold('Agent Traces')}\n`);
    const spans = collector.getBufferedSpans();
    printSpans(spans);

    if (opts.follow) {
      console.log(`\n  ${color.dim('Watching for new traces... (Ctrl+C to stop)')}\n`);
      let lastCount = spans.length;
      const interval = setInterval(() => {
        const current = collector.getBufferedSpans();
        if (current.length > lastCount) {
          const newSpans = current.slice(lastCount);
          printSpans(newSpans);
          lastCount = current.length;
        }
      }, 1000);
      process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
    } else {
      console.log();
    }
  });

// ── Score command ────────────────────────────────────────────

program
  .command('score')
  .description('Show agent performance score')
  .action(async () => {
    console.log(`\n${icon.gear} ${color.bold('Agent Performance Score')}\n`);
    try {
      const engine = new AnalyticsEngine('.');
      const stats = engine.getStats();
      if (!stats || stats.totalMessages === 0) {
        console.log(`  ${icon.info} No score data yet. Run the agent first.\n`);
        return;
      }
      const errorRate = stats.totalMessages > 0 ? (stats.totalErrors / stats.totalMessages) : 0;
      const rows: [string, string][] = [
        ['Total Messages', String(stats.totalMessages)],
        ['Total LLM Calls', String(stats.totalLLMCalls)],
        ['Total Tool Uses', String(stats.totalToolUses)],
        ['Avg Response Time', `${stats.avgResponseTimeMs}ms`],
        ['Error Rate', `${(errorRate * 100).toFixed(1)}%`],
        ['Token Usage', `${stats.totalTokens.total} tokens (in: ${stats.totalTokens.input}, out: ${stats.totalTokens.output})`],
      ];
      const maxKey = Math.max(...rows.map(([k]) => k.length));
      for (const [key, val] of rows) {
        console.log(`  ${color.cyan(key.padEnd(maxKey))}  ${val}`);
      }
      console.log();
    } catch {
      console.log(`  ${icon.info} No score data yet. Run the agent first.\n`);
    }
  });

// ── Daemon commands (start/stop/status) ─────────────────────

const OPC_DIR = path.resolve('.opc');

program
  .command('start')
  .description('Start agent as a background daemon')
  .option('-f, --file <file>', 'OAD file (agent.yaml or oad.yaml)')
  .action(async () => {
    if (!fs.existsSync(OPC_DIR)) fs.mkdirSync(OPC_DIR, { recursive: true });
    const pidFile = path.join(OPC_DIR, 'agent.pid');

    // Check if already running
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      try { process.kill(pid, 0); console.log(`${icon.warn} Agent already running (PID ${pid}).`); return; } catch { /* stale */ }
    }

    // Find daemon entry point
    const daemonScript = path.join(__dirname, 'daemon.js');
    if (!fs.existsSync(daemonScript)) {
      console.error(`${icon.error} Daemon script not found. Run ${color.cyan('npm run build')} first.`);
      process.exit(1);
    }

    const logFile = path.join(OPC_DIR, 'agent.log');
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn(process.execPath, [daemonScript], {
      detached: true,
      stdio: ['ignore', out, err],
      cwd: process.cwd(),
      env: process.env,
    });

    child.unref();

    // Wait briefly for PID file
    await new Promise(r => setTimeout(r, 1000));

    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf-8').trim();
      console.log(`${icon.success} Agent started (PID ${pid})`);
      console.log(`   ${color.dim('Logs:')} ${logFile}`);
      console.log(`   ${color.dim('Stop:')} opc stop`);
    } else {
      console.log(`${icon.success} Agent starting... (PID ${child.pid})`);
      console.log(`   ${color.dim('Logs:')} ${logFile}`);
    }
  });

program
  .command('stop')
  .description('Stop the background daemon')
  .action(() => {
    const pidFile = path.join(OPC_DIR, 'agent.pid');
    if (!fs.existsSync(pidFile)) {
      console.log(`${icon.info} No running agent found.`);
      return;
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      // On Windows, process.kill with SIGTERM may not work; use taskkill
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* ignore */ }
      } else {
        process.kill(pid, 'SIGTERM');
      }
      console.log(`${icon.success} Sent stop signal to PID ${pid}`);
    } catch {
      console.log(`${icon.warn} Process ${pid} not found (may have already stopped).`);
    }
    try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
  });

program
  .command('status')
  .description('Check daemon status')
  .action(() => {
    const pidFile = path.join(OPC_DIR, 'agent.pid');
    if (!fs.existsSync(pidFile)) {
      console.log(`\n  Status: ${color.red('stopped')}\n`);
      return;
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    let running = false;
    try { process.kill(pid, 0); running = true; } catch { /* not running */ }

    if (!running) {
      console.log(`\n  Status: ${color.red('stopped')} (stale PID file)`);
      try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
      console.log();
      return;
    }

    // Uptime
    const startedFile = path.join(OPC_DIR, 'started');
    let uptime = '';
    if (fs.existsSync(startedFile)) {
      const startedMs = parseInt(fs.readFileSync(startedFile, 'utf-8').trim(), 10);
      const secs = Math.floor((Date.now() - startedMs) / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      uptime = `${h}h ${m}m ${s}s`;
    }

    // Agent name from config
    let agentName = 'unknown';
    for (const f of ['agent.yaml', 'oad.yaml']) {
      if (fs.existsSync(f)) {
        try {
          const raw = fs.readFileSync(f, 'utf-8');
          const cfg = yaml.load(raw) as any;
          if (cfg?.metadata?.name) { agentName = cfg.metadata.name; break; }
        } catch { /* ignore */ }
      }
    }

    console.log(`\n  Status:  ${color.green('running')}`);
    console.log(`  PID:     ${pid}`);
    console.log(`  Agent:   ${color.cyan(agentName)}`);
    if (uptime) console.log(`  Uptime:  ${uptime}`);
    console.log();
  });

// ── Jobs commands ────────────────────────────────────────────

const jobsCmd = program.command('jobs').description('Manage scheduled jobs');

jobsCmd
  .command('list', { isDefault: true })
  .description('List all scheduled jobs')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    const jobs = loadJobsFromConfig(opts.file);
    if (jobs.length === 0) {
      console.log(`\n${icon.info} No scheduled jobs defined in config.\n`);
      return;
    }
    console.log(`\n${icon.gear} ${color.bold('Scheduled Jobs')}\n`);
    for (const job of jobs) {
      const status = job.enabled ? color.green('enabled') : color.dim('disabled');
      const next = job.nextRun ? job.nextRun.toLocaleString() : color.dim('N/A');
      console.log(`  ${color.cyan(job.id.padEnd(20))} ${job.name}`);
      console.log(`  ${''.padEnd(20)} Schedule: ${color.dim(job.schedule)} | Status: ${status} | Next: ${next}`);
      console.log();
    }
  });

jobsCmd
  .command('run')
  .argument('<id>', 'Job ID to run')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .description('Manually trigger a scheduled job')
  .action(async (id: string, opts: { file: string }) => {
    const jobs = loadJobsFromConfig(opts.file);
    const job = jobs.find(j => j.id === id || j.name === id);
    if (!job) {
      console.error(`${icon.error} Job "${id}" not found. Available: ${jobs.map(j => j.id).join(', ')}`);
      process.exit(1);
    }
    console.log(`${icon.info} Running job "${color.bold(job.name)}"...`);
    console.log(`  Task: ${color.dim(job.task)}`);
    console.log(`\n${icon.warn} Manual job execution requires a running daemon. Use ${color.cyan('opc start')} first.\n`);
  });

function loadJobsFromConfig(file: string): CronJob[] {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const config = yaml.load(raw) as any;
    const jobConfigs = config?.spec?.scheduler?.jobs ?? [];
    const { parseCron } = require('./core/scheduler');
    return jobConfigs.map((j: any, i: number) => {
      const id = j.id || j.name?.toLowerCase().replace(/\s+/g, '-') || `job-${i}`;
      const parsed = parseCron(j.schedule);
      // Compute next run
      const now = new Date();
      let nextRun: Date | undefined;
      const d = new Date(now);
      d.setSeconds(0, 0);
      d.setMinutes(d.getMinutes() + 1);
      for (let k = 0; k < 48 * 60; k++) {
        const { cronMatches } = require('./core/scheduler');
        if (cronMatches(parsed, d)) { nextRun = new Date(d); break; }
        d.setMinutes(d.getMinutes() + 1);
      }
      return {
        id,
        name: j.name || id,
        schedule: j.schedule,
        task: j.task || '',
        enabled: j.enabled !== false,
        nextRun,
      } as CronJob;
    });
  } catch {
    return [];
  }
}

// ── Skills commands ──────────────────────────────────────────

const skillsCmd = program.command('skills').description('Manage learned skills');

skillsCmd
  .command('list', { isDefault: true })
  .description('List all learned skills')
  .option('-d, --dir <dir>', 'Skills directory', '.opc/skills')
  .action(async (opts: { dir: string }) => {
    const { SkillLearner } = await import('./skills/auto-learn');
    const learner = new SkillLearner(opts.dir);
    const skills = await learner.loadLearnedSkills();
    if (skills.length === 0) {
      console.log(`\n${icon.info} No learned skills yet.\n`);
      console.log(`  Skills are auto-created from conversations when learning is enabled.`);
      console.log(`  Directory: ${color.dim(path.resolve(opts.dir))}\n`);
      return;
    }
    console.log(`\n${icon.gear} ${color.bold('Learned Skills')} (${skills.length})\n`);
    for (const skill of skills) {
      console.log(`  ${color.cyan(skill.name.padEnd(24))} ${skill.description}`);
      console.log(`  ${''.padEnd(24)} v${skill.version} | used ${skill.usageCount}x | trigger: ${color.dim(skill.trigger)}`);
      console.log();
    }
  });

skillsCmd
  .command('show')
  .argument('<name>', 'Skill name')
  .option('-d, --dir <dir>', 'Skills directory', '.opc/skills')
  .description('Show details of a learned skill')
  .action(async (name: string, opts: { dir: string }) => {
    const skillPath = path.join(opts.dir, `${name}.md`);
    if (!fs.existsSync(skillPath)) {
      console.error(`${icon.error} Skill "${name}" not found at ${skillPath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(skillPath, 'utf-8');
    console.log(`\n${content}`);
  });

skillsCmd
  .command('remove')
  .argument('<name>', 'Skill name')
  .option('-d, --dir <dir>', 'Skills directory', '.opc/skills')
  .description('Remove a learned skill')
  .action(async (name: string, opts: { dir: string }) => {
    const skillPath = path.join(opts.dir, `${name}.md`);
    if (!fs.existsSync(skillPath)) {
      console.error(`${icon.error} Skill "${name}" not found.`);
      process.exit(1);
    }
    fs.unlinkSync(skillPath);
    console.log(`${icon.success} Removed skill "${color.cyan(name)}".`);
  });

// ── Doctor command ───────────────────────────────────────────

program
  .command('studio')
  .description('Start OPC Studio web UI')
  .option('--port <port>', 'Port to listen on', '4000')
  .action(async (opts: any) => {
    const { StudioServer } = require('./studio/server');
    const server = new StudioServer({
      port: parseInt(opts.port, 10),
      agentDir: process.cwd(),
    });
    await server.start();
    console.log(color.dim('Press Ctrl+C to stop'));
  });

program
  .command('doctor')
  .description('Check environment and diagnose common issues')
  .action(async () => {
    await runDoctor();
  });

// ─── Eval command ───────────────────────────────────────────────────────────
import { AgentEvaluator } from './eval';

program
  .command('eval')
  .argument('[suite]', 'Built-in suite name (basic, safety, memory) or omit for all')
  .option('-f, --file <path>', 'Path to custom eval suite JSON file')
  .option('-o, --output <path>', 'Save report to JSON file')
  .option('-v, --verbose', 'Show per-case details')
  .description('Run agent evaluation suites')
  .action(async (suiteName: string | undefined, opts: { file?: string; output?: string; verbose?: boolean }) => {
    const suites: import('./eval').EvalSuite[] = [];

    if (opts.file) {
      suites.push(AgentEvaluator.loadSuite(opts.file));
    } else if (suiteName) {
      suites.push(AgentEvaluator.loadBuiltinSuite(suiteName));
    } else {
      // All built-in suites
      for (const s of AgentEvaluator.builtinSuites()) {
        suites.push(AgentEvaluator.loadBuiltinSuite(s.name));
      }
    }

    if (!suites.length) {
      console.log(`${icon.warn} No eval suites found.`);
      return;
    }

    // Create a minimal mock agent for eval (real usage would load from OAD)
    const oadPath = path.resolve('agent.yaml');
    let agent: any;
    if (fs.existsSync(oadPath)) {
      const runtime = new AgentRuntime();
      await runtime.loadConfig(oadPath);
      await runtime.start();
      agent = (runtime as any).agent;
    }

    if (!agent) {
      console.log(`${icon.warn} No agent.yaml found — running with dry-run mock agent.`);
      agent = { chat: async (input: string) => `[mock response to: ${input}]` };
    }

    const evaluator = new AgentEvaluator(agent);
    let allPassed = 0, allTotal = 0;

    for (const suite of suites) {
      console.log(`\n${color.bold(`🧪 Suite: ${suite.name}`)} (${suite.cases.length} cases)`);
      const report = await evaluator.evalSuite(suite);
      allPassed += report.passed;
      allTotal += report.totalCases;

      for (const r of report.results) {
        const status = r.passed ? color.green('PASS') : color.red('FAIL');
        console.log(`  ${status}  ${r.caseId}`);
        if (opts.verbose && !r.passed) {
          if (r.error) console.log(`         ${color.dim('error: ' + r.error)}`);
          console.log(`         ${color.dim('output: ' + r.output.slice(0, 120))}`);
        }
      }

      console.log(`  ${color.dim(report.summary)}`);

      if (opts.output) {
        const outPath = suites.length > 1
          ? opts.output.replace('.json', `-${suite.name}.json`)
          : opts.output;
        AgentEvaluator.saveReport(report, outPath);
        console.log(`  ${icon.success} Report saved to ${outPath}`);
      }
    }

    console.log(`\n${color.bold('Summary:')} ${allPassed}/${allTotal} passed (${allTotal ? Math.round(allPassed / allTotal * 100) : 0}%)`);
  });

program.parse();

// ── Keys command ──────────────────────────────────────────────

import { KeyManager } from './security/keys';
import { ApprovalManager } from './security/approval';

const keysCmd = program.command('keys').description('Manage API keys');

keysCmd
  .command('set')
  .argument('<name>', 'Key name')
  .description('Store an API key (encrypted)')
  .action(async (name: string) => {
    const value = await promptUser(`Enter value for ${color.bold(name)}`);
    if (!value) {
      console.log(`${icon.error} No value provided.`);
      return;
    }
    const km = new KeyManager();
    km.set(name, value);
    console.log(`${icon.success} Key ${color.bold(name)} saved.`);
  });

keysCmd
  .command('list')
  .description('List stored key names')
  .action(() => {
    const km = new KeyManager();
    const names = km.list();
    if (names.length === 0) {
      console.log(`${icon.info} No keys stored.`);
      return;
    }
    console.log(`\n${color.bold('Stored keys:')}`);
    names.forEach(n => console.log(`  • ${n}`));
  });

keysCmd
  .command('delete')
  .argument('<name>', 'Key name')
  .description('Delete a stored key')
  .action((name: string) => {
    const km = new KeyManager();
    if (km.delete(name)) {
      console.log(`${icon.success} Key ${color.bold(name)} deleted.`);
    } else {
      console.log(`${icon.error} Key ${color.bold(name)} not found.`);
    }
  });

// ── Approve command ───────────────────────────────────────────

const approveCmd = program.command('approve').description('Manage command approvals');

// Singleton for CLI — in real usage this would be loaded from daemon state
const approvalManager = new ApprovalManager();

approveCmd
  .command('list')
  .description('Show pending approval requests')
  .action(() => {
    const pending = approvalManager.getPending();
    if (pending.length === 0) {
      console.log(`${icon.info} No pending approvals.`);
      return;
    }
    console.log(`\n${color.bold('Pending approvals:')}`);
    pending.forEach(r => {
      console.log(`  ${color.cyan(r.id.slice(0, 8))} [${r.type}] ${r.command}`);
      console.log(`    ${color.dim(r.description)}`);
    });
  });

approveCmd
  .command('allow')
  .argument('<id>', 'Approval request ID (prefix match)')
  .description('Approve a pending request')
  .action((id: string) => {
    const pending = approvalManager.getPending();
    const match = pending.find(r => r.id.startsWith(id));
    if (!match) {
      console.log(`${icon.error} No pending request matching ${id}`);
      return;
    }
    approvalManager.approve(match.id, 'cli-user');
    console.log(`${icon.success} Approved: ${match.command}`);
  });

approveCmd
  .command('deny')
  .argument('<id>', 'Approval request ID (prefix match)')
  .description('Deny a pending request')
  .action((id: string) => {
    const pending = approvalManager.getPending();
    const match = pending.find(r => r.id.startsWith(id));
    if (!match) {
      console.log(`${icon.error} No pending request matching ${id}`);
      return;
    }
    approvalManager.deny(match.id, 'cli-user');
    console.log(`${icon.success} Denied: ${match.command}`);
  });

// ── Traces command ────────────────────────────────────────────

import { Tracer, FileExporter } from './telemetry';

program
  .command('traces')
  .option('-l, --limit <n>', 'Number of traces to show', '20')
  .option('-f, --file <path>', 'Read traces from file')
  .description('Show recent telemetry traces')
  .action(async (opts: { limit: string; file?: string }) => {
    const limit = parseInt(opts.limit) || 20;

    if (opts.file) {
      // Read from NDJSON file
      const fs = require('fs');
      if (!fs.existsSync(opts.file)) {
        console.log(`${icon.error} File not found: ${opts.file}`);
        return;
      }
      const lines = fs.readFileSync(opts.file, 'utf-8').trim().split('\n');
      const spans = lines.slice(-limit).map((l: string) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      printTraceTable(spans);
    } else {
      // Try to read from Studio API
      try {
        const oad = loadOADFile();
        const port = 4000; // default studio port
        const res = await fetch(`http://localhost:${port}/api/telemetry/traces?limit=${limit}`);
        const data = await res.json() as any;
        if (data.traces && data.traces.length > 0) {
          console.log(`\n${color.bold('Recent Traces')} (${data.traces.length})\n`);
          console.log(`${'Trace ID'.padEnd(12)} ${'Root Span'.padEnd(25)} ${'Time'.padEnd(22)} ${'Spans'.padEnd(7)} ${'Status'}`);
          console.log(`${'─'.repeat(12)} ${'─'.repeat(25)} ${'─'.repeat(22)} ${'─'.repeat(7)} ${'─'.repeat(8)}`);
          for (const t of data.traces) {
            const time = new Date(t.startTime).toISOString().slice(0, 19).replace('T', ' ');
            const statusColor = t.status === 'ok' ? color.green : t.status === 'error' ? color.red : color.dim;
            console.log(`${color.cyan(t.traceId.slice(0, 12))} ${t.rootSpan.padEnd(25).slice(0, 25)} ${time.padEnd(22)} ${String(t.spanCount).padEnd(7)} ${statusColor(t.status)}`);
          }
        } else {
          console.log(`${icon.info} No traces found. Enable telemetry in your OAD: spec.telemetry.enabled: true`);
        }
      } catch {
        console.log(`${icon.error} Could not connect to Studio. Is it running? (opc studio)`);
      }
    }
  });

function printTraceTable(spans: any[]) {
  if (spans.length === 0) {
    console.log(`${icon.info} No traces found.`);
    return;
  }
  console.log(`\n${color.bold('Recent Spans')} (${spans.length})\n`);
  console.log(`${'Trace ID'.padEnd(12)} ${'Span'.padEnd(25)} ${'Duration'.padEnd(10)} ${'Status'}`);
  console.log(`${'─'.repeat(12)} ${'─'.repeat(25)} ${'─'.repeat(10)} ${'─'.repeat(8)}`);
  for (const s of spans) {
    const dur = s.endTime ? `${s.endTime - s.startTime}ms` : 'ongoing';
    const statusColor = s.status === 'ok' ? color.green : s.status === 'error' ? color.red : color.dim;
    console.log(`${color.cyan(s.traceId.slice(0, 12))} ${s.name.padEnd(25).slice(0, 25)} ${dur.padEnd(10)} ${statusColor(s.status)}`);
  }
}

// ── A2A Protocol Commands ───────────────────────────────────
const a2aCmd = program.command('a2a').description('Google A2A protocol commands');

a2aCmd
  .command('serve')
  .option('-p, --port <port>', 'Port for A2A server', '3001')
  .description('Start A2A server for this agent')
  .action(async (opts: { port: string }) => {
    const port = parseInt(opts.port) || 3001;
    const { A2AServer } = require('./protocols/a2a');
    const oad = loadOADFile();
    const server = new A2AServer(null, { oad, port });
    await server.start(port);
    console.log(`${icon.success} A2A server running on http://localhost:${port}`);
    console.log(`${icon.info} Agent card: http://localhost:${port}/.well-known/agent.json`);
  });

a2aCmd
  .command('card')
  .description('Print this agent\'s A2A card')
  .action(() => {
    const { oadToAgentCard } = require('./protocols/a2a');
    const oad = loadOADFile();
    if (!oad) { console.log(`${icon.error} No agent.yaml found`); return; }
    const card = oadToAgentCard(oad, 'http://localhost:3001');
    console.log(JSON.stringify(card, null, 2));
  });

a2aCmd
  .command('discover')
  .argument('<url>', 'Remote agent URL')
  .description('Fetch remote agent\'s A2A card')
  .action(async (url: string) => {
    const { A2AClient } = require('./protocols/a2a');
    const client = new A2AClient(url);
    try {
      const card = await client.getAgentCard();
      console.log(JSON.stringify(card, null, 2));
    } catch (err: any) {
      console.log(`${icon.error} Failed to discover agent: ${err.message}`);
    }
  });

a2aCmd
  .command('call')
  .argument('<url>', 'Remote agent URL')
  .argument('<message>', 'Message to send')
  .description('Call a remote A2A agent')
  .action(async (url: string, message: string) => {
    const { A2AClient } = require('./protocols/a2a');
    const client = new A2AClient(url);
    try {
      const response = await client.sendText(message);
      console.log(response);
    } catch (err: any) {
      console.log(`${icon.error} Call failed: ${err.message}`);
    }
  });

function loadOADFile(): any {
  const fs = require('fs');
  const yaml = require('js-yaml');
  for (const name of ['agent.yaml', 'agent.yml']) {
    if (fs.existsSync(name)) {
      return yaml.load(fs.readFileSync(name, 'utf-8'));
    }
  }
  return null;
}

// ── MCP Server Commands ────────────────────────────────────
const mcpCmd = program.command('mcp').description('MCP server commands — expose agent as MCP tools');

mcpCmd
  .command('serve')
  .option('--http <port>', 'Start HTTP+SSE mode on given port')
  .description('Start MCP server (stdio by default, --http for HTTP+SSE)')
  .action(async (opts: { http?: string }) => {
    const { MCPServer } = require('./protocols/mcp');
    const { agentToMCPTools, agentToMCPResources } = require('./protocols/mcp');
    const oad = loadOADFile();
    const agentName = oad?.metadata?.name || 'opc-agent';
    const server = new MCPServer({
      name: agentName,
      version: oad?.metadata?.version || '1.0.0',
    });
    // Register tools from OAD or defaults
    const { agentToMCPTools: toTools } = require('./protocols/mcp/agent-tools');
    const mockAgent = { name: agentName, config: { name: agentName } };
    const tools = toTools(mockAgent);
    for (const t of tools) server.addTool(t);

    if (opts.http) {
      const port = parseInt(opts.http) || 3002;
      await server.serveHTTP(port);
      console.log(`${icon.success} MCP server (HTTP+SSE) running on http://localhost:${port}`);
      console.log(`${icon.info} SSE endpoint: http://localhost:${port}/sse`);
      console.log(`${icon.info} Message endpoint: http://localhost:${port}/message`);
      console.log(`${icon.info} Tools: ${server.getToolCount()}`);
    } else {
      console.error(`${icon.success} MCP server (stdio) started — ${server.getToolCount()} tools`);
      await server.serveStdio();
    }
  });

mcpCmd
  .command('tools')
  .description('List MCP tools that would be exposed')
  .action(() => {
    const { agentToMCPTools } = require('./protocols/mcp/agent-tools');
    const oad = loadOADFile();
    const agentName = oad?.metadata?.name || 'opc-agent';
    const tools = agentToMCPTools({ name: agentName });
    console.log(`\n${icon.gear} MCP Tools for ${color.cyan(agentName)}:\n`);
    for (const t of tools) {
      const required = t.inputSchema?.required?.join(', ') || 'none';
      console.log(`  ${color.green(t.name.padEnd(20))} ${t.description}`);
      console.log(`  ${' '.repeat(20)} Required: ${color.dim(required)}`);
    }
    console.log();
  });
