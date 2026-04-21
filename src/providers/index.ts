import type { Message } from '../core/types';
import type { MCPToolDefinition } from '../tools/mcp';
import * as https from 'https';
import * as http from 'http';

export interface ChatOptions {
  tools?: MCPToolDefinition[];
}

export interface LLMProvider {
  name: string;
  chat(messages: Message[], systemPrompt?: string, options?: ChatOptions): Promise<string>;
  chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string>;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function getApiKey(): string {
  return process.env.OPC_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
}

function getBaseUrl(): string {
  return process.env.OPC_LLM_BASE_URL || 'https://api.openai.com/v1';
}

function buildToolPrompt(tools: MCPToolDefinition[]): string {
  const toolsDesc = tools.map(t =>
    `- ${t.name}: ${t.description}\n  Input schema: ${JSON.stringify(t.inputSchema)}`
  ).join('\n');
  return `\n\nYou have access to the following tools. To use a tool, respond with ONLY a JSON object in this format:\n<tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>\n\nAvailable tools:\n${toolsDesc}\n\nIf you don't need a tool, respond normally with text.`;
}

class OpenAICompatibleProvider implements LLMProvider {
  name: string;
  private model: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(name: string, model: string, baseUrl?: string, apiKey?: string) {
    this.name = name;
    this.model = model;
    this.baseUrl = baseUrl || getBaseUrl();
    this.apiKey = apiKey || getApiKey();
  }

  private formatMessages(messages: Message[], systemPrompt?: string): OpenAIMessage[] {
    const formatted: OpenAIMessage[] = [];
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }
    for (const m of messages) {
      formatted.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
    return formatted;
  }

  private async request(body: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('No API key configured. Set OPC_LLM_API_KEY or OPENAI_API_KEY environment variable.');
    }

    const url = new URL(`${this.baseUrl}/chat/completions`);
    const isGemini = url.hostname.includes('googleapis.com');
    if (isGemini) {
      url.searchParams.set('key', this.apiKey);
    }
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const postData = JSON.stringify(body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(postData)),
    };
    if (!isGemini) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk.toString()));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`LLM API error ${res.statusCode}: ${data}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async chat(messages: Message[], systemPrompt?: string, options?: ChatOptions): Promise<string> {
    if (!this.apiKey) {
      const last = messages[messages.length - 1];
      return `[${this.name}/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
    }
    let effectivePrompt = systemPrompt;
    if (options?.tools && options.tools.length > 0) {
      effectivePrompt = (systemPrompt || '') + buildToolPrompt(options.tools);
    }
    const formatted = this.formatMessages(messages, effectivePrompt);
    const result = await this.request({
      model: this.model,
      messages: formatted,
      temperature: 0.7,
      max_tokens: 2048,
    });
    return result.choices?.[0]?.message?.content ?? '';
  }

  async *chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    if (!this.apiKey) {
      const last = messages[messages.length - 1];
      yield `[${this.name}/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
      return;
    }

    const formatted = this.formatMessages(messages, systemPrompt);
    const url = new URL(`${this.baseUrl}/chat/completions`);
    const isGemini = url.hostname.includes('googleapis.com');
    if (isGemini) {
      url.searchParams.set('key', this.apiKey);
    }
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const postData = JSON.stringify({
      model: this.model,
      messages: formatted,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });

    const streamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(postData)),
    };
    if (!isGemini) {
      streamHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: streamHeaders,
        },
        resolve,
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (response.statusCode && response.statusCode >= 400) {
      let data = '';
      for await (const chunk of response) data += chunk.toString();
      throw new Error(`LLM API error ${response.statusCode}: ${data}`);
    }

    let buffer = '';
    for await (const chunk of response) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}

class GeminiNativeProvider implements LLMProvider {
  name = 'gemini';
  private model: string;
  private apiKey: string;

  constructor(model: string, apiKey?: string) {
    this.model = model;
    this.apiKey = apiKey || getApiKey();
  }

  private buildUrl(stream: boolean): string {
    const action = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:${action}key=${this.apiKey}`;
  }

  private formatContents(messages: Message[], systemPrompt?: string): { contents: any[]; systemInstruction?: any } {
    const contents: any[] = [];
    for (const m of messages) {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
    const result: any = { contents };
    if (systemPrompt) {
      result.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    return result;
  }

  async chat(messages: Message[], systemPrompt?: string, options?: ChatOptions): Promise<string> {
    if (!this.apiKey) {
      const last = messages[messages.length - 1];
      return `[gemini/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
    }
    let effectivePrompt = systemPrompt;
    if (options?.tools && options.tools.length > 0) {
      effectivePrompt = (systemPrompt || '') + buildToolPrompt(options.tools);
    }
    const body = this.formatContents(messages, effectivePrompt);
    const url = this.buildUrl(false);
    const postData = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(postData)) },
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) { reject(new Error(`Gemini API error ${res.statusCode}: ${data}`)); return; }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
          } catch { reject(new Error(`Invalid Gemini response: ${data.slice(0, 200)}`)); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async *chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    if (!this.apiKey) {
      const last = messages[messages.length - 1];
      yield `[gemini/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
      return;
    }
    const body = this.formatContents(messages, systemPrompt);
    const url = this.buildUrl(true);
    const postData = JSON.stringify(body);
    const parsedUrl = new URL(url);

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(postData)) },
      }, resolve);
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (response.statusCode && response.statusCode >= 400) {
      let data = '';
      for await (const chunk of response) data += chunk.toString();
      throw new Error(`Gemini API error ${response.statusCode}: ${data}`);
    }

    let buffer = '';
    for await (const chunk of response) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {}
      }
    }
  }
}

function isGeminiNative(): boolean {
  const baseUrl = process.env.OPC_LLM_BASE_URL || '';
  const key = getApiKey();
  return key.startsWith('AQ.') || (baseUrl.includes('googleapis.com') && !baseUrl.includes('/openai'));
}

class ClaudeCLIProvider implements LLMProvider {
  name = 'claude-cli';
  private model: string;

  constructor(model?: string) {
    // Claude CLI uses short model names; don't pass API-style model names
    // Let Claude CLI use its default model unless explicitly set to a known CLI model
    const cliModels = ['sonnet', 'opus', 'haiku', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'];
    if (model && !cliModels.includes(model)) {
      // Map common patterns
      if (model.includes('opus')) this.model = 'opus';
      else if (model.includes('haiku')) this.model = 'haiku';
      else this.model = ''; // let CLI choose default
    } else {
      this.model = model || '';
    }
  }

  async chat(messages: Message[], systemPrompt?: string, options?: ChatOptions): Promise<string> {
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    // Build the prompt from messages
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';

    let prompt = lastMessage.content;

    // Add tool prompt if tools provided
    if (options?.tools && options.tools.length > 0) {
      prompt += buildToolPrompt(options.tools);
    }

    const args = ['-p'];
    // Write system prompt to temp file to avoid shell escaping issues
    let tmpFile: string | undefined;
    if (systemPrompt) {
      const tmpDir = mkdtempSync(join(tmpdir(), 'opc-'));
      tmpFile = join(tmpDir, 'system.txt');
      writeFileSync(tmpFile, systemPrompt, 'utf8');
      args.push('--system-prompt-file', tmpFile);
    }
    if (this.model) {
      args.push('--model', this.model);
    }
    args.push(prompt);

    try {
      const { spawn } = await import('child_process');
      const result = await new Promise<string>((resolve, reject) => {
        const proc = spawn('claude', args, {
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Close stdin immediately to avoid "no stdin data" warning
        proc.stdin.end();
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0 || stdout.trim()) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`Claude CLI exited ${code}: ${stderr}`));
          }
        });
        proc.on('error', (err: any) => {
          if (err.code === 'ENOENT') {
            reject(new Error(
              'Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code\n' +
              'Then authenticate: claude login'
            ));
          } else {
            reject(err);
          }
        });
        // Timeout
        setTimeout(() => {
          proc.kill();
          reject(new Error('Claude CLI timed out after 120s'));
        }, 120_000);
      });
      return result;
    } catch (err: any) {
      throw new Error(`Claude CLI error: ${err.message}`);
    } finally {
      if (tmpFile) {
        try { unlinkSync(tmpFile); } catch {}
      }
    }
  }

  async *chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    const args = ['-p', '--verbose', '--output-format', 'stream-json'];
    if (this.model) {
      args.push('--model', this.model);
    }

    // Write system prompt to temp file if needed
    let tmpFile: string | undefined;
    if (systemPrompt) {
      const { writeFileSync } = await import('fs');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      tmpFile = join(tmpdir(), `opc-claude-stream-${Date.now()}.txt`);
      writeFileSync(tmpFile, systemPrompt);
      args.push('--system-prompt-file', tmpFile);
    }

    const lastMsg = messages[messages.length - 1];
    args.push(lastMsg?.content ?? '');

    const { spawn } = await import('child_process');

    try {
      const proc = spawn('claude', args, {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      proc.stdin.end();

      let buffer = '';
      let lastContent = '';

      for await (const chunk of proc.stdout) {
        buffer += (chunk as Buffer).toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            // Claude CLI stream-json format:
            // {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
            if (event.type === 'assistant' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  const newContent = block.text;
                  if (newContent.length > lastContent.length) {
                    yield newContent.slice(lastContent.length);
                    lastContent = newContent;
                  }
                }
              }
            }
            // Also handle result type for final content
            if (event.type === 'result' && event.result) {
              const remaining = event.result.slice(lastContent.length);
              if (remaining) yield remaining;
            }
            // Handle assistant message with content array
            if (event.type === 'assistant' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  const newText = block.text;
                  if (newText.length > lastContent.length) {
                    yield newText.slice(lastContent.length);
                    lastContent = newText;
                  }
                }
              }
            }
            // Handle result message
            if (event.type === 'result' && event.result) {
              const resultText = typeof event.result === 'string' ? event.result : '';
              if (resultText && resultText.length > lastContent.length) {
                yield resultText.slice(lastContent.length);
              }
            }
          } catch {
            // Not JSON, might be raw text
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === 'result' && event.result) {
            const resultText = typeof event.result === 'string' ? event.result : '';
            if (resultText && resultText.length > lastContent.length) {
              yield resultText.slice(lastContent.length);
            }
          }
        } catch {
          // If not JSON, yield as raw text if we haven't yielded anything
          if (!lastContent && buffer.trim()) {
            yield buffer.trim();
          }
        }
      }

      await new Promise<void>((resolve) => {
        proc.on('close', () => resolve());
      });
    } finally {
      if (tmpFile) {
        try { const { unlinkSync } = await import('fs'); unlinkSync(tmpFile); } catch {}
      }
    }
  }
}

import { execSync } from 'child_process';

function detectClaudeCLI(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe', timeout: 3000 });
    return true;
  } catch { return false; }
}

function detectOllama(): boolean {
  try {
    // Use node http instead of curl for Windows compatibility
    const { execSync: es } = require('child_process');
    // Quick check: try to connect to Ollama API via node
    const result = es(
      `node -e "const h=require('http');const r=h.get('http://localhost:11434/api/tags',{timeout:2000},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>{process.stdout.write(d.includes('models')?'1':'0')})});r.on('error',()=>process.stdout.write('0'));r.on('timeout',()=>{r.destroy();process.stdout.write('0')})"`,
      { stdio: 'pipe', timeout: 5000 }
    );
    return result.toString().trim() === '1';
  } catch { return false; }
}

function detectApiKeys(): { provider: string; key: string; baseUrl?: string } | null {
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', key: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-api-key-here') return { provider: 'openai', key: process.env.OPENAI_API_KEY };
  if (process.env.DEEPSEEK_API_KEY) return { provider: 'deepseek', key: process.env.DEEPSEEK_API_KEY, baseUrl: 'https://api.deepseek.com/v1' };
  if (process.env.DASHSCOPE_API_KEY) return { provider: 'qwen', key: process.env.DASHSCOPE_API_KEY, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' };
  if (process.env.GEMINI_API_KEY) return { provider: 'gemini', key: process.env.GEMINI_API_KEY };
  return null;
}

export function autoDetectProvider(): { name: string; model?: string; baseUrl?: string; apiKey?: string } {
  // 1. Ollama (local, free, zero cost — always prefer local first)
  if (detectOllama()) {
    return { name: 'ollama' }; // model auto-detected in createProvider ollama branch
  }

  // 2. Claude CLI (zero config, Claude Max/Pro subscription)
  if (detectClaudeCLI()) {
    return { name: 'claude-cli' };
  }

  // 3. API keys from environment
  const apiKey = detectApiKeys();
  if (apiKey) {
    return { name: apiKey.provider, apiKey: apiKey.key, baseUrl: apiKey.baseUrl };
  }

  // 4. Nothing found
  return { name: 'none' };
}

export function createProvider(name: string = 'auto', model?: string, baseUrl?: string, apiKey?: string): LLMProvider {
  // Auto-detect if name is 'auto' or default openai with no real key
  const needsAutoDetect = name === 'auto' || (name === 'openai' && !apiKey && (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-api-key-here'));
  if (needsAutoDetect) {
    const detected = autoDetectProvider();
    if (detected.name !== 'none') {
      console.log(`[provider] Auto-detected: ${detected.name}`);
      name = detected.name;
      model = model || detected.model;
      baseUrl = baseUrl || detected.baseUrl;
      apiKey = apiKey || detected.apiKey;
    }
  }

  const finalModel = (model && model !== 'auto') ? model : (process.env.OPC_LLM_MODEL || 'gpt-4o-mini');

  // Claude CLI mode: use local claude command (Claude Max/Pro subscription)
  if (name === 'claude-cli' || process.env.OPC_LLM_PROVIDER === 'claude-cli') {
    return new ClaudeCLIProvider(finalModel !== 'gpt-4o-mini' ? finalModel : undefined);
  }

  if (name === 'ollama') {
    const ollamaBase = baseUrl || process.env.OPC_LLM_BASE_URL || 'http://localhost:11434/v1';
    const ollamaKey = apiKey || process.env.OPC_LLM_API_KEY || 'ollama';
    let ollamaModel = finalModel;
    // Auto-detect first available Ollama model if using default gpt-4o-mini (which Ollama doesn't have)
    if (ollamaModel === 'gpt-4o-mini' || ollamaModel === 'gpt-4o') {
      try {
        const { execSync } = require('child_process');
        const tagsUrl = ollamaBase.replace('/v1', '') + '/api/tags';
        const raw = execSync(`curl -s "${tagsUrl}"`, { timeout: 3000, encoding: 'utf8' });
        const data = JSON.parse(raw);
        const available = (data.models || []).filter((m: { name: string }) => !m.name.includes('embed'));
        if (available.length > 0) {
          ollamaModel = available[0].name;
        }
      } catch { /* use finalModel as-is */ }
    }
    return new OpenAICompatibleProvider('ollama', ollamaModel, ollamaBase, ollamaKey);
  }

  const finalKey = apiKey || getApiKey();
  const finalBaseUrl = baseUrl || getBaseUrl();

  if (finalKey.startsWith('AQ.') || isGeminiNative()) {
    return new GeminiNativeProvider(finalModel, finalKey);
  }

  let resolvedName = name;
  if (finalBaseUrl.includes('deepseek.com')) {
    resolvedName = 'deepseek';
  } else if (finalBaseUrl.includes('dashscope.aliyuncs.com')) {
    resolvedName = 'qwen';
  }

  return new OpenAICompatibleProvider(resolvedName, finalModel, finalBaseUrl, finalKey);
}

export const SUPPORTED_PROVIDERS = ['openai', 'ollama', 'claude-cli', 'deepseek', 'qwen', 'gemini', 'dashscope', 'zhipu', 'moonshot'] as const;
