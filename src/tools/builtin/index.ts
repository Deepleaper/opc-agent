import type { MCPTool } from '../mcp';
import { fileTool } from './file';
import { webTool } from './web';
import { shellTool } from './shell';
import { datetimeTool } from './datetime';

export { fileTool, webTool, shellTool, datetimeTool };

const ALL_BUILTIN_TOOLS: MCPTool[] = [fileTool, webTool, shellTool, datetimeTool];

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
