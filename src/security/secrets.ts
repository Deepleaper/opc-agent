/**
 * Secrets Manager - v1.0.0
 * AES-256-GCM encrypted secrets storage with rotation, export/import.
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const TAG_LEN = 16;

export interface SecretsStore {
  version: number;
  secrets: Record<string, string>;
}

export class SecretsManager {
  private masterKey: Buffer;
  private filePath: string;
  private store: SecretsStore;

  constructor(options: { password: string; filePath?: string }) {
    this.filePath = options.filePath ?? join(homedir(), '.opc', 'secrets.enc');
    // Derive a stable key from password (we store salt in the file)
    this.masterKey = Buffer.alloc(KEY_LEN); // placeholder, set on load/init
    this.store = { version: 1, secrets: {} };
    this.init(options.password);
  }

  private init(password: string): void {
    if (existsSync(this.filePath)) {
      this.load(password);
    } else {
      const salt = randomBytes(SALT_LEN);
      this.masterKey = scryptSync(password, salt, KEY_LEN) as Buffer;
      this.store = { version: 1, secrets: {} };
      this.save(salt);
    }
  }

  private load(password: string): void {
    const data = readFileSync(this.filePath);
    const salt = data.subarray(0, SALT_LEN);
    const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const encrypted = data.subarray(SALT_LEN + IV_LEN + TAG_LEN);

    this.masterKey = scryptSync(password, salt, KEY_LEN) as Buffer;
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    this.store = JSON.parse(decrypted.toString('utf8'));
  }

  private save(salt?: Buffer): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (!salt && existsSync(this.filePath)) {
      salt = readFileSync(this.filePath).subarray(0, SALT_LEN);
    }
    if (!salt) salt = randomBytes(SALT_LEN);

    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(this.store), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    writeFileSync(this.filePath, Buffer.concat([salt, iv, tag, encrypted]));
  }

  set(key: string, value: string): void {
    this.store.secrets[key] = value;
    this.save();
  }

  get(key: string): string | undefined {
    return this.store.secrets[key];
  }

  delete(key: string): boolean {
    if (!(key in this.store.secrets)) return false;
    delete this.store.secrets[key];
    this.save();
    return true;
  }

  list(): string[] {
    return Object.keys(this.store.secrets);
  }

  has(key: string): boolean {
    return key in this.store.secrets;
  }

  /** Inject secrets into env-like object */
  inject(env: Record<string, string | undefined>, keys?: string[]): Record<string, string | undefined> {
    const toInject = keys ?? this.list();
    for (const k of toInject) {
      if (this.has(k)) env[k] = this.store.secrets[k];
    }
    return env;
  }

  /** Rotate: re-encrypt with new password */
  rotate(newPassword: string): void {
    const salt = randomBytes(SALT_LEN);
    this.masterKey = scryptSync(newPassword, salt, KEY_LEN) as Buffer;
    this.save(salt);
  }

  /** Export as encrypted buffer */
  exportEncrypted(): Buffer {
    return readFileSync(this.filePath);
  }

  /** Import from encrypted buffer (must know password) */
  static importEncrypted(data: Buffer, password: string, filePath: string): SecretsManager {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, data);
    return new SecretsManager({ password, filePath });
  }
}
