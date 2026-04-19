const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error') errors.push('CONSOLE:'+m.text()); });
  await page.goto('http://localhost:4000', {waitUntil:'networkidle0', timeout:10000});
  
  const result = await page.evaluate(() => {
    const container = document.getElementById('sidebar-agent-list');
    const html = container ? container.innerHTML : 'NOT FOUND';
    const agents = window._sidebarAgents;
    return { html: html.substring(0, 300), agents: agents ? agents.length : 'undefined', errors: [] };
  });

  console.log('JS errors:', errors.length ? errors : 'NONE');
  console.log('Sidebar HTML:', result.html);
  console.log('Agents count:', result.agents);
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
