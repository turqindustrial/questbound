// The phone gateway serves exported game files only. The private DM stays on loopback.
// Two modes: home Wi-Fi (the PC's LAN address) and a shared link (loopback only, reached through a secure tunnel
// such as Cloudflare's, so friends elsewhere can play). Both require a pairing code before anything else is served.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const privateIPv4=address=>/^10\./.test(address)||/^192\.168\./.test(address)||/^172\.(1[6-9]|2\d|3[01])\./.test(address);
function phoneAddress(){return Object.values(os.networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal&&privateIPv4(n.address))?.address;}
const pairingPage=shared=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Questbound · ${shared?'Join the game':'Pair phone'}</title><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Questbound"><meta name="theme-color" content="#06080c"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cinzel+Decorative:wght@900&family=EB+Garamond:ital@0;1&family=Inter:wght@400;600&display=swap"><style>*{box-sizing:border-box}body{margin:0;padding:24px;min-height:100dvh;display:grid;place-items:center;color:#f1e6cc;font:16px/1.6 Inter,system-ui,sans-serif;background:radial-gradient(ellipse at 50% 30%,rgba(236,170,84,.16),transparent 55%),radial-gradient(ellipse at 50% 120%,#0c1a26,transparent 60%),#06080c}main{width:100%;max-width:420px;padding:32px 26px;text-align:center;border:1px solid rgba(201,164,92,.45);border-radius:6px;background:linear-gradient(180deg,rgba(20,25,36,.96),rgba(10,13,20,.96));box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,236,190,.08)}.ring{width:84px;height:84px;margin:0 auto 18px;border-radius:50%;border:2px solid #d9ae5f;display:grid;place-items:center;box-shadow:0 0 36px rgba(236,170,84,.35),inset 0 0 20px rgba(236,170,84,.18);font:900 44px 'Cinzel Decorative',Georgia,serif;color:#e8c77b}h1{margin:0;font:900 34px/1.2 'Cinzel Decorative',Georgia,serif;letter-spacing:3px;color:#e8c77b;text-shadow:0 0 24px rgba(236,170,84,.35)}.tag{margin:6px 0 20px;font:italic 18px 'EB Garamond',Georgia,serif;color:#e9dcbd}p{color:#b8bfcc;font-size:15px}label{display:block;margin-top:18px;font:700 12px Cinzel,Georgia,serif;letter-spacing:2.4px;text-transform:uppercase;color:#c9a45c}input,button{font:inherit;width:100%;min-height:52px;border-radius:4px;padding:12px;margin-top:10px}input{background:rgba(4,6,10,.8);color:#fff;border:1px solid rgba(201,164,92,.5);letter-spacing:8px;text-align:center;font-size:22px}input:focus{outline:2px solid #e8c77b;outline-offset:1px}button{background:linear-gradient(180deg,#f0cf85,#c99a4b);color:#2a1a07;border:1px solid #fff0c4;font:700 14px Cinzel,Georgia,serif;letter-spacing:2.4px;text-transform:uppercase;cursor:pointer}button:disabled{opacity:.6}#error{color:#ffb3ac;min-height:1.6em}.note{font-size:13px;color:#8d96a8}</style></head><body><main><div class="ring" aria-hidden="true">Q</div><h1>Questbound</h1><p class="tag">Stories worth rolling for.</p>${shared?'<p>You have been invited to playtest Questbound.</p><p>Enter the eight-digit invite code from the person who shared this link.</p>':'<p>Connect this phone to your game.</p><p>Use the same Wi-Fi as your PC and enter the eight-digit pairing code shown with your Phone link.</p>'}<form id="pair"><label for="code">${shared?'Invite code':'Pairing code'}</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required><button>${shared?'Join and play':'Connect and play'}</button></form><p role="alert" id="error"></p><p class="note">${shared?'The game runs on the host’s PC. If it stops responding, ask them to restart sharing. Your hero and progress are saved in this browser.':'Your PC and Dungeon Master service must stay on. Saves stay in this browser unless you join the shared table under Multiplayer.'}</p></main><script>document.getElementById('pair').addEventListener('submit',async event=>{event.preventDefault();const button=document.querySelector('button');button.disabled=true;document.getElementById('error').textContent='';try{const response=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('code').value})});const body=await response.json();if(!response.ok)throw Error(body.error);location.replace('/');}catch(error){document.getElementById('error').textContent=error.message;button.disabled=false;}});</script></body></html>`;
const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'];
function createPhoneServer({root=path.join(__dirname,'dist-phone'),host,port=8085,publicOrigin=null,pairingHours=24,sessionHours=24,maxSessions=20,dmLimit=null,expiresAt=null,busyWait=60000,sessionStore=null,feedbackFile=null,code=String(crypto.randomInt(10000000,100000000)),now=Date.now,fetchImpl=fetch,backends=['http://127.0.0.1:8084','http://127.0.0.1:8083'],syncBackend='http://127.0.0.1:8086'}={}){
 root=path.resolve(root);
 const shared=publicOrigin?new URL(publicOrigin):null;
 if(shared&&(shared.protocol!=='https:'||shared.pathname!=='/'||shared.search||shared.hash))throw Error('A shared link must be a plain https:// origin.');
 const origin=shared?shared.origin:'http://'+host+':'+port,expectedHost=shared?shared.host:host+':'+port;
 const expires=expiresAt??now()+pairingHours*3600000,sessions=new Map(),attempts=new Map(),failures=[],dmUse=new Map(),feedbackUse=new Map();
 // Paired browsers are remembered by a hash of their cookie (never the cookie itself); with a session store they
 // survive a gateway restart for the same link, so updating the game doesn't send testers back to the invite page.
 const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
 if(sessionStore)try{const saved=JSON.parse(fs.readFileSync(sessionStore,'utf8'));if(saved.origin===origin)for(const [key,until] of Object.entries(saved.sessions??{}))if(/^[a-f0-9]{64}$/.test(key)&&Number.isFinite(until)&&until>now())sessions.set(key,until);}catch{}
 const persist=()=>{if(sessionStore)try{fs.writeFileSync(sessionStore,JSON.stringify({origin,sessions:Object.fromEntries(sessions)}));}catch{}};
 // Built files carry a content hash in their name, so browsers may keep them; text is compressed once and reused.
 const compressed=new Map(),zlib=require('node:zlib');
 const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));};
 const body=async(req,limit)=>{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw Object.assign(Error('Request too large.'),{status:413});}return raw;};
 // Behind the tunnel every request arrives from loopback; the tunnel names the real visitor in CF-Connecting-IP.
 const client=req=>{const address=req.socket.remoteAddress,forwarded=req.headers['cf-connecting-ip'];return shared&&loopback.includes(address)&&typeof forwarded==='string'&&forwarded.length<=64?forwarded:address;};
 async function backend(){for(const url of backends)try{const r=await fetchImpl(url+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).ready)return url;}catch{}return null;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  if(shared)res.setHeader('Strict-Transport-Security','max-age=86400');
  if(req.headers.host!==expectedHost)return json(res,403,{error:shared?'Open the game from the link you were sent.':'Use the Phone link shown on your PC.'});
  if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Open Questbound directly to continue.'});
  try{
   const pathname=new URL(req.url,origin).pathname;
   if(pathname==='/pair'&&req.method==='POST'){
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the pairing form.'});
    const address=client(req),previous=attempts.get(address),entry=previous&&previous.until>now()?previous:{count:0,until:now()+60000};attempts.set(address,entry);
    for(const [key,value] of attempts)if(value.until<=now())attempts.delete(key);
    if(++entry.count>5)return json(res,429,{error:'Too many attempts. Wait a minute before trying again.'});
    // A global brake on wrong codes makes guessing hopeless even from many addresses (at most 50 wrong codes an hour).
    while(failures.length&&failures[0]<=now()-3600000)failures.shift();
    if(failures.length>=50)return json(res,429,{error:'Pairing is paused after many wrong codes. Try again later.'});
    let supplied;try{supplied=JSON.parse(await body(req,256)).code;}catch(e){if(e.status)throw e;return json(res,400,{error:'Enter the eight-digit code.'});}
    if(typeof supplied!=='string'||!/^\d{8}$/.test(supplied)||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(code))||now()>=expires){failures.push(now());return json(res,401,{error:shared?'That invite code is incorrect or expired. Ask the host for the current code.':'That code is incorrect or expired. Use the current code from your PC.'});}
    for(const [key,value] of sessions)if(value<=now())sessions.delete(key);
    if(sessions.size>=maxSessions)return json(res,429,{error:shared?'This game is full. Ask the host to restart sharing.':'Too many paired browsers. Restart phone access on the PC.'});
    const token=crypto.randomBytes(32).toString('hex'),lifetime=sessionHours*3600000;sessions.set(digest(token),now()+lifetime);persist();
    return json(res,200,{paired:true},{'Set-Cookie':'questbound_phone='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+Math.floor(lifetime/1000)+(shared?'; Secure':'')});
   }
   // Install files (manifest and icons) carry no game data; browsers fetch them without the pairing cookie.
   const publicAsset=req.method==='GET'&&(/^\/manifest\.json$/.test(pathname)||/^\/icons\/[a-z0-9-]+\.png$/.test(pathname));
   const cookie=req.headers.cookie?.match(/(?:^|;\s*)questbound_phone=([a-f0-9]{64})(?:;|$)/)?.[1],token=cookie?digest(cookie):null,paired=(sessions.get(token)??0)>now();
   if(!paired&&!publicAsset){if(req.method==='GET'&&pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(pairingPage(!!shared));}return json(res,401,{error:shared?'Open the link you were sent and enter the invite code to continue.':'Reopen your Phone link and pair this browser to continue.'});}
   if(pathname==='/api/health'&&req.method==='GET'){
    const url=await backend();if(!url)return json(res,503,{ready:false,error:shared?'The host’s Dungeon Master is offline right now.':'Start the private Dungeon Master service on your PC.'});
    const response=await fetchImpl(url+'/health',{signal:AbortSignal.timeout(2500)});return json(res,response.status,await response.json());
   }
   if(pathname==='/api/dm'&&req.method==='POST'){
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the Questbound game to contact the Dungeon Master.'});
    const raw=await body(req,64000);
    // A shared link caps each player's Dungeon Master replies (illustration progress checks are free), protecting the host's AI bill.
    if(dmLimit){let mode=null;try{mode=JSON.parse(raw)?.context?.mode??null;}catch{}
     if(mode!=='art'){const recent=(dmUse.get(token)??[]).filter(t=>t>now()-600000);if(recent.length>=dmLimit)return json(res,429,{error:'The Dungeon Master needs a short rest. Try again in a few minutes. Your adventure is unchanged.'});recent.push(now());dmUse.set(token,recent);}}
    const url=await backend();if(!url)return json(res,503,{error:shared?'The host’s Dungeon Master is offline right now.':'Start the private Dungeon Master service on your PC.'});
    // A busy Dungeon Master (another player's turn is being written) refuses before doing any work, so the request is
    // simply retried for up to a minute: players wait their turn instead of seeing an error.
    const forward=()=>fetchImpl(url+'/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:raw,signal:AbortSignal.timeout(90000)});
    const deadline=now()+busyWait;let response=await forward(),reply=await response.json();
    for(let tries=0;response.status===429&&now()<deadline&&tries<100;tries++){await new Promise(resolve=>setTimeout(resolve,700+Math.random()*600));response=await forward();reply=await response.json();}
    return json(res,response.status,reply);
   }
   // Shared table: the same paired, same-origin rules as the DM, forwarded to the loopback table service.
   const syncRoute=pathname.match(/^\/api\/sync\/(poll|save|leave)$/)?.[1];
   if(syncRoute&&req.method==='POST'){
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the Questbound game to reach the shared table.'});
    const raw=await body(req,2500000);let response;
    try{response=await fetchImpl(syncBackend+'/'+syncRoute,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:raw,signal:AbortSignal.timeout(15000)});}
    catch{return json(res,503,{error:'The shared table is not running on the PC.'});}
    return json(res,response.status,await response.json());
   }
   if(pathname==='/api/sync/health'&&req.method==='GET'){try{const r=await fetchImpl(syncBackend+'/health',{signal:AbortSignal.timeout(2500)});return json(res,r.status,await r.json());}catch{return json(res,503,{ready:false});}}
   // Playtest feedback from inside the game lands in a plain notes file on the host's PC.
   if(pathname==='/api/feedback'&&req.method==='POST'){
    if(!feedbackFile)return json(res,404,{error:'Feedback is not collected here.'});
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the Questbound game to send feedback.'});
    const recent=(feedbackUse.get(token)??[]).filter(t=>t>now()-3600000);if(recent.length>=10)return json(res,429,{error:'Thanks! That’s plenty of notes for one hour. Try again a little later.'});
    let note;try{note=JSON.parse(await body(req,8000));}catch(e){if(e.status)throw e;return json(res,400,{error:'That note could not be read.'});}
    const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):'';
    const text=clean(note?.text,2000);if(text.length<2)return json(res,400,{error:'Write a few words first.'});
    const rating=Number.isInteger(note?.rating)&&note.rating>=1&&note.rating<=5?note.rating:null;
    const c=note?.context&&typeof note.context==='object'?note.context:{};
    const heading=[new Date(now()).toISOString().replace('T',' ').slice(0,16)+' UTC',clean(c.player,80),clean(c.hero,120),clean(c.device,160)].filter(Boolean).join(' · ');
    const details=[['Where',clean(c.where,200)],['Screen',clean(c.screen,40)],['Story',clean(c.story,160)]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ');
    const entry='\n## '+heading+'\n'+(rating?'Rating: '+'★'.repeat(rating)+'☆'.repeat(5-rating)+'\n':'')+'\n'+text.split('\n').map(line=>'> '+line).join('\n')+'\n'+(details?'\n'+details+'\n':'');
    try{if(!fs.existsSync(feedbackFile))fs.writeFileSync(feedbackFile,'# Questbound playtest feedback\n\nNotes sent from inside the game by playtesters. Newest at the bottom.\n');fs.appendFileSync(feedbackFile,entry);}catch{return json(res,500,{error:'The host’s PC could not save that note. Please try again.'});}
    recent.push(now());feedbackUse.set(token,recent);
    return json(res,200,{saved:true});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
   const relative=decodeURIComponent(pathname);if(relative.includes('\0')||relative.includes('\\'))return json(res,400,{error:'Invalid path.'});
   const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
   if(!file.startsWith(root+path.sep))return json(res,403,{error:'Not available.'});
   const stat=await fs.promises.stat(file).catch(()=>null);if(!stat?.isFile())return json(res,404,{error:'Not found.'});
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
   const type=types[path.extname(file)]??'application/octet-stream';
   // Files named with a content hash never change, so the browser keeps them (private: the tunnel never caches them).
   const hashed=/^\/(_expo|assets)\//.test(relative)&&/[.-][0-9a-f]{16,}\./.test(path.basename(file));
   if(hashed)res.setHeader('Cache-Control','private, max-age=31536000, immutable');
   const zipped=/^(text\/|application\/json)/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']??'')&&stat.size>1024;
   if(zipped){
    const key=file+':'+stat.mtimeMs+':'+stat.size;let packed=compressed.get(key);
    if(!packed){packed=zlib.gzipSync(await fs.promises.readFile(file),{level:9});compressed.set(key,packed);if(compressed.size>40)compressed.delete(compressed.keys().next().value);}
    res.writeHead(200,{'Content-Type':type,'Content-Encoding':'gzip','Vary':'Accept-Encoding','Content-Length':packed.length});
    return res.end(req.method==='HEAD'?undefined:packed);
   }
   res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size});
   if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch(e){if(!res.headersSent)json(res,e.status??502,{error:e.name==='TimeoutError'?'The PC took too long to respond. Try again.':e.status?e.message:'The phone connection could not complete that request.'});else res.destroy();}
 });
 server.requestTimeout=120000;server.headersTimeout=10000;
 return {server,info:{desktop:'http://localhost:8081/',phone:origin+'/',pairingCode:code,expiresAt:new Date(expires).toISOString()}};
}
if(require.main===module){
 const args=process.argv.slice(2),publicOrigin=args.includes('--public')?args[args.indexOf('--public')+1]:null;
 if(!fs.existsSync(path.join(__dirname,'dist-phone','index.html'))){console.error('Build the game first with npm run build:web.');process.exitCode=1;}
 else if(publicOrigin){
  // Shared link: loopback only, so the secure tunnel is the only way in. The invite lasts a week, and restarting the
  // gateway for the same link keeps the invite code the testers already have.
  const sessionFile=path.join(__dirname,'.questbound-share-session.json');let previous=null;
  try{const saved=JSON.parse(fs.readFileSync(sessionFile,'utf8'));if(saved.link===new URL(publicOrigin).origin+'/'&&/^\d{8}$/.test(saved.inviteCode)&&Date.parse(saved.expiresAt)>Date.now()+3600000)previous=saved;}catch{}
  let created;try{created=createPhoneServer({host:'127.0.0.1',port:8087,publicOrigin,pairingHours:168,sessionHours:168,maxSessions:40,dmLimit:60,sessionStore:path.join(__dirname,'.questbound-share-sessions.json'),feedbackFile:path.join(__dirname,'playtest-feedback.md'),...(previous?{code:previous.inviteCode,expiresAt:Date.parse(previous.expiresAt)}:{})});}catch(e){console.error(e.message);process.exitCode=1;}
  if(created){const {server,info}=created;server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Sharing is already running on port 8087.':e.message);process.exitCode=1;});server.listen(8087,'127.0.0.1',()=>{fs.writeFileSync(sessionFile,JSON.stringify({link:info.phone,inviteCode:info.pairingCode,expiresAt:info.expiresAt,pid:process.pid},null,2));console.log('Shared link: '+info.phone+'\nInvite code: '+info.pairingCode+'\nValid until '+info.expiresAt+'. Keep this PC, the tunnel and the Dungeon Master running.');});}
 }
 else{
  const host=phoneAddress();if(!host){console.error('Connect the PC to Wi-Fi or a private local network first.');process.exitCode=1;}
  else{const {server,info}=createPhoneServer({host,feedbackFile:path.join(__dirname,'playtest-feedback.md')});server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Phone access is already running on port 8085.':e.message);process.exitCode=1;});server.listen(8085,host,()=>{fs.writeFileSync(path.join(__dirname,'.questbound-phone-session.json'),JSON.stringify({...info,pid:process.pid},null,2));console.log('Desktop: '+info.desktop+'\nPhone: '+info.phone+'\nPairing code: '+info.pairingCode+'\nSame Wi-Fi required. Keep this process and the private DM service running. Pairing expires in 24 hours.');});}
 }
}
module.exports={createPhoneServer,phoneAddress};
