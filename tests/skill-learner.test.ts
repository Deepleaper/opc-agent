import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillLearner } from '../src/skills/auto-learn';

describe('SkillLearner', () => {
  let tmpDir: string;
  let learner: SkillLearner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-learner-'));
    learner = new SkillLearner(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saveSkill creates .md file', async () => {
    const skill = makeSkill('test-skill');
    await learner.saveSkill(skill);
    expect(fs.existsSync(path.join(tmpDir, 'test-skill.md'))).toBe(true);
  });

  it('loadSkills reads .md files', async () => {
    await learner.saveSkill(makeSkill('s1'));
    await learner.saveSkill(makeSkill('s2'));
    const skills = await learner.loadLearnedSkills();
    expect(skills.length).toBeGreaterThanOrEqual(2);
  });

  it('round-trip: save then load matches', async () => {
    const skill = makeSkill('roundtrip');
    await learner.saveSkill(skill);
    const skills = await learner.loadLearnedSkills();
    const found = skills.find(s => s.name === 'roundtrip');
    expect(found).toBeDefined();
    expect(found!.description).toBe(skill.description);
    expect(found!.instructions).toBe(skill.instructions);
  });

  it('matchSkill with regex pattern', async () => {
    const skill = makeSkill('deploy-app', 'deploy|release');
    await learner.saveSkill(skill);
    await learner.loadLearnedSkills();
    const match = learner.matchSkill('please deploy the app');
    expect(match).toBeDefined();
    expect(match!.name).toBe('deploy-app');
  });

  it('matchSkill with keyword fallback', async () => {
    const skill = makeSkill('send-email', 'send.*email');
    skill.examples = ['send email to boss', 'email the team'];
    await learner.saveSkill(skill);
    await learner.loadLearnedSkills();
    const match = learner.matchSkill('send email to the team');
    expect(match).toBeDefined();
  });

  it('matchSkill returns null on no match', async () => {
    const skill = makeSkill('deploy-app', 'deploy|release');
    await learner.saveSkill(skill);
    await learner.loadLearnedSkills();
    const match = learner.matchSkill('what is the weather?');
    expect(match).toBeNull();
  });

  it('empty skills dir returns empty array', async () => {
    const skills = await learner.loadLearnedSkills();
    expect(skills).toEqual([]);
  });

  it('special characters in skill name handled', async () => {
    const skill = makeSkill('my-skill-v2');
    await learner.saveSkill(skill);
    expect(fs.existsSync(path.join(tmpDir, 'my-skill-v2.md'))).toBe(true);
  });

  it('saving same skill overwrites', async () => {
    const skill1 = makeSkill('same');
    await learner.saveSkill(skill1);
    const skill2 = makeSkill('same');
    skill2.description = 'updated description';
    await learner.saveSkill(skill2);
    const skills = await learner.loadLearnedSkills();
    const found = skills.filter(s => s.name === 'same');
    expect(found).toHaveLength(1);
  });

  it('skill version field preserved through save/load', async () => {
    const skill = makeSkill('versioned');
    skill.version = 3;
    await learner.saveSkill(skill);
    const skills = await learner.loadLearnedSkills();
    const found = skills.find(s => s.name === 'versioned');
    expect(found).toBeDefined();
    expect(found!.version).toBe(3);
  });

  it('loadSkills ignores non-md files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'not a skill');
    const skills = await learner.loadLearnedSkills();
    expect(skills).toHaveLength(0);
  });

  it('multiple skills: only matching one returned', async () => {
    await learner.saveSkill(makeSkill('alpha', 'alpha|first'));
    await learner.saveSkill(makeSkill('beta', 'beta|second'));
    await learner.loadLearnedSkills();
    const match = learner.matchSkill('trigger beta action');
    expect(match).toBeDefined();
    expect(match!.name).toBe('beta');
  });

  it('skills dir created if not exists', async () => {
    const newDir = path.join(tmpDir, 'nested', 'skills');
    const l2 = new SkillLearner(newDir);
    await l2.saveSkill(makeSkill('nested'));
    expect(fs.existsSync(path.join(newDir, 'nested.md'))).toBe(true);
  });

  it('analyzeForSkillCreation returns null with non-creating provider', async () => {
    const mockProvider = {
      name: 'mock',
      chat: vi.fn().mockResolvedValue('{"shouldCreate": false, "skill": null}'),
      chatStream: vi.fn(),
    };
    const result = await learner.analyzeForSkillCreation(
      [{ id: '1', role: 'user', content: 'hello', timestamp: Date.now() }],
      mockProvider as any,
    );
    expect(result).toBeNull();
  });

  it('analyzeForSkillCreation handles provider error gracefully', async () => {
    const mockProvider = {
      name: 'mock',
      chat: vi.fn().mockRejectedValue(new Error('API error')),
      chatStream: vi.fn(),
    };
    const result = await learner.analyzeForSkillCreation(
      [{ id: '1', role: 'user', content: 'hello', timestamp: Date.now() }],
      mockProvider as any,
    );
    expect(result).toBeNull();
  });
});

function makeSkill(name: string, trigger = 'test', description = 'A test skill') {
  return {
    name,
    description,
    trigger,
    instructions: 'Do the thing',
    examples: ['example 1', 'example 2'],
    createdAt: new Date(),
    usageCount: 0,
    version: 1,
  };
}
