import type { MCPTool, MCPToolResult } from '../mcp';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TEXT_LENGTH = 5000;

export class BrowserManager {
  private browser: any = null;
  private page: any = null;
  private lastActivity: number = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private playwrightFactory: (() => any) | null;

  constructor(playwrightFactory?: () => any) {
    this.playwrightFactory = playwrightFactory || null;
  }

  private resetIdleTimer(): void {
    this.lastActivity = Date.now();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), IDLE_TIMEOUT_MS);
  }

  async ensureBrowser(): Promise<any> {
    if (!this.browser) {
      let playwright: any;
      if (this.playwrightFactory) {
        playwright = this.playwrightFactory();
      } else {
        try {
          playwright = require('playwright');
        } catch {
          throw new Error('Install playwright: npm i playwright');
        }
      }
      this.browser = await playwright.chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
    this.resetIdleTimer();
    return this.page;
  }

  async navigate(url: string): Promise<{ title: string; text: string; url: string }> {
    const page = await this.ensureBrowser();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    const text = (await page.innerText('body')).slice(0, MAX_TEXT_LENGTH);
    return { title, text, url: page.url() };
  }

  async click(selector: string): Promise<void> {
    const page = await this.ensureBrowser();
    await page.click(selector, { timeout: 10000 });
  }

  async type(selector: string, text: string): Promise<void> {
    const page = await this.ensureBrowser();
    await page.fill(selector, text, { timeout: 10000 });
  }

  async screenshot(): Promise<string> {
    const page = await this.ensureBrowser();
    const buffer = await page.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  async extract(): Promise<{ text: string; links: string[]; images: string[] }> {
    const page = await this.ensureBrowser();
    const text = (await page.innerText('body')).slice(0, MAX_TEXT_LENGTH);
    const links: string[] = await page.$$eval('a[href]', (els: any[]) => els.map((e: any) => e.href).slice(0, 100));
    const images: string[] = await page.$$eval('img[src]', (els: any[]) => els.map((e: any) => e.src).slice(0, 100));
    return { text, links, images };
  }

  async scroll(direction: 'up' | 'down', amount?: number): Promise<void> {
    const page = await this.ensureBrowser();
    const delta = amount || 500;
    const scrollScript = direction === 'down'
      ? `window.scrollBy(0, ${delta})`
      : `window.scrollBy(0, -${delta})`;
    await page.evaluate(scrollScript);
  }

  async back(): Promise<void> {
    const page = await this.ensureBrowser();
    await page.goBack({ timeout: 10000 });
  }

  async evaluate(script: string): Promise<any> {
    const page = await this.ensureBrowser();
    return await page.evaluate(script);
  }

  async getImages(): Promise<Array<{ src: string; alt: string }>> {
    const page = await this.ensureBrowser();
    return await page.$$eval('img', (els: any[]) =>
      els.map((e: any) => ({ src: e.src, alt: e.alt || '' })).slice(0, 200)
    );
  }

  async waitFor(selector: string, timeout?: number): Promise<boolean> {
    const page = await this.ensureBrowser();
    try {
      await page.waitForSelector(selector, { timeout: timeout || 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
      this.page = null;
    }
  }
}

// Singleton
const browserManager = new BrowserManager();

function wrapTool(fn: () => Promise<MCPToolResult>): Promise<MCPToolResult> {
  return fn().catch((err: any) => ({
    content: `Browser error: ${err instanceof Error ? err.message : String(err)}`,
    isError: true,
  }));
}

export const browserNavigateTool: MCPTool = {
  name: 'browser_navigate',
  description: 'Navigate to a URL and return page title + text content (truncated)',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
    },
    required: ['url'],
  },
  execute: (input) => wrapTool(async () => {
    const url = input.url as string;
    if (!url) return { content: 'Missing required parameter: url', isError: true };
    const result = await browserManager.navigate(url);
    return { content: `Title: ${result.title}\nURL: ${result.url}\n\n${result.text}`, isError: false };
  }),
};

export const browserClickTool: MCPTool = {
  name: 'browser_click',
  description: 'Click an element by CSS selector',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of element to click' },
    },
    required: ['selector'],
  },
  execute: (input) => wrapTool(async () => {
    const selector = input.selector as string;
    if (!selector) return { content: 'Missing required parameter: selector', isError: true };
    await browserManager.click(selector);
    return { content: `Clicked: ${selector}`, isError: false };
  }),
};

export const browserTypeTool: MCPTool = {
  name: 'browser_type',
  description: 'Type text into an element by CSS selector',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of input element' },
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['selector', 'text'],
  },
  execute: (input) => wrapTool(async () => {
    const selector = input.selector as string;
    const text = input.text as string;
    if (!selector || text === undefined) return { content: 'Missing required parameters: selector, text', isError: true };
    await browserManager.type(selector, text);
    return { content: `Typed into ${selector}`, isError: false };
  }),
};

export const browserScreenshotTool: MCPTool = {
  name: 'browser_screenshot',
  description: 'Take a screenshot of the current page, returned as base64 PNG',
  inputSchema: { type: 'object', properties: {} },
  execute: () => wrapTool(async () => {
    const base64 = await browserManager.screenshot();
    return { content: base64, isError: false, metadata: { encoding: 'base64', mimeType: 'image/png' } };
  }),
};

export const browserExtractTool: MCPTool = {
  name: 'browser_extract',
  description: 'Extract text, links, and images from the current page',
  inputSchema: { type: 'object', properties: {} },
  execute: () => wrapTool(async () => {
    const data = await browserManager.extract();
    return { content: JSON.stringify(data, null, 2), isError: false };
  }),
};

export const browserScrollTool: MCPTool = {
  name: 'browser_scroll',
  description: 'Scroll the page up or down',
  inputSchema: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
      amount: { type: 'number', description: 'Pixels to scroll (default 500)' },
    },
    required: ['direction'],
  },
  execute: (input) => wrapTool(async () => {
    const direction = input.direction as 'up' | 'down';
    if (!direction) return { content: 'Missing required parameter: direction', isError: true };
    await browserManager.scroll(direction, input.amount as number | undefined);
    return { content: `Scrolled ${direction}`, isError: false };
  }),
};

export const browserBackTool: MCPTool = {
  name: 'browser_back',
  description: 'Navigate back in browser history',
  inputSchema: { type: 'object', properties: {} },
  execute: () => wrapTool(async () => {
    await browserManager.back();
    return { content: 'Navigated back', isError: false };
  }),
};

export const browserEvalTool: MCPTool = {
  name: 'browser_eval',
  description: 'Execute JavaScript in the page context',
  inputSchema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'JavaScript to execute' },
    },
    required: ['script'],
  },
  execute: (input) => wrapTool(async () => {
    const script = input.script as string;
    if (!script) return { content: 'Missing required parameter: script', isError: true };
    const result = await browserManager.evaluate(script);
    return { content: typeof result === 'string' ? result : JSON.stringify(result, null, 2), isError: false };
  }),
};

export const browserGetImagesTool: MCPTool = {
  name: 'browser_get_images',
  description: 'List all images on the current page with src and alt attributes',
  inputSchema: { type: 'object', properties: {} },
  execute: () => wrapTool(async () => {
    const images = await browserManager.getImages();
    return { content: JSON.stringify(images, null, 2), isError: false };
  }),
};

export const browserWaitTool: MCPTool = {
  name: 'browser_wait',
  description: 'Wait for a CSS selector to appear on the page',
  inputSchema: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector to wait for' },
      timeout: { type: 'number', description: 'Max wait time in ms (default 5000)' },
    },
    required: ['selector'],
  },
  execute: (input) => wrapTool(async () => {
    const selector = input.selector as string;
    if (!selector) return { content: 'Missing required parameter: selector', isError: true };
    const found = await browserManager.waitFor(selector, input.timeout as number | undefined);
    return { content: found ? `Found: ${selector}` : `Timeout waiting for: ${selector}`, isError: !found };
  }),
};

export const browserTools: MCPTool[] = [
  browserNavigateTool,
  browserClickTool,
  browserTypeTool,
  browserScreenshotTool,
  browserExtractTool,
  browserScrollTool,
  browserBackTool,
  browserEvalTool,
  browserGetImagesTool,
  browserWaitTool,
];

export { browserManager };
