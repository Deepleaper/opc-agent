import type { Plugin } from './index';

/**
 * Rate limiter plugin — limits messages per session using in-memory sliding window.
 */
export function createRateLimiterPlugin(maxPerMinute = 60): Plugin {
  const sessionTimestamps: Map<string, number[]> = new Map();

  return {
    name: 'rate-limiter',
    version: '1.0.0',
    description: `Rate limit messages per session (${maxPerMinute}/min)`,
    onMessage: async (msg: any, next: (m: any) => Promise<any>) => {
      const sessionId = msg.metadata?.sessionId || msg.id || 'default';
      const now = Date.now();
      const windowStart = now - 60_000;

      if (!sessionTimestamps.has(sessionId)) {
        sessionTimestamps.set(sessionId, []);
      }
      const timestamps = sessionTimestamps.get(sessionId)!;

      // Remove expired timestamps
      while (timestamps.length > 0 && timestamps[0] < windowStart) {
        timestamps.shift();
      }

      if (timestamps.length >= maxPerMinute) {
        throw new Error(`Rate limit exceeded: ${maxPerMinute} messages per minute`);
      }

      timestamps.push(now);
      return next(msg);
    },
  };
}

export const rateLimiterPlugin: Plugin = createRateLimiterPlugin(60);
