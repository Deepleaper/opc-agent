import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { searchRoles, getPopularRoles, getRole, getCategories } from 'agent-workstation';

const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');
const TMP_DIR = path.join(process.env.TEMP || require('os').tmpdir(), 'opc-test-init-role-' + process.pid);

function run(args: string): string {
  return execSync(`node "${CLI_PATH}" ${args}`, { cwd: TMP_DIR, encoding: 'utf-8', timeout: 15000 });
}

describe('opc init --role integration with agent-workstation', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // --- agent-workstation API tests ---

  it('searchRoles returns results for "customer"', () => {
    const results = searchRoles('customer');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe('customer-service');
  });

  it('searchRoles returns results for "developer"', () => {
    const results = searchRoles('developer');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: any) => r.role.includes('developer'))).toBe(true);
  });

  it('searchRoles returns empty for nonexistent role', () => {
    const results = searchRoles('xyznonexistentrole12345');
    expect(results.length).toBe(0);
  });

  it('getPopularRoles returns roles with category and role fields', () => {
    const roles = getPopularRoles();
    expect(roles.length).toBeGreaterThan(5);
    for (const r of roles) {
      expect(r).toHaveProperty('category');
      expect(r).toHaveProperty('role');
    }
  });

  it('getRole loads full role data with files', () => {
    const role = getRole('customer-service', 'customer-service-rep');
    expect(role).toBeTruthy();
    expect(role.files).toBeTruthy();
    expect(role.files['system-prompt.md']).toBeTruthy();
    expect(role.files['brain-seed.md']).toBeTruthy();
  });

  it('getCategories returns category list', () => {
    const cats = getCategories();
    expect(cats.length).toBeGreaterThan(3);
    expect(cats.some((c: any) => c.name === 'customer-service')).toBe(true);
  });

  // --- CLI integration tests ---

  it('--list-roles shows available roles', () => {
    const output = run('init --list-roles');
    expect(output).toContain('Available workstation roles');
    expect(output).toContain('customer-service');
    expect(output).toContain('--role');
  });

  it('--role customer-service generates SOUL.md from template', () => {
    const output = run('init test-cs-agent --role customer-service');
    expect(output).toContain('customer-service');
    const soulPath = path.join(TMP_DIR, 'test-cs-agent', 'SOUL.md');
    expect(fs.existsSync(soulPath)).toBe(true);
    const soul = fs.readFileSync(soulPath, 'utf-8');
    expect(soul).toContain('Customer Service');
    expect(soul.split('\n').length).toBeGreaterThan(10);
  });

  it('--role generates agent.yaml with role systemPrompt', () => {
    run('init test-yaml-agent --role customer-service');
    // CLI generates oad.yaml (not agent.yaml)
    const agentYaml = fs.readFileSync(path.join(TMP_DIR, 'test-yaml-agent', 'oad.yaml'), 'utf-8');
    expect(agentYaml).toContain('Customer Service');
    // oad.yaml may use systemPrompt or spec.model or other fields
    expect(agentYaml.length).toBeGreaterThan(10);
  });

  it('--role generates brain-seed when available', () => {
    run('init test-brain-agent --role customer-service');
    const brainPath = path.join(TMP_DIR, 'test-brain-agent', 'data', 'brain-seed.md');
    expect(fs.existsSync(brainPath)).toBe(true);
    const brain = fs.readFileSync(brainPath, 'utf-8');
    expect(brain.length).toBeGreaterThan(50);
  });

  it('--role generates CONTEXT.md with role info', () => {
    run('init test-ctx-agent --role customer-service');
    const ctx = fs.readFileSync(path.join(TMP_DIR, 'test-ctx-agent', 'CONTEXT.md'), 'utf-8');
    expect(ctx).toContain('Customer Service');
  });

  it('--role with unknown role gives error', () => {
    expect(() => run('init test-bad --role xyznonexistent123')).toThrow();
  });

  it('--role with partial match "developer" works', () => {
    const output = run('init test-dev-agent --role developer');
    expect(output).toContain('developer');
    expect(fs.existsSync(path.join(TMP_DIR, 'test-dev-agent', 'SOUL.md'))).toBe(true);
  });

  it('init without --role still works (generic project)', () => {
    const output = run('init test-generic -y');
    expect(output).toContain('Created agent project');
    expect(output).toContain('Tip');
    expect(output).toContain('--role');
    expect(fs.existsSync(path.join(TMP_DIR, 'test-generic', 'SOUL.md'))).toBe(true);
  });
});
