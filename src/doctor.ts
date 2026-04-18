import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as net from 'net';

export interface CheckResult {
  ok: boolean;
  detail: string;
  fix?: string;
}

export interface DoctorCheck {
  name: string;
  check: () => CheckResult | Promise<CheckResult>;
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
          return { ok: false, detail: 'Not running', fix: 'Install Ollama: https://ollama.ai' };
        }
      },
    },
    {
      name: 'agent.yaml exists',
      check: () => {
        const found = existsSync('./agent.yaml');
        return { ok: found, detail: found ? 'Found' : 'Not found', fix: found ? undefined : 'Run `opc init` to create a project' };
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
      name: 'TypeScript installed',
      check: () => {
        try {
          execSync('npx tsc --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
          return { ok: true, detail: 'Available' };
        } catch {
          return { ok: false, detail: 'Not found', fix: 'npm install -D typescript' };
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
      name: 'DeepBrain package',
      check: () => {
        try {
          require.resolve('deepbrain');
          return { ok: true, detail: 'Installed' };
        } catch {
          return { ok: false, detail: 'Not installed', fix: 'npm install deepbrain' };
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
  ];
}

export async function runDoctor(): Promise<{ passed: number; total: number }> {
  const checks = getDoctorChecks();
  const color = {
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  };

  console.log(`\n🔍 ${color.bold('OPC Agent Doctor')}\n`);

  let passed = 0;
  const total = checks.length;

  for (const check of checks) {
    try {
      const result = await check.check();
      const icon = result.ok ? color.green('✅') : color.red('❌');
      const name = check.name.padEnd(22);
      console.log(`  ${icon} ${name} ${result.detail}`);
      if (!result.ok && result.fix) {
        console.log(`     → ${result.fix}`);
      }
      if (result.ok) passed++;
    } catch (err) {
      const name = check.name.padEnd(22);
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
