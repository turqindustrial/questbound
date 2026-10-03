const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
// Security: what keeps players and the host safe from other websites, from other players and from a leaked link.
// Page policies and headers, loopback services that answer only to this PC, visitors told apart only by headers they
// cannot forge, the guest label the Dungeon Master sees, feedback that cannot forge headings, weak passwords refused,
// and the guests' daily allowance. Nothing here calls the provider.
const {pagePolicy,inlineScriptHashes}=require('./security-headers.cjs');
const {createPhoneServer,networkVerdict}=require('./phone-server.cjs'),{createDesktopServer}=require('./desktop-server.cjs'),{createSyncServer}=require('./sync-server.cjs');
const {createServer}=require('./dm-server.cjs'),{createAccounts,weakPassword}=require('./accounts.cjs'),{createSpending,costOf}=require('./spending.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-security-')),root=path.join(tmp,'dist'),script='window.loaded=1;';
fs.mkdirSync(root);
fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><html><head><script>'+script+'</script><script src="/_expo/app.js" defer></script></head><body></body></html>');
fs.writeFileSync(path.join(root,'privacy.html'),'<!doctype html><title>Privacy</title><style>p{color:red}</style>');
const call=(port,route,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));
const hashOf=text=>"'sha256-"+crypto.createHash('sha256').update(text).digest('base64')+"'";
(async()=>{
 // The page policy: only the game's own scripts (the inline one by its exact hash), never eval, nothing framed, no plugins.
 const policy=pagePolicy(fs.readFileSync(path.join(root,'index.html'),'utf8'));
 assert.ok(policy.includes("script-src 'self' "+hashOf(script)));
 assert.ok(!/unsafe-eval/.test(policy)&&!/script-src[^;]*unsafe-inline/.test(policy),'no eval and no unhashed inline scripts');
 for(const part of ["default-src 'self'","connect-src 'self'","frame-ancestors 'none'","object-src 'none'","base-uri 'none'","form-action 'self'"])assert.ok(policy.includes(part),part);
 assert.equal(JSON.stringify(inlineScriptHashes('<script src="/x.js"></script><script type="module" src=/y.js></script>')),'[]');
 // The built game has no eval the policy would stop (Expo's split-bundle loader is never used: there is one bundle).
 const bundles=fs.existsSync('dist-phone/_expo/static/js/web')?fs.readdirSync('dist-phone/_expo/static/js/web').filter(f=>f.endsWith('.js')):[];
 if(bundles.length)assert.equal(bundles.length,1,'one bundle, so the split-bundle loader (which uses eval) never runs');

 // The Wi-Fi gateway: safe headers everywhere, the pairing page runs only its own script, the game page gets its policy.
 const notes=path.join(tmp,'notes.md');let seen=null;
 const gate=createPhoneServer({host:'127.0.0.1',port:0,root,code:'12345678',feedbackFile:notes,fetchImpl:async(url,options={})=>{if(!url.endsWith('/health'))seen=JSON.parse(options.body);return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>url.endsWith('/health')?{ready:true}:{narration:'Hello.'}};}});
 const gp=await listen(gate.server),H={Host:'127.0.0.1:0'},O='http://127.0.0.1:0';
 try{
  let r=await call(gp,'/',{headers:H});assert.equal(r.status,200);assert.ok(r.text.includes('Pairing code'));
  assert.ok(r.headers['content-security-policy'].includes(hashOf(r.text.match(/<script>([\s\S]*?)<\/script>/)[1])),'the pairing page may run its own script');
  for(const [name,value] of Object.entries({'x-frame-options':'DENY','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'}))assert.equal(r.headers[name],value,name);
  assert.equal(r.headers['cross-origin-opener-policy'],undefined,'not sent over plain http, where browsers ignore it and complain');
  assert.match(r.headers['permissions-policy'],/camera=\(\), microphone=\(\), geolocation=\(\)/);
  r=await call(gp,'/privacy.html',{headers:H});assert.equal(r.status,200);assert.match(r.headers['content-security-policy'],/frame-ancestors 'none'/);
  const paired=await call(gp,'/pair',{method:'POST',headers:{...H,Origin:O,'Content-Type':'application/json'},body:JSON.stringify({code:'12345678'})});
  const cookie=paired.headers['set-cookie'][0].split(';')[0],own={...H,Cookie:cookie,Origin:O,'Content-Type':'application/json'};
  r=await call(gp,'/',{headers:{...H,Cookie:cookie}});assert.ok(r.headers['content-security-policy'].includes(hashOf(script)),'the game page runs its own inline script, by hash');
  // A guest's turn reaches the Dungeon Master labelled by the gateway (never by the browser), the label made from the session.
  r=await call(gp,'/api/dm',{method:'POST',headers:own,body:JSON.stringify({input:'Hi',guest:'ffffffffffffffffffffffffffffffff',context:{choices:[]}})});
  assert.equal(r.status,200);assert.match(seen.guest,/^[a-f0-9]{32}$/);assert.notEqual(seen.guest,'ffffffffffffffffffffffffffffffff');assert.ok(!cookie.includes(seen.guest));
  const label=seen.guest;await call(gp,'/api/dm',{method:'POST',headers:own,body:JSON.stringify({input:'Again',context:{choices:[]}})});assert.equal(seen.guest,label,'the same browser keeps its label');
  // Another website cannot ride on a paired browser's cookie.
  assert.equal((await call(gp,'/api/dm',{method:'POST',headers:{...own,Origin:'https://evil.example'},body:'{}'})).status,403);
  // A feedback note cannot write headings of its own into the host's notes file.
  r=await call(gp,'/api/feedback',{method:'POST',headers:own,body:JSON.stringify({text:'Lovely game.',context:{player:'Ann\n## Not a heading',hero:'Kara\r\n# Nor this'}})});assert.equal(r.status,200);
  const written=fs.readFileSync(notes,'utf8');assert.ok(!/\n#{1,2} (Not a heading|Nor this)/.test(written)&&written.includes('Ann ## Not a heading'),written);
  // On home Wi-Fi a visitor is their own address: a forged CF-Connecting-IP does not escape the hold on wrong codes.
  const guess=ip=>call(gp,'/pair',{method:'POST',headers:{...H,Origin:O,'Content-Type':'application/json','CF-Connecting-IP':ip,'X-Forwarded-For':ip},body:JSON.stringify({code:'00000000'})});
  for(let i=0;i<4;i++)assert.equal((await guess('203.0.113.'+i)).status,401);
  assert.equal((await guess('203.0.113.99')).status,429,'forged headers are ignored on home Wi-Fi');
 }finally{await close(gate.server);}

 // Behind the Cloudflare tunnel only CF-Connecting-IP (which Cloudflare overwrites) names the visitor.
 const share=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://quest.example.com',code:'87654321',fetchImpl:async()=>({ok:false})});
 const sp=await listen(share.server);
 const join=headers=>call(sp,'/pair',{method:'POST',headers:{Host:'quest.example.com',Origin:'https://quest.example.com','Content-Type':'application/json',...headers},body:JSON.stringify({code:'00000000'})});
 try{
  const first=await call(sp,'/',{headers:{Host:'quest.example.com'}});assert.match(first.headers['strict-transport-security'],/max-age=\d{7,}/,'browsers keep to https');assert.equal(first.headers['cross-origin-opener-policy'],'same-origin');
  for(let i=0;i<5;i++)assert.equal((await join({'CF-Connecting-IP':'203.0.113.5','X-Forwarded-For':'10.0.0.'+i,'True-Client-IP':'10.1.1.'+i})).status,401);
  assert.equal((await join({'CF-Connecting-IP':'203.0.113.5','X-Forwarded-For':'10.9.9.9','X-Real-IP':'10.8.8.8'})).status,429,'other headers do not escape the hold');
  assert.equal((await join({'CF-Connecting-IP':'198.51.100.2'})).status,401,'another visitor is not held');
 }finally{await close(share.server);}

 // A hosted gateway trusts the last X-Forwarded-For entry (the one its own proxy added), or the header the host names.
 const hosted=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://play.example',code:'13572468',trustProxy:true,fetchImpl:async()=>({ok:false})});
 const hp=await listen(hosted.server);
 const knock=headers=>call(hp,'/pair',{method:'POST',headers:{Host:'play.example',Origin:'https://play.example','Content-Type':'application/json',...headers},body:JSON.stringify({code:'00000000'})});
 try{
  for(let i=0;i<5;i++)assert.equal((await knock({'X-Forwarded-For':'10.0.0.'+i+', 203.0.113.7','CF-Connecting-IP':'10.2.2.'+i})).status,401);
  assert.equal((await knock({'X-Forwarded-For':'10.9.9.9, 203.0.113.7'})).status,429,'a forged leading entry or CF header does not escape the hold');
  assert.equal((await knock({'X-Forwarded-For':'203.0.113.8'})).status,401,'another visitor is not held');
 }finally{await close(hosted.server);}
 const named=createPhoneServer({host:'127.0.0.1',port:0,root,publicOrigin:'https://play.example',code:'13572468',trustProxy:'Fly-Client-IP',fetchImpl:async()=>({ok:false})});
 const np=await listen(named.server);
 try{
  for(let i=0;i<5;i++)assert.equal((await call(np,'/pair',{method:'POST',headers:{Host:'play.example',Origin:'https://play.example','Content-Type':'application/json','Fly-Client-IP':'203.0.113.9','X-Forwarded-For':'10.0.0.'+i},body:'{"code":"00000000"}'})).status,401);
  assert.equal((await call(np,'/pair',{method:'POST',headers:{Host:'play.example',Origin:'https://play.example','Content-Type':'application/json','Fly-Client-IP':'203.0.113.9','X-Forwarded-For':'10.7.7.7'},body:'{"code":"00000000"}'})).status,429,'only the named header counts');
 }finally{await close(named.server);}

 // The desktop page: the same headers, and a policy that lets the game reach only its own services on this PC.
 const desk=createDesktopServer({root,port:0}),dp=await listen(desk);
 try{
  const r=await call(dp,'/',{headers:{Host:'localhost:0'}});assert.equal(r.status,200);
  const csp=r.headers['content-security-policy'];assert.ok(csp.includes(hashOf(script))&&csp.includes("connect-src 'self' http://localhost:8084 http://localhost:8083 http://localhost:8086"),csp);
  assert.equal(r.headers['x-frame-options'],'DENY');assert.equal(r.headers['cross-origin-opener-policy'],'same-origin');assert.equal((await call(dp,'/',{headers:{Host:'evil.example'}})).status,403);
 }finally{await close(desk);}

 // The table and the Dungeon Master answer only to this PC's own names: a site pointed at this PC (DNS rebinding) is
 // turned away, and another site's origin is refused.
 const {server:table}=createSyncServer({dir:path.join(tmp,'table'),cloudDir:path.join(tmp,'cloud'),accountsDir:path.join(tmp,'accounts')}),yp=await listen(table);
 try{
  assert.equal((await call(yp,'/health',{headers:{Host:'127.0.0.1:'+yp}})).status,200);assert.equal((await call(yp,'/health',{headers:{Host:'localhost:'+yp}})).status,200);
  assert.equal((await call(yp,'/health',{headers:{Host:'rebind.evil.example:'+yp}})).status,403);
  assert.equal((await call(yp,'/poll',{method:'POST',headers:{Host:'127.0.0.1:'+yp,Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
 }finally{await close(table);}
 const dm=createServer({apiKey:'',model:''}),mp=await listen(dm);
 try{
  assert.equal((await call(mp,'/health',{headers:{Host:'127.0.0.1:'+mp}})).status,200);
  assert.equal((await call(mp,'/health',{headers:{Host:'rebind.evil.example:'+mp}})).status,403);
 }finally{await close(dm);}

 // The Wi-Fi link (plain http) starts only at home: a network Windows calls Private, or one the host marked as home.
 assert.equal(networkVerdict({name:'Cafe Free WiFi',category:'Public'},['TheHome']).ok,false,'not on public Wi-Fi');
 assert.equal(networkVerdict({name:'TheHome',category:'Public'},['TheHome']).ok,true,'a network the host marked as home');
 assert.equal(networkVerdict({name:'Office',category:'DomainAuthenticated'},[]).ok,true);assert.equal(networkVerdict({name:'Flat',category:'Private'},[]).ok,true);
 assert.equal(networkVerdict(null,[]).unknown,true,'when Windows cannot say, the link starts with a warning');
 const ps1=fs.readFileSync('launch.ps1','utf8');assert.ok(ps1.includes('[switch]$TrustNetwork')&&ps1.includes('--trust-network'),'the launcher can mark the home network');
 // Passwords guessers try first are refused.
 for(const p of ['password123','Password1','12345678','qwertyuiop','aaaaaaaa','abcdefghij','my-questbound','iloveyou'])assert.ok(weakPassword(p),p);
 assert.ok(weakPassword('ada.lovelace99','ada.lovelace@example.com'),'the name before the @');
 for(const p of ['lantern-wisp-71','copper-kettle-42','made-up-pass'])assert.equal(weakPassword(p,'tester@example.com'),false,p);
 await assert.rejects(createAccounts({dir:path.join(tmp,'weak')}).register('someone@example.com','password123'),/guessers/);

 // The guests' daily allowance, worked out from the usage log as it grows.
 const data=path.join(tmp,'data'),log=path.join(data,'.questbound-usage.jsonl');fs.mkdirSync(data);
 let clock=new Date(2026,9,3,12).getTime();const spend=createSpending({dir:data,now:()=>clock});
 const line=entry=>fs.appendFileSync(log,JSON.stringify({at:new Date(clock).toISOString(),mode:'art',model:'gpt-6-luna',input:0,cached:0,output:0,...entry})+'\n');
 assert.equal(spend.check('g1').ok,true,'nothing spent yet');
 for(let i=0;i<67;i++)line({guest:'g1',images:1});
 assert.match(spend.check('g1').error,/your share/);assert.equal(spend.check('g2').ok,true,'another guest plays on');assert.equal(spend.check(null).ok,true,'the host is never stopped');
 for(let i=0;i<100;i++)line({guest:'g'+(2+i%5),images:1});
 assert.match(spend.check('g9').error,/allowance for the Dungeon Master is used up/);
 const budget=path.join(data,'.questbound-guest-budget');
 fs.writeFileSync(budget,'20\n');assert.equal(spend.check('g9').ok,true,'the host raised the allowance');
 fs.writeFileSync(budget,'off\n');assert.equal(spend.check('g1').ok,true,'or turned it off');
 fs.writeFileSync(budget,'5\n');assert.equal(spend.check('g9').ok,false);
 clock+=86400000;assert.equal(spend.check('g1').ok,true,'a new day, a new allowance');clock-=86400000;
 fs.renameSync(log,log+'.old');line({mode:'turn',guest:'g1',input:100,output:10});assert.equal(spend.check('g1').ok,false,'a rotated log forgets nothing spent today');
 assert.ok(costOf({model:'mystery-model',input:1e6})>costOf({model:'gpt-6-luna',input:1e6}),'an unknown model is priced high on purpose');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Security: page policies and safe headers on every page, loopback services that answer only to this PC, visitors told apart by headers they cannot forge, the Wi-Fi link only at home, the gateway\'s guest label, plain feedback, weak passwords refused and the guests\' daily allowance.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
