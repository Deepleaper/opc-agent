import { describe, it, expect } from 'vitest';
import { AgentEvaluator } from '../src/eval';
import type { EvalCase, EvalSuite, EvalReport } from '../src/eval';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock agent
const mockAgent = {
  chat: async (input: string) => {
    if (!input) return 'Hello! How can I help?';
    if (input.includes('capital of France')) return 'The capital of France is Paris.';
    if (input.includes('Hello')) return 'Hello there! How can I help you?';
    return `Response to: ${input}`;
  },
};

describe('AgentEvaluator', () => {
  const evaluator = new AgentEvaluator(mockAgent);

  it('should score exact match correctly', async () => {
    const result = await evaluator.evalCase({
      id: 'test-1',
      input: 'What is the capital of France?',
      expectedOutput: 'The capital of France is Paris.',
    });
    expect(result.scores.exact_match).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('should score exact match failure', async () => {
    const result = await evaluator.evalCase({
      id: 'test-2',
      input: 'Hello!',
      expectedOutput: 'Goodbye!',
    });
    expect(result.scores.exact_match).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('should score contains correctly', async () => {
    const result = await evaluator.evalCase({
      id: 'test-3',
      input: 'What is the capital of France?',
      expectedContains: ['Paris', 'capital'],
    });
    expect(result.scores.contains).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('should score partial contains', async () => {
    const result = await evaluator.evalCase({
      id: 'test-4',
      input: 'What is the capital of France?',
      expectedContains: ['Paris', 'London'],
    });
    expect(result.scores.contains).toBe(0.5);
    expect(result.passed).toBe(true); // 0.5 >= 0.5 threshold
  });

  it('should score not_contains correctly', async () => {
    const result = await evaluator.evalCase({
      id: 'test-5',
      input: 'Hello!',
      expectedNotContains: ['error', 'crash'],
    });
    expect(result.scores.not_contains).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('should score not_contains failure', async () => {
    const result = await evaluator.evalCase({
      id: 'test-6',
      input: 'Hello!',
      expectedNotContains: ['Hello', 'crash'],
    });
    expect(result.scores.not_contains).toBe(0.5);
  });

  it('should load suite from JSON', () => {
    const suitePath = path.join(__dirname, '..', 'src', 'eval', 'suites', 'basic.json');
    const suite = AgentEvaluator.loadSuite(suitePath);
    expect(suite.name).toBe('basic');
    expect(suite.cases.length).toBe(10);
  });

  it('should load all built-in suites', () => {
    const suites = AgentEvaluator.builtinSuites();
    expect(suites.length).toBeGreaterThanOrEqual(3);
    const names = suites.map(s => s.name);
    expect(names).toContain('basic');
    expect(names).toContain('safety');
    expect(names).toContain('memory');
  });

  it('should have correct case counts for built-in suites', () => {
    const suites = AgentEvaluator.builtinSuites();
    const basic = suites.find(s => s.name === 'basic');
    const safety = suites.find(s => s.name === 'safety');
    const memory = suites.find(s => s.name === 'memory');
    expect(basic?.caseCount).toBe(10);
    expect(safety?.caseCount).toBe(8);
    expect(memory?.caseCount).toBe(6);
  });

  it('should compare reports and detect regression', () => {
    const baseline: EvalReport = {
      suite: 'test', timestamp: '', totalCases: 2, passed: 2, failed: 0, passRate: 1, avgLatency: 10, p95Latency: 15, summary: '',
      results: [
        { caseId: 'a', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
        { caseId: 'b', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
      ],
    };
    const current: EvalReport = {
      suite: 'test', timestamp: '', totalCases: 2, passed: 1, failed: 1, passRate: 0.5, avgLatency: 10, p95Latency: 15, summary: '',
      results: [
        { caseId: 'a', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
        { caseId: 'b', input: '', output: '', scores: { latency_ms: 10 }, passed: false },
      ],
    };
    const cmp = AgentEvaluator.compare(baseline, current);
    expect(cmp.regressed).toContain('b');
    expect(cmp.delta).toBe(-0.5);
  });

  it('should compare reports and detect improvement', () => {
    const baseline: EvalReport = {
      suite: 'test', timestamp: '', totalCases: 2, passed: 1, failed: 1, passRate: 0.5, avgLatency: 10, p95Latency: 15, summary: '',
      results: [
        { caseId: 'a', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
        { caseId: 'b', input: '', output: '', scores: { latency_ms: 10 }, passed: false },
      ],
    };
    const current: EvalReport = {
      suite: 'test', timestamp: '', totalCases: 2, passed: 2, failed: 0, passRate: 1, avgLatency: 10, p95Latency: 15, summary: '',
      results: [
        { caseId: 'a', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
        { caseId: 'b', input: '', output: '', scores: { latency_ms: 10 }, passed: true },
      ],
    };
    const cmp = AgentEvaluator.compare(baseline, current);
    expect(cmp.improved).toContain('b');
    expect(cmp.delta).toBe(0.5);
  });

  it('should save and load report', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-'));
    const reportPath = path.join(tmpDir, 'report.json');
    const report: EvalReport = {
      suite: 'test', timestamp: new Date().toISOString(), totalCases: 1, passed: 1, failed: 0, passRate: 1, avgLatency: 5, p95Latency: 5, summary: 'ok',
      results: [{ caseId: 'x', input: 'hi', output: 'hello', scores: { latency_ms: 5 }, passed: true }],
    };
    AgentEvaluator.saveReport(report, reportPath);
    const loaded = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    expect(loaded.suite).toBe('test');
    expect(loaded.results.length).toBe(1);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should run evalSuite and produce report', async () => {
    const suite: EvalSuite = {
      name: 'mini',
      cases: [
        { id: 't1', input: 'Hello!', expectedContains: ['hello', 'hi'] },
        { id: 't2', input: 'What is the capital of France?', expectedContains: ['Paris'] },
      ],
    };
    const report = await evaluator.evalSuite(suite);
    expect(report.totalCases).toBe(2);
    expect(report.passRate).toBeGreaterThanOrEqual(0);
    expect(report.summary).toContain('mini');
  });
});
