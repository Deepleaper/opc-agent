/**
 * Chat Widget — self-contained HTML+CSS+JS for embedding
 */

export interface ChatWidgetConfig {
  endpoint: string;
  theme?: 'dark' | 'light';
  title?: string;
}

export function generateChatWidget(config: ChatWidgetConfig): string {
  const { endpoint, theme = 'dark', title = 'OPC Chat' } = config;
  const isDark = theme === 'dark';
  const bg = isDark ? '#1a1a2e' : '#ffffff';
  const fg = isDark ? '#e0e0e0' : '#1a1a2e';
  const inputBg = isDark ? '#16213e' : '#f0f0f0';
  const msgUser = isDark ? '#0f3460' : '#e3f2fd';
  const msgBot = isDark ? '#1a1a2e' : '#f5f5f5';
  const accent = '#00d2ff';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${bg}; color: ${fg}; height: 100vh; display: flex; flex-direction: column; }
.chat-header { padding: 16px 20px; background: ${isDark ? '#16213e' : '#fafafa'}; border-bottom: 1px solid ${isDark ? '#2a2a4a' : '#e0e0e0'}; font-weight: 600; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.chat-header::before { content: '💬'; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; line-height: 1.5; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
.msg.user { align-self: flex-end; background: ${msgUser}; border-bottom-right-radius: 4px; }
.msg.assistant { align-self: flex-start; background: ${msgBot}; border: 1px solid ${isDark ? '#2a2a4a' : '#e0e0e0'}; border-bottom-left-radius: 4px; }
.msg.streaming::after { content: '▊'; animation: blink 0.7s infinite; }
@keyframes blink { 50% { opacity: 0; } }
.chat-input { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid ${isDark ? '#2a2a4a' : '#e0e0e0'}; background: ${isDark ? '#16213e' : '#fafafa'}; }
.chat-input textarea { flex: 1; resize: none; border: 1px solid ${isDark ? '#2a2a4a' : '#ccc'}; border-radius: 8px; padding: 10px; font-size: 14px; background: ${inputBg}; color: ${fg}; outline: none; font-family: inherit; min-height: 42px; max-height: 120px; }
.chat-input textarea:focus { border-color: ${accent}; }
.chat-input button { background: ${accent}; color: #000; border: none; border-radius: 8px; padding: 0 20px; cursor: pointer; font-weight: 600; font-size: 14px; }
.chat-input button:hover { opacity: 0.85; }
.chat-input button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
</head>
<body>
<div class="chat-header">${title}</div>
<div class="chat-messages" id="messages"></div>
<div class="chat-input">
  <textarea id="input" rows="1" placeholder="Type a message..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
  <button id="sendBtn" onclick="sendMessage()">Send</button>
</div>
<script>
const ENDPOINT = ${JSON.stringify(endpoint)};
const messages = [];
const $msgs = document.getElementById('messages');
const $input = document.getElementById('input');
const $btn = document.getElementById('sendBtn');

function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  $msgs.appendChild(div);
  $msgs.scrollTop = $msgs.scrollHeight;
  return div;
}

async function sendMessage() {
  const text = $input.value.trim();
  if (!text) return;
  $input.value = '';
  $btn.disabled = true;
  messages.push({ role: 'user', content: text });
  addMsg('user', text);

  const div = addMsg('assistant', '');
  div.classList.add('streaming');
  let full = '';

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try { const j = JSON.parse(data); full += j.content || j.delta || ''; div.textContent = full; } catch {}
          }
        }
        $msgs.scrollTop = $msgs.scrollHeight;
      }
    } else {
      const data = await res.json();
      full = data.content || data.message || JSON.stringify(data);
      div.textContent = full;
    }
  } catch (e) {
    full = 'Error: ' + e.message;
    div.textContent = full;
  }

  div.classList.remove('streaming');
  messages.push({ role: 'assistant', content: full });
  $btn.disabled = false;
  $input.focus();
}

$input.focus();
</script>
</body>
</html>`;
}
