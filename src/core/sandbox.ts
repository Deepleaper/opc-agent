import type { TrustLevelType } from '../schema/oad';
import * as path from 'path';

export interface SandboxConfig {
  trustLevel: TrustLevelType;
  agentDir: string;
  networkAllowlist?: string[];
  shellAllowed?: boolean;
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
}
