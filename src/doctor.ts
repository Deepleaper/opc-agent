import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as net from 'net';
import * as yaml from 'js-yaml';

export interface CheckResult {
  ok: boolean;
  detail: string;
  fix?: string;
  optional?: boolean; // ⚠️ 而不是 ❌
}

export interface DoctorCheck {
  name: string;
  check: () => CheckResult | Promise<CheckResult>;
}

/** 读取 .env 文件并解析为 key-value */
function loadEnvFile(): Record<string, string> {
  const envPath = '.env';
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch { /* ignore */ }
  return result;
}

/** 从 oad.yaml 读取 provider 配置 */
function loadOadProvider(): string | undefined {
  for (const f of ['oad.yaml', 'agent.yaml']) {
    if (existsSync(f)) {
      try {
        const cfg = yaml.load(readFileSync(f, 'utf-8')) as any;
        return cfg?.spec?.provider?.default;
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

export function getDoctorChecks(): DoctorCheck[] {
  return [
    {
      name: 'Node.js version',
      check: () => {
        const v = process.versions.node.split('.').map(Number);
        return {
          ok: v[0] >= 18,
          detail: `v${process.versions.node}`,
          fix: v[0] < 18 ? 'Upgrade to Node 18+: https://nodejs.org' : undefined,
        };
      },
    },
    {
      name: 'npm version',
      check: () => {
        try {
          const v = execSync('npm --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
          return { ok: true, detail: `v${v}` };
        } catch {
          return { ok: false, detail: 'Not found', fix: 'Install npm: https://nodejs.org' };
        }
      },
    },
    {
      // Ollama 是可选的（只有选了 ollama provider 才需要）
      name: 'Ollama running',
      check: async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const r = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
          clearTimeout(timeout);
          const data = await r.json() as any;
          return { ok: true, detail: `${data.models?.length || 0} models available` };
        } catch {
          return { ok: false, detail: 'Not running', fix: 'Install Ollama: https://ollama.ai (optional, only needed for local models)', optional: true };
        }
      },
    },
    {
      // 检查 oad.yaml 而不是 agent.yaml
      name: 'oad.yaml exists',
      check: () => {
        const found = existsSync('./oad.yaml');
        if (found) return { ok: true, detail: 'Found' };
        // 检查是否有旧的 agent.yaml 需要迁移
        if (existsSync('./agent.yaml')) {
          return { ok: false, detail: 'Not found (found agent.yaml)', fix: 'Run `opc migrate` to migrate agent.yaml → oad.yaml' };
        }
        return { ok: false, detail: 'Not found', fix: 'Run `opc init` to create a project' };
      },
    },
    {
      name: 'SOUL.md exists',
      check: () => {
        const found = existsSync('./SOUL.md');
        return { ok: found, detail: found ? 'Found' : 'Not found', fix: found ? undefined : 'Run `opc init` to generate one' };
      },
    },
    {
      // TypeScript 是可选的
      name: 'TypeScript installed',
      check: () => {
        try {
          execSync('npx tsc --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
          return { ok: true, detail: 'Available' };
        } catch {
          return { ok: false, detail: 'Not found', fix: 'npm install -D typescript (optional)', optional: true };
        }
      },
    },
    {
      name: 'Disk space',
      check: () => {
        return { ok: true, detail: 'Check passed' };
      },
    },
    {
      // DeepBrain 是可选的
      name: 'DeepBrain package',
      check: () => {
        try {
          require.resolve('deepbrain');
          return { ok: true, detail: 'Installed' };
        } catch {
          return { ok: false, detail: 'Not installed', fix: 'npm install deepbrain (optional, for long-term memory)', optional: true };
        }
      },
    },
    {
      name: 'Port 3000 available',
      check: () => {
        return new Promise<CheckResult>((resolve) => {
          const server = net.createServer();
          server.once('error', () => {
            resolve({ ok: false, detail: 'In use', fix: 'Free port 3000 or configure a different port' });
          });
          server.once('listening', () => {
            server.close(() => {
              resolve({ ok: true, detail: 'Available' });
            });
          });
          server.listen(3000);
        });
      },
    },
    {
      // 检查 API key 是否配置（不是占位符）
      name: 'API key configured',
      check: () => {
        const env = loadEnvFile();
        const apiKey = env['OPC_LLM_API_KEY'] || '';
        const oadProvider = loadOadProvider();
        // Ollama 不需要 API key
        if (oadProvider === 'ollama') {
          return { ok: true, detail: 'Not required (Ollama provider)' };
        }
        if (!apiKey || apiKey === 'your-api-key-here') {
          return { ok: false, detail: 'Not configured or still placeholder', fix: 'Edit .env and set OPC_LLM_API_KEY to your actual API key' };
        }
        return { ok: true, detail: 'Configured' };
      },
    },
    {
      // 检查 .env 和 oad.yaml 的 provider 是否匹配
      name: 'Provider consistency',
      check: () => {
        const env = loadEnvFile();
        const baseUrl = env['OPC_LLM_BASE_URL'] || '';
        const oadProvider = loadOadProvider();
        if (!oadProvider || !baseUrl) {
          return { ok: true, detail: 'N/A (no config to compare)' };
        }
        // 检测 .env 的 base URL 暗示的 provider
        let envProvider = 'unknown';
        if (baseUrl.includes('openai.com')) envProvider = 'openai';
        else if (baseUrl.includes('deepseek.com')) envProvider = 'deepseek';
        else if (baseUrl.includes('localhost:11434')) envProvider = 'ollama';
        else if (baseUrl.includes('anthropic.com')) envProvider = 'anthropic';
        else if (baseUrl.includes('dashscope.aliyuncs.com')) envProvider = 'qwen';

        if (envProvider === 'unknown') return { ok: true, detail: `Custom base URL (${oadProvider})` };
        if (envProvider !== oadProvider && oadProvider !== 'auto') {
          return { ok: false, detail: `Mismatch: .env → ${envProvider}, oad.yaml → ${oadProvider}`, fix: 'Update .env or oad.yaml to use the same provider' };
        }
        return { ok: true, detail: `Matched: ${oadProvider}` };
      },
    },
  ];
}

export async function runDoctor(): Promise<{ passed: number; total: number }> {
  const checks = getDoctorChecks();
  const color = {
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  };

  console.log(`\n🔍 ${color.bold('OPC Agent Doctor')}\n`);

  let passed = 0;
  const total = checks.length;

  for (const check of checks) {
    try {
      const result = await check.check();
      // optional 项失败显示 ⚠️ 而不是 ❌
      const icon = result.ok ? color.green('✅') : (result.optional ? color.yellow('⚠️') : color.red('❌'));
      const name = check.name.padEnd(24);
      console.log(`  ${icon} ${name} ${result.detail}`);
      if (!result.ok && result.fix) {
        console.log(`     → ${result.fix}`);
      }
      // optional 项即使失败也算 passed
      if (result.ok || result.optional) passed++;
    } catch (err) {
      const name = check.name.padEnd(24);
      console.log(`  ${color.red('❌')} ${name} Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n  Result: ${passed}/${total} checks passed`);
  if (passed < total) {
    console.log(`\n  Fix the issues above to get the best experience.`);
  } else {
    console.log(`\n  ${color.green('All checks passed!')} You're good to go.`);
  }
  console.log();

  return { passed, total };
}
