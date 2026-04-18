/**
 * Agent Evaluation Framework — rule-based scoring with optional LLM-as-judge.
 * Zero external dependencies.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EvalCase {
  id: string;
  input: string;
  expectedOutput?: string;
  expectedContains?: string[];
  expectedNotContains?: string[];
  rubric?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EvalResult {
  caseId: string;
  input: string;
  output: string;
  scores: {
    exact_match?: number;
    contains?: number;
    not_contains?: number;
    rubric_score?: number;
    latency_ms: number;
    token_count?: number;
  };
  passed: boolean;
  error?: string;
}

export interface EvalSuite {
  name: string;
  description?: string;
  cases: EvalCase[];
}

export interface EvalReport {
  suite: string;
  timestamp: string;
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgLatency: number;
  p95Latency: number;
  results: EvalResult[];
  summary: string;
}

// ─── Scoring helpers ────────────────────────────────────────────────────────

function scoreExactMatch(output: string, expected: string): number {
  return output.trim().toLowerCase() === expected.trim().toLowerCase() ? 1 : 0;
}

function scoreContains(output: string, expected: string[]): number {
  if (!expected.length) return 1;
  const lower = output.toLowerCase();
  const matched = expected.filter(e => lower.includes(e.toLowerCase())).length;
  return matched / expected.length;
}

function scoreNotContains(output: string, forbidden: string[]): number {
  if (!forbidden.length) return 1;
  const lower = output.toLowerCase();
  const clean = forbidden.filter(f => !lower.includes(f.toLowerCase())).length;
  return clean / forbidden.length;
}

function computeP95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Evaluator ──────────────────────────────────────────────────────────────

export class AgentEvaluator {
  constructor(private agent: any) {}

  async evalCase(evalCase: EvalCase): Promise<EvalResult> {
    const start = Date.now();
    let output = '';
    let error: string | undefined;

    try {
      // Agent must expose a chat / processMessage style method
      if (typeof this.agent.chat === 'function') {
        output = await this.agent.chat(evalCase.input);
      } else if (typeof this.agent.processMessage === 'function') {
        const resp = await this.agent.processMessage({ role: 'user', content: evalCase.input });
        output = typeof resp === 'string' ? resp : resp?.content ?? JSON.stringify(resp);
      } else {
        throw new Error('Agent must implement chat() or processMessage()');
      }
    } catch (e: any) {
      error = e.message;
      output = '';
    }

    const latency_ms = Date.now() - start;
    const scores: EvalResult['scores'] = { latency_ms };

    if (evalCase.expectedOutput !== undefined) {
      scores.exact_match = scoreExactMatch(output, evalCase.expectedOutput);
    }
    if (evalCase.expectedContains?.length) {
      scores.contains = scoreContains(output, evalCase.expectedContains);
    }
    if (evalCase.expectedNotContains?.length) {
      scores.not_contains = scoreNotContains(output, evalCase.expectedNotContains);
    }

    // Determine pass: all defined rule-based scores must be >= threshold (1.0 for exact, 0.5 for partial)
    let passed = !error;
    if (passed && scores.exact_match !== undefined && scores.exact_match < 1) passed = false;
    if (passed && scores.contains !== undefined && scores.contains < 0.5) passed = false;
    if (passed && scores.not_contains !== undefined && scores.not_contains < 0.5) passed = false;

    return { caseId: evalCase.id, input: evalCase.input, output, scores, passed, error };
  }

  async evalSuite(suite: EvalSuite): Promise<EvalReport> {
    const results: EvalResult[] = [];
    for (const c of suite.cases) {
      results.push(await this.evalCase(c));
    }

    const latencies = results.map(r => r.scores.latency_ms);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    return {
      suite: suite.name,
      timestamp: new Date().toISOString(),
      totalCases: total,
      passed,
      failed: total - passed,
      passRate: total ? passed / total : 0,
      avgLatency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95Latency: computeP95(latencies),
      results,
      summary: `${suite.name}: ${passed}/${total} passed (${total ? Math.round(passed / total * 100) : 0}%)`,
    };
  }

  static loadSuite(filePath: string): EvalSuite {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as EvalSuite;
  }

  static saveReport(report: EvalReport, filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }

  static compare(baseline: EvalReport, current: EvalReport): {
    improved: string[];
    regressed: string[];
    unchanged: string[];
    baselinePassRate: number;
    currentPassRate: number;
    delta: number;
  } {
    const baseMap = new Map(baseline.results.map(r => [r.caseId, r.passed]));
    const improved: string[] = [];
    const regressed: string[] = [];
    const unchanged: string[] = [];

    for (const r of current.results) {
      const prev = baseMap.get(r.caseId);
      if (prev === undefined) { unchanged.push(r.caseId); continue; }
      if (!prev && r.passed) improved.push(r.caseId);
      else if (prev && !r.passed) regressed.push(r.caseId);
      else unchanged.push(r.caseId);
    }

    return {
      improved,
      regressed,
      unchanged,
      baselinePassRate: baseline.passRate,
      currentPassRate: current.passRate,
      delta: current.passRate - baseline.passRate,
    };
  }

  static builtinSuites(): { name: string; description: string; caseCount: number }[] {
    const suitesDir = path.join(__dirname, 'suites');
    if (!fs.existsSync(suitesDir)) return [];
    return fs.readdirSync(suitesDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const suite = JSON.parse(fs.readFileSync(path.join(suitesDir, f), 'utf-8')) as EvalSuite;
        return { name: suite.name, description: suite.description || '', caseCount: suite.cases.length };
      });
  }

  static loadBuiltinSuite(name: string): EvalSuite {
    const filePath = path.join(__dirname, 'suites', `${name}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Built-in suite '${name}' not found`);
    return AgentEvaluator.loadSuite(filePath);
  }
}
