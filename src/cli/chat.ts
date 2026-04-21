import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { createProvider } from '../providers';
import type { LLMProvider } from '../providers';
import { getBuiltinTools } from '../tools/builtin';

// ── ANSI helpers ────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,
  inverse: `${CSI}7m`,
  // foreground
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  gray: `${CSI}90m`,
  // background
  bgBlack: `${CSI}40m`,
  bgRed: `${CSI}41m`,
  bgGreen: `${CSI}42m`,
  bgYellow: `${CSI}43m`,
  bgBlue: `${CSI}44m`,
  bgWhite: `${CSI}47m`,
  bgGray: `${CSI}100m`,
  // cursor / screen
  clearScreen: `${CSI}2J`,
  clearLine: `${CSI}2K`,
  cursorHome: `${CSI}H`,
  cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  cursorUp: (n: number) => `${CSI}${n}A`,
  cursorDown: (n: number) => `${CSI}${n}B`,
  cursorSave: `${ESC}7`,
  cursorRestore: `${ESC}8`,
  scrollRegion: (top: number, bottom: number) => `${CSI}${top};${bottom}r`,
  hideCursor: `${CSI}?25l`,
  showCursor: `${CSI}?25h`,
};

function c(style: string, text: string): string {
  return `${style}${text}${ansi.reset}`;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ── Markdown → ANSI renderer ────────────────────────────────

function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  for (const line of lines) {
    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        const label = codeLang ? ` ${codeLang} ` : '';
        out.push(`${ansi.bgGray}${ansi.white}${label}${'─'.repeat(Math.max(0, 50 - label.length))}${ansi.reset}`);
      } else {
        inCodeBlock = false;
        out.push(`${ansi.bgGray}${'─'.repeat(50)}${ansi.reset}`);
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(`${ansi.bgGray}${ansi.white}  ${line}${ansi.reset}`);
      continue;
    }

    let rendered = line;

    // Headers
    const hMatch = rendered.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      out.push(c(ansi.bold + ansi.cyan, hMatch[2]));
      continue;
    }

    // Bullet lists
    if (/^\s*[-*]\s/.test(rendered)) {
      const indent = rendered.match(/^(\s*)/)?.[1] || '';
      rendered = rendered.replace(/^(\s*)[-*]\s/, '');
      rendered = renderInline(rendered);
      out.push(`${indent}  ${ansi.cyan}•${ansi.reset} ${rendered}`);
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(rendered)) {
      const match = rendered.match(/^(\s*)(\d+)\.\s(.*)/);
      if (match) {
        out.push(`${match[1]}  ${ansi.cyan}${match[2]}.${ansi.reset} ${renderInline(match[3])}`);
        continue;
      }
    }

    out.push(renderInline(rendered));
  }

  return out.join('\n');
}

function renderInline(text: string): string {
  // Bold **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, `${ansi.bold}$1${ansi.reset}`);
  text = text.replace(/__(.+?)__/g, `${ansi.bold}$1${ansi.reset}`);
  // Italic *text* or _text_
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `${ansi.italic}$1${ansi.reset}`);
  // Inline code `text`
  text = text.replace(/`([^`]+)`/g, `${ansi.bgGray}${ansi.white} $1 ${ansi.reset}`);
  return text;
}

// ── Config loading ──────────────────────────────────────────

interface ChatConfig {
  agentName: string;
  agentVersion: string;
  providerName: string;
  model: string;
  systemPrompt: string;
  skillNames: string[];
}

function loadChatConfig(oadFile: string = 'oad.yaml'): ChatConfig {
  let agentName = 'Agent';
  let agentVersion = '1.0.0';
  let providerName = 'auto';
  let model = 'auto';
  let systemPrompt = 'You are a helpful AI agent.';
  let skillNames: string[] = [];

  // Load SOUL.md + CONTEXT.md
  const soulPath = path.resolve('SOUL.md');
  const contextPath = path.resolve('CONTEXT.md');
  const soul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf-8') : '';
  const context = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf-8') : '';

  try {
    const raw = fs.readFileSync(oadFile, 'utf-8');
    const config = yaml.load(raw) as any;
    if (config?.spec?.systemPrompt) systemPrompt = config.spec.systemPrompt;
    if (config?.spec?.model) model = config.spec.model;
    if (config?.metadata?.name) agentName = config.metadata.name;
    if (config?.metadata?.version) agentVersion = config.metadata.version;
    if (config?.spec?.provider?.default) providerName = config.spec.provider.default;
    if (config?.spec?.skills) skillNames = config.spec.skills.map((s: any) => s.name);
  } catch { /* no config */ }

  systemPrompt = [soul, context, systemPrompt].filter(Boolean).join('\n\n');

  return { agentName, agentVersion, providerName, model, systemPrompt, skillNames };
}

// ── TUI State ───────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// ── Slash commands ──────────────────────────────────────────

const COMMANDS = ['/help', '/clear', '/model', '/tools', '/skills', '/history', '/status', '/quit'];

// ── Main TUI ────────────────────────────────────────────────

export interface RunChatOptions {
  file?: string;
}

export async function runChat(options?: RunChatOptions): Promise<void> {
  const oadFile = options?.file || 'oad.yaml';
  const config = loadChatConfig(oadFile);
  const startTime = Date.now();

  // Create provider
  let provider: LLMProvider;
  try {
    provider = createProvider(config.providerName, config.model);
  } catch (err: any) {
    console.error(`${ansi.red}✘ Failed to create provider: ${err.message}${ansi.reset}`);
    process.exit(1);
  }

  // Pipe mode: read stdin once, get one response, print it, exit
  if (!process.stdin.isTTY) {
    const input = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
    });
    const text = input.trim();
    if (!text) process.exit(0);

    const pipeMessages = [{ id: 'msg_1', role: 'user' as const, content: text, timestamp: Date.now() }];
    try {
      // Build tool map for function calling
      const builtinTools = getBuiltinTools();
      const toolDefs = builtinTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
      const toolMap = new Map(builtinTools.map(t => [t.name, t]));

      // Proactively inject current datetime so small models that can't do tool calling still know the time
      let enrichedSystemPrompt = config.systemPrompt;
      const dtTool = toolMap.get('datetime');
      if (dtTool) {
        try {
          const dtResult = await dtTool.execute({ format: 'locale' });
          const dt = JSON.parse(dtResult.content) as { iso: string; formatted: string; timezone: string };
          enrichedSystemPrompt = (enrichedSystemPrompt ? enrichedSystemPrompt + '\n\n' : '') +
            `[Context] Current date/time: ${dt.formatted} (${dt.timezone})`;
        } catch { /* skip */ }
      }

      // First call: send user message with available tools
      const response = await provider.chat(pipeMessages, enrichedSystemPrompt, { tools: toolDefs });

      // Check if LLM wants to call a tool
      const toolCallMatch = response.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
      if (toolCallMatch) {
        try {
          const toolCall = JSON.parse(toolCallMatch[1].trim()) as { name: string; arguments?: Record<string, unknown> };
          const tool = toolMap.get(toolCall.name);
          if (tool) {
            const toolResult = await tool.execute(toolCall.arguments || {});
            // Second call: feed tool result back and get final answer
            const followUp = [
              ...pipeMessages,
              { id: 'msg_2', role: 'assistant' as const, content: response, timestamp: Date.now() },
              {
                id: 'msg_3',
                role: 'user' as const,
                content: `Tool "${toolCall.name}" returned: ${toolResult.content}. Please answer my original question based on this information.`,
                timestamp: Date.now(),
              },
            ];
            const finalResponse = await provider.chat(followUp, enrichedSystemPrompt);
            process.stdout.write(finalResponse + '\n');
            process.exit(0);
            return;
          }
        } catch {
          // Malformed tool call — fall through to print raw response
        }
      }

      process.stdout.write(response + '\n');
    } catch (err: any) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
    process.exit(0);
    return;
  }

  const messages: ChatMessage[] = [];
  const inputHistory: string[] = [];
  let inputHistoryIdx = -1;
  let currentInput = '';
  let isStreaming = false;
  let abortStream = false;
  const recentTools: string[] = [];
  const cols = () => process.stdout.columns || 80;
  const rows = () => process.stdout.rows || 24;

  // ── Render status bar ───────────────────────────────────

  function renderStatusBar(): void {
    const w = cols();
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const uptimeStr = h > 0 ? `${h}h${m}m` : `${m}m${s}s`;

    const left = ` 🤖 ${config.agentName} `;
    const mid = ` ${config.providerName}/${config.model} `;
    const right = ` ⏱${uptimeStr} | 🔧${config.skillNames.length} skills `;

    const padding = Math.max(0, w - stripAnsi(left).length - stripAnsi(mid).length - stripAnsi(right).length);
    const bar = left + mid + ' '.repeat(padding) + right;

    process.stdout.write(ansi.cursorSave);
    process.stdout.write(ansi.cursorTo(1, 1));
    process.stdout.write(`${ansi.bgBlue}${ansi.white}${ansi.bold}${bar.padEnd(w)}${ansi.reset}`);
    process.stdout.write(ansi.cursorRestore);
  }

  // ── Render input bar ────────────────────────────────────

  function renderInputBar(text: string): void {
    const w = cols();
    const r = rows();
    process.stdout.write(ansi.cursorSave);
    // Separator line
    process.stdout.write(ansi.cursorTo(r - 1, 1));
    process.stdout.write(`${ansi.gray}${'─'.repeat(w)}${ansi.reset}`);
    // Input line
    process.stdout.write(ansi.cursorTo(r, 1));
    process.stdout.write(ansi.clearLine);
    const prompt = `${ansi.cyan}${ansi.bold}❯ ${ansi.reset}`;
    const maxLen = w - 4;
    const displayText = text.length > maxLen ? '…' + text.slice(-(maxLen - 1)) : text;
    process.stdout.write(`${prompt}${displayText}`);
    process.stdout.write(ansi.cursorRestore);
  }

  // ── Print message in chat area ──────────────────────────

  let chatLine = 3; // start below status bar

  function printToChat(text: string): void {
    const r = rows();
    const maxChatLine = r - 2; // leave 2 lines for input area

    const lines = text.split('\n');
    for (const line of lines) {
      if (chatLine >= maxChatLine) {
        // Scroll: move everything up
        process.stdout.write(ansi.cursorTo(3, 1));
        process.stdout.write(`${CSI}1S`); // scroll up 1 line in region
        chatLine = maxChatLine - 1;
      }
      process.stdout.write(ansi.cursorTo(chatLine, 1));
      process.stdout.write(ansi.clearLine);
      process.stdout.write(line);
      chatLine++;
    }
  }

  function printSystemMsg(text: string): void {
    printToChat(`${ansi.gray}  ${text}${ansi.reset}`);
  }

  function printUserMsg(text: string): void {
    printToChat(`${ansi.cyan}${ansi.bold}  You: ${ansi.reset}${text}`);
    printToChat('');
  }

  function printAssistantPrefix(): void {
    printToChat(`${ansi.green}${ansi.bold}  ${config.agentName}: ${ansi.reset}`);
  }

  // ── Clear and redraw ───────────────────────────────────

  function fullRedraw(): void {
    const r = rows();
    process.stdout.write(ansi.clearScreen + ansi.cursorHome);
    // Set scroll region (between status bar and input)
    process.stdout.write(ansi.scrollRegion(3, r - 2));
    chatLine = 3;
    renderStatusBar();

    // Re-render recent messages (last N that fit)
    const maxLines = r - 5;
    let lineCount = 0;
    const toShow: ChatMessage[] = [];
    for (let i = messages.length - 1; i >= 0 && lineCount < maxLines; i--) {
      const msg = messages[i];
      const rendered = msg.role === 'user' ? msg.content : renderMarkdown(msg.content);
      const lines = rendered.split('\n').length + 2;
      lineCount += lines;
      toShow.unshift(msg);
    }
    for (const msg of toShow) {
      if (msg.role === 'user') {
        printUserMsg(msg.content);
      } else if (msg.role === 'assistant') {
        printToChat(`${ansi.green}${ansi.bold}  ${config.agentName}: ${ansi.reset}`);
        const rendered = renderMarkdown(msg.content);
        for (const line of rendered.split('\n')) {
          printToChat(`    ${line}`);
        }
        printToChat('');
      } else {
        printSystemMsg(msg.content);
      }
    }

    renderInputBar(currentInput);
  }

  // ── Handle slash commands ──────────────────────────────

  function handleCommand(cmd: string): boolean {
    const lower = cmd.toLowerCase().trim();
    const parts = lower.split(/\s+/);

    switch (parts[0]) {
      case '/help':
        printToChat('');
        printSystemMsg('╭─── Commands ───────────────────────╮');
        printSystemMsg('│ /help     Show this help            │');
        printSystemMsg('│ /clear    Clear screen & history    │');
        printSystemMsg('│ /model    Show/switch model         │');
        printSystemMsg('│ /tools    List available tools      │');
        printSystemMsg('│ /skills   List skills               │');
        printSystemMsg('│ /history  Export chat history        │');
        printSystemMsg('│ /status   Show agent status         │');
        printSystemMsg('│ /quit     Exit                      │');
        printSystemMsg('╰────────────────────────────────────╯');
        printSystemMsg('Shortcuts: Ctrl+C abort | Ctrl+L clear | ↑↓ history');
        printToChat('');
        return true;

      case '/clear':
        messages.length = 0;
        fullRedraw();
        printSystemMsg('Chat cleared.');
        printToChat('');
        return true;

      case '/model':
        printSystemMsg(`Current model: ${config.providerName}/${config.model}`);
        printToChat('');
        return true;

      case '/tools':
        printSystemMsg('Tools: (managed by agent runtime)');
        if (recentTools.length > 0) {
          printSystemMsg(`Recent: ${recentTools.join(', ')}`);
        }
        printToChat('');
        return true;

      case '/skills':
        if (config.skillNames.length === 0) {
          printSystemMsg('No skills registered.');
        } else {
          printSystemMsg(`Skills (${config.skillNames.length}):`);
          for (const s of config.skillNames) {
            printSystemMsg(`  • ${s}`);
          }
        }
        printToChat('');
        return true;

      case '/history': {
        const histFile = path.resolve(`chat-history-${Date.now()}.md`);
        const content = messages.map(m => {
          const prefix = m.role === 'user' ? '**You**' : m.role === 'assistant' ? `**${config.agentName}**` : '*System*';
          return `${prefix}: ${m.content}`;
        }).join('\n\n');
        fs.writeFileSync(histFile, content);
        printSystemMsg(`History exported to ${histFile}`);
        printToChat('');
        return true;
      }

      case '/status': {
        const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
        const msgCount = messages.length;
        const userMsgs = messages.filter(m => m.role === 'user').length;
        printSystemMsg(`Agent: ${config.agentName} v${config.agentVersion}`);
        printSystemMsg(`Model: ${config.providerName}/${config.model}`);
        printSystemMsg(`Uptime: ${uptimeSec}s | Messages: ${msgCount} (${userMsgs} from you)`);
        printSystemMsg(`Skills: ${config.skillNames.length}`);
        printToChat('');
        return true;
      }

      case '/quit':
      case '/exit':
      case '/q':
        cleanup();
        process.stdout.write(ansi.clearScreen + ansi.cursorHome + ansi.showCursor);
        // Reset scroll region
        process.stdout.write(`${CSI}r`);
        console.log(`${ansi.dim}👋 Goodbye!${ansi.reset}`);
        process.exit(0);
        return true;

      default:
        printSystemMsg(`Unknown command: ${parts[0]}. Type /help for commands.`);
        printToChat('');
        return true;
    }
  }

  // ── Stream AI response ─────────────────────────────────

  async function sendMessage(text: string): Promise<void> {
    messages.push({ role: 'user', content: text, timestamp: Date.now() });
    printUserMsg(text);

    // Build message array for provider
    const history = messages.map(m => ({
      id: `msg_${m.timestamp}`,
      role: m.role as any,
      content: m.content,
      timestamp: m.timestamp,
    }));

    printAssistantPrefix();

    isStreaming = true;
    abortStream = false;
    let fullResponse = '';

    try {
      let lineBuffer = '';
      for await (const chunk of provider.chatStream(history, config.systemPrompt)) {
        if (abortStream) {
          fullResponse += '\n[interrupted]';
          break;
        }

        fullResponse += chunk;
        lineBuffer += chunk;

        // Flush complete lines for markdown rendering
        const nlIdx = lineBuffer.lastIndexOf('\n');
        if (nlIdx >= 0) {
          const complete = lineBuffer.slice(0, nlIdx);
          lineBuffer = lineBuffer.slice(nlIdx + 1);
          const rendered = renderMarkdown(complete);
          for (const line of rendered.split('\n')) {
            printToChat(`    ${line}`);
          }
        }
      }

      // Flush remaining
      if (lineBuffer.length > 0) {
        const rendered = renderMarkdown(lineBuffer);
        for (const line of rendered.split('\n')) {
          printToChat(`    ${line}`);
        }
      }
    } catch (err: any) {
      printToChat(`    ${ansi.red}Error: ${err.message}${ansi.reset}`);
      fullResponse = `[Error: ${err.message}]`;
    }

    isStreaming = false;
    printToChat('');
    messages.push({ role: 'assistant', content: fullResponse, timestamp: Date.now() });

    // Trim history
    if (messages.length > 60) {
      messages.splice(0, messages.length - 60);
    }

    // Update status bar (uptime changed)
    renderStatusBar();
  }

  // ── Tab completion ─────────────────────────────────────

  function tabComplete(text: string): string {
    if (!text.startsWith('/')) return text;
    const matches = COMMANDS.filter(c => c.startsWith(text));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      printSystemMsg(`Completions: ${matches.join('  ')}`);
    }
    return text;
  }

  // ── Cleanup ────────────────────────────────────────────

  function cleanup(): void {
    process.stdin.setRawMode?.(false);
    process.stdout.write(ansi.showCursor);
    process.stdout.write(`${CSI}r`); // reset scroll region
  }

  // ── Setup raw mode input ──────────────────────────────

  process.stdout.write(ansi.hideCursor);
  fullRedraw();

  printSystemMsg(`💬 Chat with ${config.agentName} — type /help for commands`);
  printToChat('');
  renderInputBar('');

  // Use readline for input handling — simpler and more compatible
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    prompt: '',
    completer: (line: string): [string[], string] => {
      if (line.startsWith('/')) {
        const matches = COMMANDS.filter(c => c.startsWith(line));
        return [matches, line];
      }
      return [[], line];
    },
  });

  // Override output to avoid readline messing with our TUI
  // We'll use a simpler approach: standard readline but render our TUI around it

  // Reset to simpler mode — full raw TUI is complex with readline
  // Instead, use a hybrid: ANSI decorations + readline for input
  process.stdout.write(ansi.showCursor);
  process.stdout.write(`${CSI}r`); // reset scroll region

  // Simpler but polished approach
  process.stdout.write(ansi.clearScreen + ansi.cursorHome);

  // Print banner
  const w = cols();
  const bannerBg = `${ansi.bgBlue}${ansi.white}${ansi.bold}`;
  const uptimeStr = '0m0s';
  const bannerLeft = ` 🤖 ${config.agentName} v${config.agentVersion}`;
  const bannerMid = ` │ ${config.providerName}/${config.model}`;
  const bannerRight = `⏱${uptimeStr} │ 🔧${config.skillNames.length} skills `;
  const bannerPad = Math.max(0, w - bannerLeft.length - bannerMid.length - bannerRight.length);
  process.stdout.write(`${bannerBg}${bannerLeft}${bannerMid}${' '.repeat(bannerPad)}${bannerRight}${ansi.reset}\n`);
  process.stdout.write(`${ansi.gray}${'─'.repeat(w)}${ansi.reset}\n`);

  // Welcome
  const soulLoaded = fs.existsSync(path.resolve('SOUL.md'));
  const ctxLoaded = fs.existsSync(path.resolve('CONTEXT.md'));
  if (soulLoaded) process.stdout.write(`${ansi.gray}  ✦ SOUL.md loaded${ansi.reset}\n`);
  if (ctxLoaded) process.stdout.write(`${ansi.gray}  ✦ CONTEXT.md loaded${ansi.reset}\n`);
  process.stdout.write(`${ansi.gray}  Type /help for commands, /quit to exit${ansi.reset}\n`);
  process.stdout.write(`${ansi.gray}${'─'.repeat(w)}${ansi.reset}\n\n`);

  // Now use readline for interactive input
  const prompt = `${ansi.cyan}${ansi.bold}❯ ${ansi.reset}`;
  rl.setPrompt(prompt);
  rl.prompt();

  rl.on('line', async (input: string) => {
    const text = input.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    // Save to input history
    inputHistory.push(text);

    // Handle slash commands
    if (text.startsWith('/')) {
      if (text.toLowerCase() === '/quit' || text.toLowerCase() === '/exit' || text.toLowerCase() === '/q') {
        process.stdout.write(`\n${ansi.dim}👋 Goodbye!${ansi.reset}\n`);
        rl.close();
        process.exit(0);
      }

      if (text.toLowerCase() === '/help') {
        console.log('');
        console.log(`${ansi.gray}  ╭─── Commands ─────────────────────────╮${ansi.reset}`);
        console.log(`${ansi.gray}  │ /help     Show this help              │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /clear    Clear screen                │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /model    Show current model          │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /tools    List available tools        │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /skills   List skills                 │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /history  Export chat history          │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /status   Show agent status           │${ansi.reset}`);
        console.log(`${ansi.gray}  │ /quit     Exit (/q, /exit)            │${ansi.reset}`);
        console.log(`${ansi.gray}  ╰────────────────────────────────────────╯${ansi.reset}`);
        console.log(`${ansi.gray}  Shortcuts: Ctrl+C interrupt | Ctrl+L clear | ↑↓ history${ansi.reset}`);
        console.log('');
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/clear') {
        messages.length = 0;
        process.stdout.write(ansi.clearScreen + ansi.cursorHome);
        const w2 = cols();
        process.stdout.write(`${bannerBg} 🤖 ${config.agentName} v${config.agentVersion} │ ${config.providerName}/${config.model}${' '.repeat(Math.max(0, w2 - 60))}${ansi.reset}\n`);
        process.stdout.write(`${ansi.gray}${'─'.repeat(w2)}${ansi.reset}\n`);
        console.log(`${ansi.gray}  ✦ Chat cleared${ansi.reset}\n`);
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/model') {
        console.log(`\n${ansi.gray}  Model: ${ansi.cyan}${config.providerName}/${config.model}${ansi.reset}\n`);
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/tools') {
        console.log(`\n${ansi.gray}  Tools are managed by agent runtime.${ansi.reset}`);
        if (recentTools.length > 0) {
          console.log(`${ansi.gray}  Recent: ${recentTools.join(', ')}${ansi.reset}`);
        }
        console.log('');
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/skills') {
        if (config.skillNames.length === 0) {
          console.log(`\n${ansi.gray}  No skills registered.${ansi.reset}\n`);
        } else {
          console.log(`\n${ansi.bold}  Skills (${config.skillNames.length}):${ansi.reset}`);
          for (const s of config.skillNames) {
            console.log(`${ansi.gray}    • ${ansi.cyan}${s}${ansi.reset}`);
          }
          console.log('');
        }
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/history') {
        const histFile = path.resolve(`chat-history-${Date.now()}.md`);
        const content = messages.map(m => {
          const prefix = m.role === 'user' ? '**You**' : m.role === 'assistant' ? `**${config.agentName}**` : '*System*';
          return `${prefix}: ${m.content}`;
        }).join('\n\n');
        fs.writeFileSync(histFile, content);
        console.log(`\n${ansi.gray}  ✦ History exported to ${histFile}${ansi.reset}\n`);
        rl.prompt();
        return;
      }

      if (text.toLowerCase() === '/status') {
        const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(uptimeSec / 3600);
        const m = Math.floor((uptimeSec % 3600) / 60);
        const s = uptimeSec % 60;
        const upStr = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
        const userMsgs = messages.filter(m => m.role === 'user').length;
        console.log('');
        console.log(`${ansi.gray}  ╭─── Agent Status ─────────────────────╮${ansi.reset}`);
        console.log(`${ansi.gray}  │ Agent:    ${ansi.cyan}${config.agentName} v${config.agentVersion}${ansi.reset}${ansi.gray}${' '.repeat(Math.max(0, 28 - config.agentName.length - config.agentVersion.length))}│${ansi.reset}`);
        console.log(`${ansi.gray}  │ Model:    ${ansi.cyan}${config.providerName}/${config.model}${ansi.reset}${ansi.gray}${' '.repeat(Math.max(0, 28 - config.providerName.length - config.model.length))}│${ansi.reset}`);
        console.log(`${ansi.gray}  │ Uptime:   ${upStr}${' '.repeat(Math.max(0, 28 - upStr.length))}│${ansi.reset}`);
        console.log(`${ansi.gray}  │ Messages: ${userMsgs} sent, ${messages.length} total${' '.repeat(Math.max(0, 14 - String(userMsgs).length - String(messages.length).length))}│${ansi.reset}`);
        console.log(`${ansi.gray}  │ Skills:   ${config.skillNames.length}${' '.repeat(Math.max(0, 27 - String(config.skillNames.length).length))}│${ansi.reset}`);
        console.log(`${ansi.gray}  ╰────────────────────────────────────────╯${ansi.reset}`);
        console.log('');
        rl.prompt();
        return;
      }

      console.log(`\n${ansi.gray}  Unknown command: ${text}. Type /help${ansi.reset}\n`);
      rl.prompt();
      return;
    }

    // Regular message
    messages.push({ role: 'user', content: text, timestamp: Date.now() });
    console.log('');

    // Build message array for provider
    const history = messages.map(m => ({
      id: `msg_${m.timestamp}`,
      role: m.role as any,
      content: m.content,
      timestamp: m.timestamp,
    }));

    process.stdout.write(`${ansi.green}${ansi.bold}  ${config.agentName}: ${ansi.reset}`);

    isStreaming = true;
    abortStream = false;
    let fullResponse = '';

    // Handle Ctrl+C during streaming
    const sigintHandler = () => {
      if (isStreaming) {
        abortStream = true;
      }
    };
    process.on('SIGINT', sigintHandler);

    try {
      let lineBuffer = '';
      let firstChunk = true;

      for await (const chunk of provider.chatStream(history, config.systemPrompt)) {
        if (abortStream) {
          process.stdout.write(`\n${ansi.yellow}  [interrupted]${ansi.reset}`);
          fullResponse += '\n[interrupted]';
          break;
        }

        fullResponse += chunk;

        // Stream output with markdown rendering for complete lines
        lineBuffer += chunk;
        const nlIdx = lineBuffer.lastIndexOf('\n');
        if (nlIdx >= 0) {
          const complete = lineBuffer.slice(0, nlIdx);
          lineBuffer = lineBuffer.slice(nlIdx + 1);

          if (firstChunk) {
            // First line continues after prefix
            const lines = complete.split('\n');
            const renderedFirst = renderMarkdown(lines[0]);
            process.stdout.write(renderedFirst);
            for (let i = 1; i < lines.length; i++) {
              const rendered = renderMarkdown(lines[i]);
              process.stdout.write(`\n    ${rendered}`);
            }
            process.stdout.write('\n');
            firstChunk = false;
          } else {
            const rendered = renderMarkdown(complete);
            for (const line of rendered.split('\n')) {
              process.stdout.write(`    ${line}\n`);
            }
          }
        }
      }

      // Flush remaining
      if (lineBuffer.length > 0) {
        const rendered = renderMarkdown(lineBuffer);
        if (firstChunk) {
          process.stdout.write(rendered);
        } else {
          for (const line of rendered.split('\n')) {
            process.stdout.write(`    ${line}\n`);
          }
        }
      }
    } catch (err: any) {
      process.stdout.write(`\n${ansi.red}  Error: ${err.message}${ansi.reset}`);
      fullResponse = `[Error: ${err.message}]`;
    }

    process.removeListener('SIGINT', sigintHandler);
    isStreaming = false;

    console.log('\n');
    messages.push({ role: 'assistant', content: fullResponse, timestamp: Date.now() });

    // Trim history
    if (messages.length > 60) {
      messages.splice(0, messages.length - 60);
    }

    rl.prompt();
  });

  // Ctrl+L to clear
  rl.on('SIGCONT', () => {
    // not standard, handled below
  });

  // Handle Ctrl+C when not streaming
  rl.on('SIGINT', () => {
    if (isStreaming) {
      abortStream = true;
    } else {
      console.log(`\n${ansi.dim}  (Ctrl+C again or /quit to exit)${ansi.reset}\n`);
      rl.prompt();
    }
  });

  rl.on('close', () => {
    process.stdout.write(`\n${ansi.dim}👋 Goodbye!${ansi.reset}\n`);
    process.exit(0);
  });

  // Ctrl+L clear screen
  if (process.stdin.isTTY) {
    process.stdin.on('keypress', (_ch: string, key: any) => {
      if (key && key.ctrl && key.name === 'l') {
        process.stdout.write(ansi.clearScreen + ansi.cursorHome);
        const w2 = cols();
        process.stdout.write(`${bannerBg} 🤖 ${config.agentName} v${config.agentVersion} │ ${config.providerName}/${config.model}${' '.repeat(Math.max(0, w2 - 60))}${ansi.reset}\n`);
        process.stdout.write(`${ansi.gray}${'─'.repeat(w2)}${ansi.reset}\n\n`);
        rl.prompt();
      }
    });
  }
}
