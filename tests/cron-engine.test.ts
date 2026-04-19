import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronEngine, frequencyToCron } from '../src/scheduler/cron-engine';
import type { ScheduleTask } from '../src/scheduler/cron-engine';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

describe('CronEngine', () => {
  let engine: CronEngine;
  const schedulesPath = join(os.homedir(), '.opc', 'schedules.json');

  beforeEach(() => {
    engine = new CronEngine(async () => {});
  });

  afterEach(() => {
    engine.stop();
  });

  describe('frequencyToCron', () => {
    it('converts daily + time to cron', () => {
      expect(frequencyToCron('daily', '08:30')).toBe('30 8 * * *');
    });

    it('converts weekly to Monday cron', () => {
      expect(frequencyToCron('weekly', '09:00')).toBe('0 9 * * 1');
    });

    it('converts monthly to 1st of month', () => {
      expect(frequencyToCron('monthly', '10:15')).toBe('15 10 1 * *');
    });

    it('defaults to 9:00 when no time given', () => {
      expect(frequencyToCron('daily')).toBe('0 9 * * *');
    });
  });

  describe('CRUD operations', () => {
    it('creates a task', () => {
      const task = engine.createTask({
        name: 'Test Task',
        schedule: '0 9 * * *',
        description: 'Test description',
        frequency: 'daily',
        time: '09:00',
        outputChannel: 'web',
        enabled: true,
      });
      expect(task.id).toBeTruthy();
      expect(task.name).toBe('Test Task');
      expect(task.createdAt).toBeTruthy();
    });

    it('lists tasks', () => {
      engine.createTask({ name: 'A', schedule: '0 9 * * *', description: '', frequency: 'daily', outputChannel: 'web', enabled: true });
      engine.createTask({ name: 'B', schedule: '0 10 * * *', description: '', frequency: 'daily', outputChannel: 'telegram', enabled: false });
      const tasks = engine.listTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('updates a task', () => {
      const task = engine.createTask({ name: 'Original', schedule: '0 9 * * *', description: '', frequency: 'daily', outputChannel: 'web', enabled: true });
      const updated = engine.updateTask(task.id, { name: 'Updated', enabled: false });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
      expect(updated!.enabled).toBe(false);
    });

    it('deletes a task', () => {
      const task = engine.createTask({ name: 'ToDelete', schedule: '0 9 * * *', description: '', frequency: 'daily', outputChannel: 'web', enabled: true });
      expect(engine.deleteTask(task.id)).toBe(true);
      expect(engine.getTask(task.id)).toBeUndefined();
    });

    it('returns false for deleting non-existent task', () => {
      expect(engine.deleteTask('nonexistent')).toBe(false);
    });

    it('returns null for updating non-existent task', () => {
      expect(engine.updateTask('nonexistent', { name: 'x' })).toBeNull();
    });
  });

  describe('run task', () => {
    it('runs a task immediately', async () => {
      const handler = vi.fn();
      const eng = new CronEngine(handler);
      const task = eng.createTask({ name: 'RunMe', schedule: '0 9 * * *', description: 'test', frequency: 'daily', outputChannel: 'web', enabled: true });
      eng.start();
      const result = await eng.runTask(task.id);
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
      eng.stop();
    });

    it('returns false for running non-existent task', async () => {
      const result = await engine.runTask('nonexistent');
      expect(result).toBe(false);
    });
  });
});
