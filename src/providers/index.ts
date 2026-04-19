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
    this.model = model || 'sonnet';
  }

  async chat(messages: Message[], systemPrompt?: string, options?: ChatOptions): Promise<string> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const execFileAsync = promisify(execFile);

    // Build the prompt from messages
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';

    let prompt = lastMessage.content;

    // Add tool prompt if tools provided
    if (options?.tools && options.tools.length > 0) {
      prompt += buildToolPrompt(options.tools);
    }

    const args = ['-p', '--bare'];
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
      const { stdout } = await execFileAsync('claude', args, {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      });
      return stdout.trim();
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(
          'Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code\n' +
          'Then authenticate: claude login'
        );
      }
      // If claude returns non-zero but has stdout, use it
      if (err.stdout && err.stdout.trim()) {
        return err.stdout.trim();
      }
      throw new Error(`Claude CLI error: ${err.message}`);
    } finally {
      if (tmpFile) {
        try { unlinkSync(tmpFile); } catch {}
      }
    }
  }

  async *chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    // Claude CLI --print doesn't support streaming well, so we do single-shot
    const result = await this.chat(messages, systemPrompt);
    yield result;
  }
}

export function createProvider(name: string = 'openai', model?: string, baseUrl?: string, apiKey?: string): LLMProvider {
  const finalModel = model || process.env.OPC_LLM_MODEL || 'gpt-4o-mini';

  // Claude CLI mode: use local claude command (Claude Max/Pro subscription)
  if (name === 'claude-cli' || process.env.OPC_LLM_PROVIDER === 'claude-cli') {
    return new ClaudeCLIProvider(finalModel !== 'gpt-4o-mini' ? finalModel : undefined);
  }

  if (name === 'ollama') {
    const ollamaBase = baseUrl || process.env.OPC_LLM_BASE_URL || 'http://localhost:11434/v1';
    const ollamaKey = apiKey || process.env.OPC_LLM_API_KEY || 'ollama';
    return new OpenAICompatibleProvider('ollama', finalModel, ollamaBase, ollamaKey);
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

  return new OpenAICompatibleProvider(resolvedName, finalModel, baseUrl, apiKey);
}

export const SUPPORTED_PROVIDERS = ['openai', 'ollama', 'claude-cli', 'deepseek', 'qwen', 'gemini', 'dashscope', 'zhipu', 'moonshot'] as const;
