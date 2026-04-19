import type { MCPTool } from '../mcp';
import { fileTool } from './file';
import { webTool } from './web';
import { shellTool } from './shell';
import { datetimeTool } from './datetime';
import { browserTools, BrowserManager, browserManager } from './browser';
import { visionTools, visionAnalyzeTool, visionExtractTextTool, visionCompareTool } from './vision';
import { rlTools } from './rl-tools';
import { homeAssistantTools } from './home-assistant';
import { webSearchTools, webSearchTool, webReadTool } from './web-search';

export { fileTool, webTool, shellTool, datetimeTool, browserTools, BrowserManager, browserManager };
export { visionTools, visionAnalyzeTool, visionExtractTextTool, visionCompareTool };
export { rlTools } from './rl-tools';
export { homeAssistantTools, configureHomeAssistant } from './home-assistant';
export { webSearchTools, webSearchTool, webReadTool } from './web-search';

const ALL_BUILTIN_TOOLS: MCPTool[] = [fileTool, webTool, shellTool, datetimeTool, ...browserTools, ...visionTools, ...rlTools, ...homeAssistantTools, ...webSearchTools];

const BUILTIN_MAP = new Map<string, MCPTool>(
  ALL_BUILTIN_TOOLS.map(t => [t.name, t])
);

/**
 * Get all built-in tools.
 */
export function getBuiltinTools(): MCPTool[] {
  return [...ALL_BUILTIN_TOOLS];
}

/**
 * Get specific built-in tools by name. If no names given, returns all.
 */
export function getBuiltinToolsByName(names?: string[]): MCPTool[] {
  if (!names || names.length === 0) return getBuiltinTools();
  return names.map(n => BUILTIN_MAP.get(n)).filter((t): t is MCPTool => !!t);
}
