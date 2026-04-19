
    // === State ===
    let templates = [];
    let industries = [];
    let agents = [];
    let selectedTemplate = null;
    let currentAgent = null;
    let chatMessages = [];
    let wizardStep = 1;
    let selectedIndustry = '';
    let deleteTargetId = null;

    const API = '';

    // === Init ===
    async function init() {
      await Promise.all([loadTemplates(), loadAgents()]);
      handleRoute();
      window.addEventListener('popstate', handleRoute);
      checkFirstRun();
    }

    function handleRoute() {
      const path = location.hash.slice(1) || '/dashboard';
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === 'chat' && parts[1]) {
        openChat(parts[1]);
      } else if (parts[0] === 'settings') {
        if (parts[1]) currentSettingsTab = parts[1];
        navigate('settings');
      } else if (parts[0] === 'memory' && parts[1]) {
        openMemoryPage(parts[1]);
      } else if (parts[0] === 'create') {
        if (parts[1]) {
          // pre-select template
          selectedTemplate = templates.find(t => t.id === parts[1]) || null;
          if (selectedTemplate) {
            wizardStep = 2;
          }
        }
        showPage('create');
        renderWizard();
      } else {
        navigate(parts[0] || 'dashboard');
      }
    }

    // === API ===
    async function loadTemplates() {
      try {
        const res = await fetch(`${API}/api/templates`);
        const data = await res.json();
        templates = data.templates || [];
        industries = data.industries || [];
        renderIndustryChips();
        renderTemplates();
      } catch(e) { console.error('Failed to load templates:', e); }
    }

    async function loadAgents() {
      try {
        const res = await fetch(`${API}/api/agents`);
        const data = await res.json();
        agents = data.agents || [];
        renderAgents();
      } catch(e) { console.error('Failed to load agents:', e); }
    }

    // === Navigation ===
    function navigate(page) {
      document.querySelectorAll('.page, .chat-container').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (navItem) navItem.classList.add('active');

      if (page === 'dashboard') { loadAgents(); loadHealthDashboard(); }
      if (page === 'create') { renderWizard(); renderWizardTemplates(); }
      if (page === 'settings') { showSettings(currentSettingsTab || 'models'); }
      if (page === 'schedules') { loadSchedules(); }
      if (page === 'skills') { loadSkillsMarketplace(); }

      showPage(page);
      location.hash = `/${page}`;
      toggleSidebar(false);
    }

    function showPage(page) {
      document.querySelectorAll('.page, .chat-container').forEach(p => { p.classList.remove('active'); });
      const el = document.getElementById(`page-${page}`);
      if (el) el.classList.add('active');
    }

    function toggleSidebar(open) {
      document.querySelector('.sidebar').classList.toggle('open', open);
      document.querySelector('.sidebar-overlay').classList.toggle('show', open);
    }

    // === Templates Rendering ===
    function renderIndustryChips() {
      const html = `<span class="chip active" onclick="filterByIndustry('')">All</span>` +
        industries.map(i => `<span class="chip" onclick="filterByIndustry('${i.id}')">${i.nameZh} ${i.name}</span>`).join('');
      document.getElementById('industry-chips').innerHTML = html;
      document.getElementById('wizard-industry-chips').innerHTML = html.replace(/filterByIndustry/g, 'filterWizardByIndustry');
    }

    function filterByIndustry(id) {
      selectedIndustry = id;
      document.querySelectorAll('#industry-chips .chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      renderTemplates();
    }

    function filterWizardByIndustry(id) {
      selectedIndustry = id;
      document.querySelectorAll('#wizard-industry-chips .chip').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      renderWizardTemplates();
    }

    function filterTemplates() {
      renderTemplates();
    }

    // === Skills Marketplace ===
    let allSkills = [];
    let selectedSkillCategory = '';
    const SKILL_CATEGORIES = [
      { id: '', label: 'All', labelZh: '全部' },
      { id: 'productivity', label: 'Productivity', labelZh: '效率' },
      { id: 'knowledge', label: 'Knowledge', labelZh: '知识' },
      { id: 'creative', label: 'Creative', labelZh: '创作' },
      { id: 'developer', label: 'Developer', labelZh: '开发' },
      { id: 'lifestyle', label: 'Lifestyle', labelZh: '生活' },
      { id: 'business', label: 'Business', labelZh: '业务' },
    ];

    async function loadSkillsMarketplace() {
      try {
        const res = await fetch('/api/skills/marketplace');
        allSkills = await res.json();
      } catch(e) { console.error('Failed to load skills:', e); allSkills = []; }
      renderSkillCategoryChips();
      renderSkills();
    }

    function renderSkillCategoryChips() {
      const el = document.getElementById('skill-category-chips');
      if (!el) return;
      el.innerHTML = SKILL_CATEGORIES.map(c =>
        `<span class="chip ${selectedSkillCategory === c.id ? 'active' : ''}" onclick="selectSkillCategory('${c.id}')">${c.labelZh}</span>`
      ).join('');
    }

    function selectSkillCategory(cat) {
      selectedSkillCategory = cat;
      renderSkillCategoryChips();
      renderSkills();
    }

    function filterSkills() {
      renderSkills();
    }

    function renderSkills() {
      const q = (document.getElementById('skills-search')?.value || '').toLowerCase();
      let filtered = allSkills;
      if (selectedSkillCategory) {
        filtered = filtered.filter(s => s.category === selectedSkillCategory);
      }
      if (q) {
        filtered = filtered.filter(s =>
          s.name.toLowerCase().includes(q) || s.nameZh.includes(q) ||
          s.description.toLowerCase().includes(q) || s.descriptionZh.includes(q)
        );
      }
      const grid = document.getElementById('skills-grid');
      if (!grid) return;
      grid.innerHTML = filtered.map(s => `
        <div class="card" style="cursor:default;position:relative;">
          <div style="font-size:36px;margin-bottom:8px;">${s.icon}</div>
          <div style="font-weight:600;font-size:15px;">${s.nameZh}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">${s.name}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;line-height:1.4;">${s.descriptionZh}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">
            ${s.tools.slice(0,3).map(t => `<span style="font-size:11px;padding:2px 6px;background:var(--bg-hover);border-radius:4px;color:var(--text-dim);">${t}</span>`).join('')}
            ${s.tools.length > 3 ? `<span style="font-size:11px;color:var(--text-dim);">+${s.tools.length-3}</span>` : ''}
          </div>
          ${s.installed
            ? `<button class="btn" style="width:100%;background:var(--bg-hover);color:var(--text-muted);cursor:pointer;" onclick="uninstallSkill('${s.id}',this)">✓ Installed</button>`
            : `<button class="btn btn-primary" style="width:100%;" onclick="installSkill('${s.id}',this)">Install</button>`
          }
        </div>
      `).join('');
    }

    async function installSkill(id, btn) {
      btn.disabled = true; btn.textContent = 'Installing...';
      try {
        const res = await fetch(\`/api/skills/marketplace/\${id}/install\`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          const skill = allSkills.find(s => s.id === id);
          if (skill) skill.installed = true;
          renderSkills();
        }
      } catch(e) { console.error(e); btn.disabled = false; btn.textContent = 'Install'; }
    }

    async function uninstallSkill(id, btn) {
      btn.disabled = true; btn.textContent = 'Removing...';
      try {
        const res = await fetch(\`/api/skills/marketplace/\${id}/uninstall\`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          const skill = allSkills.find(s => s.id === id);
          if (skill) skill.installed = false;
          renderSkills();
        }
      } catch(e) { console.error(e); btn.disabled = false; btn.textContent = '✓ Installed'; }
    }

    function filterWizardTemplates() {
      renderWizardTemplates();
    }

    function getFilteredTemplates(searchId) {
      const q = (document.getElementById(searchId)?.value || '').toLowerCase();
      return templates.filter(t => {
        if (selectedIndustry && t.industry !== selectedIndustry) return false;
        if (q && !t.name.toLowerCase().includes(q) && !t.nameZh.includes(q) && !t.description.toLowerCase().includes(q)) return false;
        return true;
      });
    }

    function renderTemplates() {
      const filtered = getFilteredTemplates('tpl-search');
      document.getElementById('templates-grid').innerHTML = filtered.map(t => `
        <div class="card tpl-card" onclick="selectTemplateAndCreate('${t.id}')">
          <div class="tpl-icon">${t.icon}</div>
          <div class="tpl-name">${t.name}</div>
          <div style="font-size:13px;color:var(--text-dim);margin-bottom:6px;">${t.nameZh}</div>
          <div class="tpl-desc">${t.description}</div>
          <div class="tpl-tags">
            <span class="tpl-tag">${t.industryZh}</span>
            ${t.tags.map(tag => `<span class="tpl-tag">${tag}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }

    function renderWizardTemplates() {
      const filtered = getFilteredTemplates('wizard-tpl-search');
      document.getElementById('wizard-tpl-grid').innerHTML = filtered.map(t => `
        <div class="card tpl-card ${selectedTemplate?.id === t.id ? 'selected' : ''}" onclick="selectWizardTemplate('${t.id}')"
             style="${selectedTemplate?.id === t.id ? 'border-color:var(--accent);background:var(--accent-light);' : ''}">
          <div class="tpl-icon">${t.icon}</div>
          <div class="tpl-name">${t.name}</div>
          <div style="font-size:12px;color:var(--text-dim);">${t.nameZh} · ${t.industryZh}</div>
        </div>
      `).join('');
    }

    function selectTemplateAndCreate(id) {
      selectedTemplate = templates.find(t => t.id === id);
      wizardStep = 2;
      navigate('create');
    }

    function selectWizardTemplate(id) {
      selectedTemplate = templates.find(t => t.id === id);
      renderWizardTemplates();
      // Auto-advance after selection
      setTimeout(() => wizardNext(), 300);
    }

    // === Wizard ===
    function renderWizard() {
      for (let i = 1; i <= 3; i++) {
        const ws = document.getElementById(`ws-${i}`);
        const wp = document.getElementById(`wp-${i}`);
        ws.className = 'wizard-step' + (i < wizardStep ? ' done' : i === wizardStep ? ' active' : '');
        wp.className = 'wizard-panel' + (i === wizardStep ? ' active' : '');
      }
      if (wizardStep === 2 && selectedTemplate) {
        document.getElementById('agent-name').placeholder = selectedTemplate.name;
        document.getElementById('agent-model').value = selectedTemplate.suggestedModel;
      }
      if (wizardStep === 3) {
        renderConfirmCard();
      }
    }

    function wizardNext() {
      if (wizardStep === 1 && !selectedTemplate) { alert('Please select a template first'); return; }
      if (wizardStep < 3) { wizardStep++; renderWizard(); }
    }

    function wizardBack() {
      if (wizardStep > 1) { wizardStep--; renderWizard(); }
    }

    function renderConfirmCard() {
      const name = document.getElementById('agent-name').value || selectedTemplate?.name || 'My Agent';
      const model = document.getElementById('agent-model').value;
      const lang = document.getElementById('agent-lang').selectedOptions[0]?.text || 'English';
      document.getElementById('confirm-card').innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <span style="font-size:48px;">${selectedTemplate?.icon || '🤖'}</span>
          <div>
            <div style="font-size:20px;font-weight:700;">${name}</div>
            <div style="color:var(--text-muted);font-size:14px;">Based on: ${selectedTemplate?.name || 'Custom'} (${selectedTemplate?.nameZh || ''})</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px;">
          <div><span style="color:var(--text-dim);">Model:</span> ${model}</div>
          <div><span style="color:var(--text-dim);">Language:</span> ${lang}</div>
          <div style="grid-column:span 2;"><span style="color:var(--text-dim);">Industry:</span> ${selectedTemplate?.industryZh || ''} (${selectedTemplate?.industry || ''})</div>
        </div>
      `;
    }

    async function createAgent() {
      const btn = document.getElementById('create-btn');
      btn.textContent = '⏳ Creating...';
      btn.disabled = true;
      try {
        const res = await fetch(`${API}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('agent-name').value || selectedTemplate?.name,
            templateId: selectedTemplate?.id,
            description: document.getElementById('agent-desc').value,
            model: document.getElementById('agent-model').value,
            language: document.getElementById('agent-lang').value,
          }),
        });
        const agent = await res.json();
        // Reset wizard
        wizardStep = 1;
        selectedTemplate = null;
        document.getElementById('agent-name').value = '';
        document.getElementById('agent-desc').value = '';
        // Navigate to chat
        openChat(agent.id);
      } catch(e) {
        alert('Failed to create agent: ' + e.message);
      }
      btn.textContent = '🚀 Create Agent';
      btn.disabled = false;
    }

    // === Dashboard ===
    function renderAgents() {
      if (agents.length === 0) {
        document.getElementById('agents-list').style.display = 'none';
        document.getElementById('agents-empty').style.display = 'block';
        return;
      }
      document.getElementById('agents-list').style.display = '';
      document.getElementById('agents-empty').style.display = 'none';
      document.getElementById('agents-list').innerHTML = agents.map(a => {
        const timeAgo = getTimeAgo(a.lastActive || a.created);
        return `
          <div class="card agent-card" onclick="openChat('${a.id}')">
            <div class="agent-actions">
              <button onclick="event.stopPropagation();openDeleteDialog('${a.id}')">🗑️</button>
            </div>
            <div class="agent-icon">${a.templateIcon || '🤖'}</div>
            <div class="agent-name">${a.name}</div>
            <div class="agent-template">${a.templateName || 'Custom'}</div>
            <div class="agent-stats">
              <span>💬 ${a.messageCount || 0} messages</span>
              <span>⏰ ${timeAgo}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    function getTimeAgo(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }

    // === Delete ===
    function openDeleteDialog(id) { deleteTargetId = id; document.getElementById('delete-dialog').classList.add('show'); }
    function closeDeleteDialog() { deleteTargetId = null; document.getElementById('delete-dialog').classList.remove('show'); }
    async function confirmDelete() {
      if (!deleteTargetId) return;
      await fetch(`${API}/api/agents/${deleteTargetId}`, { method: 'DELETE' });
      closeDeleteDialog();
      loadAgents();
    }

    // === Chat ===
    async function openLastChat() {
      if (currentAgent) { openChat(currentAgent.id); return; }
      const agentsRes = await fetch(`${API}/api/agents`).catch(() => null);
      if (agentsRes) {
        const data = await agentsRes.json().catch(() => ({}));
        const list = data.agents || [];
        if (list.length > 0) { openChat(list[0].id); return; }
      }
      navigate('dashboard');
    }

    async function switchChatAgent(agentId) {
      if (agentId && agentId !== currentAgent?.id) openChat(agentId);
    }

    async function openChat(agentId) {
      try {
        const res = await fetch(`${API}/api/agents/${agentId}`);
        currentAgent = await res.json();
        if (currentAgent.error) { navigate('dashboard'); return; }
      } catch { navigate('dashboard'); return; }

      // Load history from localStorage, fallback to empty
      const stored = localStorage.getItem(`opc-chat-${agentId}`);
      chatMessages = stored ? JSON.parse(stored) : [];

      document.getElementById('chat-agent-icon').textContent = currentAgent.templateIcon || '🤖';
      document.getElementById('chat-agent-name').textContent = currentAgent.name;
      document.getElementById('chat-agent-status').textContent = `${currentAgent.templateName || 'Custom'} · ${currentAgent.model}`;

      // Populate agent selector
      const sel = document.getElementById('chat-agent-select');
      sel.innerHTML = agents.map(a => `<option value="${a.id}" ${a.id === agentId ? 'selected' : ''}>${a.templateIcon || '🤖'} ${a.name}</option>`).join('');

      // Render messages
      const msgEl = document.getElementById('chat-messages');
      if (chatMessages.length > 0) {
        msgEl.innerHTML = chatMessages.map(m => `
          <div class="msg ${m.role}">
            <div class="msg-bubble">${m.content.replace(/</g,'&lt;')}</div>
          </div>
        `).join('');
      } else {
        msgEl.innerHTML = `
          <div class="msg assistant">
            <div class="msg-bubble">Hello! I'm ${currentAgent.name}. ${currentAgent.description ? 'I specialize in: ' + currentAgent.description : 'How can I help you today?'}</div>
          </div>
        `;
      }
      document.getElementById('chat-input').value = '';

      showPage('chat');
      location.hash = `/chat/${agentId}`;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const chatNav = document.querySelector('.nav-item[data-page="chat"]');
      if (chatNav) chatNav.classList.add('active');
      msgEl.scrollTop = msgEl.scrollHeight;
      document.getElementById('chat-input').focus();
    }

    function clearChat() {
      if (!currentAgent) return;
      chatMessages = [];
      localStorage.removeItem(`opc-chat-${currentAgent.id}`);
      document.getElementById('chat-messages').innerHTML = `
        <div class="msg assistant">
          <div class="msg-bubble">Hello! I'm ${currentAgent.name}. How can I help you today?</div>
        </div>
      `;
    }

    async function handleDocUpload(input) {
      const file = input.files[0];
      if (!file || !currentAgent) return;
      input.value = '';

      // Show uploading status in chat
      appendMessage('user', `📎 Uploading: ${file.name}`);
      const statusEl = appendMessage('assistant', '⏳ Processing document...');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API}/api/agents/${currentAgent.id}/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.error) {
          statusEl.textContent = `❌ ${data.error}`;
        } else {
          statusEl.textContent = `✅ Learned ${data.learnedCount} knowledge chunks from "${file.name}"`;
        }
      } catch (e) {
        statusEl.textContent = `❌ Upload failed: ${e.message}`;
      }
    }

    async function sendMessage() {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text || !currentAgent) return;

      input.value = '';
      chatMessages.push({ role: 'user', content: text });

      // Render user message
      appendMessage('user', text);

      // Show typing + streaming indicator
      document.getElementById('typing-indicator').classList.add('show');
      document.getElementById('streaming-indicator').style.display = 'inline';
      const msgContainer = document.getElementById('chat-messages');
      msgContainer.scrollTop = msgContainer.scrollHeight;

      try {
        const res = await fetch(`${API}/api/agents/${currentAgent.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatMessages }),
        });

        document.getElementById('typing-indicator').classList.remove('show');

        if (res.headers.get('content-type')?.includes('text/event-stream')) {
          // SSE streaming
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let assistantText = '';
          const bubbleEl = appendMessage('assistant', '');

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || parsed.content || '';
                  assistantText += content;
                  bubbleEl.textContent = assistantText;
                  msgContainer.scrollTop = msgContainer.scrollHeight;
                } catch {}
              }
            }
          }
          chatMessages.push({ role: 'assistant', content: assistantText });
        } else {
          const data = await res.json();
          const reply = data.response || data.error || 'No response';
          appendMessage('assistant', reply);
          chatMessages.push({ role: 'assistant', content: reply });
        }
        // Persist to localStorage
        if (currentAgent) {
          try { localStorage.setItem(`opc-chat-${currentAgent.id}`, JSON.stringify(chatMessages.slice(-100))); } catch {}
        }
      } catch(e) {
        document.getElementById('typing-indicator').classList.remove('show');
        appendMessage('assistant', `Error: ${e.message}`);
      } finally {
        document.getElementById('streaming-indicator').style.display = 'none';
      }
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function appendMessage(role, text) {
      const msgContainer = document.getElementById('chat-messages');
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const div = document.createElement('div');
      div.className = `msg ${role}`;
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = text;
      div.appendChild(bubble);
      const timeEl = document.createElement('div');
      timeEl.className = 'msg-time';
      timeEl.textContent = time;
      div.appendChild(timeEl);
      msgContainer.appendChild(div);
      msgContainer.scrollTop = msgContainer.scrollHeight;
      return bubble;
    }

    // === Memory ===
    function openMemory() {
      if (currentAgent) openMemoryPage(currentAgent.id);
    }

    async function openMemoryPage(agentId) {
      showPage('memory');
      location.hash = `/memory/${agentId}`;
      try {
        const res = await fetch(`${API}/api/agents/${agentId}/memory`);
        const data = await res.json();
        if (data.entries && data.entries.length > 0) {
          document.getElementById('memory-empty').style.display = 'none';
          document.getElementById('memory-timeline').innerHTML = `
            <div class="timeline">
              ${data.entries.map(e => `
                <div class="timeline-item">
                  <div class="timeline-date">${new Date(e.timestamp).toLocaleDateString()} ${new Date(e.timestamp).toLocaleTimeString()}</div>
                  <div class="timeline-content">${e.summary || e.content || 'Learned something new'}</div>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          document.getElementById('memory-empty').style.display = 'block';
          document.getElementById('memory-timeline').innerHTML = '';
        }
      } catch {
        document.getElementById('memory-empty').style.display = 'block';
      }
    }

    function navigateToChat() {
      if (currentAgent) openChat(currentAgent.id);
      else navigate('dashboard');
    }

    // === Settings ===
    let currentSettingsTab = 'models';
    let currentProvider = null;
    let currentChannel = null;
    let modelConfig = {};
    let statusRefreshTimer = null;

    function showSettings(tab) {
      currentSettingsTab = tab;
      document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector(`.settings-nav-item[data-settings="${tab}"]`)?.classList.add('active');
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`sp-${tab}`)?.classList.add('active');

      if (tab === 'models') initModelsPanel();
      if (tab === 'channels') initChannelsPanel();
      if (tab === 'memory') initMemoryPanel();
      if (tab === 'role') initRolePanel();
      if (tab === 'status') refreshStatus();
      if (tab === 'usage') refreshUsage();
      if (tab === 'search') initSearchPanel();
    }

    function switchModelTab(tab) {
      document.querySelectorAll('#sp-models .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#sp-models .tab-panel').forEach(p => p.classList.remove('active'));
      if (tab === 'local') {
        document.querySelector('#sp-models .tab:first-child').classList.add('active');
        document.getElementById('mt-local').classList.add('active');
      } else {
        document.querySelector('#sp-models .tab:last-child').classList.add('active');
        document.getElementById('mt-cloud').classList.add('active');
      }
    }

    // --- Models Panel ---
    async function initModelsPanel() {
      try {
        const res = await fetch(`${API}/api/settings/models`);
        modelConfig = await res.json();
      } catch { modelConfig = {}; }
      detectOllama();
      updateProviderStatuses();
      updateModelDropdowns();
    }

    async function detectOllama() {
      const statusEl = document.getElementById('ollama-status');
      const modelsEl = document.getElementById('ollama-models');
      const tutorialEl = document.getElementById('ollama-tutorial');
      statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span class="status-dot yellow"></span> 正在检测本地 Ollama...</div>';
      try {
        const res = await fetch(`${API}/api/settings/models/local`);
        const data = await res.json();
        if (data.running) {
          statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span class="status-dot green"></span> <b>Ollama 运行中</b> — 本地模型可用，完全免费</div>';
          tutorialEl.style.display = 'none';
          if (data.models && data.models.length > 0) {
            modelsEl.innerHTML = '<div class="card"><h3 style="font-size:15px;margin-bottom:12px;">已安装的模型</h3>' +
              data.models.map(m => {
                const size = m.size ? `${(m.size / 1e9).toFixed(1)}GB` : '';
                const isChat = modelConfig.chatModel === m.name;
                const isEmbed = modelConfig.embeddingModel === m.name;
                const badge = isChat ? ' <span style="color:var(--accent);font-size:11px;">● 聊天</span>' : isEmbed ? ' <span style="color:var(--green);font-size:11px;">● 记忆</span>' : '';
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
                  <div><span style="font-weight:500;">${m.name}</span>${badge}</div>
                  <span style="font-size:12px;color:var(--text-dim);">${size}</span>
                </div>`;
              }).join('') + '</div>';
            // Update dropdowns with local models
            updateModelDropdowns(data.models);
          } else {
            modelsEl.innerHTML = '<div class="card"><p style="color:var(--text-muted);font-size:14px;">Ollama 已运行但没有安装任何模型。请在终端运行：<br><code style="background:var(--bg-hover);padding:2px 8px;border-radius:4px;font-family:var(--mono);">ollama pull qwen2.5:7b</code></p></div>';
          }
        } else {
          statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span class="status-dot red"></span> <b>Ollama 未运行</b> — 按照下面的教程安装</div>';
          modelsEl.innerHTML = '';
          tutorialEl.style.display = 'block';
        }
      } catch {
        statusEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span class="status-dot red"></span> 无法检测 Ollama</div>';
        tutorialEl.style.display = 'block';
      }
    }

    function updateModelDropdowns(localModels) {
      const chatSel = document.getElementById('cfg-chat-model');
      const embedSel = document.getElementById('cfg-embed-model');
      if (localModels && localModels.length > 0) {
        const chatOpts = localModels.map(m => `<option value="${m.name}" ${modelConfig.chatModel === m.name ? 'selected' : ''}>${m.name}${m.name === 'qwen2.5:7b' ? ' ⭐ 推荐' : ''}</option>`).join('');
        const embedOpts = localModels.map(m => `<option value="${m.name}" ${modelConfig.embeddingModel === m.name ? 'selected' : ''}>${m.name}${m.name === 'nomic-embed-text' ? ' ⭐ 推荐' : ''}</option>`).join('');
        chatSel.innerHTML = chatOpts;
        embedSel.innerHTML = embedOpts;
      }
      // Add cloud models if configured
      const providers = modelConfig.providers || {};
      const cloudModels = [];
      if (providers.openai?.apiKey) cloudModels.push({name:'gpt-4o',label:'GPT-4o (OpenAI)'},{name:'gpt-4o-mini',label:'GPT-4o Mini (OpenAI)'});
      if (providers.deepseek?.apiKey) cloudModels.push({name:'deepseek-chat',label:'DeepSeek V3'},{name:'deepseek-reasoner',label:'DeepSeek R1'});
      if (providers.anthropic?.apiKey) cloudModels.push({name:'claude-sonnet-4-20250514',label:'Claude Sonnet (Anthropic)'});
      if (providers.openrouter?.apiKey) cloudModels.push({name:'openrouter/auto',label:'OpenRouter Auto'});
      cloudModels.forEach(m => {
        chatSel.innerHTML += `<option value="${m.name}" ${modelConfig.chatModel === m.name ? 'selected' : ''}>${m.label}</option>`;
      });
    }

    function updateProviderStatuses() {
      const providers = modelConfig.providers || {};
      ['openai','deepseek','qwen','anthropic','openrouter'].forEach(p => {
        const el = document.getElementById(`pv-${p}`);
        if (!el) return;
        if (providers[p]?.apiKey) {
          el.innerHTML = '<span style="color:var(--green);">✅ 已配置</span>';
          el.closest('.provider-card')?.classList.add('configured');
        } else {
          el.innerHTML = '未配置';
          el.closest('.provider-card')?.classList.remove('configured');
        }
      });
    }

    async function saveModelAssignment() {
      const chatModel = document.getElementById('cfg-chat-model').value;
      const embeddingModel = document.getElementById('cfg-embed-model').value;
      try {
        await fetch(`${API}/api/settings/models`, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ chatModel, embeddingModel })
        });
        modelConfig.chatModel = chatModel;
        modelConfig.embeddingModel = embeddingModel;
      } catch {}
    }

    // --- Provider Dialog ---
    const PROVIDER_INFO = {
      openai: { name: 'OpenAI', desc: '需要 OpenAI 账号。获取 Key: platform.openai.com/api-keys', placeholder: 'sk-...' },
      deepseek: { name: 'DeepSeek', desc: '国产大模型，性价比极高。获取 Key: platform.deepseek.com', placeholder: 'sk-...' },
      qwen: { name: '通义千问', desc: '阿里云大模型。获取 Key: dashscope.console.aliyun.com', placeholder: 'sk-...' },
      anthropic: { name: 'Anthropic', desc: 'Claude 系列模型。获取 Key: console.anthropic.com', placeholder: 'sk-ant-...' },
      openrouter: { name: 'OpenRouter', desc: '100+ 模型聚合平台。获取 Key: openrouter.ai/keys', placeholder: 'sk-or-...' },
    };

    function configureProvider(provider) {
      currentProvider = provider;
      const info = PROVIDER_INFO[provider] || {};
      document.getElementById('pd-title').textContent = `配置 ${info.name || provider}`;
      document.getElementById('pd-desc').textContent = info.desc || '';
      document.getElementById('pd-apikey').placeholder = info.placeholder || 'API Key';
      document.getElementById('pd-apikey').value = modelConfig.providers?.[provider]?.apiKey || '';
      document.getElementById('pd-baseurl').value = modelConfig.providers?.[provider]?.baseUrl || '';
      document.getElementById('pd-test-result').innerHTML = '';
      document.getElementById('pd-baseurl-group').style.display = (provider === 'qwen' || provider === 'openrouter') ? 'block' : 'none';
      document.getElementById('provider-dialog').classList.add('show');
    }
    function closeProviderDialog() { document.getElementById('provider-dialog').classList.remove('show'); currentProvider = null; }

    async function testProvider() {
      const apiKey = document.getElementById('pd-apikey').value.trim();
      const baseUrl = document.getElementById('pd-baseurl').value.trim();
      const resultEl = document.getElementById('pd-test-result');
      if (!apiKey) { resultEl.innerHTML = '<span style="color:var(--yellow);">请先填入 API Key</span>'; return; }
      resultEl.innerHTML = '<span style="color:var(--text-muted);">⏳ 测试中...</span>';
      try {
        const res = await fetch(`${API}/api/settings/models/test`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ provider: currentProvider, apiKey, baseUrl: baseUrl || undefined })
        });
        const data = await res.json();
        resultEl.innerHTML = data.success ? '<span style="color:var(--green);">✅ 连接成功！</span>' : `<span style="color:var(--red);">❌ 连接失败 (${data.error || data.statusCode})</span>`;
      } catch(e) {
        resultEl.innerHTML = `<span style="color:var(--red);">❌ 网络错误</span>`;
      }
    }

    async function saveProvider() {
      const apiKey = document.getElementById('pd-apikey').value.trim();
      const baseUrl = document.getElementById('pd-baseurl').value.trim();
      if (!modelConfig.providers) modelConfig.providers = {};
      modelConfig.providers[currentProvider] = { apiKey, baseUrl: baseUrl || undefined };
      try {
        await fetch(`${API}/api/settings/models`, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ providers: modelConfig.providers })
        });
      } catch {}
      updateProviderStatuses();
      updateModelDropdowns();
      closeProviderDialog();
    }

    // --- Channels Panel ---
    const CHANNELS = [
      { id: 'telegram', name: 'Telegram', icon: '✈️', fields: [{key:'botToken',label:'Bot Token',placeholder:'123456:ABC-DEF...',help:'从 @BotFather 获取。<a href="https://t.me/botfather" target="_blank">打开 BotFather →</a>'}] },
      { id: 'wechat', name: '微信', icon: '💬', fields: [], comingSoon: true },
      { id: 'feishu', name: '飞书', icon: '🐦', fields: [{key:'appId',label:'App ID',placeholder:'cli_...'},{key:'appSecret',label:'App Secret',placeholder:'',type:'password'}] },
      { id: 'discord', name: 'Discord', icon: '🎮', fields: [{key:'botToken',label:'Bot Token',placeholder:'',type:'password'}] },
      { id: 'slack', name: 'Slack', icon: '💼', fields: [{key:'botToken',label:'Bot Token',placeholder:'xoxb-...',type:'password'}] },
      { id: 'email', name: 'Email', icon: '📧', fields: [{key:'imapHost',label:'IMAP Host',placeholder:'imap.gmail.com'},{key:'smtpHost',label:'SMTP Host',placeholder:'smtp.gmail.com'},{key:'email',label:'Email',placeholder:'agent@example.com'},{key:'password',label:'Password',placeholder:'',type:'password'}] },
      { id: 'web', name: 'Web', icon: '🌐', fields: [], alwaysOn: true },
      { id: 'whatsapp', name: 'WhatsApp', icon: '📱', fields: [{key:'phoneId',label:'Phone Number ID',placeholder:''},{key:'accessToken',label:'Access Token',placeholder:'',type:'password'}] },
    ];

    let channelConfigs = {};

    async function initChannelsPanel() {
      try {
        const res = await fetch(`${API}/api/settings/channels`);
        channelConfigs = await res.json();
      } catch { channelConfigs = {}; }
      renderChannels();
    }

    function renderChannels() {
      document.getElementById('channels-grid').innerHTML = CHANNELS.map(ch => {
        const cfg = channelConfigs[ch.id] || {};
        const connected = ch.alwaysOn || (cfg && Object.keys(cfg).some(k => k !== 'updated' && cfg[k]));
        const statusDot = ch.comingSoon ? 'yellow' : connected ? 'green' : 'red';
        const statusText = ch.comingSoon ? '即将支持' : connected ? '已连接' : '未配置';
        return `<div class="card channel-card" onclick="${ch.comingSoon ? '' : `configureChannel('${ch.id}')`}" style="${ch.comingSoon ? 'opacity:0.6;cursor:default;' : ''}">
          <div class="ch-icon">${ch.icon}</div>
          <div class="ch-info">
            <div class="ch-name">${ch.name}</div>
            <div class="ch-status"><span class="status-dot ${statusDot}"></span> ${statusText}</div>
          </div>
          ${!ch.comingSoon && !ch.alwaysOn ? '<span style="color:var(--text-dim);font-size:18px;">›</span>' : ''}
          ${ch.alwaysOn ? '<span style="font-size:12px;color:var(--green);">默认开启</span>' : ''}
        </div>`;
      }).join('');
    }

    function configureChannel(chId) {
      const ch = CHANNELS.find(c => c.id === chId);
      if (!ch || ch.comingSoon) return;
      if (ch.alwaysOn) return;
      currentChannel = chId;
      const cfg = channelConfigs[chId] || {};
      document.getElementById('cd-title').textContent = `配置 ${ch.name}`;
      document.getElementById('cd-desc').textContent = '';
      document.getElementById('cd-fields').innerHTML = ch.fields.map(f =>
        `<div class="form-group">
          <label class="label">${f.label}</label>
          <input class="input" id="cf-${f.key}" type="${f.type || 'text'}" placeholder="${f.placeholder || ''}" value="${cfg[f.key] || ''}">
          ${f.help ? `<p style="font-size:12px;color:var(--text-dim);margin-top:4px;">${f.help}</p>` : ''}
        </div>`
      ).join('');
      document.getElementById('channel-dialog').classList.add('show');
    }
    function closeChannelDialog() { document.getElementById('channel-dialog').classList.remove('show'); currentChannel = null; }

    async function saveChannel() {
      const ch = CHANNELS.find(c => c.id === currentChannel);
      if (!ch) return;
      const cfg = {};
      ch.fields.forEach(f => { cfg[f.key] = document.getElementById(`cf-${f.key}`)?.value?.trim() || ''; });
      try {
        await fetch(`${API}/api/settings/channels/${currentChannel}`, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(cfg)
        });
        channelConfigs[currentChannel] = cfg;
      } catch {}
      renderChannels();
      closeChannelDialog();
    }

    // --- Memory Panel (DeepBrain iframe) ---
    async function initMemoryPanel() {
      const container = document.getElementById('memory-module-frame');
      const running = await checkModulePort(4001);
      if (running) {
        container.innerHTML = `<div class="module-frame-container"><iframe src="http://localhost:4001" title="DeepBrain 记忆管理"></iframe></div>`;
      } else {
        container.innerHTML = `<div class="card module-frame-fallback">
          <div class="mf-icon">🧠</div>
          <h3 style="margin-bottom:8px;">DeepBrain 未运行</h3>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">记忆管理由 DeepBrain 模块提供（端口 4001）</p>
          <a href="http://localhost:4001" target="_blank" class="btn btn-primary">🔗 打开记忆管理</a>
          <p style="color:var(--text-dim);font-size:12px;margin-top:12px;">如果按钮无法打开，请先启动 DeepBrain 服务</p>
        </div>`;
      }
    }

    // --- Role Panel (Workstation iframe) ---
    async function initRolePanel() {
      const container = document.getElementById('role-module-frame');
      const running = await checkModulePort(4003);
      if (running) {
        container.innerHTML = `<div class="module-frame-container"><iframe src="http://localhost:4003" title="Workstation 角色编辑"></iframe></div>`;
      } else {
        container.innerHTML = `<div class="card module-frame-fallback">
          <div class="mf-icon">👤</div>
          <h3 style="margin-bottom:8px;">Workstation 未运行</h3>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;">角色编辑由 Workstation 模块提供（端口 4003）</p>
          <a href="http://localhost:4003" target="_blank" class="btn btn-primary">🔗 打开角色编辑</a>
          <p style="color:var(--text-dim);font-size:12px;margin-top:12px;">如果按钮无法打开，请先启动 Workstation 服务</p>
        </div>`;
      }
    }

    async function checkModulePort(port) {
      try {
        const res = await fetch(`${API}/api/modules`);
        const data = await res.json();
        const mod = (data.modules || []).find(m => m.port === port);
        return mod?.running || false;
      } catch { return false; }
    }

    // --- Status Panel ---
    async function refreshStatus() {
      try {
        const res = await fetch(`${API}/api/settings/status`);
        const data = await res.json();

        // Overview cards
        const upHrs = Math.floor(data.uptime / 3600);
        const upMins = Math.floor((data.uptime % 3600) / 60);
        const memMB = Math.round((data.memory?.rss || 0) / 1048576);

        document.getElementById('status-overview').innerHTML = `
          <div class="card-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
              <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
                <span class="status-dot green"></span><span style="font-size:14px;font-weight:600;">运行中</span>
              </div>
              <div class="stat-value">${upHrs}h ${upMins}m</div>
              <div class="stat-label">运行时间</div>
            </div>
            <div class="card stat-card">
              <div class="stat-value">${memMB} MB</div>
              <div class="stat-label">内存占用</div>
            </div>
            <div class="card stat-card">
              <div class="stat-value">${(data.modules || []).filter(m => m.running).length}/${(data.modules || []).length}</div>
              <div class="stat-label">模块在线</div>
            </div>
          </div>
          <div class="card" style="margin-bottom:16px;">
            <h3 style="font-size:15px;margin-bottom:12px;">模块状态</h3>
            ${(data.modules || []).map(m => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
              <span class="status-dot ${m.running ? 'green' : 'red'}"></span>
              <span>${m.icon} ${m.name}</span>
              <span style="color:var(--text-dim);font-size:12px;margin-left:auto;">:${m.port}</span>
            </div>`).join('')}
          </div>
        `;

        // Logs
        const logsEl = document.getElementById('status-logs');
        if (data.logs && data.logs.length > 0) {
          logsEl.textContent = data.logs.join('\n');
          logsEl.scrollTop = logsEl.scrollHeight;
        } else {
          logsEl.textContent = '暂无日志。Agent 运行后日志会显示在这里。';
        }
      } catch {
        document.getElementById('status-overview').innerHTML = '<div class="card"><p style="color:var(--text-muted);">无法获取状态信息</p></div>';
      }
    }

    // --- Usage Panel ---
    async function refreshUsage() {
      try {
        const res = await fetch(`${API}/api/settings/usage`);
        const data = await res.json();
        const totalTokens = data.totalTokens || 0;
        const totalCost = data.totalCost || 0;
        const byModel = data.byModel || {};
        const daily = data.daily || [];

        document.getElementById('usage-stats').innerHTML = `
          <div class="card-grid" style="margin-bottom:24px;">
            <div class="card stat-card">
              <div class="stat-value">${totalTokens > 1000 ? (totalTokens/1000).toFixed(1) + 'K' : totalTokens}</div>
              <div class="stat-label">总 Token 消耗</div>
            </div>
            <div class="card stat-card">
              <div class="stat-value">$${totalCost.toFixed(4)}</div>
              <div class="stat-label">估算费用</div>
            </div>
            <div class="card stat-card">
              <div class="stat-value">${Object.keys(byModel).length || 0}</div>
              <div class="stat-label">使用模型数</div>
            </div>
          </div>
          ${Object.keys(byModel).length > 0 ? `
            <div class="card" style="margin-bottom:16px;">
              <h3 style="font-size:15px;margin-bottom:12px;">按模型分布</h3>
              ${Object.entries(byModel).map(([m, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
                <span style="font-size:14px;">${m}</span>
                <span style="font-size:13px;color:var(--text-muted);">${v.tokens || 0} tokens · $${(v.cost || 0).toFixed(4)}</span>
              </div>`).join('')}
            </div>
          ` : ''}
          ${totalTokens === 0 ? `
            <div class="card" style="text-align:center;padding:40px;">
              <div style="font-size:36px;margin-bottom:12px;">📊</div>
              <p style="color:var(--text-muted);">还没有使用记录。开始和 Agent 聊天后，用量数据会自动记录在这里。</p>
              ${modelConfig.mode === 'local' || !modelConfig.mode ? '<p style="color:var(--green);font-size:13px;margin-top:8px;">💡 使用本地模型完全免费，不产生费用</p>' : ''}
            </div>
          ` : ''}
        `;
      } catch {
        document.getElementById('usage-stats').innerHTML = '<div class="card"><p style="color:var(--text-muted);">无法获取用量数据</p></div>';
      }
    }

    // === Web Search Settings ===
    async function initSearchPanel() {
      try {
        const res = await fetch(`${API}/api/settings/search`);
        const cfg = await res.json();
        document.getElementById('search-enabled').checked = cfg.enabled !== false;
        document.getElementById('search-engine').value = cfg.defaultEngine || 'duckduckgo';
        updateSearchEngineUI(cfg.defaultEngine || 'duckduckgo');
        if (cfg.engines) {
          const eng = cfg.engines[cfg.defaultEngine];
          if (eng?.apiKey) document.getElementById('search-apikey').value = eng.apiKey;
          if (eng?.baseUrl) document.getElementById('search-baseurl').value = eng.baseUrl;
        }
      } catch { /* defaults are fine */ }
    }

    function updateSearchEngineUI(engine) {
      const needsKey = ['brave', 'google'].includes(engine);
      const needsUrl = engine === 'searxng';
      document.getElementById('search-apikey-group').style.display = needsKey ? '' : 'none';
      document.getElementById('search-baseurl-group').style.display = needsUrl ? '' : 'none';
      if (engine === 'brave') document.getElementById('search-apikey-label').textContent = 'Brave Search API Key';
      if (engine === 'google') document.getElementById('search-apikey-label').textContent = 'Google API Key:CX';
    }

    async function updateSearchConfig() {
      const engine = document.getElementById('search-engine').value;
      updateSearchEngineUI(engine);
      const cfg = {
        enabled: document.getElementById('search-enabled').checked,
        defaultEngine: engine,
        engines: {}
      };
      cfg.engines[engine] = { enabled: true };
      const apiKey = document.getElementById('search-apikey').value;
      const baseUrl = document.getElementById('search-baseurl').value;
      if (apiKey) cfg.engines[engine].apiKey = apiKey;
      if (baseUrl) cfg.engines[engine].baseUrl = baseUrl;
      cfg.engines.duckduckgo = { enabled: true };
      try {
        await fetch(`${API}/api/settings/search`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg)
        });
      } catch { /* silent */ }
    }

    async function testSearch() {
      const el = document.getElementById('search-test-result');
      el.innerHTML = '<span style="color:var(--yellow);">🔍 正在搜索...</span>';
      try {
        const res = await fetch(`${API}/api/settings/search/test`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'hello world test' })
        });
        const data = await res.json();
        if (data.success && data.results?.length) {
          el.innerHTML = `<span style="color:var(--green);">✅ 搜索成功！找到 ${data.results.length} 条结果</span><br>` +
            data.results.map(r => `<div style="margin-top:8px;font-size:12px;"><a href="${r.url}" target="_blank">${r.title}</a><br><span style="color:var(--text-muted);">${r.snippet?.slice(0,100)}</span></div>`).join('');
        } else {
          el.innerHTML = `<span style="color:var(--red);">❌ ${data.error || '未找到结果'}</span>`;
        }
      } catch (e) {
        el.innerHTML = `<span style="color:var(--red);">❌ 测试失败: ${e.message}</span>`;
      }
    }

    // === Health Dashboard ===
    async function loadHealthDashboard() {
      const el = document.getElementById('health-section');
      if (!el) return;
      try {
        const [modRes, ollamaRes] = await Promise.all([
          fetch(`${API}/api/modules`),
          fetch(`${API}/api/settings/models/local`),
        ]);
        const modData = await modRes.json();
        const ollamaData = await ollamaRes.json();
        const modules = modData.modules || [];
        const runningCount = modules.filter(m => m.running).length;
        el.innerHTML = `
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            ${modules.map(m => `
              <div class="card" style="flex:1;min-width:140px;display:flex;align-items:center;gap:10px;padding:12px 14px;">
                <span class="status-dot ${m.running ? 'green' : 'red'}"></span>
                <span style="font-size:13px;">${m.icon} ${m.name}</span>
                <span style="font-size:11px;color:var(--text-dim);margin-left:auto;">:${m.port}</span>
              </div>
            `).join('')}
            <div class="card" style="flex:1;min-width:140px;display:flex;align-items:center;gap:10px;padding:12px 14px;">
              <span class="status-dot ${ollamaData.running ? 'green' : 'red'}"></span>
              <span style="font-size:13px;">🦙 Ollama</span>
              <span style="font-size:11px;color:var(--text-dim);margin-left:auto;">${ollamaData.running ? (ollamaData.models?.length || 0) + ' models' : 'offline'}</span>
            </div>
          </div>
        `;
      } catch {
        el.innerHTML = '';
      }
    }

    // === First Run Wizard ===
    let frStep = 1;
    let frSelectedTemplate = null;
    let frCreatedAgentId = null;

    async function checkFirstRun() {
      // Skip first-run wizard — agents are configured via init
      return;
    }

    function showFirstRunWizard(data) {
      frStep = 1;
      const overlay = document.getElementById('first-run-overlay');
      overlay.style.display = 'flex';
      frRenderStep();
      if (data?.ollamaDetected) {
        const statusEl = document.getElementById('fr-ollama-status');
        if (statusEl) {
          statusEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--green);"><span class="status-dot green"></span> <b>Ollama detected!</b> ${data.ollamaModels?.length ? data.ollamaModels.length + ' models available.' : ''} Local AI is free.</div>`;
          const choiceEl = document.getElementById('fr-model-choice');
          if (choiceEl) choiceEl.style.display = 'block';
          const sel = document.getElementById('fr-model-select');
          if (sel && data.ollamaModels?.length) {
            sel.innerHTML = data.ollamaModels.map(m => `<option value="${m.name}">${m.name} (local)</option>`).join('') + '<option value="gpt-4o-mini">GPT-4o Mini (cloud)</option>';
          }
        }
      } else {
        detectFrOllama();
      }
    }

    async function detectFrOllama() {
      try {
        const res = await fetch(`${API}/api/settings/models/local`);
        const data = await res.json();
        const statusEl = document.getElementById('fr-ollama-status');
        const choiceEl = document.getElementById('fr-model-choice');
        if (!statusEl) return;
        if (data.running) {
          statusEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;color:var(--green);"><span class="status-dot green"></span> <b>Ollama running</b> — free local models available!</div>`;
          if (choiceEl) choiceEl.style.display = 'block';
          const sel = document.getElementById('fr-model-select');
          if (sel && data.models?.length) {
            sel.innerHTML = data.models.map(m => `<option value="${m.name}">${m.name} (local)</option>`).join('') + '<option value="gpt-4o-mini">GPT-4o Mini (cloud)</option>';
          }
        } else {
          statusEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span class="status-dot red"></span> Ollama not detected — you can use cloud models or <a href="https://ollama.com" target="_blank">install Ollama</a> for free local AI.</div>`;
          if (choiceEl) choiceEl.style.display = 'block';
        }
      } catch {}
    }

    function frRenderStep() {
      for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`fr-step-${i}`);
        const panelEl = document.getElementById(`fr-panel-${i}`);
        if (stepEl) stepEl.className = 'wizard-step' + (i < frStep ? ' done' : i === frStep ? ' active' : '');
        if (panelEl) panelEl.className = 'wizard-panel' + (i === frStep ? ' active' : '');
      }
    }

    function frNext() {
      if (frStep === 3 && !frSelectedTemplate) {
        frSelectedTemplate = 'customer-service';
      }
      if (frStep === 3) {
        frStep = 4;
        frRenderStep();
        frCreateAgent();
        return;
      }
      if (frStep < 4) { frStep++; frRenderStep(); }
    }

    function frBack() {
      if (frStep > 1) { frStep--; frRenderStep(); }
    }

    function frSelectTemplate(id) {
      frSelectedTemplate = id;
      document.querySelectorAll('#fr-template-list .card').forEach(c => {
        c.style.borderColor = '';
        c.style.background = '';
      });
      const el = document.getElementById(`fr-tpl-${id}`);
      if (el) { el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-light)'; }
    }

    async function frCreateAgent() {
      const model = document.getElementById('fr-model-select')?.value || 'qwen2.5:7b';
      try {
        // Save first-run complete
        await fetch(`${API}/api/first-run/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: frSelectedTemplate, model }),
        });
        // Create the agent
        const res = await fetch(`${API}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '', templateId: frSelectedTemplate || 'customer-service', model }),
        });
        const agent = await res.json();
        frCreatedAgentId = agent.id;
        document.getElementById('fr-creating').style.display = 'none';
        document.getElementById('fr-done').style.display = 'block';
        await loadAgents();
      } catch(e) {
        document.getElementById('fr-creating').innerHTML = `<div style="color:var(--red);">Error: ${e.message}</div>`;
      }
    }

    function frFinish() {
      document.getElementById('first-run-overlay').style.display = 'none';
      if (frCreatedAgentId) openChat(frCreatedAgentId);
      else navigate('dashboard');
    }

    // === Drag & drop document upload ===
    const chatArea = document.getElementById('chat-messages');
    if (chatArea) {
      chatArea.addEventListener('dragover', (e) => { e.preventDefault(); chatArea.style.outline = '2px dashed var(--primary)'; });
      chatArea.addEventListener('dragleave', () => { chatArea.style.outline = ''; });
      chatArea.addEventListener('drop', (e) => {
        e.preventDefault();
        chatArea.style.outline = '';
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          const inp = document.getElementById('doc-upload-input');
          inp.files = dt.files;
          handleDocUpload(inp);
        }
      });
    }

    // === Start ===
    init();

    // =============================================
    // === Schedules Management ===
    // =============================================
    let editingScheduleId = null;

    async function loadSchedules() {
      try {
        const res = await fetch('/api/schedules');
        const tasks = await res.json();
        const list = Array.isArray(tasks) ? tasks : [];
        renderSchedules(list);
      } catch(e) {
        console.error('Failed to load schedules:', e);
        renderSchedules([]);
      }
    }

    function renderSchedules(tasks) {
      const listEl = document.getElementById('schedules-list');
      const emptyEl = document.getElementById('schedules-empty');
      if (!tasks.length) {
        listEl.innerHTML = '';
        emptyEl.style.display = '';
        return;
      }
      emptyEl.style.display = 'none';
      listEl.innerHTML = tasks.map(t => `
        <div class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:16px;">
          <div style="font-size:28px;">⏰</div>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:600;">${esc(t.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${esc(t.description || '')}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">
              ${esc(t.schedule)} · ${t.outputChannel || 'web'} · Next: ${t.nextRun ? new Date(t.nextRun).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">
              <input type="checkbox" ${t.enabled ? 'checked' : ''} onchange="toggleSchedule('${t.id}', this.checked)" style="opacity:0;width:0;height:0;">
              <span style="position:absolute;inset:0;border-radius:11px;background:${t.enabled ? 'var(--green)' : 'var(--border)'};transition:0.3s;"></span>
              <span style="position:absolute;top:2px;left:${t.enabled ? '20px' : '2px'};width:18px;height:18px;border-radius:50%;background:white;transition:0.3s;"></span>
            </label>
            <button class="btn btn-sm btn-secondary" onclick="runScheduleNow('${t.id}')" title="Run now">▶️</button>
            <button class="btn btn-sm btn-secondary" onclick="editSchedule('${t.id}')" title="Edit">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${t.id}')" title="Delete">🗑</button>
          </div>
        </div>
      `).join('');
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function showScheduleForm(task) {
      editingScheduleId = task ? task.id : null;
      document.getElementById('schedule-form').style.display = '';
      document.getElementById('schedule-form-title').textContent = task ? 'Edit Task' : 'New Scheduled Task';
      document.getElementById('sched-name').value = task ? task.name : '';
      document.getElementById('sched-frequency').value = task ? task.frequency : 'daily';
      document.getElementById('sched-time').value = task ? (task.time || '09:00') : '09:00';
      document.getElementById('sched-cron').value = task ? task.schedule : '';
      document.getElementById('sched-desc').value = task ? task.description : '';
      document.getElementById('sched-channel').value = task ? task.outputChannel : 'web';
      onSchedFreqChange();
    }

    function hideScheduleForm() {
      document.getElementById('schedule-form').style.display = 'none';
      editingScheduleId = null;
    }

    function onSchedFreqChange() {
      const freq = document.getElementById('sched-frequency').value;
      document.getElementById('sched-time-group').style.display = freq === 'custom' ? 'none' : '';
      document.getElementById('sched-cron-group').style.display = freq === 'custom' ? '' : 'none';
    }

    async function saveSchedule() {
      const data = {
        name: document.getElementById('sched-name').value.trim(),
        frequency: document.getElementById('sched-frequency').value,
        time: document.getElementById('sched-time').value,
        schedule: document.getElementById('sched-frequency').value === 'custom' ? document.getElementById('sched-cron').value.trim() : '',
        description: document.getElementById('sched-desc').value.trim(),
        outputChannel: document.getElementById('sched-channel').value,
        enabled: true,
      };
      if (!data.name) { alert('Task name is required'); return; }
      try {
        if (editingScheduleId) {
          await fetch(`/api/schedules/${editingScheduleId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        } else {
          await fetch('/api/schedules', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        }
        hideScheduleForm();
        loadSchedules();
      } catch(e) { alert('Failed to save: ' + e.message); }
    }

    async function toggleSchedule(id, enabled) {
      await fetch(`/api/schedules/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ enabled }) });
      loadSchedules();
    }

    async function deleteSchedule(id) {
      if (!confirm('Delete this task?')) return;
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      loadSchedules();
    }

    async function runScheduleNow(id) {
      await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
      alert('Task executed!');
      loadSchedules();
    }

    async function editSchedule(id) {
      const res = await fetch('/api/schedules');
      const tasks = await res.json();
      const list = Array.isArray(tasks) ? tasks : [];
      const task = list.find(t => t.id === id);
      if (task) showScheduleForm(task);
    }

    // =============================================
    // === Voice Interaction ===
    // =============================================
    let voiceRecognition = null;
    let isRecording = false;

    function toggleVoiceInput() {
      if (isRecording) {
        stopVoiceInput();
      } else {
        startVoiceInput();
      }
    }

    function startVoiceInput() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in this browser. Try Chrome.');
        return;
      }
      voiceRecognition = new SpeechRecognition();
      voiceRecognition.continuous = false;
      voiceRecognition.interimResults = true;
      voiceRecognition.lang = navigator.language || 'en-US';

      voiceRecognition.onstart = () => {
        isRecording = true;
        const btn = document.getElementById('voice-btn');
        btn.style.background = 'var(--red)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--red)';
        btn.textContent = '⏹';
      };

      voiceRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        document.getElementById('chat-input').value = transcript;
      };

      voiceRecognition.onend = () => {
        isRecording = false;
        const btn = document.getElementById('voice-btn');
        btn.style.background = 'transparent';
        btn.style.color = '';
        btn.style.borderColor = 'var(--border)';
        btn.textContent = '🎤';
        // Auto-send if we got text
        const input = document.getElementById('chat-input');
        if (input.value.trim()) {
          sendMessage();
        }
      };

      voiceRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        const btn = document.getElementById('voice-btn');
        btn.style.background = 'transparent';
        btn.style.color = '';
        btn.style.borderColor = 'var(--border)';
        btn.textContent = '🎤';
      };

      voiceRecognition.start();
    }

    function stopVoiceInput() {
      if (voiceRecognition) {
        voiceRecognition.stop();
      }
    }

    function speakText(text) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language || 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }

    // Patch message rendering to add TTS button to assistant messages
    const _origAppendMsg = typeof appendMessage === 'function' ? appendMessage : null;
    if (typeof window._patchedMsgRender === 'undefined') {
      window._patchedMsgRender = true;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && node.classList?.contains('msg') && node.classList?.contains('assistant')) {
              const bubble = node.querySelector('.msg-bubble');
              if (bubble && !node.querySelector('.tts-btn')) {
                const btn = document.createElement('button');
                btn.className = 'tts-btn';
                btn.textContent = '🔊';
                btn.title = 'Read aloud';
                btn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:50%;padding:4px 6px;cursor:pointer;font-size:14px;margin-top:4px;color:var(--text-muted);';
                btn.onclick = () => speakText(bubble.textContent);
                node.appendChild(btn);
              }
            }
          }
        }
      });
      const chatMsgs = document.getElementById('chat-messages');
      if (chatMsgs) observer.observe(chatMsgs, { childList: true });
    }

    // =============================================
    // === Image Generation Config ===
    // =============================================
    async function saveImageGenConfig() {
      const data = {
        openaiApiKey: document.getElementById('ig-openai-key').value.trim(),
        sdApiUrl: document.getElementById('ig-sd-url').value.trim(),
        replicateApiKey: document.getElementById('ig-replicate-key').value.trim(),
      };
      try {
        await fetch('/api/image-gen/config', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        document.getElementById('ig-status').textContent = '✅ Configuration saved!';
        document.getElementById('ig-status').style.color = 'var(--green)';
      } catch(e) {
        document.getElementById('ig-status').textContent = '❌ Failed: ' + e.message;
        document.getElementById('ig-status').style.color = 'var(--red)';
      }
    }

  
