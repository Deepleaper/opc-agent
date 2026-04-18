import { execSync } from 'child_process';

export interface IDEConfig {
  editor: 'vscode' | 'jetbrains' | 'zed' | 'cursor';
  workspacePath?: string;
}

export interface Diagnostic {
  path: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  include?: string;
  exclude?: string;
  maxResults?: number;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  text: string;
}

export class IDEBridge {
  private config: IDEConfig;

  constructor(config: IDEConfig) {
    this.config = config;
  }

  private getCliCommand(): string {
    switch (this.config.editor) {
      case 'vscode': case 'cursor': return this.config.editor === 'cursor' ? 'cursor' : 'code';
      case 'jetbrains': return 'idea';
      case 'zed': return 'zed';
    }
  }

  private exec(cmd: string): string {
    try {
      return execSync(cmd, { encoding: 'utf-8', timeout: 10000, cwd: this.config.workspacePath }).trim();
    } catch (e: any) {
      throw new Error(`IDE command failed: ${e.message}`);
    }
  }

  async openFile(path: string, line?: number): Promise<void> {
    const cli = this.getCliCommand();
    const target = line ? `${path}:${line}` : path;
    if (this.config.editor === 'vscode' || this.config.editor === 'cursor') {
      this.exec(`${cli} --goto "${target}"`);
    } else if (this.config.editor === 'zed') {
      this.exec(`zed "${target}"`);
    } else {
      this.exec(`${cli} --line ${line || 1} "${path}"`);
    }
  }

  async getDiagnostics(path?: string): Promise<Diagnostic[]> {
    // VS Code doesn't expose diagnostics via CLI; return empty as stub
    return [];
  }

  async runCommand(command: string): Promise<string> {
    const cli = this.getCliCommand();
    if (this.config.editor === 'vscode' || this.config.editor === 'cursor') {
      return this.exec(`${cli} --command "${command}"`);
    }
    throw new Error(`runCommand not supported for ${this.config.editor}`);
  }

  async getOpenFiles(): Promise<string[]> {
    // Stub — no standard CLI to get open files
    return [];
  }

  async applyEdit(path: string, edits: TextEdit[]): Promise<void> {
    // Stub — would use editor's API/extension
    if (edits.length === 0) return;
    throw new Error('applyEdit requires an IDE extension to be installed. Use file system edits as fallback.');
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const cli = this.getCliCommand();
    if (this.config.editor === 'vscode' || this.config.editor === 'cursor') {
      try {
        const args = [`--search "${query}"`];
        if (options?.include) args.push(`--include "${options.include}"`);
        const output = this.exec(`${cli} ${args.join(' ')}`);
        // Parse output lines
        return output.split('\n').filter(Boolean).map(line => {
          const match = line.match(/^(.+):(\d+):(\d+):(.*)$/);
          if (!match) return { path: '', line: 0, column: 0, text: line };
          return { path: match[1], line: parseInt(match[2]), column: parseInt(match[3]), text: match[4] };
        });
      } catch { return []; }
    }
    return [];
  }

  async getSelection(): Promise<{ path: string; text: string; range: Range } | null> {
    // Stub — requires editor extension
    return null;
  }

  async installExtension(extensionId: string): Promise<void> {
    const cli = this.getCliCommand();
    if (this.config.editor === 'vscode' || this.config.editor === 'cursor') {
      this.exec(`${cli} --install-extension ${extensionId}`);
    } else {
      throw new Error(`installExtension not supported for ${this.config.editor}`);
    }
  }
}
