import { BaseChannel } from './index';
import type { Message } from '../core/types';
import * as http from 'http';
import * as net from 'net';
import * as tls from 'tls';
import * as crypto from 'crypto';

/**
 * Email Channel — v1.0.0
 *
 * Supports two modes:
 * - webhook: Receives emails via HTTP POST (works with email forwarding services)
 * - imap: TODO - Full IMAP polling (complex, requires raw socket IMAP protocol)
 *
 * Sends via SMTP with STARTTLS support using Node.js built-in tls module.
 * No external dependencies (no nodemailer).
 */

export interface EmailChannelConfig {
  /** Mode: 'webhook' (recommended) or 'imap' (TODO) */
  mode?: 'webhook' | 'imap';
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from?: string;
  };
  imap?: {
    host: string;
    port: number;
    user: string;
    password: string;
    tls?: boolean;
    mailbox?: string;
    pollInterval?: number;
  };
  /** Webhook server port (default: 8082) */
  webhookPort?: number;
  /** Filter: only process emails from these addresses */
  filters?: {
    from?: string[];
    subject?: string[];
  };
}

export interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  html?: string;
  date: Date;
  inReplyTo?: string;
  references?: string[];
  threadId?: string;
}

export class EmailChannel extends BaseChannel {
  type = 'email';
  private config: EmailChannelConfig;
  private server: http.Server | null = null;
  private processedIds: Set<string> = new Set();

  constructor(config: EmailChannelConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    const mode = this.config.mode ?? 'webhook';
    if (mode === 'webhook') {
      await this.startWebhook();
    } else {
      console.warn('[EmailChannel] IMAP mode is not yet implemented. Use webhook mode.');
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
      this.server = null;
    });
  }

  /** Start webhook HTTP server */
  private async startWebhook(): Promise<void> {
    const port = this.config.webhookPort ?? 8082;

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', channel: 'email', mode: 'webhook' }));
        return;
      }

      if (req.method === 'POST' && (req.url === '/email/incoming' || req.url === '/')) {
        try {
          const body = await this.readBody(req);
          const parsed = JSON.parse(body);
          const email = EmailChannel.parseWebhookPayload(parsed);

          if (!email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid email payload' }));
            return;
          }

          // Deduplicate
          if (this.processedIds.has(email.messageId)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, duplicate: true }));
            return;
          }
          this.processedIds.add(email.messageId);
          if (this.processedIds.size > 5000) {
            const arr = [...this.processedIds];
            this.processedIds = new Set(arr.slice(-2500));
          }

          // Apply filters
          if (!this.matchesFilters(email)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, filtered: true }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));

          // Process async
          if (this.handler) {
            const msg = this.emailToMessage(email);
            try {
              const reply = await this.handler(msg);
              if (this.config.smtp) {
                await this.sendEmail(
                  email.from,
                  `Re: ${email.subject}`,
                  reply.content,
                  email.messageId
                );
              }
            } catch (err) {
              console.error('[EmailChannel] Handler error:', err);
            }
          }
        } catch (err) {
          console.error('[EmailChannel] Webhook error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal error' }));
        }
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    return new Promise((resolve) => {
      this.server!.listen(port, () => {
        console.log(`[EmailChannel] Webhook listening on port ${port}`);
        resolve();
      });
    });
  }

  /** Parse webhook payload into EmailMessage */
  static parseWebhookPayload(payload: any): EmailMessage | null {
    // Support common email webhook formats (SendGrid, Mailgun, generic)
    const from = payload.from ?? payload.sender ?? payload.envelope?.from;
    const subject = payload.subject ?? '(no subject)';
    const body = payload.body ?? payload.text ?? payload['body-plain'] ?? payload.content ?? '';
    const to = payload.to ?? payload.recipient ?? payload.envelope?.to;

    if (!from) return null;

    return {
      messageId: payload.messageId ?? payload['Message-Id'] ?? payload.id ?? `email-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      from: typeof from === 'string' ? from : String(from),
      to: Array.isArray(to) ? to : (typeof to === 'string' ? [to] : []),
      cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined,
      subject,
      body,
      html: payload.html ?? payload['body-html'],
      date: payload.date ? new Date(payload.date) : new Date(),
      inReplyTo: payload.inReplyTo ?? payload['In-Reply-To'],
      references: payload.references ? (Array.isArray(payload.references) ? payload.references : [payload.references]) : undefined,
      threadId: payload.threadId,
    };
  }

  /** Convert email to internal Message */
  private emailToMessage(email: EmailMessage): Message {
    return {
      id: email.messageId,
      role: 'user',
      content: email.body,
      timestamp: email.date.getTime(),
      metadata: {
        channel: 'email',
        from: email.from,
        to: email.to,
        subject: email.subject,
        threadId: email.threadId ?? email.messageId,
        inReplyTo: email.inReplyTo,
      },
    };
  }

  /** Check if email matches configured filters */
  matchesFilters(email: EmailMessage): boolean {
    if (!this.config.filters) return true;

    if (this.config.filters.from?.length) {
      const fromMatch = this.config.filters.from.some((f) =>
        email.from.toLowerCase().includes(f.toLowerCase())
      );
      if (!fromMatch) return false;
    }

    if (this.config.filters.subject?.length) {
      const subjectMatch = this.config.filters.subject.some((s) =>
        email.subject.toLowerCase().includes(s.toLowerCase())
      );
      if (!subjectMatch) return false;
    }

    return true;
  }

  /** Send email via SMTP with STARTTLS */
  async sendEmail(to: string, subject: string, body: string, inReplyTo?: string): Promise<void> {
    const smtp = this.config.smtp;
    if (!smtp) throw new Error('[EmailChannel] SMTP not configured');

    const from = smtp.from ?? smtp.user;
    const messageId = `<${crypto.randomBytes(16).toString('hex')}@opc-agent>`;

    let headers = `From: ${from}\r\n`;
    headers += `To: ${to}\r\n`;
    headers += `Subject: ${subject}\r\n`;
    headers += `Message-ID: ${messageId}\r\n`;
    headers += `Date: ${new Date().toUTCString()}\r\n`;
    if (inReplyTo) {
      headers += `In-Reply-To: ${inReplyTo}\r\n`;
      headers += `References: ${inReplyTo}\r\n`;
    }
    headers += `MIME-Version: 1.0\r\n`;
    headers += `Content-Type: text/plain; charset=UTF-8\r\n`;
    headers += `\r\n`;
    headers += body;

    await this.smtpSend(smtp.host, smtp.port, smtp.user, smtp.pass, from, to, headers);
  }

  /** Raw SMTP send with STARTTLS */
  private smtpSend(
    host: string, port: number,
    user: string, pass: string,
    from: string, to: string,
    message: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let socket: net.Socket | tls.TLSSocket = net.createConnection(port, host);
      let upgraded = false;
      let step = 0;

      const commands = [
        `EHLO opc-agent\r\n`,
        `STARTTLS\r\n`,
        // After TLS upgrade:
        `EHLO opc-agent\r\n`,
        `AUTH LOGIN\r\n`,
        `${Buffer.from(user).toString('base64')}\r\n`,
        `${Buffer.from(pass).toString('base64')}\r\n`,
        `MAIL FROM:<${from}>\r\n`,
        `RCPT TO:<${to}>\r\n`,
        `DATA\r\n`,
        `${message}\r\n.\r\n`,
        `QUIT\r\n`,
      ];

      const sendNext = () => {
        if (step < commands.length) {
          socket.write(commands[step]);
          step++;
        }
      };

      socket.on('data', (data: Buffer) => {
        const response = data.toString();
        const code = parseInt(response.substring(0, 3), 10);

        if (code >= 400) {
          socket.destroy();
          reject(new Error(`SMTP error: ${response.trim()}`));
          return;
        }

        // After STARTTLS response (220), upgrade to TLS
        if (step === 2 && !upgraded && response.startsWith('220')) {
          upgraded = true;
          const tlsSocket = tls.connect({ socket, host, servername: host }, () => {
            socket = tlsSocket;
            sendNext(); // EHLO again after TLS
          });
          tlsSocket.on('data', (d: Buffer) => {
            const resp = d.toString();
            const c = parseInt(resp.substring(0, 3), 10);
            if (c >= 400) {
              tlsSocket.destroy();
              reject(new Error(`SMTP error: ${resp.trim()}`));
              return;
            }
            if (step === commands.length && resp.startsWith('221')) {
              tlsSocket.destroy();
              resolve();
              return;
            }
            sendNext();
          });
          tlsSocket.on('error', reject);
          return;
        }

        sendNext();
      });

      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('SMTP connection timeout'));
      });
      socket.setTimeout(30000);
    });
  }

  /** Read request body */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }
}
