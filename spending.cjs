// What the AI has cost today, and the host's daily allowance for guests: players on phones (home Wi-Fi) and on the
// shared link. Worked out from the usage log (.questbound-usage.jsonl), read as it grows: every live request appends a
// line with its tokens, any painting and, for a guest, the guest's label (a scrambled form of their pairing, made by
// phone-server.cjs; never a name). Once guests together have used the day's allowance, or one guest their share of it,
// their turns, new tales and new paintings wait for tomorrow. The host's own play on this PC is never stopped.
// The allowance is the host's choice in .questbound-guest-budget: US dollars a day for all guests together (5 unless
// set), or "off"; and in .questbound-player-budget: US dollars a day for each player (40% of the total unless set; "off"
// for none). Both are read on every request, so a change needs no restart. `node dm-report.cjs` shows where today stands.
// The running Dungeon Master keeps this module loaded between requests (it is not reloaded with dm-server.cjs);
// bump `revision` when it changes and the server loads it afresh.
const revision=2;
const fs=require('node:fs'),path=require('node:path');
// Prices in US dollars per million tokens (input, cached input, output) and per painting. A model with no price on
// file, and every painting, is priced on the high side on purpose, so the allowance errs towards stopping early.
const prices={'gpt-6-luna':[0.10,0.01,0.50],'gpt-5.6-luna':[0.20,0.02,1.20]},unknownPrice=[2.5,0.25,10],paintingPrice=0.03;
const defaultBudget=5,guestShare=0.4;
const count=v=>Number.isFinite(v)&&v>0?v:0;
function costOf(entry){
 if(!entry||typeof entry!=='object')return 0;
 const p=prices[entry.model]??unknownPrice,input=count(entry.input),cached=Math.min(count(entry.cached),input);
 return ((input-cached)*p[0]+cached*p[1]+count(entry.output)*p[2])/1e6+count(entry.images)*paintingPrice;
}
// The host's calendar day (the PC's own time zone).
const dayOf=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function readBudget(file,fallback=defaultBudget){
 let raw;try{raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim().toLowerCase();}catch{return fallback;}
 if(raw==='off'||raw==='none')return null;
 const n=Number(raw.replace(/^\$/,''));return Number.isFinite(n)&&n>=0?n:fallback;
}
function createSpending({dir=process.env.QUESTBOUND_DATA||__dirname,now=Date.now}={}){
 const file=path.join(dir,'.questbound-usage.jsonl'),budgetFile=path.join(dir,'.questbound-guest-budget'),playerFile=path.join(dir,'.questbound-player-budget');
 // Each player's limit: the host's own figure, else 40% of the guests' total (at least 50 cents); null for none.
 const eachLimit=limit=>{const own=readBudget(playerFile,'unset');return own!=='unset'?own:limit===null?null:Math.max(0.5,limit*guestShare);};
 let offset=0,rest='',identity=null,days=new Map();
 const add=entry=>{
  const t=Date.parse(entry?.at);if(!Number.isFinite(t))return;
  const day=dayOf(t);let d=days.get(day);if(!d){d={all:0,guests:0,byGuest:new Map()};days.set(day,d);}
  const cost=costOf(entry);d.all+=cost;
  if(typeof entry.guest==='string'&&entry.guest){d.guests+=cost;d.byGuest.set(entry.guest,(d.byGuest.get(entry.guest)??0)+cost);}
 };
 const take=text=>{for(const line of text.split('\n'))if(line.trim())try{add(JSON.parse(line));}catch{}};
 // Reads only what was appended since the last look; a log that was rotated (dm-server renames it to .old past 5 MB)
 // or replaced is read afresh, the .old part included, so nothing spent today is forgotten.
 function catchUp(){
  let stat;try{stat=fs.statSync(file);}catch{stat=null;}
  const id=stat?stat.ino+':'+stat.birthtimeMs:null;
  if(!stat||id!==identity||stat.size<offset){offset=0;rest='';days=new Map();identity=id;try{take(fs.readFileSync(file+'.old','utf8'));}catch{}}
  if(!stat||stat.size===offset)return;
  const fd=fs.openSync(file,'r');
  try{const length=stat.size-offset,buffer=Buffer.alloc(length);fs.readSync(fd,buffer,0,length,offset);offset=stat.size;const text=rest+buffer.toString('utf8'),cut=text.lastIndexOf('\n');rest=text.slice(cut+1);take(text.slice(0,cut+1));}
  finally{fs.closeSync(fd);}
  while(days.size>8)days.delete(days.keys().next().value);
 }
 const today=()=>{try{catchUp();}catch{}return days.get(dayOf(now()))??{all:0,guests:0,byGuest:new Map()};};
 // May this guest ask for more today? The host (no guest label) always may.
 function check(guest){
  if(!guest)return {ok:true};
  const limit=readBudget(budgetFile),each=eachLimit(limit);if(limit===null&&each===null)return {ok:true};
  const d=today();
  if(limit!==null&&d.guests>=limit)return {ok:false,error:'The host\'s daily allowance for the Dungeon Master is used up. Play resumes tomorrow; your adventure is unchanged.'};
  if(each!==null&&(d.byGuest.get(guest)??0)>=each)return {ok:false,error:'You have had your share of the Dungeon Master for today. Play resumes tomorrow; your adventure is unchanged.'};
  return {ok:true};
 }
 function summary(){const d=today(),limit=readBudget(budgetFile);return {day:dayOf(now()),all:d.all,guests:d.guests,guestCount:d.byGuest.size,topGuest:Math.max(0,...d.byGuest.values()),budget:limit,share:eachLimit(limit)};}
 return {check,summary};
}
const spending=createSpending();
module.exports={revision,prices,paintingPrice,defaultBudget,guestShare,costOf,dayOf,readBudget,createSpending,spending};
