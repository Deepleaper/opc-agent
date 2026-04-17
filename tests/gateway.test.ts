import { describe, it, expect, vi } from 'vitest';
import { ToolGateway } from '../src/tools/gateway';
import type { ToolGatewayConfig } from '../src/tools/gateway';

const baseConfig: ToolGatewayConfig = {
  enabled: true,
  endpoint: 'https://gateway.example.com',
  apiKey: 'test-key',
};

describe('ToolGateway', () => {
  it('should load default tools when connect fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const gw = new ToolGateway(baseConfig);
    await gw.connect();
    expect(gw.isConnected).toBe(false);
    expect(gw.toolCount).toBe(4);
    expect(gw.listTools().map((t) => t.name)).toContain('gateway:web-search');
    vi.unstubAllGlobals();
  });

  it('should filter tools by enabledTools config', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const gw = new ToolGateway({ ...baseConfig, enabledTools: ['web-search', 'tts'] });
    await gw.connect();
    expect(gw.toolCount).toBe(2);
    vi.unstubAllGlobals();
  });

  it('should parse gateway discovery response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tools: [
          { name: 'web-search', description: 'Search', inputSchema: {}, available: true },
        ],
      }),
    }));
    const gw = new ToolGateway(baseConfig);
    await gw.connect();
    expect(gw.isConnected).toBe(true);
    expect(gw.toolCount).toBe(1);
    vi.unstubAllGlobals();
  });

  it('should return MCPTool instances from getTools()', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const gw = new ToolGateway(baseConfig);
    await gw.connect();
    const tools = gw.getTools();
    expect(tools.length).toBe(4);
    expect(tools[0]).toHaveProperty('execute');
    expect(tools[0]).toHaveProperty('name');
    vi.unstubAllGlobals();
  });

  it('should handle invoke errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const gw = new ToolGateway(baseConfig);
    const result = await gw.invokeTool('web-search', { query: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('timeout');
    vi.unstubAllGlobals();
  });

  it('should not discover tools when disabled', async () => {
    const gw = new ToolGateway({ ...baseConfig, enabled: false });
    await gw.connect();
    expect(gw.toolCount).toBe(0);
  });
});
