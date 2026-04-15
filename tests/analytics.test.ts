import { describe, it, expect } from 'vitest';
import { Analytics } from '../src/analytics';

describe('Analytics', () => {
  it('should track messages', () => {
    const analytics = new Analytics();
    analytics.recordMessage(100);
    analytics.recordMessage(200);
    const snap = analytics.getSnapshot();
    expect(snap.messagesProcessed).toBe(2);
    expect(snap.avgResponseTimeMs).toBe(150);
  });

  it('should track skill usage', () => {
    const analytics = new Analytics();
    analytics.recordSkillUsage('faq');
    analytics.recordSkillUsage('faq');
    analytics.recordSkillUsage('handoff');
    const snap = analytics.getSnapshot();
    expect(snap.skillUsage['faq']).toBe(2);
    expect(snap.skillUsage['handoff']).toBe(1);
  });

  it('should track errors', () => {
    const analytics = new Analytics();
    analytics.recordError();
    analytics.recordError();
    expect(analytics.getSnapshot().errorCount).toBe(2);
  });

  it('should track token usage', () => {
    const analytics = new Analytics();
    analytics.recordTokens(100, 50);
    analytics.recordTokens(200, 100);
    const snap = analytics.getSnapshot();
    expect(snap.tokenUsage.input).toBe(300);
    expect(snap.tokenUsage.output).toBe(150);
    expect(snap.tokenUsage.total).toBe(450);
  });

  it('should reset analytics', () => {
    const analytics = new Analytics();
    analytics.recordMessage(100);
    analytics.recordError();
    analytics.reset();
    const snap = analytics.getSnapshot();
    expect(snap.messagesProcessed).toBe(0);
    expect(snap.errorCount).toBe(0);
  });
});
