// Adversarial checks use temporary data, isolated servers, and no paid API calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm');
const {createAccounts}=require('./accounts.cjs'),{createLimiter}=require('./rate-limit.cjs');
const {createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs'),{createDesktopServer}=require('./desktop-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-hardening-')),servers=[];
const listen=async server=>{servers.push(server);return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));};
const call=(port,route,{method='POST',body={},headers={}}={})=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{'Content-Type':'application/json',Origin:'http://localhost:8081',...headers}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>{let json;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,text,json,headers:res.headers});});
 });req.on('error',reject);req.end(method==='GET'?undefined:JSON.stringify(body));
});
const rejected=(promise,status)=>assert.rejects(promise,e=>e.status===status);
const email='owner@example.test',password='lantern-wisp-71',next='copper-kettle-42';
const snapshot={version:1,character:'{"name":"Test hero"}',game:{stage:'inn'},chosen:true};
(async()=>{
 let clock=Date.now();const dir=path.join(tmp,'accounts'),accounts=createAccounts({requireVerification:false,dir,now:()=>clock});
 const registrations=await Promise.allSettled([accounts.register(email,password),accounts.register(email,next)]);
 assert.equal(registrations.filter(r=>r.status==='fulfilled').length,1,'simultaneous registrations cannot replace the account');
 assert.equal(registrations[1].reason.status,409);const owner=registrations[0].value;
 await accounts.save(owner.token,snapshot);
 const other=await accounts.login(email,password);
 const changes=await Promise.allSettled([accounts.changePassword(owner.token,password,next),accounts.login(email,password),accounts.changePassword(other.token,password,'third-lantern-42')]);
 assert.equal(changes[0].status,'fulfilled');assert.equal(changes[1].reason.status,401);assert.equal(changes[2].reason.status,401);
 await rejected(accounts.load(other.token),401);await accounts.login(email,next);
 // Even another store instance (such as the host CLI) cannot be overwritten by a stale asynchronous hash.
 const otherStore=createAccounts({requireVerification:false,dir,now:()=>clock});
 const staleLogin=accounts.login(email,next);await new Promise(r=>setImmediate(r));
 const code=await otherStore.resetPassword(email);await rejected(staleLogin,409);
 assert.match(code,/^[a-f0-9]{48}$/);
 const record=fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(f=>!f.includes('.save.'))),'utf8');
 assert.ok(!record.includes(code),'the private recovery code is not stored in plain text');
 await rejected(accounts.load(owner.token),401);
 await rejected(accounts.register(email,password,'stranger'),401);
 await rejected(accounts.register(email,password,'stranger','f'.repeat(48)),401);
 const recovered=await accounts.register(email,password,'owner',code);assert.deepEqual((await accounts.load(recovered.token)).snapshot,snapshot);
 await rejected(accounts.register(email,next,'stranger',code),409,'the code is one-use');
 const expired=await accounts.resetPassword(email);clock+=3600001;
 await rejected(accounts.register(email,next,'owner',expired),401);
 const fresh=await accounts.resetPassword(email);await accounts.register(email,next,'owner',fresh);
 // Concurrency cannot exceed the configured account capacity or queue unbounded password hashing.
 const small=createAccounts({requireVerification:false,dir:path.join(tmp,'small'),limit:1});
 const capacity=await Promise.allSettled([small.register('a@example.test',password),small.register('b@example.test',password)]);
 assert.equal(capacity.filter(r=>r.status==='fulfilled').length,1);assert.equal(small.count(),1);
 const busy=createAccounts({requireVerification:false,dir:path.join(tmp,'busy')});const waiting=Array.from({length:24},(_,i)=>busy.status('bad-'+i).catch(()=>{}));
 await rejected(busy.register('c@example.test',password),429);await Promise.all(waiting);
 // Rotating caller identities cannot exhaust memory or clear somebody's current restriction.
 let time=1000;const limit=createLimiter(1,1000,{now:()=>time,maxKeys:2});
 assert.equal(limit('a'),0);assert.equal(limit('b'),0);assert.ok(limit('c')>0);assert.ok(limit('a')>0);
 time+=1001;assert.equal(limit('c'),0);assert.equal(limit('a'),0);
 const {server:sync}=createSyncServer({dir:path.join(tmp,'table'),cloudDir:path.join(tmp,'cloud'),accountsDir:path.join(tmp,'served')});const sp=await listen(sync);
 assert.equal((await call(sp,'/poll',{headers:{Origin:''}})).status,403);
 assert.equal((await call(sp,'/unknown-route')).status,404);
 for(const body of [null,[],42,'bad'])assert.equal((await call(sp,'/poll',{body})).status,400);
 assert.equal((await call(sp,'/poll',{body:{playerId:'tester-123',name:'Test'}})).status,401);
 // Files accidentally placed inside the web export still must not expose host data.
 const root=path.join(tmp,'public'),outside=path.join(tmp,'private');fs.mkdirSync(root);fs.mkdirSync(outside);
 fs.writeFileSync(path.join(root,'index.html'),'<h1>Questbound</h1>');fs.writeFileSync(path.join(root,'game.js'),'window.game=true;');
 fs.writeFileSync(path.join(root,'.env'),'PRIVATE-SECRET');fs.mkdirSync(path.join(root,'.git'));fs.writeFileSync(path.join(root,'.git','config'),'PRIVATE-SECRET');
 fs.writeFileSync(path.join(root,'game.js.map'),'PRIVATE-SECRET');fs.writeFileSync(path.join(outside,'secret.txt'),'PRIVATE-SECRET');
 fs.symlinkSync(outside,path.join(root,'linked'),'junction');
 const dp=await listen(createDesktopServer({root,port:0}));
 for(const route of ['/.env','/.git/config','/game.js.map','/linked/secret.txt','/%2e%2e%5cprivate%5csecret.txt']){
  const r=await call(dp,route,{method:'GET',headers:{Host:'localhost:0'}});assert.ok([400,403,404].includes(r.status),route);assert.ok(!r.text.includes('PRIVATE-SECRET'));
 }
 assert.equal((await call(dp,'/game.js',{method:'GET',headers:{Host:'localhost:0'}})).status,200);
 // Pairing never permits account credentials over plain HTTP on the LAN. HTTPS permits normal account access.
 for(const encrypted of [false,true]){
  let forwarded=0;const origin=encrypted?'https://play.example':'http://10.0.0.5:0',host=new URL(origin).host;
  const {server}=createPhoneServer({root,host:'10.0.0.5',port:0,publicOrigin:encrypted?origin:null,code:'12345678',fetchImpl:async()=>{forwarded++;return {ok:true,status:200,headers:{get:()=>null},json:async()=>({signedIn:true})};}});
  const gp=await listen(server),headers={Host:host,Origin:origin};
  if(!encrypted){assert.equal((await call(gp,'/pair',{headers,body:{code:'12345678'}})).status,426);assert.equal((await call(gp,'/',{method:'GET',headers})).status,426);assert.equal(forwarded,0);continue;}
  assert.equal((await call(gp,'/api/sync/account-login',{headers})).status,401);
  const pair=await call(gp,'/pair',{headers,body:{code:'12345678'}});assert.equal(pair.status,200);
  headers.Cookie=pair.headers['set-cookie'][0].split(';')[0];
  const r=await call(gp,'/api/sync/account-login',{headers,body:{email,password}});
  assert.equal(r.status,encrypted?200:403);assert.equal(forwarded,encrypted?1:0);
  for(const route of ['/.env','/.git/config','/game.js.map','/linked/secret.txt']){
   const file=await call(gp,route,{method:'GET',headers});assert.ok([403,404].includes(file.status),route);assert.ok(!file.text.includes('PRIVATE-SECRET'));
  }
 }
 // The browser stops before transmitting credentials on HTTP, even if an old gateway is running.
 const rules=fs.readFileSync(path.join(__dirname,'accountClient.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 let sent=0;const {accountCall}=vm.runInNewContext(rules+'\n({accountCall})',{location:{protocol:'http:',hostname:'10.0.0.5'},tableEndpoint:()=>'',AbortSignal});
 await assert.rejects(accountCall('account-login',{email,password},async()=>{sent++;}),/HTTPS/);assert.equal(sent,0);
 console.log('Security hardening passed: account races, reset ownership/expiry, bounded queues and limits, invalid routes/origins, private-file escapes, and encrypted account access.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 for(const server of servers)await new Promise(r=>server.close(r));
 // Only remove the temp directory created by this test; unlink the junction first.
 const link=path.join(tmp,'public','linked');if(fs.existsSync(link))fs.unlinkSync(link);
 fs.rmSync(tmp,{recursive:true,force:true});
});
