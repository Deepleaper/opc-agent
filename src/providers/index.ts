import type { Message } from '../core/types';
import * as https from 'https';
import * as http from 'http';

export interface LLMProvider {
  name: string;
  chat(messages: Message[], systemPrompt?: string): Promise<string>;
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

  private isLocal(): boolean {
    return this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1');
  }

  async chat(messages: Message[], systemPrompt?: string): Promise<string> {
    if (!this.apiKey && !this.isLocal()) {
      // Stub mode when no API key and not local
      const last = messages[messages.length - 1];
      return `[${this.name}/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
    }
    const formatted = this.formatMessages(messages, systemPrompt);
    const result = await this.request({
      model: this.model,
      messages: formatted,
      temperature: 0.7,
      max_tokens: 2048,
    });
    return result.choices?.[0]?.message?.content ?? '';
  }

  async *chatStream(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    if (!this.apiKey && !this.isLocal()) {
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

  async chat(messages: Message[], systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      const last = messages[messages.length - 1];
      return `[gemini/${this.model} - no API key] Echo: ${last?.content ?? ''}`;
    }
    const body = this.formatContents(messages, systemPrompt);
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
  // Use native Gemini API when: key starts with AQ. (new format) OR base URL points to googleapis
  return key.startsWith('AQ.') || (baseUrl.includes('googleapis.com') && !baseUrl.includes('/openai'));
}

export function createProvider(name: string = 'openai', model?: string, baseUrl?: string, apiKey?: string): LLMProvider {
  const finalModel = model || process.env.OPC_LLM_MODEL || 'gpt-4o-mini';
  const finalKey = apiKey || getApiKey();
  const finalBaseUrl = baseUrl || getBaseUrl();

  // Auto-detect Gemini native when key is new format or base URL points to googleapis
  if (finalKey.startsWith('AQ.') || isGeminiNative()) {
    return new GeminiNativeProvider(finalModel, finalKey);
  }

  // Auto-detect provider name from base URL
  let resolvedName = name;
  if (finalBaseUrl.includes('deepseek.com')) {
    resolvedName = 'deepseek';
  } else if (finalBaseUrl.includes('dashscope.aliyuncs.com')) {
    resolvedName = 'qwen';
  }

  return new OpenAICompatibleProvider(resolvedName, finalModel, baseUrl, apiKey);
}

export const SUPPORTED_PROVIDERS = ['openai', 'deepseek', 'qwen', 'gemini', 'dashscope', 'zhipu', 'moonshot'] as const;
