/**
 * 智能模型推荐引擎
 * - 远程模型列表 (GitHub) + 本地缓存 (24h) + 硬编码 fallback
 * - 根据系统硬件自动推荐最适合的模型
 */
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface ModelRec {
  name: string;
  size: string;
  minRAM: number;
  desc: string;
  descEn?: string;
  tier: number;
  lang?: string[];
  useCase?: string[];
  speed?: string;
  recommended?: boolean;
}

interface ModelList {
  version: string;
  lastUpdated: string;
  nextReview: string;
  models: ModelRec[];
}

interface SystemInfo {
  totalRAM: number;   // GB
  freeRAM: number;    // GB
  cpuCount: number;
  platform: string;
  arch: string;
}

const REMOTE_URL = 'https://raw.githubusercontent.com/Deepleaper/opc-agent/main/models.json';
const CACHE_FILE = '.opc-models-cache.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Hardcoded fallback (same as models.json, kept in sync)
const FALLBACK_MODELS: ModelRec[] = [
  { name: 'qwen2.5:0.5b', size: '0.4GB', minRAM: 2, desc: '超轻量，适合低配机器', tier: 1 },
  { name: 'qwen2.5:1.5b', size: '1.0GB', minRAM: 4, desc: '轻量但更智能', tier: 1 },
  { name: 'qwen2.5:3b', size: '2.0GB', minRAM: 6, desc: '性价比最优', tier: 2 },
  { name: 'llama3.2:3b', size: '2.0GB', minRAM: 6, desc: 'Meta 最新轻量模型', tier: 2 },
  { name: 'phi3:mini', size: '2.3GB', minRAM: 6, desc: '微软高效小模型', tier: 2 },
  { name: 'qwen2.5:7b', size: '4.7GB', minRAM: 8, desc: '推荐：中文最强 7B', tier: 3, recommended: true },
  { name: 'llama3.1:8b', size: '4.7GB', minRAM: 8, desc: 'Meta 通用 8B', tier: 3 },
  { name: 'mistral:7b', size: '4.1GB', minRAM: 8, desc: 'Mistral 经典 7B', tier: 3 },
  { name: 'gemma2:9b', size: '5.4GB', minRAM: 10, desc: 'Google 高效 9B', tier: 3 },
  { name: 'qwen2.5-coder:7b', size: '4.7GB', minRAM: 8, desc: '编程专用 7B', tier: 3 },
  { name: 'qwen2.5:14b', size: '9.0GB', minRAM: 16, desc: '中文强力 14B', tier: 4 },
  { name: 'deepseek-coder-v2:16b', size: '9.0GB', minRAM: 16, desc: '编程专用 16B', tier: 4 },
  { name: 'qwen2.5:32b', size: '20GB', minRAM: 32, desc: '接近 GPT-4 水平', tier: 5, recommended: true },
  { name: 'llama3.1:70b', size: '40GB', minRAM: 64, desc: '开源最强', tier: 6 },
];

function getCachePath(): string {
  return path.join(os.homedir(), CACHE_FILE);
}

function readCache(): ModelList | null {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) return null;
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL) return null; // expired
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    if (!data.models || !Array.isArray(data.models)) return null;
    return data;
  } catch { return null; }
}

function writeCache(data: ModelList): void {
  try {
    fs.writeFileSync(getCachePath(), JSON.stringify(data, null, 2));
  } catch { /* best effort */ }
}

export async function fetchModelList(): Promise<ModelRec[]> {
  // 1. Try cache
  const cached = readCache();
  if (cached) return cached.models;

  // 2. Try remote
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(REMOTE_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as ModelList;
      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        writeCache(data);
        return data.models;
      }
    }
  } catch { /* fallback */ }

  // 3. Fallback
  return FALLBACK_MODELS;
}

export function detectSystem(): SystemInfo {
  return {
    totalRAM: Math.round(os.totalmem() / (1024 ** 3)),
    freeRAM: Math.round(os.freemem() / (1024 ** 3)),
    cpuCount: os.cpus().length,
    platform: os.platform(),
    arch: os.arch(),
  };
}

export function recommendModels(
  models: ModelRec[],
  sys: SystemInfo,
  installedModels: string[] = [],
  opts: { useCase?: string; lang?: string } = {},
): {
  suitable: ModelRec[];
  best: ModelRec;
  installed: ModelRec[];
  toDownload: ModelRec[];
} {
  const availableRAM = sys.freeRAM + 2; // +2GB tolerance

  // Filter by hardware
  let suitable = models.filter(m => m.minRAM <= availableRAM);
  if (suitable.length === 0) suitable = [models[0]]; // always have at least one

  // Optional: filter by use case
  if (opts.useCase) {
    const filtered = suitable.filter(m => m.useCase?.includes(opts.useCase!));
    if (filtered.length > 0) suitable = filtered;
  }

  // Optional: filter by language
  if (opts.lang) {
    const filtered = suitable.filter(m => m.lang?.includes(opts.lang!));
    if (filtered.length > 0) suitable = filtered;
  }

  // Best = highest tier that fits, prefer 'recommended' flag
  const recommended = suitable.filter(m => m.recommended);
  const best = recommended.length > 0
    ? recommended[recommended.length - 1]
    : suitable[suitable.length - 1];

  // Split installed vs to-download
  const installedSet = new Set(installedModels);
  const installed = suitable.filter(m => installedSet.has(m.name));
  const toDownload = suitable.filter(m => !installedSet.has(m.name)).slice(-3); // top 3 recommendations

  return { suitable, best, installed, toDownload };
}

/** Invalidate cache so next fetchModelList() re-downloads */
export function clearModelCache(): boolean {
  try {
    const p = getCachePath();
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
    return false;
  } catch { return false; }
}

/** Get cache info */
export function cacheInfo(): { exists: boolean; age?: string; version?: string } {
  try {
    const p = getCachePath();
    if (!fs.existsSync(p)) return { exists: false };
    const stat = fs.statSync(p);
    const ageMs = Date.now() - stat.mtimeMs;
    const hours = Math.round(ageMs / (60 * 60 * 1000));
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { exists: true, age: `${hours}h ago`, version: data.version };
  } catch { return { exists: false }; }
}
