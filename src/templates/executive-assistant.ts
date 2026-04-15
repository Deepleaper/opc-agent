import { BaseSkill } from '../skills/base';
import type { AgentContext, Message, SkillResult } from '../core/types';
import type { OADDocument } from '../schema/oad';

export class CalendarSkill extends BaseSkill {
  name = 'calendar-management';
  description = 'Manage calendar and scheduling';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('calendar')) {
      return this.match('I can help manage your calendar. I can schedule meetings, check availability, send invites, and set reminders. What would you like to do?', 0.8);
    }
    if (lower.includes('remind') || lower.includes('reminder')) {
      return this.match('I\'ll set a reminder for you. Please provide the date, time, and what you\'d like to be reminded about.', 0.75);
    }
    return this.noMatch();
  }
}

export class EmailDraftSkill extends BaseSkill {
  name = 'email-drafting';
  description = 'Draft professional emails';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('email') || lower.includes('draft') || lower.includes('write')) {
      return this.match('I can draft emails for you. Please provide: the recipient, subject, key points to cover, and desired tone (formal/casual/friendly).', 0.8);
    }
    return this.noMatch();
  }
}

export class MeetingPrepSkill extends BaseSkill {
  name = 'meeting-prep';
  description = 'Prepare for meetings with agendas and notes';

  async execute(_context: AgentContext, message: Message): Promise<SkillResult> {
    const lower = message.content.toLowerCase();
    if (lower.includes('agenda') || lower.includes('prep') || lower.includes('prepare')) {
      return this.match('I can prepare meeting materials including: agenda creation, attendee briefings, talking points, action item tracking, and follow-up summaries.', 0.8);
    }
    return this.noMatch();
  }
}

export function createExecutiveAssistantConfig(): OADDocument {
  return {
    apiVersion: 'opc/v1',
    kind: 'Agent',
    metadata: {
      name: 'executive-assistant',
      version: '1.0.0',
      description: 'AI Executive Assistant - calendar management, email drafting, meeting prep',
      author: 'OPC',
      license: 'Apache-2.0',
    },
    spec: {
      model: 'deepseek-chat',
      systemPrompt: 'You are an executive assistant AI. Help users manage their calendar, draft emails, and prepare for meetings. Be professional, concise, and proactive.',
      skills: [
        { name: 'calendar-management', description: 'Manage calendar and scheduling' },
        { name: 'email-drafting', description: 'Draft professional emails' },
        { name: 'meeting-prep', description: 'Prepare meeting materials' },
      ],
      channels: [{ type: 'web', port: 3000 }],
      memory: { shortTerm: true, longTerm: false },
      streaming: false,
    },
  };
}
