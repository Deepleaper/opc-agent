import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillLearner, skillToMarkdown, parseSkillMarkdown, type LearnedSkill } from '../src/skills/auto-learn';

function makeSkill(overrides: Partial<LearnedSkill> = {}): LearnedSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    trigger: 'deploy|deployment',
    instructions: '1. Check env\n2. Run deploy\n3. Verify',
    examples: ['deploy to production', 'run deployment'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    usageCount: 0,
    version: 1,
    ...overrides,
  };
}

describe('SkillLearner', () => {
  let tmpDir: string;
  let learner: SkillLearner;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-skills-'));
    learner = new SkillLearner(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('saveSkill / loadLearnedSkills', () => {
    it('should save and load a skill', async () => {
      const skill = makeSkill();
      await learner.saveSkill(skill);

      const loaded = await learner.loadLearnedSkills();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('test-skill');
      expect(loaded[0].description).toBe('A test skill');
      expect(loaded[0].trigger).toBe('deploy|deployment');
      expect(loaded[0].examples).toEqual(['deploy to production', 'run deployment']);
    });

    it('should create directory if not exists', async () => {
      const nested = path.join(tmpDir, 'deep', 'nested');
      const l = new SkillLearner(nested);
      await l.saveSkill(makeSkill());
      expect(fs.existsSync(path.join(nested, 'test-skill.md'))).toBe(true);
    });

    it('should return empty array for nonexistent dir', async () => {
      const l = new SkillLearner(path.join(tmpDir, 'nope'));
      const skills = await l.loadLearnedSkills();
      expect(skills).toEqual([]);
    });
  });

  describe('matchSkill', () => {
    it('should match by regex pattern', async () => {
      await learner.saveSkill(makeSkill({ trigger: 'deploy|deployment' }));
      await learner.loadLearnedSkills();

      expect(learner.matchSkill('please deploy to production')).not.toBeNull();
      expect(learner.matchSkill('run deployment now')).not.toBeNull();
      expect(learner.matchSkill('hello world')).toBeNull();
    });

    it('should match by keyword fallback for invalid regex', async () => {
      // Use an actually invalid regex so the catch branch is triggered
      await learner.saveSkill(makeSkill({ trigger: '(deploy[broken, kubernetes' }));
      await learner.loadLearnedSkills();

      expect(learner.matchSkill('kubernetes cluster')).not.toBeNull();
      expect(learner.matchSkill('random text')).toBeNull();
    });

    it('should return null if not loaded', () => {
      expect(learner.matchSkill('deploy')).toBeNull();
    });
  });

  describe('skillToMarkdown / parseSkillMarkdown', () => {
    it('should round-trip a skill through markdown', () => {
      const skill = makeSkill();
      const md = skillToMarkdown(skill);
      const parsed = parseSkillMarkdown(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe(skill.name);
      expect(parsed!.description).toBe(skill.description);
      expect(parsed!.trigger).toBe(skill.trigger);
      expect(parsed!.instructions).toBe(skill.instructions);
      expect(parsed!.examples).toEqual(skill.examples);
      expect(parsed!.version).toBe(1);
      expect(parsed!.usageCount).toBe(0);
    });

    it('should return null for invalid markdown', () => {
      expect(parseSkillMarkdown('just some text')).toBeNull();
    });
  });
});
