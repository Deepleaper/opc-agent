import { BaseChannel } from './index';
import type { Message } from '../core/types';

/**
 * WeChat Channel (Stub) — v0.8.0
 * WeChat Official Account message handling, template messages, QR code login.
 */

export interface WeChatChannelConfig {
  /** WeChat Official Account AppID */
  appId: string;
  /** WeChat Official Account AppSecret */
  appSecret: string;
  /** Verification token for message validation */
  token: string;
  /** AES encoding key for encrypted messages */
  encodingAESKey?: string;
  /** HTTP server port (default: 3002) */
  port?: number;
}

export interface WeChatMessage {
  toUserName: string;
  fromUserName: string;
  createTime: number;
  msgType: 'text' | 'image' | 'voice' | 'video' | 'event';
  content?: string;
  msgId?: string;
  event?: string;
  eventKey?: string;
}

export interface TemplateMessageData {
  toUser: string;
  templateId: string;
  url?: string;
  data: Record<string, { value: string; color?: string }>;
}

export class WeChatChannel extends BaseChannel {
  type = 'wechat';
  private config: WeChatChannelConfig;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: WeChatChannelConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    // TODO: Start HTTP server to receive WeChat push messages
    // 1. Verify signature on GET requests
    // 2. Parse XML messages on POST requests
    // 3. Route to handler and reply with XML
  }

  async stop(): Promise<void> {
    // TODO: Stop HTTP server
  }

  /** Get or refresh access token */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // TODO: Implement token refresh
    // const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`;
    // const res = await fetch(url);
    // const data = await res.json();
    // this.accessToken = data.access_token;
    // this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken ?? '';
  }

  /** Handle incoming WeChat message */
  async handleMessage(wxMsg: WeChatMessage): Promise<string> {
    if (wxMsg.msgType === 'event') {
      return this.handleEvent(wxMsg);
    }

    const message = this.wechatToMessage(wxMsg);
    if (this.handler) {
      const reply = await this.handler(message);
      return reply.content;
    }
    return '';
  }

  /** Handle WeChat events (subscribe, scan, etc.) */
  private handleEvent(wxMsg: WeChatMessage): string {
    switch (wxMsg.event) {
      case 'subscribe':
        return 'Welcome! How can I help you?';
      case 'SCAN':
        return `QR code scanned: ${wxMsg.eventKey}`;
      default:
        return '';
    }
  }

  /** Convert WeChat message to internal Message */
  private wechatToMessage(wxMsg: WeChatMessage): Message {
    return {
      id: wxMsg.msgId ?? `wx-${wxMsg.createTime}`,
      role: 'user',
      content: wxMsg.content ?? '',
      timestamp: wxMsg.createTime * 1000,
      metadata: {
        channel: 'wechat',
        fromUser: wxMsg.fromUserName,
        toUser: wxMsg.toUserName,
        msgType: wxMsg.msgType,
      },
    };
  }

  /** Send template message */
  async sendTemplateMessage(data: TemplateMessageData): Promise<boolean> {
    // TODO: Implement
    // const token = await this.getAccessToken();
    // const url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;
    // const res = await fetch(url, {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     touser: data.toUser,
    //     template_id: data.templateId,
    //     url: data.url,
    //     data: data.data,
    //   }),
    // });
    void data;
    return true;
  }

  /** Generate QR code for login (stub) */
  async generateLoginQR(): Promise<{ ticket: string; url: string; expireSeconds: number }> {
    // TODO: Implement with WeChat QR code API
    // const token = await this.getAccessToken();
    // POST to https://api.weixin.qq.com/cgi-bin/qrcode/create
    return {
      ticket: 'stub-ticket',
      url: 'https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=stub-ticket',
      expireSeconds: 300,
    };
  }
}
