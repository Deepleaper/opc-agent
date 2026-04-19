/**
 * Web Search & Read Built-in Tools - v0.10.0
 * Registers web_search and web_read as agent-callable tools.
 */

import type { MCPTool, MCPToolResult } from '../mcp';
import { webSearch, DEFAULT_SEARCH_CONFIG, type WebSearchConfig, type SearchEngine } from '../web-search';
import { scrapeUrl } from '../web-scraper';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

function loadSearchConfig(): WebSearchConfig {
  try {
    const cfgPath = join(os.homedir(), '.opc', 'config.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
      if (cfg.webSearch) {
        return { ...DEFAULT_SEARCH_CONFIG, ...cfg.webSearch };
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SEARCH_CONFIG;
}

export const webSearchTool: MCPTool = {
  name: 'web_search',
  description: 'Search the internet for information. Returns titles, URLs, and snippets from search results. Use when you need current information or facts you\'re unsure about.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
      engine: {
        type: 'string',
        enum: ['duckduckgo', 'brave', 'searxng', 'google'],
        description: 'Search engine to use (default: configured engine)',
      },
    },
    required: ['query'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const query = String(input.query ?? '');
    if (!query.trim()) {
      return { content: 'Error: empty search query', isError: true };
    }

    const config = loadSearchConfig();
    if (!config.enabled) {
      return { content: 'Web search is disabled in settings.', isError: true };
    }

    try {
      const results = await webSearch(query, config, {
        maxResults: (input.maxResults as number) || 5,
        engine: input.engine as SearchEngine | undefined,
      });

      if (results.length === 0) {
        return { content: `No results found for: ${query}` };
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n');

      return {
        content: `Search results for "${query}":\n\n${formatted}`,
        metadata: { resultCount: results.length, query },
      };
    } catch (err) {
      return {
        content: `Search error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};

export const webReadTool: MCPTool = {
  name: 'web_read',
  description: 'Read and extract the main content from a web page URL. Returns clean markdown text. Use to get detailed information from a specific page.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the web page to read',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum content length in characters (default: 5000)',
      },
    },
    required: ['url'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const url = String(input.url ?? '');
    if (!url.trim()) {
      return { content: 'Error: empty URL', isError: true };
    }

    try {
      const result = await scrapeUrl(url, (input.maxLength as number) || 5000);
      return {
        content: `# ${result.title}\n\nSource: ${result.url}\nWords: ${result.wordCount}\n\n---\n\n${result.content}`,
        metadata: { title: result.title, url: result.url, wordCount: result.wordCount },
      };
    } catch (err) {
      return {
        content: `Scrape error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  },
};

export const webSearchTools: MCPTool[] = [webSearchTool, webReadTool];
