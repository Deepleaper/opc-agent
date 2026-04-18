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
