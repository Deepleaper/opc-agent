import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Types ───────────────────────────────────────────────────

export interface ProfileConfig {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  [key: string]: unknown;
}

export interface Profile {
  name: string;
  config: ProfileConfig;
  createdAt: number;
  lastUsed: number;
}

// ─── ProfileManager ─────────────────────────────────────────

export class ProfileManager {
  private profilesDir: string;
  private currentName: string = 'default';

  constructor(baseDir?: string) {
    this.profilesDir = baseDir ?? path.join(os.homedir(), '.opc', 'profiles');
    this.ensureDir(this.profilesDir);

    // Load current profile pointer
    const pointerFile = path.join(this.profilesDir, '.current');
    if (fs.existsSync(pointerFile)) {
      this.currentName = fs.readFileSync(pointerFile, 'utf-8').trim();
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private profileDir(name: string): string {
    return path.join(this.profilesDir, name);
  }

  private profileFile(name: string): string {
    return path.join(this.profileDir(name), 'profile.json');
  }

  create(name: string, config: ProfileConfig = {}): Profile {
    const dir = this.profileDir(name);
    if (fs.existsSync(dir)) {
      throw new Error(`Profile '${name}' already exists`);
    }
    this.ensureDir(dir);
    // Also create memory and sessions dirs
    this.ensureDir(path.join(dir, 'memory'));
    this.ensureDir(path.join(dir, 'sessions'));

    const profile: Profile = {
      name,
      config,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    fs.writeFileSync(this.profileFile(name), JSON.stringify(profile, null, 2));
    return profile;
  }

  switch(name: string): void {
    if (!fs.existsSync(this.profileDir(name))) {
      throw new Error(`Profile '${name}' does not exist`);
    }
    this.currentName = name;
    fs.writeFileSync(path.join(this.profilesDir, '.current'), name);

    // Update lastUsed
    const profile = this.get(name);
    profile.lastUsed = Date.now();
    fs.writeFileSync(this.profileFile(name), JSON.stringify(profile, null, 2));
  }

  list(): Profile[] {
    if (!fs.existsSync(this.profilesDir)) return [];
    return fs.readdirSync(this.profilesDir)
      .filter(f => {
        const full = path.join(this.profilesDir, f);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'profile.json'));
      })
      .map(f => this.get(f));
  }

  get(name: string): Profile {
    const file = this.profileFile(name);
    if (!fs.existsSync(file)) {
      throw new Error(`Profile '${name}' not found`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  delete(name: string): void {
    if (name === this.currentName) {
      throw new Error(`Cannot delete the current active profile '${name}'`);
    }
    const dir = this.profileDir(name);
    if (!fs.existsSync(dir)) {
      throw new Error(`Profile '${name}' does not exist`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  current(): Profile {
    try {
      return this.get(this.currentName);
    } catch {
      // Auto-create default
      return this.create(this.currentName);
    }
  }
}
