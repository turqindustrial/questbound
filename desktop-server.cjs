// Serves the exported game (dist-phone) to this PC at http://localhost:8081. Loopback only; never serves workspace files.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {setBaseHeaders,filePolicies}=require('./security-headers.cjs');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
// The desktop game talks to the Dungeon Master (8084, or 8083) and the shared table (8086) on this PC, and nothing else.
const desktopConnect=["'self'",'http://localhost:8084','http://localhost:8083','http://localhost:8086'];
function createDesktopServer({root=path.join(__dirname,'dist-phone'),port=8081}={}){
 root=path.resolve(root);
 const policyFor=filePolicies({connect:desktopConnect});
 const server=http.createServer(async(req,res)=>{
  setBaseHeaders(res);
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host))return res.writeHead(403).end('Open Questbound at http://localhost:'+port+'/');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end();
  let relative;try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
  if(relative.includes('\0')||relative.includes('\\'))return res.writeHead(400).end();
  let file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  let stat=await fs.promises.stat(file).catch(()=>null);
  // Unknown routes fall back to the game page; asset requests stay strict.
  if(!stat?.isFile()){if(path.extname(file))return res.writeHead(404).end();file=path.join(root,'index.html');stat=await fs.promises.stat(file).catch(()=>null);if(!stat)return res.writeHead(503).end('Build the game first.');}
  if(path.extname(file)==='.html')try{res.setHeader('Content-Security-Policy',await policyFor(file,stat));}catch{return res.writeHead(503).end();}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':stat.size,'Cache-Control':path.basename(file)==='index.html'?'no-store':'public, max-age=31536000, immutable'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 return server;
}
if(require.main===module){
 const port=Number(process.env.QUESTBOUND_DESKTOP_PORT??8081),server=createDesktopServer({port});
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Something is already using port '+port+'.':e.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log('Questbound desktop ready at http://localhost:'+port+'/'));
}
module.exports={createDesktopServer,desktopConnect};
