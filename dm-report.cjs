// What the Dungeon Master cost and where it stumbled: sums the local usage log (.questbound-usage.jsonl, one line per
// live request) and the rejection log (.questbound-diagnostics.jsonl) for today, or the last N days with --days N.
// Prices are per million tokens (input, cached input, output) for the models the launcher suggests (spending.cjs, which
// also prices each painting); other models show tokens only. Nothing here calls the provider.
const fs=require('node:fs'),path=require('node:path');
const {prices,paintingPrice,costOf,createSpending}=require('./spending.cjs');
const days=Math.max(1,Number(process.argv[process.argv.indexOf('--days')+1])||1);
const since=new Date(Date.now()-(days-1)*86400000);since.setHours(0,0,0,0);
const lines=file=>{try{return fs.readFileSync(path.join(__dirname,file),'utf8').split(/\r?\n/).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(e=>e&&new Date(e.at)>=since);}catch{return [];}};
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
 const now=createSpending({dir:__dirname}).summary();
 console.log('Today\'s allowance for guests: '+(now.budget===null?'off (.questbound-guest-budget says off)':money(now.guests)+' of '+money(now.budget)+' used; each guest may use up to '+money(now.share)+' (set the dollars a day in .questbound-guest-budget).'));
 const avg=usage.filter(u=>u.mode==='turn');if(avg.length)console.log('A game turn request averages '+Math.round(avg.reduce((a,u)=>a+u.input,0)/avg.length)+' input tokens, of which '+Math.round(avg.reduce((a,u)=>a+u.cached,0)/avg.length)+' cached, and '+Math.round(avg.reduce((a,u)=>a+u.output,0)/avg.length)+' output tokens.');
}
console.log('\nRejected replies: '+rejections.length+(usage.length?' of '+usage.length+' live requests':''));
const byError={};for(const r of rejections)byError[r.error]=(byError[r.error]??0)+1;
for(const [error,n] of Object.entries(byError).sort((a,b)=>b[1]-a[1]))console.log('  '+String(n).padStart(4)+'  '+error);
// Second looks: replies that did not do what the player plainly asked (or could not be used) and were asked for again.
console.log('\nSecond looks: '+looks.length+(usage.length?' of '+usage.length+' live requests':''));
{const kinds={};for(const l of looks){const k=l.secondLook+' ('+l.outcome+')';kinds[k]=(kinds[k]??0)+1;}for(const [kind,n] of Object.entries(kinds).sort((a,b)=>b[1]-a[1]))console.log('  '+String(n).padStart(4)+'  '+kind);}
if(rejections.length){const phases={};for(const r of rejections){const k=r.context?.engineResolved?'narrating a resolved turn':r.context?.pendingSpell?'ruling on a spell':r.context?.sceneTrigger?'a scene cue':'an ordinary turn';phases[k]=(phases[k]??0)+1;}console.log('  during: '+Object.entries(phases).map(([k,n])=>n+' '+k).join(', '));}
