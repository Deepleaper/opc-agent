import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

export interface RemoteNode {
  id: string;
  name: string;
  host: string;
  port: number;
  type: 'vps' | 'pi' | 'phone' | 'desktop';
  status: 'online' | 'offline' | 'pairing';
  capabilities: string[];
  lastSeen: number;
}

export class NodeNetwork extends EventEmitter {
  private nodes = new Map<string, RemoteNode>();

  addNode(config: Partial<RemoteNode>): RemoteNode {
    const node: RemoteNode = {
      id: config.id || randomUUID(),
      name: config.name || 'unnamed',
      host: config.host || 'localhost',
      port: config.port || 8080,
      type: config.type || 'desktop',
      status: config.status || 'offline',
      capabilities: config.capabilities || [],
      lastSeen: Date.now(),
    };
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(id: string): void {
    if (!this.nodes.has(id)) throw new Error(`Node ${id} not found`);
    this.nodes.delete(id);
  }

  listNodes(): RemoteNode[] {
    return Array.from(this.nodes.values());
  }

  getNode(id: string): RemoteNode | null {
    return this.nodes.get(id) || null;
  }

  async pair(nodeId: string, pairingCode: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (!pairingCode || pairingCode.length < 4) return false;
    node.status = 'online';
    node.lastSeen = Date.now();
    return true;
  }

  async sendCommand(nodeId: string, command: string): Promise<any> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (node.status !== 'online') throw new Error(`Node ${nodeId} is ${node.status}`);
    node.lastSeen = Date.now();
    // Stub: return command echo
    return { nodeId, command, status: 'sent', timestamp: Date.now() };
  }

  async broadcast(command: string): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    for (const [id, node] of this.nodes) {
      if (node.status === 'online') {
        try {
          results.set(id, await this.sendCommand(id, command));
        } catch (e: any) {
          results.set(id, { error: e.message });
        }
      }
    }
    return results;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [id, node] of this.nodes) {
      results.set(id, node.status === 'online');
      node.lastSeen = Date.now();
    }
    return results;
  }
}
