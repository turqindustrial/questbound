const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Player accounts (accounts.cjs, the account routes of sync-server.cjs, the phone gateway's pass-through and the
// Settings panel): an email and a password keep a hero and adventure on the host's PC for any device.
// Every address and password here is made up for this check and lives in a temporary folder that is removed at the end.
const {createAccounts,normalEmail,validEmail,validPassword}=require('./accounts.cjs');
const {createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-accounts-'));
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const call=(port,route,{headers={},body,host}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method:'POST',headers:{...(host?{Host:host}:{}),'Content-Type':'application/json',Origin:'http://localhost:8081',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{let json=null;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,json,text});});});req.on('error',reject);req.end(JSON.stringify(body??{}));});
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
 const accounts=createAccounts({requireVerification:false,dir,now:()=>clock,limit:3,validSnapshot:s=>s?.version===1});
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
 assert.deepEqual((await accounts.load(made.token)).snapshot,snapshot);assert.deepEqual(await accounts.status(made.token),{signedIn:true,id:made.id,verified:true,savedAt:saved.savedAt});
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
 const reopened=createAccounts({requireVerification:false,dir,now:()=>clock,validSnapshot:s=>s?.version===1});assert.deepEqual((await reopened.load(third.token)).snapshot,later);
 clock+=181*86400000;const aged=createAccounts({requireVerification:false,dir,now:()=>clock});await fails(aged.load(third.token),401);clock-=181*86400000;
 // The host can reset a forgotten password: the save is kept and the player creates the account again.
 assert.equal(accounts.count(),1);assert.equal(await accounts.resetPassword('nobody@questbound.test'),false);const recovery=await accounts.resetPassword(email);assert.match(recovery,/^[a-f0-9]{48}$/);
 await fails(accounts.load(third.token),401);await fails(accounts.login(email,other,'phone-f'),401,/reset by the host/);
 const renewed=await accounts.register(email,pass,'phone-f',recovery);assert.equal(renewed.savedAt,'2026-10-02T12:01:00.000Z');assert.deepEqual((await accounts.load(renewed.token)).snapshot,later);
 // No more accounts than the limit.
 await accounts.register('two@questbound.test',pass,'x1');await accounts.register('three@questbound.test',pass,'x2');await fails(accounts.register('four@questbound.test',pass,'x3'),429,/all the accounts/);
 // Deleting an account removes everything of it.
 await fails(accounts.remove(renewed.token,'not-the-password','phone-f'),401,/Nothing was deleted/);
 assert.deepEqual(await accounts.remove(renewed.token,pass,'phone-f'),{removed:true});await fails(accounts.load(renewed.token),401);
 assert.equal(fs.readdirSync(dir).filter(f=>f.includes('.save.')).length,0);assert.equal(accounts.count(),2);assert.equal(await accounts.removeByEmail('two@questbound.test'),true);assert.equal(accounts.count(),1);
 // Verified HTTP sessions and gateway flow are covered by verify-identity-campaigns and verify-hosted.
 // ---- The game's side ----
 const rules=fs.readFileSync('accountClient.js','utf8'),panel=fs.readFileSync('AccountSettings.js','utf8'),app=fs.readFileSync('App.js','utf8'),cloud=fs.readFileSync('cloudRules.js','utf8');
 assert.ok(!/password[^;\n]{0,60}(AsyncStorage|localStorage)\.setItem|setItem\([^)]*password/i.test(rules),'the password is never stored on the device');
 assert.ok(rules.includes('hold:!!result.savedAt')&&rules.includes('s.hold)return null'),'an account that already holds an adventure is not overwritten before the player chooses');
 assert.ok(cloud.includes('saveToAccount(s.snapshot).catch')&&cloud.includes('noteSnapshot(snapshot)'),'saves go to the account as well');
 assert.ok(panel.includes('secureTextEntry')&&panel.includes('autoComplete="email"')&&panel.includes('Load my saved adventure here')&&panel.includes('Delete my account'));
 assert.ok(app.includes("<AccountSettings ")&&app.includes('bootstrapAccount'));
 // ---- Guest play (accountsRequired off): the one switch, the silent guest and no sign-in wall ----
 {const switchLine=/^export const accountsRequired=(true|false);$/m.exec(fs.readFileSync('accountRules.js','utf8'));assert.ok(switchLine,'accountRules.js holds the one switch');
  assert.equal(switchLine[1],'false','the beta lets everyone play without signing in');
  assert.equal(require('./account-server.cjs').accountsRequiredNow(),false,'the account service reads the same switch');
  process.env.QUESTBOUND_REQUIRE_ACCOUNTS='1';assert.equal(require('./account-server.cjs').accountsRequiredNow(),true,'a hosted game can force it on');delete process.env.QUESTBOUND_REQUIRE_ACCOUNTS;
  const vm=require('node:vm'),source=rules.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
  const run=async(answers,options)=>{
   const store=new Map(),asked=[];let profile='guest';
   const AsyncStorage={getItem:async k=>store.get(k)??null,setItem:async(k,v)=>{store.set(k,v);},removeItem:async k=>{store.delete(k);}};
   const api=vm.runInNewContext(source+'\n({bootstrapAccount,accountsNeeded,guestIdentity})',{AsyncStorage,legalUpdated:'10 October 2026',tableEndpoint:()=>'/api/sync',selectProfile:id=>{profile=/^[a-f0-9]{64}$/.test(id??'')?id:'guest';},currentProfile:()=>profile,AbortSignal,JSON,Object,Error,globalThis:{}});
   const fetchImpl=async(url)=>{const route=url.split('/account-')[1];asked.push(route);const a=answers[route]??{status:404,body:{}};return {ok:a.status===200,status:a.status,json:async()=>a.body};};
   const result=await api.bootstrapAccount(fetchImpl,options);return {result,asked,profile,needed:api.accountsNeeded(),guest:api.guestIdentity(),stored:[...store.keys()]};
  };
  const id='c'.repeat(64),signedOut={status:{status:401,body:{error:'You are signed out.'}}};
  let r=await run({...signedOut,guest:{status:200,body:{guest:true,id}}},{required:false});
  assert.deepEqual(r.asked,['status','guest'],'no session: a guest identity is asked for, silently');assert.equal(r.result,null);assert.equal(r.guest,id);assert.equal(r.needed,false);
  assert.equal(r.profile,'guest','a guest keeps the guest save namespace, so earlier saves stay where they are');assert.deepEqual(r.stored,[],'nothing about the guest is kept in browser storage');
  r=await run({status:{status:200,body:{signedIn:false,guest:true,id,verified:false,savedAt:null}}},{required:false});assert.deepEqual(r.asked,['status']);assert.equal(r.guest,id);assert.equal(r.profile,'guest');
  r=await run({...signedOut,guest:{status:200,body:{guest:true,id}}},{required:true});assert.deepEqual(r.asked,['status'],'with accounts required no guest is asked for');assert.equal(r.needed,true);assert.equal(r.guest,null);
  r=await run({...signedOut,guest:{status:403,body:{error:'Sign in with your account to play.',accountsRequired:true}}},{required:false});assert.equal(r.needed,true,'the host forcing accounts on is heard');assert.equal(r.guest,null);
  r=await run({status:{status:200,body:{signedIn:true,id,verified:true,savedAt:null}}},{required:false});assert.equal(r.profile,id,'a signed-in account keeps its own saves');assert.equal(r.guest,null);
  // Play is walled only while accounts are needed; Settings keeps the account as an offer.
  assert.ok(app.includes('bootstrapAccount(undefined,{required:accountsRequired})')&&app.includes('const mustSignIn=accountsNeeded()&&!account?.verified'),'App asks for the guest and gates play only when accounts are required');
  assert.equal((app.match(/!account\?\.verified/g)??[]).length,1,'no other sign-in wall');
  assert.equal((app.match(/&&mustSignIn/g)??[]).length,2,'the screen guard and navigation both use the switch');
  assert.ok(panel.includes('An account is optional')&&fs.readFileSync('HomeScreen.js','utf8').includes('unprotected'),'an account stays an offer');
  assert.ok(cloud.includes("owner!=='guest'||!!guestIdentity()"),'once accounts are offered, guests keep recovery-code copies on the host');}
 // ---- Local saves while accounts are not offered (the beta, 10 October 2026: "the login page is gone entirely for now,
 // all data will be saved locally"): no account or recovery-code UI, and nothing uploaded. With the switch on, all of it returns.
 {const vm=require('node:vm'),switchSource=fs.readFileSync('accountRules.js','utf8');
  const offeredWith=(source,hostNeeds=false)=>vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace(/^export \{[^}]*\} from .*;\r?\n?/gm,'').replace(/export /g,'')+'\n;accountsOffered',{hostNeedsAccounts:()=>hostNeeds});
  const switchedOn=switchSource.replace('export const accountsRequired=false;','export const accountsRequired=true;');
  assert.equal(offeredWith(switchSource)(),false,'the beta offers no accounts');assert.equal(offeredWith(switchSource,true)(),true,'the host requiring accounts brings them back');assert.equal(offeredWith(switchedOn)(),true,'so does the switch');
  // scheduleCloudSave, run as written with the real switch: no request of any kind while accounts are not offered.
  const run=async offered=>{
   const requests=[],toAccount=[],noted=[],store=new Map(),scope={getItem:async k=>store.get(k)??null,setItem:async(k,v)=>{store.set(k,v);}};
   const cloudApi=vm.runInNewContext(cloud.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')+'\n;({scheduleCloudSave,uploadSave})',{AsyncStorage:{scope:()=>scope},currentProfile:()=>'guest',tableEndpoint:()=>'/api/sync',noteSnapshot:s=>noted.push(s),saveToAccount:async s=>{toAccount.push(s);return null;},guestIdentity:()=>'d'.repeat(64),accountsOffered:offered,
    fetch:async(url,options)=>{requests.push(url);return {ok:true,json:async()=>({savedAt:'2026-10-10T12:00:00.000Z'})};},setTimeout,clearTimeout,AbortSignal,JSON,Array,Uint8Array,Error,globalThis:{crypto:require('node:crypto').webcrypto}});
   cloudApi.scheduleCloudSave({version:1,game:{}},0);await new Promise(r=>setTimeout(r,40));
   const direct=await cloudApi.uploadSave({version:1});await new Promise(r=>setTimeout(r,10));
   return {requests,toAccount,noted,direct,stored:[...store.keys()]};
  };
  let r=await run(offeredWith(switchSource));
  assert.deepEqual(r.requests,[],'no cloud-save request');assert.deepEqual(r.toAccount,[],'no account save');assert.deepEqual(r.noted,[],'no snapshot kept for an account');assert.equal(r.direct,null);assert.deepEqual(r.stored,[],'no recovery code is even made');
  r=await run(offeredWith(switchedOn));
  assert.ok(r.requests.length>=1&&r.requests.every(u=>u==='/api/sync/cloud-save'),'with accounts on, the recovery-code copy is uploaded again');assert.equal(r.toAccount.length,1,'and the account copy');
  // The screens: Settings shows no account or recovery-code section, the title no account prompt, unless accounts are offered.
  const home=fs.readFileSync('HomeScreen.js','utf8'),dev=fs.readFileSync('DeveloperDiagnostics.js','utf8');
  assert.ok(app.includes("{screen === 'Settings' && accountsOffered() && <AccountSettings ")&&app.includes("{screen === 'Settings' && accountsOffered() && <CloudSaveSettings "),'Settings: account and recovery code only while offered');
  assert.equal((app.match(/<AccountSettings /g)??[]).length,1);assert.equal((app.match(/<CloudSaveSettings /g)??[]).length,1);
  for(const file of fs.readdirSync('.').filter(f=>/\.js$/.test(f)&&!['App.js','AccountSettings.js','CloudSaveSettings.js'].includes(f)))assert.ok(!/<(AccountSettings|CloudSaveSettings)\b/.test(fs.readFileSync(file,'utf8')),file+' renders no account panel');
  assert.ok(app.includes('unprotected={saved&&!account&&accountsOffered()}')&&/const protect=unprotected&&/.test(home),'the title asks for an account only while offered');
  assert.ok(app.includes("if(a?.hold&&accountsOffered())setScreenState('Settings')")&&app.includes("accountsRequired?'Opening your account…':'Opening Questbound…'"),'nothing opens on an account');
  assert.ok(dev.includes("{accountsOffered()&&<GameButton label=\"Check account and local save owner\"")&&dev.includes("{accountsOffered()&&<><GameButton label=\"Read host security alerts\""),'developer checks ask for no account in the beta');
  assert.ok(app.includes("Settings' && <SaveTransfer/>"),'Move your hero (local save codes) stays');}
 assert.ok(fs.readFileSync('.gitignore','utf8').split(/\r?\n/).some(line=>line.trim()==='.questbound-*'),'account files are never committed');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Accounts: register, sign in, save, load, lock-out, new password, host reset and delete; guest play by default (one switch, a silent guest in the guest save namespace, no sign-in wall); in the beta no account or recovery-code screen and no upload, all back when accounts are on; verified HTTP sessions checked separately.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
