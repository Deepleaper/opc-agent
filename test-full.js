const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4000', {waitUntil:'networkidle0', timeout:10000});
  
  const result = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar-agent-list');
    const sidebarHTML = sidebar ? sidebar.innerHTML : 'NOT FOUND';
    const allPages = Array.from(document.querySelectorAll('.page')).map(p => p.id);
    const activePage = document.querySelector('.page.active');
    const navItems = Array.from(document.querySelectorAll('.sidebar .nav-item, .sidebar .agent-list-item, .sidebar .sidebar-section-title')).map(el => el.textContent.trim().substring(0, 30));
    
    // Try clicking agent
    if (typeof navigateToAgent === 'function') {
      navigateToAgent('my-first-agent');
    }
    const afterClick = document.querySelector('.page.active');
    
    return {
      sidebarHTML: sidebarHTML.substring(0, 300),
      activePage: activePage ? activePage.id : 'none',
      afterClick: afterClick ? afterClick.id : 'none',
      navItems,
      bodyFontSize: window.getComputedStyle(document.body).fontSize,
      pageCount: allPages.length
    };
  });

  console.log('=== Full Validation ===');
  console.log('JS errors:', errors.length ? errors : 'NONE');
  console.log('Body font-size:', result.bodyFontSize);
  console.log('Sidebar HTML:', result.sidebarHTML);
  console.log('Nav items:', JSON.stringify(result.navItems));
  console.log('Default active page:', result.activePage);
  console.log('After click agent:', result.afterClick);
  console.log('Total pages:', result.pageCount);
  
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
