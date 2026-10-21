// The live shared table (campaign-live.cjs; 2026-10-21, the host: "players should be able to see that another player is
// typing as soon as they start typing and actions should be sent to the shared table instantly"): held waits answered
// the moment a campaign changes, typing and acting presence, their limits and caps, the three hops a wait passes (the
// account service, the desktop server, the share gateway), and the device's hook with its fallback to polling.
// Synthetic accounts and a stand-in Dungeon Master only; servers on free loopback ports with temp data.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),vm=require('node:vm');
const {createLive,busyWords}=require('./campaign-live.cjs'),{createSyncServer}=require('./account-server.cjs'),{createDesktopServer,syncTimeout}=require('./desktop-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
const busyRetry=/Please wait before asking|busy with other players/;
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-table-live-'));
let turnGate=null,turnEntered=null;
const fixture=require('./test-fixtures.cjs').fixtures(root,{ask:async()=>{turnEntered?.();if(turnGate)await turnGate.promise;return {narration:'The table turns to the next moment.',actionId:null};}});
const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const freePort=async()=>{const s=http.createServer();const port=await listen(s);await new Promise(r=>s.close(r));return port;};
function request(port,route,{method='POST',headers={},body}={}){
 return new Promise((resolve,reject)=>{const started=Date.now();const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{let json=null;try{json=JSON.parse(text);}catch{}resolve({status:res.statusCode,headers:res.headers,json,text,ms:Date.now()-started});});});req.on('error',reject);req.end(body);});
}
// The live module's timers do not keep a process alive (unref), so the check keeps itself alive until it is done.
const keepAlive=setInterval(()=>{},1000);
(async()=>{
 // 1. The live module alone: answers at once on a new version, presence answers no closer than the gap, a timeout
 // answers as it is, caps per member and in all, and a cancelled wait holds nothing.
 {
  let version=1,key='a';const live=createLive({waitMs:120,presenceGap:80,perMember:2,maxWaits:3});
  const check=(known,seen)=>force=>!force&&version===known&&key===seen?null:{answer:{version,key},urgent:version!==known};
  let t=Date.now(),p=live.wait('c1','s1',check(1,'a'));version=2;live.notify('c1');assert.deepEqual(await p,{version:2,key:'a'});assert.ok(Date.now()-t<60,'a new version is answered at once');
  t=Date.now();p=live.wait('c1','s1',check(2,'a'));key='b';live.notify('c1');assert.equal((await p).key,'b');assert.ok(Date.now()-t>=60,'a presence change waits out the gap since the last answer');
  t=Date.now();assert.deepEqual(await live.wait('c1','s1',check(2,'b')),{version:2,key:'b'});assert.ok(Date.now()-t>=110,'nothing new: answered as it is when the wait runs out');
  const first=live.wait('c1','s2',check(2,'b')),second=live.wait('c1','s2',check(2,'b'));assert.equal(live.status().open,2);
  const third=live.wait('c1','s2',check(2,'b'));assert.deepEqual(await first,{version:2,key:'b'},'a member\'s third wait answers their oldest');assert.equal(live.status().open,2);
  const other=live.wait('c1','s3',check(2,'b'));await assert.rejects(live.wait('c1','s4',check(2,'b')),e=>e.status===503&&!busyRetry.test(e.message),'past the cap a wait is refused, in words the game never retries at once');
  await Promise.all([second,third,other]);const stop=new AbortController(),cancelled=live.wait('c2','s1',check(2,'b'),{signal:stop.signal});assert.equal(live.status().open,1);stop.abort();await assert.rejects(cancelled,e=>e.status===499);assert.equal(live.status().open,0,'cancelled and answered waits hold nothing');
  assert.ok(!busyRetry.test(busyWords));
  // A turn begun (the lock) is news at once even inside the gap; a typing change waits the gap out.
  {const g=createLive({presenceGap:5000,waitMs:3000}),locks=g.locks();g.presence();let k='';const check=force=>!force&&g.presenceKey('c3')===k?null:{answer:g.presenceKey('c3'),urgent:false};
   k=await g.wait('c3','s1',check);let t=Date.now(),p=g.wait('c3','s1',check);locks.set('c3','s2');k=await p;assert.ok(Date.now()-t<100,'acting is shown at once');
   let done=false;p=g.wait('c3','s1',check).then(x=>{done=true;return x;});g.setTyping('c3','s3',true);await sleep(150);assert.equal(done,false,'typing waits out the gap');g.close();await p.catch(()=>{});}
  // Typing: on once (a refresh is no change), off again, and it lapses by itself.
  const quick=createLive({typingMs:60});let told=0;const watch=quick.wait('c9','x',force=>force||++told>1?{answer:'told',urgent:false}:null);
  assert.equal(quick.setTyping('c9','s1',true),true);assert.equal(quick.setTyping('c9','s1',true),false);assert.ok(quick.isTyping('c9','s1'));
  await sleep(90);assert.equal(quick.isTyping('c9','s1'),false,'typing lapses with no ping');assert.equal(await watch,'told');quick.close();live.close();
 }
 // 2. Campaigns: two members at a party table.
 const service=createSyncServer({...fixture.options,live:{waitMs:600,presenceGap:50,typingMs:400}});
 const a=await fixture.user(service.accounts,'alice@example.test'),b=await fixture.user(service.accounts,'bob@example.test');
 const U=t=>({...service.accounts.identity(t.token),active:()=>service.accounts.identity(t.token)}),A=U(a),B=U(b),C=service.campaigns;
 const created=C.create(A,{snapshot:fixture.snapshot('fighter'),name:'Alice',party:true});
 const joined=C.join(B,{invite:created.invite,snapshot:fixture.snapshot('wizard'),name:'Bob'}),campaignId=created.campaignId;
 const tableFile=path.join(root,'table','campaigns',campaignId+'.json');
 {
  let seen=C.poll(B,{campaignId,knownVersion:-1});assert.equal(typeof seen.presence,'string');assert.ok(seen.players.every(p=>p.typing===false));
  // Typing: Bob's held wait answers as soon as Alice starts typing, with no snapshot and never any words.
  let t=Date.now(),held=C.wait(B,{campaignId,knownVersion:seen.version,knownPresence:seen.presence});await sleep(70);
  assert.deepEqual(C.typing(A,{campaignId,typing:true}),{typing:true});let got=await held;
  assert.ok(got.players.find(p=>p.name==='Alice').typing,'Alice is typing');assert.equal(got.snapshot,undefined,'a presence answer carries no snapshot');assert.ok(Date.now()-t<400);
  assert.ok(!fs.readFileSync(tableFile,'utf8').includes('typing'),'typing is never written to the campaign');
  assert.throws(()=>C.typing(A,{campaignId,typing:'yes'}),e=>e.status===400);
  assert.throws(()=>C.typing({id:'f'.repeat(64)},{campaignId,typing:true}),e=>e.status===403,'only members');
  assert.throws(()=>C.wait({id:'f'.repeat(64)},{campaignId,knownVersion:1}),e=>e.status===403);
  // It lapses by itself when the pings stop.
  held=C.wait(B,{campaignId,knownVersion:got.version,knownPresence:got.presence});got=await held;assert.ok(!got.players.find(p=>p.name==='Alice').typing,'typing lapses');
  // Acting: Bob sees Alice acting the moment her turn begins (her typing cleared), then the kept turn with its snapshot.
  C.typing(A,{campaignId,typing:true});seen=C.poll(B,{campaignId,knownVersion:got.version});
  turnGate=deferred();const entered=deferred();turnEntered=entered.resolve;
  held=C.wait(B,{campaignId,knownVersion:seen.version,knownPresence:seen.presence});
  const turn=C.turn(A,{campaignId,question:'I look around the hall.',baseVersion:seen.version,requestId:crypto.randomUUID()});await entered.promise;
  got=await held;const alice=got.players.find(p=>p.name==='Alice');assert.ok(alice.acting&&!alice.typing,'acting at once, and no longer typing');
  held=C.wait(B,{campaignId,knownVersion:got.version,knownPresence:got.presence});await sleep(20);
  t=Date.now();turnGate.resolve();const kept=await turn;got=await held;turnGate=null;turnEntered=null;
  assert.equal(got.version,kept.version);assert.ok(got.snapshot,'the kept turn arrives with the state');assert.ok(Date.now()-t<200,'pushed at once');
  assert.equal(got.snapshot.game.party.lead,got.you,'each member is sent the table with their own hero in the lead');
  // Bob's own held wait while Bob is removed and kept out: it ends with the calm "removed" answer.
  held=C.wait(B,{campaignId,knownVersion:got.version,knownPresence:got.presence});await sleep(10);
  C.ban(A,{campaignId,seat:got.you});await assert.rejects(held,e=>e.status===403&&e.removed===true);
  await assert.rejects(async()=>C.wait(B,{campaignId,knownVersion:-1}),e=>e.removed===true);
  assert.equal(C.live.status().open,0);
 }
 // 3. Over HTTP: the account service, then the desktop server and the share gateway in front of it. A wait is held past
 // the services' request-receiving time limits (it bounds receiving a request, not answering it).
 const port=await listen(service.server);service.server.requestTimeout=300;
 const accountHeaders=t=>({Origin:'http://localhost:8081','Content-Type':'application/json',Host:'127.0.0.1:'+port,Cookie:'questbound_account='+t.token});
 const second=C.create(A,{snapshot:fixture.snapshot('fighter'),name:'Alice',party:true}),table=second.campaignId;
 C.join(B,{invite:second.invite,snapshot:fixture.snapshot('cleric'),name:'Bob'});
 const direct=(who,route,body)=>request(port,'/'+route,{headers:accountHeaders(who),body:JSON.stringify({campaignId:table,...body})});
 {
  const seen=(await direct(b,'poll',{knownVersion:-1})).json;
  let t=Date.now(),held=direct(b,'campaign-wait',{knownVersion:seen.version,knownPresence:seen.presence});
  let r=await held;assert.equal(r.status,200);assert.ok(Date.now()-t>=550,'held until it runs out, past the 300 ms request time limit');
  held=direct(b,'campaign-wait',{knownVersion:r.json.version,knownPresence:r.json.presence});await sleep(80);
  const typedAt=Date.now(),ping=await direct(a,'campaign-typing',{typing:true});assert.equal(ping.status,200);r=await held;
  assert.ok(r.json.players.find(p=>p.name==='Alice').typing);console.log('  account service: typing reached the other member '+(Date.now()-typedAt)+' ms after the ping (the ping itself '+ping.ms+' ms, the wait '+r.ms+' ms)');
  assert.equal((await direct(a,'campaign-typing',{typing:true,words:'x'.repeat(2000)})).status,413,'tiny bodies only');
  await direct(a,'campaign-typing',{typing:false});
  // A caller who goes away lets the wait go at once.
  const gone=http.request({hostname:'127.0.0.1',port,path:'/campaign-wait',method:'POST',headers:accountHeaders(b)});gone.end(JSON.stringify({campaignId:table,knownVersion:r.json.version,knownPresence:(await direct(b,'poll',{knownVersion:r.json.version})).json.presence}));gone.on('error',()=>{});
  await sleep(60);assert.equal(C.live.status().open,1);gone.destroy();await sleep(60);assert.equal(C.live.status().open,0,'released when the caller leaves');
 }
 // Counted per account: past the service's allowance a wait or a typing ping is refused like any other route.
 {
  const tight=createSyncServer({...fixture.options,dir:path.join(root,'tight'),limits:{'campaign-wait':[2,600000],'campaign-typing':[1,600000]},live:{waitMs:50}});
  const ta=await fixture.user(tight.accounts,'carol@example.test'),T={...tight.accounts.identity(ta.token)};const made=tight.campaigns.create(T,{snapshot:fixture.snapshot('fighter'),name:'Carol',party:true});
  const tp=await listen(tight.server),h={Origin:'http://localhost:8081','Content-Type':'application/json',Host:'127.0.0.1:'+tp,Cookie:'questbound_account='+ta.token};
  const go=(route,body)=>request(tp,'/'+route,{headers:h,body:JSON.stringify({campaignId:made.campaignId,...body})});
  assert.equal((await go('campaign-wait',{knownVersion:-1})).status,200);assert.equal((await go('campaign-wait',{knownVersion:-1})).status,200);
  const refused=await go('campaign-wait',{knownVersion:-1});assert.equal(refused.status,429);assert.ok(refused.headers['retry-after']);assert.ok(!busyRetry.test(refused.json.error));
  assert.equal((await go('campaign-typing',{typing:true})).status,200);assert.equal((await go('campaign-typing',{typing:false})).status,429);
  tight.campaigns.live.close();await new Promise(r=>tight.server.close(r));
 }
 // The desktop server passes a held wait through, with more time than the service holds it, and lets it go when the
 // browser leaves.
 const dist=path.join(root,'dist');fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'index.html'),'<h1>Test game</h1>');
 assert.ok(syncTimeout('campaign-wait')>30000&&syncTimeout('poll')===20000&&syncTimeout('campaign-turn')===240000);
 const desktopPort=await freePort(),desktop=createDesktopServer({root:dist,port:desktopPort,syncBackend:'http://127.0.0.1:'+port,feedbackFile:null,metricsFile:null});
 await new Promise(r=>desktop.listen(desktopPort,'127.0.0.1',r));
 const viaDesktop=(who,route,body)=>request(desktopPort,'/api/sync/'+route,{headers:{Host:'localhost:'+desktopPort,Origin:'http://localhost:'+desktopPort,'Content-Type':'application/json',Cookie:'questbound_account='+who.token},body:JSON.stringify({campaignId:table,...body})});
 {
  const seen=(await viaDesktop(b,'poll',{knownVersion:-1})).json;
  const held=viaDesktop(b,'campaign-wait',{knownVersion:seen.version,knownPresence:seen.presence});await sleep(80);
  const typedAt=Date.now();assert.equal((await viaDesktop(a,'campaign-typing',{typing:true})).status,200);const r=await held;
  assert.equal(r.status,200);assert.ok(r.json.players.find(p=>p.name==='Alice').typing);console.log('  desktop server: typing reached the other member '+(Date.now()-typedAt)+' ms after the ping');
  await viaDesktop(a,'campaign-typing',{typing:false});
  const leave=http.request({hostname:'127.0.0.1',port:desktopPort,path:'/api/sync/campaign-wait',method:'POST',headers:{Host:'localhost:'+desktopPort,Origin:'http://localhost:'+desktopPort,'Content-Type':'application/json',Cookie:'questbound_account='+b.token}});leave.on('error',()=>{});
  leave.end(JSON.stringify({campaignId:table,knownVersion:r.json.version,knownPresence:(await viaDesktop(b,'poll',{knownVersion:r.json.version})).json.presence}));
  await sleep(80);assert.equal(C.live.status().open,1);leave.destroy();await sleep(80);assert.equal(C.live.status().open,0,'the desktop server lets the wait go upstream');
 }
 // The share gateway (the HTTPS link through the tunnel): paired, same origin, waits and typing on allowances of their
 // own (so the table allowance is untouched), only so many open waits per browser, and let go when the browser leaves.
 {
  const share=createPhoneServer({host:'127.0.0.1',port:0,root:dist,publicOrigin:'https://quest.example.com',code:'87654321',syncLimit:5,waitLimit:6,typingLimit:3,waitsPerBrowser:2,dataDir:root,alerts:{raise(){}},syncBackend:'http://127.0.0.1:'+port});
  const gp=await listen(share.server);
  const call=(route,{headers={},body}={})=>request(gp,route,{headers:{Host:'quest.example.com',...headers},body});
  const paired=await call('/pair',{headers:{Origin:'https://quest.example.com','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.7'},body:JSON.stringify({code:'87654321'})});assert.equal(paired.status,200);
  const phone=paired.headers['set-cookie'][0].split(';')[0];
  const viaGateway=(who,route,body)=>call('/api/sync/'+route,{headers:{Origin:'https://quest.example.com','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.7',Cookie:phone+'; questbound_account='+who.token},body:JSON.stringify({campaignId:table,...body})});
  const seen=(await viaGateway(b,'poll',{knownVersion:-1})).json;
  let held=viaGateway(b,'campaign-wait',{knownVersion:seen.version,knownPresence:seen.presence});await sleep(80);
  const typedAt=Date.now();assert.equal((await viaGateway(a,'campaign-typing',{typing:true})).status,200);let r=await held;
  assert.equal(r.status,200);assert.ok(r.json.players.find(p=>p.name==='Alice').typing);console.log('  share gateway: typing reached the other member '+(Date.now()-typedAt)+' ms after the ping');
  assert.equal((await viaGateway(a,'campaign-typing',{typing:false})).status,200);
  // Three waits and two pings so far left the table allowance whole (five other requests still go through).
  for(let i=0;i<4;i++)assert.equal((await viaGateway(b,'poll',{knownVersion:r.json.version})).status,200,'waits and typing do not use the table allowance');
  const typingRefused=await viaGateway(a,'campaign-typing',{typing:true});const again=await viaGateway(a,'campaign-typing',{typing:false});
  assert.equal(typingRefused.status,200);assert.equal(again.status,429,'typing has its own allowance');assert.ok(!busyRetry.test(again.json.error));
  // Two open waits from one browser at most.
  await sleep(450);const latest=(await direct(b,'poll',{knownVersion:r.json.version})).json,same={knownVersion:latest.version,knownPresence:latest.presence};
  const tw=Date.now(),w1=viaGateway(b,'campaign-wait',same);await sleep(40);const w2=viaGateway(b,'campaign-wait',same);await sleep(40);
  const third=await viaGateway(b,'campaign-wait',same);
  assert.equal(third.status,429,'only so many held waits per browser');assert.ok(Number(third.headers['retry-after'])>=1);
  for(const held of await Promise.all([w1,w2]))assert.equal(held.status,200);assert.ok(Date.now()-tw>=550,'both held until they ran out');
  // Three waits so far (the refused one is not counted); the allowance (six here) runs out after three more.
  for(let i=0;i<3;i++)assert.equal((await viaGateway(b,'campaign-wait',{knownVersion:-1})).status,200);
  const spent=await viaGateway(b,'campaign-wait',{knownVersion:-1});assert.equal(spent.status,429,'waits have an allowance of their own');assert.ok(!busyRetry.test(spent.json.error));
  assert.equal(share.info.limits.tableWaits,6);assert.equal(share.info.limits.waitsPerBrowser,2);
  await new Promise(r=>share.server.close(r));
 }
 C.live.close();await new Promise(r=>desktop.close(r));service.server.closeAllConnections?.();await new Promise(r=>service.server.close(r));
 // 4. The device (useSharedTable.js): held waits in place of the 2.5 s timer, presence while its own turn resolves (no
 // asking again and again), typing pings, and polling when the server has no wait route.
 {
  const source=fs.readFileSync('useSharedTable.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
  function device({waitRoute=true}={}){
   let slots=[],index=0,effects=[],timers=[],membership={joined:true,name:'Alice',campaignId:'test'},version=1,players=[{id:'seat-a',name:'Al',typing:false},{id:'seat-b',name:'Bo',typing:false}],presence='p1';
   const calls=[],applied=[],quick=[],waits=[],turnGate={current:null};
   const state=(known)=>({campaignId:'test',version,role:'owner',you:'seat-a',players:players.map(p=>({...p})),presence,...(known!==version?{snapshot:{game:{version},health:null}}:{})});
   const useRef=v=>{const i=index++;return slots[i]??(slots[i]={current:v});};
   const useState=v=>{const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];};
   const useEffect=(fn,deps)=>{const i=index++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>slots[i].cleanup=fn());}};
   const use=vm.runInNewContext(source+'\nuseSharedTable',{useRef,useState,useEffect,useCallback:f=>f,tableMembership:()=>membership,setTableMembership:c=>membership={...membership,...c},deviceId:()=>'alice',crypto:require('node:crypto').webcrypto,
    setInterval:f=>{timers.push(f);return f},clearInterval:f=>timers=timers.filter(x=>x!==f),setTimeout,clearTimeout,AbortController,Date,adventureSnapshot:()=>({}),noteProblem:()=>null,
    campaignCall:async(route,body,timeout,signal)=>{calls.push({route,body:JSON.parse(JSON.stringify(body))});
     if(route==='campaign-wait'){if(!waitRoute)throw Object.assign(Error('Not found.'),{status:404});assert.equal(timeout,40000);const w={body,...deferred()};waits.push(w);signal?.addEventListener('abort',()=>w.resolve({aborted:true}));const out=await w.promise;if(out.aborted)throw Object.assign(Error('aborted'),{name:'AbortError'});return out;}
     if(route==='poll')return state(body.knownVersion);
     if(route==='campaign-typing')return {typing:body.typing};
     if(route==='campaign-turn'){if(turnGate.current)await turnGate.current.promise;version++;return state(-1);}
     return {};}});
   const render=()=>{index=0;const value=use({ready:true,hero:{},game:{},health:null,characterChosen:true,applyRemote:async(s,current,options)=>{quick.push(options?.quick===true);if(current())applied.push(s.game.version);}});for(const fn of effects.splice(0))fn();return value;};
   return {render,calls,applied,quick,waits,timers,turnGate,state,set:(v,p,list)=>{if(v!=null)version=v;if(p!=null)presence=p;if(list)players=list;},answer:()=>{const w=waits.find(x=>!x.done);w.done=true;w.resolve(state(w.body.knownVersion));return w;}};
  }
  const settle=async(n=3)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
  const d=device();let t=d.render();await settle();
  assert.equal(d.calls[0].route,'campaign-wait','the device waits on the table, with no 2.5 s timer');assert.equal(d.timers.length,0);
  assert.deepEqual([d.calls[0].body.knownVersion,d.calls[0].body.knownPresence],[-1,'']);
  d.answer();await settle();assert.deepEqual(d.applied,[1]);t=d.render();assert.equal(t.synchronized,true);
  await sleep(300);let w=d.waits.at(-1);assert.equal(d.waits.length,2,'asks again (after a short rest when the answer came at once)');assert.deepEqual([w.body.knownVersion,w.body.knownPresence],[1,'p1'],'asks again with what it has seen');
  // Someone else typing: shown by name, not for this player's own seat.
  d.set(null,'p2',[{id:'seat-a',name:'Al',typing:true},{id:'seat-b',name:'Bo',typing:true}]);d.answer();await settle();await sleep(300);t=d.render();
  assert.deepEqual(t.typers.map(p=>p.name),['Bo']);assert.deepEqual(d.applied,[1],'a presence answer applies no state');
  // Another player's turn kept: pushed and applied.
  d.set(2,'p3',[{id:'seat-a',name:'Al'},{id:'seat-b',name:'Bo',acting:false}]);d.answer();await settle();await sleep(300);assert.deepEqual(d.applied,[1,2]);
  assert.deepEqual(d.quick,[false,true],'the first state waits for its pictures; a live update is applied at once');
  // While this player's own turn resolves, a wait answered with another version is not asked for again and again.
  d.turnGate.current=deferred();const mine=t.turn('I open the door.');await settle();
  d.set(3,'p4');d.answer();await settle();await sleep(300);const asked=d.waits.at(-1);assert.equal(asked.body.knownVersion,3,'a version heard while busy is not asked for again');
  d.turnGate.current.resolve();await mine;await settle();assert.equal(d.applied.at(-1),4,'the turn\'s own answer brings the state');
  const waitsBefore=d.calls.filter(c=>c.route==='campaign-wait').length;await sleep(50);assert.equal(d.calls.filter(c=>c.route==='campaign-wait').length,waitsBefore,'no hot loop');
  // Typing: the first keystroke says so, not again for a few seconds, and an empty box (or sending) says no more.
  t=d.render();t.typed('I');t.typed('I a');t.typed('I ask');
  let pings=d.calls.filter(c=>c.route==='campaign-typing');assert.deepEqual(pings.map(c=>c.body.typing),[true],'one ping, not one per keystroke');
  assert.ok(pings.every(c=>Object.keys(c.body).every(k=>['typing'].includes(k))),'never the words');
  t.typed('');pings=d.calls.filter(c=>c.route==='campaign-typing');assert.deepEqual(pings.map(c=>c.body.typing),[true,false]);
  t.typed('again');await t.turn('again');pings=d.calls.filter(c=>c.route==='campaign-typing');assert.deepEqual(pings.map(c=>c.body.typing),[true,false,true],'sending needs no ping: the table clears typing when the turn begins');
  await t.leave();await settle();
  // A server without the wait route (an older build): the device polls every 2.5 s as before.
  const old=device({waitRoute:false});old.render();await settle();assert.equal(old.timers.length,1,'falls back to the 2.5 s poll');assert.deepEqual(old.applied,[1]);
  old.render().typed('hello');await settle();
 }
 // 5. The play screen shows who is typing above the message box, quietly and on one line, and sends what is typed.
 {
  const dm=fs.readFileSync('DungeonMaster.js','utf8'),styles=fs.readFileSync('dmStyles.js','utf8');
  assert.ok(/useEffect\(\(\)=>\{table\?\.typed\?\.\(input\);\},\[input\]\)/.test(dm),'the message box tells the table');
  assert.ok(/dataSet=\{\{qb:'typing'\}\}/.test(dm)&&/numberOfLines=\{1\} style=\{s\.typingText\}/.test(dm),'one line, cut short');
  assert.ok(/typingText:\{[^}]*color:colors\.muted/.test(styles),'in the theme\'s own colours');
  assert.ok(dm.includes("' is typing…'")&&!/â€/.test(dm),'a real ellipsis');
  for(const file of ['campaign-live.cjs','phone-server.cjs','campaigns.cjs'])assert.ok(!busyRetry.test(fs.readFileSync(file,'utf8').replace(/Please wait before asking\|busy with other players/g,'')),file+' never words a refusal as the busy-DM retry');
 }
 console.log('Live table: held waits answered at once on a new version, presence within a second, as it is after 25 s; typing never stored and lapsing; acting at once; removed members released; caps per member and in all; through the account service, desktop server and share gateway with allowances of their own; the device waits, applies, keeps quiet while its own turn resolves, pings typing sparingly, and polls when the server is older.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearInterval(keepAlive);fs.rmSync(root,{recursive:true,force:true});setTimeout(()=>process.exit(),50).unref();});
