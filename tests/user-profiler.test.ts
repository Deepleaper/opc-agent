import { describe, it, expect, vi } from 'vitest';
import { UserProfiler } from '../src/memory/user-profiler';
import type { Message } from '../src/core/types';

function makeMsg(role: 'user' | 'assistant', content: string): Message {
  return { id: `msg-${Math.random()}`, role, content, timestamp: Date.now() };
}

describe('UserProfiler', () => {
  describe('observe', () => {
    it('should only process user messages', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('assistant', 'hello'));
      const profile = await p.getProfile();
      expect(profile.communication_style).toBe('unknown'); // no observations
    });

    it('should detect Chinese language preference', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', '你好，请帮我分析一下这个架构'));
      const profile = await p.getProfile();
      expect(profile.preferences.language).toBe('chinese');
    });

    it('should detect English language preference', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', 'Please help me review this code'));
      const profile = await p.getProfile();
      expect(profile.preferences.language).toBe('english');
    });

    it('should detect mixed language', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', '帮我看看这个 TypeScript 的 architecture 设计'));
      const profile = await p.getProfile();
      expect(profile.preferences.language).toBe('mixed');
    });

    it('should detect brief communication style', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', 'fix the bug'));
      await p.observe(makeMsg('user', 'deploy it'));
      await p.observe(makeMsg('user', 'check logs'));
      const profile = await p.getProfile();
      expect(profile.communication_style).toBe('brief');
    });

    it('should detect casual style', async () => {
      const p = new UserProfiler();
      // Use long-enough text so "brief" doesn't dominate, and add multiple casual signals
      await p.observe(makeMsg('user', 'lol this is so broken haha 😂 let me check what is going on here because this is really funny!! 666 amazing stuff right there'));
      await p.observe(makeMsg('user', 'haha omg 😂😂 this is hilarious, the whole thing just crashed lol 666 no way this works'));
      const profile = await p.getProfile();
      expect(profile.communication_style).toBe('casual');
    });

    it('should extract tech keywords', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', 'I need to deploy the Docker container with Kubernetes'));
      const profile = await p.getProfile();
      expect(profile.expertise_areas).toContain('Docker');
      expect(profile.expertise_areas).toContain('Kubernetes');
    });

    it('should classify how-to requests', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', 'how to deploy a React app?'));
      const profile = await p.getProfile();
      expect(profile.common_requests).toContain('how-to');
    });

    it('should classify debugging requests', async () => {
      const p = new UserProfiler();
      await p.observe(makeMsg('user', 'I got an error when building the project'));
      const profile = await p.getProfile();
      expect(profile.common_requests).toContain('debugging');
    });

    it('should learn to brain every 20 observations', async () => {
      const brain = { learn: vi.fn().mockResolvedValue(undefined) };
      const p = new UserProfiler();
      for (let i = 0; i < 20; i++) {
        await p.observe(makeMsg('user', `message ${i}`), brain);
      }
      expect(brain.learn).toHaveBeenCalledTimes(1);
      expect(brain.learn).toHaveBeenCalledWith(
        expect.any(String),
        { insight_type: 'user_profile' }
      );
    });

    it('should handle brain.learn failure gracefully', async () => {
      const brain = { learn: vi.fn().mockRejectedValue(new Error('fail')) };
      const p = new UserProfiler();
      for (let i = 0; i < 20; i++) {
        await p.observe(makeMsg('user', `message ${i}`), brain);
      }
      // Should not throw
      const profile = await p.getProfile();
      expect(profile).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should return empty profile with no observations', async () => {
      const p = new UserProfiler();
      const profile = await p.getProfile();
      expect(profile.communication_style).toBe('unknown');
      expect(profile.expertise_areas).toEqual([]);
    });

    it('should fall back to brain recall when no local data', async () => {
      const p = new UserProfiler();
      const stored = JSON.stringify({ preferences: { language: 'chinese' }, communication_style: 'brief', expertise_areas: ['React'], common_requests: [], last_updated: 1 });
      const brain = { recall: vi.fn().mockResolvedValue([stored]) };
      const profile = await p.getProfile(brain);
      expect(profile.preferences.language).toBe('chinese');
    });

    it('should handle brain recall failure', async () => {
      const p = new UserProfiler();
      const brain = { recall: vi.fn().mockRejectedValue(new Error('fail')) };
      const profile = await p.getProfile(brain);
      expect(profile.communication_style).toBe('unknown');
    });
  });

  describe('enhance', () => {
    it('should append language hint', () => {
      const p = new UserProfiler();
      const profile = { preferences: { language: 'chinese' }, communication_style: 'unknown', expertise_areas: [], common_requests: [], last_updated: 0 };
      const result = p.enhance('You are a helpful assistant.', profile);
      expect(result).toContain('Chinese');
    });

    it('should append style hint', () => {
      const p = new UserProfiler();
      const profile = { preferences: {}, communication_style: 'brief', expertise_areas: [], common_requests: [], last_updated: 0 };
      const result = p.enhance('Base prompt', profile);
      expect(result).toContain('brief');
    });

    it('should append expertise areas', () => {
      const p = new UserProfiler();
      const profile = { preferences: {}, communication_style: 'unknown', expertise_areas: ['React', 'TypeScript'], common_requests: [], last_updated: 0 };
      const result = p.enhance('Base prompt', profile);
      expect(result).toContain('React');
      expect(result).toContain('TypeScript');
    });

    it('should not modify prompt for empty profile', () => {
      const p = new UserProfiler();
      const profile = { preferences: {}, communication_style: 'unknown', expertise_areas: [], common_requests: [], last_updated: 0 };
      const result = p.enhance('Base prompt', profile);
      expect(result).toBe('Base prompt');
    });

    it('should include all hints when profile is rich', () => {
      const p = new UserProfiler();
      const profile = { preferences: { language: 'english' }, communication_style: 'detailed', expertise_areas: ['Docker'], common_requests: ['how-to'], last_updated: Date.now() };
      const result = p.enhance('Base', profile);
      expect(result).toContain('[User Profile]');
      expect(result).toContain('English');
      expect(result).toContain('detailed');
      expect(result).toContain('Docker');
      expect(result).toContain('how-to');
    });
  });
});
