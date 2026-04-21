import { Message, AgentConfig, ChatMessage, Chunk, ToolCall, ToolResult } from './types';
import { ModelRouter } from '../providers/router';
import { IterationBudget } from './iteration-budget';
import { assembleContext } from './context-assembler';

export async function* agentLoop(
  userMessage: string,
  config: AgentConfig,
  history: Message[],
  toolExecutor: (call: ToolCall) => Promise<ToolResult>
): AsyncGenerator<Chunk> {
  const budget = new IterationBudget(25);
  const router = new ModelRouter(config.model);
  const provider = router.getProvider('task');
  const context = await assembleContext(userMessage, config, history);

  while (!budget.isExhausted()) {
    const response = await provider.chat({
      messages: context as unknown as Message[],
    });

    const toolCalls = response.message.toolCalls ?? [];
    if (toolCalls.length === 0) {
      yield { type: 'text', content: response.message.content };
      break;
    }

    // Record assistant turn so the model sees its own tool invocations
    context.push({
      role: 'assistant',
      content: response.message.content,
      toolCalls: response.message.toolCalls,
    } as ChatMessage);

    for (const call of toolCalls) {
      yield { type: 'tool_call', content: JSON.stringify(call) };
      const result = await toolExecutor(call);
      yield { type: 'tool_result', content: JSON.stringify(result) };
      context.push({
        role: 'tool',
        toolCallId: result.callId,
        content: result.content,
      } as ChatMessage);
    }

    budget.tick();
    const state = budget.getState();
    if (state === 'warn') {
      context.push({ role: 'system', content: '⚠️ 接近迭代上限，请尽快给出最终回答。' } as ChatMessage);
    }
    if (state === 'critical') {
      context.push({ role: 'system', content: '🛑 必须立即给出最终回答，不要再调用工具。' } as ChatMessage);
    }
    if (state === 'stop') {
      yield { type: 'text', content: '达到最大迭代次数，已终止。' };
      break;
    }
  }
}
