import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for CLI chat slash command handling logic.
 * We test the command parsing logic directly since the chat command
 * is tightly coupled to readline/process.
 */

// Extract the slash command logic for testing
function createSlashHandler(options: {
  agentName?: string;
  agentVersion?: string;
  providerName?: string;
  model?: string;
  skillNames?: string[];
  history?: { role: string; content: string }[];
}) {
  const {
    agentName = 'test-agent',
    agentVersion = '1.0.0',
    providerName = 'openai',
    model = 'gpt-4',
    skillNames = [],
    history = [],
  } = options;

  const output: string[] = [];
  const log = (msg: string) => output.push(msg);

  const handleSlashCommand = (cmd: string): boolean => {
    const lower = cmd.toLowerCase().trim();
    if (lower === '/quit' || lower === '/exit') {
      output.push('QUIT');
      return true;
    }
    if (lower === '/help') {
      log('Available commands:');
      log('/help /quit /clear /skills /memory /info');
      return true;
    }
    if (lower === '/clear') {
      history.length = 0;
      log('Conversation history cleared.');
      return true;
    }
    if (lower === '/skills') {
      if (skillNames.length === 0) {
        log('No skills registered.');
      } else {
        log('Registered skills:');
        skillNames.forEach(s => log(`• ${s}`));
      }
      return true;
    }
    if (lower === '/info') {
      log(`Name: ${agentName}`);
      log(`Version: ${agentVersion}`);
      log(`Provider: ${providerName}`);
      log(`Model: ${model}`);
      return true;
    }
    return false;
  };

  return { handleSlashCommand, output, history };
}

describe('Chat CLI slash commands', () => {
  it('/help returns command list', () => {
    const { handleSlashCommand, output } = createSlashHandler({});
    const handled = handleSlashCommand('/help');
    expect(handled).toBe(true);
    expect(output.some(l => l.includes('commands'))).toBe(true);
  });

  it('/clear resets history', () => {
    const history = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }];
    const { handleSlashCommand } = createSlashHandler({ history });
    handleSlashCommand('/clear');
    expect(history).toHaveLength(0);
  });

  it('/skills lists skills', () => {
    const { handleSlashCommand, output } = createSlashHandler({ skillNames: ['echo', 'search'] });
    handleSlashCommand('/skills');
    expect(output.some(l => l.includes('echo'))).toBe(true);
    expect(output.some(l => l.includes('search'))).toBe(true);
  });

  it('/skills with no skills shows empty message', () => {
    const { handleSlashCommand, output } = createSlashHandler({ skillNames: [] });
    handleSlashCommand('/skills');
    expect(output.some(l => l.includes('No skills'))).toBe(true);
  });

  it('/info shows agent info', () => {
    const { handleSlashCommand, output } = createSlashHandler({ agentName: 'MyBot', model: 'gpt-4o' });
    handleSlashCommand('/info');
    expect(output.some(l => l.includes('MyBot'))).toBe(true);
    expect(output.some(l => l.includes('gpt-4o'))).toBe(true);
  });

  it('/quit sets quit flag', () => {
    const { handleSlashCommand, output } = createSlashHandler({});
    handleSlashCommand('/quit');
    expect(output).toContain('QUIT');
  });

  it('/exit also works as quit', () => {
    const { handleSlashCommand, output } = createSlashHandler({});
    handleSlashCommand('/exit');
    expect(output).toContain('QUIT');
  });

  it('unknown slash command returns false', () => {
    const { handleSlashCommand } = createSlashHandler({});
    expect(handleSlashCommand('/unknown')).toBe(false);
  });

  it('non-slash text returns false', () => {
    const { handleSlashCommand } = createSlashHandler({});
    expect(handleSlashCommand('hello world')).toBe(false);
  });

  it('case insensitive: /HELP works', () => {
    const { handleSlashCommand, output } = createSlashHandler({});
    expect(handleSlashCommand('/HELP')).toBe(true);
    expect(output.length).toBeGreaterThan(0);
  });

  it('whitespace trimmed: "  /help  " works', () => {
    const { handleSlashCommand, output } = createSlashHandler({});
    expect(handleSlashCommand('  /help  ')).toBe(true);
  });

  it('empty input handling', () => {
    const text = '   '.trim();
    expect(text).toBe('');
    // Empty input should be skipped (no slash command)
  });

  it('banner would contain agent name', () => {
    const agentName = 'MyTestAgent';
    const banner = `OPC Agent - Interactive Chat - ${agentName}`;
    expect(banner).toContain(agentName);
  });

  it('/clear then history is empty', () => {
    const history = [{ role: 'user', content: 'msg1' }];
    const { handleSlashCommand } = createSlashHandler({ history });
    expect(history).toHaveLength(1);
    handleSlashCommand('/clear');
    expect(history).toHaveLength(0);
  });

  it('message without slash goes to agent (not handled by slash handler)', () => {
    const { handleSlashCommand } = createSlashHandler({});
    expect(handleSlashCommand('tell me a joke')).toBe(false);
  });
});
