import express, { type Express, type Request, type Response } from 'express';
import type { Server } from 'http';
import type { Message } from '../core/types';
import { BaseChannel } from './index';

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

export class WebChannel extends BaseChannel {
  readonly type = 'web';
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private streamHandler: ((msg: Message, res: Response) => Promise<void>) | null = null;
  private agentName: string = 'OPC Agent';

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
