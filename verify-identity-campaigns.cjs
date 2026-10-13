const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createSyncServer}=require('./account-server.cjs'),{createOperations}=require('./operations.cjs'),{rules}=require('./rules-engine.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-accounts-')),r=rules(),codes=new Map(),key=crypto.randomBytes(32);let tick=Date.now(),calls=0;
const ops=createOperations({dir:root,key,now:()=>tick});
const options={dir:path.join(root,'table'),accountsDir:path.join(root,'accounts'),cloudDir:path.join(root,'cloud'),operations:ops,now:()=>tick,mailer:{configured:()=>true,verification:async(email,code)=>codes.set(email,code)},ask:async()=>{calls++;return {narration:'The company pauses to look around the room.',actionId:null};}};
const {server}=createSyncServer(options);
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let base;
async function post(route,body={},cookie='',headers={}){const response=await fetch(base+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie,'X-Questbound-Secure':'1',...headers},body:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};}
async function user(email){const pending=await post('account-register',{email,password:'A long unique passphrase! 93',termsVersion:(/export const legalUpdated='([^']+)'/.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'legalText.js'),'utf8'))[1]),ageConfirmed:true});assert.equal(pending.status,200,JSON.stringify(pending.body));assert.equal(pending.body.verificationRequired,true);assert.equal(pending.cookie,null);assert.equal((await post('account-status')).status,401);
 const wrong=await post('account-verify',{email,challenge:pending.body.challenge,code:'00000000'});assert.equal(wrong.status,400);
 const verified=await post('account-verify',{email,challenge:pending.body.challenge,code:codes.get(email)});assert.equal(verified.status,200,JSON.stringify(verified.body));assert.ok(!verified.body.token);assert.match(verified.cookie,/HttpOnly; SameSite=Strict/);assert.match(verified.cookie,/Secure/);
 assert.equal((await post('account-verify',{email,challenge:pending.body.challenge,code:codes.get(email)})).status,401);return {...verified.body,cookie:verified.cookie.split(';')[0],email};}
async function main(){await listen();base='http://127.0.0.1:'+server.address().port;
 const a=await user('alpha@example.test'),b=await user('beta@example.test'),c=await user('gamma@example.test');
 const hero=r.readyHero('fighter'),second=r.readyHero('wizard'),snap=r.adventureSnapshot(hero,r.newAdventure(hero),null,true),snapB=r.adventureSnapshot(second,r.newAdventure(second),null,true);
 assert.equal((await post('account-save',{snapshot:snap},a.cookie)).status,200);assert.equal((await post('account-save',{snapshot:snapB},b.cookie)).status,200);
 assert.equal((await post('account-load',{},a.cookie)).body.snapshot.character,snap.character);assert.equal((await post('account-load',{},b.cookie)).body.snapshot.character,snapB.character);
 assert.equal((await post('account-load',{token:a.cookie},b.cookie)).status,400);
 const campaign=await post('campaign-create',{snapshot:snap,party:true,name:'Alice'},a.cookie);assert.equal(campaign.status,200,JSON.stringify(campaign.body));const campaignId=campaign.body.campaignId;
 assert.equal((await post('poll',{campaignId,playerId:a.id},c.cookie)).status,403);
 const joined=await post('campaign-join',{invite:campaign.body.invite,snapshot:snapB,name:'Bob',playerId:a.id},b.cookie);assert.equal(joined.status,200,JSON.stringify(joined.body));assert.match(joined.body.you,/^seat-[a-f0-9]{16}$/);assert.equal(joined.body.snapshot.game.party.lead,joined.body.you);
 assert.equal((await post('campaign-invite',{campaignId},b.cookie)).status,403);
 assert.equal((await post('save',{campaignId,snapshot:snap,force:true},b.cookie)).status,403);
 const request={campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:joined.body.version};
 assert.equal((await post('campaign-turn',{...request,snapshot:snap},b.cookie)).status,400);
 const turn=await post('campaign-turn',request,b.cookie);assert.equal(turn.status,200,JSON.stringify(turn.body));assert.equal(turn.body.version,joined.body.version+1);assert.equal(calls,1);
 const repeated=await post('campaign-turn',request,b.cookie);assert.equal(repeated.status,200);assert.equal(repeated.body.replayed,true);assert.equal(calls,1);
 const stale=await post('campaign-turn',{...request,requestId:crypto.randomUUID()},a.cookie);assert.equal(stale.status,409);assert.equal(calls,1);
 const aView=await post('poll',{campaignId},a.cookie);
 // Members see seats, never each other's account ids (an unsalted hash of the email anyone could test guesses against).
 for(const body of [campaign.body,joined.body,turn.body,aView.body])assert.ok(![a.id,b.id].some(id=>JSON.stringify(body).includes(id)),'no account id reaches a campaign member');assert.equal(r.canonicalParty(aView.body.snapshot),r.canonicalParty(turn.body.snapshot));
 const backups=ops.backup.list('account-'+a.id);assert.ok(backups.length);assert.deepEqual(ops.backup.read('account-'+a.id,backups[0]).snapshot,JSON.parse(JSON.stringify(snap)));
 const newOps=createOperations({dir:root,key,now:()=>tick});assert.equal(newOps.status().usage.turns,1);assert.ok(newOps.backup.verify().checked>=3);
 assert.equal((await post('ops-status',{},a.cookie)).status,403);assert.equal((await post('ops-status',{},a.cookie,{'X-Questbound-Local':'1'})).status,200);
 const login=await post('account-login',{email:a.email,password:'A long unique passphrase! 93',termsVersion:(/export const legalUpdated='([^']+)'/.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'legalText.js'),'utf8'))[1]),ageConfirmed:true});assert.equal(login.status,200);const other=login.cookie.split(';')[0];
 assert.equal((await post('account-logout-all',{},other)).status,200);assert.equal((await post('account-status',{},a.cookie)).status,401);assert.equal((await post('account-status',{},other)).status,401);
 tick+=13*3600000;assert.equal((await post('account-status',{},b.cookie)).status,401);
 console.log('Verified: email proof, wrong/reused codes, isolated saves, protected cookies, campaign membership, anti-forgery, authoritative turns, retry safety, conflicts, encrypted backup restore, persistent quotas, sign-out-all and idle expiry.');
}
// Guests (accountsRequired off, the beta): a browser without a session is given an anonymous identity and plays with it.
async function guests(){
 const http=require('node:http'),{createPhoneServer}=require('./phone-server.cjs'),{fixtures}=require('./test-fixtures.cjs');
 const servers=[],open=s=>new Promise(resolve=>{servers.push(s);s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port));});
 const home=path.join(root,'guests'),fx=fixtures(home,{now:()=>tick,limits:{'guests-overall':[30,3600000]}});
 const svc=createSyncServer(fx.options);const at=await open(svc.server);
 const ask=async(route,body={},cookie='',headers={})=>{const response=await fetch(at+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie,'X-Questbound-Secure':'1',...headers},body:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};};
 try{
  assert.equal((await (await fetch(at+'/health')).json()).accountsRequired,false,'guest play is the beta default');
  assert.equal((await ask('account-status')).status,401);assert.equal((await ask('poll',{campaignId:'0'.repeat(32)})).status,401);
  // A browser with no session gets a guest identity: a random id in the protected cookie, lasting 90 days.
  const first=await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.1'});assert.equal(first.status,200,JSON.stringify(first.body));
  assert.equal(first.body.guest,true);assert.match(first.body.id,/^[a-f0-9]{64}$/);assert.ok(!first.body.token,'the token never reaches game scripts');
  assert.match(first.cookie,/^questbound_account=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=7776000; Secure$/);
  const g1=first.cookie.split(';')[0];
  assert.deepEqual((await ask('account-status',{},g1)).body,{signedIn:false,guest:true,id:first.body.id,verified:false,savedAt:null});
  const again=await ask('account-guest',{},g1,{'X-Questbound-Client':'198.51.100.1'});assert.equal(again.body.id,first.body.id,'a browser keeps its guest');assert.equal(again.cookie,null);
  assert.equal(svc.accounts.count(),0,'guests never count as email accounts');assert.equal(svc.accounts.guestCount(),1);
  const stored=fs.readdirSync(path.join(home,'accounts','guests'));assert.equal(stored.length,1);assert.ok(!fs.readFileSync(path.join(home,'accounts','guests',stored[0]),'utf8').includes(g1.split('=')[1]),'only the token hash is kept');
  // Guests never reach what only an email account (or the host) may do.
  for(const route of ['account-save','account-load','account-logout-all','account-password','account-delete'])assert.equal((await ask(route,{snapshot:fx.snapshot(),password:'x',newPassword:'y'},g1)).status,403,route);
  assert.equal((await ask('ops-status',{},g1,{'X-Questbound-Local':'1'})).status,403,'host diagnostics need an account');
  assert.equal((await ask('ops-status',{},g1)).status,403);
  // A guest's DM allowance, cloud save and campaigns: create, join by invite, turn and edit, as for an account.
  assert.deepEqual((await ask('usage',{kind:'dm'},g1)).body,{allowed:true,id:first.body.id});
  assert.equal((await ask('cloud-save',{code:'ABCDEFGHJKLM',snapshot:fx.snapshot(),expectedAccountId:'guest'},g1)).status,200);
  const g2=(await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.2'})).cookie.split(';')[0];
  const made=await ask('campaign-create',{snapshot:fx.snapshot('fighter'),party:true,name:'Ann',expectedAccountId:'guest'},g1);assert.equal(made.status,200,JSON.stringify(made.body));
  const joined=await ask('campaign-join',{invite:made.body.invite,snapshot:fx.snapshot('wizard'),name:'Ben',expectedAccountId:'guest'},g2);assert.equal(joined.status,200,JSON.stringify(joined.body));
  assert.equal((await ask('poll',{campaignId:made.body.campaignId,expectedAccountId:'a'.repeat(64)},g2)).status,409,'a stale tab for another account is stopped');
  const turn=await ask('campaign-turn',{campaignId:made.body.campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:joined.body.version,expectedAccountId:'guest'},g2);
  assert.equal(turn.status,200,JSON.stringify(turn.body));assert.equal(turn.body.version,joined.body.version+1);
  const note=await ask('campaign-edit',{campaignId:made.body.campaignId,kind:'note',text:'Remember the well.',baseVersion:turn.body.version,expectedAccountId:'guest'},g1);assert.equal(note.status,200,JSON.stringify(note.body));
  assert.ok(!JSON.stringify([made.body,joined.body,turn.body,note.body]).includes(first.body.id),'no guest id reaches a campaign member');
  // The host removes and bans a guest (2026-10-13): their device is told, every invite refuses them, and a game-wide
  // ban (node accounts.cjs ban) refuses that identity everywhere, even a fresh guest; unbanning lets them back.
  const out=await ask('campaign-ban',{campaignId:made.body.campaignId,seat:joined.body.you,expectedAccountId:'guest'},g1);assert.equal(out.status,200,JSON.stringify(out.body));
  const gone=await ask('poll',{campaignId:made.body.campaignId,expectedAccountId:'guest'},g2);assert.equal(gone.status,403);assert.equal(gone.body.removed,true);
  const reinvite=(await ask('campaign-invite',{campaignId:made.body.campaignId,expectedAccountId:'guest'},g1)).body.invite;
  assert.equal((await ask('campaign-join',{invite:reinvite,snapshot:fx.snapshot('wizard'),name:'Ben',expectedAccountId:'guest'},g2)).status,403,'a new invite refuses a banned member');
  assert.equal((await ask('campaign-unban',{campaignId:made.body.campaignId,ref:out.body.banned[0].ref,expectedAccountId:'guest'},g1)).status,200);
  assert.equal((await ask('campaign-join',{invite:reinvite,snapshot:fx.snapshot('wizard'),name:'Ben',expectedAccountId:'guest'},g2)).status,200,'let back');
  const g2id=(await ask('account-status',{},g2)).body.id;svc.bans.ban(g2id);
  assert.equal((await ask('usage',{kind:'dm'},g2)).body.banned,true);assert.equal((await ask('account-guest',{},g2,{'X-Questbound-Client':'198.51.100.2'})).status,403);
  assert.ok(svc.bans.unban(g2id));assert.equal((await ask('usage',{kind:'dm'},g2)).status,200);
  // No idle expiry for guests, and the cookie is renewed when used (once a day).
  tick+=2*86400000;const renewed=await ask('poll',{campaignId:made.body.campaignId,expectedAccountId:'guest'},g1);assert.equal(renewed.status,200);assert.match(renewed.cookie??'',/Max-Age=7776000/);
  assert.equal((await ask('poll',{campaignId:made.body.campaignId,expectedAccountId:'guest'},g1)).cookie,null,'renewed once a day, not on every poll');
  // Guest creation is limited per caller (20 an hour) and overall (here 30 an hour).
  for(let i=0;i<20;i++)assert.equal((await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.1'})).status,200);
  assert.equal((await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.1'})).status,429,'twenty an hour from one caller');
  for(let i=0;i<10;i++)assert.equal((await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.'+(10+i)})).status,200);
  assert.equal((await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.99'})).status,429,'and a ceiling for everyone');
  // Through the share gateway: a paired browser with no session gets a guest and takes a Dungeon Master turn under its label.
  let heard=null;const dm=http.createServer(async(req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ready:true}));}let raw='';for await(const c of req)raw+=c;heard=JSON.parse(raw);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({narration:'The lamp gutters.'}));});
  const dmAt=await open(dm),site=path.join(home,'site');fs.mkdirSync(site,{recursive:true});fs.writeFileSync(path.join(site,'index.html'),'<h1>Questbound</h1>');
  tick+=3601000;
  const share=createPhoneServer({host:'127.0.0.1',port:0,root:site,publicOrigin:'https://play.example',code:'24681357',backends:[dmAt],syncBackend:at});const gw=await open(share.server);
  const via=(route,body,cookie='')=>new Promise((resolve,reject)=>{const u=new URL(gw);const req=http.request({hostname:u.hostname,port:u.port,path:route,method:'POST',headers:{Host:'play.example',Origin:'https://play.example','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.40',Cookie:cookie}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(t||'{}'),cookie:res.headers['set-cookie']?.[0]??null}));});req.on('error',reject);req.end(JSON.stringify(body));});
  const paired=await via('/pair',{code:'24681357'});assert.equal(paired.status,200);let jar=paired.cookie.split(';')[0];
  assert.equal((await via('/api/dm',{input:'Hello',context:{choices:[]}},jar)).status,401,'no identity, no turn');
  const guest=await via('/api/sync/account-guest',{},jar);assert.equal(guest.status,200,JSON.stringify(guest.body));assert.match(guest.cookie,/HttpOnly; SameSite=Strict; Path=\/; Max-Age=7776000; Secure/);
  jar+='; '+guest.cookie.split(';')[0];
  const reply=await via('/api/dm',{input:'Hello',context:{choices:[]},guest:'forged'},jar);assert.equal(reply.status,200,JSON.stringify(reply.body));assert.equal(reply.body.narration,'The lamp gutters.');
  assert.equal(heard.guest,'account-'+guest.body.id,'the guest is labelled for budgets and the safety identifier');
  const hosted=await via('/api/sync/campaign-create',{snapshot:fx.snapshot(),party:true,name:'Cara',expectedAccountId:'guest'},jar);assert.equal(hosted.status,200,JSON.stringify(hosted.body));
  const fed=await via('/api/sync/campaign-turn',{campaignId:hosted.body.campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:hosted.body.version,expectedAccountId:'guest'},jar);assert.equal(fed.status,200,JSON.stringify(fed.body));
  // Guests unseen for 60 days are removed, with the campaigns they host.
  const saved=tick;tick+=61*86400000;assert.ok(svc.accounts.pruneGuests()>=2);assert.equal((await ask('account-status',{},g1)).status,401);
  assert.equal((await ask('poll',{campaignId:made.body.campaignId},g2)).status,401,'the joined guest went unseen too');
  assert.ok(!fs.existsSync(path.join(home,'table','campaigns',made.body.campaignId+'.json')),'their campaign went with them');
  // With the requirement forced on (QUESTBOUND_REQUIRE_ACCOUNTS=1) the guest route is refused and guests are not identities.
  tick=saved;const fresh=await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.200'});assert.equal(fresh.status,200);
  process.env.QUESTBOUND_REQUIRE_ACCOUNTS='1';const strict=createSyncServer({...fx.options,limits:{}});delete process.env.QUESTBOUND_REQUIRE_ACCOUNTS;
  const sat=await open(strict.server),strictAsk=async(route,body={},cookie='')=>{const r=await fetch(sat+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  assert.equal((await (await fetch(sat+'/health')).json()).accountsRequired,true);
  const refused=await strictAsk('account-guest');assert.equal(refused.status,403);assert.equal(refused.body.accountsRequired,true);
  const kept=fresh.cookie.split(';')[0];for(const route of ['account-status','usage','poll','campaign-list','cloud-save'])assert.equal((await strictAsk(route,{kind:'dm',code:'ABCDEFGHJKLM'},kept)).status,401,route);
  const member=await fx.user(strict.accounts,'member@example.test');assert.equal((await strictAsk('usage',{kind:'dm'},'questbound_account='+member.token)).status,200,'a verified account still plays');
 }finally{for(const s of servers)await new Promise(resolve=>s.close(resolve));}
 console.log('Guests: a browser with no session gets an anonymous identity (HttpOnly, 90 days, renewed, rate-limited, pruned when unseen) that takes Dungeon Master turns through the share gateway, keeps cloud saves and creates, joins and plays campaigns, never reaches account-only routes or host diagnostics, and is refused when accounts are required.');
}
main().then(guests).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close(()=>fs.rmSync(root,{recursive:true,force:true})));
