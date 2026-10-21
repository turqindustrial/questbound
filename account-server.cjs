// Private account/campaign service. Browser callers use their same-origin gateway.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createAccounts}=require('./accounts.cjs'),{loopbackHost}=require('./security-headers.cjs');
const {createLimiter}=require('./rate-limit.cjs'),{createCampaigns,validSnapshot}=require('./campaigns.cjs'),{createOperations,atomic}=require('./operations.cjs'),{createMailer}=require('./mailer.cjs');
const {createBans}=require('./bans.cjs'),{reportEntry,saveFeedback}=require('./feedback-notes.cjs');
const {createInviteGuard,inviteWords}=require('./invite-guard.cjs');
// The terms players accept are the ones legalText.js carries, so the date has one source.
const currentTerms=(()=>{try{return /export const legalUpdated='([^']+)'/.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'legalText.js'),'utf8'))[1];}catch{return '10 October 2026';}})();
// Whether a signed-in, email-verified account is needed to play: one switch, accountsRequired in accountRules.js (read
// from the file, as legalUpdated is above), or QUESTBOUND_REQUIRE_ACCOUNTS=1 for a hosted game. While it is off (the
// beta), a browser without a session is given an anonymous guest identity (account-guest) and plays with it.
const requiredInFile=(()=>{try{return /export const accountsRequired=(true|false);/.exec(fs.readFileSync(path.join(__dirname,'accountRules.js'),'utf8'))[1]==='true';}catch{return false;}})();
const accountsRequiredNow=()=>process.env.QUESTBOUND_REQUIRE_ACCOUNTS==='1'||requiredInFile;
const allowedOrigins=new Set(['http://localhost:8081','http://localhost:8082']);
const accountRoutes=['guest','register','login','verify','save','load','status','logout','logout-all','password','delete'];
const campaignRoutes=['create','join','list','invite','turn','edit','report','ban','unban','tale','wait','typing'];
const routes=new Set(['poll','save','leave','cloud-save','cloud-load','usage','ops-status','ops-verify-backups',...accountRoutes.map(x=>'account-'+x),...campaignRoutes.map(x=>'campaign-'+x)]);
const cookieToken=req=>req.headers.cookie?.match(/(?:^|;\s*)questbound_account=([a-f0-9]{64})(?:;|$)/)?.[1]??'';
const cloudKey=code=>{const c=String(code??'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{12}$/.test(c)?crypto.createHash('sha256').update('questbound-cloud-v1:'+c).digest('hex'):null;};
// The host's own words about bans and reports (2026-10-13): "add per-player mute or report and a host ban". A
// browser the host of the whole game has banned (node accounts.cjs ban …, bans.cjs) is refused everything here: the
// Dungeon Master (the gateways ask /usage first), every campaign route and feedback (the gateway asks /usage too).
const bannedLine='The host of this game has closed it to this browser.';
// A table turn's request to the Dungeon Master is streamed (table-stream, 2026-10-21): the DM answers NDJSON lines of
// {narration} while it writes (the narration so far), then {reply} or {error}, exactly as it answers a solo player's
// device (dmConnection.js readTurn). The narration goes to onNarration (the table's draft, display only); the reply is
// checked by the same rules as before. A DM from before streaming, or one that refuses before writing, answers plain
// JSON, which is read as it always was.
async function readDmStream(response,onNarration){
 let result=null,buffer='';const decoder=new TextDecoder();
 const take=line=>{if(!line.trim())return;let m;try{m=JSON.parse(line);}catch{return;}if(m&&typeof m.narration==='string'){try{onNarration(m.narration);}catch{}}else if(m?.reply&&typeof m.reply==='object')result=m.reply;else if(m?.error)result={error:String(m.error)};};
 for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){take(buffer.slice(0,i));buffer=buffer.slice(i+1);}}
 take(buffer+decoder.decode());
 return result??{error:'The Dungeon Master\'s reply was cut off. Nothing was applied; try again.'};
}
async function askDungeonMaster(fetchImpl,dmBackend,payload,user,{onNarration=null}={}){
 const streamed=typeof onNarration==='function';
 const response=await fetchImpl(dmBackend+'/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({...payload,...(streamed?{stream:true}:{}),...(user.local?{}:{guest:'account-'+user.id})}),signal:AbortSignal.timeout(90000)});
 const body=streamed&&/ndjson/.test(response.headers?.get?.('content-type')??'')?await readDmStream(response,onNarration):await response.json();
 if(!response.ok||body?.error)throw Object.assign(Error(body?.error||'The Dungeon Master could not respond.'),{status:502});
 return body;
}
function createSyncServer({dir=path.join(__dirname,'.questbound-table'),cloudDir=path.join(__dirname,'.questbound-cloud'),accountsDir=path.join(__dirname,'.questbound-accounts'),cloudLimit=200,limits={},now=Date.now,mailer=null,operations=null,ask=null,moderate=null,feedbackFile=null,randomImpl,dmBackend='http://127.0.0.1:8084',fetchImpl=fetch,accountOptions={},accountsRequired=accountsRequiredNow(),live,inviteLimits={}}={}){
 const dataDir=path.dirname(accountsDir),ops=operations??createOperations({dir:dataDir,now}),mail=mailer??createMailer({dir:dataDir});
 const bans=createBans({dir:accountsDir,now});
 // Wrong campaign invite codes per caller and overall (invite-guard.cjs), so guessing a short code stays impractical.
 const inviteGuard=createInviteGuard({file:path.join(dataDir,'.questbound-invite-misses.json'),now,limits:inviteLimits});
 let campaigns=null;
 const accounts=createAccounts({allowGuests:!accountsRequired,onGuestRemoved:id=>campaigns?.removeAccount(id),...accountOptions,dir:accountsDir,now,validSnapshot,mailer:mail,backup:ops.backup,audit:ops.audit});
 const dmAsk=ask??((payload,user,options)=>askDungeonMaster(fetchImpl,dmBackend,payload,user,options));
 // Table names go through the Dungeon Master's content check (moderation.cjs, mode 'moderate'): only its process holds
 // the API key. A few seconds at most, and it fails open. Tests that stand in for the Dungeon Master (ask) pass their own.
 const dmModerate=moderate??(ask?null:async(text,user)=>{const response=await fetchImpl(dmBackend+'/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input:text,context:{mode:'moderate',choices:[]},...(user.local?{}:{guest:'account-'+user.id})}),signal:AbortSignal.timeout(4000)});if(!response.ok)return null;return (await response.json())?.moderation??null;});
 // Reports from a table go to the host's playtest notes (feedback-report.cjs lists them) and, once the game mailbox is
 // set up, to the mailbox, at most ten an hour.
 const notesFile=feedbackFile??path.join(dataDir,dataDir===__dirname?'playtest-feedback.md':'feedback.md'),mailedReports=[];
 const onReport=report=>{const entry=reportEntry(report,{now:now()});saveFeedback(notesFile,entry);while(mailedReports.length&&mailedReports[0]<=now()-3600000)mailedReports.shift();if(mailedReports.length<10&&mail.configured?.()){mailedReports.push(now());mail.feedback?.(entry.markdown)?.catch?.(()=>{});}};
 campaigns=createCampaigns({dir:path.join(dir,'campaigns'),now,operations:ops,ask:dmAsk,randomImpl,moderate:dmModerate,onReport,...(live?{live}:{})});
 // Allowances in sliding windows. Signing up, signing in and recovery codes are counted per visitor address (the caller
 // the gateway names), as is anything sent without a valid sign-in; everything else per signed-in account, so players
 // behind one home or carrier address never share a bucket. The gateway asks 'usage' before each Dungeon Master
 // request: turns count against the account, illustration and story checks (kind 'art') are not counted here at all
 // (the gateway limits them per browser and spending.cjs prices the paintings).
 // A held wait (campaign-wait) answers at most about once a second for presence and at once for a new version, else
 // every 25 s; typing pings come every few seconds while someone types (campaign-live.cjs, useSharedTable.js).
 const quota={poll:[1200,600000],'campaign-wait':[1500,600000],'campaign-typing':[400,600000],'campaign-report':[10,3600000],'campaign-ban':[30,3600000],'account-guest':[20,3600000],'guests-overall':[300,3600000],'account-register':[10,3600000],'account-login':[30,600000],'account-verify':[20,600000],'campaign-join':[20,600000],usage:[240,600000],unauthenticated:[300,600000],other:[300,600000],...limits};
 const liveRoutes=new Set(['campaign-wait','campaign-typing']);
 const perCaller=new Set(['account-guest','account-register','account-login','account-verify','account-logout','cloud-load']);
 const routeLimits=new Map([...routes,'unauthenticated','guests-overall'].map(route=>{const [max,span]=quota[route]??quota.other;return [route,createLimiter(max,span,{now})];}));
 const tooMany=(res,send,route,seconds)=>{ops.audit('rate-denied',{route,status:429});res.setHeader('Retry-After',String(seconds));return send(429,{error:'Too many tries. Wait a few minutes and try again.'});};
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin,send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'}:{})});res.end(JSON.stringify(data));};
  // A guest's cookie lasts 90 days and is renewed when used (accounts.cjs renews the token once a day); an account's lasts a week.
  const setSession=(token,days=7)=>res.setHeader('Set-Cookie','questbound_account='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(token?days*86400:0)+(req.headers['x-questbound-secure']==='1'?'; Secure':''));
  const loginResult=result=>{if(result.token){setSession(result.token);const {token,...publicResult}=result;return publicResult;}return result;};
  if(!loopbackHost(req))return send(403,{error:'Use the Questbound game on this PC.'});
  if(origin&&!allowedOrigins.has(origin))return send(403,{error:'Origin not allowed.'});
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'http://localhost:8081','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});return res.end();}
  let route='',caller='';
  try{
   if(req.url==='/health'&&req.method==='GET')return send(200,{ready:true,table:true,verifiedAccounts:true,accountsRequired,mailConfigured:mail.configured()});
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return send(404,{error:'Not found.'});
   if(!allowedOrigins.has(origin))return send(403,{error:'Use the Questbound game to reach the table.'});
   route=req.url.slice(1);if(!routes.has(route))return send(404,{error:'Not found.'});
   caller=String(req.headers['x-questbound-client']??'this-pc').slice(0,80);
   if(perCaller.has(route)){const seconds=routeLimits.get(route)(caller);if(seconds)return tooMany(res,send,route,seconds);}
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2500000)return send(413,{error:'This adventure is too large.'});}
   if(liveRoutes.has(route)&&Buffer.byteLength(raw)>1024)return send(413,{error:'Invalid request.'});
   let b;try{b=JSON.parse(raw);}catch{return send(400,{error:'Invalid request.'});}
   if(!b||typeof b!=='object'||Array.isArray(b))return send(400,{error:'Invalid request.'});
   if(Object.hasOwn(b,'token'))return send(400,{error:'This version uses a protected sign-in cookie. Reload and sign in again.'});
   const token=cookieToken(req);
   if(route==='account-register'||route==='account-login'||route==='account-verify'){
    if(route!=='account-verify'&&(b.termsVersion!==currentTerms||b.ageConfirmed!==true))return send(400,{error:'Confirm your age and accept the current terms and privacy policy.'});
    ops.consume(caller,'account-attempts',100);
    const result=route==='account-register'?await accounts.register(b.email,b.password,caller,b.recoveryCode,b.termsVersion):route==='account-login'?await accounts.login(b.email,b.password,caller,b.termsVersion):await accounts.verify(b.email,b.challenge,b.code,caller);
    return send(200,loginResult(result));
   }
   // A guest identity for a browser without a session: the existing session if there is one, else a new guest.
   if(route==='account-guest'){
    if(accountsRequired)return send(403,{error:'Sign in with your account to play.',accountsRequired:true});
    {let who=null;try{who=accounts.identity(token);}catch{}if(who&&bans.has(who.id)){ops.audit('banned-refused',{route});return send(403,{error:bannedLine,banned:true});}if(who)return send(200,who.guest?{guest:true,id:who.id}:{guest:false,signedIn:true,id:who.id});}
    {const seconds=routeLimits.get('guests-overall')('all');if(seconds)return tooMany(res,send,route,seconds);}
    const made=await accounts.guest(caller);setSession(made.token,90);return send(200,{guest:true,id:made.id});
   }
   if(route==='account-logout'&&!accountsRequired){try{if(accounts.identity(token).guest)return send(200,{signedOut:true,guest:true});}catch{}}
   if(route==='account-logout'){if(b.expectedAccountId&&accounts.identity(token).id!==b.expectedAccountId)return send(409,{error:'Another account signed in on this browser. Reload before continuing.'});await accounts.logout(token);setSession('');return send(200,{signedOut:true});}
   let user;try{user=accounts.identity(token);}catch(e){const seconds=routeLimits.get('unauthenticated')(caller);if(seconds)return tooMany(res,send,route,seconds);throw e;}user.active=()=>accounts.identity(token);
   if(bans.has(user.id)){ops.audit('banned-refused',{route});return send(403,{error:bannedLine,banned:true});}
   if(user.renewed){setSession(token,90);delete user.renewed;}
   if(!perCaller.has(route)&&!(route==='usage'&&b.kind==='art')){const seconds=routeLimits.get(route)('account:'+user.id);if(seconds)return tooMany(res,send,route,seconds);}
   // A guest's device keeps its saves under the profile 'guest' (playerStorage.js), and names itself so.
   if(b.expectedAccountId&&b.expectedAccountId!==(user.guest?'guest':user.id))return send(409,{error:'Another account signed in on this browser. Reload before continuing.'});
   if(route==='account-status')return send(200,await accounts.status(token));
   if(route==='account-save')return send(200,await accounts.save(token,b.snapshot));
   if(route==='account-load')return send(200,await accounts.load(token));
   if(route==='account-logout-all'){const result=await accounts.logoutAll(token);setSession('');return send(200,result);}
   if(route==='account-password')return send(200,await accounts.changePassword(token,b.password,b.newPassword,caller));
   if(route==='account-delete'){const result=await accounts.remove(token,b.password,caller);campaigns.removeAccount(user.id);setSession('');return send(200,result);}
   if(route==='save')return send(403,{error:'Whole-adventure writes are disabled. Send an action to the campaign.'});
   if(route==='poll'||route==='leave')return send(200,campaigns[route](user,b));
   // A held wait ends when the caller goes away (the gateway or the browser closing the request), so it holds nothing.
   if(route==='campaign-wait'){const gone=new AbortController();res.on('close',()=>{if(!res.writableFinished)gone.abort();});let result;try{result=await campaigns.wait(user,b,{signal:gone.signal});}catch(e){if(gone.signal.aborted)return;throw e;}if(gone.signal.aborted)return;return send(200,result);}
   if(route.startsWith('campaign-')){
    // A join by invite code waits once this caller (or everyone) has got codes wrong too often; a wrong code is counted.
    const byInvite=route==='campaign-join'&&b.invite!==undefined;
    if(byInvite){const held=inviteGuard.blocked(caller);if(held){ops.audit('invite-guess-denied',{route,status:429});res.setHeader('Retry-After',String(held.seconds));return send(429,{error:inviteWords[held.whose]});}}
    let result;try{result=await campaigns[route.slice(9)](req.headers['x-questbound-local']==='1'?{...user,local:true}:user,b);}catch(e){if(byInvite&&e.inviteMiss){inviteGuard.miss(caller);ops.audit('invite-wrong',{route,status:404});}throw e;}
    return send(result.conflict?409:200,result);}
   if(route==='usage'){if(b.kind==='dm')ops.consume(user.id,'dm-requests',300);return send(200,{allowed:true,id:user.id});}
   if(route==='ops-status'||route==='ops-verify-backups'){
    if(req.headers['x-questbound-local']!=='1')return send(403,{error:'Host diagnostics are available only on the desktop.'});
    if(user.guest)return send(403,{error:'Sign in with an account to see host diagnostics.'});
    return send(200,route==='ops-status'?ops.status():ops.backup.verify());
   }
   if(route==='cloud-save'||route==='cloud-load'){
    const key=cloudKey(b.code);if(!key)return send(400,{error:'That recovery code is not valid.'});const file=path.join(cloudDir,key+'.json');
    if(route==='cloud-load'){let saved;try{saved=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return send(404,{error:'No adventure was found for that recovery code.'});}return send(200,saved);}
    if(!validSnapshot(b.snapshot))return send(400,{error:'That adventure could not be saved.'});fs.mkdirSync(cloudDir,{recursive:true});
    if(!fs.existsSync(file)&&fs.readdirSync(cloudDir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).length>=cloudLimit)return send(507,{error:'Recovery storage is full. Existing saves are safe.'});
    const savedAt=new Date(now()).toISOString(),record={savedAt,snapshot:b.snapshot};ops.backup.put('cloud-'+key,record);atomic(file,record);return send(200,{saved:true,savedAt});
   }
   return send(404,{error:'Not found.'});
  }catch(e){if(e.status>=400&&e.status<500)ops.audit('request-denied',{route,status:e.status});
   // An unexpected fault (no status) is logged for the host, its message and where it happened only (never a request body).
   if(!e.status)console.error(new Date().toISOString()+' '+route+' failed: '+String(e?.stack??e).split('\n').slice(0,6).join(' | '));send(e.status??500,{error:e.status?e.message:'The game service could not complete that request. Your last saved progress is kept.',...(e.removed?{removed:true}:{}),...(e.needsHero?{needsHero:true}:{}),...(e.needsTale?{needsTale:true}:{})});}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;
 return {server,accounts,campaigns,operations:ops,bans};
}
module.exports={createSyncServer,routes,cookieToken,accountsRequiredNow,askDungeonMaster,readDmStream};
