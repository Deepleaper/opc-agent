import { describe, it, expect } from 'vitest';
import { parseDuckDuckGoHTML, DEFAULT_SEARCH_CONFIG, webSearch } from '../src/tools/web-search';
import { extractReadableContent } from '../src/tools/web-scraper';

describe('Web Search - DuckDuckGo HTML Parser', () => {
  const mockDDGHTML = `
    <html><body>
      <div class="result__body">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1">Example Page One</a>
        <a class="result__snippet">This is the first result snippet about example.</a>
      </div>
      <div class="result__body">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fpage2">Example &amp; Page Two</a>
        <a class="result__snippet">Second result with <b>bold</b> text.</a>
      </div>
      <div class="result__body">
        <a class="result__a" href="https://direct-url.com/page3">Direct URL Page</a>
        <a class="result__snippet">Third result snippet.</a>
      </div>
    </body></html>
  `;

  it('should parse search results from DuckDuckGo HTML', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results.length).toBe(3);
  });

  it('should extract title and URL correctly', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results[0].title).toBe('Example Page One');
    expect(results[0].url).toBe('https://example.com/page1');
  });

  it('should decode uddg redirect URLs', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results[0].url).toBe('https://example.com/page1');
    expect(results[1].url).toBe('https://example.org/page2');
  });

  it('should handle direct URLs without uddg', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results[2].url).toBe('https://direct-url.com/page3');
  });

  it('should extract snippets and strip HTML', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results[0].snippet).toBe('This is the first result snippet about example.');
    expect(results[1].snippet).toBe('Second result with bold text.');
  });

  it('should decode HTML entities in titles', () => {
    const results = parseDuckDuckGoHTML(mockDDGHTML);
    expect(results[1].title).toBe('Example & Page Two');
  });

  it('should return empty array for empty HTML', () => {
    expect(parseDuckDuckGoHTML('')).toEqual([]);
    expect(parseDuckDuckGoHTML('<html><body></body></html>')).toEqual([]);
  });

  it('should have correct default config', () => {
    expect(DEFAULT_SEARCH_CONFIG.defaultEngine).toBe('duckduckgo');
    expect(DEFAULT_SEARCH_CONFIG.enabled).toBe(true);
  });
});

describe('Web Scraper - Content Extraction', () => {
  it('should extract title from HTML', () => {
    const html = '<html><head><title>Test Page</title></head><body><p>Hello world</p></body></html>';
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.title).toBe('Test Page');
  });

  it('should extract content and convert to markdown', () => {
    const html = `
      <html><head><title>Test</title></head><body>
        <article>
          <h1>Main Title</h1>
          <p>This is a <strong>bold</strong> paragraph.</p>
          <p>Second paragraph with <a href="https://link.com">a link</a>.</p>
        </article>
      </body></html>
    `;
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.content).toContain('# Main Title');
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('[a link](https://link.com)');
  });

  it('should remove script and style tags', () => {
    const html = `
      <html><head><title>Test</title></head><body>
        <script>alert('xss')</script>
        <style>.hidden { display: none; }</style>
        <p>Visible content</p>
      </body></html>
    `;
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.content).not.toContain('alert');
    expect(result.content).not.toContain('.hidden');
    expect(result.content).toContain('Visible content');
  });

  it('should remove nav and footer', () => {
    const html = `
      <html><head><title>Test</title></head><body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <main><p>Main content here</p></main>
        <footer>Copyright 2024</footer>
      </body></html>
    `;
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.content).toContain('Main content here');
  });

  it('should truncate content at maxLength', () => {
    const longContent = '<html><head><title>Test</title></head><body><p>' + 'a'.repeat(10000) + '</p></body></html>';
    const result = extractReadableContent(longContent, 'https://example.com', 100);
    expect(result.content.length).toBeLessThanOrEqual(120); // 100 + truncation message
    expect(result.content).toContain('[truncated]');
  });

  it('should track word count', () => {
    const html = '<html><head><title>Test</title></head><body><p>One two three four five</p></body></html>';
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('should use URL as title when no title tag', () => {
    const html = '<html><body><p>No title page</p></body></html>';
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.title).toBe('https://example.com');
  });

  it('should decode HTML entities', () => {
    const html = '<html><head><title>Test &amp; Page</title></head><body><p>Content with &lt;brackets&gt; and &quot;quotes&quot;</p></body></html>';
    const result = extractReadableContent(html, 'https://example.com');
    expect(result.title).toBe('Test & Page');
    expect(result.content).toContain('<brackets>');
  });
});

describe('Web Search Config', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_SEARCH_CONFIG.enabled).toBe(true);
    expect(DEFAULT_SEARCH_CONFIG.defaultEngine).toBe('duckduckgo');
    expect(DEFAULT_SEARCH_CONFIG.engines.duckduckgo?.enabled).toBe(true);
  });

  it('should return empty when disabled', async () => {
    const config = { ...DEFAULT_SEARCH_CONFIG, enabled: false };
    const results = await webSearch('test', config);
    expect(results).toEqual([]);
  });
});
