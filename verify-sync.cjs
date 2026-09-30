const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
const endpoint=vm.runInNewContext(fs.readFileSync('tableClient.js','utf8').replace(/export /g,'')+'\n tableEndpoint');
assert.equal(endpoint({hostname:'localhost',port:'8081'}),'http://localhost:8086');assert.equal(endpoint({hostname:'10.0.0.169',port:'8085'}),'/api/sync');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-table-'));let clock=1e12;
const {server}=createSyncServer({dir,now:()=>clock});
const snap=n=>({version:1,character:JSON.stringify({name:'Hero '+n}),game:{stage:'inn',log:['turn '+n]},health:null,chosen:true});
function request(port,route,{method='POST',headers={},body}={},host='127.0.0.1'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:host+':'+port,'Content-Type':'application/json',...headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(t);}catch{}resolve({status:res.statusCode,json:j,headers:res.headers});});});req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));});}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,call=(route,body,headers)=>request(port,route,{body,headers});
 try{
  const A={playerId:'aaaaaaaa-1',name:'Sam'},B={playerId:'bbbbbbbb-2',name:'Riley'};
  let r=await call('/poll',{...A,knownVersion:-1});assert.equal(r.status,200);assert.equal(r.json.version,0);assert.equal(r.json.snapshot,null);
  r=await call('/save',{...A,snapshot:snap(1),baseVersion:0});assert.equal(r.status,200);assert.equal(r.json.version,1);
  r=await call('/poll',{...B,knownVersion:0});assert.equal(r.json.version,1);assert.equal(r.json.snapshot.game.log[0],'turn 1');assert.equal(r.json.players.length,2);
  r=await call('/poll',{...B,knownVersion:1});assert.equal(r.json.snapshot,undefined,'Unchanged tables send no snapshot');
  // A stale write is refused and returns the newer table.
  r=await call('/save',{...B,snapshot:snap(2),baseVersion:1});assert.equal(r.json.version,2);
  r=await call('/save',{...A,snapshot:snap(3),baseVersion:1});assert.equal(r.status,409);assert.equal(r.json.conflict,true);assert.equal(r.json.snapshot.game.log[0],'turn 2');assert.equal(r.json.updatedBy,'Riley');
  r=await call('/save',{...A,snapshot:snap(4),baseVersion:0,force:true});assert.equal(r.json.version,3,'Hosting replaces the table');
  // Turn-taking flags and presence expiry.
  r=await call('/poll',{...B,knownVersion:3,acting:true});assert.equal(r.json.players.find(p=>p.id===B.playerId).acting,true);
  clock+=16000;r=await call('/poll',{...A,knownVersion:3});assert.equal(r.json.players.length,1,'Silent players leave the table');
  // Guards.
  assert.equal((await call('/save',{...A,snapshot:{bad:true},baseVersion:3})).status,400);
  assert.equal((await call('/poll',{playerId:'x',name:'X'})).status,400);
  assert.equal((await call('/poll',{...A},{Origin:'http://evil.test'})).status,403);
  assert.equal((await call('/save',{...A,snapshot:{...snap(5),character:'x'.repeat(2600000)},baseVersion:3})).status,413);
  assert.equal((await call('/poll',{...A,name:'<b>Sam</b>\u0000'.repeat(10),knownVersion:3})).json.players.find(p=>p.id===A.playerId).name.includes('<'),false);
  // Persistence across restarts.
  const again=createSyncServer({dir,now:()=>clock});assert.equal(again.table().version,3);assert.equal(again.table().snapshot.game.log[0],'turn 4');
  // Phone gateway forwards paired, same-origin table calls to the loopback table.
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-root-'));fs.writeFileSync(path.join(root,'index.html'),'ok');
  const phone=createPhoneServer({host:'127.0.0.1',port:0,root,code:'12345678',now:()=>clock,syncBackend:'http://127.0.0.1:'+port});
  await new Promise(r=>phone.server.listen(0,'127.0.0.1',r));const pport=phone.server.address().port,origin='http://127.0.0.1:0';
  const hostHeader={Host:'127.0.0.1:0'};
  const p=(route,opts={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:pport,path:route,method:opts.method??'POST',headers:{...hostHeader,'Content-Type':'application/json',...(opts.headers??{})}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(t);}catch{}resolve({status:res.statusCode,json:j,headers:res.headers});});});req.on('error',reject);req.end(opts.body?JSON.stringify(opts.body):undefined);});
  try{
   assert.equal((await p('/api/sync/poll',{headers:{Origin:origin},body:{...A,knownVersion:3}})).status,401,'Unpaired phones cannot reach the table');
   const paired=await p('/pair',{headers:{Origin:origin},body:{code:'12345678'}});const cookie=paired.headers['set-cookie'][0].split(';')[0];
   r=await p('/api/sync/poll',{headers:{Origin:origin,Cookie:cookie},body:{...B,knownVersion:-1}});assert.equal(r.status,200);assert.equal(r.json.version,3);
   assert.equal((await p('/api/sync/poll',{headers:{Origin:'http://evil.test',Cookie:cookie},body:{...B}})).status,403);
   assert.equal((await p('/api/sync/drop',{headers:{Origin:origin,Cookie:cookie},body:{}})).status,405);
  }finally{await new Promise(r=>phone.server.close(r));fs.rmSync(root,{recursive:true,force:true});}
  console.log('Passed: shared-table versioning, stale-write refusal with the newer table returned, hosting, turn-taking flags, presence expiry, validation, origin and size guards, name sanitising, persistence, and paired phone-gateway forwarding.');
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
