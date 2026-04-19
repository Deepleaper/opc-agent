const http = require('http');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/dist/studio-ui/index.html', 'utf-8');
const srv = http.createServer((req, res) => {
  if (req.url === '/api/agents') {
    res.end(JSON.stringify({agents:[{id:'a1',name:'客服小助手',templateIcon:'🤖',status:'online'},{id:'a2',name:'销售顾问',templateIcon:'💼',status:'offline'}]}));
    return;
  }
  if (req.url === '/api/templates') { res.end(JSON.stringify([])); return; }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
});
srv.listen(4449, '0.0.0.0', () => console.log('Studio test server ready: http://localhost:4449'));
