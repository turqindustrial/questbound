// What the AI has cost, and the host's ceilings on it. Worked out from the usage log (.questbound-usage.jsonl), read as
// it grows: every live request appends a line with its tokens, any painting and, for a guest, the guest's label (the
// account or guest identity the gateway named; never a name). Three kinds of spending are told apart: guests (players on
// the shared link and at shared tables), background work (tales written ahead for the stock, `adventure-ahead` with no
// label) and the host's own play on this PC (everything else).
// The host's ceilings, each read on every request (a change needs no restart), in US dollars or "off":
//  .questbound-guest-budget   all guests together, a day (5 unless set)
//  .questbound-player-budget  each guest, a day (40% of the guests' total unless set)
//  .questbound-total-budget   ALL spending, a day: guests, background work and the host's own play (8 unless set)
//  .questbound-month-budget   guests and background work together, a calendar month (30 unless set)
// Past a ceiling, guests are refused (their turns, new tales and new paintings) and background writing stops; the
// host's own play on this PC (no label) is never stopped. The file .questbound-guests-paused (any content; made by
// Questbound.cmd -PauseGuests) refuses all guest AI and background writing at once.
// Expensive requests also have counts of their own per guest (new tales, drafted heroes and paintings), so one guest
// identity cannot write tales or paintings in a loop even while the money lasts.
// Each day's totals are also kept in .questbound-spending.json (sums only, never who), so a month survives the usage
// log being rotated. Alerts (alerts.cjs) tell the host when guests pass half and nine tenths of their day, and when a
// ceiling is reached. `node dm-report.cjs` shows where today and the month stand.
// The running Dungeon Master keeps this module loaded between requests (it is not reloaded with dm-server.cjs);
// bump `revision` when it changes (and the literal in dm-server.cjs loadSpending) and the server loads it afresh.
const revision=3;
const fs=require('node:fs'),path=require('node:path');
delete require.cache[require.resolve('./alerts.cjs')];
const {createAlerts}=require('./alerts.cjs'),{createLimiter}=require('./rate-limit.cjs');
// Prices in US dollars per million tokens (input, cached input, output) and per painting. A model with no price on
// file, and every painting, is priced on the high side on purpose, so the allowance errs towards stopping early.
const prices={'gpt-6-luna':[0.10,0.01,0.50],'gpt-5.6-luna':[0.20,0.02,1.20]},unknownPrice=[2.5,0.25,10],paintingPrice=0.03;
const defaultBudget=5,guestShare=0.4,defaultTotal=8,defaultMonth=30;
// Counts per guest identity, apart from money: [how many, within how long].
const guestCounts={tale:[[6,3600000],[20,86400000]],hero:[[10,3600000],[30,86400000]],painting:[[40,3600000],[80,86400000]]};
const pausedFile='.questbound-guests-paused';
// None of these may match the game's busy-retry test (dmConnection.js), or the game would keep asking.
const words={
 paused:'The game is paused by the host. Your adventure is unchanged; try again later.',
 total:'The host\'s Dungeon Master has reached today\'s spending limit. Play resumes tomorrow; your adventure is unchanged.',
 month:'The host\'s Dungeon Master has reached this month\'s spending limit. Your adventure is unchanged; play resumes when the host raises the limit or next month.',
 guests:'The host\'s daily allowance for the Dungeon Master is used up. Play resumes tomorrow; your adventure is unchanged.',
 each:'You have had your share of the Dungeon Master for today. Play resumes tomorrow; your adventure is unchanged.',
 tale:'You have started several new tales in a short time. Carry on with your current tale, or start another a little later; your adventure is unchanged.',
 hero:'Many heroes have been drafted from this browser lately. Build one by hand, or draft another a little later.',
 painting:'Enough new pictures for now. Play on; more are painted later.',
};
const count=v=>Number.isFinite(v)&&v>0?v:0;
function costOf(entry){
 if(!entry||typeof entry!=='object')return 0;
 const p=prices[entry.model]??unknownPrice,input=count(entry.input),cached=Math.min(count(entry.cached),input);
 return ((input-cached)*p[0]+cached*p[1]+count(entry.output)*p[2])/1e6+count(entry.images)*paintingPrice;
}
// The host's calendar day and month (the PC's own time zone).
const dayOf=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const monthOf=t=>dayOf(t).slice(0,7);
function readBudget(file,fallback=defaultBudget){
 let raw;try{raw=fs.readFileSync(file,'utf8').replace(/^﻿/,'').trim().toLowerCase();}catch{return fallback;}
 if(raw==='off'||raw==='none')return null;
 const n=Number(raw.replace(/^\$/,''));return Number.isFinite(n)&&n>=0?n:fallback;
}
const money=n=>'$'+n.toFixed(2);
function createSpending({dir=process.env.QUESTBOUND_DATA||__dirname,now=Date.now,alerts=null}={}){
 const file=path.join(dir,'.questbound-usage.jsonl'),ledgerFile=path.join(dir,'.questbound-spending.json');
 const at=name=>path.join(dir,name),alert=alerts??createAlerts({dir,now});
 const guestLimit=()=>readBudget(at('.questbound-guest-budget')),totalLimit=()=>readBudget(at('.questbound-total-budget'),defaultTotal),monthLimit=()=>readBudget(at('.questbound-month-budget'),defaultMonth);
 const paused=()=>fs.existsSync(at(pausedFile));
 // Each player's limit: the host's own figure, else 40% of the guests' total (at least 50 cents); null for none.
 const eachLimit=limit=>{const own=readBudget(at('.questbound-player-budget'),'unset');return own!=='unset'?own:limit===null?null:Math.max(0.5,limit*guestShare);};
 let offset=0,rest='',identity=null,days=new Map(),saved={},savedAt=-Infinity,dirty=false;
 try{const s=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));if(s&&s.days&&typeof s.days==='object')saved=s.days;}catch{}
 const blank=()=>({all:0,guests:0,background:0,byGuest:new Map()});
 const add=entry=>{
  const t=Date.parse(entry?.at);if(!Number.isFinite(t))return;
  const day=dayOf(t);let d=days.get(day);if(!d){d=blank();days.set(day,d);}
  const cost=costOf(entry);d.all+=cost;dirty=true;
  if(typeof entry.guest==='string'&&entry.guest){d.guests+=cost;d.byGuest.set(entry.guest,(d.byGuest.get(entry.guest)??0)+cost);}
  else if(entry.mode==='adventure-ahead')d.background+=cost;
 };
 const take=text=>{for(const line of text.split('\n'))if(line.trim())try{add(JSON.parse(line));}catch{}};
 // A day's sums: what the log shows, or what was noted before the log was rotated, whichever is more.
 const totals=day=>{const d=days.get(day),s=saved[day]??{};return {all:Math.max(d?.all??0,count(s.all)),guests:Math.max(d?.guests??0,count(s.guests)),background:Math.max(d?.background??0,count(s.background))};};
 function persist(){
  if(!dirty||now()-savedAt<15000)return;
  for(const day of days.keys())saved[day]=totals(day);
  saved=Object.fromEntries(Object.keys(saved).sort().slice(-62).map(k=>[k,saved[k]]));
  try{fs.writeFileSync(ledgerFile+'.tmp',JSON.stringify({days:saved}));fs.renameSync(ledgerFile+'.tmp',ledgerFile);savedAt=now();dirty=false;}catch{}
 }
 // Reads only what was appended since the last look; a log that was rotated (dm-server renames it to .old past 5 MB)
 // or replaced is read afresh, the .old part included, so nothing spent today is forgotten.
 function catchUp(){
  let stat;try{stat=fs.statSync(file);}catch{stat=null;}
  const id=stat?stat.ino+':'+stat.birthtimeMs:null;
  if(!stat||id!==identity||stat.size<offset){offset=0;rest='';days=new Map();identity=id;try{take(fs.readFileSync(file+'.old','utf8'));}catch{}}
  if(stat&&stat.size!==offset){
   const fd=fs.openSync(file,'r');
   try{const length=stat.size-offset,buffer=Buffer.alloc(length);fs.readSync(fd,buffer,0,length,offset);offset=stat.size;const text=rest+buffer.toString('utf8'),cut=text.lastIndexOf('\n');rest=text.slice(cut+1);take(text.slice(0,cut+1));}
   finally{fs.closeSync(fd);}
  }
  while(days.size>40)days.delete(days.keys().next().value);
  persist();
 }
 const look=()=>{
  try{catchUp();}catch{}
  const day=dayOf(now()),month=monthOf(now());let monthly=0;
  for(const k of new Set([...days.keys(),...Object.keys(saved)]))if(k.startsWith(month)){const t=totals(k);monthly+=t.guests+t.background;}
  return {day,d:days.get(day)??blank(),t:totals(day),monthly};
 };
 // The ceilings that stop guests and background work alike; null when none is reached.
 function ceiling(){
  const {day,t,monthly}=look(),total=totalLimit(),month=monthLimit();
  if(total!==null&&t.all>=total){alert.raise('total-ceiling','today\'s AI spending reached the '+money(total)+' ceiling ('+money(t.all)+'). Guests and background writing are stopped until tomorrow; your own play continues.',{key:'total-ceiling:'+day,every:86400000});return 'total';}
  if(month!==null&&monthly>=month){alert.raise('month-ceiling','this month\'s guest and background spending reached the '+money(month)+' ceiling ('+money(monthly)+'). Guests are stopped; raise .questbound-month-budget to reopen.',{key:'month-ceiling:'+monthOf(now()),every:86400000});return 'month';}
  return null;
 }
 // May this guest ask for more today? The host (no guest label) always may.
 function check(guest){
  if(!guest)return {ok:true};
  if(paused())return {ok:false,status:503,reason:'paused',error:words.paused};
  const over=ceiling();if(over)return {ok:false,status:503,reason:over,error:words[over]};
  const limit=guestLimit(),each=eachLimit(limit);if(limit===null&&each===null)return {ok:true};
  const {day,d}=look();
  if(limit!==null&&limit>0){
   const share=d.guests/limit;
   if(share>=0.9)alert.raise('guests-90','guests have used '+Math.round(share*100)+'% of today\'s '+money(limit)+' allowance ('+money(d.guests)+'). Pause them with Questbound.cmd -PauseGuests if this looks wrong.',{key:'guests-90:'+day,every:86400000});
   else if(share>=0.5)alert.raise('guests-50','guests have used '+Math.round(share*100)+'% of today\'s '+money(limit)+' allowance ('+money(d.guests)+').',{key:'guests-50:'+day,every:86400000});
  }
  if(limit!==null&&d.guests>=limit)return {ok:false,status:503,reason:'guests',error:words.guests};
  if(each!==null&&(d.byGuest.get(guest)??0)>=each)return {ok:false,status:503,reason:'each',error:words.each};
  return {ok:true};
 }
 // Expensive requests counted per guest: a new tale ('tale'), a drafted hero ('hero') or a new painting ('painting').
 // Counted once allowed; the host is never counted.
 const counters=new Map();
 function allow(guest,kind){
  if(!guest||!guestCounts[kind])return {ok:true};
  let list=counters.get(kind);if(!list){list=guestCounts[kind].map(([max,span])=>createLimiter(max,span,{now,maxKeys:5000}));counters.set(kind,list);}
  for(const limit of list){const seconds=limit(guest);if(seconds)return {ok:false,status:429,reason:kind,retryAfter:seconds,error:words[kind]};}
  return {ok:true};
 }
 // May a new painting be made for whoever asked? Paintings already made are always shown.
 const mayPaint=guest=>!guest||(check(guest).ok&&allow(guest,'painting').ok);
 // May background work (tales written ahead for the stock) go on? Not while guests are paused or past a ceiling.
 function background(){if(paused())return {ok:false,reason:'paused'};const over=ceiling();return over?{ok:false,reason:over}:{ok:true};}
 function summary(){const {day,d,t,monthly}=look(),limit=guestLimit();return {day,month:monthOf(now()),all:t.all,guests:t.guests,background:t.background,guestCount:d.byGuest.size,topGuest:Math.max(0,...d.byGuest.values()),budget:limit,share:eachLimit(limit),total:totalLimit(),monthly,monthBudget:monthLimit(),paused:paused()};}
 return {check,allow,mayPaint,background,summary,paused};
}
const spending=createSpending();
module.exports={revision,prices,paintingPrice,defaultBudget,defaultTotal,defaultMonth,guestShare,guestCounts,words,pausedFile,costOf,dayOf,monthOf,readBudget,createSpending,spending};
