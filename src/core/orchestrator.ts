import { EventEmitter } from 'events';
import type { AgentContext, Message } from './types';

/**
 * Multi-Agent Orchestrator — v0.8.0
 * Routes messages to specialized sub-agents, supports parallel execution and handoffs.
 */

export interface AgentNode {
  id: string;
  name: string;
  description: string;
  /** Patterns or intents this agent handles */
  routes: string[];
  /** Function that processes a message and returns a response */
  handler: (context: AgentContext, message: Message) => Promise<Message>;
  /** Priority for routing conflicts (higher wins) */
  priority?: number;
}

export interface OrchestratorWorkflow {
  name: string;
  description?: string;
  /** Ordered list of agent IDs for sequential execution */
  steps?: string[];
  /** List of agent IDs for parallel execution */
  parallel?: string[];
  /** Router config: auto-route based on message content */
  router?: {
    agents: string[];
    fallback?: string;
  };
}

export interface HandoffRequest {
  fromAgent: string;
  toAgent: string;
  context: AgentContext;
  reason: string;
}

export interface OrchestratorConfig {
  agents: AgentNode[];
  workflows?: OrchestratorWorkflow[];
  defaultWorkflow?: string;
  maxParallel?: number;
}

export class Orchestrator extends EventEmitter {
  private agents: Map<string, AgentNode> = new Map();
  private workflows: Map<string, OrchestratorWorkflow> = new Map();
  private defaultWorkflow?: string;
  private maxParallel: number;

  constructor(config: OrchestratorConfig) {
    super();
    this.maxParallel = config.maxParallel ?? 5;
    this.defaultWorkflow = config.defaultWorkflow;

    for (const agent of config.agents) {
      this.agents.set(agent.id, agent);
    }
    for (const wf of config.workflows ?? []) {
      this.workflows.set(wf.name, wf);
    }
  }

  /** Register a new agent node */
  registerAgent(agent: AgentNode): void {
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', agent.id);
  }

  /** Unregister an agent */
  unregisterAgent(id: string): void {
    this.agents.delete(id);
    this.emit('agent:unregistered', id);
  }

  /** Route a message to the best-matching agent */
  route(message: Message): AgentNode | undefined {
    const content = message.content.toLowerCase();
    let bestMatch: AgentNode | undefined;
    let bestPriority = -1;

    for (const agent of this.agents.values()) {
      for (const route of agent.routes) {
        if (content.includes(route.toLowerCase()) || new RegExp(route, 'i').test(content)) {
          const priority = agent.priority ?? 0;
          if (priority > bestPriority) {
            bestMatch = agent;
            bestPriority = priority;
          }
          break;
        }
      }
    }
    return bestMatch;
  }

  /** Execute a single agent */
  async executeAgent(agentId: string, context: AgentContext, message: Message): Promise<Message> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    this.emit('agent:execute', agentId, message);
    const result = await agent.handler(context, message);
    this.emit('agent:complete', agentId, result);
    return result;
  }

  /** Run multiple agents in parallel */
  async executeParallel(
    agentIds: string[],
    context: AgentContext,
    message: Message
  ): Promise<Map<string, Message>> {
    const results = new Map<string, Message>();
    const batches: string[][] = [];

    // Batch by maxParallel
    for (let i = 0; i < agentIds.length; i += this.maxParallel) {
      batches.push(agentIds.slice(i, i + this.maxParallel));
    }

    for (const batch of batches) {
      const promises = batch.map(async (id) => {
        const result = await this.executeAgent(id, context, message);
        results.set(id, result);
      });
      await Promise.all(promises);
    }

    return results;
  }

  /** Execute a named workflow */
  async executeWorkflow(
    workflowName: string,
    context: AgentContext,
    message: Message
  ): Promise<Message[]> {
    const wf = this.workflows.get(workflowName);
    if (!wf) throw new Error(`Workflow not found: ${workflowName}`);

    const results: Message[] = [];

    // Sequential steps
    if (wf.steps) {
      let currentMessage = message;
      for (const agentId of wf.steps) {
        const result = await this.executeAgent(agentId, context, currentMessage);
        results.push(result);
        currentMessage = result; // chain output → next input
      }
    }

    // Parallel execution
    if (wf.parallel) {
      const parallelResults = await this.executeParallel(wf.parallel, context, message);
      results.push(...parallelResults.values());
    }

    // Router-based
    if (wf.router) {
      const matched = this.route(message);
      const targetId = matched && wf.router.agents.includes(matched.id)
        ? matched.id
        : wf.router.fallback;
      if (targetId) {
        const result = await this.executeAgent(targetId, context, message);
        results.push(result);
      }
    }

    return results;
  }

  /** Hand off conversation from one agent to another */
  async handoff(request: HandoffRequest): Promise<Message> {
    this.emit('agent:handoff', request);
    const { toAgent, context } = request;
    const lastMessage = context.messages[context.messages.length - 1];
    if (!lastMessage) throw new Error('No message in context for handoff');
    return this.executeAgent(toAgent, context, lastMessage);
  }

  /** Process an incoming message using the default workflow or routing */
  async process(context: AgentContext, message: Message): Promise<Message[]> {
    if (this.defaultWorkflow) {
      return this.executeWorkflow(this.defaultWorkflow, context, message);
    }

    // Fallback: route to single agent
    const agent = this.route(message);
    if (agent) {
      const result = await this.executeAgent(agent.id, context, message);
      return [result];
    }

    return [{
      id: `orch-${Date.now()}`,
      role: 'assistant',
      content: 'No agent available to handle this request.',
      timestamp: Date.now(),
    }];
  }

  getAgents(): AgentNode[] {
    return Array.from(this.agents.values());
  }

  getWorkflows(): OrchestratorWorkflow[] {
    return Array.from(this.workflows.values());
  }
}
