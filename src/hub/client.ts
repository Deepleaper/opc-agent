/**
 * Workstation Hub API client
 * Fetches agent templates and brain-seed knowledge from the Hub.
 */

const HUB_URL = process.env.OPC_HUB_URL || 'https://hub.deepleaper.com';
const HUB_TIMEOUT = 5000;

export interface HubTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
}

export interface HubTemplateDetail extends HubTemplate {
  files: Record<string, string>;
  brainSeeds: HubBrainSeed[];
}

export interface HubBrainSeed {
  filename: string;
  content: string;
  tier: 'industry' | 'job' | 'workstation';
}

async function hubFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HUB_TIMEOUT);
  try {
    const res = await fetch(`${HUB_URL}${path}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'opc-agent/2.0' },
    });
    if (!res.ok) throw new Error(`Hub API ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTemplates(query?: string): Promise<HubTemplate[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  return hubFetch<HubTemplate[]>(`/api/templates${qs}`);
}

export async function fetchTemplate(id: string): Promise<HubTemplateDetail> {
  return hubFetch<HubTemplateDetail>(`/api/templates/${encodeURIComponent(id)}`);
}

export async function fetchBrainSeeds(templateId: string): Promise<HubBrainSeed[]> {
  return hubFetch<HubBrainSeed[]>(`/api/templates/${encodeURIComponent(templateId)}/brain-seeds`);
}

export function isHubAvailable(): Promise<boolean> {
  return hubFetch<{ ok: boolean }>('/api/health')
    .then(() => true)
    .catch(() => false);
}
