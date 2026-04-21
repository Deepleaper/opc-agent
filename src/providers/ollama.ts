// v2 ollama provider — local model inference via Ollama HTTP API
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

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
}

interface OllamaModel {
  name: string;
  size: number;
  details?: { parameter_size?: string; families?: string[] };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaChatChunk {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider extends BaseModelProvider {
  private baseUrl: string;
  private _chatModel: string | undefined;
  private _embedModel: string | undefined;

  constructor(private config: OllamaConfig = {}) {
    super();
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this._chatModel = config.model;
    this._embedModel = config.embeddingModel;
  }

  private async detectChatModel(): Promise<string> {
    if (this._chatModel) return this._chatModel;
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return 'llama3.2';
      const data = await res.json() as OllamaTagsResponse;
      const chatModels = (data.models ?? [])
        .filter(m => !m.name.toLowerCase().includes('embed'))
        .sort((a, b) => b.size - a.size);
      this._chatModel = chatModels[0]?.name ?? 'llama3.2';
    } catch {
      this._chatModel = 'llama3.2';
    }
    return this._chatModel;
  }

  private async detectEmbedModel(): Promise<string> {
    if (this._embedModel) return this._embedModel;
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return 'nomic-embed-text';
      const data = await res.json() as OllamaTagsResponse;
      const embedModels = (data.models ?? []).filter(m => m.name.toLowerCase().includes('embed'));
      this._embedModel = embedModels[0]?.name ?? 'nomic-embed-text';
    } catch {
      this._embedModel = 'nomic-embed-text';
    }
    return this._embedModel;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = req.model ?? await this.detectChatModel();
    const messages = req.messages.map(m => ({ role: m.role, content: m.content }));
    if (req.systemPrompt) messages.unshift({ role: 'system', content: req.systemPrompt });

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = await res.json() as OllamaChatChunk;
    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: data.message.content,
      timestamp: Date.now(),
    };

    return {
      id: `ollama-${Date.now()}`,
      model,
      message: assistantMsg,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    const model = req.model ?? await this.detectChatModel();
    const messages = req.messages.map(m => ({ role: m.role, content: m.content }));
    if (req.systemPrompt) messages.unshift({ role: 'system', content: req.systemPrompt });

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama stream error ${res.status}: ${text}`);
    }

    if (!res.body) return;

    let buf = '';
    let idx = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += Buffer.from(chunk).toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as OllamaChatChunk;
          yield {
            id: `ollama-${idx++}`,
            delta: parsed.message.content,
            done: parsed.done,
            finishReason: parsed.done ? 'stop' : undefined,
          };
          if (parsed.done) return;
        } catch {
          // skip malformed NDJSON lines
        }
      }
    }
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const model = req.model ?? await this.detectEmbedModel();

    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: req.input }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama embed error ${res.status}: ${text}`);
    }

    const data = await res.json() as { model: string; embeddings: number[][] };
    return {
      model: data.model,
      embeddings: data.embeddings,
    };
  }

  async info(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json() as OllamaTagsResponse;
      return (data.models ?? []).map(m => {
        const features: ('tools' | 'vision' | 'streaming' | 'embedding')[] = ['streaming'];
        if (m.name.toLowerCase().includes('embed')) features.push('embedding');
        return {
          id: m.name,
          provider: 'ollama',
          contextLength: 4096,
          supportedFeatures: features,
          isLocal: true,
        };
      });
    } catch {
      return [];
    }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
