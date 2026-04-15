/**
 * Agent Testing Framework - Define test cases in OAD, run with `opc test`.
 * Supports assertions on response content, tool calls, and latency.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AgentRuntime } from '../core/runtime';

export interface TestCase {
  name: string;
  input: string;
  expect?: {
    contains?: string[];
    notContains?: string[];
    toolCalled?: string[];
    maxLatencyMs?: number;
  };
}

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  response?: string;
  failures: string[];
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

/**
 * Load test cases from OAD spec.testing or a separate test file.
 */
export function loadTestCases(oadPath: string): TestCase[] {
  const raw = fs.readFileSync(oadPath, 'utf-8');
  const config = yaml.load(raw) as any;

  // Check spec.testing.cases
  if (config?.spec?.testing?.cases) {
    return config.spec.testing.cases;
  }

  // Check for companion test file
  const dir = path.dirname(oadPath);
  const testFile = path.join(dir, 'tests.yaml');
  if (fs.existsSync(testFile)) {
    const testRaw = fs.readFileSync(testFile, 'utf-8');
    const testConfig = yaml.load(testRaw) as any;
    return testConfig?.cases ?? testConfig ?? [];
  }

  return [];
}

/**
 * Run all test cases against an agent.
 */
export async function runTests(oadPath: string): Promise<TestReport> {
  const cases = loadTestCases(oadPath);
  const results: TestResult[] = [];
  const startTime = Date.now();

  if (cases.length === 0) {
    // Generate default smoke test
    cases.push({
      name: 'smoke-test',
      input: 'Hello! What can you help me with?',
      expect: { maxLatencyMs: 30000 },
    });
  }

  const runtime = new AgentRuntime();
  await runtime.loadConfig(oadPath);
  const agent = await runtime.initialize();

  for (const tc of cases) {
    const result: TestResult = {
      name: tc.name,
      passed: true,
      durationMs: 0,
      failures: [],
    };

    const t0 = Date.now();
    try {
      const response = await agent.handleMessage({
        id: `test_${Date.now()}`,
        role: 'user',
        content: tc.input,
        timestamp: Date.now(),
      });
      result.durationMs = Date.now() - t0;
      result.response = response.content;

      if (tc.expect) {
        // Check contains
        if (tc.expect.contains) {
          for (const s of tc.expect.contains) {
            if (!response.content.toLowerCase().includes(s.toLowerCase())) {
              result.failures.push(`Expected response to contain "${s}"`);
            }
          }
        }
        // Check notContains
        if (tc.expect.notContains) {
          for (const s of tc.expect.notContains) {
            if (response.content.toLowerCase().includes(s.toLowerCase())) {
              result.failures.push(`Expected response NOT to contain "${s}"`);
            }
          }
        }
        // Check latency
        if (tc.expect.maxLatencyMs && result.durationMs > tc.expect.maxLatencyMs) {
          result.failures.push(`Latency ${result.durationMs}ms exceeded max ${tc.expect.maxLatencyMs}ms`);
        }
        // Check tool calls (from metadata if available)
        if (tc.expect.toolCalled && (response as any).toolsCalled) {
          for (const tool of tc.expect.toolCalled) {
            if (!(response as any).toolsCalled.includes(tool)) {
              result.failures.push(`Expected tool "${tool}" to be called`);
            }
          }
        }
      }

      result.passed = result.failures.length === 0;
    } catch (err) {
      result.durationMs = Date.now() - t0;
      result.passed = false;
      result.failures.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    results.push(result);
  }

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    duration: totalDuration,
    results,
  };
}

/**
 * Format test report for console output.
 */
export function formatReport(report: TestReport): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════');
  lines.push('  OPC Agent Test Report');
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  for (const r of report.results) {
    const icon = r.passed ? '✔' : '✘';
    const status = r.passed ? 'PASS' : 'FAIL';
    lines.push(`  ${icon} [${status}] ${r.name} (${r.durationMs}ms)`);
    for (const f of r.failures) {
      lines.push(`      → ${f}`);
    }
  }

  lines.push('');
  lines.push('───────────────────────────────────────────');
  lines.push(`  Total: ${report.total}  Passed: ${report.passed}  Failed: ${report.failed}  Duration: ${report.duration}ms`);
  lines.push('───────────────────────────────────────────');
  lines.push('');

  return lines.join('\n');
}
