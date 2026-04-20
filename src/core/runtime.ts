import * as path from 'path';
import { PluginManager } from '../plugins';
import type { Plugin } from '../plugins';
import { loggerPlugin } from '../plugins/logger';
import { createRateLimiterPlugin } from '../plugins/rate-limiter';
import { createContentFilterPlugin } from '../plugins/content-filter';
import { BaseAgent } from './agent';
import { loadOAD } from './config';
import { Logger } from './logger';
import { UserProfiler } from '../memory/user-profiler';
import { WebChannel } from '../channels/web';
import { TelegramChannel } from '../channels/telegram';
import { WebSocketChannel } from '../channels/websocket';
import { WeChatChannel } from '../channels/wechat';
import { FeishuChannel } from '../channels/feishu';
import { EmailChannel } from '../channels/email';
import { DeepBrainMemoryStore } from '../memory/deepbrain';
import { Analytics } from '../analytics';
import type { OADDocument } from '../schema/oad';
import { Scheduler } from './scheduler';
import type { CronJob } from './scheduler';
import type { ISkill, MemoryStore, Message } from './types';
import type { Response } from 'express';

const MAX_TOOL_OUTPUT = 5000;
const DEFAULT_HISTORY_LIMIT = 50;

export function truncateOutput(output: string, maxChars: number = MAX_TOOL_OUTPUT): string {
  if (output.length <= maxChars) return output;
  const half = Math.floor(maxChars / 2) - 50;
  return `${output.slice(0, half)}\n\n... [truncated ${output.length - maxChars} chars] ...\n\n${output.slice(-half)}`;
}

export class AgentRuntime {
  private agent: BaseAgent | null = null;
  private config: OADDocument | null = null;
  private logger = new Logger('runtime');
  private historyLimit: number = DEFAULT_HISTORY_LIMIT;
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private isShuttingDown = false;
  private analytics: Analytics = new Analytics();
  private scheduler: Scheduler | null = null;
  private pluginManager: PluginManager = new PluginManager();
  private brain: any = null;
  private agentBrain: any = null;
  private evolveScheduler: any = null;

  async loadConfig(filePath: string): Promise<OADDocument> {
    const fs = require('fs');
    const path = require('path');

    // 如果指定文件不存在，尝试 fallback
    if (!fs.existsSync(filePath)) {
      // 如果发现旧的 agent.yaml，提示迁移
      if (filePath === 'oad.yaml' && fs.existsSync('agent.yaml')) {
        this.logger.warn('⚠️  发现 agent.yaml 但未找到 oad.yaml。建议运行 `opc migrate` 统一为 oad.yaml。');
        this.logger.info('暂时使用 agent.yaml 加载配置...');
        filePath = 'agent.yaml';
      } else {
      // Auto-create a minimal oad.yaml with auto-detect provider
      const yaml = require('js-yaml');
      const defaultOAD = {
        apiVersion: 'opc/v1',
        kind: 'Agent',
        metadata: { name: 'my-agent', version: '1.0.0', description: 'OPC Agent' },
        spec: {
          model: 'auto',
          provider: { default: 'auto' },
          systemPrompt: 'You are a helpful AI assistant.',
          channels: [{ type: 'web', config: { port: 3000 } }],
        },
      };
      fs.writeFileSync(filePath, yaml.dump(defaultOAD, { lineWidth: 120 }));
      this.logger.info('Created default oad.yaml (no config file found)');
      }
    }
    this.config = loadOAD(filePath);
    this.logger.info('Config loaded', { name: this.config.metadata.name });

    // 如果同时存在 agent.yaml 和 oad.yaml，提示用户清理
    if (fs.existsSync('agent.yaml') && fs.existsSync('oad.yaml')) {
      this.logger.warn('⚠️  同时存在 agent.yaml 和 oad.yaml。建议删除 agent.yaml，统一使用 oad.yaml。');
    }

    return this.config;
  }

  setHistoryLimit(limit: number): void {
    this.historyLimit = limit;
  }

  private loadDotEnv(): void {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve('.env');
    if (!fs.existsSync(envPath)) return;
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch { /* ignore */ }
  }

  async initialize(config?: OADDocument): Promise<BaseAgent> {
    // Auto-load .env file if present
    this.loadDotEnv();

    const cfg = config ?? this.config;
    if (!cfg) throw new Error('No config loaded. Call loadConfig() first.');

    // 检查 API key 是否为占位符，启动时警告
    const apiKey = process.env.OPC_LLM_API_KEY;
    const cfgProvider = cfg.spec.provider?.default;
    if (cfgProvider !== 'ollama' && cfgProvider !== 'auto') {
      if (!apiKey || apiKey === 'your-api-key-here') {
        this.logger.warn('⚠️  API Key 未配置或仍是占位符。请编辑 .env 文件设置 OPC_LLM_API_KEY。');
      }
    }

    let memory: MemoryStore | undefined;
    const memCfg = cfg.spec.memory;
    if (memCfg && typeof memCfg.longTerm === 'object' && memCfg.longTerm.provider === 'deepbrain') {
      memory = new DeepBrainMemoryStore({
        collection: memCfg.longTerm.collection,
        config: memCfg.longTerm.config,
      });
      this.logger.info('Using DeepBrain memory provider');
    } else {
      // Default: SQLite persistent memory
      try {
        const { SQLiteStore } = await import('../memory/sqlite-store');
        memory = new SQLiteStore({ dbPath: path.resolve('.opc', 'memory.db') });
        this.logger.info('Using SQLite memory provider', { path: '.opc/memory.db' });
      } catch {
        // sql.js not available — fall through to InMemoryStore
        this.logger.info('SQLite not available, using in-memory store');
      }
    }

    this.agent = new BaseAgent({
      name: cfg.metadata.name,
      systemPrompt: cfg.spec.systemPrompt,
      provider: cfg.spec.provider?.default,
      model: cfg.spec.model,
      memory,
      historyLimit: this.historyLimit,
      skillsDir: path.resolve('.opc', 'learned-skills'),
    });

    for (const ch of cfg.spec.channels) {
      if (ch.type === 'web') {
        const port = ch.port ?? 3000;
        const webChannel = new WebChannel(port);
        webChannel.setAgentName(cfg.metadata.name);
        webChannel.setAgentVersion(cfg.metadata.version);
        webChannel.setAnalyticsProvider(() => this.analytics.getSnapshot());
        webChannel.setChannelNames(cfg.spec.channels.map((c: any) => c.type));
        webChannel.setSkillNames(cfg.spec.skills.map((s: any) => s.name));
        const memType = memCfg && typeof memCfg.longTerm === 'object' && memCfg.longTerm.provider === 'deepbrain' ? 'deepbrain' : 'in-memory';
        webChannel.setMemoryType(memType);
        // Wire streaming
        webChannel.onStreamMessage(async (msg: Message, res: Response) => {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          const startTime = Date.now();
          try {
            for await (const chunk of this.agent!.handleMessageStream(msg)) {
              res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            this.analytics.recordMessage(Date.now() - startTime);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
            this.analytics.recordError();
          }
          res.end();
        });
        this.agent.bindChannel(webChannel);
        this.logger.info('Bound web channel', { port });
      } else if (ch.type === 'telegram') {
        const tgChannel = new TelegramChannel({
          token: ch.config?.token as string,
          port: ch.port,
        });
        // Wire up streaming for real-time message editing
        const agentRef = this.agent;
        tgChannel.setStreamHandler(async function* (msg) {
          const history = [msg];
          const provider = agentRef.provider;
          const systemPrompt = agentRef.getSystemPrompt();
          for await (const chunk of provider.chatStream(history, systemPrompt)) {
            yield chunk;
          }
        });
        this.agent.bindChannel(tgChannel);
        this.logger.info('Bound telegram channel');
      } else if (ch.type === 'websocket') {
        this.agent.bindChannel(new WebSocketChannel(ch.port ?? 3002));
        this.logger.info('Bound websocket channel', { port: ch.port ?? 3002 });
      } else if (ch.type === 'wechat') {
        this.agent.bindChannel(new WeChatChannel({
          appId: (ch.config?.appId as string) ?? process.env.WECHAT_APP_ID ?? '',
          appSecret: (ch.config?.appSecret as string) ?? process.env.WECHAT_APP_SECRET ?? '',
          token: (ch.config?.token as string) ?? process.env.WECHAT_TOKEN ?? '',
          encodingAESKey: ch.config?.encodingAESKey as string,
          port: ch.port,
        }));
        this.logger.info('Bound wechat channel', { port: ch.port ?? 8080 });
      } else if (ch.type === 'feishu') {
        this.agent.bindChannel(new FeishuChannel({
          appId: (ch.config?.appId as string) ?? process.env.FEISHU_APP_ID,
          appSecret: (ch.config?.appSecret as string) ?? process.env.FEISHU_APP_SECRET,
          verificationToken: (ch.config?.verificationToken as string) ?? process.env.FEISHU_VERIFICATION_TOKEN,
          encryptKey: ch.config?.encryptKey as string,
          port: ch.port,
        }));
        this.logger.info('Bound feishu channel', { port: ch.port ?? 8081 });
      } else if (ch.type === 'email') {
        this.agent.bindChannel(new EmailChannel({
          mode: (ch.config?.mode as 'webhook' | 'imap') ?? 'webhook',
          smtp: ch.config?.smtp as any,
          imap: ch.config?.imap as any,
          webhookPort: ch.port,
          filters: ch.config?.filters as any,
        }));
        this.logger.info('Bound email channel', { mode: ch.config?.mode ?? 'webhook', port: ch.port ?? 8082 });
      }
    }

    await this.agent.init();

    // === Auto-wire DeepBrain long-term memory (Brain/AgentBrain) ===
    const longTermCfg = memCfg && typeof memCfg.longTerm === 'object' ? memCfg.longTerm : null;
    if (longTermCfg?.provider === 'deepbrain') {
      try {
        const deepbrainModule = await import(/* webpackIgnore: true */ 'deepbrain');
        const BrainClass = deepbrainModule.Brain ?? deepbrainModule.default?.Brain;
        const AgentBrainClass = deepbrainModule.AgentBrain ?? deepbrainModule.default?.AgentBrain;

        if (BrainClass && AgentBrainClass) {
          const dbConfig = longTermCfg.config ?? {};
          const dbPath = (dbConfig as any).database || './data/brain.db';
          const embeddingProvider = (dbConfig as any).embeddingProvider || 'ollama';

          this.brain = new BrainClass({
            database: dbPath,
            embedding_provider: embeddingProvider,
          });
          await this.brain.connect();

          this.agentBrain = new AgentBrainClass(this.brain, cfg.metadata.name);
          this.agent.setLongTermMemory(this.agentBrain, {
            autoLearn: (dbConfig as any).autoLearn !== false,
            autoRecall: (dbConfig as any).autoRecall !== false,
          });

          this.logger.info('DeepBrain Brain/AgentBrain connected', { database: dbPath });

          // Brain seed loading
          const { existsSync, readFileSync, renameSync } = await import('fs');
          const seedPath = './data/brain-seed.md';
          if (existsSync(seedPath)) {
            const seed = readFileSync(seedPath, 'utf-8');
            await this.brain.put('brain-seed', seed, { type: 'seed', tags: ['seed', 'initial'] });
            renameSync(seedPath, './data/brain-seed.loaded.md');
            this.logger.info('Brain seed loaded');
          }

          // Auto-evolve scheduling
          const evolveInterval = (dbConfig as any).evolveInterval;
          if (evolveInterval && evolveInterval > 0) {
            const AutoEvolveSchedulerClass = deepbrainModule.AutoEvolveScheduler ?? deepbrainModule.default?.AutoEvolveScheduler;
            if (AutoEvolveSchedulerClass) {
              this.evolveScheduler = new AutoEvolveSchedulerClass();
              this.evolveScheduler.start(this.agentBrain, evolveInterval);
              this.logger.info('DeepBrain auto-evolve scheduled', { interval: evolveInterval });
            }
          }
        } else {
          this.logger.warn('DeepBrain module found but Brain/AgentBrain classes not available');
        }
      } catch (e: any) {
        this.logger.warn('DeepBrain not available (install with: npm install deepbrain)', { error: e.message });
      }
    }

    // Wire analytics to agent events
    this.agent.on('message:out', () => {
      // responseTime is approximated; real timing is done via skill/llm events
    });
    this.agent.on('skill:execute', (skillName: string) => {
      this.analytics.recordSkillUsage(skillName);
    });
    this.agent.on('error', () => {
      this.analytics.recordError();
    });

    this.logger.info('Agent initialized', { name: cfg.metadata.name });

    // Load enhanced plugins from OAD config
    const pluginsCfg = (cfg.spec as any).plugins;
    if (pluginsCfg && Array.isArray(pluginsCfg)) {
      const builtinPlugins: Record<string, (config?: any) => Plugin> = {
        'logger': () => loggerPlugin,
        'rate-limiter': (c: any) => createRateLimiterPlugin(c?.maxPerMinute ?? 60),
        'content-filter': (c: any) => createContentFilterPlugin(c?.blocklist ?? []),
      };
      for (const entry of pluginsCfg) {
        const factory = builtinPlugins[entry.name];
        if (factory) {
          this.pluginManager.registerEnhanced(factory(entry.config));
          this.logger.info('Enhanced plugin loaded from config', { name: entry.name });
        }
      }
    }
    await this.pluginManager.initAll(this);

    // Initialize scheduler if jobs are configured
    const schedulerCfg = (cfg.spec as any).scheduler;
    if (schedulerCfg?.jobs && Array.isArray(schedulerCfg.jobs) && schedulerCfg.jobs.length > 0) {
      this.scheduler = new Scheduler(async (job: CronJob) => {
        this.logger.info('Scheduler firing job', { name: job.name, task: job.task });
        if (this.agent) {
          const msg: Message = {
            id: `cron-${job.id}-${Date.now()}`,
            role: 'user',
            content: job.task,
            timestamp: Date.now(),
            metadata: { source: 'scheduler', jobId: job.id, jobName: job.name },
          };
          try {
            await this.agent.handleMessage(msg);
          } catch (err) {
            this.logger.error('Scheduler job failed', { name: job.name, error: err instanceof Error ? err.message : String(err) });
          }
        }
      });

      for (let i = 0; i < schedulerCfg.jobs.length; i++) {
        const j = schedulerCfg.jobs[i];
        const id = j.id || j.name?.toLowerCase().replace(/\s+/g, '-') || `job-${i}`;
        this.scheduler.addJob({
          id,
          name: j.name || id,
          schedule: j.schedule,
          task: j.task || '',
          enabled: j.enabled !== false,
        });
      }
      this.logger.info('Scheduler configured', { jobs: schedulerCfg.jobs.length });
    }

    return this.agent;
  }

  async start(): Promise<void> {
    if (!this.agent) throw new Error('Agent not initialized.');
    this.setupGracefulShutdown();
    await this.agent.start();

    // Wire up user profiler — auto-learns from every conversation
    const profiler = new UserProfiler();
    this.agent.on('message:in', (msg: any) => {
      if (msg.role === 'user' && msg.content) {
        profiler.observe(msg);
      }
    });
    this.agent.on('message:out', (msg: any) => {
      profiler.observe(msg);
    });
    // Load USER.md into system prompt if exists
    const userMdPath = path.resolve('USER.md');
    try {
      const { existsSync, readFileSync } = await import('fs');
      if (existsSync(userMdPath)) {
        const userMd = readFileSync(userMdPath, 'utf-8');
        const currentPrompt = this.agent.getSystemPrompt();
        this.agent.setSystemPrompt(currentPrompt + '\n\n' + userMd);
        this.logger.info('Loaded USER.md into system prompt');
      }
    } catch { /* ignore */ }
    // Periodically save USER.md (every 50 messages)
    let msgCount = 0;
    this.agent.on('message:out', () => {
      msgCount++;
      if (msgCount % 50 === 0) {
        profiler.saveUserMd(process.cwd()).catch(() => {});
      }
    });

    if (this.scheduler) {
      this.scheduler.start();
      this.logger.info('Scheduler started');
    }

    // Wire up proactive agent
    try {
      const { ProactiveAgent } = await import('../scheduler/proactive');
      const proactive = new ProactiveAgent();
      proactive.onMessage(async (msg) => {
        this.logger.info('Proactive message', { type: msg.type });
        // Emit as system event that channels can pick up
        this.agent?.emit('proactive:message', msg);
      });
      // Track user activity
      this.agent.on('message:in', () => proactive.recordUserActivity());
      // Check idle every 30 minutes
      setInterval(() => {
        proactive.checkIdle().then(msg => {
          if (msg) proactive.send(msg);
        }).catch(() => {});
      }, 30 * 60 * 1000);
      this.logger.info('Proactive agent enabled');
    } catch { /* ignore if proactive module fails */ }

    this.logger.info('Agent started');
  }

  async stop(): Promise<void> {
    if (!this.agent) return;
    this.logger.info('Stopping agent...');
    if (this.evolveScheduler) {
      try { this.evolveScheduler.stop(); } catch { /* ignore */ }
      this.logger.info('DeepBrain auto-evolve stopped');
    }
    if (this.brain) {
      try {
        await this.brain.disconnect();
        this.logger.info('DeepBrain disconnected');
      } catch { /* ignore */ }
    }
    if (this.scheduler) {
      this.scheduler.stop();
      this.logger.info('Scheduler stopped');
    }
    await this.pluginManager.shutdownAll();
    await this.agent.stop();
    for (const handler of this.shutdownHandlers) {
      await handler();
    }
    this.logger.info('Agent stopped');
  }

  onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      this.logger.error('Uncaught exception', { message: err.message });
      shutdown('uncaughtException');
    });
  }

  registerSkill(skill: ISkill): void {
    if (!this.agent) throw new Error('Agent not initialized.');
    this.agent.registerSkill(skill);
    this.logger.debug('Skill registered', { name: skill.name });
  }

  getAgent(): BaseAgent | null {
    return this.agent;
  }

  getAnalytics(): Analytics {
    return this.analytics;
  }

  getConfig(): OADDocument | null {
    return this.config;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }
}
