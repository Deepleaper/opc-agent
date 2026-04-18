import type { MCPTool, MCPToolResult } from '../mcp';
import * as net from 'net';
import * as tls from 'tls';

export const EmailSendTool: MCPTool = {
  name: 'email-send',
  description: 'Send email via SMTP. Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body (plain text)' },
      from: { type: 'string', description: 'Sender email (defaults to SMTP_USER)' },
    },
    required: ['to', 'subject', 'body'],
  },

  async execute(input: Record<string, unknown>): Promise<MCPToolResult> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return { content: 'Error: SMTP_HOST, SMTP_USER, SMTP_PASS env vars required', isError: true };
    }

    const to = String(input.to ?? '');
    const subject = String(input.subject ?? '');
    const body = String(input.body ?? '');
    const from = String(input.from ?? user);

    if (!to || !subject) return { content: 'Error: to and subject are required', isError: true };

    try {
      await sendSmtp(host, port, user, pass, from, to, subject, body);
      return { content: `Email sent to ${to}` };
    } catch (err) {
      return { content: `SMTP error: ${(err as Error).message}`, isError: true };
    }
  },
};

function sendSmtp(host: string, port: number, user: string, pass: string, from: string, to: string, subject: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const commands = [
      `EHLO localhost`,
      `AUTH LOGIN`,
      Buffer.from(user).toString('base64'),
      Buffer.from(pass).toString('base64'),
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.`,
      `QUIT`,
    ];

    let idx = 0;
    const socket = port === 465
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.createConnection({ host, port });

    const timeout = setTimeout(() => { socket.destroy(); reject(new Error('SMTP timeout')); }, 30000);

    socket.setEncoding('utf8');
    socket.on('data', () => {
      if (idx < commands.length) {
        socket.write(commands[idx] + '\r\n');
        idx++;
      }
    });
    socket.on('end', () => { clearTimeout(timeout); resolve(); });
    socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}
