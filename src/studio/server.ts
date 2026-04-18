import { createServer, IncomingMessage, ServerResponse, request as httpRequest } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import * as net from 'net';

interface StudioConfig {
  port: number;
  agentDir: string;
  staticDir: string;
}

interface ModuleInfo {
  name: string;
  path: string;
  port: number;
  icon: string;
}

const MODULE_REGISTRY: ModuleInfo[] = [
  { name: 'DeepBrain', path: 'brain', port: 4001, icon: '🧠' },
  { name: 'AgentKits', path: 'kits', port: 4002, icon: '📊' },
  { name: 'Workstation', path: 'workstation', port: 4003, icon: '👤' },
];

class StudioServer {
  private server: any;
  private config: StudioConfig;

  constructor(config: Partial<StudioConfig> = {}) {
    this.config = {
      port: config.port || 4000,
      agentDir: config.agentDir || process.cwd(),
      staticDir: config.staticDir || join(__dirname, '../studio-ui'),
    };
  }

  getConfig(): StudioConfig {
    return { ...this.config };
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.config.port);
    console.log(`🎨 OPC Studio: http://localhost:${this.config.port}`);
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://localhost`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return this.handleAPI(req, res, url);
    }

    // Module proxy routes
    for (const mod of MODULE_REGISTRY) {
      if (url.pathname.startsWith(`/${mod.path}/`) || url.pathname === `/${mod.path}`) {
        return this.proxyToModule(req, res, mod, url);
      }
    }

    // Static files
    return this.serveStatic(req, res, url);
  }

  private async handleAPI(req: IncomingMessage, res: ServerResponse, url: URL) {
    const route = url.pathname.replace('/api/', '');

    try {
      let data: any;

      switch (route) {
        case 'modules':
          data = await this.getModulesStatus();
          break;
        case 'agent/info':
          data = await this.getAgentInfo();
          break;
        case 'agent/config':
          if (req.method === 'GET') data = await this.getAgentConfig();
          else if (req.method === 'PUT') data = await this.saveConfig(req);
          break;
        case 'agent/chat':
          data = await this.handleChat(req);
          break;
        case 'memory/list':
          data = await this.getMemoryList();
          break;
        case 'memory/search':
          data = await this.searchMemory(url.searchParams.get('q') || '');
          break;
        case 'memory/stats':
          data = await this.getMemoryStats();
          break;
        case 'skills/list':
          data = await this.getSkills();
          break;
        case 'tools/list':
          data = await this.getTools();
          break;
        case 'workflows/list':
          data = await this.getWorkflows();
          break;
        case 'jobs/list':
          data = await this.getJobs();
          break;
        case 'logs/recent':
          data = await this.getRecentLogs();
          break;
        case 'analytics/overview':
          data = await this.getAnalytics();
          break;
        case 'doctor/check':
          data = await this.runDoctor();
          break;
        case 'channels/list':
          data = await this.getChannels();
          break;
        case 'plugins/list':
          data = await this.getPlugins();
          break;
        case 'security/approvals':
          data = await this.getPendingApprovals();
          break;
        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  // --- API Implementations ---

  private async getAgentInfo() {
    const oad = this.loadOAD();
    const pkg = this.loadPackageJson();
    return {
      name: oad?.metadata?.name || pkg?.name || 'unknown',
      version: oad?.metadata?.version || pkg?.version || '0.0.0',
      description: oad?.metadata?.description || pkg?.description || '',
      model: oad?.spec?.model || 'unknown',
      provider: oad?.spec?.provider?.default || 'unknown',
      channels: oad?.spec?.channels?.map((c: any) => c.type) || [],
      skills: oad?.spec?.skills?.map((s: any) => s.name) || [],
      status: 'running',
    };
  }

  private async getAgentConfig() {
    const yamlPath = join(this.config.agentDir, 'agent.yaml');
    if (existsSync(yamlPath)) {
      return { content: readFileSync(yamlPath, 'utf-8') };
    }
    return { content: '', error: 'agent.yaml not found' };
  }

  private async saveConfig(req: IncomingMessage) {
    const body = await this.readBody(req);
    const { content } = JSON.parse(body);
    const yamlPath = join(this.config.agentDir, 'agent.yaml');
    const { writeFileSync } = require('fs');
    writeFileSync(yamlPath, content, 'utf-8');
    return { success: true };
  }

  private async handleChat(req: IncomingMessage) {
    const body = await this.readBody(req);
    const { message, sessionId } = JSON.parse(body);
    try {
      const { BaseAgent, InMemoryStore } = require('../index');
      const oad = this.loadOAD();
      const agent = new BaseAgent({
        name: oad?.metadata?.name || 'studio-agent',
        systemPrompt: oad?.spec?.systemPrompt || 'You are a helpful assistant.',
        provider: oad?.spec?.provider?.default || 'ollama',
        model: oad?.spec?.model || 'qwen2.5',
        memory: new InMemoryStore(),
      });
      await agent.init();
      const response = await agent.handleMessage({
        id: String(Date.now()),
        content: message,
        sender: 'studio-user',
        channel: 'studio',
        sessionId: sessionId || 'studio-session',
        timestamp: new Date(),
      });
      return { response: response.content };
    } catch (e: any) {
      return { response: `Error: ${e.message}` };
    }
  }

  private async getMemoryList() {
    try {
      const { Brain } = require('deepbrain');
      const oad = this.loadOAD();
      const dbPath = oad?.spec?.memory?.longTerm?.database || './data/brain.db';
      const brain = new Brain({ database: dbPath, embedding_provider: 'ollama' });
      await brain.connect();
      const pages = await brain.list({ limit: 50 });
      await brain.disconnect();
      return { pages };
    } catch {
      return { pages: [], error: 'DeepBrain not available' };
    }
  }

  private async searchMemory(query: string) {
    try {
      const { Brain } = require('deepbrain');
      const oad = this.loadOAD();
      const dbPath = oad?.spec?.memory?.longTerm?.database || './data/brain.db';
      const brain = new Brain({ database: dbPath, embedding_provider: 'ollama' });
      await brain.connect();
      const results = await brain.search(query);
      await brain.disconnect();
      return { results };
    } catch {
      return { results: [], error: 'Search failed' };
    }
  }

  private async getMemoryStats() {
    try {
      const { Brain } = require('deepbrain');
      const oad = this.loadOAD();
      const dbPath = oad?.spec?.memory?.longTerm?.database || './data/brain.db';
      const brain = new Brain({ database: dbPath, embedding_provider: 'ollama' });
      await brain.connect();
      const stats = await brain.stats();
      await brain.disconnect();
      return stats;
    } catch {
      return { pages: 0, chunks: 0, error: 'Stats unavailable' };
    }
  }

  private async getSkills() {
    try {
      const { SkillLearner } = require('../index');
      const learner = new SkillLearner('.opc/skills');
      const skills = learner.loadSkills();
      return { skills };
    } catch {
      return { skills: [] };
    }
  }

  private async getTools() {
    try {
      const { getBuiltinTools } = require('../index');
      const tools = getBuiltinTools(this.config.agentDir);
      return { tools: tools.map((t: any) => ({ name: t.definition.name, description: t.definition.description })) };
    } catch {
      return { tools: [] };
    }
  }

  private async getWorkflows() {
    const oad = this.loadOAD();
    return { workflows: oad?.spec?.workflows || [] };
  }

  private async getJobs() {
    const oad = this.loadOAD();
    return { jobs: oad?.spec?.scheduler?.jobs || [] };
  }

  private async getRecentLogs() {
    const logPath = join(this.config.agentDir, '.opc', 'agent.log');
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').slice(-100);
      return { lines };
    }
    return { lines: [] };
  }

  private async getAnalytics() {
    return {
      totalMessages: 0,
      totalSessions: 0,
      avgResponseTime: 0,
      topSkills: [],
      note: 'Analytics tracking starts when agent is running via opc run/start',
    };
  }

  private async runDoctor() {
    try {
      const { runDoctor } = require('../doctor');
      const results = await runDoctor();
      return results;
    } catch {
      return { error: 'Doctor not available' };
    }
  }

  private async getChannels() {
    const oad = this.loadOAD();
    return { channels: oad?.spec?.channels || [] };
  }

  private async getPlugins() {
    const oad = this.loadOAD();
    return { plugins: oad?.spec?.plugins || [] };
  }

  private async getPendingApprovals() {
    return { approvals: [] };
  }

  // --- Module Proxy & Health ---

  private proxyToModule(req: IncomingMessage, res: ServerResponse, mod: ModuleInfo, url: URL) {
    const targetPath = url.pathname.slice(`/${mod.path}`.length) || '/';
    const proxyReq = httpRequest(
      {
        hostname: 'localhost',
        port: mod.port,
        path: targetPath + (url.search || ''),
        method: req.method,
        headers: { ...req.headers, host: `localhost:${mod.port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="font-family:system-ui;padding:40px;color:#999;background:#1a1a2e;text-align:center"><h2>${mod.icon} ${mod.name}</h2><p>Module not running on port ${mod.port}</p></body></html>`);
    });
    req.pipe(proxyReq, { end: true });
  }

  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => { sock.destroy(); resolve(false); });
      sock.once('timeout', () => { sock.destroy(); resolve(false); });
      sock.connect(port, 'localhost');
    });
  }

  async getModulesStatus() {
    const modules = await Promise.all(
      MODULE_REGISTRY.map(async (mod) => ({
        name: mod.name,
        path: `/${mod.path}/`,
        port: mod.port,
        icon: mod.icon,
        running: await this.checkPort(mod.port),
      })),
    );
    return { modules };
  }

  // --- Helpers ---

  private loadOAD(): any {
    try {
      const yamlPath = join(this.config.agentDir, 'agent.yaml');
      if (!existsSync(yamlPath)) return null;
      const content = readFileSync(yamlPath, 'utf-8');
      try {
        const { loadOAD } = require('../index');
        return loadOAD(yamlPath);
      } catch {
        // Fallback: simple yaml parse
        const yaml = require('js-yaml');
        return yaml.load(content);
      }
    } catch {
      return null;
    }
  }

  private loadPackageJson(): any {
    try {
      const pkgPath = join(this.config.agentDir, 'package.json');
      if (!existsSync(pkgPath)) return null;
      return JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = join(this.config.staticDir, filePath);

    if (!existsSync(fullPath)) {
      // SPA fallback
      const indexPath = join(this.config.staticDir, 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    const ext = extname(fullPath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const content = readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: any) => (body += chunk));
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }
}

export { StudioServer, StudioConfig };
