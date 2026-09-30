const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDesktopServer}=require('./desktop-server.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-desktop-'));fs.mkdirSync(path.join(root,'_expo'));
fs.writeFileSync(path.join(root,'index.html'),'<h1>game</h1>');fs.writeFileSync(path.join(root,'_expo','app.js'),'app');
const get=(port,route,host)=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,headers:{Host:host??'localhost:'+port}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,text:t,headers:res.headers}));});req.on('error',reject);req.end();});
(async()=>{
 const server=createDesktopServer({root,port:0});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 // The server checks the Host header against its configured port, so recreate it on the real port.
 server.close();const real=createDesktopServer({root,port});await new Promise(r=>real.listen(port,'127.0.0.1',r));
 try{
  let r=await get(port,'/');assert.equal(r.status,200);assert.equal(r.text,'<h1>game</h1>');assert.equal(r.headers['cache-control'],'no-store');
  r=await get(port,'/_expo/app.js');assert.equal(r.text,'app');assert.match(r.headers['cache-control'],/immutable/);
  assert.equal((await get(port,'/some/route')).text,'<h1>game</h1>','Unknown routes open the game');
  assert.equal((await get(port,'/missing.js')).status,404);
  for(const route of ['/../launch.ps1','/%2e%2e/launch.ps1','/%2e%2e%5claunch.ps1'])assert.ok([400,403,404].includes((await get(port,route)).status),route);
  assert.equal((await get(port,'/','evil.test')).status,403,'Foreign hosts are refused');
  assert.equal((await get(port,'/','127.0.0.1:'+port)).status,200);
  const ps1=fs.readFileSync('launch.ps1','utf8');assert.equal(/[^\x00-\x7F]/.test(ps1),false,'Launcher stays ASCII for Windows PowerShell 5.1');
  assert.ok(ps1.includes('ConvertFrom-SecureString')&&!/Set-Content[^\n]*OPENAI_API_KEY/.test(ps1),'The key is only stored DPAPI-encrypted');
  const ignore=fs.readFileSync('.gitignore','utf8');for(const entry of ['.questbound-key.dpapi','.questbound-table/','.questbound-logs/','.questbound-diagnostics.jsonl*'])assert.ok(ignore.includes(entry),entry);
  console.log('Passed: desktop build server (index, assets, route fallback, traversal and host guards) and launcher safety (ASCII, DPAPI-only key storage, private files ignored).');
 }finally{await new Promise(r=>real.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
