import * as crypto from 'crypto';
import type { MCPServerConfig } from '../../protocols/mcp/types';

export function createCryptoServer(): MCPServerConfig {
  return {
    name: 'crypto',
    version: '1.0.0',
    tools: [
      {
        name: 'crypto_hash',
        description: 'Generate hash of input text (md5, sha1, sha256, sha512)',
        inputSchema: { type: 'object', properties: { text: { type: 'string' }, algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'], default: 'sha256' } }, required: ['text'] },
        handler: async (args: { text: string; algorithm?: string }) => {
          const hash = crypto.createHash(args.algorithm || 'sha256').update(args.text).digest('hex');
          return { hash, algorithm: args.algorithm || 'sha256' };
        },
      },
      {
        name: 'crypto_hmac',
        description: 'Generate HMAC signature',
        inputSchema: { type: 'object', properties: { text: { type: 'string' }, key: { type: 'string' }, algorithm: { type: 'string', default: 'sha256' } }, required: ['text', 'key'] },
        handler: async (args: { text: string; key: string; algorithm?: string }) => {
          const hmac = crypto.createHmac(args.algorithm || 'sha256', args.key).update(args.text).digest('hex');
          return { hmac, algorithm: args.algorithm || 'sha256' };
        },
      },
      {
        name: 'crypto_random',
        description: 'Generate random bytes, UUID, or random number',
        inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['bytes', 'uuid', 'number'], default: 'uuid' }, length: { type: 'number', default: 32 }, min: { type: 'number' }, max: { type: 'number' } }, required: [] },
        handler: async (args: { type?: string; length?: number; min?: number; max?: number }) => {
          switch (args.type || 'uuid') {
            case 'bytes': return { value: crypto.randomBytes(args.length || 32).toString('hex') };
            case 'uuid': return { value: crypto.randomUUID() };
            case 'number': {
              const min = args.min ?? 0;
              const max = args.max ?? 100;
              return { value: min + Math.floor(Math.random() * (max - min + 1)) };
            }
            default: throw new Error('Unknown type');
          }
        },
      },
      {
        name: 'crypto_encrypt',
        description: 'Encrypt text with AES-256-GCM',
        inputSchema: { type: 'object', properties: { text: { type: 'string' }, password: { type: 'string' } }, required: ['text', 'password'] },
        handler: async (args: { text: string; password: string }) => {
          const key = crypto.scryptSync(args.password, 'opc-salt', 32);
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          let encrypted = cipher.update(args.text, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          const tag = cipher.getAuthTag().toString('hex');
          return { encrypted, iv: iv.toString('hex'), tag };
        },
      },
      {
        name: 'crypto_decrypt',
        description: 'Decrypt AES-256-GCM encrypted text',
        inputSchema: { type: 'object', properties: { encrypted: { type: 'string' }, password: { type: 'string' }, iv: { type: 'string' }, tag: { type: 'string' } }, required: ['encrypted', 'password', 'iv', 'tag'] },
        handler: async (args: { encrypted: string; password: string; iv: string; tag: string }) => {
          const key = crypto.scryptSync(args.password, 'opc-salt', 32);
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(args.iv, 'hex'));
          decipher.setAuthTag(Buffer.from(args.tag, 'hex'));
          let decrypted = decipher.update(args.encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return { decrypted };
        },
      },
    ],
  };
}
