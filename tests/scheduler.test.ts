import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCron, cronMatches, Scheduler } from '../src/core/scheduler';
import type { CronJob } from '../src/core/scheduler';

describe('parseCron', () => {
  it('parses "* * * * *" as all-any fields', () => {
    const p = parseCron('* * * * *');
    expect(p.minute).toEqual({ type: 'any' });
    expect(p.hour).toEqual({ type: 'any' });
    expect(p.dayOfMonth).toEqual({ type: 'any' });
    expect(p.month).toEqual({ type: 'any' });
    expect(p.dayOfWeek).toEqual({ type: 'any' });
  });

  it('parses "0 9 * * *" as minute=0, hour=9', () => {
    const p = parseCron('0 9 * * *');
    expect(p.minute).toEqual({ type: 'list', values: [0] });
    expect(p.hour).toEqual({ type: 'list', values: [9] });
  });

  it('parses "*/5 * * * *" as every-5 minutes', () => {
    const p = parseCron('*/5 * * * *');
    expect(p.minute).toEqual({ type: 'every', step: 5 });
  });

  it('parses "0 9 * * 1" for Monday 9:00', () => {
    const p = parseCron('0 9 * * 1');
    expect(p.dayOfWeek).toEqual({ type: 'list', values: [1] });
  });

  it('parses "0 9-17 * * *" as hour range 9-17', () => {
    const p = parseCron('0 9-17 * * *');
    expect(p.hour).toEqual({ type: 'list', values: [9, 10, 11, 12, 13, 14, 15, 16, 17] });
  });

  it('parses "0 9,12,18 * * *" as specific hours', () => {
    const p = parseCron('0 9,12,18 * * *');
    expect(p.hour).toEqual({ type: 'list', values: [9, 12, 18] });
  });

  it('throws on invalid cron expression with wrong field count', () => {
    expect(() => parseCron('* * *')).toThrow('Invalid cron expression');
  });

  it('throws on invalid step value', () => {
    expect(() => parseCron('*/abc * * * *')).toThrow();
  });

  it('throws on invalid range', () => {
    expect(() => parseCron('a-b * * * *')).toThrow();
  });

  it('parses "30 */2 * * *" correctly', () => {
    const p = parseCron('30 */2 * * *');
    expect(p.minute).toEqual({ type: 'list', values: [30] });
    expect(p.hour).toEqual({ type: 'every', step: 2 });
  });
});

describe('cronMatches', () => {
  it('"* * * * *" matches any date', () => {
    const p = parseCron('* * * * *');
    expect(cronMatches(p, new Date('2026-04-18T10:30:00'))).toBe(true);
  });

  it('"0 9 * * *" matches 9:00 but not 10:00', () => {
    const p = parseCron('0 9 * * *');
    expect(cronMatches(p, new Date('2026-04-18T09:00:00'))).toBe(true);
    expect(cronMatches(p, new Date('2026-04-18T10:00:00'))).toBe(false);
    expect(cronMatches(p, new Date('2026-04-18T09:05:00'))).toBe(false);
  });

  it('"*/5 * * * *" matches minutes divisible by 5', () => {
    const p = parseCron('*/5 * * * *');
    expect(cronMatches(p, new Date('2026-04-18T10:00:00'))).toBe(true);
    expect(cronMatches(p, new Date('2026-04-18T10:05:00'))).toBe(true);
    expect(cronMatches(p, new Date('2026-04-18T10:03:00'))).toBe(false);
  });

  it('"0 9 * * 1" matches Monday 9:00 only', () => {
    const p = parseCron('0 9 * * 1');
    // 2026-04-20 is Monday
    expect(cronMatches(p, new Date('2026-04-20T09:00:00'))).toBe(true);
    // 2026-04-18 is Saturday
    expect(cronMatches(p, new Date('2026-04-18T09:00:00'))).toBe(false);
  });

  it('"0 9-17 * * *" matches hours 9 through 17', () => {
    const p = parseCron('0 9-17 * * *');
    expect(cronMatches(p, new Date('2026-04-18T09:00:00'))).toBe(true);
    expect(cronMatches(p, new Date('2026-04-18T17:00:00'))).toBe(true);
    expect(cronMatches(p, new Date('2026-04-18T08:00:00'))).toBe(false);
    expect(cronMatches(p, new Date('2026-04-18T18:00:00'))).toBe(false);
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = vi.fn();
    scheduler = new Scheduler(handler);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  const makeJob = (id: string, schedule = '* * * * *', enabled = true): CronJob => ({
    id, name: `job-${id}`, schedule, task: `task-${id}`, enabled,
  });

  it('addJob adds a job retrievable by getJobs', () => {
    scheduler.addJob(makeJob('j1'));
    expect(scheduler.getJobs()).toHaveLength(1);
    expect(scheduler.getJobs()[0].id).toBe('j1');
  });

  it('removeJob removes a job', () => {
    scheduler.addJob(makeJob('j1'));
    scheduler.removeJob('j1');
    expect(scheduler.getJobs()).toHaveLength(0);
  });

  it('enableJob / disableJob toggles enabled', () => {
    scheduler.addJob(makeJob('j1', '* * * * *', false));
    expect(scheduler.getJob('j1')!.enabled).toBe(false);
    scheduler.enableJob('j1');
    expect(scheduler.getJob('j1')!.enabled).toBe(true);
    scheduler.disableJob('j1');
    expect(scheduler.getJob('j1')!.enabled).toBe(false);
  });

  it('getJobs returns all jobs', () => {
    scheduler.addJob(makeJob('j1'));
    scheduler.addJob(makeJob('j2'));
    scheduler.addJob(makeJob('j3'));
    expect(scheduler.getJobs()).toHaveLength(3);
  });

  it('start begins ticking (handler called on matching cron)', () => {
    vi.setSystemTime(new Date('2026-04-18T10:00:00'));
    scheduler.addJob(makeJob('j1', '* * * * *'));
    scheduler.start();
    // tick() called immediately on start
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stop stops ticking', () => {
    vi.setSystemTime(new Date('2026-04-18T10:00:00'));
    scheduler.addJob(makeJob('j1', '* * * * *'));
    scheduler.start();
    handler.mockClear();
    scheduler.stop();
    vi.advanceTimersByTime(120_000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('disabled job is not fired', () => {
    vi.setSystemTime(new Date('2026-04-18T10:00:00'));
    scheduler.addJob(makeJob('j1', '* * * * *', false));
    scheduler.start();
    expect(handler).not.toHaveBeenCalled();
  });

  it('double-fire prevention within same minute', () => {
    vi.setSystemTime(new Date('2026-04-18T10:00:00'));
    scheduler.addJob(makeJob('j1', '* * * * *'));
    scheduler.start();
    expect(handler).toHaveBeenCalledTimes(1);
    // Advance 30 seconds (still same minute), force another tick
    vi.advanceTimersByTime(30_000);
    // No additional call because same minute
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('job fires again in next minute', () => {
    vi.setSystemTime(new Date('2026-04-18T10:00:00'));
    scheduler.addJob(makeJob('j1', '* * * * *'));
    scheduler.start();
    expect(handler).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('runJob fires handler immediately', async () => {
    scheduler.addJob(makeJob('j1', '0 0 1 1 *')); // rare schedule
    const result = await scheduler.runJob('j1');
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runJob returns false for unknown job', async () => {
    const result = await scheduler.runJob('nonexistent');
    expect(result).toBe(false);
  });
});
