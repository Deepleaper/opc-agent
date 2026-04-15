import type { AgentContext, Message } from './types';

/**
 * Agent Composition — v0.8.0
 * Combine multiple agents into a pipeline: Agent A output → Agent B input.
 * Configurable in OAD: `compose: [agent-a, agent-b]`
 */

export type AgentHandler = (context: AgentContext, message: Message) => Promise<Message>;

export interface ComposableAgent {
  id: string;
  name: string;
  handler: AgentHandler;
}

export interface ComposeOptions {
  /** Stop pipeline if any agent returns empty content */
  stopOnEmpty?: boolean;
  /** Transform output between agents */
  transform?: (output: Message, nextAgentId: string) => Message;
  /** Timeout per agent in ms */
  timeoutMs?: number;
}

export class AgentPipeline {
  private agents: ComposableAgent[] = [];
  private options: ComposeOptions;

  constructor(agents: ComposableAgent[], options: ComposeOptions = {}) {
    this.agents = agents;
    this.options = options;
  }

  /** Run the pipeline sequentially: each agent's output becomes the next agent's input */
  async execute(context: AgentContext, initialMessage: Message): Promise<Message> {
    let currentMessage = initialMessage;

    for (const agent of this.agents) {
      if (this.options.stopOnEmpty && !currentMessage.content.trim()) {
        break;
      }

      // Apply transform if provided
      if (this.options.transform) {
        currentMessage = this.options.transform(currentMessage, agent.id);
      }

      if (this.options.timeoutMs) {
        const result = await Promise.race([
          agent.handler(context, currentMessage),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Agent ${agent.id} timed out`)), this.options.timeoutMs)
          ),
        ]);
        currentMessage = result;
      } else {
        currentMessage = await agent.handler(context, currentMessage);
      }
    }

    return currentMessage;
  }

  /** Get the pipeline agent IDs in order */
  getAgentIds(): string[] {
    return this.agents.map((a) => a.id);
  }
}

/**
 * Create a pipeline from an array of composable agents.
 * Usage in OAD: `compose: [agent-a, agent-b, agent-c]`
 */
export function compose(agents: ComposableAgent[], options?: ComposeOptions): AgentPipeline {
  return new AgentPipeline(agents, options);
}
