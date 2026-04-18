import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

export class KeyManager {
  private keys: Map<string, string> = new Map();
  private keyFile: string;
  private secret: Buffer;

  constructor(keyFile: string = '.opc/keys.json') {
    this.keyFile = path.resolve(keyFile);
    this.secret = this.deriveSecret();
    this.load();
  }

  private deriveSecret(): Buffer {
    // Derive a key from machine-specific info (hostname + homedir)
    const machineId = `${os.hostname()}:${os.homedir()}:opc-agent-keys`;
    return crypto.createHash('sha256').update(machineId).digest();
  }

  set(name: string, value: string): void {
    this.keys.set(name, value);
    this.save();
  }

  get(name: string): string | undefined {
    return this.keys.get(name);
  }

  delete(name: string): boolean {
    const result = this.keys.delete(name);
    if (result) this.save();
    return result;
  }

  list(): string[] {
    return Array.from(this.keys.keys());
  }

  private load(): void {
    try {
      if (fs.existsSync(this.keyFile)) {
        const data = JSON.parse(fs.readFileSync(this.keyFile, 'utf-8'));
        for (const [name, encoded] of Object.entries(data)) {
          try {
            this.keys.set(name, this.decode(encoded as string));
          } catch {
            // Skip corrupted entries
          }
        }
      }
    } catch {
      // File doesn't exist or is corrupted — start fresh
    }
  }

  private save(): void {
    const dir = path.dirname(this.keyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data: Record<string, string> = {};
    for (const [name, value] of this.keys) {
      data[name] = this.encode(value);
    }
    fs.writeFileSync(this.keyFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  private encode(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.secret, iv);
    let encrypted = cipher.update(value, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decode(encoded: string): string {
    const [ivHex, encrypted] = encoded.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.secret, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
