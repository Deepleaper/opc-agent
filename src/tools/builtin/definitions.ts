import type { ToolDefinition } from '../../core/types';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file at a given path',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative or absolute path to the file' },
      encoding: { type: 'string', enum: ['utf-8', 'base64'], default: 'utf-8' },
    },
    required: ['path'],
  },
};

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write or overwrite content to a file at a given path',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative or absolute path to the file' },
      content: { type: 'string', description: 'Content to write' },
      encoding: { type: 'string', enum: ['utf-8', 'base64'], default: 'utf-8' },
    },
    required: ['path', 'content'],
  },
};

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web and return a list of results with titles, URLs, and snippets',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      numResults: { type: 'number', description: 'Max results to return (default 5)', default: 5 },
    },
    required: ['query'],
  },
};

export const shellCommandTool: ToolDefinition = {
  name: 'shell_command',
  description: 'Run a shell command and return stdout/stderr (requires explicit permission)',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory for the command' },
      timeoutMs: { type: 'number', description: 'Timeout in milliseconds (default 30000)', default: 30000 },
    },
    required: ['command'],
  },
};

export const BUILTIN_DEFINITIONS: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  webSearchTool,
  shellCommandTool,
];
