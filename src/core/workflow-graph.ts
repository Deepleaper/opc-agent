/**
 * Graph-based Workflow Engine with conditional branching, parallel execution,
 * loops, retry, timeout, and error handling.
 *
 * This is a standalone engine that works with function-based steps (no skill/agent coupling).
 * The original WorkflowEngine in workflow.ts is preserved for backward compatibility.
 */

// ── Types ───────────────────────────────────────────────────

export interface WorkflowContext {
  variables: Map<string, any>;
  results: Map<string, any>;
  currentStep: string;
  startTime: Date;
  errors: Array<{ step: string; error: Error }>;
}

export interface GraphWorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'parallel' | 'loop';
  // action
  action?: (context: WorkflowContext) => Promise<any>;
  // condition
  condition?: (context: WorkflowContext) => boolean;
  onTrue?: string;
  onFalse?: string;
  // parallel
  parallel?: string[];
  // loop
  loopCondition?: (context: WorkflowContext) => boolean;
  loopBody?: string;
  maxIterations?: number;
  // common
  next?: string;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  onError?: 'stop' | 'skip' | 'retry';
}

export interface GraphWorkflow {
  name: string;
  entryPoint: string;
  steps: Map<string, GraphWorkflowStep>;
}

export interface GraphWorkflowResult {
  workflow: string;
  status: 'completed' | 'failed';
  context: WorkflowContext;
  totalDurationMs: number;
}

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms));
}

function neverResolve(): Promise<never> {
  return new Promise(() => {});
}

function createContext(): WorkflowContext {
  return {
    variables: new Map(),
    results: new Map(),
    currentStep: '',
    startTime: new Date(),
    errors: [],
  };
}

// ── Graph Workflow Engine ───────────────────────────────────

export class GraphWorkflowEngine {
  async execute(workflow: GraphWorkflow): Promise<GraphWorkflowResult> {
    const startTime = Date.now();
    const context = createContext();
    let currentStep: string | undefined = workflow.entryPoint;

    try {
      while (currentStep) {
        const step = workflow.steps.get(currentStep);
        if (!step) break;

        context.currentStep = step.id;

        switch (step.type) {
          case 'action':
            await this.executeAction(step, context, workflow);
            currentStep = step.next;
            break;
          case 'condition':
            if (!step.condition) throw new Error(`Step "${step.id}" missing condition function`);
            const result = step.condition(context);
            currentStep = result ? step.onTrue : step.onFalse;
            break;
          case 'parallel':
            await this.executeParallel(step, context, workflow);
            currentStep = step.next;
            break;
          case 'loop':
            await this.executeLoop(step, context, workflow);
            currentStep = step.next;
            break;
          default:
            currentStep = step.next;
        }
      }
    } catch (err) {
      // Error already recorded in context.errors by executeAction
    }

    return {
      workflow: workflow.name,
      status: context.errors.length > 0 ? 'failed' : 'completed',
      context,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private async executeAction(
    step: GraphWorkflowStep,
    context: WorkflowContext,
    _workflow: GraphWorkflow,
  ): Promise<void> {
    if (!step.action) {
      context.results.set(step.id, undefined);
      return;
    }

    let attempts = 0;
    const maxAttempts = (step.retryCount ?? 0) + 1;
    const errorPolicy = step.onError ?? 'stop';

    while (attempts < maxAttempts) {
      try {
        const promises: Promise<any>[] = [step.action(context)];
        if (step.timeout) promises.push(rejectAfter(step.timeout));
        else promises.push(neverResolve());

        const result = await Promise.race(promises);
        context.results.set(step.id, result);
        return;
      } catch (e: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          if (errorPolicy === 'skip') {
            context.results.set(step.id, undefined);
            return;
          }
          const error = e instanceof Error ? e : new Error(String(e));
          context.errors.push({ step: step.id, error });
          if (errorPolicy === 'stop') throw error;
          return;
        }
        if (step.retryDelay) await sleep(step.retryDelay);
      }
    }
  }

  private async executeParallel(
    step: GraphWorkflowStep,
    context: WorkflowContext,
    workflow: GraphWorkflow,
  ): Promise<void> {
    if (!step.parallel || step.parallel.length === 0) return;

    const tasks = step.parallel.map(async (stepId) => {
      const subStep = workflow.steps.get(stepId);
      if (!subStep) throw new Error(`Parallel step "${stepId}" not found`);
      if (subStep.type === 'action') {
        await this.executeAction(subStep, context, workflow);
      }
    });

    await Promise.all(tasks);
  }

  private async executeLoop(
    step: GraphWorkflowStep,
    context: WorkflowContext,
    workflow: GraphWorkflow,
  ): Promise<void> {
    if (!step.loopCondition || !step.loopBody) return;

    const max = step.maxIterations ?? 100;
    let iterations = 0;

    while (step.loopCondition(context) && iterations < max) {
      const bodyStep = workflow.steps.get(step.loopBody);
      if (!bodyStep) break;
      if (bodyStep.type === 'action') {
        await this.executeAction(bodyStep, context, workflow);
      }
      iterations++;
    }

    context.results.set(step.id, { iterations });
  }
}

// ── Workflow Builder ────────────────────────────────────────

export class WorkflowBuilder {
  private steps: Map<string, GraphWorkflowStep> = new Map();
  private entry: string = '';
  private workflowName: string = 'unnamed';

  name(n: string): this {
    this.workflowName = n;
    return this;
  }

  start(id: string): this {
    this.entry = id;
    return this;
  }

  addAction(
    id: string,
    action: (context: WorkflowContext) => Promise<any>,
    options?: Partial<GraphWorkflowStep>,
  ): this {
    this.steps.set(id, {
      id,
      name: options?.name ?? id,
      type: 'action',
      action,
      ...options,
    });
    return this;
  }

  addCondition(
    id: string,
    condition: (context: WorkflowContext) => boolean,
    onTrue: string,
    onFalse: string,
    options?: Partial<GraphWorkflowStep>,
  ): this {
    this.steps.set(id, {
      id,
      name: options?.name ?? id,
      type: 'condition',
      condition,
      onTrue,
      onFalse,
      ...options,
    });
    return this;
  }

  addParallel(id: string, stepIds: string[], next?: string, options?: Partial<GraphWorkflowStep>): this {
    this.steps.set(id, {
      id,
      name: options?.name ?? id,
      type: 'parallel',
      parallel: stepIds,
      next,
      ...options,
    });
    return this;
  }

  addLoop(
    id: string,
    condition: (context: WorkflowContext) => boolean,
    body: string,
    options?: { maxIterations?: number; next?: string; name?: string },
  ): this {
    this.steps.set(id, {
      id,
      name: options?.name ?? id,
      type: 'loop',
      loopCondition: condition,
      loopBody: body,
      maxIterations: options?.maxIterations,
      next: options?.next,
    });
    return this;
  }

  build(): GraphWorkflow {
    if (!this.entry) throw new Error('Workflow must have an entry point. Call start() first.');
    return {
      name: this.workflowName,
      entryPoint: this.entry,
      steps: new Map(this.steps),
    };
  }
}

// ── OAD YAML workflow parsing ───────────────────────────────

export interface OADWorkflowStepDef {
  id: string;
  type: 'action' | 'condition' | 'parallel' | 'loop';
  name?: string;
  next?: string;
  onTrue?: string;
  onFalse?: string;
  parallel?: string[];
  loopBody?: string;
  maxIterations?: number;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  onError?: 'stop' | 'skip' | 'retry';
}

export interface OADWorkflowDef {
  name: string;
  steps: OADWorkflowStepDef[];
}

/**
 * Parse an OAD workflow definition into a GraphWorkflow.
 * Action handlers must be supplied via the actionMap.
 */
export function parseOADWorkflow(
  def: OADWorkflowDef,
  actionMap: Map<string, (context: WorkflowContext) => Promise<any>> = new Map(),
  conditionMap: Map<string, (context: WorkflowContext) => boolean> = new Map(),
): GraphWorkflow {
  const steps = new Map<string, GraphWorkflowStep>();

  for (const s of def.steps) {
    const step: GraphWorkflowStep = {
      id: s.id,
      name: s.name ?? s.id,
      type: s.type,
      next: s.next,
      onTrue: s.onTrue,
      onFalse: s.onFalse,
      parallel: s.parallel,
      loopBody: s.loopBody,
      maxIterations: s.maxIterations,
      retryCount: s.retryCount,
      retryDelay: s.retryDelay,
      timeout: s.timeout,
      onError: s.onError,
    };

    if (s.type === 'action') {
      step.action = actionMap.get(s.id);
    }
    if (s.type === 'condition') {
      step.condition = conditionMap.get(s.id);
    }

    steps.set(s.id, step);
  }

  const entryPoint = def.steps[0]?.id ?? '';

  return { name: def.name, entryPoint, steps };
}
