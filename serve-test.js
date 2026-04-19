const http = require('http');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync('C:/Users/mingjwan/tmp-opc-clone/dist/studio-ui/index.html', 'utf-8');
const agentsDir = path.join(require('os').homedir(), '.opc', 'agents');

const srv = http.createServer((req, res) => {
  if (req.url === '/api/agents') {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
    const agents = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({agents}));
    return;
  }
  if (req.url === '/api/templates') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({templates:[], industries:[]}));
    return;
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
});
srv.listen(4000, '0.0.0.0', () => console.log('Studio: http://localhost:4000'));
