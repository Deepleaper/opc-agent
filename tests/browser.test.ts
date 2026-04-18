import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../src/tools/builtin/browser';

// Mock playwright
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  title: vi.fn().mockResolvedValue('Test Page'),
  url: vi.fn().mockReturnValue('https://example.com'),
  innerText: vi.fn().mockResolvedValue('Hello World'),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
  $$eval: vi.fn().mockResolvedValue([]),
  evaluate: vi.fn().mockResolvedValue('result'),
  waitForSelector: vi.fn().mockResolvedValue(true),
  goBack: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockPlaywright = () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
});

describe('BrowserManager', () => {
  let manager: BrowserManager;

  beforeEach(() => {
    manager = new BrowserManager(mockPlaywright);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager.close();
  });

  it('lazy initializes browser on first call', async () => {
    await manager.ensureBrowser();
    expect(mockBrowser.newContext).toHaveBeenCalledOnce();
  });

  it('reuses browser on subsequent calls', async () => {
    await manager.ensureBrowser();
    await manager.ensureBrowser();
    expect(mockBrowser.newContext).toHaveBeenCalledOnce();
  });

  it('navigate returns title, text, url', async () => {
    const result = await manager.navigate('https://example.com');
    expect(result.title).toBe('Test Page');
    expect(result.text).toBe('Hello World');
    expect(result.url).toBe('https://example.com');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('click calls page.click with selector', async () => {
    await manager.click('#btn');
    expect(mockPage.click).toHaveBeenCalledWith('#btn', expect.any(Object));
  });

  it('type calls page.fill', async () => {
    await manager.type('#input', 'hello');
    expect(mockPage.fill).toHaveBeenCalledWith('#input', 'hello', expect.any(Object));
  });

  it('screenshot returns base64', async () => {
    const result = await manager.screenshot();
    expect(typeof result).toBe('string');
    expect(result).toBe(Buffer.from('fake-png').toString('base64'));
  });

  it('extract returns text, links, images', async () => {
    mockPage.$$eval.mockResolvedValueOnce(['https://link1.com']).mockResolvedValueOnce(['img1.png']);
    const result = await manager.extract();
    expect(result.text).toBe('Hello World');
    expect(result.links).toEqual(['https://link1.com']);
    expect(result.images).toEqual(['img1.png']);
  });

  it('scroll calls evaluate with direction', async () => {
    await manager.scroll('down', 300);
    expect(mockPage.evaluate).toHaveBeenCalled();
  });

  it('back calls goBack', async () => {
    await manager.back();
    expect(mockPage.goBack).toHaveBeenCalled();
  });

  it('evaluate runs script', async () => {
    mockPage.evaluate.mockResolvedValueOnce(42);
    const result = await manager.evaluate('1+1');
    expect(result).toBe(42);
  });

  it('getImages calls $$eval', async () => {
    mockPage.$$eval.mockResolvedValueOnce([{ src: 'a.png', alt: 'A' }]);
    const images = await manager.getImages();
    expect(images).toEqual([{ src: 'a.png', alt: 'A' }]);
  });

  it('waitFor returns true when found', async () => {
    const result = await manager.waitFor('.test');
    expect(result).toBe(true);
  });

  it('waitFor returns false on timeout', async () => {
    mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));
    const result = await manager.waitFor('.missing', 100);
    expect(result).toBe(false);
  });

  it('close cleans up browser', async () => {
    await manager.ensureBrowser();
    await manager.close();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('close is safe to call without browser', async () => {
    await manager.close(); // should not throw
  });

  it('throws helpful error when playwright not installed', async () => {
    const noPlaywright = new BrowserManager();
    await expect(noPlaywright.ensureBrowser()).rejects.toThrow('Install playwright: npm i playwright');
  });
});

describe('Browser tool parameter validation', () => {
  it('browser_navigate requires url', async () => {
    const { browserNavigateTool } = await import('../src/tools/builtin/browser');
    const result = await browserNavigateTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('url');
  });

  it('browser_click requires selector', async () => {
    const { browserClickTool } = await import('../src/tools/builtin/browser');
    const result = await browserClickTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('selector');
  });

  it('browser_type requires selector and text', async () => {
    const { browserTypeTool } = await import('../src/tools/builtin/browser');
    const result = await browserTypeTool.execute({});
    expect(result.isError).toBe(true);
  });

  it('browser_eval requires script', async () => {
    const { browserEvalTool } = await import('../src/tools/builtin/browser');
    const result = await browserEvalTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('script');
  });

  it('browser_wait requires selector', async () => {
    const { browserWaitTool } = await import('../src/tools/builtin/browser');
    const result = await browserWaitTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('selector');
  });

  it('browser_scroll requires direction', async () => {
    const { browserScrollTool } = await import('../src/tools/builtin/browser');
    const result = await browserScrollTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('direction');
  });
});
