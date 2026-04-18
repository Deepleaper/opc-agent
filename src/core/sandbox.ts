import type { TrustLevelType } from '../schema/oad';
import * as path from 'path';
import * as fs from 'fs';

export interface SandboxConfig {
  trustLevel: TrustLevelType;
  agentDir: string;
  networkAllowlist?: string[];
  shellAllowed?: boolean;
  allowedCommands?: string[];
  blockedCommands?: string[];
  maxFileSize?: number;       // bytes, default 10MB
  maxFiles?: number;          // max files in workspace, default 1000
  networkAccess?: boolean;    // allow network, default true
  readOnlyPaths?: string[];   // paths that can't be written
  timeout?: number;           // global timeout ms
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface SandboxStatus {
  files: number;
  totalSize: number;
  violations: number;
}

export interface SandboxRestrictions {
  fileSystem: { read: string[]; write: string[] };
  network: { allowed: string[] };
  shell: boolean;
}

const TRUST_RESTRICTIONS: Record<string, SandboxRestrictions> = {
  sandbox: {
    fileSystem: { read: ['.'], write: ['.'] },
    network: { allowed: [] },
    shell: false,
  },
  verified: {
    fileSystem: { read: ['.', '..'], write: ['.'] },
    network: { allowed: ['*.deepleaper.com', 'api.openai.com', 'api.deepseek.com'] },
    shell: false,
  },
  certified: {
    fileSystem: { read: ['*'], write: ['.', '..'] },
    network: { allowed: ['*'] },
    shell: true,
  },
  listed: {
    fileSystem: { read: ['*'], write: ['*'] },
    network: { allowed: ['*'] },
    shell: true,
  },
};

export class Sandbox {
  private config: SandboxConfig;
  private restrictions: SandboxRestrictions;
  private violations: number = 0;
  private maxFileSize: number;
  private maxFiles: number;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.restrictions = {
      ...TRUST_RESTRICTIONS[config.trustLevel] ?? TRUST_RESTRICTIONS.sandbox,
    };
    if (config.networkAllowlist) {
      this.restrictions.network.allowed = config.networkAllowlist;
    }
    if (config.shellAllowed !== undefined) {
      this.restrictions.shell = config.shellAllowed;
    }
    if (config.networkAccess === false) {
      this.restrictions.network.allowed = [];
    }
    this.maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    this.maxFiles = config.maxFiles ?? 1000;
  }

  get trustLevel(): TrustLevelType {
    return this.config.trustLevel;
  }

  getRestrictions(): SandboxRestrictions {
    return { ...this.restrictions };
  }

  checkFileAccess(filePath: string, mode: 'read' | 'write'): boolean {
    const resolved = path.resolve(filePath);
    const agentDir = path.resolve(this.config.agentDir);
    const allowedPaths = mode === 'read' ? this.restrictions.fileSystem.read : this.restrictions.fileSystem.write;

    if (allowedPaths.includes('*')) return true;

    for (const allowed of allowedPaths) {
      const allowedResolved = path.resolve(this.config.agentDir, allowed);
      if (resolved.startsWith(allowedResolved)) return true;
    }

    // Always allow access within agent's own directory
    return resolved.startsWith(agentDir);
  }

  checkNetworkAccess(url: string): boolean {
    if (this.restrictions.network.allowed.includes('*')) return true;
    if (this.restrictions.network.allowed.length === 0) return false;

    try {
      const hostname = new URL(url).hostname;
      return this.restrictions.network.allowed.some((pattern) => {
        if (pattern.startsWith('*.')) {
          return hostname.endsWith(pattern.slice(1));
        }
        return hostname === pattern;
      });
    } catch {
      return false;
    }
  }

  checkShellAccess(): boolean {
    return this.restrictions.shell;
  }

  validateFileOp(action: 'read' | 'write' | 'delete', filePath: string): ValidationResult {
    const resolved = path.resolve(filePath);

    if (action === 'write' || action === 'delete') {
      // Check read-only paths
      if (this.config.readOnlyPaths) {
        for (const ro of this.config.readOnlyPaths) {
          const roResolved = path.resolve(ro);
          if (resolved.startsWith(roResolved) || resolved === roResolved) {
            this.violations++;
            return { allowed: false, reason: `Path is read-only: ${ro}` };
          }
        }
      }

      // Check file size for writes
      if (action === 'write') {
        try {
          if (fs.existsSync(resolved)) {
            const stat = fs.statSync(resolved);
            if (stat.size > this.maxFileSize) {
              this.violations++;
              return { allowed: false, reason: `File exceeds max size: ${this.maxFileSize} bytes` };
            }
          }
        } catch {
          // File doesn't exist yet — that's fine
        }
      }
    }

    const mode = action === 'read' ? 'read' : 'write';
    if (!this.checkFileAccess(filePath, mode)) {
      this.violations++;
      return { allowed: false, reason: `File access denied for ${action}: ${filePath}` };
    }

    return { allowed: true };
  }

  validateCommand(command: string): ValidationResult {
    if (!this.restrictions.shell) {
      this.violations++;
      return { allowed: false, reason: 'Shell access is disabled' };
    }

    // Check blocklist
    if (this.config.blockedCommands) {
      for (const blocked of this.config.blockedCommands) {
        if (command.includes(blocked)) {
          this.violations++;
          return { allowed: false, reason: `Command is blocked: ${blocked}` };
        }
      }
    }

    // Check allowlist (if set, only allowed commands pass)
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      const allowed = this.config.allowedCommands.some(a => command.startsWith(a) || command.includes(a));
      if (!allowed) {
        this.violations++;
        return { allowed: false, reason: 'Command not in allowlist' };
      }
    }

    return { allowed: true };
  }

  validateNetwork(url: string): ValidationResult {
    if (this.config.networkAccess === false) {
      this.violations++;
      return { allowed: false, reason: 'Network access is disabled' };
    }
    if (!this.checkNetworkAccess(url)) {
      this.violations++;
      return { allowed: false, reason: `Network access denied for: ${url}` };
    }
    return { allowed: true };
  }

  getStatus(): SandboxStatus {
    let files = 0;
    let totalSize = 0;
    try {
      const agentDir = path.resolve(this.config.agentDir);
      if (fs.existsSync(agentDir)) {
        const countFiles = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
              countFiles(full);
            } else if (entry.isFile()) {
              files++;
              try { totalSize += fs.statSync(full).size; } catch {}
            }
          }
        };
        countFiles(agentDir);
      }
    } catch {}
    return { files, totalSize, violations: this.violations };
  }

  getViolations(): number {
    return this.violations;
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  getMaxFiles(): number {
    return this.maxFiles;
  }
}

// ─── Remote Sandbox Manager (v2.2.0) ────────────────────────

export interface RemoteSandboxConfig {
  backend: 'local' | 'docker' | 'ssh';
  docker?: { image: string; volumes?: string[] };
  ssh?: { host: string; user: string; keyPath?: string };
  timeout?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SandboxManager {
  private defaultConfig: RemoteSandboxConfig;

  constructor(config?: Partial<RemoteSandboxConfig>) {
    this.defaultConfig = {
      backend: config?.backend ?? 'local',
      docker: config?.docker,
      ssh: config?.ssh,
      timeout: config?.timeout ?? 30000,
    };
  }

  async exec(command: string, config?: Partial<RemoteSandboxConfig>): Promise<ExecResult> {
    const cfg = { ...this.defaultConfig, ...config };
    const { execSync } = await import('child_process');

    switch (cfg.backend) {
      case 'local': {
        try {
          const stdout = execSync(command, {
            timeout: cfg.timeout,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return { stdout: stdout ?? '', stderr: '', exitCode: 0 };
        } catch (err: any) {
          return {
            stdout: err.stdout ?? '',
            stderr: err.stderr ?? '',
            exitCode: err.status ?? 1,
          };
        }
      }
      case 'docker': {
        if (!cfg.docker?.image) throw new Error('Docker image is required');
        const volumes = (cfg.docker.volumes ?? []).map(v => `-v ${v}`).join(' ');
        const dockerCmd = `docker run --rm ${volumes} ${cfg.docker.image} sh -c "${command.replace(/"/g, '\\"')}"`;
        return this.exec(dockerCmd, { backend: 'local', timeout: cfg.timeout });
      }
      case 'ssh': {
        if (!cfg.ssh?.host || !cfg.ssh?.user) throw new Error('SSH host and user are required');
        const keyArg = cfg.ssh.keyPath ? `-i ${cfg.ssh.keyPath}` : '';
        const sshCmd = `ssh ${keyArg} ${cfg.ssh.user}@${cfg.ssh.host} "${command.replace(/"/g, '\\"')}"`;
        return this.exec(sshCmd, { backend: 'local', timeout: cfg.timeout });
      }
      default:
        throw new Error(`Unknown sandbox backend: ${cfg.backend}`);
    }
  }

  async upload(localPath: string, remotePath: string, config?: Partial<RemoteSandboxConfig>): Promise<void> {
    const cfg = { ...this.defaultConfig, ...config };
    if (cfg.backend === 'local') {
      const fsp = await import('fs');
      fsp.copyFileSync(localPath, remotePath);
      return;
    }
    if (cfg.backend === 'ssh') {
      const keyArg = cfg.ssh?.keyPath ? `-i ${cfg.ssh.keyPath}` : '';
      await this.exec(`scp ${keyArg} "${localPath}" ${cfg.ssh!.user}@${cfg.ssh!.host}:"${remotePath}"`, { backend: 'local' });
      return;
    }
    if (cfg.backend === 'docker') {
      throw new Error('Upload to docker not yet supported. Use volumes instead.');
    }
  }

  async download(remotePath: string, localPath: string, config?: Partial<RemoteSandboxConfig>): Promise<void> {
    const cfg = { ...this.defaultConfig, ...config };
    if (cfg.backend === 'local') {
      const fsp = await import('fs');
      fsp.copyFileSync(remotePath, localPath);
      return;
    }
    if (cfg.backend === 'ssh') {
      const keyArg = cfg.ssh?.keyPath ? `-i ${cfg.ssh.keyPath}` : '';
      await this.exec(`scp ${keyArg} ${cfg.ssh!.user}@${cfg.ssh!.host}:"${remotePath}" "${localPath}"`, { backend: 'local' });
      return;
    }
    if (cfg.backend === 'docker') {
      throw new Error('Download from docker not yet supported. Use volumes instead.');
    }
  }
}
