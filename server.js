const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'v3');
const port = Number(process.env.PORT || 10000);
const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp'
};

function safePath(urlPath){
  const clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel));
  return full.startsWith(root) ? full : null;
}

const server = http.createServer((req,res)=>{
  const file = safePath(req.url);
  if(!file){ res.writeHead(400); return res.end('Bad request'); }
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile()){
      res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
      return res.end('Not found');
    }
    const ext=path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': mime[ext] || 'application/octet-stream',
      'cache-control': ext === '.json' ? 'no-store' : 'public, max-age=300',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, '0.0.0.0', ()=>console.log(`JARVIS V3 listening on ${port}`));
