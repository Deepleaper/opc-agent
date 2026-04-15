import { describe, it, expect } from 'vitest';
import { MCPToolRegistry, createMCPTool } from '../src/tools/mcp';

describe('MCP Tool System', () => {
  it('should register and list tools', () => {
    const registry = new MCPToolRegistry();
    const tool = createMCPTool('calculator', 'Basic calculator', {
      type: 'object',
      properties: { expression: { type: 'string' } },
    }, async (input) => ({ content: `Result: ${input.expression}` }));

    registry.register(tool);
    expect(registry.has('calculator')).toBe(true);
    expect(registry.list().length).toBe(1);
    expect(registry.list()[0].name).toBe('calculator');
  });

  it('should execute a tool', async () => {
    const registry = new MCPToolRegistry();
    registry.register(createMCPTool('echo', 'Echo tool', {}, async (input) => ({
      content: `Echo: ${input.text}`,
    })));

    const result = await registry.execute('echo', { text: 'hello' });
    expect(result.content).toBe('Echo: hello');
    expect(result.isError).toBeUndefined();
  });

  it('should return error for missing tool', async () => {
    const registry = new MCPToolRegistry();
    const result = await registry.execute('nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('not found');
  });

  it('should handle tool execution errors', async () => {
    const registry = new MCPToolRegistry();
    registry.register(createMCPTool('failing', 'Fails', {}, async () => {
      throw new Error('boom');
    }));

    const result = await registry.execute('failing', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });

  it('should unregister tools', () => {
    const registry = new MCPToolRegistry();
    registry.register(createMCPTool('temp', 'Temp', {}, async () => ({ content: '' })));
    expect(registry.has('temp')).toBe(true);
    registry.unregister('temp');
    expect(registry.has('temp')).toBe(false);
  });
});
