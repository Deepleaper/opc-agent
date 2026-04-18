import { PluginManager } from '../plugins';
import type { Plugin } from '../plugins';
import { loggerPlugin } from '../plugins/logger';
import { createRateLimiterPlugin } from '../plugins/rate-limiter';
import { createContentFilterPlugin } from '../plugins/content-filter';
import { BaseAgent } from './agent';
import { loadOAD } from './config';
import { Logger } from './logger';
import { WebChannel } from '../channels/web';
import { TelegramChannel } from '../channels/telegram';
import { WebSocketChannel } from '../channels/websocket';
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

  async loadConfig(filePath: string): Promise<OADDocument> {
    this.config = loadOAD(filePath);
    this.logger.info('Config loaded', { name: this.config.metadata.name });
    return this.config;
  }

  setHistoryLimit(limit: number): void {
    this.historyLimit = limit;
  }

  async initialize(config?: OADDocument): Promise<BaseAgent> {
    const cfg = config ?? this.config;
    if (!cfg) throw new Error('No config loaded. Call loadConfig() first.');

    let memory: MemoryStore | undefined;
    const memCfg = cfg.spec.memory;
    if (memCfg && typeof memCfg.longTerm === 'object' && memCfg.longTerm.provider === 'deepbrain') {
      memory = new DeepBrainMemoryStore({
        collection: memCfg.longTerm.collection,
        config: memCfg.longTerm.config,
      });
      this.logger.info('Using DeepBrain memory provider');
    }

    this.agent = new BaseAgent({
      name: cfg.metadata.name,
      systemPrompt: cfg.spec.systemPrompt,
      provider: cfg.spec.provider?.default,
      model: cfg.spec.model,
      memory,
      historyLimit: this.historyLimit,
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
        this.agent.bindChannel(new TelegramChannel({
          token: ch.config?.token as string,
          port: ch.port,
        }));
        this.logger.info('Bound telegram channel');
      } else if (ch.type === 'websocket') {
        this.agent.bindChannel(new WebSocketChannel(ch.port ?? 3002));
        this.logger.info('Bound websocket channel', { port: ch.port ?? 3002 });
      }
    }

    await this.agent.init();

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
    if (this.scheduler) {
      this.scheduler.start();
      this.logger.info('Scheduler started');
    }
    this.logger.info('Agent started');
  }

  async stop(): Promise<void> {
    if (!this.agent) return;
    this.logger.info('Stopping agent...');
    if (this.scheduler) {
      this.scheduler.stop();
      this.logger.info('Scheduler stopped');
    }
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
}
