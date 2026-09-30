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
const fetchImpl=async(url,options={})=>{calls.push({url,options});if(!online)throw Error('Offline');return {ok:true,status:200,json:async()=>url.endsWith('/health')?{ready:true,actionProtocol:3}:{narration:'A phone reply.',input:JSON.parse(options.body).input}};};
const {server}=createPhoneServer({host:'127.0.0.1',port:0,root,code:'12345678',now:()=>clock,fetchImpl});
const origin='http://127.0.0.1:0';
function request(route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:'127.0.0.1:0',...headers}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});}
const pair=code=>request('/pair',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});
// Shared-link mode: reached only through a secure tunnel that forwards to loopback with the visitor's address.
async function sharedLink(){
 assert.throws(()=>createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'http://insecure.example'}),/https/);
 let now=Date.now();
 const share=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'87654321',pairingHours:168,sessionHours:168,dmLimit:2,now:()=>now,fetchImpl});
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
  // A global brake: after 50 wrong codes in an hour, pairing pauses for everyone, so guessing from many addresses fails.
  for(let i=0;i<50;i++)await join('22222222','192.0.2.'+i);
  assert.equal((await join('87654321','198.51.100.99')).status,429);
  now+=3601000;assert.equal((await join('87654321','198.51.100.99')).status,200,'Pairing resumes after the hour');
  // The invite lasts a week.
  now+=7*86400000;assert.equal((await join('87654321','198.51.100.100')).status,401);
 }finally{await new Promise(resolve=>share.server.close(resolve));}
 // A busy Dungeon Master (one reply at a time) is retried until it answers, and a restarted gateway keeps its invite's expiry.
 let busy=2,dmCalls=0;const until=Date.now()+3*86400000;
 const patient=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'13572468',expiresAt:until,dmLimit:5,fetchImpl:async(url,options={})=>{if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({ready:true})};dmCalls++;return busy-->0?{ok:false,status:429,json:async()=>({error:'Please wait before asking the DM again.'})}:{ok:true,status:200,json:async()=>({narration:'Your turn.'})};}});
 assert.equal(patient.info.expiresAt,new Date(until).toISOString());
 await new Promise(resolve=>patient.server.listen(0,'127.0.0.1',resolve));
 try{
  const hit=(route,opts={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:patient.server.address().port,path:route,method:opts.method??'GET',headers:{Host:'quest.example.com',...opts.headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:t}));});req.on('error',reject);req.end(opts.body);});
  const paired=await hit('/pair',{method:'POST',headers:{Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({code:'13572468'})});assert.equal(paired.status,200);
  const r=await hit('/api/dm',{method:'POST',headers:{Cookie:paired.headers['set-cookie'][0].split(';')[0],Origin:'https://quest.example.com','Content-Type':'application/json'},body:JSON.stringify({input:'Hi',context:{choices:[]}})});
  assert.equal(r.status,200);assert.equal(JSON.parse(r.text).narration,'Your turn.');assert.equal(dmCalls,3,'Two busy replies, then the answer');
 }finally{await new Promise(resolve=>patient.server.close(resolve));}
 // Paired browsers survive a gateway restart (only cookie hashes are stored), built files are cached and compressed,
 // and feedback notes land in the host's file.
 const store=path.join(root,'sessions.json'),notes=path.join(root,'feedback.md'),zlib=require('node:zlib');
 fs.mkdirSync(path.join(root,'_expo','static'),{recursive:true});const bundle='console.log("questbound");'.repeat(200);fs.writeFileSync(path.join(root,'_expo','static','index-0123456789abcdef0123.js'),bundle);
 const open=options=>{const s=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'24681357',sessionStore:store,feedbackFile:notes,fetchImpl,...options});return new Promise(resolve=>s.server.listen(0,'127.0.0.1',()=>resolve(s)));};
 const via=(s,route,opts={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:s.server.address().port,path:route,method:opts.method??'GET',headers:{Host:new URL(opts.origin??'https://quest.example.com').host,...opts.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,raw:Buffer.concat(chunks)}));});req.on('error',reject);req.end(opts.body);});
 let first=await open();let cookieJar;
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
  assert.equal((await send({text:''})).status,400);assert.equal((await send({text:'hi'},'questbound_phone='+'0'.repeat(64))).status,401,'Unpaired browsers cannot send notes');
  for(let i=0;i<9;i++)await send({text:'note '+i});assert.equal((await send({text:'one too many'})).status,429);
 }finally{await new Promise(resolve=>first.server.close(resolve));}
 const second=await open();
 try{assert.equal((await via(second,'/',{headers:{Cookie:cookieJar}})).raw.toString(),'<h1>Test game</h1>','Still paired after a restart');}finally{await new Promise(resolve=>second.server.close(resolve));}
 const moved=await open({publicOrigin:'https://new-link.example.com'});
 try{assert.match((await via(moved,'/',{origin:'https://new-link.example.com',headers:{Cookie:cookieJar}})).raw.toString(),/Invite code/,'A new link starts fresh');}finally{await new Promise(resolve=>moved.server.close(resolve));}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  let r=await request('/');assert.equal(r.status,200);assert.ok(r.text.includes('Pairing code'));assert.ok(!r.text.includes('12345678'));assert.ok(r.text.includes('rel="manifest"'));
  // Install files are public so browsers can install the game; everything else still needs pairing.
  assert.equal((await request('/manifest.json')).text,'{"name":"Questbound"}');assert.equal((await request('/icons/icon-192.png')).status,200);
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
  console.log('Passed: desktop/phone endpoint selection; pairing, cookies, expiry and throttling; host/origin guards; private-file isolation; size limits; offline handling; same-origin health and DM forwarding; shared-link mode (public host only, Secure cookie, per-visitor and global pairing brakes, week-long invite, per-player DM cap that spares illustrations, busy-DM retries, invite and paired browsers kept across gateway restarts, cached and compressed game files, in-game feedback notes).');
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
