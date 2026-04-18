import { describe, it, expect } from 'vitest';
import {
  getAllIntegrationTools, getIntegrationTool,
  SlackTool, EmailSendTool, WebhookTool,
  NotionTool, GitHubTool, JiraTool, CalendarTool, TrelloTool,
  WebSearchTool, WebScraperTool, DatabaseTool, VectorSearchTool,
  CodeExecutionTool, GitTool, NpmTool,
  ImageGenerationTool, PDFReaderTool, CSVAnalyzerTool,
  SummarizerTool, TranslatorTool,
} from '../src/tools/integrations';

describe('Integration Tools Registry', () => {
  it('should return all 20 tools', () => {
    const tools = getAllIntegrationTools();
    expect(tools).toHaveLength(20);
  });

  it('should find tools by name', () => {
    expect(getIntegrationTool('slack')).toBe(SlackTool);
    expect(getIntegrationTool('github')).toBe(GitHubTool);
    expect(getIntegrationTool('nonexistent')).toBeUndefined();
  });

  it('each tool has required properties', () => {
    const tools = getAllIntegrationTools();
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('all tool names are unique', () => {
    const tools = getAllIntegrationTools();
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('SlackTool', () => {
  it('should require action', async () => {
    const r = await SlackTool.execute({});
    expect(r.content).toContain('Unknown action');
  });

  it('should require text for send_message', async () => {
    const r = await SlackTool.execute({ action: 'send_message' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('text is required');
  });
});

describe('EmailSendTool', () => {
  it('should require SMTP env vars', async () => {
    const r = await EmailSendTool.execute({ to: 'a@b.com', subject: 'test', body: 'hi' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('SMTP_HOST');
  });
});

describe('WebhookTool', () => {
  it('should require url', async () => {
    const r = await WebhookTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('url is required');
  });
});

describe('NotionTool', () => {
  it('should require API key', async () => {
    const r = await NotionTool.execute({ action: 'search', query: 'test' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('NOTION_API_KEY');
  });
});

describe('GitHubTool', () => {
  it('should require GITHUB_TOKEN', async () => {
    const r = await GitHubTool.execute({ action: 'list_issues', owner: 'a', repo: 'b' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('GITHUB_TOKEN');
  });

  it('should validate create_issue params', async () => {
    process.env.GITHUB_TOKEN = 'test';
    const r = await GitHubTool.execute({ action: 'create_issue' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('owner, repo, title required');
    delete process.env.GITHUB_TOKEN;
  });
});

describe('JiraTool', () => {
  it('should require Jira env vars', async () => {
    const r = await JiraTool.execute({ action: 'search', jql: 'test' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('JIRA_URL');
  });
});

describe('CalendarTool', () => {
  it('should require GOOGLE_ACCESS_TOKEN', async () => {
    const r = await CalendarTool.execute({ action: 'list_events' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('GOOGLE_ACCESS_TOKEN');
  });
});

describe('TrelloTool', () => {
  it('should require API key and token', async () => {
    const r = await TrelloTool.execute({ action: 'list_boards' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('TRELLO_API_KEY');
  });
});

describe('WebSearchTool', () => {
  it('should require query', async () => {
    const r = await WebSearchTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('query required');
  });

  it('should require API key', async () => {
    const r = await WebSearchTool.execute({ query: 'test' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('No search API key');
  });
});

describe('WebScraperTool', () => {
  it('should require url', async () => {
    const r = await WebScraperTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('url required');
  });
});

describe('DatabaseTool', () => {
  it('should require connection URL', async () => {
    const r = await DatabaseTool.execute({ query: 'SELECT 1' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('DATABASE_URL');
  });

  it('should block destructive queries by default', async () => {
    process.env.DATABASE_URL = 'test.db';
    const r = await DatabaseTool.execute({ query: 'DROP TABLE users' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('Destructive queries blocked');
    delete process.env.DATABASE_URL;
  });
});

describe('VectorSearchTool', () => {
  it('should require DEEPBRAIN_URL', async () => {
    const r = await VectorSearchTool.execute({ query: 'test' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('DEEPBRAIN_URL');
  });
});

describe('CodeExecutionTool', () => {
  it('should require code', async () => {
    const r = await CodeExecutionTool.execute({ language: 'javascript', code: '' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('code required');
  });

  it('should reject unknown language', async () => {
    const r = await CodeExecutionTool.execute({ language: 'ruby', code: 'puts 1' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('Unsupported language');
  });
});

describe('GitTool', () => {
  it('should require message for commit', async () => {
    const r = await GitTool.execute({ action: 'commit' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('message required');
  });
});

describe('NpmTool', () => {
  it('should reject install action', async () => {
    const r = await NpmTool.execute({ action: 'install', package: 'lodash' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('not supported');
  });
});

describe('ImageGenerationTool', () => {
  it('should require prompt', async () => {
    const r = await ImageGenerationTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('prompt required');
  });
});

describe('PDFReaderTool', () => {
  it('should require file_path or url', async () => {
    const r = await PDFReaderTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('file_path or url required');
  });
});

describe('CSVAnalyzerTool', () => {
  it('should require file_path or data', async () => {
    const r = await CSVAnalyzerTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('file_path or data required');
  });

  it('should parse inline CSV', async () => {
    const r = await CSVAnalyzerTool.execute({ data: 'name,age\nAlice,30\nBob,25', action: 'parse' });
    expect(r.isError).toBeUndefined();
    expect(r.content).toContain('2 rows');
  });

  it('should aggregate CSV', async () => {
    const r = await CSVAnalyzerTool.execute({ data: 'name,score\nA,10\nB,20\nC,30', action: 'aggregate', column: 'score', operation: 'sum' });
    expect(r.content).toContain('60');
  });
});

describe('SummarizerTool', () => {
  it('should require text', async () => {
    const r = await SummarizerTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('text required');
  });

  it('should require API key', async () => {
    const r = await SummarizerTool.execute({ text: 'Hello world' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('OPENAI_API_KEY');
  });
});

describe('TranslatorTool', () => {
  it('should require text and target language', async () => {
    const r = await TranslatorTool.execute({});
    expect(r.isError).toBe(true);
    expect(r.content).toContain('text and to are required');
  });
});
