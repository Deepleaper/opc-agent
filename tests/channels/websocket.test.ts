import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketChannel } from '../../src/channels/websocket';

// We can't easily test WebSocket server without starting it, 
// but we can test the room management and config logic.

describe('WebSocketChannel', () => {
  describe('constructor', () => {
    it('should accept port number', () => {
      const channel = new WebSocketChannel(4000);
      expect(channel.type).toBe('websocket');
    });

    it('should accept config object', () => {
      const channel = new WebSocketChannel({
        port: 4000,
        heartbeatInterval: 15000,
        authTokens: ['secret'],
        maxClientsPerRoom: 50,
      });
      expect(channel.type).toBe('websocket');
    });

    it('should use defaults', () => {
      const channel = new WebSocketChannel();
      expect(channel.type).toBe('websocket');
    });
  });

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const channel = new WebSocketChannel(4001);
      const stats = channel.getStats();
      expect(stats.clients).toBe(0);
      expect(stats.rooms).toBe(0);
      expect(stats.roomDetails).toEqual({});
    });
  });

  describe('getRooms', () => {
    it('should return empty array initially', () => {
      const channel = new WebSocketChannel(4002);
      expect(channel.getRooms()).toEqual([]);
    });
  });

  describe('getRoomMembers', () => {
    it('should return empty for non-existent room', () => {
      const channel = new WebSocketChannel(4003);
      expect(channel.getRoomMembers('nonexistent')).toEqual([]);
    });
  });
});
