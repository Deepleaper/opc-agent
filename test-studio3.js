const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
  await page.goto('http://localhost:4449', {waitUntil:'networkidle0', timeout:10000});
  
  // Check sidebar structure
  const sidebar = await page.evaluate(() => {
    const items = document.querySelectorAll('.sidebar .nav-item, .sidebar .agent-list-item, .sidebar .sidebar-section-title');
    return Array.from(items).map(el => el.textContent.trim().substring(0, 40));
  });
  
  // Check navigate
  const navType = await page.evaluate(() => typeof navigate);
  
  // Try global-models
  const modelsResult = await page.evaluate(() => {
    navigate('global-models');
    const pages = document.querySelectorAll('.page');
    for (const p of pages) {
      if (p.style.display === 'block') return p.id;
    }
    return 'none-visible';
  });
  
  // Try create-group
  const groupResult = await page.evaluate(() => {
    navigate('create-group');
    const pages = document.querySelectorAll('.page');
    for (const p of pages) {
      if (p.style.display === 'block') return p.id;
    }
    return 'none-visible';
  });
  
  // Check agent list
  const agentList = await page.evaluate(() => {
    const container = document.getElementById('sidebar-agent-list');
    return container ? container.children.length + ' items' : 'NOT FOUND';
  });

  // Check groups list
  const groupsList = await page.evaluate(() => {
    const container = document.getElementById('groups-list');
    return container ? container.innerHTML.substring(0, 100) : 'NOT FOUND';
  });

  // Try navigateToAgent
  const agentDetail = await page.evaluate(() => {
    if (typeof navigateToAgent === 'function') {
      navigateToAgent('agent-1');
      const pages = document.querySelectorAll('.page');
      for (const p of pages) {
        if (p.style.display === 'block') return p.id;
      }
    }
    return typeof navigateToAgent;
  });
  
  console.log('=== Studio Test Results ===');
  console.log('JS Errors:', errors.length ? errors.join('; ') : 'NONE');
  console.log('Sidebar items:', JSON.stringify(sidebar, null, 2));
  console.log('navigate type:', navType);
  console.log('global-models:', modelsResult);
  console.log('create-group:', groupResult);
  console.log('agent list:', agentList);
  console.log('groups list:', groupsList);
  console.log('agent detail:', agentDetail);
  
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
