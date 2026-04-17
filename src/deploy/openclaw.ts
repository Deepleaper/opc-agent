/**
 * OpenClaw Deployer - Convert OAD → OpenClaw agent workspace
 */
import * as fs from 'fs';
import * as path from 'path';
import type { OADDocument } from '../schema/oad';

export interface DeployOptions {
  oad: OADDocument;
  outputDir: string;
  install?: boolean; // also register in openclaw.json
}

export interface DeployResult {
  outputDir: string;
  files: string[];
  installed: boolean;
  configPath?: string;
}

function generateIdentityMd(oad: OADDocument): string {
  const m = oad.metadata;
  return `# IDENTITY.md

- **Name:** ${m.name}
- **Version:** ${m.version}
- **Description:** ${m.description ?? 'An AI agent'}
- **Author:** ${m.author ?? 'Unknown'}
- **License:** ${m.license}
`;
}

function generateSoulMd(oad: OADDocument): string {
  const prompt = oad.spec.systemPrompt ?? 'You are a helpful AI assistant.';
  return `# SOUL.md - ${oad.metadata.name}

## System Prompt

${prompt}

## Model Configuration

- **Model:** ${oad.spec.model}
- **Provider:** ${oad.spec.provider?.default ?? 'deepseek'}
`;
}

function generateAgentsMd(oad: OADDocument): string {
  const skills = oad.spec.skills;
  const memory = oad.spec.memory;
  const dtv = oad.spec.dtv;

  let md = `# AGENTS.md - ${oad.metadata.name}\n\n`;

  // Skills
  md += `## Skills\n\n`;
  if (skills.length === 0) {
    md += `No skills configured.\n\n`;
  } else {
    for (const sk of skills) {
      md += `### ${sk.name}\n`;
      if (sk.description) md += `${sk.description}\n`;
      if (sk.config) md += `\nConfig:\n\`\`\`json\n${JSON.stringify(sk.config, null, 2)}\n\`\`\`\n`;
      md += `\n`;
    }
  }

  // Memory
  md += `## Memory\n\n`;
  if (memory) {
    md += `- Short-term: ${memory.shortTerm ? 'enabled' : 'disabled'}\n`;
    const lt = memory.longTerm;
    if (typeof lt === 'object' && lt) {
      md += `- Long-term: ${lt.provider} (collection: ${lt.collection ?? 'default'})\n`;
    } else {
      md += `- Long-term: ${lt ? 'enabled' : 'disabled'}\n`;
    }
  } else {
    md += `Default memory settings.\n`;
  }
  md += `\n`;

  return md;
}

function generateUserMd(oad: OADDocument): string {
  return `# USER.md

- **Name:** (your name)
- **Role:** User
- **Notes:** Configure this file with your preferences for ${oad.metadata.name}.
`;
}

function generateMemoryMd(oad: OADDocument): string {
  return `# MEMORY.md - ${oad.metadata.name}

## Persistent Knowledge

(Agent will store learned information here)

## User Preferences

(Discovered user preferences will be noted here)
`;
}

function generateOpenClawConfig(oad: OADDocument, agentDir: string): Record<string, any> {
  const channels = oad.spec.channels;
  const channelConfig: Record<string, any> = {};

  for (const ch of channels) {
    if (ch.type === 'telegram') {
      channelConfig.telegram = {
        enabled: true,
        note: 'Configure bot token in OpenClaw gateway settings',
      };
    } else if (ch.type === 'web' || ch.type === 'websocket') {
      channelConfig.web = { enabled: true, port: ch.port ?? 3000 };
    }
  }

  return {
    name: oad.metadata.name,
    workspace: agentDir,
    channels: channelConfig,
  };
}

export function deployToOpenClaw(options: DeployOptions): DeployResult {
  const { oad, outputDir, install } = options;
  const files: string[] = [];

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate all workspace files
  const fileMap: Record<string, string> = {
    'IDENTITY.md': generateIdentityMd(oad),
    'SOUL.md': generateSoulMd(oad),
    'AGENTS.md': generateAgentsMd(oad),
    'USER.md': generateUserMd(oad),
    'MEMORY.md': generateMemoryMd(oad),
  };

  for (const [name, content] of Object.entries(fileMap)) {
    const filePath = path.join(outputDir, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    files.push(name);
  }

  // Generate suggested channel config
  const channelSuggestion = generateOpenClawConfig(oad, outputDir);
  const configNote = path.join(outputDir, 'openclaw-config-suggestion.json');
  fs.writeFileSync(configNote, JSON.stringify(channelSuggestion, null, 2), 'utf-8');
  files.push('openclaw-config-suggestion.json');

  const result: DeployResult = { outputDir, files, installed: false };

  // Install mode: register in openclaw.json
  if (install) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.agents) config.agents = {};

        const agentId = oad.metadata.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        config.agents[agentId] = {
          workspace: outputDir,
          description: oad.metadata.description ?? '',
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        result.installed = true;
        result.configPath = configPath;
      } catch (err) {
        // Config exists but couldn't be updated - not fatal
        console.error(`Warning: Could not update ${configPath}:`, err);
      }
    } else {
      console.error(`Warning: OpenClaw config not found at ${configPath}`);
      console.error(`Run 'openclaw init' first, then re-run with --install`);
    }
  }

  return result;
}
