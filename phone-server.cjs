// The phone gateway serves exported game files only. The private DM stays on loopback.
// Two modes: home Wi-Fi (the PC's LAN address) and a shared link (loopback only, reached through a secure tunnel
// such as Cloudflare's, so friends elsewhere can play). Both require a pairing code before anything else is served.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const privateIPv4=address=>/^10\./.test(address)||/^192\.168\./.test(address)||/^172\.(1[6-9]|2\d|3[01])\./.test(address);
function phoneAddress(){return Object.values(os.networkInterfaces()).flat().find(n=>n.family==='IPv4'&&!n.internal&&privateIPv4(n.address))?.address;}
const corner=t=>"url(\"data:image/svg+xml,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34' fill='none' stroke='#c4344e' stroke-width='1.1' stroke-linecap='round'><g transform='${t}'><path d='M1.5 20V7A5.5 5.5 0 0 1 7 1.5h13'/><path d='M6 14V9.2A3.2 3.2 0 0 1 9.2 6H14' stroke-opacity='.55'/><path d='M10.5 8.8 12.2 10.5 10.5 12.2 8.8 10.5Z' fill='#b08cf5' stroke='none'/></g></svg>`)+"\")",corners=[corner('')+' top left',corner('translate(34 0) scale(-1 1)')+' top right',corner('translate(0 34) scale(1 -1)')+' bottom left',corner('translate(34 34) scale(-1 -1)')+' bottom right'].map(c=>c+'/34px 34px no-repeat').join(',');
// The invite (or pairing) page, styled like the game's own launch screen: a turning crimson seal, a framed card and
// light shafts. It only shows until the browser is paired.
const pairingPage=shared=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Questbound · ${shared?'Join the game':'Pair phone'}</title><link rel="manifest" href="/manifest.json"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png?v=2"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=2"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Questbound"><meta name="theme-color" content="#08060a"><link rel="stylesheet" href="/fonts/fonts.css"><style>*{box-sizing:border-box}html{background:#08060a}body{margin:0;padding:24px;min-height:100dvh;display:grid;place-items:center;overflow-x:hidden;color:#f4ecee;font:16px/1.6 Inter,system-ui,sans-serif;background:radial-gradient(ellipse 60% 45% at 50% 30%,rgba(200,40,70,.2),transparent 70%),radial-gradient(ellipse 120% 80% at 50% 115%,rgba(110,60,200,.18),transparent 70%),#08060a}body::before{content:"";position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(112deg,transparent 38%,rgba(206,150,255,.07) 44%,transparent 51%),linear-gradient(121deg,transparent 22%,rgba(206,150,255,.045) 27%,transparent 33%);animation:rays 16s ease-in-out infinite alternate}@keyframes rays{from{opacity:.5;transform:translateX(-3%)}to{opacity:1;transform:translateX(3%)}}main{position:relative;width:100%;max-width:430px;padding:34px 28px 28px;text-align:center;border:1px solid rgba(178,34,58,.6);border-radius:6px;background:linear-gradient(180deg,rgba(30,22,32,.96),rgba(14,10,15,.97));box-shadow:0 0 0 1px rgba(0,0,0,.7),inset 0 0 0 5px rgba(12,8,13,.85),inset 0 0 0 6px rgba(178,34,58,.2),0 40px 100px rgba(0,0,0,.7),0 0 120px rgba(140,82,255,.12);animation:pop .6s cubic-bezier(.2,.8,.2,1) both}main::before{content:"";position:absolute;inset:3px;pointer-events:none;opacity:.9;background:${corners}}main::after{content:"";position:absolute;top:-5px;left:50%;width:9px;height:9px;margin-left:-5px;transform:rotate(45deg);background:linear-gradient(135deg,#eadaff,#7a4fd6);box-shadow:0 0 12px rgba(160,110,255,.7)}@keyframes pop{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}.seal{position:relative;width:118px;height:118px;margin:0 auto 18px;display:grid;place-items:center}.bezel{position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(196,52,78,.8) 0deg 1.2deg,transparent 1.2deg 7.5deg);-webkit-mask:radial-gradient(circle,transparent 53px,#000 54px,#000 58px,transparent 59px);mask:radial-gradient(circle,transparent 53px,#000 54px,#000 58px,transparent 59px);animation:turn 30s linear infinite}@keyframes turn{to{transform:rotate(360deg)}}.ring{width:88px;height:88px;border-radius:50%;border:2px solid #b2223a;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,rgba(48,26,78,.6),rgba(14,10,14,.95) 70%);box-shadow:0 0 40px rgba(230,48,82,.38),inset 0 0 26px rgba(140,82,255,.2)}.gold{background:linear-gradient(180deg,#ffe1e5 0%,#ff5a72 34%,#a3162c 62%,#e23a55 82%,#ff97a6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 rgba(20,4,8,.9)) drop-shadow(0 0 22px rgba(230,48,82,.35))}.ring span{font:900 46px/1 'Cinzel Decorative',Georgia,serif}h1{margin:0;font:900 34px/1.2 'Cinzel Decorative',Georgia,serif;letter-spacing:3px}.tag{margin:6px 0 18px;font:italic 18px 'EB Garamond',Georgia,serif;color:#decfc8}.rule{display:flex;align-items:center;gap:8px;width:70%;margin:0 auto 14px}.rule i{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(196,52,78,.8))}.rule i:last-child{background:linear-gradient(90deg,rgba(196,52,78,.8),transparent)}.rule b{width:7px;height:7px;transform:rotate(45deg);background:#e04a5c}p{color:#b9aeb6;font-size:15px;margin:10px 0}label{display:block;margin-top:18px;font:700 12px Cinzel,Georgia,serif;letter-spacing:2.4px;text-transform:uppercase;color:#b08cf5}input,button{font:inherit;width:100%;min-height:54px;border-radius:4px;padding:12px;margin-top:10px}input{background:rgba(8,5,9,.85);color:#fff;border:1px solid rgba(178,34,58,.6);letter-spacing:10px;text-align:center;font:600 24px Inter,system-ui,sans-serif;box-shadow:inset 0 2px 10px rgba(0,0,0,.55)}input:focus{outline:none;border-color:rgba(190,150,255,.9);box-shadow:inset 0 2px 10px rgba(0,0,0,.55),0 0 0 3px rgba(140,82,255,.2),0 0 24px rgba(140,82,255,.2)}button{position:relative;overflow:hidden;background:linear-gradient(180deg,#c92f49 0%,#a51a33 40%,#7c1227 76%,#5e0d1e 100%);color:#ffeef0;border:1px solid #f06e80;font:700 14px Cinzel,Georgia,serif;letter-spacing:2.4px;text-transform:uppercase;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,200,210,.5),inset 0 -2px 0 rgba(40,4,12,.55),0 10px 30px rgba(140,82,255,.3)}button::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,210,220,.3),transparent);transform:skewX(-18deg);animation:shine 5.5s ease-in-out infinite}@keyframes shine{0%,70%{left:-60%}100%{left:130%}}button:hover{filter:brightness(1.08)}button:disabled{opacity:.6}#error{color:#ffb3ac;min-height:1.6em}.note{font-size:13px;color:#8a7f8a}.note a{color:#b08cf5}@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}}</style></head><body><main><div class="seal" aria-hidden="true"><div class="bezel"></div><div class="ring"><span class="gold">Q</span></div></div><h1 class="gold">Questbound</h1><p class="tag">Stories worth rolling for.</p><div class="rule" aria-hidden="true"><i></i><b></b><i></i></div>${shared?'<p>You have been invited to playtest Questbound.</p><p>Enter the eight-digit invite code from the person who shared this link.</p>':'<p>Connect this phone to your game.</p><p>Use the same Wi-Fi as your PC and enter the eight-digit pairing code shown with your Phone link.</p>'}<form id="pair"><label for="code">${shared?'Invite code':'Pairing code'}</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required><button>${shared?'Join and play':'Connect and play'}</button></form><p role="alert" id="error"></p><p class="note">${shared?'The game runs on the host’s PC. If it stops responding, ask them to restart sharing. Your hero and progress are saved in this browser.':'Your PC and Dungeon Master service must stay on. Saves stay in this browser unless you join the shared table under Multiplayer.'}</p><p class="note"><a href="/privacy.html">Privacy policy</a> · <a href="/terms.html">Terms of use</a> · <a href="/permissions.html">Permissions</a></p></main><script>document.getElementById('pair').addEventListener('submit',async event=>{event.preventDefault();const button=document.querySelector('button');button.disabled=true;document.getElementById('error').textContent='';try{const response=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('code').value})});const body=await response.json();if(!response.ok)throw Error(body.error);location.replace('/');}catch(error){document.getElementById('error').textContent=error.message;button.disabled=false;}});</script></body></html>`;
const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'];
function createPhoneServer({root=path.join(__dirname,'dist-phone'),host,port=8085,publicOrigin=null,pairingHours=24,sessionHours=24,maxSessions=20,dmLimit=120,dmTotal=600,artLimit=600,syncLimit=600,requestLimit=3000,trustProxy=false,expiresAt=null,busyWait=60000,sessionStore=null,feedbackFile=null,code=String(crypto.randomInt(10000000,100000000)),now=Date.now,fetchImpl=fetch,backends=['http://127.0.0.1:8084','http://127.0.0.1:8083'],syncBackend='http://127.0.0.1:8086'}={}){
 root=path.resolve(root);
 const shared=publicOrigin?new URL(publicOrigin):null;
 if(shared&&(shared.protocol!=='https:'||shared.pathname!=='/'||shared.search||shared.hash))throw Error('A shared link must be a plain https:// origin.');
 const origin=shared?shared.origin:'http://'+host+':'+port,expectedHost=shared?shared.host:host+':'+port;
 const expires=expiresAt??now()+pairingHours*3600000,sessions=new Map(),attempts=new Map(),failures=[],feedbackUse=new Map();
 // Paired browsers are remembered by a hash of their cookie (never the cookie itself); with a session store they
 // survive a gateway restart for the same link, so updating the game doesn't send testers back to the invite page.
 const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
 if(sessionStore)try{const saved=JSON.parse(fs.readFileSync(sessionStore,'utf8'));if(saved.origin===origin)for(const [key,until] of Object.entries(saved.sessions??{}))if(/^[a-f0-9]{64}$/.test(key)&&Number.isFinite(until)&&until>now())sessions.set(key,until);}catch{}
 const persist=()=>{if(sessionStore)try{fs.writeFileSync(sessionStore,JSON.stringify({origin,sessions:Object.fromEntries(sessions)}));}catch{}};
 // Built files carry a content hash in their name, so browsers may keep them; text is compressed once and reused.
 const compressed=new Map(),zlib=require('node:zlib');
 const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));};
 const body=async(req,limit)=>{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw Object.assign(Error('Request too large.'),{status:413});}return raw;};
 // Request limits, counted in memory within a sliding window per paired browser (its cookie hash) or per visitor
 // address: a limiter answers 0 when the request may go ahead, else the seconds to wait (sent as Retry-After). Turns are
 // the host's AI bill (per browser and for the gateway as a whole); illustration and story checks, the shared table,
 // sign-ups, sign-ins, recovery codes and passwords each have their own allowance; and a flood of anything is refused.
 const limiter=(max,span)=>{const hits=new Map();return key=>{if(!max)return 0;const t=now();let recent=hits.get(key);if(!recent){recent=[];hits.set(key,recent);}while(recent.length&&recent[0]<=t-span)recent.shift();if(hits.size>4000)for(const [k,v] of hits)if(!v.length)hits.delete(k);if(recent.length>=max)return Math.max(1,Math.ceil((recent[0]+span-t)/1000));recent.push(t);return 0;};};
 const wait=(res,seconds,error)=>json(res,429,{error},{'Retry-After':String(seconds)});
 const limits={every:limiter(requestLimit,600000),turns:limiter(dmLimit,600000),allTurns:limiter(dmTotal,600000),art:limiter(artLimit,600000),sync:limiter(syncLimit,600000),register:limiter(5,3600000),login:limiter(20,600000),recover:limiter(20,600000),password:limiter(10,600000)};
 // Behind the tunnel every request arrives from loopback and the tunnel names the real visitor in CF-Connecting-IP; a
 // hosted gateway behind its platform's proxy (trustProxy, serve.cjs) reads the proxy's header for the same reason.
 const client=req=>{const address=req.socket.remoteAddress,h=req.headers,forwarded=h['cf-connecting-ip']??h['fly-client-ip']??h['true-client-ip']??h['x-real-ip']??String(h['x-forwarded-for']??'').split(',')[0].trim();return (trustProxy||(shared&&loopback.includes(address)))&&typeof forwarded==='string'&&forwarded.length>0&&forwarded.length<=64?forwarded:address;};
 async function backend(){for(const url of backends)try{const r=await fetchImpl(url+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).ready)return url;}catch{}return null;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  if(shared)res.setHeader('Strict-Transport-Security','max-age=86400');
  if(req.headers.host!==expectedHost)return json(res,403,{error:shared?'Open the game from the link you were sent.':'Use the Phone link shown on your PC.'});
  if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Open Questbound directly to continue.'});
  // A flood from one address is refused before any work (3000 requests in ten minutes is five a second).
  {const seconds=limits.every(String(client(req)??''));if(seconds)return wait(res,seconds,'Too many requests from your connection. Try again in a moment.');}
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
   const publicAsset=req.method==='GET'&&(/^\/manifest\.json$/.test(pathname)||/^\/icons\/[a-z0-9-]+\.png$/.test(pathname)||/^\/(privacy|terms|permissions)\.html$/.test(pathname)||/^\/fonts\/[a-z0-9-]+\.(woff2|css|txt)$/.test(pathname));
   const cookie=req.headers.cookie?.match(/(?:^|;\s*)questbound_phone=([a-f0-9]{64})(?:;|$)/)?.[1],token=cookie?digest(cookie):null,paired=(sessions.get(token)??0)>now();
   if(!paired&&!publicAsset){if(req.method==='GET'&&pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(pairingPage(!!shared));}return json(res,401,{error:shared?'Open the link you were sent and enter the invite code to continue.':'Reopen your Phone link and pair this browser to continue.'});}
   if(pathname==='/api/health'&&req.method==='GET'){
    const url=await backend();if(!url)return json(res,503,{ready:false,error:shared?'The host’s Dungeon Master is offline right now.':'Start the private Dungeon Master service on your PC.'});
    const response=await fetchImpl(url+'/health',{signal:AbortSignal.timeout(2500)});return json(res,response.status,await response.json());
   }
   if(pathname==='/api/dm'&&req.method==='POST'){
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the Questbound game to contact the Dungeon Master.'});
    const raw=await body(req,64000);
    // Each paired browser gets a fair share of the host's Dungeon Master and the gateway as a whole has a ceiling,
    // protecting the host's AI bill; illustration and story progress checks are counted apart and more loosely (the
    // game simply waits a few seconds when told to).
    let mode=null;try{mode=JSON.parse(raw)?.context?.mode??null;}catch{}
    if(mode==='art'){const seconds=limits.art(token);if(seconds)return wait(res,seconds,'Illustrations are being checked too often. The game will try again shortly.');}
    else{const seconds=limits.turns(token)||limits.allTurns('all');if(seconds)return wait(res,seconds,'The Dungeon Master needs a short rest. Try again in a few minutes. Your adventure is unchanged.');}
    const url=await backend();if(!url)return json(res,503,{error:shared?'The host’s Dungeon Master is offline right now.':'Start the private Dungeon Master service on your PC.'});
    // A busy Dungeon Master (another player's turn is being written) refuses before doing any work, so the request is
    // simply retried for up to a minute: players wait their turn instead of seeing an error.
    const forward=()=>fetchImpl(url+'/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:raw,signal:AbortSignal.timeout(90000)});
    const deadline=now()+busyWait;let response=await forward();
    for(let tries=0;response.status===429&&now()<deadline&&tries<100;tries++){await response.text?.().catch(()=>null);await new Promise(resolve=>setTimeout(resolve,700+Math.random()*600));response=await forward();}
    // A streamed turn (lines of narration, then the reply) is passed through as it arrives.
    if(/ndjson/.test(response.headers?.get?.('content-type')??'')&&response.body){res.writeHead(response.status,{'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});for await(const chunk of response.body)res.write(chunk);return res.end();}
    return json(res,response.status,await response.json());
   }
   // Shared table: the same paired, same-origin rules as the DM, forwarded to the loopback table service.
   const syncRoute=pathname.match(/^\/api\/sync\/(poll|save|leave|cloud-save|cloud-load|account-(?:register|login|save|load|status|logout|password|delete))$/)?.[1];
   if(syncRoute&&req.method==='POST'){
    if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Use the Questbound game to reach the shared table.'});
    // The table is polled every few seconds; sign-ups and sign-ins (per visitor), recovery codes and passwords (per browser) are rare.
    const visitor=String(client(req)??'');
    {const seconds=limits.sync(token)||(syncRoute==='account-register'?limits.register(visitor):syncRoute==='account-login'?limits.login(visitor):syncRoute==='cloud-load'?limits.recover(token):syncRoute==='account-password'||syncRoute==='account-delete'?limits.password(token):0);
     if(seconds)return wait(res,seconds,syncRoute.startsWith('account')||syncRoute==='cloud-load'?'Too many tries. Wait a few minutes and try again.':'The shared table is being asked too often. The game will catch up in a moment.');}
    const raw=await body(req,2500000);let response;
    // The table service is told who is asking (never trusted from the visitor), so wrong account passwords are counted per visitor.
    try{response=await fetchImpl(syncBackend+'/'+syncRoute,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json','X-Questbound-Client':visitor.slice(0,80)},body:raw,signal:AbortSignal.timeout(15000)});}
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
   // The typefaces never change either (a change of face would change the file name).
   const hashed=(/^\/(_expo|assets)\//.test(relative)&&/[.-][0-9a-f]{16,}\./.test(path.basename(file)))||/^\/fonts\/.*\.woff2$/.test(relative);
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
 return {server,info:{desktop:'http://localhost:8081/',phone:origin+'/',pairingCode:code,expiresAt:new Date(expires).toISOString(),limits:{turns:dmLimit,turnsInAll:dmTotal,art:artLimit,table:syncLimit,requests:requestLimit}}};
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
  // Home Wi-Fi: pairing lasts a week, paired phones stay paired across restarts (hashes only, as for sharing), and a
   // restart on the same address keeps the code the phone already has until fewer than two hours are left.
  else{const sessionFile=path.join(__dirname,'.questbound-phone-session.json');let previous=null;
    try{const saved=JSON.parse(fs.readFileSync(sessionFile,'utf8'));if(saved.phone==='http://'+host+':8085/'&&/^\d{8}$/.test(saved.pairingCode)&&Date.parse(saved.expiresAt)>Date.now()+2*3600000)previous=saved;}catch{}
    const {server,info}=createPhoneServer({host,pairingHours:168,sessionHours:168,maxSessions:30,sessionStore:path.join(__dirname,'.questbound-phone-sessions.json'),feedbackFile:path.join(__dirname,'playtest-feedback.md'),...(previous?{code:previous.pairingCode,expiresAt:Date.now()+168*3600000}:{})});server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Phone access is already running on port 8085.':e.message);process.exitCode=1;});server.listen(8085,host,()=>{fs.writeFileSync(path.join(__dirname,'.questbound-phone-session.json'),JSON.stringify({...info,pid:process.pid},null,2));console.log('Desktop: '+info.desktop+'\nPhone: '+info.phone+'\nPairing code: '+info.pairingCode+'\nSame Wi-Fi required. Keep this process and the private DM service running. Pairing lasts a week.');});}
 }
}
module.exports={createPhoneServer,phoneAddress};
