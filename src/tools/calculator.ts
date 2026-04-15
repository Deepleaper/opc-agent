import type { MCPTool, MCPToolResult } from './mcp';

/**
 * Calculator Tool — v0.8.0
 * Safe math expression evaluation as an LLM function tool.
 */
export const CalculatorTool: MCPTool = {
  name: 'calculator',
  description: 'Evaluate a mathematical expression. Supports basic arithmetic, powers, sqrt, abs, min, max, round, ceil, floor, PI, E.',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate, e.g. "2 + 3 * 4" or "sqrt(144) + PI"',
      },
    },
    required: ['expression'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const expr = String(input.expression ?? '');
    try {
      const result = safeEval(expr);
      return { content: String(result) };
    } catch (err) {
      return { content: `Error: ${(err as Error).message}`, isError: true };
    }
  },
};

/** Safe math evaluator — no eval(), no arbitrary code */
function safeEval(expr: string): number {
  // Whitelist: digits, operators, parens, dots, commas, spaces, and known functions
  const sanitized = expr.replace(/\s+/g, '');
  const allowed = /^[0-9+\-*/().,%^a-zA-Z_]+$/;
  if (!allowed.test(sanitized)) {
    throw new Error('Invalid characters in expression');
  }

  // Replace known math functions/constants
  const prepared = sanitized
    .replace(/\bPI\b/gi, String(Math.PI))
    .replace(/\bE\b/g, String(Math.E))
    .replace(/\bsqrt\b/gi, 'Math.sqrt')
    .replace(/\babs\b/gi, 'Math.abs')
    .replace(/\bmin\b/gi, 'Math.min')
    .replace(/\bmax\b/gi, 'Math.max')
    .replace(/\bround\b/gi, 'Math.round')
    .replace(/\bceil\b/gi, 'Math.ceil')
    .replace(/\bfloor\b/gi, 'Math.floor')
    .replace(/\bpow\b/gi, 'Math.pow')
    .replace(/\blog\b/gi, 'Math.log')
    .replace(/\blog10\b/gi, 'Math.log10')
    .replace(/\bsin\b/gi, 'Math.sin')
    .replace(/\bcos\b/gi, 'Math.cos')
    .replace(/\btan\b/gi, 'Math.tan')
    .replace(/\^/g, '**');

  // Block anything that isn't math
  if (/[a-zA-Z_]/.test(prepared.replace(/Math\.\w+/g, ''))) {
    throw new Error('Unsupported function or variable in expression');
  }

  // Use Function constructor with restricted scope
  const fn = new Function('Math', `"use strict"; return (${prepared});`);
  const result = fn(Math);

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number');
  }
  return result;
}
