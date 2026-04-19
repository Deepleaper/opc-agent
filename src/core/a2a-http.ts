import { EventEmitter } from 'events';
import { Router, Request, Response } from 'express';
import { Logger } from './logger';
import { AgentCardRegistry, AgentCard } from './a2a';

// ── A2A HTTP Server ─────────────────────────────────────────

export interface A2AHttpServerConfig {
  card: AgentCard;
  registry?: AgentCardRegistry;
  basePath?: string;
}

export class A2AHttpServer extends EventEmitter {
  readonly router: Router;
  private card: AgentCard;
  private registry: AgentCardRegistry;
  private logger = new Logger('a2a:http:server');

  constructor(config: A2AHttpServerConfig) {
    super();
    this.card = config.card;
    this.registry = config.registry ?? new AgentCardRegistry();
    this.registry.register(this.card);
    this.router = Router();
    this.setupRoutes();
    this.logger.info('A2AHttpServer initialized', { agent: this.card.name });
  }

  private setupRoutes(): void {
    // Agent card discovery (A2A well-known)
    this.router.get('/.well-known/agent.json', (_req: Request, res: Response) => {
      const { handler, ...publicCard } = this.card;
      res.json(publicCard);
    });

    // List all registered agents
    this.router.get('/a2a/agents', (_req: Request, res: Response) => {
      const cards = this.registry.list().map(({ handler, ...c }) => c);
      res.json({ agents: cards });
    });

    // Discover agents by capability query
    this.router.post('/a2a/discover', (req: Request, res: Response) => {
      const { query } = req.body as { query?: string };
      if (!query) {
        res.status(400).json({ error: 'Missing "query" in request body' });
        return;
      }
      const results = this.registry.find(query).map(({ handler, ...c }) => c);
      res.json({ results });
    });

    // Receive an A2A message
    this.router.post('/a2a/message', async (req: Request, res: Response) => {
      const { from, capability, payload } = req.body as {
        from?: string;
        capability?: string;
        payload?: string;
      };
      if (!from || !capability || payload === undefined) {
        res.status(400).json({ error: 'Missing required fields: from, capability, payload' });
        return;
      }

      this.logger.info('A2A message received', { from, capability });
      this.emit('message', { from, capability, payload });

      try {
        const response = await this.registry.send(this.card.name, payload);
        res.json({
          from: this.card.name,
          status: 'success',
          response,
          timestamp: Date.now(),
        });
      } catch (err) {
        const message = (err as Error).message;
        this.logger.error('A2A message handling failed', { error: message });
        res.status(500).json({
          from: this.card.name,
          status: 'error',
          error: message,
          timestamp: Date.now(),
        });
      }
    });

    // Health check
    this.router.get('/a2a/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        agent: this.card.name,
        agents: this.registry.list().length,
        timestamp: Date.now(),
      });
    });
  }

  /** Update the agent card at runtime */
  updateCard(card: Partial<AgentCard>): void {
    Object.assign(this.card, card);
    this.registry.register(this.card);
  }

  getRegistry(): AgentCardRegistry {
    return this.registry;
  }
}

// ── A2A HTTP Client ─────────────────────────────────────────

export class A2AHttpClient {
  private logger = new Logger('a2a:http:client');

  /** Fetch the agent card from a remote A2A endpoint */
  async fetchCard(url: string): Promise<AgentCard> {
    const endpoint = `${url.replace(/\/$/, '')}/.well-known/agent.json`;
    this.logger.info('Fetching agent card', { endpoint });
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Failed to fetch agent card from ${endpoint}: ${res.status}`);
    return (await res.json()) as AgentCard;
  }

  /** Discover agents on a remote A2A server */
  async discover(url: string, query: string): Promise<AgentCard[]> {
    const endpoint = `${url.replace(/\/$/, '')}/a2a/discover`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Discover failed: ${res.status}`);
    const data = (await res.json()) as { results: AgentCard[] };
    return data.results;
  }

  /** Send an A2A message to a remote agent */
  async send(
    url: string,
    from: string,
    capability: string,
    payload: string,
  ): Promise<{ status: string; response?: string; error?: string }> {
    const endpoint = `${url.replace(/\/$/, '')}/a2a/message`;
    this.logger.info('Sending A2A message', { endpoint, from, capability });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, capability, payload }),
    });
    return (await res.json()) as { status: string; response?: string; error?: string };
  }

  /** Ping a remote A2A server */
  async ping(url: string): Promise<{ status: string; agent: string }> {
    const endpoint = `${url.replace(/\/$/, '')}/a2a/health`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return (await res.json()) as { status: string; agent: string };
  }
}

// ── Network Registry (local + remote) ───────────────────────

export interface RemoteAgent {
  url: string;
  card: AgentCard;
}

export class NetworkRegistry extends EventEmitter {
  private localRegistry: AgentCardRegistry;
  private remotes: Map<string, RemoteAgent> = new Map();
  private client: A2AHttpClient;
  private logger = new Logger('a2a:network');

  constructor(localRegistry?: AgentCardRegistry) {
    super();
    this.localRegistry = localRegistry ?? new AgentCardRegistry();
    this.client = new A2AHttpClient();
  }

  /** Register a local agent */
  registerLocal(card: AgentCard): void {
    this.localRegistry.register(card);
    this.emit('agent:registered', { type: 'local', name: card.name });
  }

  /** Register a remote agent by URL — fetches card automatically */
  async registerRemote(url: string): Promise<AgentCard> {
    const card = await this.client.fetchCard(url);
    this.remotes.set(card.name, { url, card });
    this.logger.info('Remote agent registered', { name: card.name, url });
    this.emit('agent:registered', { type: 'remote', name: card.name, url });
    return card;
  }

  /** Unregister an agent by name */
  unregister(name: string): void {
    this.localRegistry.unregister(name);
    this.remotes.delete(name);
  }

  /** Find agent — check local first, then remote */
  get(name: string): { type: 'local' | 'remote'; card: AgentCard; url?: string } | undefined {
    const local = this.localRegistry.get(name);
    if (local) return { type: 'local', card: local };
    const remote = this.remotes.get(name);
    if (remote) return { type: 'remote', card: remote.card, url: remote.url };
    return undefined;
  }

  /** List all agents (local + remote) */
  listAll(): Array<{ type: 'local' | 'remote'; card: AgentCard; url?: string }> {
    const locals = this.localRegistry.list().map(card => ({
      type: 'local' as const,
      card,
    }));
    const remotes = Array.from(this.remotes.values()).map(r => ({
      type: 'remote' as const,
      card: r.card,
      url: r.url,
    }));
    return [...locals, ...remotes];
  }

  /** Route a call to local handler or remote HTTP endpoint */
  async call(
    from: string,
    to: string,
    capability: string,
    payload: string,
  ): Promise<{ status: string; response?: string; error?: string }> {
    // Try local first
    const local = this.localRegistry.get(to);
    if (local) {
      try {
        const response = await this.localRegistry.send(to, payload);
        return { status: 'success', response };
      } catch (err) {
        return { status: 'error', error: (err as Error).message };
      }
    }

    // Try remote
    const remote = this.remotes.get(to);
    if (remote) {
      return this.client.send(remote.url, from, capability, payload);
    }

    return { status: 'error', error: `Agent "${to}" not found in local or remote registry` };
  }

  getLocalRegistry(): AgentCardRegistry {
    return this.localRegistry;
  }

  getClient(): A2AHttpClient {
    return this.client;
  }
}
