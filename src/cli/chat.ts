import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createProvider } from '../providers';

const OPC_HOME = path.join(os.homedir(), '.opc');
const CONFIG_PATH = path.join(OPC_HOME, 'config.json');

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function loadConfig(): Record<string, any> {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

export async function runChat(): Promise<void> {
  const config = loadConfig();

  if (!config.provider || !config.model) {
    console.log(`${c.red('✘')} 未找到配置。请先运行 ${c.cyan('opc setup')} 完成初始设置。`);
    process.exit(1);
  }

  const agentId = config.defaultAgent;
  let agentConfig: Record<string, any> = {};
  if (agentId) {
    const agentPath = path.join(OPC_HOME, 'agents', agentId, 'config.json');
    if (fs.existsSync(agentPath)) {
      try { agentConfig = JSON.parse(fs.readFileSync(agentPath, 'utf-8')); } catch { /* ignore */ }
    }
  }

  const agentName = agentConfig.name || 'AI 助手';
  const systemPrompt = agentConfig.description
    ? `你是「${agentName}」，${agentConfig.description}。请用简洁友好的方式回答。`
    : `你是「${agentName}」，一个智能 AI 助手。请用简洁友好的方式回答。`;

  console.log('');
  console.log(c.bold(`💬 与「${agentName}」对话`));
  console.log(c.dim('   输入 /quit 退出'));
  console.log('');

  let provider: any;
  try {
    provider = createProvider({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    } as any);
  } catch (err: any) {
    console.log(`${c.red('✘')} 无法初始化模型: ${err.message}`);
    console.log(c.dim(`  Provider: ${config.provider}, Model: ${config.model}`));
    process.exit(1);
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const askQuestion = (): void => {
    rl.question(c.cyan('你: '), async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) { askQuestion(); return; }
      if (trimmed === '/quit' || trimmed === '/exit' || trimmed === '/q') {
        console.log(c.dim('\n👋 再见！'));
        rl.close();
        return;
      }

      messages.push({ role: 'user', content: trimmed });

      try {
        process.stdout.write(c.green(`${agentName}: `));
        const response = await provider.chat(messages);
        const reply = typeof response === 'string' ? response : response?.content || response?.message?.content || JSON.stringify(response);
        console.log(reply);
        console.log('');
        messages.push({ role: 'assistant', content: reply });
      } catch (err: any) {
        console.log(c.red(`\n  错误: ${err.message}`));
        console.log('');
      }

      askQuestion();
    });
  };

  askQuestion();
}
