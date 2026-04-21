# Task 7+8: Skill System + Tool System

## Part A: Skill 系统 (src/skills/)

### 1. src/skills/loader.ts
三级渐进加载：
```typescript
import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../core/types';

// L0: 只加载 name + description 列表 (~3k token)
export async function loadSkillIndex(dirs: string[]): Promise<{ name: string; description: string; path: string }[]> {
  const index: { name: string; description: string; path: string }[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = await fs.promises.readdir(dir, { recursive: true });
    for (const file of files) {
      if (!String(file).endsWith('.md')) continue;
      const fullPath = path.join(dir, String(file));
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const { name, description } = parseSkillFrontmatter(content);
      if (name) index.push({ name, description: description || '', path: fullPath });
    }
  }
  return index;
}

// L1: 加载匹配 Skill 的完整内容
export async function loadSkillFull(skillPath: string): Promise<SkillDefinition> {
  const content = await fs.promises.readFile(skillPath, 'utf-8');
  return parseSkillContent(content);
}

// L2: 按需加载 Skill 引用的外部文件
export async function loadSkillReference(skillDir: string, refPath: string): Promise<string> {
  return fs.promises.readFile(path.join(skillDir, refPath), 'utf-8');
}

function parseSkillFrontmatter(content: string): { name: string; description: string } {
  // 解析 YAML frontmatter (--- 包裹)
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];
  const name = yaml.match(/name:\s*(.+)/)?.[1]?.trim() || '';
  const description = yaml.match(/description:\s*['"]?(.+?)['"]?\s*$/m)?.[1]?.trim() || '';
  return { name, description };
}
```

### 2. src/skills/matcher.ts
Skill 匹配（关键词 + TF-IDF，不调 LLM）：
```typescript
export function matchSkills(
  query: string,
  index: { name: string; description: string; path: string }[],
  topK: number = 3
): { name: string; path: string; score: number }[] {
  // 对每个 skill 计算匹配分
  // 1. 关键词完全匹配 → +1.0
  // 2. 部分匹配（query 词在 description 中出现）→ +0.5 per word
  // 3. 按 score 降序，取 top-K
  // 4. score < 0.1 的过滤掉
}
```

### 3. src/skills/builtin/ 目录
创建 builtin 目录和一个示例 Skill：
```markdown
// src/skills/builtin/web-search.md
---
name: web-search
description: Search the web and summarize results
triggers: [search, find, look up, 搜索, 查找]
---
# Web Search Skill
When user asks to search for something, use the web_search tool.
```

## Part B: Tool 系统 (src/tools/)

### 1. src/tools/registry.ts
```typescript
import { ToolDefinition } from '../core/types';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  
  register(tool: ToolDefinition): void { this.tools.set(tool.name, tool); }
  get(name: string): ToolDefinition | undefined { return this.tools.get(name); }
  list(): ToolDefinition[] { return Array.from(this.tools.values()); }
  toOpenAIFormat(): any[] {
    return this.list().map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
  }
}
```

### 2. src/tools/hooks.ts
```typescript
export interface ToolHookContext { toolName: string; args: Record<string, any>; }
export type BeforeHook = (ctx: ToolHookContext) => { allow: boolean; reason?: string; modifiedArgs?: Record<string, any> };
export type AfterHook = (ctx: ToolHookContext, result: string) => string;

export class ToolHooks {
  private beforeHooks: BeforeHook[] = [];
  private afterHooks: AfterHook[] = [];
  addBefore(hook: BeforeHook): void { this.beforeHooks.push(hook); }
  addAfter(hook: AfterHook): void { this.afterHooks.push(hook); }
  async runBefore(ctx: ToolHookContext): Promise<{ allow: boolean; reason?: string }> { ... }
  async runAfter(ctx: ToolHookContext, result: string): Promise<string> { ... }
}

// 内置 hook: 危险命令拦截
export const dangerousCommandBlocker: BeforeHook = (ctx) => {
  if (ctx.toolName === 'shell' && /rm\s+-rf|format\s+[c-z]:|DROP\s+TABLE/i.test(ctx.args.command || '')) {
    return { allow: false, reason: 'Dangerous command blocked' };
  }
  return { allow: true };
};
```

### 3. src/tools/permission.ts
```typescript
import { PermissionLevel } from '../core/types';
type PermissionConfig = Record<string, PermissionLevel>;

const DEFAULTS: PermissionConfig = {
  read_file: 'allow', write_file: 'allow', web_search: 'allow',
  execute_code: 'ask', shell_command: 'ask', delete_file: 'ask',
};

export function checkPermission(toolName: string, config?: PermissionConfig): PermissionLevel {
  return config?.[toolName] ?? DEFAULTS[toolName] ?? 'ask';
}
```

### 4. src/tools/execute-code.ts
```typescript
import { execFile } from 'child_process';

export async function executeCode(code: string, lang: 'js' | 'ts' | 'python' | 'shell', timeout: number = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // 隔离子进程执行
  // js/ts → node -e
  // python → python3 -c
  // shell → sh -c / powershell -Command
  // 超时 kill
}
```

### 5. src/tools/builtin/ 目录
创建几个基础 tool 定义文件（read_file, write_file, web_search, shell_command）

## 验收
- `npx tsc --noEmit` 对所有新文件零报错
- git commit
