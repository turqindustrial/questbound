const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve('dist');
http.createServer((req,res) => {
  const requestPath = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target = path.resolve(root,'.' + requestPath);
  if (!target.startsWith(root + path.sep) && target !== root) {res.writeHead(403).end(); return;}
  const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root,'index.html');
  res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html','.png':'image/png','.ico':'image/x-icon'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(8082,'127.0.0.1',()=>console.log('Isolated test preview: http://localhost:8082'));
