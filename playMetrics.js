// Anonymous play counts on this device (the host's request of 2026-10-13: "anonymous counts of how long sessions last,
// where people quit and how many turns fail"). Per session the game keeps only mechanical counts: how long it was
// played, turns sent, turns that failed and how (refused by the rules, the Dungeon Master unreachable, another error,
// the shared table, a save, or a fault the Dungeon Master admitted), where the session ended (a fixed list of screens and
// stages), the tale opening chosen, how the wait for a written tale went, phone or desktop, and the build. Never what
// anyone typed, a name, a place, the hero or the story. When the page goes out of sight the record is sent to the host
// (/api/metrics: play-metrics.cjs checks it against a strict schema); a session that comes back sends it again, and the
// host's report keeps the last. Nothing is sent before this browser has accepted the current permissions agreement.
//
// The device is counted by a random metrics id of its own (not the guest identity, cookie or anything the Dungeon Master,
// feedback or a shared table sees), so returning devices can be counted while these records join to nothing else.
// Settings → Help improve Questbound turns the counts off; the id is then forgotten and nothing more is sent.
// The same setting holds whether to ask "How was that session?" (ratingRules.js) and when it was last asked.
import {agreementStatus} from './agreementRules';
import {subscribeProblems} from './problemLog';
import {pageBuild} from './feedbackRules';
export const insightKey='questbound.insight.v1';
const INSIGHT_IDLE=5*60000,INSIGHT_NEW_SESSION=30*60000;
const insightListeners=new Set();
const insightStore=()=>{try{return globalThis.localStorage??null;}catch{return null;}};
const randomHex=bytes=>{try{const a=new Uint8Array(bytes);globalThis.crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}};
export function readInsight(store=insightStore()){
 let saved={};try{saved=JSON.parse(store?.getItem(insightKey)??'{}')??{};}catch{}
 const r=saved.rating&&typeof saved.rating==='object'?saved.rating:{};
 const time=v=>Number.isFinite(v)?v:null;
 return {counts:saved.counts!==false,ask:saved.ask!==false,device:typeof saved.device==='string'&&/^[0-9a-f]{32}$/.test(saved.device)?saved.device:null,
  playSeconds:Number.isFinite(saved.playSeconds)&&saved.playSeconds>=0?Math.floor(saved.playSeconds):0,
  rating:{asked:time(r.asked),answered:time(r.answered),dismissed:time(r.dismissed),dismissals:Number.isInteger(r.dismissals)&&r.dismissals>=0?r.dismissals:0}};
}
function writeInsight(next,store=insightStore()){try{store?.setItem(insightKey,JSON.stringify(next));}catch{}insightListeners.forEach(fn=>{try{fn(next);}catch{}});return next;}
// Settings: {counts, ask}. Turning the counts off forgets the device's metrics id at once.
export function setInsight(change,store=insightStore()){
 const now=readInsight(store),next={...now,...change};
 if(next.counts===false)next.device=null;
 return writeInsight(next,store);
}
export function subscribeInsight(fn){insightListeners.add(fn);return()=>insightListeners.delete(fn);}
export function noteRatingShown(at=Date.now()){const i=readInsight();writeInsight({...i,rating:{...i.rating,asked:at}});}
export function noteRatingAnswered(at=Date.now()){const i=readInsight();writeInsight({...i,rating:{...i.rating,answered:at,dismissals:0}});}
export function noteRatingDismissed(at=Date.now()){const i=readInsight();writeInsight({...i,rating:{...i.rating,dismissed:at,dismissals:i.rating.dismissals+1}});}

// Where a session is, as one word from a fixed list (play-metrics.cjs metricsPlaces).
export function placeOf({launched=true,storyCover=false,screen='Home',inGame=false,stage=null,fighting=false,talking=false}={}){
 if(!launched)return 'launch';
 if(storyCover)return 'story-loading';
 if(screen==='Adventure'&&inGame){if(stage==='dead')return 'dead';if(stage==='dying')return 'dying';if(fighting)return 'fight';return talking?'talk':'explore';}
 return {'Home':'title','Character Selection':'heroes','Character Creation':'builder','Adventure Opening':'opening','Level Up':'level-up','Multiplayer':'table','Legal':'legal','Settings':'settings','Character Sheet':'pages','Campaign Journal':'pages','Followers':'pages','Dice Roller':'pages','Adventure':'heroes'}[screen]??'title';
}
// Phone, tablet or desktop, from the pointer and the screen's shorter side.
export function formOf(win=globalThis){
 let coarse=false;try{coarse=!!win?.matchMedia?.('(pointer: coarse)').matches;}catch{}
 const side=Math.min(win?.screen?.width??win?.innerWidth??1024,win?.screen?.height??win?.innerHeight??768);
 return coarse?(side<600?'phone':'tablet'):'desktop';
}
// A failed turn's kind, from the problem log's entry (problemLog.js): only the kind and, for the Dungeon Master,
// whether it could not be reached; the words themselves stay on the device.
export function failureOf(problem){
 if(!problem||typeof problem!=='object')return null;
 if(problem.kind==='dm')return /took too long|not answering|offline|unreachable|could not reach|failed to fetch|networkerror|load failed|not running|unavailable|timed out/i.test(String(problem.error??''))?'unreachable':'error';
 return ['refused','table','save','reported'].includes(problem.kind)?problem.kind:null;
}

let session=null,talkingNow=false,lastPersist=0;
function startSession(now){
 session={id:randomHex(8)??'0000000000000000',started:now,lastActive:now,active:0,seq:0,turns:0,failed:{},place:'launch',tale:null,easy:null,wait:{started:0,done:0,failed:0,waited:0,since:null},sent:null,first:false};
 return session;
}
const current=()=>session??startSession(Date.now());
// Time counts while someone is playing: from one tap or key to the next, up to five minutes apart (a longer gap is
// someone away from the screen).
export function notePlayActivity(now=Date.now()){
 const s=current(),gap=now-s.lastActive;
 const counted=gap>0&&gap<=INSIGHT_IDLE?gap:0;
 s.active+=counted;s.lastActive=Math.max(s.lastActive,now);
 persistPlaySeconds(counted,now-lastPersist>60000);if(now-lastPersist>60000)lastPersist=now;
}
let unsavedPlay=0;
function persistPlaySeconds(ms,flush){unsavedPlay+=ms;if(!flush)return;const i=readInsight();writeInsight({...i,playSeconds:i.playSeconds+Math.floor(unsavedPlay/1000)});unsavedPlay%=1000;}
export const sessionSeconds=(now=Date.now())=>{const s=current();return Math.floor((s.active+Math.min(Math.max(0,now-s.lastActive),60000))/1000);};
export const deviceSeconds=()=>readInsight().playSeconds+Math.floor(unsavedPlay/1000);
export function countTurn(){current().turns++;}
export function notePlace(place){current().place=place;}
export function noteTalking(on){talkingNow=!!on;}
export const talking=()=>talkingNow;
export function noteTale(introId,easy){const s=current();s.tale=typeof introId==='string'?introId:null;s.easy=typeof easy==='boolean'?easy:null;}
export function noteStoryWait(state,now=Date.now()){
 const w=current().wait;
 if(state==='start'){w.started++;w.since=now;return;}
 if(w.since==null)return;
 const waited=Math.max(0,Math.round((now-w.since)/1000));w.since=null;
 if(state==='done'){w.done++;w.waited+=waited;}else w.failed++;
}
function noteFailure(kind){if(!kind)return;const f=current().failed;f[kind]=(f[kind]??0)+1;}
// The mechanical counts of this session so far, for the rating card: minutes, turns, failed turns, device, build.
export function sessionSummary(now=Date.now()){
 const s=current();
 return {minutes:Math.min(1440,Math.floor(sessionSeconds(now)/60)),turns:Math.min(5000,s.turns),failed:Math.min(5000,['refused','unreachable','error','table'].reduce((t,k)=>t+(s.failed[k]??0),0)),form:formOf(),build:pageBuild()};
}
// The record for this session (the shape play-metrics.cjs accepts), or null while counts are off.
export function playRecord(now=Date.now(),{store=insightStore(),created=null}={}){
 const s=current(),i=readInsight(store);
 if(!i.counts||!i.device)return null;
 const cap=(n,max)=>Math.max(0,Math.min(max,Math.floor(n)));
 const span=cap((now-s.started)/1000,86400),place=s.place==='explore'&&talkingNow?'talk':s.place;
 return {v:1,device:i.device,session:s.id,seq:cap(s.seq,500),first:created??s.first,build:pageBuild(),form:formOf(),active:Math.min(cap(sessionSeconds(now),86400),span+60),span,turns:cap(s.turns,5000),
  failed:Object.fromEntries(Object.entries(s.failed).map(([k,v])=>[k,cap(v,5000)])),ended:place,tale:s.tale,easy:s.easy,
  wait:{started:cap(s.wait.started,50),done:cap(s.wait.done,50),failed:cap(s.wait.failed,50),waited:cap(s.wait.waited,86400),pending:s.wait.since==null?0:cap(Math.max(1,(now-s.wait.since)/1000),86400)}};
}
// Sends the record when it has changed since the last one sent: sendBeacon (survives the page closing), else fetch
// with keepalive. Only in a browser, only with the counts on and the current agreement accepted.
export function sendPlayRecord(now=Date.now()){
 try{
  if(typeof globalThis.location==='undefined'||!agreementStatus().accepted)return false;
  let i=readInsight();if(!i.counts)return false;
  const s=current();
  if(!i.device){const id=randomHex(16);if(!id)return false;i=writeInsight({...i,device:id});s.first=true;}
  persistPlaySeconds(0,true);
  const record=playRecord(now),key=JSON.stringify({...record,seq:0});
  if(!record||key===s.sent)return false;
  s.sent=key;s.seq=Math.min(500,s.seq+1);
  const body=JSON.stringify(record),nav=globalThis.navigator;
  let queued=false;try{queued=!!nav?.sendBeacon?.('/api/metrics',new Blob([body],{type:'text/plain'}));}catch{}
  if(!queued)fetch('/api/metrics',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body}).catch(()=>{});
  return true;
 }catch{return false;}
}
// Wires the counts to the page: activity, failures from the problem log, and sending when the page is hidden or left.
// A session hidden for half an hour ends there; coming back starts a new one.
let insightStarted=false;
export function startPlayMetrics(){
 if(insightStarted||typeof globalThis.addEventListener!=='function')return;
 insightStarted=true;current();
 const seen=new Set();
 subscribeProblems(list=>{for(const p of list??[]){if(!p?.id||seen.has(p.id))continue;seen.add(p.id);noteFailure(failureOf(p));}});
 const active=()=>notePlayActivity(Date.now());
 for(const name of ['pointerdown','keydown','touchstart','wheel'])globalThis.addEventListener(name,active,{passive:true,capture:true});
 let hiddenAt=null;
 globalThis.document?.addEventListener?.('visibilitychange',()=>{
  const now=Date.now();
  if(globalThis.document.visibilityState==='hidden'){hiddenAt=now;sendPlayRecord(now);return;}
  if(hiddenAt!=null&&now-hiddenAt>INSIGHT_NEW_SESSION){const keep=session;startSession(now);session.place=keep?.place??'title';session.tale=null;}
  else if(session)session.lastActive=now;
  hiddenAt=null;
 });
 globalThis.addEventListener('pagehide',()=>sendPlayRecord(Date.now()));
}
