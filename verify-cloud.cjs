const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
// Cloud saves on the host PC (by recovery code, stored as a hash), streamed Dungeon Master turns passed through the
// phone gateway and read by the game, and week-long pairing that survives a gateway restart.
const {createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-cloud-'));
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const call=(port,route,{method='POST',headers={},body,host}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{...(host?{Host:host}:{}),'Content-Type':'application/json',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));});
const snapshot={version:1,character:JSON.stringify({name:'Kara Vell'}),game:{stage:'inn'},health:null,chosen:true};
(async()=>{
 // ---- The table service keeps cloud saves ----
 const {server:sync}=createSyncServer({dir:path.join(tmp,'table'),cloudDir:path.join(tmp,'cloud'),cloudLimit:2,limits:{'cloud-load':[2,600000]}});const sp=await listen(sync);
 assert.equal((await call(sp,'/cloud-save',{body:{code:'short',snapshot}})).status,400);
 const saved=await call(sp,'/cloud-save',{body:{code:'abcd-efgh-jk23',snapshot}});assert.equal(saved.status,200);
 const files=fs.readdirSync(path.join(tmp,'cloud'));assert.equal(files.length,1);assert.match(files[0],/^[a-f0-9]{64}\.json$/,'Only a hash of the code names the file');
 const loaded=JSON.parse((await call(sp,'/cloud-load',{body:{code:'ABCDEFGHJK23'}})).text);assert.equal(loaded.snapshot.character,snapshot.character,'Codes ignore case and dashes');
 assert.equal((await call(sp,'/cloud-load',{body:{code:'ZZZZZZZZZZZZ'}})).status,404);
 // Each caller may try only so many codes; the answer says how long to wait.
 const limited=await call(sp,'/cloud-load',{body:{code:'ZZZZZZZZZZZZ'}});assert.equal(limited.status,429);assert.ok(Number(limited.headers['retry-after'])>=1);assert.match(limited.text,/Too many tries/);
 assert.equal((await call(sp,'/cloud-load',{body:{code:'ZZZZZZZZZZZZ'},headers:{'X-Questbound-Client':'another-visitor'}})).status,404,'counted per caller');
 for(const code of ['BBBBBBBBBBBB','CCCCCCCCCCCC'])await call(sp,'/cloud-save',{body:{code,snapshot}});
 assert.equal(fs.readdirSync(path.join(tmp,'cloud')).filter(f=>f.endsWith('.json')).length,2,'Old saves are pruned');
 assert.equal((await call(sp,'/cloud-save',{body:{code:'BBBBBBBBBBBB',snapshot:{version:2}}})).status,400);
 sync.close();
 // ---- The phone gateway passes streamed turns through and forwards cloud saves ----
 const root=path.join(tmp,'dist');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'index.html'),'<h1>Game</h1>');
 const lines=['{"narration":"Steel"}\n','{"narration":"Steel rings."}\n','{"reply":{"narration":"Steel rings."}}\n'];
 let forwarded=null;
 const fetchImpl=async(url,options={})=>{
  if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({ready:true,actionProtocol:3})};
  if(url.endsWith('/dm'))return JSON.parse(options.body).stream?{ok:true,status:200,headers:{get:()=>'application/x-ndjson; charset=utf-8'},body:(async function*(){for(const l of lines)yield Buffer.from(l);})()}:{ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>({narration:'Whole.'})};
  forwarded={url,body:JSON.parse(options.body)};return {ok:true,status:200,json:async()=>({saved:true,savedAt:'2026-10-01T00:00:00.000Z'})};
 };
 const store=path.join(tmp,'sessions.json');
 const gw=createPhoneServer({host:'127.0.0.1',port:0,root,code:'12345678',pairingHours:168,sessionHours:168,sessionStore:store,fetchImpl});const gp=await listen(gw.server);
 const H={host:'127.0.0.1:0'},O={Origin:'http://127.0.0.1:0'};
 const paired=await call(gp,'/pair',{...H,headers:O,body:{code:'12345678'}});assert.equal(paired.status,200);
 const cookie=paired.headers['set-cookie'][0].split(';')[0];assert.match(paired.headers['set-cookie'][0],/Max-Age=604800/,'Pairing lasts a week');
 const streamed=await call(gp,'/api/dm',{...H,headers:{...O,Cookie:cookie},body:{input:'x',context:{choices:[]},stream:true}});
 assert.match(streamed.headers['content-type'],/ndjson/);assert.equal(streamed.text,lines.join(''));
 const whole=await call(gp,'/api/dm',{...H,headers:{...O,Cookie:cookie},body:{input:'x',context:{choices:[]}}});assert.equal(JSON.parse(whole.text).narration,'Whole.');
 const cloud=await call(gp,'/api/sync/cloud-save',{...H,headers:{...O,Cookie:cookie},body:{code:'ABCDEFGHJK23',snapshot}});assert.equal(cloud.status,200);assert.match(forwarded.url,/\/cloud-save$/);
 assert.equal((await call(gp,'/api/sync/cloud-load',{...H,headers:O,body:{code:'ABCDEFGHJK23'}})).status,401,'Cloud saves need a paired browser');
 gw.server.close();
 // A restart with the same session store keeps the phone paired.
 const again=createPhoneServer({host:'127.0.0.1',port:0,root,code:'87654321',sessionStore:store,fetchImpl});const ap=await listen(again.server);
 assert.equal((await call(ap,'/',{method:'GET',...H,headers:{Cookie:cookie}})).text,'<h1>Game</h1>');again.server.close();
 // ---- The game reads a streamed turn ----
 const src=fs.readFileSync('dmConnection.js','utf8').replace(/export /g,'');
 const {askDm}=vm.runInNewContext(src+'\n({askDm})',{AbortSignal,Math,JSON,Date,TextDecoder,setTimeout});
 const seen=[];const enc=new TextEncoder();
 const streamFetch=async(url,options)=>{assert.equal(JSON.parse(options.body).stream,true);const chunks=lines.map(l=>enc.encode(l));return {ok:true,status:200,headers:{get:()=>'application/x-ndjson'},body:{getReader:()=>({read:async()=>chunks.length?{done:false,value:chunks.shift()}:{done:true}})}};};
 const r=await askDm('/api',{input:'x'},{fetchImpl:streamFetch,onNarration:t=>seen.push(t)});
 assert.deepEqual(seen,['Steel','Steel rings.']);assert.equal(r.ok,true);assert.equal(r.body.narration,'Steel rings.');
 const cut=await askDm('/api',{input:'x'},{fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>'application/x-ndjson'},text:async()=>'{"narration":"Ste"}\n'}),onNarration:()=>{}});
 assert.equal(cut.ok,false);assert.match(cut.body.error,/cut off/);
 const failed=await askDm('/api',{input:'x'},{fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>'application/x-ndjson'},text:async()=>'{"error":"The AI timed out."}\n'}),onNarration:()=>{}});
 assert.equal(failed.ok,false);assert.equal(failed.body.error,'The AI timed out.');
 // ---- Recovery codes ----
 const cloudSrc=fs.readFileSync('cloudRules.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 const c=vm.runInNewContext(cloudSrc+'\n({normalCode,showCode,newRecoveryCode})',{AsyncStorage:{},tableEndpoint:()=>'',setTimeout,clearTimeout});
 const fresh=c.newRecoveryCode(n=>Uint8Array.from({length:n},(_,i)=>i*7));assert.match(fresh,/^[A-Z0-9]{12}$/);assert.ok(!/[IO01]/.test(fresh),'No look-alike letters');
 assert.equal(c.showCode('abcdefghjk23'),'ABCD-EFGH-JK23');assert.equal(c.normalCode(' abcd-efgh-jk23 '),'ABCDEFGHJK23');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Passed: cloud saves kept by hashed recovery code (pruned, validated, paired-only through the gateway), streamed turns passed through and read by the game (with cut-off and error handling), and week-long pairing that survives a restart.');
})().catch(e=>{console.error(e);process.exit(1);});
