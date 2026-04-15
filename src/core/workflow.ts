import { EventEmitter } from 'events';
import type { Message, AgentContext, ISkill, IAgent } from './types';
import { Logger } from './logger';

// ── Workflow Types ──────────────────────────────────────────

export type StepType = 'skill' | 'tool' | 'agent' | 'condition' | 'parallel';

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  config?: Record<string, unknown>;
  /** For condition steps */
  condition?: string;
  branches?: { if: WorkflowStep[]; else?: WorkflowStep[] };
  /** For parallel steps */
  parallel?: WorkflowStep[];
  /** Timeout in ms */
  timeout?: number;
  /** Retry count */
  retries?: number;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  version?: string;
  steps: WorkflowStep[];
  onError?: 'stop' | 'skip' | 'retry';
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'skipped' | 'error';
  output?: string;
  error?: string;
  durationMs: number;
}

export interface WorkflowResult {
  workflow: string;
  status: 'completed' | 'failed' | 'partial';
  steps: StepResult[];
  totalDurationMs: number;
}

// ── Workflow Engine ─────────────────────────────────────────

export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private skills: Map<string, ISkill> = new Map();
  private agents: Map<string, IAgent> = new Map();
  private logger = new Logger('workflow');

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.name, workflow);
    this.logger.info('Workflow registered', { name: workflow.name, steps: workflow.steps.length });
  }

  unregisterWorkflow(name: string): void {
    this.workflows.delete(name);
  }

  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  registerSkill(skill: ISkill): void {
    this.skills.set(skill.name, skill);
  }

  registerAgent(agent: IAgent): void {
    this.agents.set(agent.name, agent);
  }

  async run(name: string, context: AgentContext, input?: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(name);
    if (!workflow) throw new Error(`Workflow "${name}" not found`);

    const startTime = Date.now();
    const results: StepResult[] = [];
    let failed = false;

    this.emit('workflow:start', { name, input });

    try {
      await this.executeSteps(workflow.steps, context, input ?? '', results, workflow.onError ?? 'stop');
    } catch (err) {
      failed = true;
      this.logger.error('Workflow failed', { name, error: (err as Error).message });
    }

    const result: WorkflowResult = {
      workflow: name,
      status: failed ? 'failed' : results.some(r => r.status === 'error') ? 'partial' : 'completed',
      steps: results,
      totalDurationMs: Date.now() - startTime,
    };

    this.emit('workflow:end', result);
    return result;
  }

  private async executeSteps(
    steps: WorkflowStep[],
    context: AgentContext,
    input: string,
    results: StepResult[],
    onError: string,
  ): Promise<string> {
    let currentInput = input;

    for (const step of steps) {
      const stepStart = Date.now();

      try {
        if (step.type === 'parallel' && step.parallel) {
          const parallelResults = await Promise.all(
            step.parallel.map(s => this.executeSingleStep(s, context, currentInput)),
          );
          const combined = parallelResults.map(r => r.output ?? '').join('\n');
          for (const r of parallelResults) results.push(r);
          currentInput = combined;
        } else if (step.type === 'condition' && step.branches) {
          const conditionMet = this.evaluateCondition(step.condition ?? '', currentInput, context);
          const branch = conditionMet ? step.branches.if : (step.branches.else ?? []);
          results.push({
            stepId: step.id,
            status: 'success',
            output: `condition=${conditionMet}`,
            durationMs: Date.now() - stepStart,
          });
          currentInput = await this.executeSteps(branch, context, currentInput, results, onError);
        } else {
          const result = await this.executeSingleStep(step, context, currentInput);
          results.push(result);
          if (result.status === 'success' && result.output) {
            currentInput = result.output;
          }
          if (result.status === 'error' && onError === 'stop') {
            throw new Error(`Step "${step.id}" failed: ${result.error}`);
          }
        }
      } catch (err) {
        if (onError === 'stop') throw err;
        // skip: continue
      }
    }

    return currentInput;
  }

  private async executeSingleStep(
    step: WorkflowStep,
    context: AgentContext,
    input: string,
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retries = step.retries ?? 0;

    while (true) {
      try {
        const output = await this.executeStepAction(step, context, input);
        return {
          stepId: step.id,
          status: 'success',
          output,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        if (retries > 0) {
          retries--;
          continue;
        }
        return {
          stepId: step.id,
          status: 'error',
          error: (err as Error).message,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  private async executeStepAction(step: WorkflowStep, context: AgentContext, input: string): Promise<string> {
    const message: Message = {
      id: `wf_${step.id}_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      metadata: { workflowStep: step.id },
    };

    switch (step.type) {
      case 'skill': {
        const skill = this.skills.get(step.name);
        if (!skill) throw new Error(`Skill "${step.name}" not found`);
        const result = await skill.execute(context, message);
        return result.response ?? '';
      }
      case 'agent': {
        const agent = this.agents.get(step.name);
        if (!agent) throw new Error(`Agent "${step.name}" not found`);
        const response = await agent.handleMessage(message);
        return response.content;
      }
      case 'tool': {
        // Tools are executed via config callback
        const toolFn = step.config?.handler as ((input: string) => Promise<string>) | undefined;
        if (toolFn) return await toolFn(input);
        return `[tool:${step.name}] executed`;
      }
      default:
        return input;
    }
  }

  private evaluateCondition(condition: string, input: string, _context: AgentContext): boolean {
    // Simple condition evaluator: supports "contains:keyword", "length>N", "true", "false"
    if (condition === 'true') return true;
    if (condition === 'false') return false;
    if (condition.startsWith('contains:')) {
      return input.toLowerCase().includes(condition.slice(9).toLowerCase());
    }
    if (condition.startsWith('length>')) {
      return input.length > parseInt(condition.slice(7), 10);
    }
    return !!condition;
  }
}
