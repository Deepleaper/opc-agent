/**
 * Web Scraper - v0.10.0
 * Fetch URL content and extract readable text in markdown format.
 * Uses a simple readability-style extraction (no external dependencies).
 */

export interface ScrapedContent {
  title: string;
  content: string;  // markdown
  url: string;
  wordCount: number;
}

const MAX_CONTENT_LENGTH = 5000;

/**
 * Fetch a URL and extract readable content as markdown.
 */
export async function scrapeUrl(url: string, maxLength = MAX_CONTENT_LENGTH): Promise<ScrapedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  // If not HTML, return raw text
  if (!contentType.includes('html')) {
    const truncated = text.slice(0, maxLength);
    return {
      title: url,
      content: truncated,
      url,
      wordCount: truncated.split(/\s+/).length,
    };
  }

  return extractReadableContent(text, url, maxLength);
}

/**
 * Extract readable content from HTML using simple heuristics.
 */
export function extractReadableContent(html: string, url: string, maxLength = MAX_CONTENT_LENGTH): ScrapedContent {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : url;

  // Remove non-content elements
  let content = html;

  // Remove script, style, nav, header, footer, aside, iframe
  const removePatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<nav[\s\S]*?<\/nav>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<iframe[\s\S]*?<\/iframe>/gi,
    /<noscript[\s\S]*?<\/noscript>/gi,
    /<!--[\s\S]*?-->/g,
  ];

  for (const pattern of removePatterns) {
    content = content.replace(pattern, '');
  }

  // Try to find main content area
  const mainContent = findMainContent(content);
  content = mainContent || content;

  // Convert to markdown-ish text
  content = htmlToMarkdown(content);

  // Clean up whitespace
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Truncate
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '\n\n...[truncated]';
  }

  return {
    title,
    content,
    url,
    wordCount: content.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Try to find the main content area of the page.
 */
function findMainContent(html: string): string | null {
  // Try common content selectors
  const patterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|main)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:content|article|post|entry|main)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      return match[1];
    }
  }

  // Fallback: find body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : null;
}

/**
 * Simple HTML to Markdown conversion.
 */
function htmlToMarkdown(html: string): string {
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Paragraphs and line breaks
  md = md.replace(/<p[^>]*>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Bold and italic
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = decodeEntities(md);

  return md;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
