import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { Message } from '../core/types';
import { BaseChannel } from './index';
import { KnowledgeBase } from '../core/knowledge';
import { createProvider, type LLMProvider } from '../providers';
import { createAuthMiddleware, type AuthConfig } from '../core/auth';

const AGENT_TEMPLATES = [
  { id: 'customer-service', name: 'Customer Service', description: 'Handle support tickets, FAQs, and customer inquiries', icon: '🎧', category: 'Business' },
  { id: 'code-reviewer', name: 'Code Reviewer', description: 'Review PRs, suggest improvements, check for bugs', icon: '🔍', category: 'Engineering' },
  { id: 'content-writer', name: 'Content Writer', description: 'Write blogs, social media posts, and marketing copy', icon: '✍️', category: 'Marketing' },
  { id: 'executive-assistant', name: 'Executive Assistant', description: 'Schedule management, email drafting, meeting prep', icon: '📋', category: 'Business' },
  { id: 'knowledge-base', name: 'Knowledge Base', description: 'RAG-powered Q&A over your documents', icon: '📚', category: 'Knowledge' },
  { id: 'project-manager', name: 'Project Manager', description: 'Track tasks, milestones, and team coordination', icon: '📊', category: 'Business' },
  { id: 'sales-assistant', name: 'Sales Assistant', description: 'Lead qualification, outreach drafting, CRM updates', icon: '💼', category: 'Sales' },
  { id: 'financial-advisor', name: 'Financial Advisor', description: 'Budget analysis, financial planning, cost optimization', icon: '💰', category: 'Finance' },
  { id: 'hr-recruiter', name: 'HR Recruiter', description: 'Resume screening, interview scheduling, candidate comms', icon: '👥', category: 'HR' },
  { id: 'legal-assistant', name: 'Legal Assistant', description: 'Contract review, compliance checks, legal research', icon: '⚖️', category: 'Legal' },
];

const TEMPLATES_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Agent Templates</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f23;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px}
h1{font-size:28px;margin-bottom:8px;color:#fff}
.sub{color:#8a8aa0;margin-bottom:32px;font-size:14px}
nav{margin-bottom:24px}
nav a{color:#818cf8;text-decoration:none;margin-right:16px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:#1a1a3a;border:1px solid #2d2d4e;border-radius:14px;padding:24px;cursor:pointer;transition:all .2s}
.card:hover{border-color:#818cf8;transform:translateY(-2px);box-shadow:0 4px 20px rgba(129,140,248,.15)}
.card .icon{font-size:32px;margin-bottom:12px}
.card h3{font-size:16px;color:#fff;margin-bottom:8px}
.card p{font-size:13px;color:#888;line-height:1.5}
.card .cat{font-size:11px;color:#818cf8;text-transform:uppercase;letter-spacing:1px;margin-top:12px}
.btn{display:inline-block;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;margin-top:12px}
.btn:hover{background:#1d4ed8}
</style>
</head>
<body>
<nav><a href="/">← Chat</a><a href="/dashboard">Dashboard</a><a href="/templates">Templates</a></nav>
<h1>🧩 Agent Templates</h1>
<p class="sub">Create a new agent from a pre-built template in one click.</p>
<div class="grid" id="grid"></div>
<script>
fetch('/api/templates').then(r=>r.json()).then(d=>{
  const g=document.getElementById('grid');
  d.templates.forEach(t=>{
    g.innerHTML+=\`<div class="card"><div class="icon">\${t.icon}</div><h3>\${t.name}</h3><p>\${t.description}</p><div class="cat">\${t.category}</div><button class="btn" onclick="alert('Creating agent from template: '+'\${t.id}'+'\\\\nRun: opc init --template \${t.id}')">Use Template</button></div>\`;
  });
});
</script>
</body>
</html>`;

const CHAT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>OPC Agent</title>
<style>
:root{--bg:#0f0f23;--surface:#1a1a3a;--border:#2d2d4e;--text:#e0e0e0;--text-dim:#8a8aa0;--accent:#818cf8;--accent-hover:#6366f1;--user-bg:#667eea;--user-hover:#5a6fd6;--error-bg:#7f1d1d;--error-text:#fca5a5;--success:#22c55e;--radius:14px}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
header{background:var(--surface);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;backdrop-filter:blur(12px)}
header .avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#6366f1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
header .info{flex:1;min-width:0}
header h1{font-size:16px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
header .status{font-size:12px;color:var(--success);display:flex;align-items:center;gap:4px}
header .status .dot{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse 2s infinite}
nav.header-nav{display:flex;gap:4px}
nav.header-nav a{color:var(--text-dim);text-decoration:none;font-size:12px;padding:4px 10px;border-radius:6px;transition:all .2s}
nav.header-nav a:hover{color:#fff;background:rgba(255,255,255,.06)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
#messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
#messages::-webkit-scrollbar{width:4px}
#messages::-webkit-scrollbar-track{background:transparent}
#messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
.msg-wrap{display:flex;flex-direction:column;animation:fadeIn .3s ease-out}
.msg-wrap.user{align-items:flex-end}
.msg-wrap.assistant{align-items:flex-start}
.msg{max-width:min(720px,85%);padding:10px 14px;border-radius:var(--radius);line-height:1.7;font-size:14px;word-break:break-word;position:relative;transition:all .2s}
.msg.user{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-bottom-right-radius:4px;box-shadow:0 2px 8px rgba(102,126,234,.35)}
.msg.assistant{background:#2a2a4a;color:var(--text);border:1px solid var(--border);border-bottom-left-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.msg.error{background:var(--error-bg);color:var(--error-text);border:1px solid rgba(239,68,68,.3)}
.msg pre{background:rgba(0,0,0,.4);padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;line-height:1.5}
.msg code{font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;font-size:13px;background:rgba(0,0,0,.3);padding:1px 5px;border-radius:4px}
.msg pre code{background:none;padding:0}
.msg .cursor{display:inline-block;width:2px;height:14px;background:var(--accent);animation:blink .6s infinite;vertical-align:text-bottom;margin-left:2px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.typing{display:flex;gap:4px;padding:12px 16px;align-items:center}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--text-dim);animation:typingDot 1.4s infinite}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes typingDot{0%,60%,100%{opacity:.3;transform:scale(.8)}30%{opacity:1;transform:scale(1)}}
.reactions{display:flex;gap:4px;margin-top:4px}
.reactions button{background:rgba(255,255,255,.06);border:1px solid transparent;border-radius:16px;padding:2px 8px;font-size:13px;cursor:pointer;transition:all .15s;color:var(--text-dim)}
.reactions button:hover{background:rgba(255,255,255,.12);border-color:var(--border)}
.reactions button.active{background:rgba(99,102,241,.2);border-color:var(--accent);color:var(--accent)}
.msg-time{font-size:11px;color:var(--text-dim);margin-top:2px;opacity:0;transition:opacity .2s}
.msg-wrap:hover .msg-time{opacity:1}
.attachment{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.3);padding:8px 12px;border-radius:8px;margin-top:6px;font-size:13px}
.attachment .icon{font-size:18px}
#input-area{background:var(--surface);padding:12px 20px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-end;flex-shrink:0}
#input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;color:#fff;font-size:14px;outline:none;resize:none;max-height:150px;min-height:42px;font-family:inherit;line-height:1.5;transition:border-color .2s}
#input:focus{border-color:var(--accent)}
#input::placeholder{color:var(--text-dim)}
#send{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:var(--radius);padding:0 16px;height:42px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:.5px}
#send:hover{background:var(--user-hover);transform:scale(1.05)}
#send:disabled{background:#334155;cursor:not-allowed;transform:none}
.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-dim);gap:12px;padding:40px;text-align:center}
.empty-state .logo{font-size:48px;opacity:.6}
.empty-state h2{color:var(--text);font-size:20px;font-weight:500}
.empty-state p{font-size:14px;max-width:400px;line-height:1.6}
@media(max-width:640px){
  header{padding:10px 14px}
  #messages{padding:12px}
  #input-area{padding:10px 14px 14px}
  .msg{max-width:90%;font-size:14px}
  nav.header-nav{display:none}
}
</style>
</head>
<body>
<header>
<div class="avatar" id="avatar">🤖</div>
<div class="info"><h1 id="title">OPC Agent</h1><div class="status"><span class="dot"></span>在线</div></div>
<nav class="header-nav"><a href="/dashboard">Dashboard</a><a href="/templates">Templates</a></nav>
</header>
<div id="messages">
<div class="empty-state" id="empty"><div class="logo">💬</div><h2>开始对话</h2><p>在下方输入消息与 AI 助手对话。</p></div>
</div>
<div id="input-area">
<textarea id="input" rows="1" placeholder="输入消息…" autocomplete="off"></textarea>
<button id="send" aria-label="发送">发送</button>
</div>
<script>
const msgs=document.getElementById('messages'),input=document.getElementById('input'),btn=document.getElementById('send'),empty=document.getElementById('empty');
let sessionId=crypto.randomUUID(),sending=false;

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmtTime(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function renderMd(text){
  let h=esc(text);
  h=h.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g,'<pre><code>$2</code></pre>');
  h=h.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
  h=h.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
  h=h.replace(/\\n/g,'<br>');
  return h;
}

function addMsg(role,text,opts){
  if(empty)empty.remove();
  const wrap=document.createElement('div');
  wrap.className='msg-wrap '+role;
  const d=document.createElement('div');
  d.className='msg '+role;
  if(opts?.html)d.innerHTML=text;else if(role==='assistant'&&text)d.innerHTML=renderMd(text);else d.textContent=text;
  wrap.appendChild(d);
  const time=document.createElement('div');
  time.className='msg-time';
  time.textContent=fmtTime();
  wrap.appendChild(time);
  if(role==='assistant'&&text){
    const rx=document.createElement('div');rx.className='reactions';
    rx.innerHTML='<button data-r="👍" onclick="react(this)">👍</button><button data-r="👎" onclick="react(this)">👎</button>';
    wrap.appendChild(rx);
  }
  msgs.appendChild(wrap);
  msgs.scrollTop=msgs.scrollHeight;
  return d;
}

window.react=function(el){el.classList.toggle('active')};

input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,150)+'px'});
btn.addEventListener('click',send);

async function send(){
  const text=input.value.trim();
  if(!text||sending)return;
  sending=true;btn.disabled=true;
  input.value='';input.style.height='auto';
  addMsg('user',text);
  const wrap=document.createElement('div');wrap.className='msg-wrap assistant';
  const d=document.createElement('div');d.className='msg assistant';
  d.innerHTML='<div class="typing"><span></span><span></span><span></span><small style="margin-left:6px;font-size:12px;color:#8a8aa0">思考中…</small></div>';
  wrap.appendChild(d);
  const time=document.createElement('div');time.className='msg-time';time.textContent=fmtTime();
  wrap.appendChild(time);
  msgs.appendChild(wrap);msgs.scrollTop=msgs.scrollHeight;
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
        const dd=line.slice(6);if(dd==='[DONE]')continue;
        try{const j=JSON.parse(dd);if(j.content)full+=j.content;if(j.error)full='Error: '+j.error;}catch{}
      }
      d.innerHTML=renderMd(full)+'<span class="cursor"></span>';
      msgs.scrollTop=msgs.scrollHeight;
    }
    if(!full){d.textContent='(empty response)';}else{d.innerHTML=renderMd(full);}
    const rx=document.createElement('div');rx.className='reactions';
    rx.innerHTML='<button data-r="👍" onclick="react(this)">👍</button><button data-r="👎" onclick="react(this)">👎</button>';
    wrap.appendChild(rx);
  }catch(e){d.className='msg error';d.textContent='Error: '+e.message;}
  sending=false;btn.disabled=false;input.focus();
}

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
body{background:#0f0f23;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px}
h1{font-size:24px;margin-bottom:24px;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:32px}
.card{background:#1a1a3a;border:1px solid #2d2d4e;border-radius:14px;padding:20px}
.card .label{font-size:12px;color:#8a8aa0;text-transform:uppercase;letter-spacing:1px}
.card .value{font-size:32px;font-weight:700;color:#818cf8;margin-top:4px}
.card .sub{font-size:12px;color:#555;margin-top:4px}
nav{margin-bottom:24px}
nav a{color:#818cf8;text-decoration:none;margin-right:16px;font-size:14px}
nav a:hover{text-decoration:underline}
.chart{background:#1a1a3a;border:1px solid #2d2d4e;border-radius:14px;padding:20px;margin-bottom:16px}
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
  private stats = { sessions: 0, messages: 0, totalResponseMs: 0, tokenUsage: 0, knowledgeFiles: 0, startedAt: Date.now(), errors: 0 };
  private eventHandlers: Map<string, Function[]> = new Map();
  private conversations: Map<string, Message[]> = new Map();
  private requestCount = 0;
  private llmLatencySum = 0;
  private llmCalls = 0;

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
    this.requestCount++;
    this.llmLatencySum += responseMs;
    this.llmCalls++;
  }

  trackError(): void { this.stats.errors++; }

  trackSession(): void { this.stats.sessions++; }

  constructor(port: number = 3000, authConfig?: AuthConfig) {
    super();
    this.port = port;
    this.app = express();
    this.app.use(express.json({ limit: '10mb' }));
    if (authConfig && authConfig.apiKeys.length > 0) {
      this.app.use(createAuthMiddleware(authConfig));
    }
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
      const sid = sessionId ?? 'default';
      if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const msg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        metadata: { sessionId: sid },
      };

      // Track conversation
      if (!this.conversations.has(sid)) this.conversations.set(sid, []);
      this.conversations.get(sid)!.push(msg);

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

    // --- Health Check (detailed) ---
    this.app.get('/api/health', (_req: Request, res: Response) => {
      const uptimeMs = Date.now() - this.stats.startedAt;
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: uptimeMs,
        uptimeHuman: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
        version: '1.0.0',
        agent: this.agentName,
        stats: {
          sessions: this.stats.sessions,
          messages: this.stats.messages,
          errors: this.stats.errors,
          avgResponseMs: this.stats.messages > 0 ? Math.round(this.stats.totalResponseMs / this.stats.messages) : 0,
        },
        memory: {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
        },
      });
    });

    // --- Prometheus Metrics ---
    this.app.get('/api/metrics', (_req: Request, res: Response) => {
      const uptimeMs = Date.now() - this.stats.startedAt;
      const avgLatency = this.llmCalls > 0 ? this.llmLatencySum / this.llmCalls : 0;
      const mem = process.memoryUsage();
      res.type('text/plain').send(
        `# HELP opc_uptime_seconds Agent uptime in seconds\n` +
        `# TYPE opc_uptime_seconds gauge\n` +
        `opc_uptime_seconds ${(uptimeMs / 1000).toFixed(1)}\n` +
        `# HELP opc_requests_total Total requests\n` +
        `# TYPE opc_requests_total counter\n` +
        `opc_requests_total ${this.requestCount}\n` +
        `# HELP opc_messages_total Total messages processed\n` +
        `# TYPE opc_messages_total counter\n` +
        `opc_messages_total ${this.stats.messages}\n` +
        `# HELP opc_errors_total Total errors\n` +
        `# TYPE opc_errors_total counter\n` +
        `opc_errors_total ${this.stats.errors}\n` +
        `# HELP opc_llm_latency_avg_ms Average LLM response latency\n` +
        `# TYPE opc_llm_latency_avg_ms gauge\n` +
        `opc_llm_latency_avg_ms ${avgLatency.toFixed(1)}\n` +
        `# HELP opc_sessions_total Total sessions\n` +
        `# TYPE opc_sessions_total counter\n` +
        `opc_sessions_total ${this.stats.sessions}\n` +
        `# HELP opc_token_usage_total Total token usage\n` +
        `# TYPE opc_token_usage_total counter\n` +
        `opc_token_usage_total ${this.stats.tokenUsage}\n` +
        `# HELP process_resident_memory_bytes Resident memory size\n` +
        `# TYPE process_resident_memory_bytes gauge\n` +
        `process_resident_memory_bytes ${mem.rss}\n`
      );
    });

    // --- Conversation tracking & export ---
    this.app.get('/api/conversations/export', (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const format = (req.query.format as string) ?? 'json';

      const messages = sessionId ? (this.conversations.get(sessionId) ?? []) : Array.from(this.conversations.values()).flat();

      if (format === 'markdown') {
        const md = messages.map(m => `**${m.role}** (${new Date(m.timestamp).toISOString()}):\n${m.content}`).join('\n\n---\n\n');
        res.type('text/markdown').send(md);
      } else if (format === 'csv') {
        const header = 'id,role,content,timestamp\n';
        const rows = messages.map(m => `"${m.id}","${m.role}","${m.content.replace(/"/g, '""')}",${m.timestamp}`).join('\n');
        res.type('text/csv').send(header + rows);
      } else {
        res.json({ sessionId: sessionId ?? 'all', messages, count: messages.length });
      }
    });

    // --- Document Upload ---
    this.app.post('/api/documents/upload', async (req: Request, res: Response) => {
      try {
        const { content, filename, mimeType } = req.body;
        if (!content || !filename) {
          res.status(400).json({ error: 'content and filename are required' });
          return;
        }
        const kb = new KnowledgeBase('.');
        const result = await kb.addText(content, filename);
        this.stats.knowledgeFiles++;
        res.json({ ok: true, filename, chunks: result.chunks, chars: content.length });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      }
    });

    // --- Agent Templates Gallery ---
    this.app.get('/api/templates', (_req: Request, res: Response) => {
      res.json({ templates: AGENT_TEMPLATES });
    });

    this.app.get('/templates', (_req: Request, res: Response) => {
      res.type('html').send(TEMPLATES_HTML);
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
