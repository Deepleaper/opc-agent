import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

// ── Versioning Types ────────────────────────────────────────

export interface VersionEntry {
  version: string;
  timestamp: number;
  description?: string;
  oadSnapshot: string; // serialized OAD YAML
}

export interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: (oad: Record<string, unknown>) => Record<string, unknown>;
}

// ── Version Manager ─────────────────────────────────────────

export class VersionManager {
  private versions: VersionEntry[] = [];
  private migrations: Migration[] = [];
  private storePath: string;
  private logger = new Logger('versioning');

  constructor(storePath?: string) {
    this.storePath = storePath ?? '.opc-versions.json';
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        this.versions = data.versions ?? [];
      }
    } catch {
      this.versions = [];
    }
  }

  private save(): void {
    fs.writeFileSync(this.storePath, JSON.stringify({ versions: this.versions }, null, 2));
  }

  snapshot(version: string, oadYaml: string, description?: string): void {
    this.versions.push({
      version,
      timestamp: Date.now(),
      description,
      oadSnapshot: oadYaml,
    });
    this.save();
    this.logger.info('Version snapshot saved', { version });
  }

  list(): VersionEntry[] {
    return [...this.versions];
  }

  get(version: string): VersionEntry | undefined {
    return this.versions.find(v => v.version === version);
  }

  getCurrent(): VersionEntry | undefined {
    return this.versions[this.versions.length - 1];
  }

  rollback(version: string): string | null {
    const entry = this.get(version);
    if (!entry) {
      this.logger.warn('Version not found', { version });
      return null;
    }
    this.logger.info('Rolling back to version', { version });
    return entry.oadSnapshot;
  }

  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
  }

  migrate(oad: Record<string, unknown>, fromVersion: string, toVersion: string): Record<string, unknown> {
    let current = fromVersion;
    let result = { ...oad };

    while (current !== toVersion) {
      const migration = this.migrations.find(m => m.fromVersion === current);
      if (!migration) {
        throw new Error(`No migration path from ${current} to ${toVersion}`);
      }
      result = migration.migrate(result);
      current = migration.toVersion;
      this.logger.info('Migration applied', { from: migration.fromVersion, to: migration.toVersion });
    }

    return result;
  }

  clear(): void {
    this.versions = [];
    this.save();
  }
}
