import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';


export class TaskTrackingSkill extends BaseSkill {
  name = 'task-tracking';
  description = 'Track project tasks and status';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('task') || lower.includes('todo') || lower.includes('progress')) {
      return this.match(
        'I can help track tasks. Tell me the task name, assignee, and deadline, and I\'ll add it to the tracker.',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export class MeetingNotesSkill extends BaseSkill {
  name = 'meeting-notes';
  description = 'Generate and manage meeting notes';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('meeting') || lower.includes('notes') || lower.includes('minutes')) {
      return this.match(
        'I can help with meeting notes. Share the meeting details and I\'ll create structured notes with action items.',
        0.8,
      );
    }
    return this.noMatch();
  }
}

export function createProjectManagerConfig() {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'project-manager',
      version: '1.0.0',
      description: 'Project Manager — task tracking, status updates, meeting notes',
      author: 'Deepleaper',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are a project management assistant. Help track tasks, provide status updates, and manage meeting notes. Be organized and action-oriented.',
      skills: [
        { name: 'task-tracking', description: 'Track tasks' },
        { name: 'meeting-notes', description: 'Manage meeting notes' },
      ],
      channels: [{ type: 'web', port: 3000 }],
    },
  };
}
