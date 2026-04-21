import * as fs from 'fs';
import * as path from 'path';
import type { EgoConfig } from '../core/types';

// ── EGO.md ────────────────────────────────────────────────────────────────────

export async function readEgo(dir: string): Promise<EgoConfig | null> {
  const egoPath = path.join(dir, 'EGO.md');
  const soulPath = path.join(dir, 'SOUL.md');

  let raw: string | null = null;
  if (fs.existsSync(egoPath)) {
    raw = fs.readFileSync(egoPath, 'utf-8');
  } else if (fs.existsSync(soulPath)) {
    raw = fs.readFileSync(soulPath, 'utf-8');
  }
  if (!raw) return null;

  return parseEgoMd(raw);
}

function parseEgoMd(raw: string): EgoConfig {
  const sections = splitSections(raw);

  const identity = parseKeyValues(sections['identity'] ?? sections['Identity'] ?? '');
  const role = (sections['role'] ?? sections['Role'] ?? '').trim();
  const principles = parseList(sections['principles'] ?? sections['Principles'] ?? '');
  const evolutionGoals = parseList(
    sections['evolution goals'] ??
    sections['Evolution Goals'] ??
    sections['evolutiongoals'] ??
    ''
  );
  const egoContext = (
    sections['context'] ?? sections['Context'] ??
    sections['ego context'] ?? sections['Ego Context'] ?? ''
  ).trim();

  return {
    identity: {
      name: String(identity['name'] ?? identity['Name'] ?? 'Agent'),
      creature: String(identity['creature'] ?? identity['Creature'] ?? 'robot'),
      emoji: String(identity['emoji'] ?? identity['Emoji'] ?? '🤖'),
    },
    role,
    principles,
    evolutionGoals,
    egoContext,
  };
}

// ── DEEPBRAIN.md ──────────────────────────────────────────────────────────────

export async function readDeepBrain(dir: string): Promise<string | null> {
  const dbPath = path.join(dir, 'DEEPBRAIN.md');
  const memPath = path.join(dir, 'MEMORY.md');

  if (fs.existsSync(dbPath)) {
    return fs.readFileSync(dbPath, 'utf-8');
  }
  if (fs.existsSync(memPath)) {
    return fs.readFileSync(memPath, 'utf-8');
  }
  return null;
}

export async function writeDeepBrainSummary(dir: string, summary: string): Promise<void> {
  const dbPath = path.join(dir, 'DEEPBRAIN.md');
  let existing = '';
  if (fs.existsSync(dbPath)) {
    existing = fs.readFileSync(dbPath, 'utf-8');
  }

  const sections = splitSections(existing);
  sections['Summary'] = `\n${summary}\n`;

  const output = renderSections(sections, existing);
  fs.writeFileSync(dbPath, output, 'utf-8');
}

// ── Markdown helpers ──────────────────────────────────────────────────────────

function splitSections(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = raw.split('\n');
  let currentSection = '';
  let buf: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        result[currentSection.toLowerCase()] = buf.join('\n').trim();
        result[currentSection] = buf.join('\n').trim(); // preserve case too
      }
      currentSection = headingMatch[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (currentSection) {
    result[currentSection.toLowerCase()] = buf.join('\n').trim();
    result[currentSection] = buf.join('\n').trim();
  }
  return result;
}

function parseKeyValues(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      result[m[1].trim()] = m[2].trim();
    }
  }
  return result;
}

function parseList(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

function renderSections(sections: Record<string, string>, original: string): string {
  // If we have a Summary section to update, find and replace it in the original,
  // or append it at the end.
  const summaryContent = sections['Summary'];
  if (!summaryContent) return original;

  const summaryHeader = /^##?\s+Summary\s*$/m;
  if (summaryHeader.test(original)) {
    // Replace existing Summary section
    return original.replace(
      /(^##?\s+Summary\s*\n)([\s\S]*?)(?=^##?\s+|\Z)/m,
      `$1\n${summaryContent.trim()}\n\n`
    );
  }

  // Append Summary section
  const sep = original.endsWith('\n') ? '' : '\n';
  return `${original}${sep}\n## Summary\n\n${summaryContent.trim()}\n`;
}
