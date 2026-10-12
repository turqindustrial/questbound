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
// Every member has an opaque seat for this campaign: the party, the turn order, presence and receipts use it, so no
// player ever sees another's account id (an unsalted hash of their email). Tables saved before seats are given them on
// first read: every key or string equal to a member's account id is replaced by their seat.
const newSeat=()=>'seat-'+crypto.randomBytes(8).toString('hex');
const renamed=(value,map)=>Array.isArray(value)?value.map(v=>renamed(v,map)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[Object.hasOwn(map,k)?map[k]:k,renamed(v,map)])):typeof value==='string'&&Object.hasOwn(map,value)?map[value]:value;
function seated(c){
 const map={};for(const [id,m] of Object.entries(c.members??{}))if(typeof m.seat!=='string'||!/^seat-[a-f0-9]{16}$/.test(m.seat)){m.seat=newSeat();map[id]=m.seat;}
 if(!Object.keys(map).length)return false;
 c.snapshot=renamed(c.snapshot,map);c.receipts=(c.receipts??[]).map(x=>Object.hasOwn(map,x.by)?{...x,by:map[x.by]}:x);delete c.turnClock;return true;
}
function createCampaigns({dir,now=Date.now,operations,ask,randomImpl}={}){
 const r=require('./rules-engine.cjs').rules(),presence=new Map(),locks=new Map();
 const ids=()=>{try{return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{32}\.json$/.test(n)).map(n=>n.slice(0,32));}catch{return [];}};
 const file=id=>{if(!/^[a-f0-9]{32}$/.test(id??''))throw fail(404,'Campaign not found.');return path.join(dir,id+'.json');};
 const persist=c=>{operations?.backup.put('campaign-'+c.id,c);atomic(file(c.id),c);};
 const read=id=>{let c;try{c=JSON.parse(fs.readFileSync(file(id),'utf8'));}catch{throw fail(404,'Campaign not found.');}if(seated(c))persist(c);return c;};
 const seat=(c,user)=>c.members[user.id].seat;
 const present=(c,place)=>now()-(presence.get(c.id+':'+place)??0)<15000;
 // When the current turn in a party fight began, kept on the server only: after 90 s anyone may pass it.
 const clock=c=>{const t=c.snapshot?.game?.turnOrder,e=t?.order?.[t.at];if(!e){const had=!!c.turnClock;delete c.turnClock;return had;}const key=t.round+':'+t.at+':'+e.id;if(c.turnClock?.key===key)return false;c.turnClock={key,since:now()};return true;};
 const requireMember=(id,user)=>{const c=read(id);if(!c.members[user.id]){operations?.audit('campaign-access-denied',{account:user.id,campaign:id});throw fail(403,'You are not a member of this campaign.');}return c;};
 const free=c=>{if(locks.has(c.id))throw fail(423,'A turn is being resolved. Wait for it to finish.');};
 const touch=(c,user)=>presence.set(c.id+':'+seat(c,user),now());
 function state(c,user,known=-1){
  const players=Object.values(c.members).filter(m=>present(c,m.seat)).map(m=>({id:m.seat,name:m.name,role:m.role,acting:locks.get(c.id)===m.seat}));
  return {campaignId:c.id,version:c.version,you:seat(c,user),role:c.members[user.id].role,players,updatedAt:c.updatedAt,updatedBy:c.updatedBy,...(known!==c.version?{snapshot:r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,seat(c,user)):c.snapshot}:{})};
 }
 const advance=(c,snapshot,user)=>{if(!validSnapshot(snapshot))throw fail(400,'That adventure did not pass validation.');c.snapshot=snapshot;c.version++;c.updatedAt=new Date(now()).toISOString();c.updatedBy=c.members[user.id].name;clock(c);persist(c);return state(c,user);};
 return {
  create(user,b){
   if(ids().length>=100)throw fail(507,'Campaign storage is full. Ask the host.');
   if(!validSnapshot(b.snapshot)||r.isPartyGame(b.snapshot.game))throw fail(400,'Start with your own valid solo adventure.');
   operations?.consume(user.id,'campaigns',5);
   const id=crypto.randomBytes(16).toString('hex'),invite=crypto.randomBytes(12).toString('base64url'),name=clean(b.name)||'Host',place=newSeat();
   const snapshot=b.party===false?b.snapshot:r.startParty(b.snapshot,place,name);
   const c={id,owner:user.id,members:{[user.id]:{name,role:'owner',seat:place}},inviteHash:digest(invite),inviteUntil:now()+7*86400000,version:1,updatedAt:new Date(now()).toISOString(),updatedBy:name,snapshot,receipts:[]};
   persist(c);touch(c,user);operations?.audit('campaign-created',{account:user.id,campaign:id});return {...state(c,user),invite};
  },
  join(user,b){
   if(typeof b.invite!=='string'||!/^[a-zA-Z0-9_-]{16}$/.test(b.invite))throw fail(400,'Enter the campaign invite supplied by its host.');
   const hash=digest(b.invite),c=ids().map(read).find(c=>c.inviteUntil>now()&&c.inviteHash===hash);if(!c)throw fail(404,'Campaign invite is invalid or expired.');free(c);
   if(c.members[user.id]){touch(c,user);if(r.isPartyGame(c.snapshot.game)&&r.settleParty(c.snapshot).members[seat(c,user)]?.status==='dead'&&validSnapshot(b.snapshot)){const revived=r.joinParty(c.snapshot,seat(c,user),{...b.snapshot,name:c.members[user.id].name});if(revived.error)throw fail(409,revived.error);return advance(c,revived.snapshot,user);}return state(c,user);}
   if(Object.keys(c.members).length>=12)throw fail(409,'This campaign is full.');
   let snapshot=c.snapshot;const name=clean(b.name)||'Adventurer',place=newSeat();
   if(r.isPartyGame(snapshot.game)){
    if(!validSnapshot(b.snapshot))throw fail(400,'Choose your hero and start an adventure before joining.');
    const joined=r.joinParty(snapshot,place,{...b.snapshot,name});if(joined.error)throw fail(409,joined.error);snapshot=joined.snapshot;
   }
   c.members[user.id]={name,role:'player',seat:place};touch(c,user);return advance(c,snapshot,user);
  },
  poll(user,b){const c=requireMember(b.campaignId,user);touch(c,user);return state(c,user,b.knownVersion);},
  leave(user,b){const c=requireMember(b.campaignId,user);presence.delete(c.id+':'+seat(c,user));return {left:true};},
  invite(user,b){const c=requireMember(b.campaignId,user);if(c.owner!==user.id)throw fail(403,'Only the campaign host can issue invites.');free(c);const invite=crypto.randomBytes(12).toString('base64url');c.inviteHash=digest(invite);c.inviteUntil=now()+7*86400000;persist(c);return {invite};},
  list(user){return {campaigns:ids().map(read).filter(c=>c.members[user.id]).map(c=>({id:c.id,role:c.members[user.id].role,updatedAt:c.updatedAt,title:c.snapshot.game.story?.title??'Shared adventure'}))};},
  async turn(user,b){
   let c=requireMember(b.campaignId,user);touch(c,user);
   if(typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(b.requestId))throw fail(400,'Missing turn identity.');
   if(c.receipts?.some(x=>x.id===b.requestId&&x.by===seat(c,user)))return {...state(c,user),replayed:true};
   free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   if(b.snapshot||b.conversation||b.ruling||b.random)throw fail(400,'Send an action, not a replacement game state.');
   const snapshot=r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,seat(c,user)):c.snapshot;
   const order=r.turnOrderView(snapshot.game),pass=b.action?.type==='party-pass',direct=b.direct===true;
   // AGENTS: after 90 s, or at once when that hero's player is not at the table, anyone may pass a hero's turn; the
   // host always may. The server keeps when the turn began (clock) and who is present.
   if(pass&&order&&!order.mine&&c.owner!==user.id){
    if(clock(c))persist(c);
    if(order.current?.kind!=='hero'||(present(c,order.current.id)&&now()-c.turnClock.since<90000))throw fail(403,'Wait a minute and a half before passing a player’s turn, unless they have left the table.');
   }
   if(order&&!order.mine&&!direct&&!pass)throw fail(409,'It is another character’s turn.');
   // The day's turn allowance is checked now and spent only when the turn is kept; the host's own desktop is never capped.
   const counted=user.local!==true;if(counted)operations?.consume(user.id,'turns',150,{peek:true});locks.set(c.id,seat(c,user));
   try{
    const result=await resolveTurn(snapshot,b,{ask:p=>ask(p,user),randomImpl,actorName:c.members[user.id].name});
    // A revoked membership or account must not commit after an asynchronous DM response.
    user.active?.();c=requireMember(c.id,user);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
    c.receipts=[...(c.receipts??[]),{id:b.requestId,by:seat(c,user)}].slice(-40);const out=advance(c,result.snapshot,user);if(counted)operations?.consume(user.id,'turns',150,{spend:true});
    // What the acting player's device shows at once (ideas for the next move, an admitted fault, deeds and experience); none of it is stored.
    return {...out,narration:result.narration,turn:result.turn,suggestions:result.suggestions??[],fault:result.fault===true,deeds:result.deeds??[],xp:result.xp??null};
   }finally{locks.delete(c.id);}
  },
  edit(user,b){
   const c=requireMember(b.campaignId,user);free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   const party=r.isPartyGame(c.snapshot.game);let snapshot=party?r.partyView(c.snapshot,seat(c,user)):c.snapshot,gained=null;const game={...snapshot.game};
   // In a one-hero campaign every member plays the host's hero; its lasting choices are the host's alone.
   if(!party&&c.owner!==user.id&&['advance','training','attune','wield','shield'].includes(b.kind))throw fail(403,'Only the campaign host makes lasting choices for the host’s hero.');
   if(b.kind==='note'){if(typeof b.text!=='string'||!b.text.trim()||b.text.length>1000)throw fail(400,'Write a note of up to 1,000 characters.');snapshot={...snapshot,game:r.addJournalNote(game,b.text)};}
   else if(b.kind==='wield'){const hero=JSON.parse(snapshot.character);if(typeof b.name!=='string'||!r.canTakeInHand(r.gearedHero(hero,game),b.name))throw fail(400,'That weapon is not ready to use by your hero.');snapshot={...snapshot,game:{...game,wield:b.name}};}
   // The shield on the back (both hands free) or taken up again: free out of a fight; in one it is the hero's action,
   // taken as a turn ({type:'shield'} through campaign-turn).
   else if(b.kind==='shield'){const hero=JSON.parse(snapshot.character);if(typeof b.away!=='boolean'||(b.weapon!=null&&(typeof b.weapon!=='string'||b.weapon.length>60)))throw fail(400,'Say whether the shield goes on your back or on your arm.');if(game.stage==='combat'||game.npcCombat?.active||game.party?.stage==='combat'||['dying','dead'].includes(game.stage))throw fail(400,'In a fight, putting your shield on or off takes your action: say it on your turn.');const done=r.setShield(game,hero,b.away,b.weapon??null);if(done.error)throw fail(400,done.error);snapshot={...snapshot,game:{...done.game,log:[done.line,...(done.game.log??[])].slice(0,40)}};}
   else if(b.kind==='training'){const hero=JSON.parse(snapshot.character);if(game.stage!=='inn'||game.npcCombat?.active||game.pendingSpell||!b.training||!r.validSkillTraining(b.training,hero))throw fail(400,'Choose valid training at the inn outside an encounter.');snapshot={...snapshot,game:{...game,skillTraining:b.training}};}
   else if(b.kind==='follower'){if(!['wait','resume','dismiss','call'].includes(b.action))throw fail(400,'Unknown companion action.');const result=r.manageFollower(game,b.id,b.action);if(result.error)throw fail(400,result.error);snapshot={...snapshot,game:result.game};}
   else if(b.kind==='accept-offer'){const hero=JSON.parse(snapshot.character),result=r.acceptOffer(hero,game,b.id);if(result.error)throw fail(400,result.error);snapshot={...snapshot,game:result.game};}
   else if(b.kind==='attune'){const hero=JSON.parse(snapshot.character);if(typeof b.name!=='string')throw fail(400,'Choose an item to attune to.');const done=r.attuneItem(game,hero,b.name);if(done.error)throw fail(400,done.error);snapshot={...snapshot,game:{...done.game,log:[...done.lines,...(done.game.log??[])].slice(0,40)}};}
   else if(b.kind==='advance')snapshot=require('./campaign-advancement.cjs').advanceCharacter(snapshot,b.character);
   else if(b.kind==='lead'){if(typeof b.id!=='string'||!game.story?.leads?.some(l=>l.id===b.id))throw fail(400,'Unknown quest lead.');const hero=JSON.parse(snapshot.character),next={...game,story:{...game.story,leads:game.story.leads.map(l=>l.id!==b.id?l:l.done?{id:l.id,title:l.title,hook:l.hook}:{...l,done:true})}},xp=r.withExperience(game,next,hero);snapshot={...snapshot,game:r.withDeeds(r.withStoryLog(game,xp.game,hero,{}),hero).game};if(xp.gained>0)gained={amount:xp.gained,label:xp.labels.join(' · ')};}
   else throw fail(400,'That campaign edit is not allowed.');
   return {...advance(c,snapshot,user),...(gained?{xp:gained}:{})};
  },
  removeAccount(id){for(const campaign of ids()){const c=read(campaign);if(c.members[id]){if(c.owner===id){fs.rmSync(file(c.id),{force:true});operations?.backup.remove('campaign-'+c.id);}else{const gone=c.members[id].seat;delete c.members[id];if(r.isPartyGame(c.snapshot.game)){const lead=Object.values(c.members)[0].seat;if(c.snapshot.game.party.lead===gone)c.snapshot=r.partyView(c.snapshot,lead);delete c.snapshot.game.party.members[gone];c.snapshot.game.party.order=c.snapshot.game.party.order.filter(v=>v!==gone);delete c.snapshot.game.turnOrder;}c.receipts=(c.receipts??[]).filter(x=>x.by!==gone);c.version++;clock(c);persist(c);}}}},
 };
}
module.exports={createCampaigns,validSnapshot};
