import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { AgentPackager, AgentPublisher, AgentInstaller } from '../src/publish';

function makeTempDir(): string {
  const dir = path.join(os.tmpdir(), `opc-test-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeAgentYaml(dir: string, overrides: Record<string, any> = {}) {
  const config = {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: { name: 'test-agent', version: '1.0.0', description: 'Test agent', author: 'Test', license: 'MIT', ...overrides.metadata },
    spec: { model: 'gpt-4', provider: { default: 'openai' }, channels: [{ type: 'web' }], skills: [{ name: 'echo' }], tools: [], ...overrides.spec },
  };
  const yaml = require('js-yaml');
  fs.writeFileSync(path.join(dir, 'agent.yaml'), yaml.dump(config));
}

function writePackageJson(dir: string, overrides: Record<string, any> = {}) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test-agent', version: '1.0.0', ...overrides }, null, 2));
}

function setupValidProject(dir: string) {
  writeAgentYaml(dir);
  writePackageJson(dir);
  fs.writeFileSync(path.join(dir, 'SOUL.md'), '# Soul');
  fs.writeFileSync(path.join(dir, 'README.md'), '# Readme');
  fs.writeFileSync(path.join(dir, 'src.ts'), 'console.log("hello")');
}

describe('AgentPackager', () => {
  let tmpDir: string;
  const packager = new AgentPackager();

  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // 1. validate: missing agent.yaml → error
  it('validate: missing agent.yaml produces error', async () => {
    writePackageJson(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing agent.yaml');
  });

  // 2. validate: missing package.json → error
  it('validate: missing package.json produces error', async () => {
    writeAgentYaml(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing package.json');
  });

  // 3. validate: valid project → no errors
  it('validate: valid project has no errors', async () => {
    setupValidProject(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 4. validate: missing SOUL.md → warning
  it('validate: missing SOUL.md produces warning', async () => {
    writeAgentYaml(tmpDir);
    writePackageJson(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.warnings).toContain('Missing SOUL.md (recommended)');
  });

  // 5. validate: missing README.md → warning
  it('validate: missing README.md produces warning', async () => {
    writeAgentYaml(tmpDir);
    writePackageJson(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.warnings).toContain('Missing README.md');
  });

  // 6. validate: uppercase name → error
  it('validate: uppercase name in agent.yaml produces error', async () => {
    writeAgentYaml(tmpDir, { metadata: { name: 'MyAgent', version: '1.0.0' } });
    writePackageJson(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
  });

  // 7. validate: invalid version → error
  it('validate: invalid version format produces error', async () => {
    writeAgentYaml(tmpDir, { metadata: { name: 'test', version: 'bad' } });
    writePackageJson(tmpDir);
    const result = await packager.validate(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  // 8. listFiles: excludes node_modules
  it('listFiles: excludes node_modules', async () => {
    setupValidProject(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'foo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'foo', 'index.js'), '');
    const files = await packager.listFiles(tmpDir);
    expect(files.every(f => !f.includes('node_modules'))).toBe(true);
  });

  // 9. listFiles: excludes .env
  it('listFiles: excludes .env', async () => {
    setupValidProject(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=x');
    const files = await packager.listFiles(tmpDir);
    expect(files).not.toContain('.env');
  });

  // 10. listFiles: excludes .git
  it('listFiles: excludes .git directory', async () => {
    setupValidProject(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.git', 'config'), '');
    const files = await packager.listFiles(tmpDir);
    expect(files.every(f => !f.includes('.git'))).toBe(true);
  });

  // 11. listFiles: respects .opcignore
  it('listFiles: respects .opcignore', async () => {
    setupValidProject(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'secret.txt'), 'hidden');
    fs.writeFileSync(path.join(tmpDir, '.opcignore'), 'secret.txt\n');
    const files = await packager.listFiles(tmpDir);
    expect(files).not.toContain('secret.txt');
  });

  // 12. pack: creates .opc.tgz file
  it('pack: creates .opc.tgz file', async () => {
    setupValidProject(tmpDir);
    const result = await packager.pack(tmpDir);
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path).toMatch(/\.opc\.tgz$/);
    // cleanup
    fs.unlinkSync(result.path);
  });

  // 13. pack: manifest contains correct fields
  it('pack: manifest contains correct fields', async () => {
    setupValidProject(tmpDir);
    const result = await packager.pack(tmpDir);
    expect(result.manifest.name).toBe('test-agent');
    expect(result.manifest.version).toBe('1.0.0');
    expect(result.manifest.author).toBe('Test');
    expect(result.manifest.license).toBe('MIT');
    expect(result.manifest.agent.model).toBe('gpt-4');
    expect(result.manifest.agent.provider).toBe('openai');
    expect(result.manifest.agent.channels).toContain('web');
    expect(result.manifest.files.length).toBeGreaterThan(0);
    expect(result.manifest.checksum).toBeTruthy();
    expect(result.manifest.createdAt).toBeTruthy();
    fs.unlinkSync(result.path);
  });

  // 14. manifest checksum is valid sha256
  it('pack: checksum is valid sha256', async () => {
    setupValidProject(tmpDir);
    const result = await packager.pack(tmpDir);
    expect(result.manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    // Verify checksum matches file
    const fileHash = crypto.createHash('sha256').update(fs.readFileSync(result.path)).digest('hex');
    expect(result.manifest.checksum).toBe(fileHash);
    fs.unlinkSync(result.path);
  });

  // 15. pack: validation failure throws
  it('pack: throws on invalid project', async () => {
    // Empty dir — no agent.yaml
    await expect(packager.pack(tmpDir)).rejects.toThrow('Validation failed');
  });
});

describe('AgentPublisher', () => {
  // 16. dry-run doesn't throw
  it('dry-run returns success without error', async () => {
    const publisher = new AgentPublisher();
    const manifest = {
      name: 'test', version: '1.0.0', description: '', author: '', license: 'MIT',
      agent: { model: '', provider: '', channels: [], skills: [], tools: [] },
      files: ['a.ts'], checksum: 'abc', createdAt: new Date().toISOString(),
    };
    const result = await publisher.publish('/fake/path.opc.tgz', manifest, { dryRun: true });
    expect(result.success).toBe(true);
  });
});

describe('AgentInstaller', () => {
  let tmpDir: string;
  let installDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    installDir = makeTempDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(installDir, { recursive: true, force: true });
  });

  // 17. install from tarball extracts correctly
  it('install from .opc.tgz extracts files', async () => {
    // Create a valid project and pack it
    setupValidProject(tmpDir);
    const packager = new AgentPackager();
    const { path: pkgPath } = await packager.pack(tmpDir);

    const installer = new AgentInstaller();
    await installer.install(pkgPath, installDir);

    // Check that files were extracted
    const extractedFiles = fs.readdirSync(installDir);
    expect(extractedFiles.length).toBeGreaterThan(0);

    fs.unlinkSync(pkgPath);
  });

  // 18. install from missing file throws
  it('install from missing file throws', async () => {
    const installer = new AgentInstaller();
    await expect(installer.install('/nonexistent/pkg.opc.tgz', installDir)).rejects.toThrow();
  });
});
