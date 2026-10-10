const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createSyncServer}=require('./account-server.cjs'),{createOperations}=require('./operations.cjs'),{rules}=require('./rules-engine.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-accounts-')),r=rules(),codes=new Map(),key=crypto.randomBytes(32);let tick=Date.now(),calls=0;
const ops=createOperations({dir:root,key,now:()=>tick});
const options={dir:path.join(root,'table'),accountsDir:path.join(root,'accounts'),cloudDir:path.join(root,'cloud'),operations:ops,now:()=>tick,mailer:{configured:()=>true,verification:async(email,code)=>codes.set(email,code)},ask:async()=>{calls++;return {narration:'The company pauses to look around the room.',actionId:null};}};
const {server}=createSyncServer(options);
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let base;
async function post(route,body={},cookie='',headers={}){const response=await fetch(base+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie,'X-Questbound-Secure':'1',...headers},body:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};}
async function user(email){const pending=await post('account-register',{email,password:'A long unique passphrase! 93',termsVersion:'9 October 2026',ageConfirmed:true});assert.equal(pending.status,200,JSON.stringify(pending.body));assert.equal(pending.body.verificationRequired,true);assert.equal(pending.cookie,null);assert.equal((await post('account-status')).status,401);
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
 const login=await post('account-login',{email:a.email,password:'A long unique passphrase! 93',termsVersion:'9 October 2026',ageConfirmed:true});assert.equal(login.status,200);const other=login.cookie.split(';')[0];
 assert.equal((await post('account-logout-all',{},other)).status,200);assert.equal((await post('account-status',{},a.cookie)).status,401);assert.equal((await post('account-status',{},other)).status,401);
 tick+=13*3600000;assert.equal((await post('account-status',{},b.cookie)).status,401);
 console.log('Verified: email proof, wrong/reused codes, isolated saves, protected cookies, campaign membership, anti-forgery, authoritative turns, retry safety, conflicts, encrypted backup restore, persistent quotas, sign-out-all and idle expiry.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close(()=>fs.rmSync(root,{recursive:true,force:true})));
