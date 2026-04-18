/**
 * Ticket Skill — 工单创建技能
 * Creates a support ticket for human follow-up.
 */
import { BaseSkill } from 'opc-agent';

export class TicketSkill extends BaseSkill {
  name = 'ticket';
  description = 'Create a support ticket for human follow-up';
  triggers = [/创建工单|提交问题|人工客服|投诉/i];

  async execute(input: string): Promise<string> {
    // 生成唯一工单号 / Generate unique ticket ID
    const ticketId = `TK-${Date.now().toString(36).toUpperCase()}`;

    // 实际项目中这里会写入数据库
    // In production, this would persist to a database
    console.log(`[Ticket Created] ${ticketId}: ${input}`);

    return `已创建工单 ${ticketId}，客服团队将在2小时内联系您。\nTicket ${ticketId} created. Our team will contact you within 2 hours.`;
  }
}
