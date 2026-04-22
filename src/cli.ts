#!/usr/bin/env node
const { dynamicImport } = require('./utils/dynamic-import');
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import * as readline from 'readline';
import { AgentRuntime } from './core/runtime';
import { fetchModelList, detectSystem, recommendModels, clearModelCache, cacheInfo } from './core/model-recommender';
import type { ModelRec } from './core/model-recommender';
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
import { AgentDeployer } from './deploy/index';
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
import { fetchTemplates as hubFetchTemplates, fetchTemplate as hubFetchTemplate, fetchBrainSeeds, isHubAvailable } from './hub/client';
import type { HubTemplate } from './hub/client';
import { downloadAndLearnBrainSeeds } from './hub/brain-seed';

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
  .version(require('../package.json').version);

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

      console.log(`  ${icon.info} Matched role: ${color.cyan(matched.category + '/' + matched.role)} - ${roleDisplayName}`);

      // Create directories
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(path.join(dir, 'src', 'skills'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'brain-seeds'), { recursive: true });

      // Get system prompt content
      const systemPromptContent = roleData.files['system-prompt.md'] || roleData.files['prompts/system.md'] || '';

      // Generate brain-seeds/ files from role data
      const brainSeedContent = roleData.files['brain-seed.md'] || '';
      const industryMatch = brainSeedContent ? brainSeedContent.match(/# Industry Knowledge[\s\S]*?(?=# Job Knowledge|# Workstation Knowledge|$)/i) : null;
      const jobMatch = brainSeedContent ? brainSeedContent.match(/# Job Knowledge[\s\S]*?(?=# Industry Knowledge|# Workstation Knowledge|$)/i) : null;
      const workstationMatch = brainSeedContent ? brainSeedContent.match(/# Workstation Knowledge[\s\S]*?(?=# Industry Knowledge|# Job Knowledge|$)/i) : null;

      fs.writeFileSync(path.join(dir, 'brain-seeds', 'industry.md'), industryMatch?.[0]?.trim() || `# Industry Knowledge\n\n## Overview\n\nAdd industry-specific knowledge for your domain.\n`);
      fs.writeFileSync(path.join(dir, 'brain-seeds', 'job.md'), jobMatch?.[0]?.trim() || `# Job Knowledge\n\n## Core Skills\n\nAdd role-specific knowledge for ${roleDisplayName}.\n`);
      // workstation.md: public workstation knowledge (tools, workflows, best practices)
      // Company-specific knowledge belongs to Desk (closed-source), not here.
      const workstationSeedFromRole = workstationMatch?.[0]?.trim() || '';
      fs.writeFileSync(path.join(dir, 'brain-seeds', 'workstation.md'), workstationSeedFromRole || `# Workstation Knowledge\n\n## Tools & Environment\n\nCommon tools and setup for this workstation role.\n\n## Workflows\n\nStandard operating procedures and workflows.\n\n## Best Practices\n\nIndustry best practices for this role.\n`);

      // oad.yaml with role system prompt and brain seeds（不再生成 agent.yaml）
      const firstLine = systemPromptContent.split('\n').find((l: string) => l.trim() && !l.startsWith('#'))?.trim() || 'You are a helpful AI assistant.';
      fs.writeFileSync(
        path.join(dir, 'oad.yaml'),
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
  brain:
    seeds:
      - brain-seeds/industry.md
      - brain-seeds/job.md
      - brain-seeds/workstation.md
    autoSeed: true
    evolve:
      enabled: true
      direction: bottom-up
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

      // .opc/ directory — runtime state
      fs.mkdirSync(path.join(dir, '.opc'), { recursive: true });

      // DEEPBRAIN.md — long-term memory seed
      fs.writeFileSync(
        path.join(dir, 'DEEPBRAIN.md'),
        `# DeepBrain Memory\n\nThis file seeds the agent's long-term knowledge store.\n`,
      );

      // data/brain-seed.md if available
      if (roleData.files['brain-seed.md']) {
        fs.writeFileSync(path.join(dir, 'data', 'brain-seed.md'), roleData.files['brain-seed.md']);
      }

      // oad.yaml from role
      if (roleData.files['oad.yaml']) {
        fs.writeFileSync(path.join(dir, 'oad.yaml'), roleData.files['oad.yaml']);
      }

      // src/index.ts - entry point (same as generic)
      fs.writeFileSync(
        path.join(dir, 'src', 'index.ts'),
        `import { AgentRuntime } from 'opc-agent';
import { EchoSkill } from './skills/echo';
import { readFileSync, existsSync } from 'fs';

async function main() {
  const runtime = new AgentRuntime();
  const config = await runtime.loadConfig('./oad.yaml');

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
      fs.writeFileSync(path.join(dir, '.env.example'), `# LLM API Configuration\n# Ollama (免费本地，默认，无需 API key):\nOPC_LLM_BASE_URL=http://localhost:11434/v1\nOPC_LLM_MODEL=qwen2.5\n\n# 如需使用商业模型，取消以下注释:\n# OPC_LLM_API_KEY=your-api-key-here\n# OPC_LLM_BASE_URL=https://api.deepseek.com/v1\n# OPC_LLM_MODEL=deepseek-chat\n`);
      fs.writeFileSync(path.join(dir, '.env'), `# Ollama (免费本地) - 无需 API key\nOPC_LLM_BASE_URL=http://localhost:11434/v1\nOPC_LLM_MODEL=qwen2.5\n`);

      // README.md
      fs.writeFileSync(
        path.join(dir, 'README.md'),
        `# ${name}\n\nCreated with [OPC Agent](https://github.com/Deepleaper/opc-agent) using the \`${matched.category}/${matched.role}\` workstation role.\n\n## Quick Start\n\n\`\`\`bash\nnpm install\nollama pull qwen2.5\nnpx tsx src/index.ts\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000)\n`,
      );

      // Dockerfile + docker-compose
      fs.writeFileSync(path.join(dir, 'Dockerfile'), `FROM node:22-alpine\nWORKDIR /app\nCOPY package.json package-lock.json* ./\nRUN npm ci --production 2>/dev/null || npm install --production\nCOPY oad.yaml .env* ./\nCOPY src/ ./src/\nCOPY prompts/ ./prompts/ 2>/dev/null || true\nEXPOSE 3000\nCMD ["npx", "opc", "run"]\n`);
      fs.writeFileSync(path.join(dir, 'docker-compose.yml'), `version: '3.8'\nservices:\n  agent:\n    build: .\n    ports:\n      - "3000:3000"\n    env_file:\n      - .env\n    volumes:\n      - ./oad.yaml:/app/oad.yaml:ro\n    restart: unless-stopped\n`);

      console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')} from role ${color.cyan(matched.category + '/' + matched.role)}`);
      console.log(`   ${icon.file} oad.yaml         - Agent definition with role system prompt`);
      console.log(`   ${icon.file} SOUL.md          - Role personality (${systemPromptContent.split('\n').length} lines)`);
      console.log(`   ${icon.file} CONTEXT.md       - Role context & documentation`);
      console.log(`   ${icon.file} brain-seeds/     - 3-tier brain seed knowledge`);
      console.log(`     ${color.dim('├')} industry.md    - Industry knowledge`);
      console.log(`     ${color.dim('├')} job.md         - Job/role knowledge`);
      console.log(`     ${color.dim('└')} workstation.md - Workstation knowledge`);
      if (roleData.files['brain-seed.md']) {
        console.log(`   ${icon.file} data/brain-seed.md - Role brain seed knowledge (legacy)`);
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

    // Try fetching templates from Hub API, fall back to bundled
    let hubTemplates: HubTemplate[] = [];
    let useHub = false;
    try {
      const hubAvailable = await isHubAvailable();
      if (hubAvailable) {
        hubTemplates = await hubFetchTemplates();
        if (hubTemplates.length > 0) useHub = true;
      }
    } catch {
      // Hub unreachable - fall back to bundled templates
    }

    let template: string;
    let selectedHubTemplate: HubTemplate | undefined;
    if (opts.yes) {
      template = opts.template ?? 'customer-service';
    } else if (opts.template) {
      template = opts.template;
      if (useHub) selectedHubTemplate = hubTemplates.find(t => t.id === template);
    } else if (useHub) {
      console.log(`  ${icon.info} ${color.dim('Using templates from Workstation Hub')}`);
      template = await select('Select a template:', hubTemplates.map(t => ({ value: t.id, label: `${t.name} - ${t.description}` })));
      selectedHubTemplate = hubTemplates.find(t => t.id === template);
    } else {
      template = await select('Select a template:', Object.entries(TEMPLATES).map(([value, { label }]) => ({ value, label })));
    }

    // ── 硬件检测 + 智能模型推荐 ──
    // ── 硬件检测 + 远程模型推荐 ──
    const sys = detectSystem();
    const allModels = await fetchModelList();

    // ── LLM Provider 选择（Ollama-first）──
    let llmProvider = 'ollama';
    let llmModel = 'qwen2.5';
    let llmBaseUrl = 'http://localhost:11434/v1';
    let llmApiKey = '';
    let ollamaRunning = false;
    let modelNames: string[] = [];

    // 无论 --yes 还是交互式，都先检测 Ollama
    try {
      const controller = new AbortController();
      const ollamaTimeout = setTimeout(() => controller.abort(), 3000);
      const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
      clearTimeout(ollamaTimeout);
      const ollamaData = await ollamaRes.json() as any;
      modelNames = (ollamaData.models || []).map((m: any) => m.name || m.model);
      ollamaRunning = true;
      if (opts.yes && modelNames.length > 0) {
        const rec = recommendModels(allModels, sys, modelNames);
        // --yes: prefer best installed recommended model
        const bestInstalled = rec.installed.length > 0 ? rec.installed[rec.installed.length - 1] : null;
        // Filter out embedding-only models (can't chat)
        const chatModels = modelNames.filter(m => !m.includes('embed'));
        llmModel = bestInstalled ? bestInstalled.name : (chatModels[0] || 'qwen2.5:7b');
      }
    } catch {
      ollamaRunning = false;
    }

    // Compute recommendation (used by both interactive branches)
    const rec = recommendModels(allModels, sys, modelNames);

    if (!opts.yes) {
      if (ollamaRunning) {
        console.log(`\n  ${icon.info} ${color.dim('正在检测 Ollama...')}`);
        console.log(`  ${icon.success} Ollama 已运行，发现 ${modelNames.length} 个模型`);
        console.log(`  ${icon.info} 系统: ${sys.totalRAM}GB RAM (${sys.freeRAM}GB 可用), ${sys.cpuCount} CPU cores`);
        console.log(`  ${icon.info} 推荐模型: ${color.cyan(rec.best.name)} (${rec.best.size}) - ${rec.best.desc}`);

        // 选择 provider
        llmProvider = await select('选择 LLM 引擎:', [
          { value: 'ollama', label: '🟢 Ollama (免费本地，推荐) - 已检测到运行中' },
          { value: 'deepseek', label: '🔵 DeepSeek - 高性价比国产模型' },
          { value: 'openai', label: '⚪ OpenAI (GPT-4o)' },
          { value: 'anthropic', label: '🟣 Anthropic (Claude)' },
          { value: 'custom', label: '⚙️  自定义 (手动输入 Base URL)' },
        ]);

        if (llmProvider === 'ollama') {
          // 已有模型 + 推荐未下载的模型
          const modelOptions = [
            ...rec.installed.map((m: ModelRec) => {
              const isBest = m.name === rec.best.name ? ' ⭐推荐' : '';
              return { value: m.name, label: `${m.name} (${m.size}, ${m.desc})${isBest} [已安装]` };
            }),
            // Also show installed models not in recommendation list
            ...modelNames.filter(n => !rec.installed.find(m => m.name === n)).map(n => (
              { value: n, label: `${n} [已安装]` }
            )),
            ...rec.toDownload.map((m: ModelRec) => ({
              value: `pull:${m.name}`,
              label: `${m.name} (${m.size}, ${m.desc}) [需下载]`,
            })),
          ];

          if (modelOptions.length > 0) {
            const chosen = await select('选择 Ollama 模型:', modelOptions);
            if (chosen.startsWith('pull:')) {
              const pullModel = chosen.slice(5);
              console.log(`\n  ${icon.info} 正在下载 ${color.cyan(pullModel)}...`);
              console.log(`     运行 ${color.cyan(`ollama pull ${pullModel}`)} 下载`);
              console.log(`     下载完成后运行 ${color.cyan('opc run')} 启动\n`);
              llmModel = pullModel;
            } else {
              llmModel = chosen;
            }
          } else {
            // 没有本地模型，推荐下载
            console.log(`  ${color.yellow('⚠️')}  没有发现已下载的模型`);
            console.log(`  ${icon.info} 根据你的硬件 (${sys.freeRAM}GB 可用)，推荐下载:`);
            for (const m of rec.suitable.slice(-3)) {
              console.log(`     ${color.cyan(`ollama pull ${m.name}`)}  (${m.size}, ${m.desc})`);
            }
            llmModel = rec.best.name;
          }
        }
      } else {
        // Ollama not running
        console.log(`\n  ${icon.info} ${color.dim('正在检测 Ollama...')}`);
        console.log(`  ${color.yellow('⚠️')}  Ollama 未运行或未安装`);

        llmProvider = await select('选择 LLM 引擎:', [
          { value: 'ollama', label: '🟢 Ollama (免费本地，推荐) - 需先安装: https://ollama.ai' },
          { value: 'deepseek', label: '🔵 DeepSeek - 高性价比国产模型' },
          { value: 'openai', label: '⚪ OpenAI (GPT-4o)' },
          { value: 'anthropic', label: '🟣 Anthropic (Claude)' },
          { value: 'custom', label: '⚙️  自定义 (手动输入 Base URL)' },
        ]);

        if (llmProvider === 'ollama') {
          console.log(`\n  ${icon.info} Ollama 安装指南:`);
          console.log(`     1. 访问 ${color.cyan('https://ollama.ai')} 下载并安装`);
          console.log(`  ${icon.info} 根据你的硬件 (${sys.totalRAM}GB RAM, ${sys.freeRAM}GB 可用)，推荐:`);
          for (const m of rec.suitable.slice(-3)) {
            console.log(`     ${color.cyan(`ollama pull ${m.name}`)}  (${m.size}, ${m.desc})`);
          }
          console.log(`     3. 然后 ${color.cyan('opc run')} 即可开始对话\n`);
          llmModel = rec.best.name;
        }
      }

      // 商业模型需要 API key
      if (llmProvider === 'deepseek') {
        llmBaseUrl = 'https://api.deepseek.com/v1';
        llmModel = 'deepseek-chat';
        llmApiKey = await promptUser('输入 DeepSeek API Key (可稍后在 .env 中配置，直接回车跳过)');
        if (!llmApiKey) {
          console.log(`  ${icon.info} 稍后在 ${color.cyan('.env')} 文件中设置 ${color.bold('OPC_LLM_API_KEY')}`);
        }
      } else if (llmProvider === 'openai') {
        llmBaseUrl = 'https://api.openai.com/v1';
        llmModel = 'gpt-4o-mini';
        llmApiKey = await promptUser('输入 OpenAI API Key (可稍后在 .env 中配置，直接回车跳过)');
        if (!llmApiKey) {
          console.log(`  ${icon.info} 稍后在 ${color.cyan('.env')} 文件中设置 ${color.bold('OPC_LLM_API_KEY')}`);
        }
      } else if (llmProvider === 'anthropic') {
        llmBaseUrl = 'https://api.anthropic.com/v1';
        llmModel = 'claude-sonnet-4-20250514';
        llmApiKey = await promptUser('输入 Anthropic API Key (可稍后在 .env 中配置，直接回车跳过)');
        if (!llmApiKey) {
          console.log(`  ${icon.info} 稍后在 ${color.cyan('.env')} 文件中设置 ${color.bold('OPC_LLM_API_KEY')}`);
        }
      } else if (llmProvider === 'custom') {
        llmBaseUrl = await promptUser('输入 Base URL', 'http://localhost:11434/v1');
        llmModel = await promptUser('输入模型名称', 'qwen2.5');
        llmApiKey = await promptUser('输入 API Key (可选，直接回车跳过)');
        // 尝试推断 provider
        if (llmBaseUrl.includes('deepseek.com')) llmProvider = 'deepseek';
        else if (llmBaseUrl.includes('openai.com')) llmProvider = 'openai';
        else if (llmBaseUrl.includes('anthropic.com')) llmProvider = 'anthropic';
        else if (llmBaseUrl.includes('localhost:11434')) llmProvider = 'ollama';
        else llmProvider = 'openai'; // OpenAI-compatible fallback
      }
    }

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

    // 用用户选择的 provider 和 model 覆盖模板默认值
    config.spec.model = llmModel;
    config.spec.provider = { default: llmProvider };

    // Ensure web channel exists
    if (!config.spec.channels.some((c: any) => c.type === 'web')) {
      config.spec.channels.push({ type: 'web', port: 3000 });
    }

    // 只生成 oad.yaml，不生成 agent.yaml
    fs.writeFileSync(path.join(dir, 'oad.yaml'), yaml.dump(config, { lineWidth: 120 }));

    // src/index.ts - entry point
    fs.writeFileSync(
      path.join(dir, 'src', 'index.ts'),
      `import { AgentRuntime } from 'opc-agent';
import { EchoSkill } from './skills/echo';
import { readFileSync, existsSync } from 'fs';

async function main() {
  const runtime = new AgentRuntime();

  // Load OAD config
  const config = await runtime.loadConfig('./oad.yaml');

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

    // src/skills/echo.ts - example skill
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
# Ollama (免费本地，默认):
# OPC_LLM_BASE_URL=http://localhost:11434/v1
# OPC_LLM_MODEL=qwen2.5
# (Ollama 无需 API key)

# DeepSeek:
# OPC_LLM_API_KEY=your-deepseek-key
# OPC_LLM_BASE_URL=https://api.deepseek.com/v1
# OPC_LLM_MODEL=deepseek-chat

# OpenAI:
# OPC_LLM_API_KEY=your-openai-key
# OPC_LLM_BASE_URL=https://api.openai.com/v1
# OPC_LLM_MODEL=gpt-4o-mini

# Anthropic:
# OPC_LLM_API_KEY=your-anthropic-key
# OPC_LLM_BASE_URL=https://api.anthropic.com/v1
# OPC_LLM_MODEL=claude-sonnet-4-20250514
`,
    );

    // .env - 根据用户选择生成正确的配置
    const envLines: string[] = [];
    if (llmProvider === 'ollama') {
      envLines.push('# Ollama (免费本地) - 无需 API key');
      envLines.push(`OPC_LLM_BASE_URL=${llmBaseUrl}`);
      envLines.push(`OPC_LLM_MODEL=${llmModel}`);
    } else {
      envLines.push(`OPC_LLM_API_KEY=${llmApiKey || 'your-api-key-here'}`);
      envLines.push(`OPC_LLM_BASE_URL=${llmBaseUrl}`);
      envLines.push(`OPC_LLM_MODEL=${llmModel}`);
    }
    fs.writeFileSync(path.join(dir, '.env'), envLines.join('\n') + '\n');

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
COPY oad.yaml .env* ./
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
├── oad.yaml            # Agent 配置 (唯一配置文件)
├── src/
│   ├── index.ts        # Entry point
│   └── skills/
│       └── echo.ts     # Example skill
├── package.json
└── tsconfig.json
\`\`\`

## Configuration

Edit \`oad.yaml\` to customize your agent's personality, skills, and behavior.
`,
    );

    // SOUL.md - agent personality
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
- Be direct - answer the question first, then explain
- Use markdown formatting when helpful

## Rules
- Always be honest about limitations
- Ask for clarification when the request is ambiguous
- Never make up information
`,
    );

    // CONTEXT.md - project context
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

    // .opc/ directory — runtime state (brain DB, cache, etc.)
    fs.mkdirSync(path.join(dir, '.opc'), { recursive: true });

    // DEEPBRAIN.md — long-term memory seed (compat with MEMORY.md)
    fs.writeFileSync(
      path.join(dir, 'DEEPBRAIN.md'),
      `# DeepBrain Memory

This file seeds the agent's long-term knowledge store (DeepBrain).
Add knowledge entries below — they will be loaded on first run.

## Core Knowledge

<!-- Add domain knowledge, FAQs, policies, etc. here -->
`,
    );

    console.log(`\n${icon.success} Created agent project: ${color.bold(name + '/')}`);
    console.log(`   ${icon.file} oad.yaml         - Agent 配置 (${llmProvider}/${llmModel})`);
    console.log(`   ${icon.file} .env             - 环境变量${llmProvider === 'ollama' ? '' : ' (API Key)'}`);
    console.log(`   ${icon.file} src/index.ts     - Entry point`);
    console.log(`   ${icon.file} src/skills/echo.ts - Example skill`);
    console.log(`   ${icon.file} SOUL.md          - Agent personality`);
    console.log(`   ${icon.file} CONTEXT.md       - Project context`);
    console.log(`   ${icon.file} DEEPBRAIN.md     - Long-term memory seed`);
    console.log(`   ${icon.file} .opc/            - Runtime state directory`);
    console.log(`   ${icon.file} package.json     - Dependencies`);
    console.log(`   ${icon.file} tsconfig.json    - TypeScript config`);
    console.log(`   ${icon.file} .env.example     - Environment template`);
    console.log(`   ${icon.file} .gitignore`);
    console.log(`   ${icon.file} Dockerfile`);
    console.log(`   ${icon.file} README.md`);
    console.log(`\n   Template: ${color.cyan(template)}`);

    // Download brain-seed files from Hub if available
    if (selectedHubTemplate) {
      try {
        const seeds = await fetchBrainSeeds(selectedHubTemplate.id);
        if (seeds.length > 0) {
          const result = await downloadAndLearnBrainSeeds(dir, seeds);
          console.log(`\n   📚 Imported ${color.bold(String(result.savedFiles.length))} knowledge files into brain-seed/`);
          if (result.learnedCount > 0) {
            console.log(`   🧠 Auto-learned ${color.bold(String(result.learnedCount))} files into local DeepBrain`);
          }
        }
      } catch {
        // Brain-seed download failed - non-fatal, project still usable
      }
    }
    console.log(`\n${color.bold('Next steps:')}`);
    console.log(`   1. cd ${name}`);
    console.log(`   2. npm install`);
    if (llmProvider === 'ollama' && !ollamaRunning) {
      console.log(`   3. ollama pull ${llmModel}   ${color.dim('# 下载模型')}`);
      console.log(`   4. npx opc run              ${color.dim('# 启动 Agent')}`);
    } else if (llmProvider !== 'ollama' && !llmApiKey) {
      console.log(`   3. 编辑 .env 设置 OPC_LLM_API_KEY`);
      console.log(`   4. npx opc run`);
    } else {
      console.log(`   3. npx opc run              ${color.dim('# 启动 Agent')}`);
    }
    console.log(`   Open http://localhost:3000\n`);
    console.log(`${color.dim('💡 Tip: Use --role to start from a workstation template:')}`);
    console.log(`${color.dim('   opc init my-agent --role customer-service')}`);
    console.log(`${color.dim('   opc init --list-roles  (see all roles)')}\n`);
  });

// ── Chat command ─────────────────────────────────────────────

import { runChat } from './cli/chat';

program
  .command('chat')
  .description('Interactive TUI chat with the agent')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .action(async (opts: { file: string }) => {
    loadDotEnv();
    await runChat({ file: opts.file });
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

    // Auto-start Studio on port 4000
    let studioUrl = '';
    try {
      const { StudioServer } = require('./studio/server');
      const studioPort = parseInt(opts.port || '3000') === 4000 ? 4001 : 4000;
      const studio = new StudioServer({ port: studioPort, agentDir: process.cwd() });
      await studio.start();
      studioUrl = `http://localhost:${studioPort}`;
    } catch {}

    console.log(`\n${icon.rocket} Agent "${color.bold(agent?.name ?? 'unknown')}" is running.`);
    console.log(`   ${color.dim('Chat:')}    http://localhost:3000`);
    if (studioUrl) console.log(`   ${color.dim('Studio:')}  ${studioUrl}`);
    console.log(`   ${color.dim('API:')}     POST http://localhost:3000/api/chat`);
    console.log(`\n   ${color.dim('Press Ctrl+C to stop.')}\n`);

    // Keep the process alive — HTTP server refs may not suffice with Commander
    await new Promise<void>(() => {});
  });

// ── Serve command (OpenAI-compatible API) ────────────────────

program
  .command('serve')
  .description('Start OpenAI-compatible API server')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('-p, --port <port>', 'Port', '8080')
  .option('-H, --host <host>', 'Host', '0.0.0.0')
  .option('-k, --api-key <key>', 'API key for auth')
  .action(async (opts: { file: string; port: string; host: string; apiKey?: string }) => {
    loadDotEnv();
    const { APIServer } = require('./core/api-server');
    const runtime = new AgentRuntime();
    await runtime.loadConfig(opts.file);
    await runtime.initialize();
    await runtime.start();
    const agent = runtime.getAgent();

    const server = new APIServer({
      port: parseInt(opts.port) || 8080,
      host: opts.host,
      apiKey: opts.apiKey ?? process.env.OPC_API_KEY,
      agent,
    });
    await server.start();

    const name = agent?.name ?? 'unknown';
    console.log(`\n${icon.rocket} OpenAI-compatible API server running`);
    console.log(`   Agent: ${color.bold(name)}`);
    console.log(`   URL:   ${color.cyan(`http://${opts.host}:${opts.port}`)}`);
    console.log(`   Auth:  ${opts.apiKey ? color.green('enabled') : color.yellow('disabled')}`);
    console.log(`\n   Endpoints:`);
    console.log(`     POST /v1/chat/completions`);
    console.log(`     GET  /v1/models`);
    console.log(`     POST /v1/embeddings`);
    console.log(`     GET  /health`);
    console.log(`     GET  /v1/agent/status`);
    console.log(`\n   ${color.dim('Press Ctrl+C to stop.')}\n`);

    // Keep the process alive
    await new Promise<void>(() => {});
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
  .option('--docker', 'Generate Dockerfile + docker-compose.yml')
  .option('--railway', 'Deploy to Railway')
  .option('--fly', 'Deploy to Fly.io')
  .option('--local', 'Deploy locally via Docker Compose')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('--replicas <n>', 'Number of replicas', '1')
  .action(async (opts: { file: string; target: string; output?: string; install?: boolean; docker?: boolean; railway?: boolean; fly?: boolean; local?: boolean; port: string; replicas: string }) => {
    const deployer = new AgentDeployer();
    const agentDir = path.resolve(opts.output || '.');

    // New deploy modes
    if (opts.docker) {
      console.log(`\n${icon.rocket} ${color.bold('Generating Docker deployment files')}\n`);
      const result = await deployer.generateFiles(agentDir, { port: parseInt(opts.port), replicas: parseInt(opts.replicas) });
      console.log(`${icon.success} ${result.message}`);
      for (const f of (result.files || [])) console.log(`   ${icon.file} ${f}`);
      console.log();
      return;
    }

    if (opts.railway) {
      console.log(`\n${icon.rocket} ${color.bold('Deploying to Railway')}\n`);
      const result = await deployer.deployRailway(agentDir);
      if (result.success) {
        console.log(`${icon.success} ${result.message}`);
        if (result.url) console.log(`   URL: ${color.cyan(result.url)}`);
      } else {
        console.error(`${icon.error} ${result.message}`);
        process.exit(1);
      }
      return;
    }

    if (opts.fly) {
      console.log(`\n${icon.rocket} ${color.bold('Deploying to Fly.io')}\n`);
      const result = await deployer.deployFly(agentDir);
      if (result.success) {
        console.log(`${icon.success} ${result.message}`);
        if (result.url) console.log(`   URL: ${color.cyan(result.url)}`);
      } else {
        console.error(`${icon.error} ${result.message}`);
        process.exit(1);
      }
      return;
    }

    if (opts.local) {
      console.log(`\n${icon.rocket} ${color.bold('Deploying locally via Docker')}\n`);
      const result = await deployer.deployLocal(agentDir, { port: parseInt(opts.port), replicas: parseInt(opts.replicas) });
      if (result.success) {
        console.log(`${icon.success} ${result.message}`);
        if (result.url) console.log(`   URL: ${color.cyan(result.url)}`);
      } else {
        console.error(`${icon.error} ${result.message}`);
        process.exit(1);
      }
      return;
    }

    // Legacy deploy modes
    if (opts.target !== 'openclaw' && opts.target !== 'hermes') {
      console.error(`${icon.error} Unknown target: ${color.bold(opts.target)}. Supported: openclaw, hermes, --docker, --railway, --fly, --local`);
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
      { name: 'agui', description: 'AG-UI - Agent-User Interaction (SSE)', enabled: !!protocols.agui?.enabled, detail: protocols.agui?.path || '/agui' },
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
  .description('Migrate project: MEMORY.md → DEEPBRAIN.md and OAD to latest schema')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('--dry-run', 'Show changes without writing')
  .option('--schema-only', 'Only migrate OAD schema (skip MEMORY.md → DEEPBRAIN.md)')
  .action(async (opts: { file: string; dryRun?: boolean; schemaOnly?: boolean }) => {
    // Step 1: MEMORY.md → DEEPBRAIN.md migration
    if (!opts.schemaOnly) {
      console.log(`\n${icon.gear} ${color.bold('DeepBrain Migration')} (MEMORY.md → DEEPBRAIN.md)\n`);
      try {
        if (opts.dryRun) {
          const memExists = fs.existsSync(path.join(process.cwd(), 'MEMORY.md'));
          const soulExists = fs.existsSync(path.join(process.cwd(), 'SOUL.md'));
          const dbExists = fs.existsSync(path.join(process.cwd(), '.opc', 'brain.db'));
          console.log(`  MEMORY.md:    ${memExists ? color.cyan('found — would migrate to DEEPBRAIN.md') : color.dim('not found')}`);
          console.log(`  SOUL.md:      ${soulExists ? color.cyan('found — would migrate to EGO.md') : color.dim('not found')}`);
          console.log(`  .opc/brain.db:${dbExists ? color.dim(' already exists') : color.cyan(' would create')}`);
          console.log(`\n  ${icon.info} Dry run — no changes.\n`);
        } else {
          const { migrate: deepbrainMigrate } = require('./deepbrain/migrate');
          await deepbrainMigrate(process.cwd());
          console.log(`  ${icon.success} MEMORY.md → DEEPBRAIN.md migration complete.`);
          console.log(`  ${icon.success} SOUL.md → EGO.md migration complete.`);
          console.log(`  ${icon.success} Knowledge seeded into .opc/brain.db.\n`);
        }
      } catch (e: any) {
        console.log(`  ${icon.warn} DeepBrain migration: ${e.message}\n`);
      }
    }

    // Step 2: OAD schema migration
    console.log(`${icon.gear} ${color.bold('OAD Schema Migration')}\n`);
    try {
      const raw = fs.readFileSync(opts.file, 'utf-8');
      const config = yaml.load(raw) as any;
      let changed = false;

      if (!config.apiVersion) { config.apiVersion = 'opc/v1'; changed = true; }
      if (!config.kind) { config.kind = 'Agent'; changed = true; }
      if (!config.metadata?.version) {
        if (!config.metadata) config.metadata = {};
        config.metadata.version = '1.0.0';
        changed = true;
      }
      if (config.spec?.channels && !Array.isArray(config.spec.channels)) {
        config.spec.channels = [config.spec.channels];
        changed = true;
      }
      if (config.spec?.skills && !Array.isArray(config.spec.skills)) {
        config.spec.skills = [config.spec.skills];
        changed = true;
      }
      if (config.spec?.llm?.model && !config.spec?.model) {
        config.spec.model = config.spec.llm.model;
        delete config.spec.llm;
        changed = true;
      }

      if (!changed) {
        console.log(`  ${icon.success} OAD is already up to date.\n`);
      } else if (opts.dryRun) {
        console.log(`  ${icon.info} Would migrate:\n`);
        console.log(yaml.dump(config, { lineWidth: 120 }));
      } else {
        fs.writeFileSync(opts.file + '.bak', raw);
        fs.writeFileSync(opts.file, yaml.dump(config, { lineWidth: 120 }));
        console.log(`  ${icon.success} Migrated ${color.bold(opts.file)} (backup: ${opts.file}.bak)\n`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`  ${icon.error} OAD migration failed:`, err instanceof Error ? err.message : err);
      } else {
        console.log(`  ${color.dim(`No OAD file found (${opts.file}) — skipping schema migration.`)}\n`);
      }
    }
  });

// ── Brain command ────────────────────────────────────────────

const brainCmd = program
  .command('brain')
  .description('Manage agent brain (memory, seeds, evolve)');

brainCmd
  .command('status')
  .description('Show brain stats (knowledge tiers, evolve history)')
  .action(async () => {
    console.log(`\n${icon.gear} ${color.bold('Knowledge Brain Status')}\n`);
    try {
      const { KnowledgeEvolveEngine } = require('./memory/evolve-engine');
      const engine = new KnowledgeEvolveEngine(process.cwd());
      const model = await engine.detectLocalModel();
      const stats = engine.getStats();
      console.log(`  ${color.cyan('Evolve Model'.padEnd(16))}  ${model} (local, free)`);
      console.log(`  ${color.cyan('Workstation'.padEnd(16))}  ${stats.workstation} pages`);
      console.log(`  ${color.cyan('Job'.padEnd(16))}  ${stats.job} pages`);
      console.log(`  ${color.cyan('Industry'.padEnd(16))}  ${stats.industry} pages`);
      console.log(`  ${color.cyan('Last Evolve'.padEnd(16))}  ${stats.lastEvolve || 'never'}`);
      console.log();
    } catch (e: any) {
      console.log(`  ${icon.warn} ${e.message}\n`);
    }
  });

brainCmd
  .command('seed')
  .description('Import brain seed files into memory')
  .option('-f, --file <file>', 'OAD file', 'oad.yaml')
  .option('--status', 'Check if seeds have been imported')
  .option('--reset', 'Re-import seeds (clear marker and re-seed)')
  .action(async (opts: { file: string; status?: boolean; reset?: boolean }) => {
    const { BrainSeedLoader } = require('./memory/seed-loader');
    let config: any = {};
    try { config = yaml.load(fs.readFileSync(opts.file, 'utf-8')) as any; } catch { /* ignore */ }
    const brainConfig = config?.spec?.brain;
    if (!brainConfig?.seeds?.length) {
      console.log(`${icon.info} No brain seeds configured in ${opts.file}.`);
      console.log(`  Add spec.brain.seeds to your agent.yaml.`);
      return;
    }

    const loader = new BrainSeedLoader(process.cwd(), {
      seeds: brainConfig.seeds,
      autoSeed: brainConfig.autoSeed !== false,
    });

    if (opts.status) {
      const seeded = await loader.isSeeded();
      console.log(`\n  Brain seed status: ${seeded ? color.green('seeded ✔') : color.yellow('not seeded')}`);
      console.log(`  Seeds configured: ${brainConfig.seeds.map((s: string) => color.cyan(s)).join(', ')}\n`);
      return;
    }

    if (opts.reset) {
      const markerPath = path.resolve(process.cwd(), '.brain-seeded');
      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
        console.log(`  ${icon.success} Cleared seed marker.`);
      }
    }

    if (await loader.isSeeded() && !opts.reset) {
      console.log(`${icon.info} Brain already seeded. Use --reset to re-import.`);
      return;
    }

    console.log(`\n${icon.gear} Importing brain seeds...\n`);
    // Use a simple mock brain that logs imports (real usage would connect to DeepBrain)
    const pages: string[] = [];
    const mockBrain = {
      learn: async (content: string, meta: any) => { pages.push(meta?.slug || 'unknown'); },
    };
    const result = await loader.seedBrain(mockBrain);
    await loader.markSeeded();

    console.log(`  ${icon.success} Imported ${color.bold(String(result.imported))} pages from ${brainConfig.seeds.length} seed files.`);
    for (const p of result.pages) {
      console.log(`    ${color.dim('•')} ${p}`);
    }
    console.log();
  });

brainCmd
  .command('evolve')
  .description('Trigger manual knowledge evolution cycle (uses local Ollama model)')
  .option('--dry-run', 'Show stats without evolving')
  .action(async (opts: { dryRun?: boolean }) => {
    const { KnowledgeEvolveEngine } = require('./memory/evolve-engine');
    const engine = new KnowledgeEvolveEngine(process.cwd());
    console.log(`\n${icon.gear} ${color.bold('Knowledge Evolution')} ${color.dim('(local Ollama model, zero cost)')}\n`);

    const model = await engine.detectLocalModel();
    console.log(`  Model: ${color.cyan(model)}`);

    const stats = engine.getStats();
    console.log(`  Knowledge pages: workstation=${stats.workstation} job=${stats.job} industry=${stats.industry}`);
    if (stats.lastEvolve) console.log(`  Last evolve: ${stats.lastEvolve}`);

    if (opts.dryRun) {
      console.log(`\n  ${icon.info} Dry run — no changes.\n`);
      return;
    }

    console.log(`\n  ${icon.info} Running evolve cycle...`);
    const result = await engine.evolve();
    console.log(`  ${icon.success} Extracted: ${result.extracted}, Deduplicated: ${result.deduplicated}, Promoted: ${result.promoted}`);
    if (result.compacted) console.log(`  ${icon.success} Memory compacted (refined & written back)`);
    if (result.errors.length > 0) {
      for (const e of result.errors) console.log(`  ${icon.warn} ${e}`);
    }
    console.log();
  });

brainCmd
  .command('recall')
  .argument('<query>', 'Search query')
  .description('Query DeepBrain knowledge base')
  .option('--top-k <n>', 'Number of results', '5')
  .option('--layer <layer>', 'Filter by layer (l1/l2/l3/l4/workstation/job/industry)')
  .action(async (query: string, opts: { topK: string; layer?: string }) => {
    console.log(`\n${icon.search} ${color.bold('DeepBrain Recall')} — ${color.cyan(query)}\n`);
    try {
      const { DeepBrain } = require('./deepbrain/provider');
      const brain = new DeepBrain({ dbPath: path.join(process.cwd(), '.opc', 'brain.db'), embeddingProvider: 'none' });
      await brain.init();
      const result = await brain.recall({ query, topK: parseInt(opts.topK) || 5, layer: opts.layer });
      if (result.entries.length === 0) {
        console.log(`  ${icon.info} No results found.\n`);
        return;
      }
      for (const entry of result.entries) {
        console.log(`  ${color.cyan(`[${entry.layer}]`)} ${color.dim(entry.source)} — maturity: ${entry.maturityScore.toFixed(2)}`);
        const preview = entry.content.length > 200 ? entry.content.slice(0, 200) + '…' : entry.content;
        console.log(`  ${preview}`);
        console.log();
      }
      console.log(`  ${color.dim(`${result.entries.length} result(s) in ${result.elapsedMs}ms`)}\n`);
    } catch (e: any) {
      console.log(`  ${icon.warn} ${e.message}\n`);
    }
  });

brainCmd
  .command('stats')
  .description('Show DeepBrain knowledge base statistics')
  .action(async () => {
    console.log(`\n${icon.gear} ${color.bold('DeepBrain Stats')}\n`);
    try {
      const { DeepBrain } = require('./deepbrain/provider');
      const brain = new DeepBrain({ dbPath: path.join(process.cwd(), '.opc', 'brain.db'), embeddingProvider: 'none' });
      await brain.init();
      const stats = await brain.getStats();
      console.log(`  ${color.cyan('Total Entries'.padEnd(18))}  ${stats.totalEntries}`);
      const layers = stats.entriesByLayer as Record<string, number>;
      for (const [layer, count] of Object.entries(layers)) {
        console.log(`  ${color.cyan(layer.padEnd(18))}  ${count}`);
      }
      console.log(`  ${color.cyan('Avg Maturity'.padEnd(18))}  ${(stats.avgMaturityScore ?? 0).toFixed(3)}`);
      console.log(`  ${color.cyan('Last Evolution'.padEnd(18))}  ${stats.lastEvolution ?? 'never'}`);
      console.log();
    } catch (e: any) {
      console.log(`  ${icon.warn} ${e.message}\n`);
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
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts: any) => {
    process.on('uncaughtException', (err) => {
      console.error('[Studio] Uncaught exception:', err.message);
    });
    process.on('unhandledRejection', (err: any) => {
      console.error('[Studio] Unhandled rejection:', err?.message || err);
    });

    const { StudioServer } = require('./studio/server');
    const port = parseInt(opts.port, 10);

    const server = new StudioServer({ port, agentDir: process.cwd(), openBrowser: opts.open !== false });
    await server.start();
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
    const oadPath = path.resolve(fs.existsSync('oad.yaml') ? 'oad.yaml' : 'agent.yaml');
    let agent: any;
    if (fs.existsSync(oadPath)) {
      const runtime = new AgentRuntime();
      await runtime.loadConfig(oadPath);
      await runtime.start();
      agent = (runtime as any).agent;
    }

    if (!agent) {
      console.log(`${icon.warn} No oad.yaml or agent.yaml found - running with dry-run mock agent.`);
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

// ── Guardrails command ────────────────────────────────────────

const guardrailsCmd = program.command('guardrails').description('Guardrail utilities');

guardrailsCmd
  .command('test <message>')
  .description('Test guardrails against a message')
  .option('-c, --config <file>', 'OAD config file with guardrails')
  .action(async (message: string, opts: any) => {
    const { GuardrailManager, createGuardrailsFromConfig } = await import('./security/guardrails');

    let manager: InstanceType<typeof GuardrailManager>;
    if (opts.config) {
      const raw = fs.readFileSync(opts.config, 'utf-8');
      const doc = yaml.load(raw) as any;
      manager = createGuardrailsFromConfig(doc.spec?.guardrails ?? {});
    } else {
      // Default: all built-in rules
      manager = new GuardrailManager({
        input: [
          { name: 'pii-detector', type: 'regex', action: 'redact' },
          { name: 'prompt-injection', type: 'keyword', action: 'block' },
          { name: 'toxicity', type: 'keyword', action: 'block' },
          { name: 'compliance-filter', type: 'keyword', action: 'block' },
        ],
        output: [],
      });
    }

    console.log(color.bold('Testing guardrails against:'), message);
    console.log();

    const result = await manager.checkInput(message);
    if (result.passed) {
      console.log(color.green('✓ PASSED - no violations'));
    } else {
      if (result.blocked) console.log(color.red('✗ BLOCKED'));
      if (result.warned) console.log(color.yellow('⚠ WARNING'));
      if (result.redacted) {
        console.log(color.yellow('✎ REDACTED'));
        console.log('  Redacted text:', result.redactedText);
      }
      for (const v of result.violations) {
        console.log(`  [${v.action}] ${v.rule}: ${v.detail}`);
      }
    }
  });

// ── Voice command ─────────────────────────────────────────────

program
  .command('voice')
  .description('Voice conversation utilities')
  .command('start')
  .description('Start voice conversation (requires STT/TTS providers)')
  .option('--stt <provider>', 'STT provider: whisper, deepgram', 'whisper')
  .option('--tts <provider>', 'TTS provider: edge-tts, openai-tts, elevenlabs', 'edge-tts')
  .option('--voice <name>', 'Voice name/id')
  .option('--language <lang>', 'Language code', 'en')
  .action(async (opts: any) => {
    console.log(color.bold('🎤 Voice Conversation Mode'));
    console.log(`  STT: ${opts.stt} | TTS: ${opts.tts} | Voice: ${opts.voice ?? 'default'} | Language: ${opts.language}`);
    console.log(color.dim('  (Voice conversation requires audio input integration - use as library)'));
    console.log();
    console.log('To use voice in your agent:');
    console.log(color.cyan(`
  import { VoiceChannel, createVoiceProviders } from 'opc-agent';

  const { stt, tts } = createVoiceProviders({
    sttProvider: '${opts.stt}',
    ttsProvider: '${opts.tts}',
    voice: '${opts.voice ?? 'en-US-AriaNeural'}',
    language: '${opts.language}',
  });

  const voice = new VoiceChannel({ sttProvider: stt, ttsProvider: tts });
  await voice.start();
`));
  });

// ── Models command ──────────────────────────────────────────────

program
  .command('models')
  .description('Show recommended Ollama models for your system')
  .option('--refresh', 'Force refresh model list from remote')
  .option('--json', 'Output as JSON')
  .action(async (opts: { refresh?: boolean; json?: boolean }) => {
    if (opts.refresh) {
      clearModelCache();
      console.log(`${icon.success} 模型推荐缓存已清除`);
    }

    const sys = detectSystem();
    const models = await fetchModelList();
    const cache = cacheInfo();

    // Detect Ollama
    let installedModels: string[] = [];
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch('http://localhost:11434/api/tags', { signal: ctrl.signal });
      clearTimeout(t);
      const data = await res.json() as any;
      installedModels = (data.models || []).map((m: any) => m.name || m.model);
    } catch { /* Ollama not running */ }

    const rec = recommendModels(models, sys, installedModels);

    if (opts.json) {
      console.log(JSON.stringify({ system: sys, cache, recommendation: rec }, null, 2));
      return;
    }

    console.log(`\n${icon.rocket} ${color.bold('OPC 模型推荐')}\n`);
    console.log(`  系统: ${sys.totalRAM}GB RAM (${sys.freeRAM}GB 可用), ${sys.cpuCount} cores, ${sys.platform}/${sys.arch}`);
    if (cache.exists) {
      console.log(`  推荐列表: v${cache.version} (${cache.age})`);
    } else {
      console.log(`  推荐列表: 内置 (运行 ${color.cyan('opc models --refresh')} 获取最新)`);
    }
    console.log(`  Ollama: ${installedModels.length > 0 ? color.green(`运行中, ${installedModels.length} 个模型`) : color.yellow('未运行')}`);
    console.log(`\n  ${color.bold('⭐ 推荐:')} ${color.cyan(rec.best.name)} (${rec.best.size}) - ${rec.best.desc}\n`);

    // Table
    console.log(`  ${'模型'.padEnd(28)} ${'大小'.padEnd(8)} ${'最低RAM'.padEnd(8)} ${'状态'.padEnd(10)} 说明`);
    console.log(`  ${'─'.repeat(28)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(20)}`);

    for (const m of rec.suitable) {
      const installed = installedModels.includes(m.name);
      const isBest = m.name === rec.best.name;
      const status = installed ? color.green('已安装') : color.dim('未安装');
      const star = isBest ? ' ⭐' : (m.recommended ? ' 💎' : '');
      console.log(`  ${(m.name + star).padEnd(28)} ${m.size.padEnd(8)} ${(m.minRAM + 'GB').padEnd(8)} ${status.padEnd(10)} ${m.desc}`);
    }

    if (rec.toDownload.length > 0) {
      console.log(`\n  ${color.bold('推荐下载:')}`);
      for (const m of rec.toDownload) {
        console.log(`  ${color.cyan(`ollama pull ${m.name}`)}  (${m.size}, ${m.desc})`);
      }
    }
    console.log();
  });

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

// Singleton for CLI - in real usage this would be loaded from daemon state
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
    if (!oad) { console.log(`${icon.error} No oad.yaml or agent.yaml found`); return; }
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
  for (const name of ['oad.yaml', 'agent.yaml', 'agent.yml']) {
    if (fs.existsSync(name)) {
      return yaml.load(fs.readFileSync(name, 'utf-8'));
    }
  }
  return null;
}

// ── MCP Server Commands ────────────────────────────────────
const mcpCmd = program.command('mcp').description('MCP server commands - expose agent as MCP tools');

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
      console.error(`${icon.success} MCP server (stdio) started - ${server.getToolCount()} tools`);
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

mcpCmd
  .command('list')
  .description('List available pre-built MCP servers')
  .action(() => {
    const { listMCPServers } = require('./mcp/servers');
    const servers = listMCPServers();
    console.log(`\n${icon.gear} Available MCP Servers:\n`);
    for (const s of servers) {
      console.log(`  ${color.green(s.name.padEnd(14))} ${s.description} ${color.dim(`(${s.toolCount} tools, v${s.version})`)}`);
    }
    console.log(`\n  Total: ${servers.length} servers\n`);
  });

mcpCmd
  .command('start')
  .argument('<name>', 'Server name (e.g. filesystem, github, calculator)')
  .option('--port <port>', 'Start in HTTP+SSE mode on given port')
  .description('Start a pre-built MCP server (stdio by default)')
  .action(async (name: string, opts: { port?: string }) => {
    const { getMCPServer } = require('./mcp/servers');
    const { MCPServer } = require('./protocols/mcp');
    const config = getMCPServer(name);
    const server = new MCPServer(config);
    if (opts.port) {
      const port = parseInt(opts.port) || 3100;
      await server.serveHTTP(port);
      console.log(`${icon.success} MCP server ${color.cyan(name)} running on http://localhost:${port}`);
      console.log(`${icon.info} Tools: ${server.getToolCount()}`);
    } else {
      console.error(`${icon.success} MCP server ${color.cyan(name)} (stdio) - ${server.getToolCount()} tools`);
      await server.serveStdio();
    }
  });

// ── Memory Search command ────────────────────────────────────

program
  .command('memory-search')
  .argument('<query>', 'Search query')
  .description('Search agent memory (DeepBrain knowledge base)')
  .option('--top-k <n>', 'Number of results', '5')
  .option('--json', 'Output as JSON')
  .action(async (query: string, opts: { topK: string; json?: boolean }) => {
    try {
      const { DeepBrain } = require('./deepbrain/provider');
      const brain = new DeepBrain({ dbPath: path.join(process.cwd(), '.opc', 'brain.db'), embeddingProvider: 'none' });
      await brain.init();
      const result = await brain.recall({ query, topK: parseInt(opts.topK) || 5 });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`\n${icon.search} ${color.bold('Memory Search')} — ${color.cyan(query)}\n`);
      if (result.entries.length === 0) {
        console.log(`  ${icon.info} No results found.\n`);
        return;
      }
      for (const entry of result.entries) {
        console.log(`  ${color.cyan(`[${entry.layer}]`)} ${color.dim(entry.source)}`);
        const preview = entry.content.length > 200 ? entry.content.slice(0, 200) + '…' : entry.content;
        console.log(`  ${preview}\n`);
      }
      console.log(`  ${color.dim(`${result.entries.length} result(s) in ${result.elapsedMs}ms`)}\n`);
    } catch (e: any) {
      console.error(`${icon.error} Memory search failed: ${e.message}`);
      process.exit(1);
    }
  });

// ── Parse CLI ────────────────────────────────────────────────
program.parse();
