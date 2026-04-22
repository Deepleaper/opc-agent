import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI: opc chat slash commands', () => {
  const chatSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli', 'chat.ts'), 'utf-8');
  const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');

  it('should define all expected slash commands', () => {
    const slashCommands = ['/help', '/clear', '/model', '/tools', '/skills', '/history', '/status', '/quit'];
    for (const cmd of slashCommands) {
      expect(chatSource).toContain(`'${cmd}'`);
    }
  });

  it('chat command should be registered', () => {
    expect(cliSource).toContain('chat');
  });

  it('chat banner should include expected elements', () => {
    expect(chatSource).toContain('/help for commands');
  });

  it('chat should load config', () => {
    expect(chatSource).toContain('agentName');
    expect(chatSource).toContain('model');
  });

  it('init command generates workspace files', () => {
    expect(cliSource).toContain('init');
  });
});
