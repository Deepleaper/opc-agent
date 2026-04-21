// v2 agentkits provider — cloud model routing via AgentKits gateway (OpenAI-compatible)
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  EmbedRequest,
  EmbedResponse,
  ModelInfo,
  AssistantMessage,
} from '../core/types';
import { BaseModelProvider } from './model-provider';

const BASE_URL = 'https://api.agentkits.ai/v1';

export interface AgentKitsConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  strategy?: 'experience' | 'cost';
}

interface OAIChatResponse {
  id?: string;
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string; role?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OAIEmbedResponse {
  model: string;
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

export class AgentKitsProvider extends BaseModelProvider {
  private baseUrl: string;
  private strategy: string;

  constructor(private config: AgentKitsConfig = {}) {
    super();
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.strategy = config.strategy ?? 'experience';
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Strategy': this.strategy,
    };
    if (this.config.apiKey) h['Authorization'] = `Bearer ${this.config.apiKey}`;
    return h;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? this.config.defaultModel ?? 'auto';
    const messages = req.messages.map(m => ({ role: m.role, content: m.content }));
    if (req.systemPrompt) messages.unshift({ role: 'system', content: req.systemPrompt });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
      });
    } catch (err: any) {
      throw new Error(`AgentKits network error: ${err.message}`);
    }

    if (res.status === 401) throw new Error('AgentKits: invalid API key');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AgentKits error ${res.status}: ${text}`);
    }

    const data = await res.json() as OAIChatResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    const assistantMsg: AssistantMessage = { role: 'assistant', content, timestamp: Date.now() };
    const usage = data.usage;

    return {
      id: data.id ?? `ak-${Date.now()}`,
      model,
      message: assistantMsg,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
      finishReason: (data.choices?.[0]?.finish_reason ?? 'stop') as 'stop' | 'tool_calls' | 'length' | 'error',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    const model = req.model ?? this.config.defaultModel ?? 'auto';
    const messages = req.messages.map(m => ({ role: m.role, content: m.content }));
    if (req.systemPrompt) messages.unshift({ role: 'system', content: req.systemPrompt });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
          stream: true,
        }),
      });
    } catch (err: any) {
      throw new Error(`AgentKits network error: ${err.message}`);
    }

    if (res.status === 401) throw new Error('AgentKits: invalid API key');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AgentKits stream error ${res.status}: ${text}`);
    }

    if (!res.body) return;

    let buf = '';
    let idx = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += Buffer.from(chunk).toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as OAIChatResponse;
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          const finishReason = parsed.choices?.[0]?.finish_reason;
          const done = !!finishReason;
          yield {
            id: parsed.id ?? `ak-${idx}`,
            delta,
            done,
            finishReason: done ? (finishReason as 'stop' | 'tool_calls' | 'length' | 'error') : undefined,
          };
          idx++;
          if (done) return;
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: req.model ?? 'text-embedding-3-small',
          input: req.input,
        }),
      });
    } catch (err: any) {
      throw new Error(`AgentKits network error: ${err.message}`);
    }

    if (res.status === 401) throw new Error('AgentKits: invalid API key');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AgentKits embed error ${res.status}: ${text}`);
    }

    const data = await res.json() as OAIEmbedResponse;
    return {
      model: data.model,
      embeddings: data.data.map(d => d.embedding),
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: 0, totalTokens: data.usage.total_tokens ?? 0 }
        : undefined,
    };
  }

  async info(): Promise<ModelInfo[]> {
    return [{
      id: 'agentkits',
      provider: 'agentkits',
      contextLength: 128000,
      supportedFeatures: ['tools', 'streaming'],
      isLocal: false,
    }];
  }
}
