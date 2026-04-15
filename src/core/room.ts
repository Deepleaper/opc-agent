import { EventEmitter } from 'events';
import type { Message, IAgent } from './types';

export interface RoomMessage {
  from: string;
  to?: string; // undefined = broadcast
  topic?: string;
  message: Message;
}

export class Room extends EventEmitter {
  readonly name: string;
  private agents: Map<string, IAgent> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> agentNames

  constructor(name: string) {
    super();
    this.name = name;
  }

  addAgent(agent: IAgent): void {
    this.agents.set(agent.name, agent);
    this.emit('agent:join', agent.name);
  }

  removeAgent(name: string): void {
    this.agents.delete(name);
    // Remove from all subscriptions
    for (const [, subscribers] of this.subscriptions) {
      subscribers.delete(name);
    }
    this.emit('agent:leave', name);
  }

  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  subscribe(agentName: string, topic: string): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(agentName);
  }

  unsubscribe(agentName: string, topic: string): void {
    this.subscriptions.get(topic)?.delete(agentName);
  }

  getSubscribers(topic: string): string[] {
    return Array.from(this.subscriptions.get(topic) ?? []);
  }

  async send(roomMessage: RoomMessage): Promise<Message[]> {
    const responses: Message[] = [];
    this.emit('message', roomMessage);

    if (roomMessage.to) {
      // Direct message
      const agent = this.agents.get(roomMessage.to);
      if (agent) {
        const response = await agent.handleMessage(roomMessage.message);
        responses.push(response);
      }
    } else if (roomMessage.topic) {
      // Topic-based pub/sub
      const subscribers = this.subscriptions.get(roomMessage.topic) ?? new Set();
      for (const name of subscribers) {
        if (name === roomMessage.from) continue;
        const agent = this.agents.get(name);
        if (agent) {
          const response = await agent.handleMessage(roomMessage.message);
          responses.push(response);
        }
      }
    } else {
      // Broadcast to all except sender
      for (const [name, agent] of this.agents) {
        if (name === roomMessage.from) continue;
        const response = await agent.handleMessage(roomMessage.message);
        responses.push(response);
      }
    }

    return responses;
  }

  async broadcast(from: string, content: string): Promise<Message[]> {
    const message: Message = {
      id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { room: this.name, from },
    };
    return this.send({ from, message });
  }

  async publishToTopic(from: string, topic: string, content: string): Promise<Message[]> {
    const message: Message = {
      id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { room: this.name, from, topic },
    };
    return this.send({ from, topic, message });
  }
}
