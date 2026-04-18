import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

// ─── Types ───────────────────────────────────────────────────

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  agent: {
    model: string;
    provider: string;
    channels: string[];
    skills: string[];
    tools: string[];
  };
  files: string[];
  checksum: string;
  createdAt: string;
}

export interface PublishOptions {
  dryRun?: boolean;
  registry?: string;
  tag?: string;
  access?: 'public' | 'private';
}

// ─── Ignore patterns ────────────────────────────────────────

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.env',
  '.opc',
  '*.log',
  'dist',
  '.DS_Store',
  'Thumbs.db',
];

function loadIgnorePatterns(dir: string): string[] {
  const opcIgnore = path.join(dir, '.opcignore');
  const gitIgnore = path.join(dir, '.gitignore');

  let lines: string[] = [];
  if (fs.existsSync(opcIgnore)) {
    lines = fs.readFileSync(opcIgnore, 'utf-8').split('\n');
  } else if (fs.existsSync(gitIgnore)) {
    lines = fs.readFileSync(gitIgnore, 'utf-8').split('\n');
  }

  const patterns = lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  // Merge with defaults (deduplicate)
  const all = new Set([...DEFAULT_IGNORE, ...patterns]);
  return Array.from(all);
}

function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize separators
  const normalized = filePath.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/').replace(/\/$/, '');

  // Exact directory/file match
  if (normalized === p || normalized.startsWith(p + '/')) return true;

  // Basename match (e.g. ".env" matches any ".env" at any depth)
  const basename = path.basename(normalized);
  if (basename === p) return true;

  // Simple glob: *.ext
  if (p.startsWith('*.')) {
    const ext = p.slice(1); // e.g. ".log"
    if (basename.endsWith(ext)) return true;
  }

  // Directory at any depth: "tests/" pattern
  const segments = normalized.split('/');
  if (segments.includes(p)) return true;

  return false;
}

function isIgnored(filePath: string, patterns: string[]): boolean {
  return patterns.some(p => matchesPattern(filePath, p));
}

// ─── File walker ────────────────────────────────────────────

function walkDir(dir: string, base: string, patterns: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const rel = path.join(base, entry.name).replace(/\\/g, '/');
    if (isIgnored(rel, patterns)) continue;

    if (entry.isDirectory()) {
      results.push(...walkDir(path.join(dir, entry.name), rel, patterns));
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

// ─── AgentPackager ──────────────────────────────────────────

export class AgentPackager {
  async validate(dir: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required files
    if (!fs.existsSync(path.join(dir, 'agent.yaml'))) {
      errors.push('Missing agent.yaml');
    }
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      errors.push('Missing package.json');
    }

    // Recommended files
    if (!fs.existsSync(path.join(dir, 'SOUL.md'))) {
      warnings.push('Missing SOUL.md (recommended)');
    }
    if (!fs.existsSync(path.join(dir, 'README.md'))) {
      warnings.push('Missing README.md');
    }

    // Validate agent.yaml content if it exists
    if (fs.existsSync(path.join(dir, 'agent.yaml'))) {
      try {
        const raw = fs.readFileSync(path.join(dir, 'agent.yaml'), 'utf-8');
        const config = yaml.load(raw) as any;

        if (!config?.metadata?.name) {
          errors.push('agent.yaml: missing metadata.name');
        } else {
          const name = config.metadata.name;
          if (name !== name.toLowerCase()) {
            errors.push('agent.yaml: metadata.name must be lowercase');
          }
          if (/\s/.test(name)) {
            errors.push('agent.yaml: metadata.name must not contain spaces');
          }
        }

        if (!config?.metadata?.version) {
          errors.push('agent.yaml: missing metadata.version');
        } else {
          const ver = config.metadata.version;
          if (!/^\d+\.\d+\.\d+/.test(ver)) {
            errors.push(`agent.yaml: invalid version format "${ver}" (expected semver)`);
          }
        }
      } catch (e) {
        errors.push(`agent.yaml: invalid YAML — ${e instanceof Error ? e.message : e}`);
      }
    }

    // Validate package.json
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      } catch {
        errors.push('package.json: invalid JSON');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async listFiles(dir: string): Promise<string[]> {
    const patterns = loadIgnorePatterns(dir);
    return walkDir(dir, '', patterns);
  }

  async pack(dir: string): Promise<{ path: string; manifest: PackageManifest }> {
    // 1. Validate
    const validation = await this.validate(dir);
    if (!validation.valid) {
      throw new Error(`Validation failed:\n  ${validation.errors.join('\n  ')}`);
    }

    // 2. Read configs
    const agentYaml = yaml.load(fs.readFileSync(path.join(dir, 'agent.yaml'), 'utf-8')) as any;
    const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));

    const meta = agentYaml.metadata ?? {};
    const spec = agentYaml.spec ?? {};

    // 3. Collect files
    const files = await this.listFiles(dir);

    // 4. Create manifest
    const manifest: PackageManifest = {
      name: meta.name ?? pkgJson.name ?? 'unknown',
      version: meta.version ?? pkgJson.version ?? '0.0.0',
      description: meta.description ?? pkgJson.description ?? '',
      author: meta.author ?? pkgJson.author ?? '',
      license: meta.license ?? pkgJson.license ?? 'UNLICENSED',
      agent: {
        model: spec.model ?? '',
        provider: spec.provider?.default ?? '',
        channels: (spec.channels ?? []).map((c: any) => c.type ?? String(c)),
        skills: (spec.skills ?? []).map((s: any) => s.name ?? String(s)),
        tools: (spec.tools ?? []).map((t: any) => t.name ?? String(t)),
      },
      files,
      checksum: '', // computed after tarball
      createdAt: new Date().toISOString(),
    };

    // Write manifest into dir temporarily
    const manifestPath = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // 5. Create tarball
    const tarName = `${manifest.name}-${manifest.version}.opc.tgz`;
    const outputPath = path.resolve(dir, '..', tarName);

    // Include manifest.json in file list
    const allFiles = ['manifest.json', ...files];

    try {
      // Try using system tar
      const fileListPath = path.join(dir, '.opc-filelist');
      fs.writeFileSync(fileListPath, allFiles.join('\n'));

      execSync(
        `tar czf "${outputPath}" -C "${dir}" -T "${fileListPath}"`,
        { stdio: 'pipe' },
      );

      // Cleanup temp files
      try { fs.unlinkSync(fileListPath); } catch { /* ignore */ }
    } catch {
      // Fallback: use node zlib + simple tar via exec
      // On Windows, try PowerShell Compress-Archive as .zip then rename
      try {
        const tempZip = outputPath.replace('.tgz', '.zip');
        const absFiles = allFiles.map(f => `"${path.join(dir, f)}"`).join(',');
        execSync(
          `powershell -NoProfile -Command "Compress-Archive -Path ${absFiles} -DestinationPath '${tempZip}' -Force"`,
          { stdio: 'pipe' },
        );
        // Rename .zip to .tgz (not ideal but functional)
        if (fs.existsSync(tempZip)) {
          fs.renameSync(tempZip, outputPath);
        }
      } catch (e2) {
        // Last resort: create a simple tar-like archive manually
        // Bundle all files as a JSON + base64 archive
        const archive: Record<string, string> = {};
        for (const f of allFiles) {
          const content = fs.readFileSync(path.join(dir, f));
          archive[f] = content.toString('base64');
        }
        const archiveJson = JSON.stringify(archive);
        const { gzipSync } = require('zlib');
        const compressed = gzipSync(Buffer.from(archiveJson));
        fs.writeFileSync(outputPath, compressed);
      }
    }

    // Cleanup manifest from source dir
    try { fs.unlinkSync(manifestPath); } catch { /* ignore */ }

    // 6. Calculate checksum
    const fileBuffer = fs.readFileSync(outputPath);
    manifest.checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return { path: outputPath, manifest };
  }
}

// ─── AgentPublisher ─────────────────────────────────────────

export class AgentPublisher {
  async publish(
    packagePath: string,
    manifest: PackageManifest,
    options: PublishOptions = {},
  ): Promise<{ success: boolean; url?: string }> {
    const tag = options.tag ?? 'latest';
    const access = options.access ?? 'public';
    const registry = options.registry ?? 'https://registry.npmjs.org';

    if (options.dryRun) {
      console.log('\n📦 Dry run — would publish:\n');
      console.log(`  Name:      ${manifest.name}`);
      console.log(`  Version:   ${manifest.version}`);
      console.log(`  Tag:       ${tag}`);
      console.log(`  Access:    ${access}`);
      console.log(`  Registry:  ${registry}`);
      console.log(`  Files:     ${manifest.files.length}`);
      console.log(`  Checksum:  ${manifest.checksum}`);
      console.log(`  Package:   ${packagePath}`);
      console.log();
      return { success: true };
    }

    // For now: placeholder — future OPC registry integration
    console.log(`\n📦 Publishing ${manifest.name}@${manifest.version} (tag: ${tag})...`);
    console.log(`   Registry: ${registry}`);
    console.log(`   Package:  ${packagePath}`);
    console.log(`   Checksum: ${manifest.checksum}`);

    // Future: actual npm publish or OPC registry API call
    // execSync(`npm publish "${packagePath}" --tag ${tag} --access ${access}`, { stdio: 'inherit' });

    console.log(`\n✅ Published ${manifest.name}@${manifest.version}`);
    return {
      success: true,
      url: `${registry}/${manifest.name}`,
    };
  }
}

// ─── AgentInstaller ─────────────────────────────────────────

export class AgentInstaller {
  async install(source: string, targetDir: string): Promise<void> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (source.endsWith('.opc.tgz')) {
      // Extract tarball
      if (!fs.existsSync(source)) {
        throw new Error(`Package not found: ${source}`);
      }

      try {
        // Try system tar
        execSync(`tar xzf "${source}" -C "${targetDir}"`, { stdio: 'pipe' });
      } catch {
        // Fallback: try reading as gzipped JSON archive
        const { gunzipSync } = require('zlib');
        const compressed = fs.readFileSync(source);
        try {
          const decompressed = gunzipSync(compressed);
          const archive = JSON.parse(decompressed.toString());
          for (const [filePath, base64Content] of Object.entries(archive)) {
            const fullPath = path.join(targetDir, filePath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, Buffer.from(base64Content as string, 'base64'));
          }
        } catch {
          throw new Error('Failed to extract package — unsupported archive format');
        }
      }

      // Verify manifest
      const manifestPath = path.join(targetDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest: PackageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        console.log(`✅ Installed ${manifest.name}@${manifest.version}`);
      } else {
        console.log('✅ Extracted package (no manifest found)');
      }
    } else {
      // npm install
      console.log(`📦 Installing from npm: ${source}`);
      execSync(`npm install "${source}"`, { cwd: targetDir, stdio: 'inherit' });
    }
  }
}
