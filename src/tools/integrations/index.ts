import type { MCPTool } from '../mcp';

// Communication
export { SlackTool } from './slack';
export { EmailSendTool } from './email-send';
export { WebhookTool } from './webhook';

// Productivity
export { NotionTool } from './notion';
export { GitHubTool } from './github-tool';
export { JiraTool } from './jira';
export { CalendarTool } from './calendar';
export { TrelloTool } from './trello';

// Data & Search
export { WebSearchTool } from './web-search';
export { WebScraperTool } from './web-scraper';
export { DatabaseTool } from './database';
export { VectorSearchTool } from './vector-search';

// Code & Dev
export { CodeExecutionTool } from './code-exec';
export { GitTool } from './git-tool';
export { NpmTool } from './npm-tool';

// Media & Files
export { ImageGenerationTool } from './image-gen';
export { PDFReaderTool } from './pdf-reader';
export { CSVAnalyzerTool } from './csv-analyzer';

// AI & Analysis
export { SummarizerTool } from './summarizer';
export { TranslatorTool } from './translator';

// Import all tools for registry
import { SlackTool } from './slack';
import { EmailSendTool } from './email-send';
import { WebhookTool } from './webhook';
import { NotionTool } from './notion';
import { GitHubTool } from './github-tool';
import { JiraTool } from './jira';
import { CalendarTool } from './calendar';
import { TrelloTool } from './trello';
import { WebSearchTool } from './web-search';
import { WebScraperTool } from './web-scraper';
import { DatabaseTool } from './database';
import { VectorSearchTool } from './vector-search';
import { CodeExecutionTool } from './code-exec';
import { GitTool } from './git-tool';
import { NpmTool } from './npm-tool';
import { ImageGenerationTool } from './image-gen';
import { PDFReaderTool } from './pdf-reader';
import { CSVAnalyzerTool } from './csv-analyzer';
import { SummarizerTool } from './summarizer';
import { TranslatorTool } from './translator';

const ALL_INTEGRATION_TOOLS: MCPTool[] = [
  SlackTool,
  EmailSendTool,
  WebhookTool,
  NotionTool,
  GitHubTool,
  JiraTool,
  CalendarTool,
  TrelloTool,
  WebSearchTool,
  WebScraperTool,
  DatabaseTool,
  VectorSearchTool,
  CodeExecutionTool,
  GitTool,
  NpmTool,
  ImageGenerationTool,
  PDFReaderTool,
  CSVAnalyzerTool,
  SummarizerTool,
  TranslatorTool,
];

/**
 * Get all 20 pre-built integration tools.
 */
export function getAllIntegrationTools(): MCPTool[] {
  return [...ALL_INTEGRATION_TOOLS];
}

/**
 * Get a specific integration tool by name.
 */
export function getIntegrationTool(name: string): MCPTool | undefined {
  return ALL_INTEGRATION_TOOLS.find((t) => t.name === name);
}
