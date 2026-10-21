const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createPhoneServer}=require('./phone-server.cjs');
const endpoints=vm.runInNewContext(fs.readFileSync('dmConnection.js','utf8').replace(/export /g,'')+'\n dmEndpoints');
const askDm=vm.runInNewContext(fs.readFileSync('dmConnection.js','utf8').replace(/export /g,'')+'\n askDm',{AbortSignal,Math,JSON,Date});
// The game asks a busy DM again (it refused before doing any work) and gives up after its wait; other errors return at once.
(async()=>{
 let replies=[{status:429,error:'Please wait before asking the DM again.'},{status:429,error:'The Dungeon Master is busy with other players.'},{status:200}],calls=0;
 const fake=async()=>{const r=replies[calls++]??{status:200};return {ok:r.status===200,status:r.status,json:async()=>r.status===200?{narration:'Done.'}:{error:r.error}};};
 let r=await askDm('/api',{input:'x'},{fetchImpl:fake,pause:async()=>{}});assert.equal(r.status,200);assert.equal(calls,3);
 replies=[{status:429,error:'The Dungeon Master needs a short rest.'}];calls=0;r=await askDm('/api',{input:'x'},{fetchImpl:fake,pause:async()=>{}});assert.equal(r.status,429,'A per-player cap is not retried');assert.equal(calls,1);
 let clock=0;replies=Array(50).fill({status:429,error:'Please wait before asking the DM again.'});calls=0;r=await askDm('/api',{input:'x'},{fetchImpl:fake,now:()=>clock,pause:async()=>{clock+=10000;},wait:60000});assert.equal(r.status,429,'Gives up after the wait');assert.ok(calls<=8);
})().catch(e=>{console.error(e);process.exitCode=1;});
assert.equal(endpoints({hostname:'localhost',port:'8081'})[0],'http://localhost:8084');
assert.equal(endpoints({hostname:'10.0.0.169',port:'8085'})[0],'/api');
assert.equal(endpoints({hostname:'example.test',port:''})[0],'/api');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-phone-')),index=path.join(root,'index.html');fs.writeFileSync(index,'<h1>Test game</h1>');
fs.writeFileSync(path.join(root,'manifest.json'),'{"name":"Questbound"}');fs.mkdirSync(path.join(root,'icons'));fs.writeFileSync(path.join(root,'icons','icon-192.png'),'png');fs.mkdirSync(path.join(root,'_expo'));fs.writeFileSync(path.join(root,'_expo','app.js'),'secret-ish');
let clock=Date.now(),online=true,calls=[];
const fetchImpl=async(url,options={})=>{calls.push({url,options});if(!online)throw Error('Offline');if(url.endsWith('/usage'))return {ok:true,status:200,json:async()=>({allowed:true,id:'a'.repeat(64)})};return {ok:true,status:200,headers:{get:()=>null},json:async()=>url.endsWith('/health')?{ready:true,actionProtocol:3}:{narration:'A phone reply.',input:JSON.parse(options.body).input}};};
const {server}=createPhoneServer({host:'127.0.0.1',port:0,root,code:'12345678',now:()=>clock,fetchImpl});
const origin='http://127.0.0.1:0';
function request(route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:'127.0.0.1:0',...headers}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});}
const pair=code=>request('/pair',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});
// Shared-link mode: reached only through a secure tunnel that forwards to loopback with the visitor's address.
async function sharedLink(){
 assert.throws(()=>createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'http://insecure.example'}),/https/);
 let now=Date.now();
 const share=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'87654321',pairingHours:168,sessionHours:168,dmLimit:2,artLimit:3,syncLimit:40,guestsPerBrowser:25,now:()=>now,fetchImpl});
 await new Promise(resolve=>share.server.listen(0,'127.0.0.1',resolve));
 const call=(route,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:share.server.address().port,path:route,method,headers:{Host:'quest.example.com',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
 const join=(code,ip)=>call('/pair',{method:'POST',headers:{Origin:'https://quest.example.com','Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify({code})});
 try{
  let r=await call('/');assert.equal(r.status,200);assert.ok(r.text.includes('Invite code'));assert.ok(!r.text.includes('87654321'));
  assert.equal((await call('/',{headers:{Host:'127.0.0.1:'+share.server.address().port}})).status,403,'Only the shared hostname is served');
  assert.equal((await call('/',{headers:{Origin:'http://quest.example.com'}})).status,403,'Only the https origin is trusted');
  // One visitor's wrong guesses don't lock out another.
  for(let i=0;i<5;i++)assert.equal((await join('11111111','203.0.113.5')).status,401);
  assert.equal((await join('87654321','203.0.113.5')).status,429);
  r=await join('87654321','198.51.100.7');assert.equal(r.status,200);
  const cookie=r.headers['set-cookie'][0];assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('Max-Age=604800'));
  const headers={Cookie:cookie.split(';')[0],Origin:'https://quest.example.com','Content-Type':'application/json'};
  assert.equal((await call('/',{headers})).text,'<h1>Test game</h1>');
  // Each player gets a fair share of the host's DM; illustration progress checks never count.
  const dm=mode=>call('/api/dm',{method:'POST',headers,body:JSON.stringify({input:'Hi',context:{choices:[],...(mode?{mode}:{})}})});
  assert.equal((await dm()).status,200);assert.equal((await dm('art')).status,200);assert.equal((await dm()).status,200);
  assert.equal((await dm()).status,429);assert.equal((await dm('art')).status,200);
  now+=601000;assert.equal((await dm()).status,200,'The cap resets after ten minutes');
  // Illustration checks have an allowance of their own; past it the game is told how long to wait (and waits quietly).
  for(let i=0;i<3;i++)assert.equal((await dm('art')).status,200);
  let limited=await dm('art');assert.equal(limited.status,429);assert.ok(Number(limited.headers['retry-after'])>=1,'says how long to wait');
  assert.doesNotMatch(JSON.parse(limited.text).error,/Please wait before asking|busy with other players/,'not mistaken for a busy DM, which the game would retry at once');
  // The shared table has its own allowance per browser; sign-ups (five an hour) and sign-ins (twenty) are counted per visitor, recovery codes (twenty) per browser.
  const sync=(route,body={})=>call('/api/sync/'+route,{method:'POST',headers,body:JSON.stringify(body)});
  now+=601000;for(let i=0;i<40;i++)assert.equal((await sync('poll',{playerId:'player-one'})).status,200);
  limited=await sync('poll',{playerId:'player-one'});assert.equal(limited.status,429);assert.match(JSON.parse(limited.text).error,/asked too often/);
  now+=601000;for(let i=0;i<5;i++)assert.equal((await sync('account-register',{email:'tester'+i+'@quest.example',password:'made-up-pass'})).status,200);
  limited=await sync('account-register',{email:'tester9@quest.example',password:'made-up-pass'});assert.equal(limited.status,429);assert.match(JSON.parse(limited.text).error,/Too many tries/);
  // Guest identities (while accounts are not required) are handed out at most twenty an hour per visitor.
  now+=601000;for(let i=0;i<20;i++)assert.equal((await sync('account-guest')).status,200);
  limited=await sync('account-guest');assert.equal(limited.status,429);assert.match(JSON.parse(limited.text).error,/Too many tries/);
  now+=601000;for(let i=0;i<20;i++)assert.equal((await sync('cloud-load',{code:'AAAAAAAAAAAA'})).status,200);assert.equal((await sync('cloud-load',{code:'AAAAAAAAAAAA'})).status,429);
  now+=601000;for(let i=0;i<20;i++)assert.equal((await sync('account-login',{email:'tester0@quest.example',password:'made-up-pass'})).status,200);assert.equal((await sync('account-login',{email:'tester0@quest.example',password:'made-up-pass'})).status,429);
  now+=601000;
  // A global brake: after 50 wrong codes in an hour, pairing pauses for everyone, so guessing from many addresses fails.
  for(let i=0;i<50;i++)await join('22222222','192.0.2.'+i);
  assert.equal((await join('87654321','198.51.100.99')).status,429);
  now+=3601000;assert.equal((await join('87654321','198.51.100.99')).status,200,'Pairing resumes after the hour');
  // The invite lasts a week.
  now+=7*86400000;assert.equal((await join('87654321','198.51.100.100')).status,401);
 }finally{await new Promise(resolve=>share.server.close(resolve));}
 // A busy Dungeon Master (one reply at a time) is retried until it answers, and a restarted gateway keeps its invite's expiry.
 let busy=2,dmCalls=0,refuseUsage=false;const until=Date.now()+3*86400000;
 const patient=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'13572468',expiresAt:until,dmLimit:5,fetchImpl:async(url,options={})=>{if(url.endsWith('/usage'))return refuseUsage?{ok:false,status:429,headers:{get:k=>k.toLowerCase()==='retry-after'?'120':null},json:async()=>({error:'Too many tries. Wait a few minutes and try again.'})}:{ok:true,status:200,json:async()=>({allowed:true,id:'a'.repeat(64)})};if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({ready:true})};dmCalls++;return busy-->0?{ok:false,status:429,json:async()=>({error:'Please wait before asking the DM again.'})}:{ok:true,status:200,json:async()=>({narration:'Your turn.'})};}});
 assert.equal(patient.info.expiresAt,new Date(until).toISOString());
 await new Promise(resolve=>patient.server.listen(0,'127.0.0.1',resolve));
 try{
  const hit=(route,opts={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:patient.server.address().port,path:route,method:opts.method??'GET',headers:{Host:'quest.example.com',...opts.headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:t}));});req.on('error',reject);req.end(opts.body);});
  const paired=await hit('/pair',{method:'POST',headers:{Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({code:'13572468'})});assert.equal(paired.status,200);
  const r=await hit('/api/dm',{method:'POST',headers:{Cookie:paired.headers['set-cookie'][0].split(';')[0],Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({input:'Hi',context:{choices:[]}})});
  assert.equal(r.status,200);assert.equal(JSON.parse(r.text).narration,'Your turn.');assert.equal(dmCalls,3,'Two busy replies, then the answer');
  // The account service's own refusal reaches the game with its wait.
  refuseUsage=true;const capped=await hit('/api/dm',{method:'POST',headers:{Cookie:paired.headers['set-cookie'][0].split(';')[0],Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({input:'Hi',context:{choices:[]}})});
  assert.equal(capped.status,429);assert.equal(capped.headers['retry-after'],'120','the wait is passed on');assert.equal(dmCalls,3,'nothing reaches the Dungeon Master');refuseUsage=false;
 }finally{await new Promise(resolve=>patient.server.close(resolve));}
 // A flood from one address is refused before any work, whatever it asks for; a home gateway has limits of its own by default.
 const flood=createPhoneServer({host:'127.0.0.1',port:0,root,code:'11112222',requestLimit:3,fetchImpl});
 assert.deepEqual(flood.info.limits,{turns:120,turnsInAll:600,art:600,table:600,tableWaits:1200,typing:400,waitsPerBrowser:3,waitsInAll:300,requests:3,turnsPerAddress:120,talesPerHour:6,talesPerAddress:10,heroesPerHour:10,heroesPerAddress:20,pairsPerAddress:10,guestsPerBrowser:10,guestsPerAddress:40});
 await new Promise(resolve=>flood.server.listen(0,'127.0.0.1',resolve));
 try{
  const get=()=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:flood.server.address().port,path:'/',headers:{Host:'127.0.0.1:0'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,retry:res.headers['retry-after']}));}).on('error',reject));
  for(let i=0;i<3;i++)assert.equal((await get()).status,200);const refused=await get();assert.equal(refused.status,429);assert.ok(Number(refused.retry)>=1);
 }finally{await new Promise(resolve=>flood.server.close(resolve));}
 // Paired browsers survive a gateway restart (only cookie hashes are stored), built files are cached and compressed,
 // and feedback notes land in the host's file.
 const store=path.join(root,'sessions.json'),notes=path.join(root,'feedback.md'),zlib=require('node:zlib');
 fs.mkdirSync(path.join(root,'_expo','static'),{recursive:true});const bundle='console.log("questbound");'.repeat(200);fs.writeFileSync(path.join(root,'_expo','static','index-0123456789abcdef0123.js'),bundle);
 const open=options=>{const s=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'24681357',sessionStore:store,feedbackFile:notes,fetchImpl,...options});return new Promise(resolve=>s.server.listen(0,'127.0.0.1',()=>resolve(s)));};
 const via=(s,route,opts={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:s.server.address().port,path:route,method:opts.method??'GET',headers:{Host:new URL(opts.origin??'https://quest.example.com').host,...opts.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,raw:Buffer.concat(chunks)}));});req.on('error',reject);req.end(opts.body);});
 const mailed=[];let first=await open({mailer:{feedback:async text=>{mailed.push(text);}}});let cookieJar;
 try{
  const joined=await via(first,'/pair',{method:'POST',headers:{Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({code:'24681357'})});cookieJar=joined.headers['set-cookie'][0].split(';')[0];
  assert.ok(!fs.readFileSync(store,'utf8').includes(cookieJar.split('=')[1]),'The raw cookie is never stored');
  const index=await via(first,'/',{headers:{Cookie:cookieJar}});assert.equal(index.headers['cache-control'],'no-store');
  const js=await via(first,'/_expo/static/index-0123456789abcdef0123.js',{headers:{Cookie:cookieJar,'Accept-Encoding':'gzip, br'}});
  assert.match(js.headers['cache-control'],/immutable/);assert.equal(js.headers['content-encoding'],'gzip');assert.equal(zlib.gunzipSync(js.raw).toString(),bundle);assert.ok(js.raw.length<bundle.length/5,'Compressed');
  const plain=await via(first,'/_expo/static/index-0123456789abcdef0123.js',{headers:{Cookie:cookieJar}});assert.equal(plain.headers['content-encoding'],undefined);assert.equal(plain.raw.toString(),bundle);
  const send=(body,cookie=cookieJar)=>via(first,'/api/feedback',{method:'POST',headers:{Cookie:cookie,Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await send({text:'Loved the bandit fight!\nThe map was confusing.',rating:4,context:{player:'Sam',hero:'Brenna (Level 2 Fighter)',device:'Pixel 8 · Chrome',where:'Overgrown Roadside, in combat',screen:'Adventure'}})).status,200);
  const saved=fs.readFileSync(notes,'utf8');assert.match(saved,/Loved the bandit fight/);assert.match(saved,/★★★★☆/);assert.match(saved,/Sam · Brenna/);assert.match(saved,/> The map was confusing/);
  assert.equal(typeof mailed[0],'string','the mailed note is the readable entry, not an object');assert.match(mailed[0],/Loved the bandit fight/);assert.match(mailed[0],/Sam · Brenna/);
  // A note with its details: the readable file gets the build, stage and problem lines, the record the guest label
  // (never the cookie), and a note too large for the limit is refused.
  const details={build:'a1b2c3d4',game:{stage:'combat'},problems:[{kind:'refused',said:'I cast Detect Magic',error:'Not prepared'}],recent:[{said:'I look around',rulings:['Perception d20 [9] + 2 = 11'],narration:'Dust.'}],padding:Array.from({length:30},()=>'p'.repeat(550))};
  assert.ok(JSON.stringify(details).length>16000&&JSON.stringify(details).length<30000);
  assert.equal((await send({text:'Detect Magic would not cast',context:{player:'Sam'},details})).status,200,'a 20 KB note is taken');
  assert.equal((await send({text:'too big',details:{padding:'q'.repeat(40000)}})).status,413);
  const withDetails=fs.readFileSync(notes,'utf8');assert.match(withDetails,/\nBuild: a1b2c3d4 · Stage: combat/);assert.match(withDetails,/\nProblem \(refused\): I cast Detect Magic → Not prepared/);assert.match(withDetails,/\nLast turn: I look around → Perception/);
  const records=fs.readFileSync(path.join(root,'feedback.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(records.length,2);assert.equal(records[1].guest,'account-'+'a'.repeat(64),'the record names a signed-in player by the account label their Dungeon Master turns carry');
  const cookieToken=cookieJar.split('=')[1];assert.ok(!fs.readFileSync(path.join(root,'feedback.jsonl'),'utf8').includes(cookieToken),'never the cookie');
  assert.equal((await send({text:''})).status,400);assert.equal((await send({text:'hi'},'questbound_phone='+'0'.repeat(64))).status,401,'Unpaired browsers cannot send notes');
  for(let i=0;i<8;i++)await send({text:'note '+i});assert.equal((await send({text:'one too many'})).status,429);
 }finally{await new Promise(resolve=>first.server.close(resolve));}
 const second=await open();
 try{assert.equal((await via(second,'/',{headers:{Cookie:cookieJar}})).raw.toString(),'<h1>Test game</h1>','Still paired after a restart');}finally{await new Promise(resolve=>second.server.close(resolve));}
 const moved=await open({publicOrigin:'https://new-link.example.com'});
 try{assert.match((await via(moved,'/',{origin:'https://new-link.example.com',headers:{Cookie:cookieJar}})).raw.toString(),/Invite code/,'A new link starts fresh');}finally{await new Promise(resolve=>moved.server.close(resolve));}
}
// What keeps one visitor from running up the host's bill at the gateway (2026-10-13): turns counted per address too, new
// tales and drafted heroes per browser and per address, pairings and guest identities per address and per browser,
// requests the game never sends refused before anything else, the host's pause switch (no restart), and an alert when
// one address is refused again and again.
async function guardedGateway(){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-guarded-')),raised=[];let now=Date.now();const asked=[];
 const fake=async(url,options={})=>{asked.push(url);if(url.endsWith('/usage'))return {ok:true,status:200,headers:{get:()=>null},json:async()=>({allowed:true,id:'b'.repeat(64)})};if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({ready:true,actionProtocol:3})};return {ok:true,status:200,headers:{get:()=>null},json:async()=>({done:true})};};
 const gate=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'31415926',dmLimit:50,addressTurns:4,taleLimit:2,taleAddress:3,heroLimit:1,heroAddress:5,pairsPerAddress:3,guestsPerBrowser:2,guestsPerAddress:5,floodAlert:6,dataDir,alerts:{raise:(kind,text,o)=>{raised.push({kind,text,event:o?.event});return true;}},now:()=>now,fetchImpl:fake});
 await new Promise(resolve=>gate.server.listen(0,'127.0.0.1',resolve));
 const call=(route,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:gate.server.address().port,path:route,method,headers:{Host:'quest.example.com',...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
 const join=ip=>call('/pair',{method:'POST',headers:{Origin:'https://quest.example.com','Content-Type':'application/json','CF-Connecting-IP':ip},body:JSON.stringify({code:'31415926'})});
 const as=(cookie,ip)=>({Cookie:cookie,Origin:'https://quest.example.com','Content-Type':'application/json','CF-Connecting-IP':ip});
 const dm=(who,context={},input='Hi')=>call('/api/dm',{method:'POST',headers:who,body:JSON.stringify({input,context:{choices:[],...context}})});
 const error=r=>JSON.parse(r.text).error;
 try{
  // One address may pair three browsers a day; another address is not affected.
  const cookies=[];for(let i=0;i<3;i++){const r=await join('203.0.113.9');assert.equal(r.status,200);cookies.push(r.headers['set-cookie'][0].split(';')[0]);}
  let r=await join('203.0.113.9');assert.equal(r.status,429);assert.match(error(r),/Many browsers have joined/);
  const other=(await join('198.51.100.20')).headers['set-cookie'][0].split(';')[0];
  const a=as(cookies[0],'203.0.113.9'),b=as(cookies[1],'203.0.113.9'),c=as(other,'198.51.100.20');
  // What the game never sends is refused before anything else (the account service is not even asked).
  const before=asked.length;
  for(const bad of [{mode:'diagnostics'},{mode:'cheap-trick'},{mode:'adventure',idea:'x'.repeat(301)},{mode:'adventure',idea:42}])assert.equal((await dm(a,bad)).status,400,JSON.stringify(bad).slice(0,40));
  assert.equal((await dm(a,{},'x'.repeat(1001))).status,400,'words longer than the message box');
  assert.equal(asked.length,before,'refused cheaply');
  // Turns are counted per address as well: two browsers at one address share four turns in ten minutes; the other address plays on.
  for(let i=0;i<2;i++){assert.equal((await dm(a)).status,200);assert.equal((await dm(b)).status,200);}
  r=await dm(b);assert.equal(r.status,429);assert.doesNotMatch(error(r),/Please wait before asking|busy with other players/);
  assert.equal((await dm(c)).status,200,'another address keeps its own turns');
  // Shared-table turns are Dungeon Master turns too.
  r=await call('/api/sync/campaign-turn',{method:'POST',headers:a,body:JSON.stringify({campaignId:'x'})});assert.equal(r.status,429);
  now+=601000;
  // New tales: two an hour per browser and three per address; drafted heroes one an hour per browser.
  assert.equal((await dm(a,{mode:'adventure',introId:'crown'})).status,200);assert.equal((await dm(a,{mode:'adventure',introId:'crown'})).status,200);
  r=await dm(a,{mode:'adventure',introId:'crown'});assert.equal(r.status,429);assert.match(error(r),/several new tales/);assert.ok(Number(r.headers['retry-after'])>=1);
  now+=601000;assert.equal((await dm(b,{mode:'adventure',introId:'easy'})).status,200,'the third tale at this address');
  assert.equal((await dm(b,{mode:'adventure',introId:'easy'})).status,429,'the address has had its three');
  assert.equal((await dm(c,{mode:'adventure',introId:'easy'})).status,200);
  assert.equal((await dm(c,{mode:'character'})).status,200);r=await dm(c,{mode:'character'});assert.equal(r.status,429);assert.match(error(r),/heroes have been drafted/);
  // Guest identities: two a day per browser, five a day per address.
  now+=601000;
  const guest=who=>call('/api/sync/account-guest',{method:'POST',headers:who,body:'{}'});
  assert.equal((await guest(a)).status,200);assert.equal((await guest(a)).status,200);assert.equal((await guest(a)).status,429,'two a day per browser');
  assert.equal((await guest(b)).status,200);assert.equal((await guest(b)).status,200);
  const third=as(cookies[2],'203.0.113.9');assert.equal((await guest(third)).status,200);assert.equal((await guest(third)).status,429,'five a day per address');
  // The pause switch: a file the launcher writes; no restart. Pictures and finished tales are still handed over.
  now+=3601000;
  fs.writeFileSync(path.join(dataDir,'.questbound-guests-paused'),'Paused by the host');
  r=await dm(c);assert.equal(r.status,503);assert.match(error(r),/paused by the host/);assert.doesNotMatch(error(r),/Please wait before asking|busy with other players/);
  assert.equal((await dm(c,{mode:'adventure',introId:'crown'})).status,503);
  assert.equal((await dm(c,{mode:'art',storyJob:'abcdefghijklmnop'})).status,200,'a tale already written can still be collected');
  assert.equal((await call('/api/sync/campaign-turn',{method:'POST',headers:c,body:'{}'})).status,503,'and no shared-table turn');
  fs.rmSync(path.join(dataDir,'.questbound-guests-paused'));assert.equal((await dm(c)).status,200,'resumed at once');
  // One address refused again and again: the host is told once, without the address.
  for(let i=0;i<8;i++)await dm(b,{mode:'adventure',introId:'crown'});
  const flood=raised.filter(x=>x.kind==='address-flood');assert.ok(flood.length>=1);assert.equal(flood[0].event,'flood-alert');assert.ok(!flood.some(x=>x.text.includes('203.0.113')),'never the address itself');
  assert.equal(gate.info.limits.turnsPerAddress,4);assert.equal(gate.info.limits.talesPerHour,2);
 }finally{await new Promise(resolve=>gate.server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  let r=await request('/');assert.equal(r.status,200);assert.ok(r.text.includes('Pairing code'));assert.ok(!r.text.includes('12345678'));assert.ok(r.text.includes('rel="manifest"'));
  // Install files are public so browsers can install the game; everything else still needs pairing.
  assert.equal((await request('/manifest.json')).text,'{"name":"Questbound"}');assert.equal((await request('/icons/icon-192.png')).status,200);assert.equal((await request('/favicon.ico')).status,404,'the tab icon is public too (not built in this test folder)');
  assert.equal((await request('/_expo/app.js')).status,401);assert.equal((await request('/icons/../_expo/app.js')).status,401);assert.equal((await request('/manifest.json',{method:'POST'})).status,401);
  assert.equal((await request('/api/health')).status,401);assert.equal(calls.length,0);
  assert.equal((await request('/',{headers:{Host:'evil.test:0'}})).status,403);
  assert.equal((await request('/',{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await pair('00000000')).status,401);assert.equal((await pair('éééééééé')).status,401);
  r=await pair('12345678');assert.equal(r.status,200);const cookie=r.headers['set-cookie'][0];assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Strict'));
  const headers={Cookie:cookie.split(';')[0],Origin:origin,'Content-Type':'application/json'};
  assert.equal((await request('/',{headers})).text,'<h1>Test game</h1>');
  assert.equal((await request('/api/health',{headers})).status,200);
  r=await request('/api/dm',{method:'POST',headers,body:JSON.stringify({input:'Hello',context:{choices:[]}})});assert.equal(r.status,200);assert.equal(JSON.parse(r.text).input,'Hello');
  assert.equal(calls.at(-1).options.headers.Origin,'http://localhost:8081');assert.equal(calls.at(-1).options.headers.Cookie,undefined);
  assert.equal((await request('/api/dm',{method:'POST',headers:{...headers,Origin:'http://evil.test'},body:'{}'})).status,403);
  assert.equal((await request('/api/dm',{method:'POST',headers,body:'x'.repeat(65000)})).status,413);
  for(const route of ['/.questbound-phone-session.json','/start-dm.ps1','/../phone-server.cjs','/%2e%2e%5cphone-server.cjs'])assert.ok([400,403,404].includes((await request(route,{headers})).status));
  online=false;assert.equal((await request('/api/health',{headers})).status,503);online=true;
  clock+=61000;for(let i=0;i<5;i++)assert.equal((await pair('00000000')).status,401);assert.equal((await pair('12345678')).status,429);
  clock+=86400000;assert.equal((await request('/api/health',{headers})).status,401);assert.equal((await pair('12345678')).status,401);
  await sharedLink();
  await guardedGateway();
  console.log('Passed: desktop/phone endpoint selection; pairing, cookies, expiry and throttling; host/origin guards; private-file isolation; size limits; offline handling; same-origin health and DM forwarding; shared-link mode (public host only, Secure cookie, per-visitor and global pairing brakes, week-long invite, per-player DM cap with separate allowances for illustrations, the shared table, sign-ups, sign-ins and recovery codes, a per-address flood brake, busy-DM retries, invite and paired browsers kept across gateway restarts, cached and compressed game files, in-game feedback notes).');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
