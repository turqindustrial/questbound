const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomic}=require('./operations.cjs'),{resolveTurn}=require('./server-turn.cjs');
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const clean=text=>typeof text==='string'?text.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,40):'';
function validSnapshot(s){
 try{if(!s||Array.isArray(s)||JSON.stringify(s).length>2000000||typeof s.character!=='string'||s.character.length>200000)return false;
  const r=require('./rules-engine.cjs').rules(),hero=JSON.parse(s.character);return r.isValidCharacter(hero)&&r.validAdventure(s,hero)&&(!r.isPartyGame(s.game)||Object.keys(s.game.party.members).every(id=>{const v=r.partyView(s,id),h=JSON.parse(v.character);return r.isValidCharacter(h)&&r.validAdventure(v,h);}));
 }catch{return false;}
}
function createCampaigns({dir,now=Date.now,operations,ask,randomImpl}={}){
 const r=require('./rules-engine.cjs').rules(),presence=new Map(),locks=new Map();
 const ids=()=>{try{return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{32}\.json$/.test(n)).map(n=>n.slice(0,32));}catch{return [];}};
 const file=id=>{if(!/^[a-f0-9]{32}$/.test(id??''))throw fail(404,'Campaign not found.');return path.join(dir,id+'.json');};
 const read=id=>{try{return JSON.parse(fs.readFileSync(file(id),'utf8'));}catch{throw fail(404,'Campaign not found.');}};
 const persist=c=>{operations?.backup.put('campaign-'+c.id,c);atomic(file(c.id),c);};
 const requireMember=(id,user)=>{const c=read(id);if(!c.members[user.id]){operations?.audit('campaign-access-denied',{account:user.id,campaign:id});throw fail(403,'You are not a member of this campaign.');}return c;};
 const free=c=>{if(locks.has(c.id))throw fail(423,'A turn is being resolved. Wait for it to finish.');};
 const touch=(c,user)=>presence.set(c.id+':'+user.id,now());
 function state(c,user,known=-1){
  const players=Object.entries(c.members).filter(([id])=>now()-(presence.get(c.id+':'+id)??0)<15000).map(([id,m])=>({id,name:m.name,role:m.role,acting:locks.get(c.id)===id}));
  return {campaignId:c.id,version:c.version,you:user.id,role:c.members[user.id].role,players,updatedAt:c.updatedAt,updatedBy:c.updatedBy,...(known!==c.version?{snapshot:r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,user.id):c.snapshot}:{})};
 }
 const advance=(c,snapshot,user)=>{if(!validSnapshot(snapshot))throw fail(400,'That adventure did not pass validation.');c.snapshot=snapshot;c.version++;c.updatedAt=new Date(now()).toISOString();c.updatedBy=c.members[user.id].name;persist(c);return state(c,user);};
 return {
  create(user,b){
   if(ids().length>=100)throw fail(507,'Campaign storage is full. Ask the host.');
   if(!validSnapshot(b.snapshot)||r.isPartyGame(b.snapshot.game))throw fail(400,'Start with your own valid solo adventure.');
   operations?.consume(user.id,'campaigns',5);
   const id=crypto.randomBytes(16).toString('hex'),invite=crypto.randomBytes(12).toString('base64url'),name=clean(b.name)||'Host';
   const snapshot=b.party===false?b.snapshot:r.startParty(b.snapshot,user.id,name);
   const c={id,owner:user.id,members:{[user.id]:{name,role:'owner'}},inviteHash:digest(invite),inviteUntil:now()+7*86400000,version:1,updatedAt:new Date(now()).toISOString(),updatedBy:name,snapshot,receipts:[]};
   persist(c);touch(c,user);operations?.audit('campaign-created',{account:user.id,campaign:id});return {...state(c,user),invite};
  },
  join(user,b){
   if(typeof b.invite!=='string'||!/^[a-zA-Z0-9_-]{16}$/.test(b.invite))throw fail(400,'Enter the campaign invite supplied by its host.');
   const hash=digest(b.invite),c=ids().map(read).find(c=>c.inviteUntil>now()&&c.inviteHash===hash);if(!c)throw fail(404,'Campaign invite is invalid or expired.');free(c);
   if(c.members[user.id]){touch(c,user);if(r.isPartyGame(c.snapshot.game)&&r.settleParty(c.snapshot).members[user.id]?.status==='dead'&&validSnapshot(b.snapshot)){const revived=r.joinParty(c.snapshot,user.id,{...b.snapshot,name:c.members[user.id].name});if(revived.error)throw fail(409,revived.error);return advance(c,revived.snapshot,user);}return state(c,user);}
   if(Object.keys(c.members).length>=12)throw fail(409,'This campaign is full.');
   let snapshot=c.snapshot;const name=clean(b.name)||'Adventurer';
   if(r.isPartyGame(snapshot.game)){
    if(!validSnapshot(b.snapshot))throw fail(400,'Choose your hero and start an adventure before joining.');
    const joined=r.joinParty(snapshot,user.id,{...b.snapshot,name});if(joined.error)throw fail(409,joined.error);snapshot=joined.snapshot;
   }
   c.members[user.id]={name,role:'player'};touch(c,user);return advance(c,snapshot,user);
  },
  poll(user,b){const c=requireMember(b.campaignId,user);touch(c,user);return state(c,user,b.knownVersion);},
  leave(user,b){const c=requireMember(b.campaignId,user);presence.delete(c.id+':'+user.id);return {left:true};},
  invite(user,b){const c=requireMember(b.campaignId,user);if(c.owner!==user.id)throw fail(403,'Only the campaign host can issue invites.');free(c);const invite=crypto.randomBytes(12).toString('base64url');c.inviteHash=digest(invite);c.inviteUntil=now()+7*86400000;persist(c);return {invite};},
  list(user){return {campaigns:ids().map(read).filter(c=>c.members[user.id]).map(c=>({id:c.id,role:c.members[user.id].role,updatedAt:c.updatedAt,title:c.snapshot.game.story?.title??'Shared adventure'}))};},
  async turn(user,b){
   let c=requireMember(b.campaignId,user);touch(c,user);
   if(typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(b.requestId))throw fail(400,'Missing turn identity.');
   if(c.receipts?.some(x=>x.id===b.requestId&&x.by===user.id))return {...state(c,user),replayed:true};
   free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   if(b.snapshot||b.conversation||b.ruling||b.random)throw fail(400,'Send an action, not a replacement game state.');
   const snapshot=r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,user.id):c.snapshot;
   const order=r.turnOrderView(snapshot.game),pass=b.action?.type==='party-pass';
   if(pass&&c.owner!==user.id)throw fail(403,'Only the campaign host can pass an absent player’s turn.');
   if(order&&!order.mine&&!b.direct&&!pass)throw fail(409,'It is another character’s turn.');
   operations?.consume(user.id,'turns',150);locks.set(c.id,user.id);
   try{
    const result=await resolveTurn(snapshot,b,{ask:p=>ask(p,user),randomImpl,actorName:c.members[user.id].name});
    // A revoked membership or account must not commit after an asynchronous DM response.
    user.active?.();c=requireMember(c.id,user);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
    c.receipts=[...(c.receipts??[]),{id:b.requestId,by:user.id}].slice(-40);const out=advance(c,result.snapshot,user);return {...out,narration:result.narration,turn:result.turn};
   }finally{locks.delete(c.id);}
  },
  edit(user,b){
   const c=requireMember(b.campaignId,user);free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   let snapshot=r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,user.id):c.snapshot;const game={...snapshot.game};
   if(b.kind==='note'){if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000)throw fail(400,'Write a note of up to 1,000 characters.');snapshot={...snapshot,game:r.addJournalNote(game,b.text)};}
   else if(b.kind==='wield'){const hero=JSON.parse(snapshot.character);if(typeof b.name!=='string'||!r.weaponAttacks(r.gearedHero(hero,game)).some(w=>w.name===b.name&&!w.blocked))throw fail(400,'That weapon is not ready to use by your hero.');snapshot={...snapshot,game:{...game,wield:b.name}};}
   else if(b.kind==='training'){const hero=JSON.parse(snapshot.character);if(game.stage!=='inn'||game.npcCombat?.active||game.pendingSpell||!b.training||!r.validSkillTraining(b.training,hero))throw fail(400,'Choose valid training at the inn outside an encounter.');snapshot={...snapshot,game:{...game,skillTraining:b.training}};}
   else if(b.kind==='follower'){if(!['wait','resume','dismiss'].includes(b.action))throw fail(400,'Unknown companion action.');const result=r.manageFollower(game,b.id,b.action);if(result.error)throw fail(400,result.error);snapshot={...snapshot,game:result.game};}
   else if(b.kind==='advance')snapshot=require('./campaign-advancement.cjs').advanceCharacter(snapshot,b.character);
   else if(b.kind==='lead'){if(typeof b.id!=='string'||!game.story?.leads?.some(l=>l.id===b.id))throw fail(400,'Unknown quest lead.');snapshot={...snapshot,game:{...game,story:{...game.story,leads:game.story.leads.map(l=>l.id===b.id?{...l,done:!l.done}:l)}}};}
   else throw fail(400,'That campaign edit is not allowed.');
   return advance(c,snapshot,user);
  },
  removeAccount(id){for(const campaign of ids()){const c=read(campaign);if(c.members[id]){if(c.owner===id){fs.rmSync(file(c.id),{force:true});operations?.backup.remove('campaign-'+c.id);}else{delete c.members[id];if(r.isPartyGame(c.snapshot.game)){const lead=Object.keys(c.members)[0];if(c.snapshot.game.party.lead===id)c.snapshot=r.partyView(c.snapshot,lead);delete c.snapshot.game.party.members[id];c.snapshot.game.party.order=c.snapshot.game.party.order.filter(v=>v!==id);delete c.snapshot.game.turnOrder;}c.version++;persist(c);}}}},
 };
}
module.exports={createCampaigns,validSnapshot};
