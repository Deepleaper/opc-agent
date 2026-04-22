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

    it('has main page containers', () => {
      expect(html).toContain('id="page-assistant"');
      expect(html).toContain('id="page-models"');
      expect(html).toContain('id="page-knowledge"');
      expect(html).toContain('id="page-workstation"');
    });

    it('has sidebar navigation items', () => {
      expect(html).toContain('id="nav-assistant"');
      expect(html).toContain('id="nav-models"');
      expect(html).toContain('id="nav-knowledge"');
      expect(html).toContain('id="nav-workstation"');
    });

    it('has models page content', () => {
      expect(html).toContain('id="models-content"');
      expect(html).toContain('id="models-body"');
    });

    it('has Ollama reference', () => {
      expect(html).toContain('ollama');
    });

    it('has cloud provider support', () => {
      expect(html).toContain('OpenAI');
      expect(html).toContain('Anthropic');
    });

    it('has agent model assignment', () => {
      expect(html).toContain('id="new-agent-model"');
    });

    it('has channels page', () => {
      expect(html).toContain('id="page-channels"');
      expect(html).toContain('id="channels-content"');
    });

    it('has knowledge page with DeepBrain', () => {
      expect(html).toContain('id="page-knowledge"');
      expect(html).toContain('DeepBrain');
      expect(html).toContain('id="knowledge-layers"');
    });

    it('has workstation page', () => {
      expect(html).toContain('id="page-workstation"');
      expect(html).toContain('id="ws-content"');
    });

    it('has agent settings with tabs', () => {
      expect(html).toContain('id="agent-settings"');
      expect(html).toContain('id="settings-tabs"');
      expect(html).toContain('id="settings-content"');
    });

    it('has toast notification', () => {
      expect(html).toContain('id="toast"');
    });

    it('has file upload zone', () => {
      expect(html).toContain('id="upload-zone"');
      expect(html).toContain('id="file-upload"');
    });

    it('has sidebar', () => {
      expect(html).toContain('id="sidebar"');
      expect(html).toContain('id="agent-list"');
    });

    it('has Chinese-friendly copy', () => {
      expect(html).toContain('AgentKits');
      expect(html).toContain('DeepBrain');
    });
  });
});
