// Anonymous play counts (the host's request of 2026-10-13: "anonymous counts of how long sessions last, where people
// quit and how many turns fail, with the privacy text updated to match"). Each browser that has not turned them off
// (Settings → Help improve Questbound, playMetrics.js) sends one small record of mechanical counts when a session goes
// out of sight: how long it was played, turns sent, turns that failed and how, where it ended, the tale opening chosen,
// how a story wait went, phone or desktop, and the build. The gateways (phone-server.cjs, desktop-server.cjs) check it
// against this strict schema and append it to .questbound-metrics.jsonl (metrics.jsonl in a hosted data folder);
// play-report.cjs reads it. Records older than metricsRetentionDays are pruned.
//
// Nothing typed or named can be recorded: every field is a number, a boolean, a fixed word from a list, or a random
// hexadecimal id. The device id is the browser's own random metrics id (never its guest identity, cookie, address or
// account), stored here only as a cut of its hash, so these counts cannot be joined to the Dungeon Master's logs,
// feedback notes or shared tables. A session sends its record again each time it is hidden; the report keeps the last.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const metricsRetentionDays=180,METRICS_BODY_LIMIT=2000,METRICS_FILE_LIMIT=20*1024*1024;
// Where a session was when it ended (playMetrics.js `placeOf`).
const metricsPlaces=['launch','title','heroes','builder','opening','story-loading','explore','fight','talk','dying','dead','level-up','pages','settings','table','legal'];
const metricsFailures=['refused','unreachable','error','table','save','reported'];
const metricsForms=['phone','tablet','desktop'];
// Tale openings: the ids in adventureIntros.json, 'next' for the next tale in a region; anything else counts as 'other'.
const metricsOpenings=(()=>{try{const list=JSON.parse(fs.readFileSync(path.join(__dirname,'adventureIntros.json'),'utf8'));return new Set([...(Array.isArray(list)?list:[]).map(i=>i?.id).filter(id=>typeof id==='string'),'next']);}catch{return new Set(['next']);}})();
const metricsKeys=['v','device','session','seq','first','build','form','active','span','turns','failed','ended','tale','easy','wait'];
const isCount=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max;
// The record as kept, or {error}. `from` is the server's own word for where it came from (link, desktop, hosted).
function metricsRecord(body,{now=Date.now(),from='link'}={}){
 const fail=error=>({error});
 if(!body||typeof body!=='object'||Array.isArray(body))return fail('Not a record.');
 for(const key of Object.keys(body))if(!metricsKeys.includes(key))return fail('Unknown field.');
 if(body.v!==1)return fail('Unknown version.');
 if(typeof body.device!=='string'||!/^[0-9a-f]{32}$/.test(body.device))return fail('Bad device.');
 if(typeof body.session!=='string'||!/^[0-9a-f]{16}$/.test(body.session))return fail('Bad session.');
 if(!isCount(body.seq,500))return fail('Bad sequence.');
 if(typeof body.first!=='boolean')return fail('Bad first.');
 if(typeof body.build!=='string'||!/^(?:[0-9a-f]{8}|dev)$/.test(body.build))return fail('Bad build.');
 if(!metricsForms.includes(body.form))return fail('Bad form.');
 if(!isCount(body.active,86400)||!isCount(body.span,86400)||body.active>body.span+60)return fail('Bad time.');
 if(!isCount(body.turns,5000))return fail('Bad turns.');
 const failed=body.failed;
 if(!failed||typeof failed!=='object'||Array.isArray(failed)||Object.keys(failed).some(k=>!metricsFailures.includes(k))||Object.values(failed).some(n=>!isCount(n,5000)))return fail('Bad failures.');
 if(!metricsPlaces.includes(body.ended))return fail('Bad place.');
 if(body.tale!==null&&(typeof body.tale!=='string'||!/^[a-z][a-z0-9-]{0,30}$/.test(body.tale)))return fail('Bad tale.');
 if(body.easy!==null&&typeof body.easy!=='boolean')return fail('Bad easy.');
 const wait=body.wait;
 if(!wait||typeof wait!=='object'||Array.isArray(wait)||Object.keys(wait).some(k=>!['started','done','failed','waited','pending'].includes(k))||!isCount(wait.started,50)||!isCount(wait.done,50)||!isCount(wait.failed,50)||!isCount(wait.waited,86400)||!isCount(wait.pending,86400))return fail('Bad wait.');
 return {record:{
  at:new Date(now).toISOString(),from:['link','desktop','hosted'].includes(from)?from:'link',
  // A cut of the hash of the device's random id: enough to count returning devices, never the id the browser holds.
  device:crypto.createHash('sha256').update('questbound-metrics-v1:'+body.device).digest('hex').slice(0,16),
  session:body.session,seq:body.seq,first:body.first,build:body.build,form:body.form,active:body.active,span:body.span,turns:body.turns,
  failed:Object.fromEntries(metricsFailures.map(k=>[k,failed[k]??0])),ended:body.ended,
  tale:body.tale===null?null:metricsOpenings.has(body.tale)?body.tale:'other',easy:body.easy,
  wait:{started:wait.started,done:wait.done,failed:wait.failed,waited:wait.waited,pending:wait.pending},
 }};
}
// The records file beside the feedback notes: .questbound-metrics.jsonl on the host's PC (git-ignored with every
// .questbound-* file), metrics.jsonl in a hosted data folder.
const metricsFileIn=(dir,hosted=false)=>path.join(dir,hosted?'metrics.jsonl':'.questbound-metrics.jsonl');
// Drops records older than the retention; returns how many were dropped. Never throws.
function pruneMetrics(file,{now=Date.now(),days=metricsRetentionDays}={}){
 try{
  const raw=fs.readFileSync(file,'utf8'),cutoff=new Date(now-days*86400000).toISOString(),lines=raw.split(/\r?\n/).filter(Boolean);
  const kept=lines.filter(line=>{try{const at=JSON.parse(line).at;return typeof at==='string'&&at>=cutoff;}catch{return false;}});
  if(kept.length===lines.length)return 0;
  const temp=file+'.tmp';fs.writeFileSync(temp,kept.length?kept.join('\n')+'\n':'');fs.renameSync(temp,file);
  return lines.length-kept.length;
 }catch{return 0;}
}
// A writer for one file: prunes when created and then at most once an hour, and stops taking records past 20 MB.
function metricsWriter(file,{now=Date.now,days=metricsRetentionDays}={}){
 let pruned=0;
 return record=>{
  if(now()-pruned>3600000){pruneMetrics(file,{now:now(),days});pruned=now();}
  try{if(fs.statSync(file).size>METRICS_FILE_LIMIT)return false;}catch{}
  fs.appendFileSync(file,JSON.stringify(record)+'\n');return true;
 };
}
module.exports={metricsRecord,metricsWriter,pruneMetrics,metricsFileIn,metricsPlaces,metricsFailures,metricsForms,metricsRetentionDays,METRICS_BODY_LIMIT};
