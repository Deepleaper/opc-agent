/**
 * Security Hardening Module - v1.0.0
 * Input sanitization, CORS, security headers, API key rotation.
 */

import type { Request, Response, NextFunction } from 'express';

// ── Input Sanitization ──────────────────────────────────────

const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /<form\b/gi,
];

const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|TABLE|SET|WHERE|ALL)\b)/gi,
  /(--|;)\s*(DROP|ALTER|DELETE)/gi,
];

export function sanitizeInput(input: string): string {
  let clean = input;
  for (const pattern of XSS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  // Encode dangerous HTML entities
  clean = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return clean;
}

export function detectInjection(input: string): { safe: boolean; threats: string[] } {
  const threats: string[] = [];
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) threats.push('xss');
    pattern.lastIndex = 0;
  }
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(input)) threats.push('sql_injection');
    pattern.lastIndex = 0;
  }
  return { safe: threats.length === 0, threats: [...new Set(threats)] };
}

// ── Security Headers (Helmet-style) ────────────────────────

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  enableHSTS?: boolean;
  frameDeny?: boolean;
  xssProtection?: boolean;
  noSniff?: boolean;
  referrerPolicy?: string;
}

export function securityHeaders(config?: SecurityHeadersConfig) {
  const csp = config?.contentSecurityPolicy ?? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'";
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', config?.frameDeny !== false ? 'DENY' : 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', config?.referrerPolicy ?? 'strict-origin-when-cross-origin');
    if (config?.enableHSTS !== false) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.removeHeader('X-Powered-By');
    next();
  };
}

// ── CORS Configuration ──────────────────────────────────────

export interface CORSConfig {
  origins?: string[];
  methods?: string[];
  allowHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function corsMiddleware(config?: CORSConfig) {
  const origins = config?.origins ?? ['*'];
  const methods = config?.methods ?? ['GET', 'POST', 'OPTIONS'];
  const headers = config?.allowHeaders ?? ['Content-Type', 'Authorization'];

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin ?? '';
    if (origins.includes('*') || origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origins.includes('*') ? '*' : origin);
    }
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
    if (config?.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (config?.maxAge) res.setHeader('Access-Control-Max-Age', String(config.maxAge));
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  };
}

// ── API Key Rotation ────────────────────────────────────────

export interface APIKeyEntry {
  key: string;
  label?: string;
  createdAt: number;
  expiresAt?: number;
  active: boolean;
}

export class APIKeyManager {
  private keys: APIKeyEntry[] = [];

  addKey(key: string, opts?: { label?: string; expiresAt?: number }): void {
    this.keys.push({ key, label: opts?.label, createdAt: Date.now(), expiresAt: opts?.expiresAt, active: true });
  }

  revokeKey(key: string): boolean {
    const entry = this.keys.find(k => k.key === key);
    if (entry) { entry.active = false; return true; }
    return false;
  }

  isValid(key: string): boolean {
    const entry = this.keys.find(k => k.key === key);
    if (!entry || !entry.active) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) { entry.active = false; return false; }
    return true;
  }

  rotateKey(oldKey: string, newKey: string): boolean {
    const entry = this.keys.find(k => k.key === oldKey && k.active);
    if (!entry) return false;
    entry.active = false;
    this.addKey(newKey, { label: entry.label });
    return true;
  }

  listActive(): APIKeyEntry[] {
    return this.keys.filter(k => k.active && (!k.expiresAt || Date.now() <= k.expiresAt));
  }

  cleanup(): number {
    const before = this.keys.length;
    this.keys = this.keys.filter(k => k.active && (!k.expiresAt || Date.now() <= k.expiresAt));
    return before - this.keys.length;
  }
}

// ── Input Validation Middleware ──────────────────────────────

export function inputValidation() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body?.message && typeof req.body.message === 'string') {
      const check = detectInjection(req.body.message);
      if (!check.safe) {
        res.status(400).json({ error: 'Input contains potentially unsafe content', threats: check.threats });
        return;
      }
      // Limit message size
      if (req.body.message.length > 100_000) {
        res.status(413).json({ error: 'Message too large (max 100KB)' });
        return;
      }
    }
    next();
  };
}
