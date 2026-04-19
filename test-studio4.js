const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4449', {waitUntil:'networkidle0', timeout:10000});
  
  const result = await page.evaluate(() => {
    // Test create-group
    navigate('create-group');
    const el = document.getElementById('page-create-group');
    if (!el) return 'page-create-group element NOT FOUND';
    const hasActive = el.classList.contains('active');
    const computedDisplay = window.getComputedStyle(el).display;
    return `found=true, active=${hasActive}, display=${computedDisplay}`;
  });
  
  const result2 = await page.evaluate(() => {
    navigate('global-models');
    const el = document.getElementById('page-settings');
    if (!el) return 'page-settings NOT FOUND';
    return `active=${el.classList.contains('active')}, display=${window.getComputedStyle(el).display}`;
  });

  const result3 = await page.evaluate(() => {
    // Check agent detail
    navigateToAgent('a1');
    const el = document.getElementById('page-agent-detail');
    if (!el) return 'page-agent-detail NOT FOUND';
    return `active=${el.classList.contains('active')}, display=${window.getComputedStyle(el).display}`;
  });

  console.log('JS errors:', errors.length ? errors : 'NONE');
  console.log('create-group:', result);
  console.log('global-models:', result2);
  console.log('agent-detail:', result3);
  
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
