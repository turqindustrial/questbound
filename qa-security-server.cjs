const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fixtures}=require('./test-fixtures.cjs'),{createSyncServer}=require('./account-server.cjs'),{createDesktopServer}=require('./desktop-server.cjs'),{pagePolicy,setBaseHeaders}=require('./security-headers.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-ui-')),f=fixtures(root),service=createSyncServer(f.options),servers=[service.server];
const signedOut=process.argv.includes('--signed-out');
const listen=(s,p)=>new Promise(r=>s.listen(p,'127.0.0.1',r));
(async()=>{
 await listen(service.server,8096);
 for(const [port,type,email] of [[8097,'fighter','alice@example.test'],[8098,'wizard','bob@example.test']]){
  const account=await f.user(service.accounts,email),snap=f.snapshot(type);
  const s=createDesktopServer({port,syncBackend:'http://127.0.0.1:8096'}),base=s.listeners('request')[0];s.removeAllListeners('request');
  s.on('request',(req,res)=>{
   const testCookie=req.headers.cookie?.match(new RegExp('(?:^|;\\s*)qb_qa_'+port+'=([a-f0-9]{64})(?:;|$)'))?.[1];req.headers.cookie=testCookie?'questbound_account='+testCookie:'';
   const setHeader=res.setHeader.bind(res);res.setHeader=(key,value)=>setHeader(key,key.toLowerCase()==='set-cookie'?String(value).replace('questbound_account=','qb_qa_'+port+'='):value);
   if(req.url==='/'){
    const values={'questbound.agreement.v1':{version:(/export const legalUpdated='([^']+)'/.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'legalText.js'),'utf8'))[1]),at:new Date().toISOString()},'questbound.account.v2':{id:account.id,email,verified:true,savedAt:null},['questbound.profile.'+account.id+'.questbound.character.v1']:JSON.parse(snap.character),['questbound.profile.'+account.id+'.questbound.adventure.v1']:snap};
    if(signedOut)for(const key of Object.keys(values))if(key!=='questbound.agreement.v1')delete values[key];
    const seed='<script>if(!sessionStorage.getItem("qa-seeded")){const values='+JSON.stringify(values)+';for(const [key,value] of Object.entries(values))localStorage.setItem(key,JSON.stringify(value));sessionStorage.setItem("qa-seeded","1");}</script>';
    const html=fs.readFileSync(path.join(__dirname,'dist-phone','index.html'),'utf8').replace('</head>',seed+'</head>');
    setBaseHeaders(res);res.setHeader('Set-Cookie',signedOut?'questbound_account=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/':'questbound_account='+account.token+'; HttpOnly; SameSite=Strict; Path=/');res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':pagePolicy(html)});return res.end(html);
   }
   if(req.url==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ready:true,actionProtocol:3}));}
   if(req.url==='/api/dm'){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Provider calls disabled in isolated test.'}));}
   base(req,res);
  });servers.push(s);await listen(s,port);
 }
 console.log('Isolated QA ready: http://localhost:8097/ and http://127.0.0.1:8098/. Synthetic accounts only; no emails or AI calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
function stop(){Promise.all(servers.map(s=>new Promise(r=>s.close(r)))).then(()=>{fs.rmSync(root,{recursive:true,force:true});process.exit();});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
