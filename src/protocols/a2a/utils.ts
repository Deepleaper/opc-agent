import type { A2AAgentCard, A2AAgentSkill } from './types';

/**
 * Convert an OAD (Open Agent Definition) document to an A2A AgentCard.
 */
export function oadToAgentCard(oad: any, baseUrl: string): A2AAgentCard {
  const meta = oad?.metadata || {};
  const spec = oad?.spec || {};

  // Extract skills from OAD
  const skills: A2AAgentSkill[] = (spec.skills || []).map((s: any, i: number) => ({
    id: s.id || s.name || `skill-${i}`,
    name: s.name || `Skill ${i}`,
    description: s.description || '',
    tags: s.tags || [],
    examples: s.examples || [],
  }));

  // If no skills defined, create one from the agent description
  if (skills.length === 0 && (spec.systemPrompt || meta.description)) {
    skills.push({
      id: 'default',
      name: meta.name || 'default',
      description: meta.description || spec.systemPrompt?.slice(0, 200) || 'General agent capability',
      tags: ['general'],
    });
  }

  // Detect capabilities from OAD
  const channels = spec.channels || [];
  const hasStreaming = channels.some((c: any) => c.type === 'websocket' || c.type === 'web');

  const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return {
    name: meta.name || 'opc-agent',
    description: meta.description || '',
    url,
    version: meta.version || '1.0.0',
    capabilities: {
      streaming: hasStreaming,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills,
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    authentication: spec.auth ? { schemes: [spec.auth.type || 'bearer'] } : undefined,
  };
}
