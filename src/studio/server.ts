/* eslint-disable @typescript-eslint/no-var-requires */
const { dynamicImport } = require('../utils/dynamic-import');
import { createServer, IncomingMessage, ServerResponse, request as httpRequest } from 'http';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import * as os from 'os';
import * as net from 'net';
import { Tracer } from '../telemetry';
import { TEMPLATES, INDUSTRIES, AgentTemplate } from './templates-data';
import { SkillMarketplace } from '../skills/marketplace';
import { CronEngine } from '../scheduler/cron-engine';
import { ImageGenerator } from '../tools/image-generator';
import { DocumentProcessor, ProcessedDocument } from '../tools/document-processor';

export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'condition' | 'loop' | 'parallel' | 'input' | 'output';
  name: string;
  x: number;
  y: number;
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created: string;
  updated: string;
}

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

// Settings config helpers
function getSettingsConfigPath(): string {
  const dir = join(os.homedir(), '.opc');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'config.json');
}

function loadSettingsConfig(): any {
  const p = getSettingsConfigPath();
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return {}; }
  }
  return {};
}

function saveSettingsConfig(config: any): void {
  writeFileSync(getSettingsConfigPath(), JSON.stringify(config, null, 2));
}

class StudioServer {
  private server: any;
  private config: StudioConfig;
  private tracer?: Tracer;
  private skillMarketplace: SkillMarketplace;
  private cronEngine: CronEngine;
  private imageGenerator: ImageGenerator;

  constructor(config: Partial<StudioConfig> = {}) {
    this.config = {
      port: config.port || 4000,
      agentDir: config.agentDir || process.cwd(),
      staticDir: config.staticDir || join(__dirname, '../studio-ui'),
    };
    this.cronEngine = new CronEngine();
    this.imageGenerator = new ImageGenerator();
    this.skillMarketplace = new SkillMarketplace();
  }

  setTracer(tracer: Tracer): void {
    this.tracer = tracer;
  }

  getTracer(): Tracer | undefined {
    return this.tracer;
  }

  getConfig(): StudioConfig {
    return { ...this.config };
  }

  async start(): Promise<void> {
    const opcDir = join(os.homedir(), '.opc');
    if (!existsSync(opcDir)) mkdirSync(opcDir, { recursive: true });
    const cfgPath = join(opcDir, 'config.json');
    if (!existsSync(cfgPath)) writeFileSync(cfgPath, JSON.stringify({}, null, 2));

    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.config.port, '0.0.0.0');
    this.cronEngine.start();
    console.log(`🎨 OPC Studio: http://localhost:${this.config.port}`);
  }

  async stop(): Promise<void> {
    this.cronEngine.stop();
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

      // Dynamic agent routes
      if (route === 'agents' && req.method === 'POST') {
        data = await this.createAgent(req);
        res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'agents' && req.method === 'GET') {
        data = this.listAgents();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'templates' && req.method === 'GET') {
        const industry = url.searchParams.get('industry') || '';
        const search = url.searchParams.get('q') || '';
        data = this.getTemplates(industry, search);
        // Merge with real workstation templates
        try {
          const ws = require('agent-workstation');
          const categories = ws.getCategories();
          const wsTemplates: any[] = [];
          for (const cat of categories) {
            for (const roleName of cat.roles) {
              const role = ws.getRole(cat.name, roleName);
              if (!role) continue;
              let oad: any = {};
              try {
                if (role.files?.['oad.yaml']) {
                  const yaml = require('js-yaml');
                  oad = yaml.load(role.files['oad.yaml']) || {};
                }
              } catch {}
              const tpl = {
                id: `ws-${cat.name}-${roleName}`,
                name: oad.name || roleName.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                nameZh: oad.nameZh || '',
                icon: oad.icon || '🤖',
                description: oad.description || '',
                descriptionZh: oad.descriptionZh || '',
                industry: cat.name,
                industryZh: cat.name,
                tags: [cat.name, 'workstation'],
                suggestedModel: 'auto',
                systemPrompt: oad.systemPrompt || role.files?.['brain-seed.md'] || '',
                source: 'workstation',
                ego: oad.ego || null,
                mission: oad.mission || null,
                skills: oad.skills || [],
              };
              if (!search || tpl.name.toLowerCase().includes(search.toLowerCase()) || tpl.nameZh.includes(search)) {
                if (!industry || tpl.industry === industry) {
                  wsTemplates.push(tpl);
                }
              }
            }
          }
          data.templates = [...data.templates, ...wsTemplates];
          // Add workstation industries to list
          const existingIds = new Set(data.industries.map((i: any) => i.id));
          for (const cat of categories) {
            if (!existingIds.has(cat.name)) {
              data.industries.push({ id: cat.name, name: cat.name, nameZh: cat.name });
            }
          }
        } catch (wsErr: any) {
          // workstation not available, use built-in templates only
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^templates\/[^/]+$/) && req.method === 'GET') {
        const tplId = route.split('/')[1];
        // Check workstation first
        if (tplId.startsWith('ws-')) {
          const parts = tplId.replace('ws-', '').split('-');
          const catName = parts[0];
          const roleName = parts.slice(1).join('-');
          try {
            const ws = require('agent-workstation');
            const role = ws.getRole(catName, roleName);
            if (role) {
              let oad: any = {};
              try {
                if (role.files?.['oad.yaml']) {
                  const yaml = require('js-yaml');
                  oad = yaml.load(role.files['oad.yaml']) || {};
                }
              } catch {}
              data = {
                id: tplId, name: oad.name || roleName, source: 'workstation',
                category: catName, role: roleName, files: role.files,
                ego: oad.ego, mission: oad.mission, skills: oad.skills,
                systemPrompt: oad.systemPrompt || role.files?.['brain-seed.md'] || '',
              };
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify(data));
              return;
            }
          } catch {}
        }
        data = this.getTemplateById(tplId);
        res.writeHead(data.error ? 404 : 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^agents\/[^/]+\/memory$/) && req.method === 'GET') {
        const agentId = route.split('/')[1];
        data = this.getAgentMemory(agentId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^agents\/[^/]+\/chat$/) && req.method === 'POST') {
        const agentId = route.split('/')[1];
        return this.handleAgentChat(req, res, agentId);
      }
      if (route === 'agents/generate-prompt' && req.method === 'POST') {
        return this.handleGeneratePrompt(req, res);
      }
      if (route.match(/^agents\/[^/]+$/) && req.method === 'GET') {
        const agentId = route.split('/')[1];
        data = this.getAgentById(agentId);
        res.writeHead(data.error ? 404 : 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^agents\/[^/]+$/) && req.method === 'PUT') {
        const agentId = route.split('/')[1];
        data = await this.updateAgent(agentId, req);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^agents\/[^/]+$/) && req.method === 'DELETE') {
        const agentId = route.split('/')[1];
        data = this.deleteAgent(agentId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // --- Memory/DeepBrain upload route ---
      if (route === 'memory/upload' && req.method === 'POST') {
        return this.handleDocumentUpload(req, res, 'deepbrain-global');
      }

      // --- Document upload routes ---
      if (route.match(/^agents\/[^/]+\/upload$/) && req.method === 'POST') {
        const agentId = route.split('/')[1];
        return this.handleDocumentUpload(req, res, agentId);
      }
      if (route.match(/^agents\/[^/]+\/documents$/) && req.method === 'GET') {
        const agentId = route.split('/')[1];
        data = this.getDocumentList(agentId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^agents\/[^/]+\/documents\/[^/]+$/) && req.method === 'DELETE') {
        const parts = route.split('/');
        const agentId = parts[1];
        const docId = parts[3];
        data = this.deleteDocument(agentId, docId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // --- Settings API routes ---
      if (route === 'settings/models' && req.method === 'GET') {
        const cfg = loadSettingsConfig();
        data = cfg.models || { mode: 'local', provider: 'ollama', chatModel: 'qwen2.5:7b', embeddingModel: 'nomic-embed-text', providers: {} };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/models' && req.method === 'PUT') {
        const body = JSON.parse(await this.readBody(req));
        const cfg = loadSettingsConfig();
        cfg.models = { ...(cfg.models || {}), ...body };
        saveSettingsConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, models: cfg.models }));
        return;
      }
      if (route === 'settings/models/test' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        const { provider, apiKey, baseUrl } = body;
        data = await this.testModelConnection(provider, apiKey, baseUrl);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/models/local' && req.method === 'GET') {
        data = await this.detectLocalOllama();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/channels' && req.method === 'GET') {
        const cfg = loadSettingsConfig();
        data = cfg.channels || {};
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^settings\/channels\/[^/]+$/) && req.method === 'PUT') {
        const channelName = route.split('/')[2];
        const body = JSON.parse(await this.readBody(req));
        const cfg = loadSettingsConfig();
        if (!cfg.channels) cfg.channels = {};
        cfg.channels[channelName] = { ...(cfg.channels[channelName] || {}), ...body, updated: new Date().toISOString() };
        saveSettingsConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, channel: cfg.channels[channelName] }));
        return;
      }
      // Web Search settings
      if (route === 'settings/search' && req.method === 'GET') {
        const cfg = loadSettingsConfig();
        data = cfg.webSearch || { defaultEngine: 'duckduckgo', enabled: true, engines: { duckduckgo: { enabled: true } } };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/search' && req.method === 'PUT') {
        const body = JSON.parse(await this.readBody(req));
        const cfg = loadSettingsConfig();
        cfg.webSearch = { ...(cfg.webSearch || {}), ...body, updated: new Date().toISOString() };
        saveSettingsConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, config: cfg.webSearch }));
        return;
      }
      if (route === 'settings/search/test' && req.method === 'POST') {
        try {
          const { webSearch: doSearch } = require('../tools/web-search');
          const body = JSON.parse(await this.readBody(req));
          const query = body.query || 'test search';
          const cfg = loadSettingsConfig();
          const searchCfg = { ...(cfg.webSearch || { defaultEngine: 'duckduckgo', enabled: true, engines: { duckduckgo: { enabled: true } } }), ...body.config };
          const results = await doSearch(query, searchCfg, { maxResults: 3 });
          data = { success: true, results, engine: searchCfg.defaultEngine };
        } catch (e: any) {
          data = { success: false, error: e.message };
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/status' && req.method === 'GET') {
        data = await this.getSettingsStatus();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/status/start' && req.method === 'POST') {
        data = { success: true, status: 'running', message: 'Agent started' };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/status/stop' && req.method === 'POST') {
        data = { success: true, status: 'stopped', message: 'Agent stopped' };
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'settings/usage' && req.method === 'GET') {
        data = await this.getUsageStats();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // Dynamic workflow routes (parameterized)
      if (route.match(/^workflows\/[^/]+\/run$/) && req.method === 'POST') {
        const wfId = route.split('/')[1];
        data = await this.runWorkflow(wfId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^workflows\/[^/]+$/) && req.method === 'GET') {
        const wfId = route.split('/')[1];
        data = this.getWorkflowById(wfId);
        res.writeHead(data.error ? 404 : 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^workflows\/[^/]+$/) && req.method === 'DELETE') {
        const wfId = route.split('/')[1];
        data = this.deleteWorkflow(wfId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // --- Schedules API ---
      if (route === 'schedules' && req.method === 'GET') {
        data = this.cronEngine.listTasks();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'schedules' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        data = this.cronEngine.createTask(body);
        res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^schedules\/[^/]+$/) && req.method === 'PUT') {
        const id = route.split('/')[1];
        const body = JSON.parse(await this.readBody(req));
        data = this.cronEngine.updateTask(id, body);
        res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data || { error: 'Schedule not found' }));
        return;
      }
      if (route.match(/^schedules\/[^/]+$/) && req.method === 'DELETE') {
        const id = route.split('/')[1];
        const success = this.cronEngine.deleteTask(id);
        res.writeHead(success ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success }));
        return;
      }
      if (route.match(/^schedules\/[^/]+\/run$/) && req.method === 'POST') {
        const id = route.split('/')[1];
        const success = await this.cronEngine.runTask(id);
        res.writeHead(success ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // --- Image Generation API ---
      if (route === 'image-gen/status' && req.method === 'GET') {
        data = this.imageGenerator.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'image-gen/generate' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        data = await this.imageGenerator.generate(body.prompt, body);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'image-gen/config' && req.method === 'PUT') {
        const body = JSON.parse(await this.readBody(req));
        const cfg = loadSettingsConfig();
        cfg.imageGen = { ...(cfg.imageGen || {}), ...body };
        saveSettingsConfig(cfg);
        this.imageGenerator = new ImageGenerator({
          openaiApiKey: body.openaiApiKey,
          replicateApiKey: body.replicateApiKey,
          sdApiUrl: body.sdApiUrl,
        });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (route === 'first-run/status' && req.method === 'GET') {
        data = await this.getFirstRunStatus();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'first-run/complete' && req.method === 'POST') {
        const body = JSON.parse(await this.readBody(req));
        data = await this.completeFirstRun(body);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // === Skill Marketplace API ===
      if (route === 'skills/marketplace' && req.method === 'GET') {
        const category = url.searchParams.get('category') || undefined;
        const search = url.searchParams.get('q') || undefined;
        data = this.skillMarketplace.listAll(category, search);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'skills/installed' && req.method === 'GET') {
        data = this.skillMarketplace.getInstalled();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^skills\/marketplace\/[^/]+$/) && req.method === 'GET') {
        const skillId = route.split('/')[2];
        data = this.skillMarketplace.getSkill(skillId);
        res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data || { error: 'Skill not found' }));
        return;
      }
      if (route.match(/^skills\/marketplace\/[^/]+\/install$/) && req.method === 'POST') {
        const skillId = route.split('/')[2];
        data = this.skillMarketplace.install(skillId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^skills\/marketplace\/[^/]+\/uninstall$/) && req.method === 'DELETE') {
        const skillId = route.split('/')[2];
        data = this.skillMarketplace.uninstall(skillId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // === Global config API (reads/writes ~/.opc/config.json) ===
      if (route === 'config' && req.method === 'GET') {
        data = loadSettingsConfig();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route === 'config' && req.method === 'PUT') {
        const body = JSON.parse(await this.readBody(req));
        const cfg = loadSettingsConfig();
        Object.assign(cfg, body);
        saveSettingsConfig(cfg);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, config: cfg }));
        return;
      }

      // === Models API (real agentkits integration) ===
      if (route === 'models' && req.method === 'GET') {
        try {
          const ak = await import('agentkits');
          const providers = ak.listLLMProviders();
          data = { providers };
        } catch (e: any) {
          data = { providers: [], error: 'agentkits not available: ' + e.message };
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }

      // === Memory stats API (real deepbrain integration) ===
      if (route === 'memory/stats' && req.method === 'GET') {
        try {
          const { Brain } = await dynamicImport('deepbrain');
          const oad = this.loadOAD();
          const dbPath = oad?.spec?.memory?.longTerm?.database || './data/brain.db';
          const brain = new Brain({ database: dbPath, embedding_provider: 'ollama' });
          await brain.connect();
          const stats = await brain.stats();
          await brain.disconnect();
          data = { connected: true, ...stats };
        } catch (dbErr: any) {
          console.error('[DeepBrain stats error]', dbErr?.message || dbErr);
          data = { connected: false, pages: 0, chunks: 0, error: 'DeepBrain not installed or not configured. Install with: npm i deepbrain' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
        return;
      }
      if (route.match(/^memory\/[^/]+$/) && req.method === 'GET') {
        const agentId = route.split('/')[1];
        if (agentId !== 'stats' && agentId !== 'list' && agentId !== 'search') {
          data = this.getAgentMemory(agentId);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(data));
          return;
        }
      }

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
          data = this.listWorkflows();
          break;
        case 'workflows':
          if (req.method === 'POST') data = await this.saveWorkflow(req);
          else if (req.method === 'GET') data = this.listWorkflows();
          else { res.writeHead(405); res.end(); return; }
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
        case 'eval/suites':
          data = await this.getEvalSuites();
          break;
        case 'eval/run':
          if (req.method === 'POST') data = await this.runEvalSuite(req);
          else { res.writeHead(405); res.end(); return; }
          break;
        case 'a2a/card':
          data = this.getA2ACard();
          break;
        case 'a2a/tasks':
          data = this.getA2ATasks();
          break;
        case 'a2a/discover':
          if (req.method === 'POST') data = await this.discoverA2AAgent(req);
          else { res.writeHead(405); res.end(); return; }
          break;
        case 'protocols':
          data = await this.getProtocols();
          break;
        case 'protocols/mcp':
          data = this.getMCPServerStatus();
          break;
        case 'eval/reports':
          data = await this.getEvalReports();
          break;
        case 'telemetry/stats':
          data = this.tracer ? this.tracer.getStats() : { error: 'Telemetry not enabled' };
          break;
        case 'telemetry/traces':
          data = this.getTelemetryTraces(url);
          break;
        case 'telemetry/metrics':
          data = this.tracer ? this.tracer.getMetrics() : [];
          break;
        case 'playground/chat':
          if (req.method === 'POST') {
            return this.handlePlaygroundChat(req, res);
          }
          res.writeHead(405); res.end(); return;
        case 'playground/models':
          data = { models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-haiku', 'gemini-2.0-flash', 'deepseek-v3'] };
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

  // --- Agent CRUD & Templates ---

  private getAgentsDir(): string {
    const dir = join(os.homedir(), '.opc', 'agents');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private async createAgent(req: IncomingMessage): Promise<any> {
    const body = await this.readBody(req);
    const parsed = JSON.parse(body);
    const { name, templateId, description, model, language, systemPrompt, icon } = parsed;
    const template = TEMPLATES.find(t => t.id === templateId);
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = {
      id,
      name: name || template?.name || 'My Agent',
      templateId: templateId || null,
      templateName: template?.name || 'Custom',
      templateIcon: icon || template?.icon || '🤖',
      description: description || template?.description || '',
      model: model || template?.suggestedModel || 'auto',
      language: language || 'zh',
      systemPrompt: systemPrompt || template?.systemPrompt || 'You are a helpful assistant.',
      industry: template?.industry || 'general',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      messageCount: 0,
      lastActive: new Date().toISOString(),
    };
    const filePath = join(this.getAgentsDir(), `${id}.json`);
    writeFileSync(filePath, JSON.stringify(agent, null, 2));
    return agent;
  }

  private listAgents(): { agents: any[] } {
    // 1. Load Studio-created agents from ~/.opc/agents/*.json
    const dir = this.getAgentsDir();
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    const agents = files.map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);

    // 2. Also detect current working directory agent (oad.yaml / agent.yaml)
    const seenIds = new Set(agents.map((a: any) => a.id));
    for (const yamlName of ['oad.yaml', 'agent.yaml', 'agent.yml']) {
    const oadPath = join(this.config.agentDir, yamlName);
    if (existsSync(oadPath)) {
      try {
        const oadRaw = readFileSync(oadPath, 'utf-8');
        const yamlMod = require('js-yaml');
        const oad = yamlMod.load(oadRaw) as any;
        const name = oad?.name || oad?.metadata?.name || 'My Agent';
        const id = oad?.id || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!seenIds.has(id)) {
          seenIds.add(id);
          agents.push({
            id,
            name,
            description: oad?.description || oad?.spec?.description || '',
            icon: oad?.icon || '🤖',
            emoji: oad?.icon || '🤖',
            status: 'running',
            source: yamlName,
            model: oad?.spec?.model || oad?.spec?.provider?.model || 'auto',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          });
        }
      } catch { /* ignore parse errors */ }
    }
    }

    agents.sort((a: any, b: any) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    return { agents };
  }

  private getAgentById(id: string): any {
    const filePath = join(this.getAgentsDir(), `${id}.json`);
    if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf-8'));

    // Check OAD-based agent from working directory
    for (const fname of ['oad.yaml', 'agent.yaml', 'agent.yml']) {
      const oadPath = join(this.config.agentDir, fname);
      if (existsSync(oadPath)) {
        try {
          const yamlMod = require('js-yaml');
          const oadRaw = readFileSync(oadPath, 'utf-8');
          const oad = yamlMod.load(oadRaw) as any;
          const name = oad?.name || oad?.metadata?.name || 'My Agent';
          const oadId = oad?.id || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          if (oadId === id) {
            return {
              id: oadId,
              name,
              description: oad?.description || oad?.spec?.description || '',
              icon: oad?.icon || '🤖',
              emoji: oad?.icon || '🤖',
              status: 'running',
              source: 'oad.yaml',
              model: oad?.spec?.model || oad?.spec?.provider?.model || 'auto',
              provider: oad?.spec?.provider?.default || undefined,
              systemPrompt: oad?.spec?.systemPrompt || oad?.systemPrompt || 'You are a helpful assistant.',
              channels: oad?.spec?.channels?.map((c: any) => c.type || c) || [],
              skills: oad?.spec?.skills || [],
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              messageCount: 0,
            };
          }
        } catch { /* ignore parse errors */ }
      }
    }

    return { error: 'Agent not found' };
  }

  private async updateAgent(id: string, req: IncomingMessage): Promise<any> {
    const filePath = join(this.getAgentsDir(), `${id}.json`);
    let existing: any;
    if (existsSync(filePath)) {
      existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    } else {
      // Try loading from OAD
      existing = this.getAgentById(id);
      if (existing.error) return existing;
    }
    const body = await this.readBody(req);
    const updates = JSON.parse(body);
    const updated = { ...existing, ...updates, id, updated: new Date().toISOString() };
    writeFileSync(filePath, JSON.stringify(updated, null, 2));
    return updated;
  }

  private deleteAgent(id: string): { success: boolean } {
    const filePath = join(this.getAgentsDir(), `${id}.json`);
    if (existsSync(filePath)) unlinkSync(filePath);
    return { success: true };
  }

  private getTemplates(industry: string, search: string): { templates: AgentTemplate[]; industries: typeof INDUSTRIES } {
    let filtered = TEMPLATES;
    if (industry) filtered = filtered.filter(t => t.industry === industry);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) || t.nameZh.includes(q) ||
        t.description.toLowerCase().includes(q) || t.descriptionZh.includes(q) ||
        t.tags.some(tag => tag.includes(q))
      );
    }
    return { templates: filtered, industries: INDUSTRIES };
  }

  private getTemplateById(id: string): AgentTemplate | { error: string } {
    const tpl = TEMPLATES.find(t => t.id === id);
    return tpl || { error: 'Template not found' };
  }

  private getAgentMemory(agentId: string): any {
    const memDir = join(this.getAgentsDir(), agentId + '-memory');
    if (!existsSync(memDir)) return { entries: [], timeline: [] };
    const files = readdirSync(memDir).filter(f => f.endsWith('.json'));
    const entries = files.map(f => {
      try { return JSON.parse(readFileSync(join(memDir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { entries, timeline: entries.map((e: any) => ({ date: e.timestamp, summary: e.summary || e.content?.slice(0, 100) })) };
  }

  private async handleGeneratePrompt(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: any;
    try {
      body = JSON.parse(await this.readBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const userPrompt = body.prompt || '';
    if (!userPrompt) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing prompt' }));
      return;
    }

    try {
      // Try to use the configured LLM to generate the prompt
      const config = this.getConfig();
      const provider = (config as any).provider || 'ollama';
      const model = (config as any).model || 'qwen2.5:7b';
      const baseUrl = (config as any).baseUrl || process.env.OPC_LLM_BASE_URL || 'http://localhost:11434/v1';
      const apiKey = (config as any).apiKey || process.env.OPC_LLM_API_KEY || 'ollama';

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const text = data.choices?.[0]?.message?.content || '';
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ prompt: text }));
        return;
      }
    } catch { /* LLM call failed, use fallback */ }

    // Fallback: return a template-based prompt
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ prompt: `You are a helpful AI assistant. ${userPrompt}` }));
  }

  private async handleAgentChat(req: IncomingMessage, res: ServerResponse, agentId: string): Promise<void> {
    let body: any;
    try {
      body = JSON.parse(await this.readBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    // Accept both { messages: [...] } and { message: "...", history: [...] }
    let messages: any[] = body.messages || [];
    if (body.message) {
      // Frontend sends { message, history }
      messages = [...(body.history || []), { role: 'user', content: body.message }];
    }

    let agent: any;
    if (agentId === 'opc-assistant') {
      // Virtual built-in assistant
      agent = {
        id: 'opc-assistant',
        name: 'OPC 助手',
        systemPrompt: '你是 OPC 助手，一个友好的 AI 助手。你可以帮用户答疑解惑、创建 AI Agent、配置渠道（Telegram / 微信 / 飞书）、处理关于 OPC 的任何问题。请用中文回答。',
        model: 'auto',
        messageCount: 0,
      };
    } else {
      agent = this.getAgentById(agentId);
      if (agent.error) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(agent));
        return;
      }
    }

    // Update message count (skip for virtual agents)
    if (agentId !== 'opc-assistant') {
      agent.messageCount = (agent.messageCount || 0) + 1;
      agent.lastActive = new Date().toISOString();
      agent.updated = new Date().toISOString();
      const agentFilePath = join(this.getAgentsDir(), `${agentId}.json`);
      writeFileSync(agentFilePath, JSON.stringify(agent, null, 2));
    }

    // SSE streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Use createProvider directly to call LLM
    try {
      const { createProvider } = require('../providers');
      // Determine provider: agent config > OAD yaml > env > auto
      let providerName = agent.provider || process.env.OPC_LLM_PROVIDER;
      if (!providerName) {
        try {
          for (const fname of ['oad.yaml', 'agent.yaml']) {
            const oadPath = join(this.config.agentDir, fname);
            if (existsSync(oadPath)) {
              const yaml = require('js-yaml');
              const oad = yaml.load(readFileSync(oadPath, 'utf-8'));
              providerName = oad?.spec?.provider?.default;
              if (providerName) break;
            }
          }
        } catch {}
      }
      providerName = providerName || 'auto';
      const provider = createProvider(providerName, agent.model);

      let fullText = '';
      try {
        for await (const chunk of provider.chatStream(messages, agent.systemPrompt)) {
          const sseData = JSON.stringify({
            choices: [{ delta: { content: chunk }, index: 0 }],
          });
          res.write(`data: ${sseData}\n\n`);
          fullText += chunk;
        }
      } catch (streamErr: any) {
        if (!fullText) {
          const errData = JSON.stringify({
            choices: [{ delta: { content: `⚠️ LLM Error: ${streamErr.message}` }, index: 0 }],
          });
          res.write(`data: ${errData}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      // Provider creation failed — send error as SSE so frontend can display it
      const errData = JSON.stringify({
        choices: [{ delta: { content: `⚠️ Provider error: ${err.message}\n\nTip: Install Claude CLI (npm i -g @anthropic-ai/claude-code) or set OPENAI_API_KEY.` }, index: 0 }],
      });
      res.write(`data: ${errData}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  private sendSimulatedResponse(res: ServerResponse, lastMsg: string, agent: any): void {
    const response = `Hello! I'm ${agent.name}. You said: "${lastMsg}"\n\nI'm ready to help you. (Note: Connect a model provider for real AI responses)`;
    const words = response.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      if (i >= words.length) {
        res.write('data: [DONE]\n\n');
        res.end();
        clearInterval(interval);
        return;
      }
      const chunk = (i === 0 ? '' : ' ') + words[i];
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      i++;
    }, 50);
  }

  // --- Settings Implementations ---

  private async detectLocalOllama(): Promise<any> {
    return new Promise((resolve) => {
      const req = httpRequest({ hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET', timeout: 3000 }, (res) => {
        let body = '';
        res.on('data', (c: any) => body += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const models = (data.models || []).map((m: any) => ({
              name: m.name, size: m.size, modified: m.modified_at,
              details: m.details || {},
            }));
            resolve({ running: true, available: true, models });
          } catch { resolve({ running: true, available: true, models: [] }); }
        });
      });
      req.on('error', () => resolve({ running: false, available: false, models: [] }));
      req.on('timeout', () => { req.destroy(); resolve({ running: false, available: false, models: [] }); });
      req.end();
    });
  }

  private async testModelConnection(provider: string, apiKey: string, baseUrl?: string): Promise<any> {
    const endpoints: Record<string, { url: string; path: string }> = {
      openai: { url: 'api.openai.com', path: '/v1/models' },
      deepseek: { url: 'api.deepseek.com', path: '/v1/models' },
      anthropic: { url: 'api.anthropic.com', path: '/v1/models' },
      openrouter: { url: 'openrouter.ai', path: '/api/v1/models' },
    };
    const ep = endpoints[provider];
    if (!ep && !baseUrl) return { success: false, error: 'Unknown provider' };

    const hostname = baseUrl ? new URL(baseUrl).hostname : ep.url;
    const path = baseUrl ? '/v1/models' : ep.path;
    const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}` };
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }

    return new Promise((resolve) => {
      const https = require('https');
      const req = https.request({ hostname, path, method: 'GET', headers, timeout: 10000 }, (res: any) => {
        resolve({ success: res.statusCode === 200, statusCode: res.statusCode });
      });
      req.on('error', (e: any) => resolve({ success: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
      req.end();
    });
  }

  private async getSettingsStatus(): Promise<any> {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const modules = await this.getModulesStatus();
    const logPath = join(this.config.agentDir, '.opc', 'agent.log');
    let recentLogs: string[] = [];
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      recentLogs = content.split('\n').slice(-50);
    }
    return {
      status: 'running',
      uptime,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      cpu: os.loadavg(),
      modules: modules.modules,
      logs: recentLogs,
      startedAt: new Date(Date.now() - uptime * 1000).toISOString(),
    };
  }

  private async getUsageStats(): Promise<any> {
    const cfg = loadSettingsConfig();
    const usage = cfg.usage || { totalTokens: 0, totalCost: 0, daily: [], byModel: {} };
    return usage;
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
    for (const fname of ['agent.yaml', 'agent.yml', 'oad.yaml']) {
      const yamlPath = join(this.config.agentDir, fname);
      if (existsSync(yamlPath)) {
        return { content: readFileSync(yamlPath, 'utf-8'), filename: fname };
      }
    }
    return { content: '', error: 'No agent config file found (agent.yaml / oad.yaml)' };
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
      const { Brain } = await dynamicImport('deepbrain');
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
      const { Brain } = await dynamicImport('deepbrain');
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
      const { Brain } = await dynamicImport('deepbrain');
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

  private getWorkflowsDir(): string {
    const dir = join(this.config.agentDir, '.opc', 'workflows');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private listWorkflows(): { workflows: WorkflowDefinition[] } {
    const dir = this.getWorkflowsDir();
    const files = require('fs').readdirSync(dir).filter((f: string) => f.endsWith('.json'));
    const workflows = files.map((f: string) => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
    // Also include OAD-defined workflows
    const oad = this.loadOAD();
    const oadWorkflows = (oad?.spec?.workflows || []).map((w: any, i: number) => ({
      id: `oad-${i}`,
      name: w.name || `Workflow ${i + 1}`,
      nodes: [],
      edges: [],
      steps: w.steps,
      source: 'oad',
    }));
    return { workflows: [...workflows, ...oadWorkflows] };
  }

  private getWorkflowById(id: string): WorkflowDefinition | { error: string } {
    const filePath = join(this.getWorkflowsDir(), `${id}.json`);
    if (!existsSync(filePath)) return { error: 'Workflow not found' };
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  private async saveWorkflow(req: IncomingMessage): Promise<{ success: boolean; id: string }> {
    const body = await this.readBody(req);
    const workflow = JSON.parse(body) as WorkflowDefinition;
    if (!workflow.id) workflow.id = `wf-${Date.now()}`;
    workflow.updated = new Date().toISOString();
    if (!workflow.created) workflow.created = workflow.updated;
    const filePath = join(this.getWorkflowsDir(), `${workflow.id}.json`);
    writeFileSync(filePath, JSON.stringify(workflow, null, 2));
    return { success: true, id: workflow.id };
  }

  private deleteWorkflow(id: string): { success: boolean } {
    const filePath = join(this.getWorkflowsDir(), `${id}.json`);
    if (existsSync(filePath)) require('fs').unlinkSync(filePath);
    return { success: true };
  }

  private async runWorkflow(id: string): Promise<any> {
    const wf = this.getWorkflowById(id);
    if ('error' in wf) return wf;
    // Basic topological execution simulation
    const results: Record<string, any> = {};
    const sorted = this.topoSort(wf.nodes, wf.edges);
    for (const node of sorted) {
      results[node.id] = { type: node.type, name: node.name, status: 'completed', output: `[simulated output for ${node.name}]` };
    }
    return { workflowId: id, status: 'completed', results };
  }

  private topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) { inDegree.set(n.id, 0); adj.set(n.id, []); }
    for (const e of edges) { adj.get(e.from)?.push(e.to); inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1); }
    const queue = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
    const result: WorkflowNode[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const next of (adj.get(node.id) || [])) {
        const d = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, d);
        if (d === 0) queue.push(nodeMap.get(next)!);
      }
    }
    return result;
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

  private async getProtocols() {
    const oad = this.loadOAD();
    const protocols = (oad?.spec as any)?.protocols || {};
    return {
      protocols: [
        { name: 'a2a', description: 'Agent-to-Agent', enabled: !!protocols.a2a?.enabled, config: protocols.a2a || {} },
        { name: 'agui', description: 'AG-UI — Agent-User Interaction (SSE)', enabled: !!protocols.agui?.enabled, config: protocols.agui || {} },
        { name: 'mcp', description: 'MCP Server — Expose as MCP tools', enabled: !!protocols.mcp?.enabled, config: protocols.mcp || {} },
      ],
    };
  }

  private async getPendingApprovals() {
    return { approvals: [] };
  }

  private getMCPServerStatus() {
    const oad = this.loadOAD();
    const mcpConfig = (oad?.spec as any)?.protocols?.mcp;
    const { agentToMCPTools } = require('../protocols/mcp/agent-tools');
    const agentName = oad?.metadata?.name || 'opc-agent';
    const tools = agentToMCPTools({ name: agentName });
    return {
      enabled: !!mcpConfig?.enabled,
      mode: mcpConfig?.mode || 'stdio',
      port: mcpConfig?.port || 3002,
      tools: tools.map((t: any) => ({ name: t.name, description: t.description })),
      toolCount: tools.length,
      exposedTools: mcpConfig?.exposedTools || tools.map((t: any) => t.name),
    };
  }

  private getTelemetryTraces(url: URL) {
    if (!this.tracer) return { traces: [] };
    const traceId = url.searchParams.get('id');
    if (traceId) {
      return { spans: this.tracer.getTrace(traceId) };
    }
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const spans = this.tracer.getSpans({ limit });
    // Group by traceId for trace list
    const traceMap = new Map<string, { traceId: string; rootSpan: string; startTime: number; spanCount: number; status: string }>();
    for (const s of spans) {
      if (!traceMap.has(s.traceId)) {
        traceMap.set(s.traceId, { traceId: s.traceId, rootSpan: s.name, startTime: s.startTime, spanCount: 0, status: s.status });
      }
      traceMap.get(s.traceId)!.spanCount++;
    }
    return { traces: Array.from(traceMap.values()) };
  }

  private async getEvalSuites() {
    const { AgentEvaluator } = require('../eval');
    return { suites: AgentEvaluator.builtinSuites() };
  }

  private async runEvalSuite(req: IncomingMessage): Promise<any> {
    const body = await this.readBody(req);
    const { suite: suiteName } = JSON.parse(body || '{}');
    const { AgentEvaluator } = require('../eval');
    const suite = AgentEvaluator.loadBuiltinSuite(suiteName || 'basic');
    // Use a mock agent for studio eval (no real agent loaded)
    const mockAgent = { chat: async (input: string) => `[mock response to: ${input}]` };
    const evaluator = new AgentEvaluator(mockAgent);
    const report = await evaluator.evalSuite(suite);
    // Save report
    const reportsDir = join(this.config.agentDir, '.eval-reports');
    const reportPath = join(reportsDir, `${suiteName || 'basic'}-${Date.now()}.json`);
    AgentEvaluator.saveReport(report, reportPath);
    return report;
  }

  private async getEvalReports() {
    const reportsDir = join(this.config.agentDir, '.eval-reports');
    if (!existsSync(reportsDir)) return { reports: [] };
    const files = require('fs').readdirSync(reportsDir).filter((f: string) => f.endsWith('.json'));
    return {
      reports: files.map((f: string) => {
        try {
          return JSON.parse(readFileSync(join(reportsDir, f), 'utf-8'));
        } catch { return null; }
      }).filter(Boolean)
    };
  }

  // --- A2A Protocol ---

  private getA2ACard() {
    try {
      const { oadToAgentCard } = require('../protocols/a2a');
      const yaml = require('js-yaml');
      for (const name of ['agent.yaml', 'agent.yml']) {
        const p = join(this.config.agentDir, name);
        if (existsSync(p)) {
          const oad = yaml.load(readFileSync(p, 'utf-8'));
          return oadToAgentCard(oad, `http://localhost:${this.config.port}`);
        }
      }
      return { error: 'No agent.yaml found' };
    } catch { return { error: 'Failed to generate agent card' }; }
  }

  private getA2ATasks() {
    // In-memory tasks from A2A server if running
    return { tasks: [] };
  }

  private async discoverA2AAgent(req: IncomingMessage): Promise<any> {
    const body = await this.readBody(req);
    const { url } = JSON.parse(body || '{}');
    if (!url) return { error: 'url required' };
    try {
      const { A2AClient } = require('../protocols/a2a');
      const client = new A2AClient(url);
      return await client.getAgentCard();
    } catch (err: any) {
      return { error: err.message };
    }
  }

  private async getFirstRunStatus(): Promise<any> {
    const configPath = join(os.homedir(), '.opc', 'config.json');
    const ollamaStatus = await this.detectLocalOllama();
    if (!existsSync(configPath)) {
      return { firstRun: true, ollamaDetected: ollamaStatus.running, ollamaModels: ollamaStatus.models || [] };
    }
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return { firstRun: !config.firstRunComplete, ollamaDetected: ollamaStatus.running, ollamaModels: ollamaStatus.models || [] };
    } catch {
      return { firstRun: true, ollamaDetected: ollamaStatus.running, ollamaModels: ollamaStatus.models || [] };
    }
  }

  private async completeFirstRun(choices: any): Promise<any> {
    const cfg = loadSettingsConfig();
    cfg.firstRunComplete = true;
    if (choices) {
      if (choices.templateId) cfg.firstRunTemplate = choices.templateId;
      if (choices.model) cfg.models = { ...(cfg.models || {}), chatModel: choices.model };
    }
    saveSettingsConfig(cfg);
    return { success: true };
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
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
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
      let yamlPath = join(this.config.agentDir, 'agent.yaml');
      if (!existsSync(yamlPath)) yamlPath = join(this.config.agentDir, 'agent.yml');
      if (!existsSync(yamlPath)) yamlPath = join(this.config.agentDir, 'oad.yaml');
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(content);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
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

  private async handlePlaygroundChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = JSON.parse(await this.readBody(req));
    const { messages = [], model = 'auto', temperature = 0.7, systemPrompt } = body;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Simulated streaming response for playground demo
    const allMsgs = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
    const lastMsg = allMsgs[allMsgs.length - 1]?.content || '';
    const response = `This is a playground demo response to: "${lastMsg}"\n\nModel: ${model}, Temperature: ${temperature}\nMessages in context: ${allMsgs.length}`;

    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }

  // --- Document upload handlers ---

  private getDocumentsDir(agentId: string): string {
    const dir = join(this.getAgentsDir(), agentId + '-documents');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private async handleDocumentUpload(req: IncomingMessage, res: ServerResponse, agentId: string): Promise<void> {
    const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
      // Parse multipart form data manually
      const { buffer, filename } = await this.parseMultipart(req);

      if (!filename) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'No file uploaded' }));
        return;
      }

      if (buffer.length > 50 * 1024 * 1024) {
        res.writeHead(413, corsHeaders);
        res.end(JSON.stringify({ error: 'File too large (max 50MB)' }));
        return;
      }

      // Process document
      const processor = new DocumentProcessor();
      const doc = await processor.process(buffer, filename);

      // Store chunks via DeepBrain learn()
      let learnedCount = 0;
      try {
        const { Brain } = await dynamicImport('deepbrain');
        const oad = this.loadOAD();
        const dbPath = oad?.spec?.memory?.longTerm?.database || './data/brain.db';
        const brain = new Brain({ database: dbPath, embedding_provider: 'ollama' });
        await brain.connect();

        for (const chunk of doc.chunks) {
          const content = `[Source: ${filename}] ${chunk.title}\n\n${chunk.content}`;
          if (typeof brain.store === 'function') {
            await brain.store('documents', `${doc.id}-${chunk.metadata.chunkIndex}`, content, {
              source: filename,
              docId: doc.id,
              chunkIndex: chunk.metadata.chunkIndex,
              tags: ['document-upload', filename],
            });
          } else if (typeof brain.learn === 'function') {
            await brain.learn(content, {
              tags: ['document-upload', filename],
              slug: `${doc.id}-${chunk.metadata.chunkIndex}`,
            });
          }
          learnedCount++;
        }

        await brain.disconnect();
      } catch {
        // If DeepBrain is not available, store in local memory files
        const memDir = join(this.getAgentsDir(), agentId + '-memory');
        if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });

        for (const chunk of doc.chunks) {
          const entry = {
            id: `${doc.id}-${chunk.metadata.chunkIndex}`,
            content: chunk.content,
            summary: `[${filename}] ${chunk.title}`,
            timestamp: new Date().toISOString(),
            source: filename,
            docId: doc.id,
            tags: ['document-upload'],
          };
          writeFileSync(join(memDir, `${entry.id}.json`), JSON.stringify(entry, null, 2));
          learnedCount++;
        }
      }

      // Save document metadata
      const docsDir = this.getDocumentsDir(agentId);
      const docMeta = {
        id: doc.id,
        filename: doc.filename,
        format: doc.format,
        size: doc.size,
        chunks: doc.chunks.length,
        processedAt: doc.processedAt,
      };
      writeFileSync(join(docsDir, `${doc.id}.json`), JSON.stringify(docMeta, null, 2));

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ success: true, document: docMeta, learnedCount }));
    } catch (e: any) {
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: e.message || 'Upload failed' }));
    }
  }

  private async parseMultipart(req: IncomingMessage): Promise<{ buffer: Buffer; filename: string }> {
    return new Promise((resolve, reject) => {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);

      if (!boundaryMatch) {
        reject(new Error('Missing multipart boundary'));
        return;
      }

      const boundary = boundaryMatch[1];
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('error', reject);
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const bodyStr = body.toString('latin1');
        const parts = bodyStr.split('--' + boundary).filter(p => p.trim() && p.trim() !== '--');

        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;

          const headers = part.slice(0, headerEnd);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          if (!filenameMatch) continue;

          const filename = filenameMatch[1];
          // Extract binary content properly
          const contentStart = body.indexOf('\r\n\r\n', body.indexOf(Buffer.from(headers.slice(0, 40), 'latin1'))) + 4;
          const nextBoundary = body.indexOf(Buffer.from('\r\n--' + boundary, 'latin1'), contentStart);
          const fileBuffer = body.slice(contentStart, nextBoundary);

          resolve({ buffer: fileBuffer, filename });
          return;
        }

        reject(new Error('No file found in upload'));
      });
    });
  }

  private getDocumentList(agentId: string): any {
    const docsDir = this.getDocumentsDir(agentId);
    const files = readdirSync(docsDir).filter(f => f.endsWith('.json'));
    const documents = files.map(f => {
      try { return JSON.parse(readFileSync(join(docsDir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) =>
      new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
    );
    return { documents };
  }

  private deleteDocument(agentId: string, docId: string): any {
    const docsDir = this.getDocumentsDir(agentId);
    const docPath = join(docsDir, `${docId}.json`);

    if (!existsSync(docPath)) {
      return { error: 'Document not found' };
    }

    // Delete document metadata
    unlinkSync(docPath);

    // Try to delete from DeepBrain
    try {
      // Remove memory entries with this docId
      const memDir = join(this.getAgentsDir(), agentId + '-memory');
      if (existsSync(memDir)) {
        const files = readdirSync(memDir).filter(f => f.startsWith(docId));
        for (const f of files) {
          unlinkSync(join(memDir, f));
        }
      }
    } catch { /* best effort */ }

    return { success: true, deleted: docId };
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

