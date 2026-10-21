// Real-time shared table (2026-10-21, the host's words: "the reaction time definitely needs some improvement. players
// should be able to see that another player is typing as soon as they start typing and actions should be sent to the
// shared table instantly."): held waits (long-polls) answered the moment a campaign changes, and who is here, typing or
// acting. Everything here lives in the account service's memory only: never in the snapshot, the campaign file or a
// backup, and gone on a restart (a device simply waits again).
//
// - A member's wait (campaigns.cjs `wait`, route campaign-wait) is held up to `waitMs` and answered as soon as the
//   campaign's version or its presence (who is here, typing, acting) differs from what the member last saw; at the
//   latest when it runs out, with the state as it is. Presence-only answers to one member are at least `presenceGap`
//   apart (600 ms; a change sooner is answered when the gap is up), so typing on and off cannot drive a member's device
//   faster than that; a new version, and a turn begun or ended, is answered at once.
// - At most `perMember` waits are open for one member (a second tab, a reload): a newer one answers the oldest at once.
//   At most `maxWaits` are open in all; past that a wait is refused (503) and the device tries again in a few seconds.
// - Typing is a flag per member, set by campaign-typing pings and cleared by the member, when they act (the turn's lock),
//   or `typingMs` after their last ping. Words are never sent or kept.
// - `presence()` and `locks()` are Maps that tell the waits when they change: a member arriving or leaving, a turn begun
//   or kept. campaigns.cjs uses them in place of its plain Maps, so presence and the turn lock need no other hooks.
// - The draft (2026-10-21, table-stream): while a turn is resolved, the narration the Dungeon Master has written so far
//   (`setDraft`, from the account service's streamed request) is kept for that campaign and sent with the answers to
//   members who follow it (`knownDraft`). It is display only: nothing is applied from it, and it is gone the moment the
//   turn ends (kept, refused or failed: the lock is let go) or a new one begins. Draft-only answers to one member are at
//   least `draftGap` apart (400 ms, so a few a second however fast the words come) and at most `draftBudget` in ten
//   minutes (past that a member simply sees the kept turn), so following a draft cannot run a device's allowances down.
const crypto=require('node:crypto');
const busyWords='The shared table has many players waiting. Your game will catch up in a moment.';
function createLive({now=Date.now,waitMs=25000,maxWaits=500,perMember=2,typingMs=10000,presenceGap=600,hereMs=15000,draftGap=400,draftBudget=600,draftMax=1800,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const waits=new Map(),typing=new Map(),lastAnswer=new Map(),versions=new Map(),pending=new Set(),lockSeq=new Map(),lockSeen=new Map(),drafts=new Map(),draftsSent=new Map();
 let open=0,flushing=null,presenceMap=null,lockMap=null,draftSeq=0;
 const key=(campaign,seat)=>campaign+':'+seat;
 const unref=t=>{t?.unref?.();return t;};
 const waitingFor=k=>{const [campaign]=k.split(':');for(const w of waits.get(campaign)??[])if(w.member===k)return true;return false;};
 // Who is here (a recent request or an open wait), who is typing and who is acting, as a short opaque key.
 function presenceKey(campaign){
  const here=[],prefix=campaign+':';
  for(const [k,t] of presenceMap??[])if(k.startsWith(prefix)&&(now()-t<hereMs||waitingFor(k)))here.push(k.slice(prefix.length));
  const typers=[...typing.keys()].filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));
  const text=JSON.stringify([here.sort(),typers.sort(),lockMap?.get(campaign)??null]);
  return crypto.createHash('sha256').update(text).digest('hex').slice(0,16);
 }
 const isTyping=(campaign,seat)=>typing.has(key(campaign,seat));
 function finish(w){
  if(w.done)return false;w.done=true;clearTimer(w.timer);clearTimer(w.later);open--;
  const list=waits.get(w.campaign);list?.delete(w);if(list&&!list.size)waits.delete(w.campaign);
  // The countdown to "away" starts when the wait ends, not when it began.
  if(presenceMap?.has(w.member))Map.prototype.set.call(presenceMap,w.member,now());
  return true;
 }
 // Ask a wait's own check whether there is something to tell; answer, or keep waiting.
 function look(w,force=false){
  if(w.done)return;
  let found;try{found=w.check(force);}catch(e){if(finish(w))w.reject(e);return;}
  if(!found)return;
  // A turn begun or ended since this member's last answer is news at once, like a new version: turns are few.
  const urgent=found.urgent||(lockSeq.get(w.campaign)??0)>(lockSeen.get(w.member)??0),draftOnly=!urgent&&found.draft===true;
  // Only the draft is new: a few a second at most, and not past the member's budget (they still get the kept turn).
  if(!force&&draftOnly&&spentDrafts(w.member)>=draftBudget)return;
  const gap=draftOnly?draftGap:presenceGap;
  if(!force&&!urgent){const since=now()-(lastAnswer.get(w.member)??0);if(since<gap){if(!w.later)w.later=unref(setTimer(()=>{w.later=null;look(w);},gap-since));return;}}
  if(finish(w)){lastAnswer.set(w.member,now());lockSeen.set(w.member,lockSeq.get(w.campaign)??0);if(draftOnly&&!force)draftsSent.get(w.member)?.push(now())??draftsSent.set(w.member,[now()]);for(const m of [lastAnswer,lockSeen,draftsSent])if(m.size>5000)m.delete(m.keys().next().value);w.resolve(found.answer);}
 }
 // Changes are gathered and looked at once, after the change has been written (persist) and the current request answered.
 function notify(campaign){
  if(campaign==null)return;pending.add(String(campaign));
  if(!flushing)flushing=setImmediate(()=>{flushing=null;const ids=[...pending];pending.clear();for(const id of ids)for(const w of [...waits.get(id)??[]])look(w);});
 }
 function setTyping(campaign,seat,on){
  const k=key(campaign,seat),was=typing.get(k);
  if(!on){if(!was)return false;clearTimer(was);typing.delete(k);notify(campaign);return true;}
  if(was)clearTimer(was);
  typing.set(k,unref(setTimer(()=>{typing.delete(k);notify(campaign);},typingMs)));
  if(!was)notify(campaign);return !was;
 }
 function clearMember(campaign,seat){setTyping(campaign,seat,false);lastAnswer.delete(key(campaign,seat));lockSeen.delete(key(campaign,seat));draftsSent.delete(key(campaign,seat));}
 // Draft answers sent to a member in the last ten minutes.
 function spentDrafts(member){const list=draftsSent.get(member);if(!list)return 0;while(list.length&&list[0]<=now()-600000)list.shift();return list.length;}
 // The narration so far of the turn the acting member (the lock's seat) is taking; anyone else's is ignored.
 function setDraft(campaign,seat,text){
  campaign=String(campaign);if(typeof text!=='string'||lockMap?.get(campaign)!==seat)return false;
  text=text.slice(0,draftMax);const was=drafts.get(campaign);if(was&&was.seat===seat&&was.text===text)return false;
  drafts.set(campaign,{seat,text,seq:++draftSeq});notify(campaign);return true;
 }
 function clearDraft(campaign){if(!drafts.delete(String(campaign)))return false;notify(campaign);return true;}
 const draft=campaign=>{const d=drafts.get(String(campaign));return d?{seat:d.seat,text:d.text}:null;};
 const draftKey=campaign=>{const d=drafts.get(String(campaign));return d?String(d.seq):'';};
 // check(force) returns {answer, urgent} when there is something to tell (always when forced), or null to keep waiting;
 // it may throw (the member was removed, the campaign is gone), which ends the wait with that error.
 function wait(campaign,seat,check,{signal,timeout=waitMs}={}){
  return new Promise((resolve,reject)=>{
   const member=key(campaign,seat),w={campaign:String(campaign),member,check,resolve,reject,done:false,timer:null,later:null};
   const mine=[...waits.get(w.campaign)??[]].filter(x=>x.member===member);
   for(const old of mine.slice(0,Math.max(0,mine.length-perMember+1)))look(old,true);
   if(open>=maxWaits)return reject(Object.assign(Error(busyWords),{status:503}));
   if(signal?.aborted)return reject(Object.assign(Error('The wait was cancelled.'),{status:499}));
   open++;if(!waits.has(w.campaign))waits.set(w.campaign,new Set());waits.get(w.campaign).add(w);
   // A device that went away (its wait let go, the tab closed) counts as away once hereMs pass with no request: the
   // others are told then, not only when their own waits run out.
   signal?.addEventListener?.('abort',()=>{if(finish(w)){reject(Object.assign(Error('The wait was cancelled.'),{status:499}));unref(setTimer(()=>notify(w.campaign),hereMs+100));}},{once:true});
   // Something to tell already (a newer version at once; a presence change once the gap is up), else hold it.
   look(w);if(!w.done)w.timer=unref(setTimer(()=>look(w,true),timeout));
  });
 }
 // A Map of presence times ('<campaign>:<seat>' → last request) that counts an open wait as here and tells the waits
 // when someone arrives (first seen, or back after being away) or leaves.
 function presence(){
  class Presence extends Map{
   get(k){return waitingFor(k)?now():super.get(k);}
   set(k,v){const was=super.get(k),away=was===undefined||(v-was>=hereMs&&!waitingFor(k));super.set(k,v);if(away)notify(String(k).split(':')[0]);return this;}
   delete(k){const had=super.delete(k);const [campaign,seat]=String(k).split(':');if(seat)clearMember(campaign,seat);if(had)notify(campaign);return had;}
  }
  return presenceMap=new Presence();
 }
 // The turn lock (campaign → acting seat): a member who begins a turn is acting and no longer typing. Each change is
 // counted, so a wait answers at once when a turn began or ended since that member's last answer.
 const bump=k=>lockSeq.set(String(k),(lockSeq.get(String(k))??0)+1);
 function locks(){
  class Locks extends Map{
   set(k,v){super.set(k,v);bump(k);setTyping(k,v,false);drafts.delete(String(k));notify(k);return this;}
   delete(k){const had=super.delete(k);drafts.delete(String(k));if(had){bump(k);notify(k);}return had;}
  }
  return lockMap=new Locks();
 }
 // The version each campaign is at (read or written), so a wait can tell whether it has news without reading the file.
 const seen=(campaign,version)=>{if(Number.isInteger(version))versions.set(String(campaign),version);};
 const changed=(campaign,version)=>{seen(campaign,version);notify(campaign);};
 const status=()=>({open,campaigns:waits.size,typing:typing.size,drafts:drafts.size});
 // Ends every wait (a test, or the service stopping).
 function close(){for(const list of [...waits.values()])for(const w of [...list])if(finish(w))w.reject(Object.assign(Error('The table service is restarting.'),{status:503}));for(const t of typing.values())clearTimer(t);typing.clear();drafts.clear();}
 return {wait,notify,changed,seen,setTyping,isTyping,setDraft,clearDraft,draft,draftKey,presenceKey,presence,locks,status,close,version:campaign=>versions.get(String(campaign)),open:(campaign,seat)=>waitingFor(key(campaign,seat)),waitMs,busyWords};
}
module.exports={createLive,busyWords};
