import { describe, it, expect } from 'vitest';
import { IDEBridge } from '../src/core/ide-bridge';

describe('IDEBridge', () => {
  it('should create with vscode config', () => {
    const bridge = new IDEBridge({ editor: 'vscode' });
    expect(bridge).toBeInstanceOf(IDEBridge);
  });

  it('should create with jetbrains config', () => {
    const bridge = new IDEBridge({ editor: 'jetbrains', workspacePath: '/tmp' });
    expect(bridge).toBeInstanceOf(IDEBridge);
  });

  it('getDiagnostics returns empty array (stub)', async () => {
    const bridge = new IDEBridge({ editor: 'vscode' });
    const diags = await bridge.getDiagnostics();
    expect(diags).toEqual([]);
  });

  it('getOpenFiles returns empty array (stub)', async () => {
    const bridge = new IDEBridge({ editor: 'zed' });
    const files = await bridge.getOpenFiles();
    expect(files).toEqual([]);
  });

  it('getSelection returns null (stub)', async () => {
    const bridge = new IDEBridge({ editor: 'cursor' });
    const sel = await bridge.getSelection();
    expect(sel).toBeNull();
  });

  it('applyEdit throws for non-empty edits (stub)', async () => {
    const bridge = new IDEBridge({ editor: 'vscode' });
    await expect(bridge.applyEdit('test.ts', [{ range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 5 }, newText: 'hi' }]))
      .rejects.toThrow('extension');
  });
});
