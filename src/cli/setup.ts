import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import { spawn } from 'child_process';

// ── Colors ──────────────────────────────────────────────────────────────────
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
};

// ── Types ───────────────────────────────────────────────────────────────────
interface SetupConfig {
  provider: 'ollama' | 'openai' | 'deepseek' | 'qwen' | 'anthropic';
  model?: string;
  embeddingModel?: string;
  apiKey?: string;
  baseUrl?: string;
}

interface AgentTemplate {
  id: string;
  icon: string;
  name: string;
  description: string;
  defaultAgentName: string;
}

const TEMPLATES: AgentTemplate[] = [
  { id: 'customer-service', icon: '🎧', name: '客服助手', description: '回答客户问题，自动学习产品知识', defaultAgentName: '我的客服助手' },
  { id: 'content-writer', icon: '✍️', name: '写作助手', description: '帮你写文章、邮件、报告', defaultAgentName: '我的写作助手' },
  { id: 'data-analyst', icon: '📊', name: '数据分析师', description: '分析数据，生成洞察', defaultAgentName: '我的数据分析师' },
  { id: 'translator', icon: '🌐', name: '翻译助手', description: '多语言翻译，越用越准', defaultAgentName: '我的翻译助手' },
  { id: 'general', icon: '🤖', name: '通用助手', description: '什么都能聊', defaultAgentName: '我的AI助手' },
];

const OPC_HOME = path.join(os.homedir(), '.opc');
const CONFIG_PATH = path.join(OPC_HOME, 'config.json');

// ── RAM-based model recommendation ──────────────────────────────────────────
const RAM_MODEL_TABLE: Array<{ maxRAM: number; model: string; size: string }> = [
  { maxRAM: 3,        model: 'qwen2.5:0.5b', size: '400MB' },
  { maxRAM: 7,        model: 'qwen2.5:1.5b', size: '1.0GB' },
  { maxRAM: 15,       model: 'qwen2.5:7b',   size: '4.7GB' },
  { maxRAM: 31,       model: 'qwen2.5:14b',  size: '9.0GB' },
  { maxRAM: Infinity, model: 'qwen2.5:32b',  size: '19GB'  },
];

function getRecommendedModel(totalRAMgb: number): { model: string; size: string } {
  for (const row of RAM_MODEL_TABLE) {
    if (totalRAMgb <= row.maxRAM) return { model: row.model, size: row.size };
  }
  return { model: 'qwen2.5:32b', size: '19GB' };
}

function spawnOllamaPull(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', model], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ollama pull exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

// ── Readline helpers ────────────────────────────────────────────────────────
export function createRL(input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream): readline.Interface {
  return readline.createInterface({
    input: input ?? process.stdin,
    output: output ?? process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function httpGet(url: string, timeout = 5000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Step 1: Welcome ─────────────────────────────────────────────────────────
function printWelcome(): void {
  console.log('');
  console.log(c.bold('  🎉 欢迎使用 OPC Agent！'));
  console.log(c.dim('     让我们用 3 分钟配置你的第一个 AI Agent。'));
  console.log('');
}

// ── Step 2: Model detection ─────────────────────────────────────────────────
async function detectOllama(): Promise<{ running: boolean; models: string[] }> {
  try {
    const { body } = await httpGet('http://localhost:11434/api/tags');
    const data = JSON.parse(body);
    const models = (data.models || []).map((m: any) => m.name || m.model);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

async function stepModel(rl: readline.Interface, yes?: boolean): Promise<SetupConfig> {
  console.log(c.bold('📡 Step 1/4: 配置 AI 模型'));
  console.log(c.dim('  正在检测系统和 Ollama...'));
  console.log('');

  const totalRAM = Math.round(os.totalmem() / 1024 / 1024 / 1024);
  const cpus = os.cpus().length;
  const rec = getRecommendedModel(totalRAM);

  const ollama = await detectOllama();

  if (ollama.running) {
    console.log(`  🔍 检测到系统: ${c.bold(String(totalRAM) + 'GB')} RAM, ${c.bold(String(cpus) + '核')} CPU`);
    console.log(`  📦 推荐模型: ${c.cyan(rec.model)} (${rec.size})`);

    if (ollama.models.length > 0) {
      console.log(`     当前已安装: ${ollama.models.map((m) => `${m} ${c.green('[已安装]')}`).join(', ')}`);
    } else {
      console.log(`     当前已安装: ${c.dim('（无）')}`);
    }
    console.log('');

    const hasRecommended = ollama.models.includes(rec.model);
    const hasEmbed = ollama.models.some((m) => m.startsWith('nomic-embed-text'));

    if (!hasRecommended) {
      let doDownload: boolean;
      if (yes) {
        console.log(c.dim('  --yes 模式: 自动下载推荐模型'));
        doDownload = true;
      } else {
        const dl = await ask(rl, `  是否下载推荐模型？[Y/n] `);
        doDownload = dl.toLowerCase() !== 'n';
      }

      if (doDownload) {
        console.log(`  → 正在下载 ${c.cyan(rec.model)}...`);
        try {
          await spawnOllamaPull(rec.model);
          console.log(c.green(`  ✔ 下载完成: ${rec.model}`));
        } catch {
          console.log(c.yellow(`  ⚠ 下载失败，稍后手动运行: ollama pull ${rec.model}`));
        }
      }
    } else {
      console.log(c.green(`  ✔ 推荐模型 ${rec.model} 已安装`));
    }

    if (!hasEmbed) {
      let doEmbed: boolean;
      if (yes) {
        doEmbed = true;
      } else {
        const dl = await ask(rl, `  推荐 Embedding 模型 ${c.cyan('nomic-embed-text')} 未安装，是否下载？ [Y/n] `);
        doEmbed = dl.toLowerCase() !== 'n';
      }
      if (doEmbed) {
        console.log(`  → 正在下载 ${c.cyan('nomic-embed-text')}...`);
        try {
          await spawnOllamaPull('nomic-embed-text');
          console.log(c.green('  ✔ 下载完成: nomic-embed-text'));
        } catch {
          console.log(c.yellow('  ⚠ 下载失败，稍后手动运行: ollama pull nomic-embed-text'));
        }
      }
    }

    console.log('');
    const chatModel = hasRecommended
      ? rec.model
      : (ollama.models.find((m) => !m.includes('embed')) ?? rec.model);
    return {
      provider: 'ollama',
      model: chatModel,
      embeddingModel: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
    };
  }

  // Ollama not running
  console.log(`  🔍 检测到系统: ${c.bold(String(totalRAM) + 'GB')} RAM, ${c.bold(String(cpus) + '核')} CPU`);
  console.log(c.yellow('  ⚠ 未检测到 Ollama'));
  console.log('');
  console.log('  请选择：');
  console.log(`    ${c.cyan('A')} ) 安装 Ollama（推荐，免费本地运行）`);
  console.log(`    ${c.cyan('B')} ) 使用云端 API`);
  console.log('');

  const choice = yes ? 'A' : await ask(rl, '  你的选择 [A/B]: ');

  if (choice.toUpperCase() !== 'B') {
    console.log('');
    console.log(c.bold('  📦 安装 Ollama：'));
    console.log('');
    if (process.platform === 'win32') {
      console.log('    1. 访问 https://ollama.com/download');
      console.log('    2. 下载 Windows 版并安装');
      console.log(`    3. 安装后运行: ollama pull ${rec.model}`);
    } else if (process.platform === 'darwin') {
      console.log('    brew install ollama');
      console.log('    ollama serve &');
      console.log(`    ollama pull ${rec.model}`);
    } else {
      console.log('    curl -fsSL https://ollama.com/install.sh | sh');
      console.log('    ollama serve &');
      console.log(`    ollama pull ${rec.model}`);
    }
    console.log('');
    console.log(c.dim('  安装完成后重新运行 opc setup'));
    return { provider: 'ollama', model: rec.model, embeddingModel: 'nomic-embed-text', baseUrl: 'http://localhost:11434' };
  }

  // Cloud API
  console.log('');
  console.log('  选择云端 Provider：');
  console.log(`    ${c.cyan('1')} ) OpenAI`);
  console.log(`    ${c.cyan('2')} ) DeepSeek`);
  console.log(`    ${c.cyan('3')} ) 通义千问 (Qwen)`);
  console.log(`    ${c.cyan('4')} ) Anthropic`);
  console.log('');

  const providerChoice = await ask(rl, '  选择 [1-4]: ');
  const providers: Record<string, { provider: SetupConfig['provider']; baseUrl: string; model: string; testUrl: string }> = {
    '1': { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', testUrl: 'https://api.openai.com/v1/models' },
    '2': { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', testUrl: 'https://api.deepseek.com/v1/models' },
    '3': { provider: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', testUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models' },
    '4': { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', testUrl: 'https://api.anthropic.com/v1/models' },
  };

  const p = providers[providerChoice] ?? providers['1'];
  console.log('');
  const apiKey = await ask(rl, `  请输入 ${c.bold(p.provider)} API Key: `);

  if (apiKey) {
    console.log(c.dim('  正在测试连接...'));
    try {
      await httpGet(p.testUrl);
      console.log(c.green('  ✔ 连接成功！'));
    } catch {
      console.log(c.yellow('  ⚠ 无法验证连接，但配置已保存，稍后可测试'));
    }
  }

  console.log('');
  return { provider: p.provider, model: p.model, apiKey, baseUrl: p.baseUrl };
}

// ── Step 3: Choose template ─────────────────────────────────────────────────
async function stepTemplate(rl: readline.Interface): Promise<AgentTemplate> {
  console.log(c.bold('📋 Step 2/4: 选择 Agent 模板'));
  console.log('');

  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i];
    console.log(`    ${c.cyan(String(i + 1))} ) ${t.icon} ${c.bold(t.name)} — ${c.dim(t.description)}`);
  }
  console.log(`    ${c.cyan('6')} ) 📋 更多模板...（打开 Studio 浏览）`);
  console.log('');

  const choice = await ask(rl, '  选择模板 [1-6]: ');
  const idx = parseInt(choice, 10) - 1;

  if (choice === '6') {
    console.log(c.dim('  → 运行 opc studio 浏览更多模板'));
    return TEMPLATES[4]; // default to general
  }

  const template = TEMPLATES[idx] ?? TEMPLATES[4];
  console.log(c.green(`  ✔ 已选择: ${template.icon} ${template.name}`));
  console.log('');
  return template;
}

// ── Step 4: Create agent ────────────────────────────────────────────────────
async function stepCreateAgent(rl: readline.Interface, template: AgentTemplate, config: SetupConfig): Promise<{ name: string; id: string; dir: string }> {
  console.log(c.bold('🤖 Step 3/4: 创建 Agent'));
  console.log('');

  const name = (await ask(rl, `  Agent 名称 [${template.defaultAgentName}]: `)) || template.defaultAgentName;
  const description = await ask(rl, `  简短描述（可选）: `);

  // Generate a slug id
  const id = name
    .replace(/[^\w\u4e00-\u9fff]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || `agent-${Date.now()}`;

  const agentDir = path.join(OPC_HOME, 'agents', id);
  fs.mkdirSync(agentDir, { recursive: true });

  // Write agent config
  const agentConfig = {
    id,
    name,
    description: description || template.description,
    template: template.id,
    provider: config.provider,
    model: config.model,
    embeddingModel: config.embeddingModel,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(agentConfig, null, 2));

  // Initialize brain directory
  const brainDir = path.join(agentDir, 'brain');
  fs.mkdirSync(brainDir, { recursive: true });
  fs.writeFileSync(path.join(brainDir, 'README.md'), `# ${name}\n\n将知识文档放在这里，Agent 会自动学习。\n`);

  // Save global config
  fs.mkdirSync(OPC_HOME, { recursive: true });
  const globalConfig = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) : {};
  globalConfig.defaultAgent = id;
  globalConfig.provider = config.provider;
  globalConfig.model = config.model;
  globalConfig.baseUrl = config.baseUrl;
  if (config.apiKey) globalConfig.apiKey = config.apiKey;
  if (config.embeddingModel) globalConfig.embeddingModel = config.embeddingModel;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(globalConfig, null, 2));

  console.log('');
  console.log(`  ${c.green('✔')} Agent 已创建: ${c.bold(name)}`);
  console.log(`  ${c.dim('    目录: ' + agentDir)}`);
  console.log('');

  return { name, id, dir: agentDir };
}

// ── Step 5: Completion ──────────────────────────────────────────────────────
function printCompletion(agentName: string): void {
  console.log(c.bold(`  ✅ 你的 AI Agent「${agentName}」已创建！`));
  console.log('');
  console.log('  启动方式：');
  console.log(`    ${c.cyan('opc studio')}    — 打开网页管理界面`);
  console.log(`    ${c.cyan('opc chat')}      — 终端直接对话`);
  console.log(`    ${c.cyan('opc start')}     — 后台运行`);
  console.log('');
  console.log(c.dim('  你的 Agent 会自动学习和进化，越用越聪明！🧬'));
  console.log('');
}

// ── Main entry ──────────────────────────────────────────────────────────────
export async function runSetup(input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, yes?: boolean): Promise<void> {
  const rl = createRL(input, output);
  try {
    printWelcome();
    const config = await stepModel(rl, yes);
    const template = await stepTemplate(rl);
    const agent = await stepCreateAgent(rl, template, config);
    printCompletion(agent.name);
  } finally {
    rl.close();
  }
}
