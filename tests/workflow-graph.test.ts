import { describe, it, expect } from 'vitest';
import {
  GraphWorkflowEngine,
  WorkflowBuilder,
  parseOADWorkflow,
  type WorkflowContext,
  type GraphWorkflow,
  type GraphWorkflowStep,
} from '../src/core/workflow-graph';

function buildSimpleWorkflow(steps: Map<string, GraphWorkflowStep>, entry: string): GraphWorkflow {
  return { name: 'test', entryPoint: entry, steps };
}

describe('GraphWorkflowEngine', () => {
  const engine = new GraphWorkflowEngine();

  it('executes a simple linear workflow', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('linear')
      .start('a')
      .addAction('a', async (ctx) => { log.push('a'); ctx.variables.set('x', 1); return 'done-a'; }, { next: 'b' })
      .addAction('b', async (ctx) => { log.push('b'); return 'done-b'; }, { next: 'c' })
      .addAction('c', async () => { log.push('c'); })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('completed');
    expect(log).toEqual(['a', 'b', 'c']);
    expect(result.context.results.get('a')).toBe('done-a');
  });

  it('condition branches to onTrue', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('cond-true')
      .start('check')
      .addCondition('check', () => true, 'yes', 'no')
      .addAction('yes', async () => { log.push('yes'); })
      .addAction('no', async () => { log.push('no'); })
      .build();

    await engine.execute(wf);
    expect(log).toEqual(['yes']);
  });

  it('condition branches to onFalse', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('cond-false')
      .start('check')
      .addCondition('check', () => false, 'yes', 'no')
      .addAction('yes', async () => { log.push('yes'); })
      .addAction('no', async () => { log.push('no'); })
      .build();

    await engine.execute(wf);
    expect(log).toEqual(['no']);
  });

  it('condition uses context variables', async () => {
    const wf = new WorkflowBuilder()
      .name('cond-ctx')
      .start('init')
      .addAction('init', async (ctx) => { ctx.variables.set('flag', true); }, { next: 'check' })
      .addCondition('check', (ctx) => ctx.variables.get('flag') === true, 'pass', 'fail')
      .addAction('pass', async () => 'passed')
      .addAction('fail', async () => 'failed')
      .build();

    const result = await engine.execute(wf);
    expect(result.context.results.get('pass')).toBe('passed');
  });

  it('parallel executes all steps', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('par')
      .start('p')
      .addAction('a', async () => { log.push('a'); })
      .addAction('b', async () => { log.push('b'); })
      .addParallel('p', ['a', 'b'], 'done')
      .addAction('done', async () => { log.push('done'); })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('completed');
    expect(log).toContain('a');
    expect(log).toContain('b');
    expect(log).toContain('done');
  });

  it('loop iterates correct number of times', async () => {
    let count = 0;
    const wf = new WorkflowBuilder()
      .name('loop')
      .start('init')
      .addAction('init', async (ctx) => { ctx.variables.set('i', 0); }, { next: 'loop' })
      .addAction('body', async (ctx) => {
        const i = ctx.variables.get('i');
        ctx.variables.set('i', i + 1);
        count++;
      })
      .addLoop('loop', (ctx) => (ctx.variables.get('i') ?? 0) < 5, 'body')
      .build();

    await engine.execute(wf);
    expect(count).toBe(5);
  });

  it('loop respects maxIterations', async () => {
    let count = 0;
    const wf = new WorkflowBuilder()
      .name('loop-max')
      .start('loop')
      .addAction('body', async () => { count++; })
      .addLoop('loop', () => true, 'body', { maxIterations: 3 })
      .build();

    await engine.execute(wf);
    expect(count).toBe(3);
  });

  it('retries on failure then succeeds', async () => {
    let attempts = 0;
    const wf = new WorkflowBuilder()
      .name('retry-ok')
      .start('flaky')
      .addAction('flaky', async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      }, { retryCount: 3, retryDelay: 1 })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('completed');
    expect(attempts).toBe(3);
    expect(result.context.results.get('flaky')).toBe('ok');
  });

  it('retry exhaustion records error', async () => {
    const wf = new WorkflowBuilder()
      .name('retry-fail')
      .start('bad')
      .addAction('bad', async () => { throw new Error('always-fail'); }, { retryCount: 2, retryDelay: 1, onError: 'stop' })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('failed');
    expect(result.context.errors).toHaveLength(1);
    expect(result.context.errors[0].step).toBe('bad');
  });

  it('timeout kills slow step', async () => {
    const wf = new WorkflowBuilder()
      .name('timeout')
      .start('slow')
      .addAction('slow', async () => {
        await new Promise(r => setTimeout(r, 5000));
      }, { timeout: 50, onError: 'stop' })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('failed');
    expect(result.context.errors[0].error.message).toContain('Timeout');
  });

  it('onError skip continues to next step', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('skip')
      .start('bad')
      .addAction('bad', async () => { throw new Error('oops'); }, { onError: 'skip', next: 'good' })
      .addAction('good', async () => { log.push('good'); })
      .build();

    const result = await engine.execute(wf);
    // skip doesn't add to errors, doesn't throw
    expect(log).toEqual(['good']);
    expect(result.status).toBe('completed');
  });

  it('onError stop halts execution', async () => {
    const log: string[] = [];
    const wf = new WorkflowBuilder()
      .name('stop')
      .start('bad')
      .addAction('bad', async () => { throw new Error('halt'); }, { onError: 'stop', next: 'after' })
      .addAction('after', async () => { log.push('after'); })
      .build();

    const result = await engine.execute(wf);
    expect(result.status).toBe('failed');
    expect(log).toEqual([]);
  });

  it('WorkflowBuilder creates valid workflow', () => {
    const wf = new WorkflowBuilder()
      .name('builder-test')
      .start('s1')
      .addAction('s1', async () => 'ok', { next: 's2' })
      .addAction('s2', async () => 'done')
      .build();

    expect(wf.name).toBe('builder-test');
    expect(wf.entryPoint).toBe('s1');
    expect(wf.steps.size).toBe(2);
    expect(wf.steps.get('s1')?.next).toBe('s2');
  });

  it('WorkflowBuilder throws without start', () => {
    expect(() => new WorkflowBuilder().addAction('a', async () => {}).build())
      .toThrow('entry point');
  });

  it('context variables persist across steps', async () => {
    const wf = new WorkflowBuilder()
      .name('persist')
      .start('a')
      .addAction('a', async (ctx) => { ctx.variables.set('msg', 'hello'); }, { next: 'b' })
      .addAction('b', async (ctx) => {
        return ctx.variables.get('msg') + ' world';
      })
      .build();

    const result = await engine.execute(wf);
    expect(result.context.results.get('b')).toBe('hello world');
  });

  it('parseOADWorkflow creates valid graph workflow', () => {
    const def = {
      name: 'onboarding',
      steps: [
        { id: 'greet', type: 'action' as const, next: 'check' },
        { id: 'check', type: 'condition' as const, onTrue: 'existing', onFalse: 'new' },
        { id: 'existing', type: 'action' as const, next: 'done' },
        { id: 'new', type: 'action' as const, next: 'done' },
        { id: 'done', type: 'action' as const },
      ],
    };

    const actionMap = new Map<string, (ctx: WorkflowContext) => Promise<any>>();
    actionMap.set('greet', async () => 'hi');
    actionMap.set('existing', async () => 'welcome back');
    actionMap.set('new', async () => 'welcome');
    actionMap.set('done', async () => 'bye');

    const condMap = new Map<string, (ctx: WorkflowContext) => boolean>();
    condMap.set('check', () => true);

    const wf = parseOADWorkflow(def, actionMap, condMap);
    expect(wf.name).toBe('onboarding');
    expect(wf.entryPoint).toBe('greet');
    expect(wf.steps.size).toBe(5);
    expect(wf.steps.get('check')?.type).toBe('condition');
  });

  it('parseOADWorkflow executes correctly', async () => {
    const def = {
      name: 'flow',
      steps: [
        { id: 's1', type: 'action' as const, next: 's2' },
        { id: 's2', type: 'action' as const },
      ],
    };

    const log: string[] = [];
    const actionMap = new Map<string, (ctx: WorkflowContext) => Promise<any>>();
    actionMap.set('s1', async () => { log.push('s1'); });
    actionMap.set('s2', async () => { log.push('s2'); });

    const wf = parseOADWorkflow(def, actionMap);
    const result = await engine.execute(wf);
    expect(result.status).toBe('completed');
    expect(log).toEqual(['s1', 's2']);
  });
});
