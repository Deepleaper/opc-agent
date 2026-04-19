import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Settings API & UI', () => {
  describe('Backend - server.ts settings routes', () => {
    const serverSrc = fs.readFileSync(path.join(__dirname, '../src/studio/server.ts'), 'utf-8');

    it('has settings/models GET route', () => {
      expect(serverSrc).toContain("route === 'settings/models' && req.method === 'GET'");
    });

    it('has settings/models PUT route', () => {
      expect(serverSrc).toContain("route === 'settings/models' && req.method === 'PUT'");
    });

    it('has settings/models/test POST route', () => {
      expect(serverSrc).toContain("route === 'settings/models/test' && req.method === 'POST'");
    });

    it('has settings/models/local GET route', () => {
      expect(serverSrc).toContain("route === 'settings/models/local' && req.method === 'GET'");
    });

    it('has settings/channels GET route', () => {
      expect(serverSrc).toContain("route === 'settings/channels' && req.method === 'GET'");
    });

    it('has settings/channels/:name PUT route', () => {
      expect(serverSrc).toContain("settings\\/channels\\/[^/]+");
    });

    it('has settings/status GET route', () => {
      expect(serverSrc).toContain("route === 'settings/status' && req.method === 'GET'");
    });

    it('has settings/usage GET route', () => {
      expect(serverSrc).toContain("route === 'settings/usage' && req.method === 'GET'");
    });

    it('has detectLocalOllama method', () => {
      expect(serverSrc).toContain('detectLocalOllama');
    });

    it('has testModelConnection method', () => {
      expect(serverSrc).toContain('testModelConnection');
    });

    it('saves config to ~/.opc/config.json', () => {
      expect(serverSrc).toContain("'.opc'");
      expect(serverSrc).toContain("'config.json'");
    });
  });

  describe('Frontend - index.html settings UI', () => {
    const html = fs.readFileSync(path.join(__dirname, '../src/studio-ui/index.html'), 'utf-8');

    it('has settings page container', () => {
      expect(html).toContain('id="page-settings"');
    });

    it('has settings navigation items', () => {
      expect(html).toContain('data-settings="models"');
      expect(html).toContain('data-settings="channels"');
      expect(html).toContain('data-settings="memory"');
      expect(html).toContain('data-settings="role"');
      expect(html).toContain('data-settings="status"');
      expect(html).toContain('data-settings="usage"');
    });

    it('has models panel with local/cloud tabs', () => {
      expect(html).toContain('id="sp-models"');
      expect(html).toContain('id="mt-local"');
      expect(html).toContain('id="mt-cloud"');
    });

    it('has Ollama detection UI', () => {
      expect(html).toContain('id="ollama-status"');
      expect(html).toContain('id="ollama-models"');
      expect(html).toContain('id="ollama-tutorial"');
      expect(html).toContain('ollama.com');
    });

    it('has cloud provider cards', () => {
      expect(html).toContain('pv-openai');
      expect(html).toContain('pv-deepseek');
      expect(html).toContain('pv-anthropic');
    });

    it('has model assignment dropdowns', () => {
      expect(html).toContain('id="cfg-chat-model"');
      expect(html).toContain('id="cfg-embed-model"');
      expect(html).toContain('qwen2.5:7b');
      expect(html).toContain('nomic-embed-text');
    });

    it('has channels panel', () => {
      expect(html).toContain('id="sp-channels"');
      expect(html).toContain('id="channels-grid"');
    });

    it('has memory panel with DeepBrain iframe reference', () => {
      expect(html).toContain('id="sp-memory"');
      expect(html).toContain('localhost:4001');
      expect(html).toContain('DeepBrain');
    });

    it('has role panel with Workstation iframe reference', () => {
      expect(html).toContain('id="sp-role"');
      expect(html).toContain('localhost:4003');
      expect(html).toContain('Workstation');
    });

    it('has status panel with logs viewer', () => {
      expect(html).toContain('id="sp-status"');
      expect(html).toContain('id="status-logs"');
    });

    it('has usage panel', () => {
      expect(html).toContain('id="sp-usage"');
      expect(html).toContain('id="usage-stats"');
    });

    it('has provider config dialog', () => {
      expect(html).toContain('id="provider-dialog"');
      expect(html).toContain('id="pd-apikey"');
      expect(html).toContain('testProvider');
    });

    it('has channel config dialog', () => {
      expect(html).toContain('id="channel-dialog"');
    });

    it('has settings nav in sidebar', () => {
      expect(html).toContain('data-page="settings"');
      expect(html).toContain('Settings');
    });

    it('has Chinese-friendly copy', () => {
      expect(html).toContain('模型配置');
      expect(html).toContain('渠道配置');
      expect(html).toContain('记忆管理');
      expect(html).toContain('角色编辑');
      expect(html).toContain('运行状态');
      expect(html).toContain('用量统计');
    });
  });
});
