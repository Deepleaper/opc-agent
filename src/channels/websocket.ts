import type { Message } from '../core/types';
import { BaseChannel } from './index';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * WebSocket Channel — v1.1.0
 *
 * Enhanced with:
 * - Room support (multiple clients in a room)
 * - Heartbeat/ping-pong to detect disconnected clients
 * - Reconnection handling (session persistence)
 * - Binary message support
 * - Connection authentication (optional token in query string)
 */

export interface WebSocketChannelConfig {
  port?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Valid auth tokens (if empty, no auth required) */
  authTokens?: string[];
  /** Max clients per room (default: 100) */
  maxClientsPerRoom?: number;
}

interface ClientInfo {
  ws: WebSocket;
  sessionId: string;
  rooms: Set<string>;
  isAlive: boolean;
  authenticated: boolean;
  connectedAt: number;
  lastMessageAt: number;
}

export class WebSocketChannel extends BaseChannel {
  readonly type = 'websocket';
  private wss: WebSocketServer | null = null;
  private config: Required<WebSocketChannelConfig>;
  private clients: Map<string, ClientInfo> = new Map(); // sessionId -> ClientInfo
  private rooms: Map<string, Set<string>> = new Map(); // roomId -> Set<sessionId>
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(configOrPort: number | WebSocketChannelConfig = 3002) {
    super();
    if (typeof configOrPort === 'number') {
      this.config = { port: configOrPort, heartbeatInterval: 30000, authTokens: [], maxClientsPerRoom: 100 };
    } else {
      this.config = {
        port: configOrPort.port ?? 3002,
        heartbeatInterval: configOrPort.heartbeatInterval ?? 30000,
        authTokens: configOrPort.authTokens ?? [],
        maxClientsPerRoom: configOrPort.maxClientsPerRoom ?? 100,
      };
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.config.port });

      this.wss.on('connection', (ws, req) => {
        const url = new URL(req.url ?? '/', `http://localhost:${this.config.port}`);
        const token = url.searchParams.get('token');
        const sessionId = url.searchParams.get('sessionId') ?? `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Authentication check
        if (this.config.authTokens.length > 0) {
          if (!token || !this.config.authTokens.includes(token)) {
            ws.close(4001, 'Unauthorized');
            return;
          }
        }

        // Handle reconnection: if sessionId already exists, replace the connection
        const existing = this.clients.get(sessionId);
        if (existing) {
          try { existing.ws.close(4000, 'Replaced by new connection'); } catch {}
        }

        const clientInfo: ClientInfo = {
          ws,
          sessionId,
          rooms: existing?.rooms ?? new Set(),
          isAlive: true,
          authenticated: true,
          connectedAt: Date.now(),
          lastMessageAt: Date.now(),
        };
        this.clients.set(sessionId, clientInfo);

        // Re-register in rooms after reconnect
        for (const roomId of clientInfo.rooms) {
          const room = this.rooms.get(roomId);
          if (room) room.add(sessionId);
        }

        ws.on('pong', () => {
          clientInfo.isAlive = true;
        });

        ws.on('message', async (data, isBinary) => {
          clientInfo.lastMessageAt = Date.now();
          clientInfo.isAlive = true;

          if (isBinary) {
            await this.handleBinaryMessage(clientInfo, data as Buffer);
            return;
          }

          try {
            const parsed = JSON.parse(data.toString());
            await this.handleTextMessage(clientInfo, parsed);
          } catch {
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
          }
        });

        ws.on('close', () => {
          // Don't immediately remove - allow reconnection window
          const info = this.clients.get(sessionId);
          if (info && info.ws === ws) {
            // Mark as disconnected but keep for potential reconnection
            setTimeout(() => {
              const current = this.clients.get(sessionId);
              if (current && current.ws === ws) {
                this.removeClient(sessionId);
              }
            }, 60000); // 60s reconnection window
          }
        });

        ws.send(JSON.stringify({
          type: 'connected',
          sessionId,
          timestamp: Date.now(),
        }));
      });

      // Start heartbeat
      this.heartbeatTimer = setInterval(() => {
        for (const [sessionId, info] of this.clients) {
          if (!info.isAlive) {
            try { info.ws.terminate(); } catch {}
            this.removeClient(sessionId);
            continue;
          }
          info.isAlive = false;
          try { info.ws.ping(); } catch {}
        }
      }, this.config.heartbeatInterval);

      this.wss.on('listening', () => {
        console.log(`[WebSocketChannel] Listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const [, info] of this.clients) {
      try { info.ws.close(); } catch {}
    }
    this.clients.clear();
    this.rooms.clear();

    return new Promise((resolve, reject) => {
      if (!this.wss) return resolve();
      this.wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Handle text (JSON) messages */
  private async handleTextMessage(client: ClientInfo, parsed: any): Promise<void> {
    const type = parsed.type ?? 'message';

    switch (type) {
      case 'join': {
        const roomId = parsed.room;
        if (!roomId) {
          client.ws.send(JSON.stringify({ error: 'room is required for join' }));
          return;
        }
        this.joinRoom(client.sessionId, roomId);
        client.ws.send(JSON.stringify({ type: 'joined', room: roomId, members: this.getRoomMembers(roomId).length }));
        return;
      }

      case 'leave': {
        const roomId = parsed.room;
        if (roomId) {
          this.leaveRoom(client.sessionId, roomId);
          client.ws.send(JSON.stringify({ type: 'left', room: roomId }));
        }
        return;
      }

      case 'room_message': {
        const roomId = parsed.room;
        const content = parsed.content ?? parsed.message;
        if (roomId && content) {
          this.broadcastToRoom(roomId, {
            type: 'room_message',
            room: roomId,
            from: client.sessionId,
            content,
            timestamp: Date.now(),
          }, client.sessionId);
        }
        return;
      }

      case 'ping': {
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      default: {
        // Regular chat message
        if (!this.handler) return;

        const msg: Message = {
          id: parsed.id ?? `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: 'user',
          content: parsed.content ?? parsed.message ?? JSON.stringify(parsed),
          timestamp: Date.now(),
          metadata: {
            sessionId: client.sessionId,
            platform: 'websocket',
            room: parsed.room,
          },
        };

        const response = await this.handler(msg);
        client.ws.send(JSON.stringify({
          id: response.id,
          content: response.content,
          timestamp: response.timestamp,
        }));
      }
    }
  }

  /** Handle binary messages */
  private async handleBinaryMessage(client: ClientInfo, data: Buffer): Promise<void> {
    // Emit binary data with metadata
    client.ws.send(JSON.stringify({
      type: 'binary_ack',
      size: data.length,
      timestamp: Date.now(),
    }));

    // If handler exists, pass as base64
    if (this.handler) {
      const msg: Message = {
        id: `ws_bin_${Date.now()}`,
        role: 'user',
        content: `[binary:${data.length} bytes]`,
        timestamp: Date.now(),
        metadata: {
          sessionId: client.sessionId,
          platform: 'websocket',
          binary: true,
          binaryData: data.toString('base64'),
        },
      };
      const response = await this.handler(msg);
      client.ws.send(JSON.stringify({
        id: response.id,
        content: response.content,
        timestamp: response.timestamp,
      }));
    }
  }

  /** Join a room */
  joinRoom(sessionId: string, roomId: string): boolean {
    const client = this.clients.get(sessionId);
    if (!client) return false;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId)!;
    if (room.size >= this.config.maxClientsPerRoom) {
      client.ws.send(JSON.stringify({ error: 'Room is full', room: roomId }));
      return false;
    }

    room.add(sessionId);
    client.rooms.add(roomId);

    // Notify other room members
    this.broadcastToRoom(roomId, {
      type: 'member_joined',
      room: roomId,
      sessionId,
      members: room.size,
      timestamp: Date.now(),
    }, sessionId);

    return true;
  }

  /** Leave a room */
  leaveRoom(sessionId: string, roomId: string): void {
    const client = this.clients.get(sessionId);
    if (client) client.rooms.delete(roomId);

    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(sessionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      } else {
        this.broadcastToRoom(roomId, {
          type: 'member_left',
          room: roomId,
          sessionId,
          members: room.size,
          timestamp: Date.now(),
        });
      }
    }
  }

  /** Remove client completely */
  private removeClient(sessionId: string): void {
    const client = this.clients.get(sessionId);
    if (!client) return;

    for (const roomId of client.rooms) {
      this.leaveRoom(sessionId, roomId);
    }
    this.clients.delete(sessionId);
  }

  /** Get room member session IDs */
  getRoomMembers(roomId: string): string[] {
    return [...(this.rooms.get(roomId) ?? [])];
  }

  /** Get all rooms */
  getRooms(): string[] {
    return [...this.rooms.keys()];
  }

  /** Broadcast to all clients */
  broadcast(content: string): void {
    const msg = JSON.stringify({ type: 'broadcast', content, timestamp: Date.now() });
    for (const [, info] of this.clients) {
      if (info.ws.readyState === 1) {
        info.ws.send(msg);
      }
    }
  }

  /** Broadcast to all clients in a room */
  broadcastToRoom(roomId: string, data: any, excludeSessionId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const sessionId of room) {
      if (sessionId === excludeSessionId) continue;
      const client = this.clients.get(sessionId);
      if (client && client.ws.readyState === 1) {
        client.ws.send(msg);
      }
    }
  }

  /** Send to specific session */
  sendToSession(sessionId: string, data: any): boolean {
    const client = this.clients.get(sessionId);
    if (!client || client.ws.readyState !== 1) return false;
    client.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }

  /** Get connection stats */
  getStats(): { clients: number; rooms: number; roomDetails: Record<string, number> } {
    const roomDetails: Record<string, number> = {};
    for (const [roomId, members] of this.rooms) {
      roomDetails[roomId] = members.size;
    }
    return {
      clients: this.clients.size,
      rooms: this.rooms.size,
      roomDetails,
    };
  }
}
