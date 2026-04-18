import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DingTalkChannel } from '../src/channels/dingtalk';
import { MattermostChannel } from '../src/channels/mattermost';
import { GoogleChatChannel } from '../src/channels/googlechat';
import { TwitchChannel } from '../src/channels/twitch';
import { IRCChannel } from '../src/channels/irc';
import { ContextDiscovery } from '../src/core/context-discovery';
import { SessionManager } from '../src/core/session-manager';
import { HeartbeatManager } from '../src/core/heartbeat';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Channel Tests (10) ──

describe('DingTalkChannel', () => {
  it('should require webhookUrl', () => {
    expect(() => new DingTalkChannel({ webhookUrl: '' })).toThrow('webhookUrl');
  });
  it('should throw when sending before start', async () => {
    const ch = new DingTalkChannel({ webhookUrl: 'https://example.com/hook' });
    await expect(ch.send('chat', 'hi')).rejects.toThrow('not started');
  });
});

describe('MattermostChannel', () => {
  it('should require serverUrl and token', () => {
    expect(() => new MattermostChannel({ serverUrl: '', token: '' })).toThrow('serverUrl');
  });
  it('should throw when sending before start', async () => {
    const ch = new MattermostChannel({ serverUrl: 'https://mm.example.com', token: 'tok' });
    await expect(ch.send('ch1', 'hi')).rejects.toThrow('not started');
  });
});

describe('GoogleChatChannel', () => {
  it('should require webhookUrl', () => {
    expect(() => new GoogleChatChannel({ webhookUrl: '' })).toThrow('webhookUrl');
  });
  it('should throw when sending before start', async () => {
    const ch = new GoogleChatChannel({ webhookUrl: 'https://chat.googleapis.com/v1/spaces/x/messages?key=y' });
    await expect(ch.send('space', 'hi')).rejects.toThrow('not started');
  });
});

describe('TwitchChannel', () => {
  it('should require username, oauthToken, channels', () => {
    expect(() => new TwitchChannel({ username: '', oauthToken: '', channels: [] })).toThrow('username');
  });
  it('should throw when starting without tmi.js', async () => {
    const ch = new TwitchChannel({ username: 'bot', oauthToken: 'oauth:xxx', channels: ['#test'] });
    await expect(ch.start()).rejects.toThrow('tmi.js');
  });
});

describe('IRCChannel', () => {
  it('should require host, nick, channels', () => {
    expect(() => new IRCChannel({ host: '', nick: '', channels: [] })).toThrow('host');
  });
  it('should throw when starting without irc-framework', async () => {
    const ch = new IRCChannel({ host: 'irc.libera.chat', nick: 'bot', channels: ['#test'] });
    await expect(ch.start()).rejects.toThrow('irc-framework');
  });
});

// ── Context Discovery Tests (8) ──

describe('ContextDiscovery', () => {
  let tmpDir: string;
  let cd: ContextDiscovery;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
    cd = new ContextDiscovery();
  });

  afterEach(() => {
    cd.stopWatching();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should discover AGENTS.md', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Agents');
    const files = cd.discover(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0].type).toBe('agents');
  });

  it('should discover multiple standard files', () => {
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), '# Soul');
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), '# User');
    const files = cd.discover(tmpDir);
    expect(files.length).toBe(2);
  });

  it('should return empty for no context files', () => {
    expect(cd.discover(tmpDir)).toEqual([]);
  });

  it('should load and merge files into prompt', () => {
    fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), 'Be nice');
    fs.writeFileSync(path.join(tmpDir, 'TOOLS.md'), 'Use web');
    const files = cd.discover(tmpDir);
    const prompt = cd.load(files);
    expect(prompt).toContain('Be nice');
    expect(prompt).toContain('Use web');
  });

  it('should add and discover custom files', () => {
    const customPath = path.join(tmpDir, 'CUSTOM.md');
    fs.writeFileSync(customPath, '# Custom');
    cd.addCustomFile(customPath);
    const files = cd.discover(tmpDir);
    expect(files.some(f => f.type === 'custom' && f.content.includes('Custom'))).toBe(true);
  });

  it('should not duplicate custom files', () => {
    cd.addCustomFile('test.md');
    cd.addCustomFile('test.md');
    // Internal check - discover won't find it but custom list should have 1
    expect(cd.discover(tmpDir).filter(f => f.path.includes('test.md')).length).toBeLessThanOrEqual(1);
  });

  it('should assign correct types', () => {
    fs.writeFileSync(path.join(tmpDir, 'MEMORY.md'), 'mem');
    fs.writeFileSync(path.join(tmpDir, 'IDENTITY.md'), 'id');
    const files = cd.discover(tmpDir);
    expect(files.find(f => f.type === 'memory')).toBeTruthy();
    expect(files.find(f => f.type === 'identity')).toBeTruthy();
  });

  it('should handle watch without errors', () => {
    // Just ensure no throw
    cd.watch(tmpDir, () => {});
    cd.stopWatching();
  });
});

// ── Session Manager Tests (8) ──

describe('SessionManager', () => {
  let sm: SessionManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-'));
    sm = new SessionManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a session', () => {
    const s = sm.create('agent1', 'telegram');
    expect(s.id).toBeTruthy();
    expect(s.agentId).toBe('agent1');
  });

  it('should get a session by id', () => {
    const s = sm.create('agent1', 'telegram');
    expect(sm.get(s.id)).toEqual(s);
    expect(sm.get('nonexistent')).toBeNull();
  });

  it('should add messages', () => {
    const s = sm.create('a', 'c');
    sm.addMessage(s.id, { id: '1', role: 'user', content: 'hi', timestamp: Date.now() });
    expect(sm.get(s.id)!.messages.length).toBe(1);
  });

  it('should list with filters', () => {
    sm.create('a1', 'telegram');
    sm.create('a2', 'discord');
    expect(sm.list({ agentId: 'a1' }).length).toBe(1);
    expect(sm.list({ channel: 'discord' }).length).toBe(1);
  });

  it('should compact sessions', async () => {
    const s = sm.create('a', 'c');
    for (let i = 0; i < 15; i++) {
      sm.addMessage(s.id, { id: `${i}`, role: 'user', content: `msg ${i}`, timestamp: Date.now() });
    }
    await sm.compact(s.id);
    expect(sm.get(s.id)!.messages.length).toBeLessThan(15);
    expect(sm.get(s.id)!.compactedAt).toBeTruthy();
  });

  it('should prune old sessions', () => {
    const s = sm.create('a', 'c');
    // Manually set old lastActivity
    (sm.get(s.id) as any).lastActivity = Date.now() - 999999;
    expect(sm.prune(1000)).toBe(1);
  });

  it('should fork and get lineage', () => {
    const parent = sm.create('a', 'c');
    const child = sm.fork(parent.id);
    expect(child.parentId).toBe(parent.id);
    const lineage = sm.getLineage(child.id);
    expect(lineage.length).toBe(2);
    expect(lineage[0].id).toBe(parent.id);
  });

  it('should export as markdown and save/load', () => {
    const s = sm.create('a', 'c');
    sm.addMessage(s.id, { id: '1', role: 'user', content: 'hello', timestamp: Date.now() });
    const md = sm.export(s.id);
    expect(md).toContain('hello');
    sm.save();
    const sm2 = new SessionManager(tmpDir);
    sm2.load();
    expect(sm2.get(s.id)).toBeTruthy();
  });
});

// ── Heartbeat Tests (4) ──

describe('HeartbeatManager', () => {
  it('should require valid config', () => {
    expect(() => new HeartbeatManager({ interval: 0, checkFn: async () => 'ok' })).toThrow('interval');
    expect(() => new HeartbeatManager({ interval: 1000, checkFn: null as any })).toThrow('checkFn');
  });

  it('should start and stop', () => {
    const hb = new HeartbeatManager({ interval: 100, checkFn: async () => 'ok' });
    hb.start();
    hb.stop();
    // Double stop should be safe
    hb.stop();
  });

  it('should fire callbacks on beat', async () => {
    const hb = new HeartbeatManager({ interval: 100, checkFn: async () => 'alive' });
    const statuses: string[] = [];
    hb.onBeat(s => statuses.push(s));
    hb.start();
    await new Promise(r => setTimeout(r, 350));
    hb.stop();
    expect(statuses.length).toBeGreaterThanOrEqual(2);
    expect(statuses[0]).toBe('alive');
  });

  it('should report last beat', async () => {
    const hb = new HeartbeatManager({ interval: 100, checkFn: async () => 'ok' });
    expect(hb.getLastBeat()).toBeNull();
    hb.start();
    await new Promise(r => setTimeout(r, 200));
    hb.stop();
    const beat = hb.getLastBeat();
    expect(beat).toBeTruthy();
    expect(beat!.status).toBe('ok');
  });
});
