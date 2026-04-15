import { describe, it, expect } from 'vitest';
import { ConnectionPool, RequestBatcher, LazyLoader } from '../src/core/performance';

describe('ConnectionPool', () => {
  it('should acquire and release connections', () => {
    const pool = new ConnectionPool(3);
    const conn = pool.acquire('openai');
    expect(conn.inUse).toBe(true);
    pool.release(conn.id);
    const stats = pool.getStats();
    expect(stats['openai'].total).toBe(1);
    expect(stats['openai'].inUse).toBe(0);
  });

  it('should reuse released connections', () => {
    const pool = new ConnectionPool(2);
    const c1 = pool.acquire('openai');
    pool.release(c1.id);
    const c2 = pool.acquire('openai');
    expect(c2.id).toBe(c1.id);
  });

  it('should drain all connections', () => {
    const pool = new ConnectionPool();
    pool.acquire('openai');
    pool.acquire('deepseek');
    pool.drain();
    expect(pool.getStats()).toEqual({});
  });
});

describe('RequestBatcher', () => {
  it('should batch requests', async () => {
    const batcher = new RequestBatcher<string>(
      async (batch) => batch.map(s => s.toUpperCase()),
      2,
      10,
    );

    const [r1, r2] = await Promise.all([
      batcher.add('hello'),
      batcher.add('world'),
    ]);
    expect(r1).toBe('HELLO');
    expect(r2).toBe('WORLD');
  });

  it('should flush on timer', async () => {
    const batcher = new RequestBatcher<number>(
      async (batch) => batch.map(n => n * 2),
      10,
      20,
    );

    const result = await batcher.add(5);
    expect(result).toBe(10);
  });

  it('should track pending count', () => {
    const batcher = new RequestBatcher<string>(
      async (batch) => batch,
      100,
      10000,
    );
    batcher.add('a');
    batcher.add('b');
    expect(batcher.pending).toBe(2);
  });
});

describe('LazyLoader', () => {
  it('should lazily load items', async () => {
    const loader = new LazyLoader<string>();
    let loadCount = 0;
    loader.register('greeting', async () => { loadCount++; return 'hello'; });

    expect(loader.isLoaded('greeting')).toBe(false);
    const val = await loader.get('greeting');
    expect(val).toBe('hello');
    expect(loader.isLoaded('greeting')).toBe(true);

    // Second call should use cache
    await loader.get('greeting');
    expect(loadCount).toBe(1);
  });

  it('should throw for unregistered items', async () => {
    const loader = new LazyLoader();
    await expect(loader.get('unknown')).rejects.toThrow('No loader registered');
  });

  it('should evict and reload', async () => {
    const loader = new LazyLoader<number>();
    let count = 0;
    loader.register('counter', async () => ++count);
    
    await loader.get('counter');
    expect(loader.loadedCount).toBe(1);
    loader.evict('counter');
    expect(loader.loadedCount).toBe(0);
    await loader.get('counter');
    expect(count).toBe(2);
  });

  it('should clear all', async () => {
    const loader = new LazyLoader<string>();
    loader.register('a', async () => 'a');
    loader.register('b', async () => 'b');
    await loader.get('a');
    await loader.get('b');
    loader.clear();
    expect(loader.loadedCount).toBe(0);
    expect(loader.registeredCount).toBe(2);
  });
});
