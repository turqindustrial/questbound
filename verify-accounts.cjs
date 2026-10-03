const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Player accounts (accounts.cjs, the account routes of sync-server.cjs, the phone gateway's pass-through and the
// Settings panel): an email and a password keep a hero and adventure on the host's PC for any device.
// Every address and password here is made up for this check and lives in a temporary folder that is removed at the end.
const {createAccounts,normalEmail,validEmail,validPassword}=require('./accounts.cjs');
const {createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-accounts-'));
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const call=(port,route,{headers={},body,host}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method:'POST',headers:{...(host?{Host:host}:{}),'Content-Type':'application/json',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{let json=null;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,json,text});});});req.on('error',reject);req.end(JSON.stringify(body??{}));});
const snapshot={version:1,character:JSON.stringify({name:'Kara Vell'}),game:{stage:'inn'},health:null,chosen:true},later={...snapshot,game:{stage:'tower'}};
const email='Tester.One@Questbound.TEST',pass='lantern-wisp-71',other='copper-kettle-42';
const fails=async(promise,status,words)=>{await assert.rejects(promise,e=>{assert.equal(e.status,status,e.message);if(words)assert.match(e.message,words);return true;});};
(async()=>{
 // ---- What counts as an email and a password ----
 assert.equal(normalEmail('  Name@Example.COM '),'name@example.com');
 for(const good of ['a@b.co','name.surname+tag@mail.example.org'])assert.ok(validEmail(good),good);
 for(const bad of ['','name','name@','@example.com','name@example','name @example.com','a@b..com','x'.repeat(250)+'@example.com'])assert.ok(!validEmail(bad),bad);
 assert.ok(validPassword('12345678')&&!validPassword('1234567')&&!validPassword('x'.repeat(201))&&!validPassword(12345678));
 // ---- The account store ----
 let clock=Date.parse('2026-10-02T12:00:00Z');const dir=path.join(tmp,'accounts');
 const accounts=createAccounts({dir,now:()=>clock,limit:3,validSnapshot:s=>s?.version===1});
 await fails(accounts.register('not-an-email',pass),400,/email/);await fails(accounts.register(email,'short'),400,/8 characters/);
 const made=await accounts.register(email,pass);assert.equal(made.email,'tester.one@questbound.test');assert.match(made.token,/^[a-f0-9]{64}$/);assert.equal(made.savedAt,null);
 await fails(accounts.register(' tester.one@QUESTBOUND.test ',other),409,/Sign in instead/);
 // Nothing readable is written down: no address, no password, no token.
 const files=fs.readdirSync(dir);assert.equal(files.length,1);assert.match(files[0],/^[a-f0-9]{64}\.json$/);
 const stored=fs.readFileSync(path.join(dir,files[0]),'utf8');
 for(const secret of ['tester','questbound.test',pass,made.token])assert.ok(!stored.toLowerCase().includes(secret.toLowerCase()),'the record does not hold '+secret.slice(0,6)+'…');
 const record=JSON.parse(stored);assert.equal(record.v,1);assert.match(record.salt,/^[a-f0-9]{32}$/);assert.match(record.hash,/^[a-f0-9]{128}$/);assert.equal(Object.keys(record.tokens).length,1);
 // Saving and loading with the sign-in token.
 await fails(accounts.load(made.token),404,/no saved adventure/);
 await fails(accounts.save(made.token,{version:2}),400);await fails(accounts.save('f'.repeat(64),snapshot),401,/signed out/);await fails(accounts.save('nonsense',snapshot),401);
 const saved=await accounts.save(made.token,snapshot);assert.equal(saved.savedAt,'2026-10-02T12:00:00.000Z');
 assert.deepEqual((await accounts.load(made.token)).snapshot,snapshot);assert.deepEqual(await accounts.status(made.token),{signedIn:true,savedAt:saved.savedAt});
 // Signing in elsewhere: the same account, told when it last saved; wrong passwords and unknown addresses are refused alike.
 const second=await accounts.login('TESTER.ONE@questbound.test',pass,'phone-a');assert.notEqual(second.token,made.token);assert.equal(second.savedAt,saved.savedAt);
 await fails(accounts.login(email,other,'phone-a'),401,/do not match/);await fails(accounts.login('nobody@questbound.test',pass,'phone-a'),401,/do not match/);
 clock+=60000;await accounts.save(second.token,later);assert.deepEqual((await accounts.load(made.token)).snapshot,later,'both devices see the latest save');
 // Signing out ends that device's token only.
 await accounts.logout(second.token);await fails(accounts.load(second.token),401);assert.deepEqual((await accounts.load(made.token)).snapshot,later);
 // Five wrong passwords lock the account for a quarter of an hour, even for the right password.
 for(let i=0;i<4;i++)await fails(accounts.login(email,'wrong-guess-'+i,'phone-b'),401);
 await fails(accounts.login(email,pass,'phone-b'),429,/Too many tries/);
 clock+=16*60000;const again=await accounts.login(email,pass,'phone-b');
 // One caller trying many accounts is stopped too.
 for(let i=0;i<12;i++)await fails(accounts.login('guess'+i+'@questbound.test','whatever-'+i,'phone-c'),401);
 await fails(accounts.login('guess99@questbound.test','whatever','phone-c'),429);
 await accounts.login(email,pass,'phone-d');
 // A new password signs the other devices out and replaces the old one.
 await fails(accounts.changePassword(again.token,'not-the-password',other),401,/current password/);await fails(accounts.changePassword(again.token,pass,'short'),400);
 assert.deepEqual(await accounts.changePassword(again.token,pass,other),{changed:true});
 await fails(accounts.load(made.token),401);assert.deepEqual((await accounts.load(again.token)).snapshot,later);
 clock+=16*60000;await fails(accounts.login(email,pass,'phone-e'),401);const third=await accounts.login(email,other,'phone-e');
 // Tokens run out after their time, and survive a restart of the service until then.
 const reopened=createAccounts({dir,now:()=>clock,validSnapshot:s=>s?.version===1});assert.deepEqual((await reopened.load(third.token)).snapshot,later);
 clock+=181*86400000;const aged=createAccounts({dir,now:()=>clock});await fails(aged.load(third.token),401);clock-=181*86400000;
 // The host can reset a forgotten password: the save is kept and the player creates the account again.
 assert.equal(accounts.count(),1);assert.equal(accounts.resetPassword('nobody@questbound.test'),false);assert.equal(accounts.resetPassword(email),true);
 await fails(accounts.load(third.token),401);await fails(accounts.login(email,other,'phone-f'),401,/reset by the host/);
 const renewed=await accounts.register(email,pass,'phone-f');assert.equal(renewed.savedAt,'2026-10-02T12:01:00.000Z');assert.deepEqual((await accounts.load(renewed.token)).snapshot,later);
 // No more accounts than the limit.
 await accounts.register('two@questbound.test',pass,'x1');await accounts.register('three@questbound.test',pass,'x2');await fails(accounts.register('four@questbound.test',pass,'x3'),429,/all the accounts/);
 // Deleting an account removes everything of it.
 await fails(accounts.remove(renewed.token,'not-the-password','phone-f'),401,/Nothing was deleted/);
 assert.deepEqual(await accounts.remove(renewed.token,pass,'phone-f'),{removed:true});await fails(accounts.load(renewed.token),401);
 assert.equal(fs.readdirSync(dir).filter(f=>f.includes('.save.')).length,0);assert.equal(accounts.count(),2);assert.equal(accounts.removeByEmail('two@questbound.test'),true);assert.equal(accounts.count(),1);
 // ---- Through the table service, and through the phone gateway for a paired phone ----
 const {server:sync}=createSyncServer({dir:path.join(tmp,'table'),cloudDir:path.join(tmp,'cloud'),accountsDir:path.join(tmp,'served'),limits:{'account-register':[2,3600000]}});const sp=await listen(sync);
 let r=await call(sp,'/account-register',{body:{email,password:pass}});assert.equal(r.status,200);const token=r.json.token;
 assert.equal((await call(sp,'/account-register',{body:{email,password:pass}})).status,409);
 assert.equal((await call(sp,'/account-register',{body:{email:'third@questbound.test',password:pass}})).status,429,'sign-ups are counted per caller');
 assert.equal((await call(sp,'/account-save',{body:{token,snapshot}})).status,200);assert.equal((await call(sp,'/account-save',{body:{token,snapshot:{nope:true}}})).status,400);
 r=await call(sp,'/account-load',{body:{token}});assert.equal(r.status,200);assert.deepEqual(r.json.snapshot,snapshot);
 assert.equal((await call(sp,'/account-login',{body:{email,password:'wrong-guess'}})).status,401);assert.equal((await call(sp,'/account-nonsense',{body:{}})).status,404);
 assert.equal((await call(sp,'/account-load',{body:{token},headers:{Origin:'https://elsewhere.example'}})).status,403,'other sites cannot reach accounts');
 const seen=[];const {server:gate,info}=createPhoneServer({root:tmp,host:'127.0.0.1',port:0,code:'12345678',syncBackend:'http://127.0.0.1:'+sp,fetchImpl:async(url,options)=>{seen.push({url,client:options?.headers?.['X-Questbound-Client']});return fetch(url,options);}});
 fs.writeFileSync(path.join(tmp,'index.html'),'<!doctype html><title>game</title>');
 const gp=await listen(gate),hostName='127.0.0.1:0',origin='http://127.0.0.1:0';
 // Unpaired browsers cannot reach accounts at all.
 assert.equal((await call(gp,'/api/sync/account-login',{host:hostName,headers:{Origin:origin},body:{email,password:pass}})).status,401);
 const paired=await new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:gp,path:'/pair',method:'POST',headers:{Host:hostName,Origin:origin,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.headers['set-cookie']?.[0]?.split(';')[0]));});req.on('error',reject);req.end(JSON.stringify({code:'12345678'}));});
 assert.ok(paired,'paired with the gateway');
 r=await call(gp,'/api/sync/account-login',{host:hostName,headers:{Origin:origin,Cookie:paired},body:{email,password:pass}});assert.equal(r.status,200);assert.equal(r.json.savedAt!==null,true);
 assert.ok(seen.at(-1).url.endsWith('/account-login')&&typeof seen.at(-1).client==='string'&&seen.at(-1).client.length>0,'the gateway names the visitor to the table service');
 r=await call(gp,'/api/sync/account-load',{host:hostName,headers:{Origin:origin,Cookie:paired},body:{token:r.json.token}});assert.equal(r.status,200);assert.deepEqual(r.json.snapshot,snapshot);
 assert.equal((await call(gp,'/api/sync/account-load',{host:hostName,headers:{Origin:'https://elsewhere.example',Cookie:paired},body:{token}})).status,403);
 assert.equal((await call(gp,'/api/sync/account-anything',{host:hostName,headers:{Origin:origin,Cookie:paired},body:{}})).status,405,'only the account routes are passed on');
 await new Promise(r=>gate.close(r));await new Promise(r=>sync.close(r));
 // ---- The game's side ----
 const rules=fs.readFileSync('accountRules.js','utf8'),panel=fs.readFileSync('AccountSettings.js','utf8'),app=fs.readFileSync('App.js','utf8'),cloud=fs.readFileSync('cloudRules.js','utf8');
 assert.ok(!/password[^;\n]{0,60}(AsyncStorage|localStorage)\.setItem|setItem\([^)]*password/i.test(rules),'the password is never stored on the device');
 assert.ok(rules.includes('hold:!!r.savedAt')&&rules.includes('if(!s||s.hold||!snapshot)return null'),'an account that already holds an adventure is not overwritten before the player chooses');
 assert.ok(cloud.includes('saveToAccount(s).catch')&&cloud.includes('noteSnapshot(snapshot)'),'saves go to the account as well');
 assert.ok(panel.includes('secureTextEntry')&&panel.includes('autoComplete="email"')&&panel.includes('Load my saved adventure here')&&panel.includes('Delete my account'));
 assert.ok(app.includes("{screen === 'Settings' && <AccountSettings ")&&app.includes('unprotected={saved&&!account}'));
 assert.ok(fs.readFileSync('.gitignore','utf8').split(/\r?\n/).some(line=>line.trim()==='.questbound-*'),'account files are never committed');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Accounts: register, sign in, save, load, lock-out, new password, host reset and delete; through the table service and the phone gateway.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
