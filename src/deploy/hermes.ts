/**
 * Hermes Agent Adapter - Convert OAD → Hermes Agent config
 */
import * as fs from 'fs';
import * as path from 'path';
import type { OADDocument } from '../schema/oad';

export interface HermesDeployOptions {
  oad: OADDocument;
  outputDir: string;
}

export interface HermesDeployResult {
  outputDir: string;
  files: string[];
}

interface HermesCharacter {
  name: string;
  description: string;
  personality: string;
  system: string;
  bio: string[];
  lore: string[];
  messageExamples: Array<Array<{ user: string; content: { text: string } }>>;
  postExamples: string[];
  topics: string[];
  adjectives: string[];
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  plugins: string[];
  settings: {
    model: string;
    voice: { model: string };
    secrets: Record<string, string>;
  };
}

function oadToHermesCharacter(oad: OADDocument): HermesCharacter {
  const m = oad.metadata;
  const s = oad.spec;
  const prompt = s.systemPrompt ?? 'You are a helpful AI agent.';

  // Extract personality traits from system prompt
  const lines = prompt.split('\n').filter(l => l.trim());
  const bio = lines.slice(0, 3).map(l => l.replace(/^[-*#]\s*/, '').trim());

  return {
    name: m.name,
    description: m.description ?? `${m.name} - AI Agent`,
    personality: prompt.slice(0, 500),
    system: prompt,
    bio: bio.length > 0 ? bio : [`${m.name} is an AI agent built with OPC Agent framework.`],
    lore: [`Created with OPC Agent v${m.version}`, `Licensed under ${m.license}`],
    messageExamples: [
      [
        { user: '{{user1}}', content: { text: 'Hello!' } },
        { user: m.name, content: { text: 'Hi there! How can I help you today?' } },
      ],
    ],
    postExamples: [],
    topics: s.skills.map(sk => sk.name),
    adjectives: ['helpful', 'knowledgeable', 'professional'],
    style: {
      all: ['Be helpful and professional', 'Use clear language'],
      chat: ['Respond conversationally', 'Be concise but thorough'],
      post: ['Share useful insights', 'Be informative'],
    },
    plugins: s.skills.map(sk => sk.name),
    settings: {
      model: s.model,
      voice: { model: 'en_US-neutral' },
      secrets: {},
    },
  };
}

function generateHermesSettings(oad: OADDocument): Record<string, any> {
  return {
    name: oad.metadata.name,
    version: oad.metadata.version,
    runtime: {
      provider: oad.spec.provider?.default ?? 'openai',
      model: oad.spec.model,
      temperature: 0.7,
      maxTokens: 2048,
    },
    channels: oad.spec.channels.map(ch => ({
      type: ch.type,
      enabled: true,
      config: ch.config ?? {},
    })),
    memory: {
      enabled: !!oad.spec.memory,
      provider: typeof oad.spec.memory?.longTerm === 'object'
        ? oad.spec.memory.longTerm.provider
        : 'in-memory',
    },
  };
}

export function deployToHermes(options: HermesDeployOptions): HermesDeployResult {
  const { oad, outputDir } = options;
  const files: string[] = [];

  fs.mkdirSync(outputDir, { recursive: true });

  // character.json
  const character = oadToHermesCharacter(oad);
  const charPath = path.join(outputDir, 'character.json');
  fs.writeFileSync(charPath, JSON.stringify(character, null, 2), 'utf-8');
  files.push('character.json');

  // settings.json
  const settings = generateHermesSettings(oad);
  const settingsPath = path.join(outputDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  files.push('settings.json');

  // .env template
  const envContent = `# Hermes Agent Environment
HERMES_CHARACTER=${oad.metadata.name}
HERMES_MODEL=${oad.spec.model}
HERMES_PROVIDER=${oad.spec.provider?.default ?? 'openai'}
# Add your API keys below:
# OPENAI_API_KEY=
# DEEPSEEK_API_KEY=
`;
  fs.writeFileSync(path.join(outputDir, '.env.hermes'), envContent, 'utf-8');
  files.push('.env.hermes');

  // README
  const readme = `# ${oad.metadata.name} - Hermes Agent

Converted from OAD format using \`opc deploy --target hermes\`.

## Usage

1. Copy \`character.json\` to your Hermes agents directory
2. Configure \`.env.hermes\` with your API keys
3. Start Hermes with this character

## Files

- \`character.json\` - Agent character definition
- \`settings.json\` - Runtime settings
- \`.env.hermes\` - Environment template
`;
  fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf-8');
  files.push('README.md');

  return { outputDir, files };
}
