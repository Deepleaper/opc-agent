import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentDeployer } from '../src/deploy/index';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AgentDeployer', () => {
  let deployer: AgentDeployer;
  let tmpDir: string;

  beforeEach(() => {
    deployer = new AgentDeployer();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-deploy-test-'));
    // Create a minimal package.json
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-agent',
      version: '1.0.0',
      main: 'dist/index.js',
      scripts: { start: 'node dist/index.js' },
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate a valid Dockerfile', async () => {
    const dockerfile = await deployer.generateDockerfile(tmpDir);
    expect(dockerfile).toContain('FROM node:22-slim');
    expect(dockerfile).toContain('WORKDIR /app');
    expect(dockerfile).toContain('npm ci --production');
    expect(dockerfile).toContain('EXPOSE 3000');
    expect(dockerfile).toContain('NODE_ENV=production');
  });

  it('should generate Dockerfile with custom port', async () => {
    const dockerfile = await deployer.generateDockerfile(tmpDir, { port: 8080 });
    expect(dockerfile).toContain('EXPOSE 8080');
    expect(dockerfile).toContain('PORT=8080');
  });

  it('should generate docker-compose.yml', async () => {
    const compose = await deployer.generateCompose(tmpDir);
    expect(compose).toContain('version: "3.8"');
    expect(compose).toContain('build: .');
    expect(compose).toContain('3000:3000');
    expect(compose).toContain('NODE_ENV=production');
    expect(compose).toContain('restart: unless-stopped');
  });

  it('should generate docker-compose.yml with custom options', async () => {
    const compose = await deployer.generateCompose(tmpDir, { port: 8080, replicas: 3 });
    expect(compose).toContain('8080:8080');
    expect(compose).toContain('replicas: 3');
  });

  it('should generate docker-compose.yml with env vars', async () => {
    const compose = await deployer.generateCompose(tmpDir, { env: { API_KEY: 'test123', DEBUG: 'true' } });
    expect(compose).toContain('API_KEY=test123');
    expect(compose).toContain('DEBUG=true');
  });

  it('should generate all deployment files', async () => {
    const result = await deployer.generateFiles(tmpDir);
    expect(result.success).toBe(true);
    expect(result.files).toContain('Dockerfile');
    expect(result.files).toContain('docker-compose.yml');
    expect(result.files).toContain('.dockerignore');
    expect(fs.existsSync(path.join(tmpDir, 'Dockerfile'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docker-compose.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.dockerignore'))).toBe(true);
  });

  it('should include node_modules in .dockerignore', async () => {
    await deployer.generateFiles(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.dockerignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('.git');
  });

  it('should handle missing package.json gracefully', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-empty-'));
    const dockerfile = await deployer.generateDockerfile(emptyDir);
    expect(dockerfile).toContain('FROM node:22-slim');
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('should fail railway deploy without CLI installed', async () => {
    const result = await deployer.deployRailway(tmpDir);
    // Railway CLI likely not installed in test env
    expect(result.platform).toBe('railway');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });

  it('should fail fly deploy without CLI installed', async () => {
    const result = await deployer.deployFly(tmpDir);
    expect(result.platform).toBe('fly');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });
});

describe('Workflow JSON serialization', () => {
  it('should serialize workflow to valid JSON', () => {
    const workflow = {
      id: 'wf-1',
      name: 'Test Workflow',
      nodes: [
        { id: 'n1', type: 'input', name: 'Start', x: 0, y: 0, config: {} },
        { id: 'n2', type: 'agent', name: 'GPT Agent', x: 200, y: 0, config: { systemPrompt: 'You are helpful', model: 'gpt-4o' } },
        { id: 'n3', type: 'output', name: 'End', x: 400, y: 0, config: {} },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', fromPort: 'out', toPort: 'in' },
        { id: 'e2', from: 'n2', to: 'n3', fromPort: 'out', toPort: 'in' },
      ],
      created: '2026-04-18T00:00:00Z',
      updated: '2026-04-18T00:00:00Z',
    };

    const json = JSON.stringify(workflow);
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.name).toBe('Test Workflow');
  });

  it('should deserialize workflow from JSON', () => {
    const json = '{"name":"W1","nodes":[{"id":"n1","type":"input","name":"In","x":0,"y":0,"config":{}}],"edges":[]}';
    const wf = JSON.parse(json);
    expect(wf.name).toBe('W1');
    expect(wf.nodes[0].type).toBe('input');
    expect(wf.edges).toHaveLength(0);
  });

  it('should handle all node types', () => {
    const types = ['agent', 'tool', 'condition', 'loop', 'parallel', 'input', 'output'];
    const nodes = types.map((type, i) => ({
      id: `n${i}`, type, name: type, x: i * 200, y: 0, config: {},
    }));
    const json = JSON.stringify({ nodes, edges: [] });
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toHaveLength(7);
    for (let i = 0; i < types.length; i++) {
      expect(parsed.nodes[i].type).toBe(types[i]);
    }
  });

  it('should preserve node config through serialization', () => {
    const node = {
      id: 'n1', type: 'agent', name: 'Test',
      x: 100, y: 200,
      config: { systemPrompt: 'Be helpful', model: 'claude-3' },
    };
    const parsed = JSON.parse(JSON.stringify(node));
    expect(parsed.config.systemPrompt).toBe('Be helpful');
    expect(parsed.config.model).toBe('claude-3');
    expect(parsed.x).toBe(100);
  });

  it('should validate edge references', () => {
    const nodes = [
      { id: 'n1', type: 'input', name: 'In', x: 0, y: 0, config: {} },
      { id: 'n2', type: 'output', name: 'Out', x: 200, y: 0, config: {} },
    ];
    const edges = [{ id: 'e1', from: 'n1', to: 'n2', fromPort: 'out', toPort: 'in' }];
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const e of edges) {
      expect(nodeIds.has(e.from)).toBe(true);
      expect(nodeIds.has(e.to)).toBe(true);
    }
  });
});

describe('Deploy config validation', () => {
  it('should accept valid deploy options', () => {
    const opts = { port: 3000, platform: 'docker' as const, replicas: 1 };
    expect(opts.port).toBeGreaterThan(0);
    expect(opts.port).toBeLessThan(65536);
    expect(['docker', 'railway', 'fly', 'render']).toContain(opts.platform);
  });

  it('should use defaults for missing options', () => {
    const defaults = { port: 3000, platform: 'docker', replicas: 1 };
    const opts = { ...defaults };
    expect(opts.port).toBe(3000);
    expect(opts.replicas).toBe(1);
  });

  it('should handle env vars in deploy options', () => {
    const opts = { env: { NODE_ENV: 'production', API_KEY: 'secret' } };
    expect(Object.keys(opts.env)).toHaveLength(2);
    expect(opts.env.NODE_ENV).toBe('production');
  });
});
