// What the Dungeon Master cost and where it stumbled: sums the local usage log (.questbound-usage.jsonl, one line per
// live request) and the rejection log (.questbound-diagnostics.jsonl) for today, or the last N days with --days N.
// Prices are per million tokens (input, cached input, output) for the models the launcher suggests (spending.cjs, which
// also prices each painting); other models show tokens only. Nothing here calls the provider. --dir names another data
// folder (a hosted game's QUESTBOUND_DATA, or a test's).
const fs=require('node:fs'),path=require('node:path');
const {prices,paintingPrice,costOf,createSpending}=require('./spending.cjs');
const days=Math.max(1,Number(process.argv[process.argv.indexOf('--days')+1])||1);
const dir=process.argv.includes('--dir')?path.resolve(process.argv[process.argv.indexOf('--dir')+1]??'.'):process.env.QUESTBOUND_DATA||__dirname;
const since=new Date(Date.now()-(days-1)*86400000);since.setHours(0,0,0,0);
const lines=file=>{try{return fs.readFileSync(path.join(dir,file),'utf8').split(/\r?\n/).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(e=>e&&new Date(e.at)>=since);}catch{return [];}};
const usage=lines('.questbound-usage.jsonl'),noted=lines('.questbound-diagnostics.jsonl'),rejections=noted.filter(e=>e.error),looks=noted.filter(e=>e.secondLook);
const money=n=>'$'+n.toFixed(n<1?3:2);
console.log('Dungeon Master report, '+(days===1?'today':'last '+days+' days')+' (since '+since.toLocaleString()+')');
if(!usage.length)console.log('\nNo live requests recorded yet. The usage log starts with the first turn after this version of the DM was deployed.');
else{
 const byMode={};for(const u of usage){const m=byMode[u.mode]??(byMode[u.mode]={requests:0,input:0,cached:0,output:0,reasoning:0});m.requests++;m.input+=u.input;m.cached+=u.cached;m.output+=u.output;m.reasoning+=u.reasoning;}
 console.log('\nRequests by kind:');
 for(const [mode,m] of Object.entries(byMode))console.log('  '+mode.padEnd(10)+String(m.requests).padStart(5)+' requests  '+String(m.input).padStart(9)+' input tokens ('+Math.round(100*m.cached/Math.max(1,m.input))+'% cached)  '+String(m.output).padStart(7)+' output'+(m.reasoning?' ('+m.reasoning+' reasoning)':''));
 const paintings=usage.reduce((n,u)=>n+(u.images??0),0);if(paintings)console.log('  paintings '+String(paintings).padStart(5)+' (counted at about '+money(paintingPrice)+' each)');
 const byModel={};for(const u of usage){const m=byModel[u.model]??(byModel[u.model]={input:0,cached:0,output:0,requests:0});m.requests++;m.input+=u.input;m.cached+=u.cached;m.output+=u.output;}
 console.log('\nCost by model:');let total=0,priced=true;
 for(const [model,m] of Object.entries(byModel)){const p=prices[model];if(!p){priced=false;console.log('  '+model+': '+m.requests+' requests, '+m.input+' input / '+m.output+' output tokens (no price on file)');continue;}
  const cost=((m.input-m.cached)*p[0]+m.cached*p[1]+m.output*p[2])/1e6;total+=cost;console.log('  '+model+': '+m.requests+' requests, about '+money(cost)+' ('+money(cost/m.requests*1000)+' per 1,000 requests)');}
 const turns=byMode.turn?.requests??0;
 total+=usage.reduce((n,u)=>n+(u.images??0),0)*paintingPrice;
 if(priced)console.log('\nTotal about '+money(total)+(turns?', about '+money(total/turns)+' per game turn request':'')+'.');
 // Guests (players on phones and the shared link) and the host's daily allowance for them (spending.cjs).
 const guests=usage.filter(u=>u.guest),guestCost=guests.reduce((n,u)=>n+costOf(u),0);
 if(guests.length)console.log('Guests: '+guests.length+' requests from '+new Set(guests.map(u=>u.guest)).size+' browser(s), about '+money(guestCost)+'.');
 const now=createSpending({dir}).summary();
 console.log('Today\'s allowance for guests: '+(now.budget===null?'no total (.questbound-guest-budget says off)':money(now.guests)+' of '+money(now.budget)+' used by all guests together (.questbound-guest-budget)')+'; '+(now.share===null?'no limit for each player':'each player may use up to '+money(now.share)+' a day (.questbound-player-budget); the most any one used today: '+money(now.topGuest))+'.');
 const avg=usage.filter(u=>u.mode==='turn');if(avg.length)console.log('A game turn request averages '+Math.round(avg.reduce((a,u)=>a+u.input,0)/avg.length)+' input tokens, of which '+Math.round(avg.reduce((a,u)=>a+u.cached,0)/avg.length)+' cached, and '+Math.round(avg.reduce((a,u)=>a+u.output,0)/avg.length)+' output tokens.');
}
console.log('\nRejected replies: '+rejections.length+(usage.length?' of '+usage.length+' live requests':''));
const byError={};for(const r of rejections)byError[r.error]=(byError[r.error]??0)+1;
for(const [error,n] of Object.entries(byError).sort((a,b)=>b[1]-a[1]))console.log('  '+String(n).padStart(4)+'  '+error);
// Second looks: replies that did not do what the player plainly asked (or could not be used) and were asked for again.
console.log('\nSecond looks: '+looks.length+(usage.length?' of '+usage.length+' live requests':''));
{const kinds={};for(const l of looks){const k=l.secondLook+' ('+l.outcome+')';kinds[k]=(kinds[k]??0)+1;}for(const [kind,n] of Object.entries(kinds).sort((a,b)=>b[1]-a[1]))console.log('  '+String(n).padStart(4)+'  '+kind);}
if(rejections.length){const phases={};for(const r of rejections){const k=r.context?.engineResolved?'narrating a resolved turn':r.context?.pendingSpell?'ruling on a spell':r.context?.sceneTrigger?'a scene cue':'an ordinary turn';phases[k]=(phases[k]??0)+1;}console.log('  during: '+Object.entries(phases).map(([k,n])=>n+' '+k).join(', '));}
// Reliability (the host, 2026-10-13: a failed turn should be rarer than 1 in 200, and never a parse failure in front of
// the player). A turn is one Dungeon Master turn request (ask 1 in the usage log); its retries and second looks are
// not turns. How each troubled turn ended is recorded by dm-server.cjs (recordTurn): 'asked again' (a quiet retry
// gave a usable reply), 'rescued' (the usable part of the last reply was told, nothing invalid applied) or 'failed'
// (the player saw an error). Small faults mended in place are the second-look notes that are not second looks. Before
// this version (no ask numbers in the usage log) the figures are worked out from the order of the notes: a rejected
// reply followed at once by "asked again" was retried, the last of a run that was not is a turn the player saw fail
// (replies cut short on the last attempt were not recorded then).
{
 const looksAsked=new Set(['asked again','the model acted','the game acted','left as answered']);
 const turnUsage=usage.filter(u=>u.mode==='turn'),firstAsk=turnUsage.filter(u=>Number.isInteger(u.ask)).map(u=>new Date(u.at).getTime()).sort((a,b)=>a-b)[0]??Infinity;
 const legacy=e=>new Date(e.at).getTime()<firstAsk,group=e=>e.guest?'guests':'host';
 const tally={host:{turns:0,failed:0,rescued:0,asked:0,mended:0},guests:{turns:0,failed:0,rescued:0,asked:0,mended:0}};
 for(const u of turnUsage)if(!Number.isInteger(u.ask)?true:u.ask===1)tally[group(u)].turns++;
 for(const n of noted)if(legacy(n)&&n.secondLook&&looksAsked.has(n.outcome))tally[group(n)].turns--;
 for(const n of noted){
  if(n.turn==='failed')tally[group(n)].failed++;else if(n.turn==='rescued')tally[group(n)].rescued++;else if(n.turn==='asked again')tally[group(n)].asked++;
  else if(n.secondLook&&!looksAsked.has(n.outcome)&&n.secondLook!=='errand reward')tally[group(n)].mended++;
 }
 // The notes before this version: runs of rejected replies, each retried or not.
 {const old=noted.filter(legacy);let run=null;
  for(let i=0;i<old.length;i++){const n=old[i];
   if(n.error&&!n.aside){const next=old[i+1],retried=!!next&&next.secondLook==='unusable reply'&&next.outcome==='asked again'&&(next.guest??null)===(n.guest??null)&&new Date(next.at)-new Date(n.at)<3000;
    if(!run||run.who!==group(n)||new Date(n.at)-run.at>60000)run={who:group(n),at:0};run.at=new Date(n.at).getTime();
    if(retried){run.retried=true;i++;continue;}
    tally[run.who].failed++;run=null;continue;}
   if(n.secondLook==='unusable reply'&&n.outcome==='asked again'){if(!run)tally[group(n)].asked++;}
   if(run&&n.secondLook!=='unusable reply'){tally[run.who].asked++;run=null;}
  }
  if(run)tally[run.who].asked++;}
 const all=k=>tally.host[k]+tally.guests[k],rate=(f,t)=>(t?f*200/t:0).toFixed(2);
 for(const g of Object.values(tally))g.turns=Math.max(g.turns,0);
 console.log('\nReliability, '+(days===1?'today':'last '+days+' days')+': '+all('turns')+' turns ('+tally.host.turns+' host, '+tally.guests.turns+' guests).');
 console.log('Seen by the player: '+all('failed')+' failed turn'+(all('failed')===1?'':'s')+' ('+rate(all('failed'),all('turns'))+' per 200 turns). Goal: under 1 failed turn in 200.');
 for(const [who,g] of Object.entries(tally))if(g.turns||g.failed||g.rescued||g.asked||g.mended)console.log('  '+who+': '+g.turns+' turns, '+g.failed+' failed ('+rate(g.failed,g.turns)+' per 200), '+g.rescued+' rescued, '+g.asked+' asked again, '+g.mended+' mended in place');
 console.log('Mended quietly: '+(all('asked')+all('rescued')+all('mended'))+' turns ('+all('asked')+' asked again, '+all('rescued')+' rescued, '+all('mended')+' mended in place)'+(firstAsk===Infinity&&noted.length?'; from the notes of an earlier version, so approximate.':firstAsk>since.getTime()&&noted.some(legacy)?'; before '+new Date(firstAsk).toLocaleString()+' worked out from the notes of an earlier version.':'.'));
}
