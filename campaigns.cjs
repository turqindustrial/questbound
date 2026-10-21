const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomic}=require('./operations.cjs'),{resolveTurn}=require('./server-turn.cjs'),{moderationLabel}=require('./bans.cjs');
const {createLive}=require('./campaign-live.cjs');
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const clean=text=>typeof text==='string'?text.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,40):'';
// Campaign invites (the host's words, 2026-10-21: "8 characters shown as 4 characters, a dash, and 4 more characters,
// all either numbers or capitol letters ... players can type lower case letters and it will count as correct"): eight
// of A-Z and 0-9 by crypto, shown as XXXX-XXXX; typed in any case, with or without the dash and spaces. Only a keyed
// hash of the code is kept (operations.keyed: an HMAC with the private storage key). Guessing is held back by the
// account service (invite-guard.cjs: wrong codes per caller and overall, kept across restarts). Long codes from before
// (16 characters, case as written) keep working until they expire.
const inviteAlphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function newInvite(){let code='';for(let i=0;i<8;i++)code+=inviteAlphabet[crypto.randomInt(inviteAlphabet.length)];return code.slice(0,4)+'-'+code.slice(4);}
function inviteForms(typed){
 if(typeof typed!=='string'||typed.length>40)return [];
 const raw=typed.trim(),code=raw.toUpperCase().replace(/[\s-]+/g,''),forms=[];
 if(/^[A-Z0-9]{8}$/.test(code))forms.push({code});
 if(/^[a-zA-Z0-9_-]{16}$/.test(raw))forms.push({old:raw});
 return forms;
}
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
// Moderation at a table (asked for by the host on 2026-10-13: "add per-player mute or report and a host ban"):
// - `moderate(text,user)` (the account service asks the Dungeon Master's content check, moderation.cjs) vets the name a
//   player gives at the table; it fails open.
// - The host may remove a member and keep them out (ban): the member's seat and hero leave the table and a keyed hash
//   of their identity is kept in the campaign (`banned`, with the name they had and a ref for unbanning). The removed
//   player's device is told calmly (`removed:true`); the campaign's invites are refused to them.
// - Any member may report another (report): reason, optional words and the last few lines that member typed at the
//   table (from the shared feed), named by seat, table name and pseudonymous label (bans.cjs), never account ids;
//   `onReport` hands it to the host's feedback notes (feedback-notes.cjs reportEntry).
const reportReasons=['harassment','hateful','sexual','spam','cheating','other'];
const banKey=(c,id)=>digest('questbound-table-ban-v1:'+c.id+':'+id);
const removedError=()=>Object.assign(fail(403,'The host of this table has removed you from it. Your own adventures on this device are not affected.'),{removed:true});
// What a member typed at this table, newest last: their lines in the shared feed (by seat; lines from before seats were
// recorded, by their table name).
function typedBy(snapshot,member){
 const lines=[];for(const turn of snapshot?.game?.playback??[])for(const e of turn?.events??[])if(e?.kind==='player'&&typeof e.text==='string'&&(e.speakerSeat?e.speakerSeat===member.seat:e.speakerName===member.name))lines.push(e.text.replace(/[\x00-\x1f]+/g,' ').slice(0,300));
 return lines.slice(-5);
}
function createCampaigns({dir,now=Date.now,operations,ask,randomImpl,moderate=null,onReport=null,live:liveOptions={}}={}){
 // Waits, typing and who is here or acting live in memory (campaign-live.cjs): its presence and lock Maps tell held
 // waits when someone arrives, leaves or begins a turn, and persist tells them of every new version.
 const live=createLive({now,...liveOptions});
 const r=require('./rules-engine.cjs').rules(),presence=live.presence(),locks=live.locks(),reports=new Map();
 const inviteHash=code=>'v2:'+(operations?.keyed?operations.keyed('campaign-invite-v2',code):digest('questbound-campaign-invite-v2:'+code));
 const inviteHashes=typed=>inviteForms(typed).map(f=>f.code?inviteHash(f.code):digest(f.old));
 const freshInvite=c=>{const invite=newInvite();c.inviteHash=inviteHash(invite.replace('-',''));c.inviteUntil=now()+7*86400000;return invite;};
 const nameCheck=async(name,user)=>{if(!moderate||!name)return;let verdict=null;try{verdict=await moderate(name,user);}catch{}if(verdict&&verdict.action&&verdict.action!=='allow')throw fail(400,typeof verdict.line==='string'&&verdict.line?verdict.line.slice(0,300):'Choose another name for the table.');};
 const isBanned=(c,user)=>(c.banned??[]).some(b=>b.hash===banKey(c,user.id));
 // A member leaves the table: their seat, their hero at a party table and their receipts (the party's lead passes on).
 const dropMember=(c,id)=>{const gone=c.members[id].seat;delete c.members[id];presence.delete(c.id+':'+gone);if(r.isPartyGame(c.snapshot.game)&&Object.keys(c.members).length){const lead=Object.values(c.members)[0].seat;if(c.snapshot.game.party.lead===gone)c.snapshot=r.partyView(c.snapshot,lead);delete c.snapshot.game.party.members[gone];c.snapshot.game.party.order=c.snapshot.game.party.order.filter(v=>v!==gone);delete c.snapshot.game.turnOrder;}c.receipts=(c.receipts??[]).filter(x=>x.by!==gone);};
 const ids=()=>{try{return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{32}\.json$/.test(n)).map(n=>n.slice(0,32));}catch{return [];}};
 const file=id=>{if(!/^[a-f0-9]{32}$/.test(id??''))throw fail(404,'Campaign not found.');return path.join(dir,id+'.json');};
 const persist=c=>{operations?.backup.put('campaign-'+c.id,c);atomic(file(c.id),c);live.changed(c.id,c.version);};
 // A table saved by an older build is brought to the current save format the first time it is read (saveMigrations.js,
 // SAVES.md), and so is a hero brought to a table; an upgraded copy the checks would refuse is never used.
 const upgraded=s=>{const u=r.upgradeAdventure(s);return u!==s&&validSnapshot(u)?u:s;};
 // A table of the retired one-hero kind (everyone played the host's hero) is read as a party with the host's hero in
 // the lead: every other member is then asked to bring a hero of their own (heroless, below) and joins at their seat.
 const partied=c=>{if(r.isPartyGame(c.snapshot?.game))return false;const owner=c.members?.[c.owner];if(!owner)return false;const next=r.startParty(c.snapshot,owner.seat,owner.name);if(!validSnapshot(next))return false;c.snapshot=next;return true;};
 const read=id=>{let c;try{c=JSON.parse(fs.readFileSync(file(id),'utf8'));}catch{throw fail(404,'Campaign not found.');}const was=c.snapshot;c.snapshot=upgraded(c.snapshot);if(seated(c)|partied(c)|c.snapshot!==was)persist(c);live.seen(c.id,c.version);return c;};
 const seat=(c,user)=>c.members[user.id].seat;
 const present=(c,place)=>now()-(presence.get(c.id+':'+place)??0)<15000;
 // When the current turn in a party fight began, kept on the server only: after 90 s anyone may pass it.
 const clock=c=>{const t=c.snapshot?.game?.turnOrder,e=t?.order?.[t.at];if(!e){const had=!!c.turnClock;delete c.turnClock;return had;}const key=t.round+':'+t.at+':'+e.id;if(c.turnClock?.key===key)return false;c.turnClock={key,since:now()};return true;};
 const requireMember=(id,user)=>{const c=read(id);if(!c.members[user.id]){if(isBanned(c,user))throw removedError();operations?.audit('campaign-access-denied',{account:user.id,campaign:id});throw fail(403,'You are not a member of this campaign.');}return c;};
 const free=c=>{if(locks.has(c.id))throw fail(423,'A turn is being resolved. Wait for it to finish.');};
 const touch=(c,user)=>presence.set(c.id+':'+seat(c,user),now());
 // What a member sees: memberState below, plus who is typing, a key for the presence they have seen (campaign-live.cjs)
 // and, while a turn is being resolved, the narration the Dungeon Master has written so far (display only, never stored).
 const state=(c,user,known)=>{const s=memberState(c,user,known),d=live.draft(c.id);return {...s,players:s.players.map(p=>({...p,typing:live.isTyping(c.id,p.id)})),presence:live.presenceKey(c.id),draftKey:live.draftKey(c.id),...(d?{draft:d}:{})};};
 // Nobody plays a table without a hero of their own (the host's words, 2026-10-21: "nobody should be "playing" the
 // multi player function without a character to actually take control of"): a member whose seat holds no hero (one
 // from a one-hero table, or whose hero died before the table began a new tale) is sent no adventure and may only
 // bring a hero (join with campaignId). A table with no tale yet (opened before one was chosen, or an old table on
 // the crossroads tale) plays nothing until its host starts one (tale).
 const heroless=(c,user)=>!r.isPartyGame(c.snapshot.game)?c.owner!==user.id:!c.snapshot.game.party.members[seat(c,user)];
 const taleless=c=>!r.hasTale(c.snapshot.game);
 const ready=(c,user)=>{if(heroless(c,user))throw Object.assign(fail(409,'Choose your hero and bring them to the table first.'),{needsHero:true});if(taleless(c))throw Object.assign(fail(409,c.owner===user.id?'Choose a tale for the table first.':'The host has not chosen a tale for this table yet.'),{needsTale:true});};
 const heroName=(c,place)=>{const g=c.snapshot.game;if(!r.isPartyGame(g))return place===c.members[c.owner]?.seat?JSON.parse(c.snapshot.character).name:null;const m=g.party.members[place];if(!m)return null;try{return JSON.parse(place===g.party.lead?c.snapshot.character:m.character).name??null;}catch{return null;}};
 // A hero brought to a table: a valid solo adventure with a living hero (what they carry comes with them).
 // Never a hero already at the table (a copy of another player's hero, or the same ready-made hero twice).
 const broughtHero=(b,c=null,place=null)=>{if(!validSnapshot(b?.snapshot)||r.isPartyGame(b.snapshot.game))throw fail(400,'Choose your hero before joining the table.');if(['dead','dying'].includes(b.snapshot.game.stage))throw fail(400,'That hero cannot travel now. Choose another hero for the table.');
  if(c&&r.isPartyGame(c.snapshot.game)&&Object.entries(r.settleParty(c.snapshot).members).some(([id,m])=>id!==place&&m.character===b.snapshot.character))throw fail(409,'That hero is already at this table. Choose another hero of your own.');return b.snapshot;};
 function memberState(c,user,known=-1){
  const players=Object.values(c.members).filter(m=>present(c,m.seat)).map(m=>({id:m.seat,name:m.name,role:m.role,acting:locks.get(c.id)===m.seat}));
  // Everyone seated, here or not (so a player can mute or report someone who has stepped away), and for the host the
  // people kept out of this table.
  const members=Object.values(c.members).map(m=>({id:m.seat,name:m.name,role:m.role,here:present(c,m.seat),hero:heroName(c,m.seat)}));
  // A member with no hero of their own here is sent no adventure (never another player's hero): only that they must
  // bring one. Everyone is told whether the table has a tale yet.
  const needsHero=heroless(c,user),needsTale=taleless(c);
  return {campaignId:c.id,version:c.version,you:seat(c,user),role:c.members[user.id].role,players,members,needsHero,needsTale,...(c.owner===user.id?{banned:(c.banned??[]).map(b=>({ref:b.ref,name:b.name,at:b.at}))}:{}),updatedAt:c.updatedAt,updatedBy:c.updatedBy,...(known!==c.version&&!needsHero?{snapshot:r.isPartyGame(c.snapshot.game)?r.partyView(c.snapshot,seat(c,user)):c.snapshot}:{})};
 }
 const advance=(c,snapshot,user)=>{if(!validSnapshot(snapshot))throw fail(400,'That adventure did not pass validation.');c.snapshot=snapshot;c.version++;c.updatedAt=new Date(now()).toISOString();c.updatedBy=c.members[user.id].name;clock(c);persist(c);return state(c,user);};
 function createNow(user,b){
   if(ids().length>=100)throw fail(507,'Campaign storage is full. Ask the host.');
   if(!validSnapshot(b.snapshot)||r.isPartyGame(b.snapshot.game))throw fail(400,'Start with your own valid solo adventure.');
   broughtHero(b);
   // A table plays a tale: the host's tale under way, or none yet (the game then opens it with none, and the host
   // chooses one before inviting anyone: startTale.js tableSnapshot).
   operations?.consume(user.id,'campaigns',5);
   // Every table is a party: each player brings their own hero (the one-hero kind is retired; `party` is ignored).
   const id=crypto.randomBytes(16).toString('hex'),name=clean(b.name)||'Host',place=newSeat();
   const snapshot=r.startParty(b.snapshot,place,name);
   const c={id,owner:user.id,members:{[user.id]:{name,role:'owner',seat:place}},version:1,updatedAt:new Date(now()).toISOString(),updatedBy:name,snapshot,receipts:[]};
   const invite=freshInvite(c);
   persist(c);touch(c,user);operations?.audit('campaign-created',{account:user.id,campaign:id});return {...state(c,user),invite};
 }
 const invited=invite=>{const hashes=inviteHashes(invite),found=hashes.length?ids().map(read).find(c=>c.inviteUntil>now()&&hashes.includes(c.inviteHash)):null;if(!found)throw Object.assign(fail(404,'That campaign invite is not right, or it has expired. Check the code with the table’s host.'),{inviteMiss:true});return found;};
 // Read again here (after the name check, which waits on the Dungeon Master) so nothing that changed meanwhile is lost.
 function joinNow(user,b){
   const c=b.campaignId?requireMember(b.campaignId,user):invited(b.invite);if(isBanned(c,user))throw removedError();free(c);
   // A member already seated keeps their hero. One with no hero here (or whose hero has died) brings one to their seat.
   if(c.members[user.id]){touch(c,user);const mine=r.settleParty(c.snapshot).members[seat(c,user)];if((mine&&mine.status!=='dead')||!b.snapshot)return state(c,user);
    const brought=r.joinParty(c.snapshot,seat(c,user),{...broughtHero(b,c,seat(c,user)),name:c.members[user.id].name});if(brought.error)throw fail(409,brought.error);return advance(c,brought.snapshot,user);}
   if(Object.keys(c.members).length>=12)throw fail(409,'This campaign is full.');
   // Whoever joins brings their own hero: nobody joins without one to control.
   const name=clean(b.name)||'Adventurer',place=newSeat(),joined=r.joinParty(c.snapshot,place,{...broughtHero(b,c,place),name});if(joined.error)throw fail(409,joined.error);
   c.members[user.id]={name,role:'player',seat:place};touch(c,user);return advance(c,joined.snapshot,user);
 }
 return {
  live,
  // The name a player gives is vetted first when a content check is configured (then the answer is a promise).
  create(user,b){if(b&&typeof b==='object')b={...b,snapshot:upgraded(b.snapshot)};return moderate?nameCheck(clean(b.name),user).then(()=>createNow(user,b)):createNow(user,b);},
  join(user,b){
   // By invite, or (a member already seated, bringing a hero to their seat) by the campaign's id.
   if(typeof b.campaignId==='string'&&b.invite===undefined)return joinNow(user,{...b,snapshot:b.snapshot===undefined?undefined:upgraded(b.snapshot)});
   if(!inviteForms(b.invite).length)throw fail(400,'Enter the campaign invite supplied by its host: eight letters and numbers, like K7Q2-9XMB.');
   b={...b,campaignId:undefined,snapshot:upgraded(b.snapshot)};const found=invited(b.invite);if(isBanned(found,user)){operations?.audit('campaign-ban-refused',{campaign:found.id});throw removedError();}
   return moderate&&!found.members[user.id]?nameCheck(clean(b.name),user).then(()=>joinNow(user,b)):joinNow(user,b);
  },
  poll(user,b){const c=requireMember(b.campaignId,user);touch(c,user);return state(c,user,b.knownVersion);},
  leave(user,b){const c=requireMember(b.campaignId,user);presence.delete(c.id+':'+seat(c,user));return {left:true};},
  // A held wait (route campaign-wait): the same view as poll, answered as soon as the version or who is here, typing or
  // acting differs from what this member last saw (knownVersion, knownPresence), else after about 25 s as it is. A
  // device that follows the draft (knownDraft: the draftKey it last saw) is also answered when the narration of a turn
  // being resolved grows, a few times a second at most (campaign-live.cjs draftGap); an older device never is.
  wait(user,b,{signal}={}){
   const c=requireMember(b.campaignId,user),place=seat(c,user),id=c.id;touch(c,user);
   const known=Number.isInteger(b.knownVersion)?b.knownVersion:-1,seen=typeof b.knownPresence==='string'?b.knownPresence.slice(0,32):'',following=typeof b.knownDraft==='string',drafted=following?b.knownDraft.slice(0,20):'';
   const check=force=>{const same=live.version(id)===known&&live.presenceKey(id)===seen,draftSame=!following||live.draftKey(id)===drafted;if(!force&&same&&draftSame)return null;const fresh=requireMember(id,user);return {answer:state(fresh,user,known),urgent:fresh.version!==known,draft:same&&!draftSame};};
   return live.wait(id,place,check,{signal});
  },
  // A typing ping (route campaign-typing): only "typing" or not, never the words; it lapses by itself (campaign-live.cjs).
  typing(user,b){
   const c=requireMember(b.campaignId,user);if(typeof b.typing!=='boolean')throw fail(400,'Say whether you are typing.');touch(c,user);
   const on=b.typing&&locks.get(c.id)!==seat(c,user);live.setTyping(c.id,seat(c,user),on);return {typing:on};
  },
  invite(user,b){const c=requireMember(b.campaignId,user);if(c.owner!==user.id)throw fail(403,'Only the campaign host can issue invites.');free(c);const invite=freshInvite(c);persist(c);return {invite};},
  list(user){return {campaigns:ids().map(read).filter(c=>c.members[user.id]).map(c=>({id:c.id,role:c.members[user.id].role,updatedAt:c.updatedAt,title:c.snapshot.game.story?.title??'Shared adventure'}))};},
  async turn(user,b){
   let c=requireMember(b.campaignId,user);touch(c,user);
   if(typeof b.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(b.requestId))throw fail(400,'Missing turn identity.');
   if(c.receipts?.some(x=>x.id===b.requestId&&x.by===seat(c,user)))return {...state(c,user),replayed:true};
   free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   if(b.snapshot||b.conversation||b.ruling||b.random)throw fail(400,'Send an action, not a replacement game state.');
   ready(c,user);
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
    // The Dungeon Master's narration is streamed: what it has written so far is the table's draft while the turn is
    // resolved (every member's held wait carries it), then the kept turn replaces it. Nothing is applied from it.
    const acting=seat(c,user),result=await resolveTurn(snapshot,b,{ask:p=>ask(p,user,{onNarration:text=>live.setDraft(c.id,acting,text)}),randomImpl,actorName:c.members[user.id].name,actorSeat:acting});
    live.clearDraft(c.id);
    // A revoked membership or account must not commit after an asynchronous DM response.
    user.active?.();c=requireMember(c.id,user);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
    c.receipts=[...(c.receipts??[]),{id:b.requestId,by:seat(c,user)}].slice(-40);const out=advance(c,result.snapshot,user);if(counted)operations?.consume(user.id,'turns',150,{spend:true});
    // What the acting player's device shows at once (ideas for the next move, an admitted fault, deeds and experience); none of it is stored.
    return {...out,narration:result.narration,turn:result.turn,suggestions:result.suggestions??[],fault:result.fault===true,deeds:result.deeds??[],xp:result.xp??null};
   }finally{locks.delete(c.id);}
  },
  // The host starts a tale for the whole table (there was no campaign route for one before 2026-10-21): a ready journey
  // from the Dungeon Master's library (asked for here, as a device asks: mode 'adventure', introId 'easy', journey,
  // easyStart) or a tale the host's device had written (Your own tale, a written opening), checked by the same rules
  // as a device's new tale (freshStoryGame) and the table's own checks (validSnapshot). The host's hero leads; every
  // member's living hero is seated in it with what they carry (partyRules.js partyInTale). Out of a fight only; a tale
  // still under way is replaced only when the host confirms it (replace).
  async tale(user,b){
   let c=requireMember(b.campaignId,user);touch(c,user);
   if(c.owner!==user.id)throw fail(403,'Only the table’s host chooses its tale.');
   free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   if(heroless(c,user))throw Object.assign(fail(409,'Bring your own hero to the table before choosing its tale.'),{needsHero:true});
   const world=r.isPartyGame(c.snapshot.game)?r.settleParty(c.snapshot).world:c.snapshot.game,story=world.story;
   if(world.turnOrder||world.npcCombat?.active||world.wildFight||world.dungeon?.active||world.pendingSpell||['combat','dying','dead'].includes(world.stage))throw fail(409,'Finish the fight before the table begins a new tale.');
   if(r.hasTale(world)&&story.introId!=='hostile'&&story.status!=='complete'&&b.replace!==true)throw fail(409,'The table is in the middle of '+String(story.title).slice(0,80)+'. Confirm to replace it with a new tale.');
   const journey=typeof b.journey==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.journey)?b.journey:null;
   if(!journey&&(!b.story||typeof b.story!=='object'||Array.isArray(b.story)||JSON.stringify(b.story).length>400000))throw fail(400,'Choose a ready journey or a tale for the table.');
   const introId=journey?'easy':['idea','surprise','easy','crown','drowned','sunforge','winter','deep','names','oath'].includes(b.introId)?b.introId:'surprise';
   locks.set(c.id,seat(c,user));
   try{
    let written=b.story;
    if(journey){
     if(!ask)throw fail(503,'The Dungeon Master is not reachable from the table just now. Try again soon.');
     const hero=JSON.parse(r.partyView(c.snapshot,seat(c,user)).character);
     const answer=await ask({input:'Create a fresh adventure for my character.',context:{mode:'adventure',introId:'easy',journey,easyStart:true,choices:[],player:{name:hero.name,species:r.heroSpecies(hero),class:hero.class,level:hero.level,background:hero.background,backstory:hero.backstory}}},user);
     written=answer?.story;if(!written||typeof written!=='object')throw fail(502,'The Dungeon Master did not hand over that journey. Choose another.');
    }
    // Nothing changed meanwhile, and the host is still the host.
    user.active?.();c=requireMember(c.id,user);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
    const begun=r.partyInTale(c.snapshot,seat(c,user),written,introId);if(begun.error)throw fail(409,begun.error);
    operations?.audit('campaign-tale',{campaign:c.id});
    const out=advance(c,begun.snapshot,user);return {...out,tale:{title:begun.snapshot.game.story.title,libraryId:begun.snapshot.game.story.libraryId??null}};
   }finally{locks.delete(c.id);}
  },
  edit(user,b){
   const c=requireMember(b.campaignId,user);free(c);if(b.baseVersion!==c.version)return {conflict:true,...state(c,user)};
   // Only for a hero of one's own (a table without a tale yet allows a hero's own choices: nothing is played).
   if(heroless(c,user))throw Object.assign(fail(409,'Choose your hero and bring them to the table first.'),{needsHero:true});
   const party=r.isPartyGame(c.snapshot.game);let snapshot=party?r.partyView(c.snapshot,seat(c,user)):c.snapshot,gained=null;const game={...snapshot.game};
   // In a one-hero campaign every member plays the host's hero; its lasting choices are the host's alone.
   if(!party&&c.owner!==user.id&&['advance','training','attune','portrait','wield','shield'].includes(b.kind))throw fail(403,'Only the campaign host makes lasting choices for the host’s hero.');
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
   // The hero's portrait (HeroFacePicker.js): a ready-made face, their own painting, or none; only the portrait changes.
   else if(b.kind==='portrait'){const hero=JSON.parse(snapshot.character),portrait=b.portrait===null?undefined:b.portrait;if(!r.validPortraitChoice(portrait))throw fail(400,'Choose a ready-made face or your own painting for your portrait.');const next={...hero};if(portrait===undefined)delete next.portrait;else next.portrait=portrait;if(!r.isValidCharacter(next))throw fail(400,'That portrait could not be kept.');snapshot={...snapshot,character:JSON.stringify(next)};}
   else if(b.kind==='lead'){if(typeof b.id!=='string'||!game.story?.leads?.some(l=>l.id===b.id))throw fail(400,'Unknown quest lead.');const hero=JSON.parse(snapshot.character),next={...game,story:{...game.story,leads:game.story.leads.map(l=>l.id!==b.id?l:l.done?{id:l.id,title:l.title,hook:l.hook}:{...l,done:true})}},xp=r.withExperience(game,next,hero);snapshot={...snapshot,game:r.withDeeds(r.withStoryLog(game,xp.game,hero,{}),hero).game};if(xp.gained>0)gained={amount:xp.gained,label:xp.labels.join(' · ')};}
   else throw fail(400,'That campaign edit is not allowed.');
   return {...advance(c,snapshot,user),...(gained?{xp:gained}:{})};
  },
  // The host removes a member and keeps them out of this campaign (by a keyed hash of their identity).
  ban(user,b){
   const c=requireMember(b.campaignId,user);if(c.owner!==user.id)throw fail(403,'Only the campaign host can remove a player.');free(c);
   const id=Object.keys(c.members).find(k=>c.members[k].seat===b.seat);if(!id)throw fail(404,'That player is no longer at this table.');if(id===c.owner)throw fail(400,'The host cannot remove themselves. Leave the table instead.');
   const hash=banKey(c,id),name=c.members[id].name;
   c.banned=[...(c.banned??[]).filter(x=>x.hash!==hash),{hash,ref:crypto.randomBytes(6).toString('hex'),name,at:new Date(now()).toISOString()}].slice(-50);
   dropMember(c,id);c.version++;c.updatedAt=new Date(now()).toISOString();c.updatedBy=c.members[user.id].name;clock(c);persist(c);
   operations?.audit('campaign-member-banned',{campaign:c.id});return state(c,user);
  },
  unban(user,b){
   const c=requireMember(b.campaignId,user);if(c.owner!==user.id)throw fail(403,'Only the campaign host can let a player back.');
   if(!(c.banned??[]).some(x=>x.ref===b.ref))throw fail(404,'That player is not kept out of this table.');
   c.banned=c.banned.filter(x=>x.ref!==b.ref);persist(c);operations?.audit('campaign-member-unbanned',{campaign:c.id});return state(c,user);
  },
  // A report on another member, for the host of the whole game. Five an hour from one player, one a member per ten minutes.
  report(user,b){
   const c=requireMember(b.campaignId,user),id=Object.keys(c.members).find(k=>c.members[k].seat===b.seat);
   if(!id||id===user.id)throw fail(400,'Choose another player at this table to report.');
   if(!reportReasons.includes(b.reason))throw fail(400,'Choose why you are reporting them.');
   if(b.words!=null&&(typeof b.words!=='string'||b.words.length>500))throw fail(400,'Write up to 500 characters.');
   const mine=(reports.get(user.id)??[]).filter(x=>x.at>now()-3600000);
   if(mine.length>=5)throw fail(429,'You have sent several reports this hour. The host will look at them; try again later.');
   if(mine.some(x=>x.seat===b.seat&&x.at>now()-600000))throw fail(429,'You reported this player a moment ago. The host has it.');
   if(!onReport)throw fail(503,'Reports are not collected here.');
   const target=c.members[id],from=c.members[user.id];
   onReport({campaign:c.id,title:String(c.snapshot.game.story?.title??'Shared adventure').slice(0,120),reason:b.reason,words:typeof b.words==='string'?b.words.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').trim():'',
    reported:{seat:target.seat,name:target.name,label:moderationLabel(id),host:id===c.owner},by:{seat:from.seat,name:from.name,label:moderationLabel(user.id)},lines:typedBy(c.snapshot,target)});
   mine.push({at:now(),seat:b.seat});reports.set(user.id,mine);if(reports.size>2000)reports.delete(reports.keys().next().value);
   operations?.audit('campaign-report',{campaign:c.id});return {reported:true};
  },
  removeAccount(id){for(const campaign of ids()){const c=read(campaign);if(c.members[id]){if(c.owner===id){fs.rmSync(file(c.id),{force:true});operations?.backup.remove('campaign-'+c.id);live.changed(c.id,-1);}else{dropMember(c,id);c.version++;clock(c);persist(c);}}}},
 };
}
module.exports={createCampaigns,validSnapshot,reportReasons,newInvite,inviteForms};
