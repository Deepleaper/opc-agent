import type { Request, Response, NextFunction } from 'express';

export interface AuthConfig {
  apiKeys: string[];
  sessionIsolation?: boolean;
}

export interface AuthSession {
  apiKey: string;
  userId: string;
  createdAt: number;
}

const sessions = new Map<string, AuthSession>();

export function createAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth for non-API routes and health/metrics
    if (!req.path.startsWith('/api/') || req.path === '/api/health' || req.path === '/api/metrics') {
      next();
      return;
    }

    const apiKey = req.headers['x-api-key'] as string
      ?? req.headers['authorization']?.replace(/^Bearer\s+/i, '')
      ?? (req.query as any).apiKey;

    if (!apiKey || !config.apiKeys.includes(apiKey)) {
      res.status(401).json({ error: 'Unauthorized. Provide a valid API key via X-API-Key header, Bearer token, or ?apiKey query.' });
      return;
    }

    // Derive userId from API key for session isolation
    const userId = `user_${hashKey(apiKey)}`;
    if (!sessions.has(apiKey)) {
      sessions.set(apiKey, { apiKey, userId, createdAt: Date.now() });
    }

    // Attach user info to request
    (req as any).userId = userId;
    (req as any).sessionPrefix = config.sessionIsolation ? `${userId}:` : '';

    next();
  };
}

function hashKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function getActiveSessions(): AuthSession[] {
  return Array.from(sessions.values());
}
