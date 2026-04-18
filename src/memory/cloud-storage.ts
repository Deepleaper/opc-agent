// ─── Cloud Memory Backend ────────────────────────────────────
// Fetch-based cloud storage for S3, GCS, and Azure Blob — no SDK deps.

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CloudStorageConfig {
  provider: 's3' | 'gcs' | 'azure-blob';
  bucket: string;
  prefix?: string;
  credentials?: {
    accessKey?: string;
    secretKey?: string;
    region?: string;
  };
  syncIntervalMs?: number;
}

/** Simple memory backend interface for cloud storage */
export interface CloudMemoryBackendInterface {
  upload(key: string, data: Buffer | string): Promise<string>;
  download(key: string): Promise<Buffer | null>;
  list(prefix?: string): Promise<string[]>;
  delete(key: string): Promise<boolean>;
}

export class CloudMemoryBackend implements CloudMemoryBackendInterface {
  private config: CloudStorageConfig;
  private effectivePrefix: string;

  constructor(config: CloudStorageConfig) {
    this.config = config;
    this.effectivePrefix = config.prefix ? config.prefix.replace(/\/$/, '') + '/' : '';
  }

  /** Upload data to cloud storage, returns the object URL */
  async upload(key: string, data: Buffer | string): Promise<string> {
    const fullKey = this.effectivePrefix + key;
    const body = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const url = this.buildUrl(fullKey);

    const headers = await this.buildHeaders('PUT', fullKey, body);
    const resp = await fetch(url, { method: 'PUT', headers, body });

    if (!resp.ok) {
      throw new Error(`Cloud upload failed [${resp.status}]: ${await resp.text()}`);
    }
    return url;
  }

  /** Download an object by key. Returns null if not found. */
  async download(key: string): Promise<Buffer | null> {
    const fullKey = this.effectivePrefix + key;
    const url = this.buildUrl(fullKey);
    const headers = await this.buildHeaders('GET', fullKey);

    const resp = await fetch(url, { method: 'GET', headers });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      throw new Error(`Cloud download failed [${resp.status}]: ${await resp.text()}`);
    }
    const ab = await resp.arrayBuffer();
    return Buffer.from(ab);
  }

  /** List object keys under a prefix */
  async list(prefix?: string): Promise<string[]> {
    const fullPrefix = this.effectivePrefix + (prefix ?? '');

    if (this.config.provider === 's3') {
      const listUrl = this.buildBucketUrl() + `?list-type=2&prefix=${encodeURIComponent(fullPrefix)}`;
      const headers = await this.buildHeaders('GET', '');
      const resp = await fetch(listUrl, { method: 'GET', headers });
      if (!resp.ok) return [];
      const text = await resp.text();
      // Simple XML key extraction
      const keys: string[] = [];
      const regex = /<Key>([^<]+)<\/Key>/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        keys.push(match[1]);
      }
      return keys;
    }

    if (this.config.provider === 'gcs') {
      const listUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucket}/o?prefix=${encodeURIComponent(fullPrefix)}`;
      const headers = await this.buildHeaders('GET', '');
      const resp = await fetch(listUrl, { method: 'GET', headers });
      if (!resp.ok) return [];
      const json = await resp.json() as { items?: { name: string }[] };
      return (json.items ?? []).map((i) => i.name);
    }

    // azure-blob
    const listUrl = this.buildBucketUrl() + `?restype=container&comp=list&prefix=${encodeURIComponent(fullPrefix)}`;
    const headers = await this.buildHeaders('GET', '');
    const resp = await fetch(listUrl, { method: 'GET', headers });
    if (!resp.ok) return [];
    const text = await resp.text();
    const keys: string[] = [];
    const regex = /<Name>([^<]+)<\/Name>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      keys.push(match[1]);
    }
    return keys;
  }

  /** Delete an object by key */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.effectivePrefix + key;
    const url = this.buildUrl(fullKey);
    const headers = await this.buildHeaders('DELETE', fullKey);
    const resp = await fetch(url, { method: 'DELETE', headers });
    return resp.ok || resp.status === 204;
  }

  /** Sync a local directory with the cloud bucket prefix */
  async sync(localDir: string): Promise<{ uploaded: number; downloaded: number }> {
    let uploaded = 0;
    let downloaded = 0;

    // Upload local files
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      for (const file of files) {
        const filePath = path.join(localDir, file);
        if (fs.statSync(filePath).isFile()) {
          const data = fs.readFileSync(filePath);
          await this.upload(file, data);
          uploaded++;
        }
      }
    }

    // Download remote files not present locally
    const remoteKeys = await this.list();
    for (const key of remoteKeys) {
      const baseName = key.replace(this.effectivePrefix, '');
      if (!baseName || baseName.includes('/')) continue;
      const localPath = path.join(localDir, baseName);
      if (!fs.existsSync(localPath)) {
        const data = await this.download(baseName);
        if (data) {
          fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(localPath, data);
          downloaded++;
        }
      }
    }

    return { uploaded, downloaded };
  }

  // ─── Internal helpers ──────────────────────────────────────

  private buildUrl(key: string): string {
    switch (this.config.provider) {
      case 's3': {
        const region = this.config.credentials?.region ?? 'us-east-1';
        return `https://${this.config.bucket}.s3.${region}.amazonaws.com/${key}`;
      }
      case 'gcs':
        return `https://storage.googleapis.com/${this.config.bucket}/${key}`;
      case 'azure-blob':
        return `https://${this.config.bucket}.blob.core.windows.net/${key}`;
    }
  }

  private buildBucketUrl(): string {
    switch (this.config.provider) {
      case 's3': {
        const region = this.config.credentials?.region ?? 'us-east-1';
        return `https://${this.config.bucket}.s3.${region}.amazonaws.com`;
      }
      case 'gcs':
        return `https://storage.googleapis.com/${this.config.bucket}`;
      case 'azure-blob':
        return `https://${this.config.bucket}.blob.core.windows.net`;
    }
  }

  private async buildHeaders(
    method: string,
    key: string,
    body?: Buffer,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (this.config.provider === 's3' && this.config.credentials?.accessKey) {
      // Simplified AWS Signature v4 — date + authorization placeholder
      const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateShort = date.slice(0, 8);
      const region = this.config.credentials.region ?? 'us-east-1';
      headers['x-amz-date'] = date;
      headers['x-amz-content-sha256'] = body
        ? crypto.createHash('sha256').update(body).digest('hex')
        : 'UNSIGNED-PAYLOAD';
      // Real v4 signing would go here; keeping header structure correct
      headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.config.credentials.accessKey}/${dateShort}/${region}/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=placeholder`;
    }

    if (this.config.provider === 'gcs' && this.config.credentials?.accessKey) {
      headers['Authorization'] = `Bearer ${this.config.credentials.accessKey}`;
    }

    if (this.config.provider === 'azure-blob' && this.config.credentials?.accessKey) {
      headers['x-ms-version'] = '2021-08-06';
      headers['x-ms-date'] = new Date().toUTCString();
      headers['Authorization'] = `SharedKey ${this.config.credentials.accessKey}`;
    }

    return headers;
  }
}
