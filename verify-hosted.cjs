const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Hosting (serve.cjs): one process for a cloud machine, the Dungeon Master and the table service on loopback, the
// gateway behind the platform's proxy with every file under one data folder; the invite code survives a restart.
const {startHosted}=require('./serve.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-hosted-')),root=path.join(tmp,'dist'),data=path.join(tmp,'data');
fs.mkdirSync(root);fs.writeFileSync(path.join(root,'index.html'),'<h1>Hosted game</h1>');
const call=(port,route,{method='GET',headers={},body,host='play.example'}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:host,...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
const never=async()=>{throw Error('the provider is never called in this check');};
(async()=>{
 await assert.rejects(startHosted({dataDir:data,root,publicOrigin:null,port:0,bind:'127.0.0.1'}),/QUESTBOUND_PUBLIC_ORIGIN/);
 await assert.rejects(startHosted({dataDir:data,root:path.join(tmp,'nowhere'),publicOrigin:'https://play.example',port:0,bind:'127.0.0.1'}),/Build the game first/);
 let hosted=await startHosted({dataDir:data,root,publicOrigin:'https://play.example',port:0,bind:'127.0.0.1',dm:{apiKey:'test-key',model:'test-model',fetchImpl:never},log:()=>{}});
 const port=hosted.info.port,code=hosted.info.inviteCode;
 try{
  assert.match(code,/^\d{8}$/);assert.equal(fs.readFileSync(path.join(data,'invite-code.txt'),'utf8').trim(),code,'the code is kept in the data folder');
  assert.equal(process.env.QUESTBOUND_DATA,data,'the Dungeon Master and the pictures write under the data folder');
  assert.ok(hosted.dungeonMaster.address().address==='127.0.0.1'&&hosted.table.address().address==='127.0.0.1','only the gateway faces outward');
  // The gateway answers to the public host only, and serves the invite page until a code is entered.
  let r=await call(port,'/');assert.equal(r.status,200);assert.ok(r.text.includes('Invite code'));
  assert.equal((await call(port,'/',{host:'127.0.0.1:'+port})).status,403);
  assert.equal((await call(port,'/api/health')).status,401);
  // Behind the platform's proxy each visitor is told apart by the entry the proxy added (the last one; whatever the
  // visitor wrote before it is ignored): one visitor's wrong guesses do not lock another out.
  const join=(guess,ip)=>call(port,'/pair',{method:'POST',headers:{Origin:'https://play.example','Content-Type':'application/json','X-Forwarded-For':'10.0.0.'+Math.floor(Math.random()*250)+', '+ip},body:JSON.stringify({code:guess})});
  for(let i=0;i<5;i++)assert.equal((await join('00000000','198.51.100.1')).status,401);
  assert.equal((await join(code,'198.51.100.1')).status,429,'the guesser is held');
  r=await join(code,'203.0.113.9');assert.equal(r.status,200,'another visitor pairs');const cookie=r.headers['set-cookie'][0];assert.ok(cookie.includes('Secure'));
  const headers={Cookie:cookie.split(';')[0],Origin:'https://play.example','Content-Type':'application/json'};
  assert.equal((await call(port,'/',{headers})).text,'<h1>Hosted game</h1>');
  // The Dungeon Master and the table are reached through the gateway alone.
  r=await call(port,'/api/health',{headers});assert.equal(r.status,200);assert.equal(JSON.parse(r.text).ready,true);
  r=await call(port,'/api/sync/poll',{method:'POST',headers,body:JSON.stringify({playerId:'hosted-player-1',name:'Ada'})});assert.equal(r.status,200);assert.equal(JSON.parse(r.text).players[0].name,'Ada');
  r=await call(port,'/api/sync/account-register',{method:'POST',headers,body:JSON.stringify({email:'ada@play.example',password:'made-up-pass'})});assert.equal(r.status,200);
  assert.ok(fs.existsSync(path.join(data,'accounts'))&&fs.existsSync(path.join(data,'sessions.json')),'accounts and paired browsers live in the data folder');
  assert.deepEqual(hosted.info.limits,{turns:60,turnsInAll:1200,art:600,table:600,requests:3000});
 }finally{await hosted.close();}
 // A restart keeps the invite code and the paired browser.
 hosted=await startHosted({dataDir:data,root,publicOrigin:'https://play.example',port:0,bind:'127.0.0.1',dm:{apiKey:'test-key',model:'test-model',fetchImpl:never},log:()=>{}});
 try{assert.equal(hosted.info.inviteCode,code);}finally{await hosted.close();}
 const given=await startHosted({dataDir:path.join(tmp,'data2'),root,publicOrigin:'https://play.example',inviteCode:'13572468',port:0,bind:'127.0.0.1',dm:{fetchImpl:never},log:()=>{}});
 try{assert.equal(given.info.inviteCode,'13572468','the host\'s own code is used');}finally{await given.close();}
 // The container and its notes exist and agree.
 const docker=fs.readFileSync('Dockerfile','utf8'),deploy=fs.readFileSync('DEPLOY.md','utf8');
 assert.ok(docker.includes('CMD ["node","serve.cjs"]')&&docker.includes('QUESTBOUND_DATA=/data')&&docker.includes('expo export'));
 assert.ok(deploy.includes('QUESTBOUND_PUBLIC_ORIGIN')&&deploy.includes('OPENAI_API_KEY')&&deploy.includes('/data'));
 assert.ok(fs.readFileSync('.dockerignore','utf8').includes('.questbound-*'));
 delete process.env.QUESTBOUND_DATA;fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Hosted: one process, the Dungeon Master and the table on loopback, the gateway behind the proxy telling visitors apart, the invite code and the data kept across restarts.');
})().catch(e=>{console.error(e);delete process.env.QUESTBOUND_DATA;try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
