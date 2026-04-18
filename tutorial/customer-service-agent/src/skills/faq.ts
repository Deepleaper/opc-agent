/**
 * FAQ Skill — FAQ 查询技能
 * Looks up frequently asked questions by keyword matching.
 */
import { BaseSkill } from 'opc-agent';

export class FAQSkill extends BaseSkill {
  name = 'faq';
  description = 'Look up frequently asked questions';
  triggers = [/常见问题|FAQ|怎么退款|退货|配送|支付/i];

  async execute(input: string): Promise<string> {
    // 常见问题知识库 / FAQ Knowledge Base
    const faqs: Record<string, string> = {
      '退款': '退款将在3-5个工作日内到账。如超时未到账，请联系银行确认。',
      '退货': '请在收到商品7天内申请退货。商品需保持原包装，未使用。',
      '配送': '标准配送3-5天，加急配送1-2天。偏远地区可能延迟1-2天。',
      '支付': '支持支付宝、微信支付、银行卡（Visa/Mastercard/银联）。',
    };

    for (const [key, answer] of Object.entries(faqs)) {
      if (input.includes(key)) return answer;
    }

    return '请问您想了解什么？我们有以下常见问题：退款、退货、配送、支付';
  }
}
