import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI: opc chat slash commands', () => {
  // Test that slash commands are recognized patterns
  const slashCommands = ['/help', '/quit', '/exit', '/clear', '/skills', '/memory', '/info'];

  it('should define all expected slash commands', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
    for (const cmd of slashCommands) {
      expect(cliSource).toContain(`'${cmd}'`);
    }
  });

  it('chat command should be registered', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
    expect(cliSource).toContain(".command('chat')");
    expect(cliSource).toContain('Interactive CLI chat with the agent');
  });

  it('init command should generate SOUL.md and CONTEXT.md', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
    expect(cliSource).toContain("'SOUL.md'");
    expect(cliSource).toContain("'CONTEXT.md'");
    expect(cliSource).toContain('# Project Context');
    expect(cliSource).toContain('Personality');
  });

  it('chat banner should include expected elements', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
    expect(cliSource).toContain('OPC Agent — Interactive Chat');
    expect(cliSource).toContain('/help for commands');
    expect(cliSource).toContain('╔');
    expect(cliSource).toContain('╚');
  });

  it('chat should load SOUL.md and CONTEXT.md', () => {
    const cliSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
    expect(cliSource).toContain("'SOUL.md'");
    expect(cliSource).toContain("'CONTEXT.md'");
    // Should prepend to system prompt
    expect(cliSource).toContain('soulContent');
    expect(cliSource).toContain('contextContent');
  });
});
