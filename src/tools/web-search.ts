/**
 * Web Search Engine Manager - v0.10.0
 * Supports multiple search backends with automatic fallback.
 * Default: DuckDuckGo (free, no API key required).
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOptions {
  maxResults?: number;
  engine?: SearchEngine;
}

export type SearchEngine = 'duckduckgo' | 'brave' | 'searxng' | 'google';

export interface SearchEngineConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;  // For SearXNG self-hosted
}

export interface WebSearchConfig {
  defaultEngine: SearchEngine;
  enabled: boolean;
  engines: Partial<Record<SearchEngine, SearchEngineConfig>>;
}

export const DEFAULT_SEARCH_CONFIG: WebSearchConfig = {
  defaultEngine: 'duckduckgo',
  enabled: true,
  engines: {
    duckduckgo: { enabled: true },
  },
};

/**
 * Parse DuckDuckGo HTML search results.
 */
export function parseDuckDuckGoHTML(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  // Match result blocks: <a class="result__a" href="...">title</a> ... <a class="result__snippet">snippet</a>
  const resultBlocks = html.split(/class="result__body"/);

  for (let i = 1; i < resultBlocks.length && results.length < 10; i++) {
    const block = resultBlocks[i];

    // Extract URL and title from result__a
    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    let url = linkMatch[1];
    const title = stripHTML(linkMatch[2]).trim();

    // DuckDuckGo wraps URLs in redirect, extract actual URL
    const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    // Extract snippet
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const snippet = snippetMatch ? stripHTML(snippetMatch[1]).trim() : '';

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

/**
 * Search using DuckDuckGo HTML interface (no API key needed).
 */
export async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  return parseDuckDuckGoHTML(html).slice(0, maxResults);
}

/**
 * Search using Brave Search API.
 */
export async function searchBrave(query: string, apiKey: string, maxResults = 5): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const response = await fetch(url, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json() as any;
  return (data.web?.results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
  }));
}

/**
 * Search using SearXNG instance.
 */
export async function searchSearXNG(query: string, baseUrl: string, maxResults = 5): Promise<SearchResult[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await response.json() as any;
  return (data.results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
  }));
}

/**
 * Search using Google Custom Search API.
 */
export async function searchGoogle(query: string, apiKey: string, maxResults = 5): Promise<SearchResult[]> {
  // apiKey format: "key:cx" (API key and Custom Search Engine ID)
  const [key, cx] = apiKey.split(':');
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${key}&cx=${cx}&num=${maxResults}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await response.json() as any;
  return (data.items || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}

/**
 * Unified search function with fallback.
 */
export async function webSearch(query: string, config?: WebSearchConfig, options?: SearchOptions): Promise<SearchResult[]> {
  const cfg = config || DEFAULT_SEARCH_CONFIG;
  if (!cfg.enabled) return [];

  const maxResults = options?.maxResults || 5;
  const engine = options?.engine || cfg.defaultEngine;

  // Try requested engine first, then fallback chain
  const fallbackOrder: SearchEngine[] = [engine, 'duckduckgo', 'brave', 'searxng', 'google']
    .filter((e, i, arr) => arr.indexOf(e) === i) as SearchEngine[];

  for (const eng of fallbackOrder) {
    const engCfg = cfg.engines[eng];
    if (engCfg && !engCfg.enabled) continue;

    try {
      switch (eng) {
        case 'duckduckgo':
          return await searchDuckDuckGo(query, maxResults);
        case 'brave':
          if (engCfg?.apiKey) return await searchBrave(query, engCfg.apiKey, maxResults);
          continue;
        case 'searxng':
          if (engCfg?.baseUrl) return await searchSearXNG(query, engCfg.baseUrl, maxResults);
          continue;
        case 'google':
          if (engCfg?.apiKey) return await searchGoogle(query, engCfg.apiKey, maxResults);
          continue;
      }
    } catch {
      continue; // Fallback to next engine
    }
  }

  return [];
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
}
