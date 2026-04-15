import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { Message } from '../core/types';
import { BaseChannel } from './index';
import { KnowledgeBase } from '../core/knowledge';
import { createProvider, type LLMProvider } from '../providers';

const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OPC Agent</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;height:100vh;display:flex;flex-direction:column}
header{background:#12121a;padding:16px 24px;border-bottom:1px solid #1e1e2e;display:flex;align-items:center;gap:12px}
header h1{font-size:18px;font-weight:600;color:#fff}
header .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
#messages{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px}
.msg{max-width:720px;padding:12px 16px;border-radius:12px;line-height:1.6;font-size:14px;white-space:pre-wrap;word-break:break-word}
.msg.user{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px}
.msg.assistant{align-self:flex-start;background:#1e1e2e;color:#d4d4d8;border-bottom-left-radius:4px}
.msg.assistant .cursor{display:inline-block;width:2px;height:14px;background:#818cf8;animation:blink .6s infinite;vertical-align:text-bottom;margin-left:2px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.msg.error{background:#7f1d1d;color:#fca5a5}
#input-area{background:#12121a;padding:16px 24px;border-top:1px solid #1e1e2e;display:flex;gap:12px}
#input{flex:1;background:#1e1e2e;border:1px solid #2e2e3e;border-radius:10px;padding:12px 16px;color:#fff;font-size:14px;outline:none;resize:none;max-height:120px;font-family:inherit}
#input:focus{border-color:#818cf8}
#send{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:14px;cursor:pointer;font-weight:500;transition:background .2s}
#send:hover{background:#1d4ed8}
#send:disabled{background:#334155;cursor:not-allowed}
</style>
</head>
<body>
<header><div class="dot"></div><h1 id="title">OPC Agent</h1></header>
<div id="messages"></div>
<div id="input-area">
<textarea id="input" rows="1" placeholder="Type a message..." autocomplete="off"></textarea>
<button id="send">Send</button>
</div>
<script>
const msgs=document.getElementById('messages'),input=document.getElementById('input'),btn=document.getElementById('send');
let sessionId=crypto.randomUUID(),sending=false;

function addMsg(role,text){
  const d=document.createElement('div');
  d.className='msg '+role;
  d.textContent=text;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
  return d;
}

input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px'});
btn.addEventListener('click',send);

async function send(){
  const text=input.value.trim();
  if(!text||sending)return;
  sending=true;btn.disabled=true;
  input.value='';input.style.height='auto';
  addMsg('user',text);
  const el=addMsg('assistant','');
  el.innerHTML='<span class="cursor"></span>';
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,sessionId})});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const reader=res.body.getReader(),dec=new TextDecoder();
    let full='';
    while(true){
      const{done,value}=await reader.read();
      if(done)break;
      const chunk=dec.decode(value,{stream:true});
      const lines=chunk.split('\\n');
      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        const d=line.slice(6);
        if(d==='[DONE]')continue;
        try{const j=JSON.parse(d);if(j.content)full+=j.content;if(j.error)full='Error: '+j.error;}catch{}
      }
      el.textContent=full;
      msgs.scrollTop=msgs.scrollHeight;
    }
    if(!full)el.textContent='(empty response)';
  }catch(e){
    el.className='msg error';el.textContent='Error: '+e.message;
  }
  sending=false;btn.disabled=false;input.focus();
}

// Fetch agent info
fetch('/api/info').then(r=>r.json()).then(d=>{if(d.name)document.getElementById('title').textContent=d.name}).catch(()=>{});
</script>
</body>
</html>`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OPC Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px}
h1{font-size:24px;margin-bottom:24px;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:32px}
.card{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:20px}
.card .label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}
.card .value{font-size:32px;font-weight:700;color:#818cf8;margin-top:4px}
.card .sub{font-size:12px;color:#555;margin-top:4px}
nav{margin-bottom:24px}
nav a{color:#818cf8;text-decoration:none;margin-right:16px;font-size:14px}
nav a:hover{text-decoration:underline}
.chart{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:20px;margin-bottom:16px}
.chart h3{font-size:14px;color:#888;margin-bottom:12px}
</style>
</head>
<body>
<nav><a href="/">← Chat</a><a href="/dashboard">Dashboard</a></nav>
<h1>📊 Agent Dashboard</h1>
<div class="grid">
  <div class="card"><div class="label">Sessions</div><div class="value" id="sessions">0</div></div>
  <div class="card"><div class="label">Messages</div><div class="value" id="messages">0</div></div>
  <div class="card"><div class="label">Avg Response</div><div class="value" id="avgMs">0ms</div></div>
  <div class="card"><div class="label">Token Usage</div><div class="value" id="tokens">0</div></div>
  <div class="card"><div class="label">Uptime</div><div class="value" id="uptime">0m</div></div>
  <div class="card"><div class="label">Knowledge Files</div><div class="value" id="kb">0</div></div>
</div>
<div class="chart"><h3>Messages Over Time</h3><svg id="chart" width="100%" height="120" viewBox="0 0 600 120"></svg></div>
<script>
async function refresh(){
  try{
    const r=await fetch('/api/dashboard');const d=await r.json();
    document.getElementById('sessions').textContent=d.sessions;
    document.getElementById('messages').textContent=d.messages;
    document.getElementById('avgMs').textContent=d.messages>0?Math.round(d.totalResponseMs/d.messages)+'ms':'0ms';
    document.getElementById('tokens').textContent=d.tokenUsage.toLocaleString();
    document.getElementById('kb').textContent=d.knowledgeFiles;
    const mins=Math.round((Date.now()-d.startedAt)/60000);
    document.getElementById('uptime').textContent=mins<60?mins+'m':Math.round(mins/60)+'h '+mins%60+'m';
  }catch{}
}
refresh();setInterval(refresh,5000);
</script>
</body>
</html>`;

export class WebChannel extends BaseChannel {
  readonly type = 'web';
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private streamHandler: ((msg: Message, res: Response) => Promise<void>) | null = null;
  private agentName: string = 'OPC Agent';
  private currentProvider: string = 'openai';
  private stats = { sessions: 0, messages: 0, totalResponseMs: 0, tokenUsage: 0, knowledgeFiles: 0, startedAt: Date.now() };
  private eventHandlers: Map<string, Function[]> = new Map();

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const h of handlers) h(data);
  }

  onConfigChange(handler: (config: any) => void): void {
    const handlers = this.eventHandlers.get('config:change') ?? [];
    handlers.push(handler);
    this.eventHandlers.set('config:change', handlers);
  }

  trackMessage(responseMs: number, tokens: number = 0): void {
    this.stats.messages++;
    this.stats.totalResponseMs += responseMs;
    this.stats.tokenUsage += tokens;
  }

  trackSession(): void { this.stats.sessions++; }

  constructor(port: number = 3000) {
    super();
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  setAgentName(name: string): void {
    this.agentName = name;
  }

  onStreamMessage(handler: (msg: Message, res: Response) => Promise<void>): void {
    this.streamHandler = handler;
  }

  private setupRoutes(): void {
    this.app.get('/', (_req: Request, res: Response) => {
      res.type('html').send(CHAT_HTML);
    });

    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    this.app.get('/api/info', (_req: Request, res: Response) => {
      res.json({ name: this.agentName });
    });

    // Streaming chat endpoint
    this.app.post('/api/chat', async (req: Request, res: Response) => {
      const { message, sessionId } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const msg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: { sessionId: sessionId ?? 'default' },
      };

      if (this.streamHandler) {
        try {
          await this.streamHandler(msg, res);
        } catch (err) {
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal error' });
          }
        }
        return;
      }

      // Fallback: non-streaming
      if (!this.handler) {
        res.status(503).json({ error: 'Agent not ready' });
        return;
      }

      try {
        const response = await this.handler(msg);
        res.json({ response: response.content, id: response.id });
      } catch (err) {
        res.status(500).json({ error: 'Internal error' });
      }
    });

    // --- Multi-LLM Config API ---
    this.app.get('/api/config', (_req: Request, res: Response) => {
      res.json({
        provider: this.currentProvider,
        providers: [
          { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
          { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
          { id: 'ollama', name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral', 'codellama'] },
          { id: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
          { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
        ],
      });
    });

    this.app.post('/api/config', (req: Request, res: Response) => {
      const { provider, model, baseUrl, apiKey } = req.body;
      if (provider) this.currentProvider = provider;
      // Emit config change event for runtime to handle
      this.emit('config:change', { provider, model, baseUrl, apiKey });
      res.json({ ok: true, provider: this.currentProvider });
    });

    // --- Dashboard ---
    this.app.get('/dashboard', (_req: Request, res: Response) => {
      res.type('html').send(DASHBOARD_HTML);
    });

    this.app.get('/api/dashboard', (_req: Request, res: Response) => {
      res.json(this.stats);
    });

    // --- Knowledge Base Upload ---
    this.app.post('/api/kb/upload', async (req: Request, res: Response) => {
      try {
        const { content, filename } = req.body;
        if (!content) { res.status(400).json({ error: 'content required' }); return; }
        const kb = new KnowledgeBase('.');
        const result = await kb.addText(content, filename ?? 'upload');
        this.stats.knowledgeFiles++;
        res.json({ ok: true, chunks: result.chunks });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    });

    this.app.get('/api/kb/stats', (_req: Request, res: Response) => {
      try {
        const kb = new KnowledgeBase('.');
        res.json(kb.getStats());
      } catch { res.json({ totalEntries: 0, sources: [] }); }
    });

    // Legacy endpoint
    this.app.post('/chat', async (req: Request, res: Response) => {
      if (!this.handler) {
        res.status(503).json({ error: 'Agent not ready' });
        return;
      }
      const { message, sessionId } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
      }
      const msg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: { sessionId: sessionId ?? 'default' },
      };
      try {
        const response = await this.handler(msg);
        res.json({ response: response.content, id: response.id });
      } catch {
        res.status(500).json({ error: 'Internal error' });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[WebChannel] Listening on http://localhost:${this.port}`);
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
}
