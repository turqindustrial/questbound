// Wrong campaign invite codes, counted so that guessing one stays impractical (2026-10-21: invites became eight
// letters and numbers, 36^8, about 2.8e12 codes). Each caller (the visitor address the gateway names in
// X-Questbound-Client, or this PC) may get a code wrong a few times an hour and a day, and the whole game a few hundred
// times a day; past that, joins by invite wait. Kept in a file beside the accounts (only hashes of callers, never an
// address) so a restart forgets nothing. A right code is never counted.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomic}=require('./operations.cjs');
const hour=3600000,day=86400000;
const inviteLimits={callerHour:10,callerDay:30,allHour:100,allDay:500};
function createInviteGuard({file,now=Date.now,limits={}}={}){
 const max={...inviteLimits,...limits};
 let misses={};try{misses=JSON.parse(fs.readFileSync(file,'utf8'))??{};}catch{}
 const key=caller=>crypto.createHash('sha256').update('questbound-invite-caller-v1:'+String(caller)).digest('hex').slice(0,32);
 const recent=list=>(Array.isArray(list)?list:[]).filter(t=>Number.isFinite(t)&&t>now()-day);
 const wait=(list,most,span)=>{const within=list.filter(t=>t>now()-span);return within.length>=most?Math.max(1,Math.ceil((within[within.length-most]+span-now())/1000)):0;};
 // Seconds to wait before this caller may try a code again, and whose limit it is; 0 when they may.
 function blocked(caller){
  const mine=recent(misses[key(caller)]),all=recent(misses.all);
  const seconds=Math.max(wait(mine,max.callerHour,hour),wait(mine,max.callerDay,day));if(seconds)return {seconds,whose:'caller'};
  const overall=Math.max(wait(all,max.allHour,hour),wait(all,max.allDay,day));return overall?{seconds:overall,whose:'all'}:null;
 }
 function miss(caller){
  const k=key(caller),t=now();misses[k]=[...recent(misses[k]),t];misses.all=[...recent(misses.all),t];
  // Callers with nothing recent are let go, and the file never grows past a few thousand callers.
  for(const [id,list] of Object.entries(misses))if(id!=='all'&&!recent(list).length)delete misses[id];
  const callers=Object.keys(misses).filter(id=>id!=='all');if(callers.length>4000)for(const id of callers.slice(0,callers.length-4000))delete misses[id];
  try{fs.mkdirSync(path.dirname(file),{recursive:true});atomic(file,misses);}catch{}
 }
 return {blocked,miss};
}
// What a player is told: calm, and never the busy-Dungeon-Master words the game retries on.
const inviteWords={caller:'Too many wrong invite codes from here. Wait a while, then check the code with the table’s host.',all:'Too many wrong invite codes have been tried today. Try again later, or ask the table’s host for the code again.'};
module.exports={createInviteGuard,inviteLimits,inviteWords};
