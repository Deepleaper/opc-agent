/**
 * Agent Marketplace - Package, publish, and install agents
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

export interface AgentManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  oadVersion: string;
  channels: string[];
  skills: string[];
  files: string[];
  checksum: string;
  publishedAt: string;
  homepage?: string;
  repository?: string;
  tags?: string[];
}

export interface PublishOptions {
  oadPath: string;
  outputDir?: string;
  includeKnowledge?: boolean;
}

export interface InstallOptions {
  source: string; // local path or URL
  targetDir?: string;
}

function computeChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function publishAgent(options: PublishOptions): Promise<{ archivePath: string; manifest: AgentManifest }> {
  const { oadPath, outputDir = '.', includeKnowledge = false } = options;
  const absOad = path.resolve(oadPath);
  const baseDir = path.dirname(absOad);

  if (!fs.existsSync(absOad)) {
    throw new Error(`OAD file not found: ${absOad}`);
  }

  // Dynamic import yaml
  const yaml = await import('js-yaml');
  const oadContent = fs.readFileSync(absOad, 'utf-8');
  const oad = yaml.load(oadContent) as any;

  const name = oad.metadata?.name ?? 'unnamed-agent';
  const version = oad.metadata?.version ?? '0.0.0';
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Collect files to package
  const filesToPack: { rel: string; abs: string }[] = [
    { rel: path.basename(absOad), abs: absOad },
  ];

  // Include common files
  const extras = ['.env.example', 'README.md', 'package.json'];
  for (const f of extras) {
    const fp = path.join(baseDir, f);
    if (fs.existsSync(fp)) {
      filesToPack.push({ rel: f, abs: fp });
    }
  }

  // Include knowledge base if requested
  if (includeKnowledge) {
    const kbFile = path.join(baseDir, '.opc-knowledge.json');
    if (fs.existsSync(kbFile)) {
      filesToPack.push({ rel: '.opc-knowledge.json', abs: kbFile });
    }
  }

  // Include prompts directory if exists
  const promptsDir = path.join(baseDir, 'prompts');
  if (fs.existsSync(promptsDir) && fs.statSync(promptsDir).isDirectory()) {
    const promptFiles = fs.readdirSync(promptsDir);
    for (const pf of promptFiles) {
      filesToPack.push({ rel: `prompts/${pf}`, abs: path.join(promptsDir, pf) });
    }
  }

  // Build manifest
  const manifest: AgentManifest = {
    name: safeName,
    version,
    description: oad.metadata?.description ?? '',
    author: oad.metadata?.author ?? '',
    license: oad.metadata?.license ?? 'Apache-2.0',
    oadVersion: 'opc/v1',
    channels: (oad.spec?.channels ?? []).map((c: any) => c.type),
    skills: (oad.spec?.skills ?? []).map((s: any) => s.name),
    files: filesToPack.map(f => f.rel),
    checksum: '',
    publishedAt: new Date().toISOString(),
    tags: oad.metadata?.marketplace?.tags,
  };

  // Create staging directory
  const stageDir = path.join(outputDir, `.opc-stage-${safeName}`);
  fs.mkdirSync(stageDir, { recursive: true });

  for (const f of filesToPack) {
    const dest = path.join(stageDir, f.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
  }

  // Write manifest
  fs.writeFileSync(path.join(stageDir, 'opc-manifest.json'), JSON.stringify(manifest, null, 2));

  // Create tar.gz
  const archiveName = `${safeName}-${version}.tar.gz`;
  const archivePath = path.join(outputDir, archiveName);

  try {
    execSync(`tar -czf "${archivePath}" -C "${stageDir}" .`, { stdio: 'pipe' });
  } catch {
    // Fallback: just zip the directory content list
    // On Windows without tar, create a simple zip-like package
    const packageData = {
      manifest,
      files: filesToPack.map(f => ({
        path: f.rel,
        content: fs.readFileSync(f.abs, 'utf-8'),
      })),
    };
    fs.writeFileSync(
      archivePath.replace('.tar.gz', '.opc.json'),
      JSON.stringify(packageData, null, 2),
    );
  }

  // Compute checksum
  if (fs.existsSync(archivePath)) {
    manifest.checksum = computeChecksum(archivePath);
  }

  // Cleanup staging
  fs.rmSync(stageDir, { recursive: true, force: true });

  // Write final manifest
  fs.writeFileSync(
    path.join(outputDir, 'opc-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  return { archivePath: fs.existsSync(archivePath) ? archivePath : archivePath.replace('.tar.gz', '.opc.json'), manifest };
}

export async function installAgent(options: InstallOptions): Promise<{ dir: string; manifest: AgentManifest }> {
  const { source, targetDir } = options;
  const absSource = path.resolve(source);

  if (!fs.existsSync(absSource)) {
    throw new Error(`Package not found: ${absSource}`);
  }

  let manifest: AgentManifest;
  let installDir: string;

  if (absSource.endsWith('.opc.json')) {
    // JSON package format
    const pkg = JSON.parse(fs.readFileSync(absSource, 'utf-8'));
    manifest = pkg.manifest;
    installDir = targetDir ?? path.join('.', manifest.name);
    fs.mkdirSync(installDir, { recursive: true });

    for (const f of pkg.files) {
      const dest = path.join(installDir, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, f.content, 'utf-8');
    }
    fs.writeFileSync(path.join(installDir, 'opc-manifest.json'), JSON.stringify(manifest, null, 2));
  } else {
    // tar.gz format
    const tmpDir = path.join(path.dirname(absSource), '.opc-extract-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      execSync(`tar -xzf "${absSource}" -C "${tmpDir}"`, { stdio: 'pipe' });
    } catch {
      throw new Error('Failed to extract package. Ensure tar is available.');
    }

    const manifestPath = path.join(tmpDir, 'opc-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw new Error('Invalid package: missing opc-manifest.json');
    }

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    installDir = targetDir ?? path.join('.', manifest.name);

    // Move files
    fs.mkdirSync(installDir, { recursive: true });
    const copyRecursive = (src: string, dest: string) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    copyRecursive(tmpDir, installDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { dir: installDir, manifest };
}
