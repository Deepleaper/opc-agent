import * as fs from 'fs';
import * as path from 'path';

export interface ContextFile {
  path: string;
  type: 'agents' | 'soul' | 'user' | 'memory' | 'tools' | 'identity' | 'heartbeat' | 'bootstrap' | 'custom';
  content: string;
}

const FILE_TYPE_MAP: Record<string, ContextFile['type']> = {
  'AGENTS.md': 'agents',
  'SOUL.md': 'soul',
  'USER.md': 'user',
  'MEMORY.md': 'memory',
  'TOOLS.md': 'tools',
  'IDENTITY.md': 'identity',
  'HEARTBEAT.md': 'heartbeat',
  'BOOTSTRAP.md': 'bootstrap',
  '.opc.md': 'custom',
  '.opc/config.md': 'custom',
};

export class ContextDiscovery {
  static STANDARD_FILES = [
    'AGENTS.md', 'SOUL.md', 'USER.md', 'MEMORY.md', 'TOOLS.md',
    'IDENTITY.md', 'HEARTBEAT.md', 'BOOTSTRAP.md',
    '.opc.md', '.opc/config.md',
  ];

  private customFiles: string[] = [];
  private watchers: fs.FSWatcher[] = [];

  discover(workDir?: string): ContextFile[] {
    const dir = workDir || process.cwd();
    const found: ContextFile[] = [];

    for (const file of ContextDiscovery.STANDARD_FILES) {
      const fullPath = path.join(dir, file);
      if (fs.existsSync(fullPath)) {
        found.push({
          path: fullPath,
          type: FILE_TYPE_MAP[file] || 'custom',
          content: fs.readFileSync(fullPath, 'utf-8'),
        });
      }
    }

    for (const file of this.customFiles) {
      const fullPath = path.isAbsolute(file) ? file : path.join(dir, file);
      if (fs.existsSync(fullPath)) {
        found.push({
          path: fullPath,
          type: 'custom',
          content: fs.readFileSync(fullPath, 'utf-8'),
        });
      }
    }

    return found;
  }

  load(files: ContextFile[]): string {
    return files.map(f => `# ${f.type.toUpperCase()}\n${f.content}`).join('\n\n');
  }

  watch(workDir: string, onChange: Function): void {
    const watcher = fs.watch(workDir, { recursive: false }, (event, filename) => {
      if (filename && ContextDiscovery.STANDARD_FILES.includes(filename)) {
        onChange(filename, event);
      }
    });
    this.watchers.push(watcher);
  }

  stopWatching(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
  }

  addCustomFile(filePath: string): void {
    if (!this.customFiles.includes(filePath)) {
      this.customFiles.push(filePath);
    }
  }
}
