import { readFileSync, writeFileSync } from 'fs';

const file = 'C:\\Users\\mingjwan\\tmp-opc-clone\\src\\studio-ui\\index.html';
let html = readFileSync(file, 'utf-8');

// 1. Add CSS classes before the closing </style>
const newCSS = `
    /* Sidebar restructure */
    .sidebar-section-title { font-size: 11px; letter-spacing: 1px; color: var(--text-dim); margin: 20px 12px 8px; text-transform: uppercase; font-weight: 600; }
    .sidebar-divider { height: 1px; background: var(--border); margin: 8px 12px; }
    .agent-list-container { overflow-y: auto; flex: 1; min-height: 0; }
    .agent-list-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 12px;
      cursor: pointer; color: var(--text-muted); transition: all 0.2s ease; font-size: 14px; margin-bottom: 2px; position: relative;
    }
    .agent-list-item:hover { background: var(--bg-hover); color: var(--text); transform: translateX(4px); }
    .agent-list-item.active { background: var(--accent-light); color: #fff; font-weight: 600; box-shadow: var(--glow-sm); border: 1px solid var(--border); }
    .agent-list-item .agent-icon { width: 24px; text-align: center; font-size: 16px; }
    .agent-list-item .agent-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .agent-list-item .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .agent-list-item .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .agent-list-item .status-dot.offline { background: var(--text-dim); }
    .agent-list-item .status-dot.error { background: var(--red); box-shadow: 0 0 6px var(--red); }
    .sidebar-bottom { margin-top: auto; flex-shrink: 0; }
    .sidebar-nav { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
`;

html = html.replace('  </style>', newCSS + '  </style>');

// 2. Replace sidebar nav content
const oldSidebar = `      <div class="sidebar-nav">
        <div class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
          <span class="icon">🏠</span> Dashboard
        </div>
        <div class="nav-item" data-page="chat" onclick="openLastChat()">
          <span class="icon">💬</span> Chat
        </div>
        <div class="nav-item" data-page="templates" onclick="navigate('templates')">
          <span class="icon">👤</span> Templates
        </div>
        <div class="nav-item" data-page="skills" onclick="navigate('skills')">
          <span class="icon">🧩</span> Skills Market
        </div>
        <div class="nav-item" data-page="create" onclick="navigate('create')">
          <span class="icon">✨</span> Create Agent
        </div>
        <div class="nav-item" data-page="settings" onclick="currentSettingsTab='models';navigate('settings')">
          <span class="icon">🤖</span> Models
        </div>
        <div class="nav-item" data-page="settings" onclick="currentSettingsTab='channels';navigate('settings')">
          <span class="icon">📡</span> Channels
        </div>
        <div class="nav-item" data-page="settings" onclick="currentSettingsTab='memory';navigate('settings')">
          <span class="icon">🧠</span> Memory
        </div>
        <div class="nav-item" data-page="settings" onclick="navigate('settings')">
          <span class="icon">⚙️</span> Settings
        </div>
        <div class="nav-item" data-page="schedules" onclick="navigate('schedules')">
          <span class="icon">⏰</span> Schedules
        </div>
      </div>`;

const newSidebar = `      <div class="sidebar-nav">
        <!-- Section 1: My Agents -->
        <div class="sidebar-section-title">🤖 我的 Agent</div>
        <div class="agent-list-container" id="sidebar-agent-list">
          <div style="padding: 12px 16px; color: var(--text-dim); font-size: 13px;">加载中...</div>
        </div>

        <!-- Section 2: Create -->
        <div class="sidebar-divider"></div>
        <div class="nav-item" data-page="create" onclick="navigate('create')">
          <span class="icon">➕</span> 新建 Agent
        </div>

        <!-- Section 3: Global Config -->
        <div class="sidebar-bottom">
          <div class="sidebar-divider"></div>
          <div class="sidebar-section-title">⚙️ 全局配置</div>
          <div class="nav-item" data-page="global-runtime" onclick="navigate('global-runtime')">
            <span class="icon">🚀</span> Runtime
          </div>
          <div class="nav-item" data-page="global-models" onclick="navigate('global-models')">
            <span class="icon">🧠</span> Models
          </div>
          <div class="nav-item" data-page="global-memory" onclick="navigate('global-memory')">
            <span class="icon">💾</span> Memory
          </div>
          <div class="nav-item" data-page="global-templates" onclick="navigate('global-templates')">
            <span class="icon">📋</span> Templates
          </div>
        </div>
      </div>`;

html = html.replace(oldSidebar, newSidebar);

// 3. Add JavaScript - extend navigate() and add loadSidebarAgents()
// Insert global-* navigation handling into navigate function
const oldNavigate = `      if (page === 'settings') { showSettings(currentSettingsTab || 'models'); }`;
const newNavigate = `      if (page === 'settings') { showSettings(currentSettingsTab || 'models'); }
      if (page === 'global-runtime') { currentSettingsTab='status'; showSettings('status'); showPage('settings'); return; }
      if (page === 'global-models') { currentSettingsTab='models'; showSettings('models'); showPage('settings'); return; }
      if (page === 'global-memory') { currentSettingsTab='memory'; showSettings('memory'); showPage('settings'); return; }
      if (page === 'global-templates') { navigate('templates'); return; }`;

html = html.replace(oldNavigate, newNavigate);

// Add loadSidebarAgents function and navigateToAgent before the navigate function
const navFuncMarker = `    // === Navigation ===`;
const sidebarJS = `    // === Sidebar Agents ===
    let selectedAgentId = null;

    async function loadSidebarAgents() {
      try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        const agents = data.agents || data || [];
        const container = document.getElementById('sidebar-agent-list');
        if (!agents.length) {
          container.innerHTML = '<div style="padding: 12px 16px; color: var(--text-dim); font-size: 13px;">暂无 Agent</div>';
          return;
        }
        container.innerHTML = agents.map(a => {
          const status = (a.status || 'offline').toLowerCase();
          const icon = a.emoji || a.icon || '🤖';
          const name = a.name || a.id;
          return \`<div class="agent-list-item\${selectedAgentId === a.id ? ' active' : ''}" data-agent-id="\${a.id}" onclick="navigateToAgent('\${a.id}')">
            <span class="agent-icon">\${icon}</span>
            <span class="agent-name">\${name}</span>
            <span class="status-dot \${status}"></span>
          </div>\`;
        }).join('');
      } catch(e) {
        console.error('Failed to load sidebar agents:', e);
        const container = document.getElementById('sidebar-agent-list');
        if (container) container.innerHTML = '<div style="padding: 12px 16px; color: var(--text-dim); font-size: 13px;">加载失败</div>';
      }
    }

    function navigateToAgent(agentId) {
      selectedAgentId = agentId;
      // Update sidebar active state
      document.querySelectorAll('.agent-list-item').forEach(el => el.classList.remove('active'));
      const item = document.querySelector(\`.agent-list-item[data-agent-id="\${agentId}"]\`);
      if (item) item.classList.add('active');
      // For now, navigate to dashboard with agent context
      navigate('dashboard');
    }

    ${navFuncMarker}`;

html = html.replace(navFuncMarker, sidebarJS);

// Also update nav-item active highlighting to support global-* pages
const oldNavActive = `      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const navItem = document.querySelector(\`.nav-item[data-page="\${page}"]\`);
      if (navItem) navItem.classList.add('active');`;

const newNavActive = `      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.agent-list-item').forEach(n => n.classList.remove('active'));
      const navItem = document.querySelector(\`.nav-item[data-page="\${page}"]\`);
      if (navItem) navItem.classList.add('active');`;

html = html.replace(oldNavActive, newNavActive);

// Add loadSidebarAgents() call on page load - find DOMContentLoaded or init
// Look for where loadAgents is first called
const initMarker = `if (page === 'dashboard') { loadAgents(); loadHealthDashboard(); }`;
// We'll add the sidebar load call at the end of the navigate function's dashboard case isn't ideal.
// Let's find where the app initializes
const hashNav = `location.hash = \`/\${page}\`;`;

// Better: add it to the initial page load. Find where hash routing happens.
// Search for DOMContentLoaded or window.onload
const loadMatch = html.match(/(?:DOMContentLoaded|window\.onload|loadAgents\(\);\s*loadHealthDashboard)/);

// Just add it right after the navigate function definition area, in the init block
// Find "navigate('dashboard')" at the bottom (initial route)
const initRoute = html.indexOf("navigate('dashboard')");
// Let's just add a call in the dashboard load
html = html.replace(
  `if (page === 'dashboard') { loadAgents(); loadHealthDashboard(); }`,
  `if (page === 'dashboard') { loadAgents(); loadHealthDashboard(); loadSidebarAgents(); }`
);

writeFileSync(file, html, 'utf-8');
console.log('Done! Sidebar restructured.');
