import express, { Request, Response } from 'express';

// ─── Types ───────────────────────────────────────────────────

export interface DashboardConfig {
  /** Enable the dashboard (default: false) */
  enabled: boolean;
  /** HTTP port (default: 4100) */
  port?: number;
  /** Bind address (default: 127.0.0.1 for security) */
  host?: string;
  /** Enable CORS (default: false) */
  cors?: boolean;
}

interface DashboardState {
  agent: { name: string; version: string; status: string; uptime: number };
  sessions: SessionSummary[];
  tools: ToolSummary[];
  channels: ChannelSummary[];
  memory: MemorySummary;
  modelAuth: ModelAuthSummary;
}

interface SessionSummary {
  id: string;
  channel: string;
  messages: number;
  lastActive: number;
  status: 'active' | 'idle' | 'closed';
}

interface ToolSummary {
  name: string;
  type: 'builtin' | 'mcp' | 'gateway';
  enabled: boolean;
  invocations: number;
  lastUsed?: number;
}

interface ChannelSummary {
  name: string;
  type: string;
  connected: boolean;
  messageCount: number;
}

interface MemorySummary {
  provider: string;
  entries: number;
  lastSync?: number;
}

interface ModelAuthSummary {
  providers: { name: string; status: 'healthy' | 'expiring' | 'expired' | 'unconfigured'; expiresAt?: number }[];
}

// ─── Dashboard Server ────────────────────────────────────────

export class Dashboard {
  private app = express();
  private server: ReturnType<typeof this.app.listen> | null = null;
  private config: Required<DashboardConfig>;
  private startTime = Date.now();
  private stats = {
    sessions: new Map<string, SessionSummary>(),
    toolInvocations: new Map<string, { count: number; lastUsed: number }>(),
    channelStats: new Map<string, { connected: boolean; messages: number }>(),
  };

  constructor(config: DashboardConfig) {
    this.config = {
      enabled: config.enabled,
      port: config.port ?? 4100,
      host: config.host ?? '127.0.0.1',
      cors: config.cors ?? false,
    };
    this.setupRoutes();
  }

  private setupRoutes(): void {
    if (this.config.cors) {
      this.app.use((_req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
      });
    }
    this.app.use(express.json());

    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', uptime: Date.now() - this.startTime });
    });

    // Overview state
    this.app.get('/api/state', (_req: Request, res: Response) => {
      res.json(this.getState());
    });

    // Sessions
    this.app.get('/api/sessions', (_req: Request, res: Response) => {
      res.json([...this.stats.sessions.values()]);
    });

    // Tools
    this.app.get('/api/tools', (_req: Request, res: Response) => {
      const tools: ToolSummary[] = [];
      for (const [name, stat] of this.stats.toolInvocations) {
        tools.push({ name, type: 'builtin', enabled: true, invocations: stat.count, lastUsed: stat.lastUsed });
      }
      res.json(tools);
    });

    // Channels
    this.app.get('/api/channels', (_req: Request, res: Response) => {
      const channels: ChannelSummary[] = [];
      for (const [name, stat] of this.stats.channelStats) {
        channels.push({ name, type: name, connected: stat.connected, messageCount: stat.messages });
      }
      res.json(channels);
    });

    // Simple HTML dashboard
    this.app.get('/', (_req: Request, res: Response) => {
      res.send(this.renderHTML());
    });
  }

  private getState(): DashboardState {
    return {
      agent: { name: 'opc-agent', version: '1.3.0', status: 'running', uptime: Date.now() - this.startTime },
      sessions: [...this.stats.sessions.values()],
      tools: [...this.stats.toolInvocations.entries()].map(([name, s]) => ({
        name, type: 'builtin' as const, enabled: true, invocations: s.count, lastUsed: s.lastUsed,
      })),
      channels: [...this.stats.channelStats.entries()].map(([name, s]) => ({
        name, type: name, connected: s.connected, messageCount: s.messages,
      })),
      memory: { provider: 'unknown', entries: 0 },
      modelAuth: { providers: [] },
    };
  }

  // ─── Event Tracking ──────────────────────────────────────

  trackSession(session: SessionSummary): void {
    this.stats.sessions.set(session.id, session);
  }

  trackToolCall(toolName: string): void {
    const existing = this.stats.toolInvocations.get(toolName) ?? { count: 0, lastUsed: 0 };
    existing.count++;
    existing.lastUsed = Date.now();
    this.stats.toolInvocations.set(toolName, existing);
  }

  trackChannel(name: string, connected: boolean, messages?: number): void {
    const existing = this.stats.channelStats.get(name) ?? { connected: false, messages: 0 };
    existing.connected = connected;
    if (messages !== undefined) existing.messages = messages;
    this.stats.channelStats.set(name, existing);
  }

  // ─── Lifecycle ───────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.config.enabled) return;
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`[dashboard] http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  private renderHTML(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>OPC Agent Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;padding:24px}
h1{font-size:1.5rem;margin-bottom:20px;color:#7c9aff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:#14141f;border:1px solid #2a2a3a;border-radius:12px;padding:20px}
.card h2{font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:12px}
.stat{font-size:2rem;font-weight:700;color:#7c9aff}
.sub{font-size:0.8rem;color:#666;margin-top:4px}
#data{margin-top:20px;font-family:monospace;font-size:0.75rem;color:#555;white-space:pre-wrap}
</style></head><body>
<h1>⚡ OPC Agent Dashboard</h1>
<div class="grid">
  <div class="card"><h2>Status</h2><div class="stat" id="status">Loading…</div><div class="sub" id="uptime"></div></div>
  <div class="card"><h2>Sessions</h2><div class="stat" id="sessions">-</div></div>
  <div class="card"><h2>Tools</h2><div class="stat" id="tools">-</div></div>
  <div class="card"><h2>Channels</h2><div class="stat" id="channels">-</div></div>
</div>
<div id="data"></div>
<script>
async function poll(){try{const r=await fetch('/api/state');const d=await r.json();
document.getElementById('status').textContent=d.agent.status;
document.getElementById('uptime').textContent='Uptime: '+Math.floor(d.agent.uptime/1000)+'s';
document.getElementById('sessions').textContent=d.sessions.length;
document.getElementById('tools').textContent=d.tools.length;
document.getElementById('channels').textContent=d.channels.length;
document.getElementById('data').textContent=JSON.stringify(d,null,2);
}catch(e){document.getElementById('status').textContent='offline'}}
poll();setInterval(poll,5000);
</script></body></html>`;
  }
}
