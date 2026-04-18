import { BaseChannel } from './index';
import type { Message } from '../core/types';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';

/**
 * WeChat Official Account Channel — v1.0.0
 *
 * Handles:
 * - GET verification (signature/timestamp/nonce/echostr)
 * - POST XML message parsing and reply
 * - Customer Service Message API for async replies
 * - Access token management with caching
 * - Template messages
 * - Subscribe/unsubscribe events
 */

export interface WeChatChannelConfig {
  /** WeChat Official Account AppID */
  appId: string;
  /** WeChat Official Account AppSecret */
  appSecret: string;
  /** Verification token for message validation */
  token: string;
  /** AES encoding key for encrypted messages (optional) */
  encodingAESKey?: string;
  /** HTTP server port (default: 8080) */
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
  private server: http.Server | null = null;

  constructor(config: WeChatChannelConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    const port = this.config.port ?? 8080;

    this.server = http.createServer(async (req, res) => {
      try {
        if (req.method === 'GET') {
          await this.handleVerification(req, res);
        } else if (req.method === 'POST') {
          await this.handleIncoming(req, res);
        } else {
          res.writeHead(405);
          res.end('Method Not Allowed');
        }
      } catch (err) {
        console.error('[WeChatChannel] Error:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(port, () => {
        console.log(`[WeChatChannel] Listening on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Verify WeChat signature for GET requests */
  private async handleVerification(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const signature = url.searchParams.get('signature') ?? '';
    const timestamp = url.searchParams.get('timestamp') ?? '';
    const nonce = url.searchParams.get('nonce') ?? '';
    const echostr = url.searchParams.get('echostr') ?? '';

    if (this.verifySignature(signature, timestamp, nonce)) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(echostr);
    } else {
      res.writeHead(403);
      res.end('Invalid signature');
    }
  }

  /** Handle incoming POST messages (XML) */
  private async handleIncoming(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const wxMsg = WeChatChannel.parseXML(body);

    if (!wxMsg) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const replyText = await this.handleMessage(wxMsg);

    if (replyText) {
      const xml = WeChatChannel.formatXMLResponse(
        wxMsg.fromUserName,
        wxMsg.toUserName,
        replyText
      );
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xml);
    } else {
      // Return "success" to prevent WeChat retries
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('success');
    }
  }

  /** Verify WeChat signature */
  verifySignature(signature: string, timestamp: string, nonce: string): boolean {
    const arr = [this.config.token, timestamp, nonce].sort();
    const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex');
    return hash === signature;
  }

  /** Parse WeChat XML message using regex */
  static parseXML(xml: string): WeChatMessage | null {
    const extract = (tag: string): string => {
      const cdataMatch = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
      if (cdataMatch) return cdataMatch[1];
      const plainMatch = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return plainMatch ? plainMatch[1] : '';
    };

    const toUserName = extract('ToUserName');
    const fromUserName = extract('FromUserName');
    const createTime = extract('CreateTime');
    const msgType = extract('MsgType');

    if (!toUserName || !fromUserName || !msgType) return null;

    return {
      toUserName,
      fromUserName,
      createTime: parseInt(createTime, 10) || 0,
      msgType: msgType as WeChatMessage['msgType'],
      content: extract('Content') || undefined,
      msgId: extract('MsgId') || undefined,
      event: extract('Event') || undefined,
      eventKey: extract('EventKey') || undefined,
    };
  }

  /** Format response as WeChat XML */
  static formatXMLResponse(toUser: string, fromUser: string, content: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
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

  /** Handle WeChat events */
  private handleEvent(wxMsg: WeChatMessage): string {
    switch (wxMsg.event) {
      case 'subscribe':
        return 'Welcome! How can I help you?';
      case 'unsubscribe':
        return '';
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

  /** Get or refresh access token */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`;

    const data = await this.httpsGet(url);
    const parsed = JSON.parse(data);

    if (parsed.access_token) {
      this.accessToken = parsed.access_token;
      this.tokenExpiry = Date.now() + (parsed.expires_in - 300) * 1000;
      return this.accessToken!;
    }

    throw new Error(`[WeChatChannel] Failed to get access token: ${data}`);
  }

  /** Send customer service message */
  async sendMessage(openId: string, text: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`;

    const body = JSON.stringify({
      touser: openId,
      msgtype: 'text',
      text: { content: text },
    });

    await this.httpsPost(url, body);
  }

  /** Send template message */
  async sendTemplateMessage(data: TemplateMessageData): Promise<boolean> {
    const token = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;

    const body = JSON.stringify({
      touser: data.toUser,
      template_id: data.templateId,
      url: data.url,
      data: data.data,
    });

    const result = await this.httpsPost(url, body);
    const parsed = JSON.parse(result);
    return parsed.errcode === 0;
  }

  /** Read request body */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  /** Simple HTTPS GET */
  private httpsGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /** Simple HTTPS POST */
  private httpsPost(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
