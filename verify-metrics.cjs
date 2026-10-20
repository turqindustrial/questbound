// Anonymous play counts and the "How was that session?" question (2026-10-13). Checks: the server's strict schema
// (play-metrics.cjs) takes only numbers, fixed words and random ids, so nothing typed or named can be recorded; the
// device's counts (playMetrics.js) carry no words from the game, honour the opt-out and wait for the agreement; the
// gateway and the desktop server take records from the game's own page only, within a rate limit; old records are
// pruned after the retention; play-report.cjs works its numbers out right from fixture records; and the rating rules
// (ratingRules.js) ask only at a stopping point, at most once a day, never in a device's first minutes or after a
// recent "Not now", with the same answers and chips as the server (feedback-notes.cjs).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const load=(file,names,context={})=>{context.globalThis=context;return vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')+'\n({'+names.join(',')+'})',context);};
const plain=v=>JSON.parse(JSON.stringify(v));
const metrics=require('./play-metrics.cjs');
// The module reads its clock from this context: the fixed day below, so the result never depends on when the check runs.
const DAY=86400000,NOW=Date.UTC(2026,9,13,12,0);

// 1. The schema: a good record is kept with the device id cut from its hash; anything else is refused.
const good={v:1,device:'a'.repeat(32),session:'b'.repeat(16),seq:0,first:true,build:'1a2b3c4d',form:'phone',active:1500,span:1800,turns:42,failed:{refused:2,unreachable:1},ended:'fight',tale:'easy',easy:true,wait:{started:1,done:1,failed:0,waited:170,pending:0}};
const kept=metrics.metricsRecord(good,{now:NOW});assert.ok(kept.record,kept.error);
assert.match(kept.record.device,/^[0-9a-f]{16}$/);assert.notEqual(kept.record.device,good.device.slice(0,16),'the device id is kept only as a cut of its hash');
assert.deepEqual(kept.record.failed,{refused:2,unreachable:1,error:0,table:0,save:0,reported:0});assert.equal(kept.record.at,new Date(NOW).toISOString());assert.equal(kept.record.from,'link');
assert.equal(metrics.metricsRecord({...good,tale:'bobs-tavern'}).record.tale,'other','an unknown opening is kept as other');
assert.equal(metrics.metricsRecord({...good,tale:'next'}).record.tale,'next');
const refused=[{...good,name:'Ysolde'},{...good,v:2},{...good,device:'Ysolde'},{...good,device:'A'.repeat(32)},{...good,session:'b'.repeat(15)},{...good,seq:-1},{...good,seq:1.5},{...good,first:'yes'},{...good,build:'abc'},{...good,form:'iPhone 15'},
 {...good,active:2000,span:1000},{...good,active:90000,span:90000},{...good,turns:'42'},{...good,failed:{refused:1,why:2}},{...good,failed:{refused:'I cast Fireball'}},{...good,failed:[1]},{...good,ended:'The Sunken Chapel'},{...good,ended:'talk with Mara'},
 {...good,tale:'My own tale about a dragon'},{...good,tale:'A'},{...good,easy:'on'},{...good,wait:{...good.wait,note:'slow'}},{...good,wait:{...good.wait,pending:-4}},{...good,wait:null},null,[],'text',{}];
for(const body of refused)assert.ok(metrics.metricsRecord(body).error,'refused: '+JSON.stringify(body)?.slice(0,80));
// Whatever a client sends, every string in a kept record is a fixed word, a hex id, a build or a time.
const allowed=new Set([...metrics.metricsPlaces,...metrics.metricsForms,'link','desktop','hosted','other','next',...JSON.parse(fs.readFileSync('adventureIntros.json','utf8')).map(i=>i.id)]);
const strings=(value,out=[])=>{if(typeof value==='string')out.push(value);else if(value&&typeof value==='object')for(const v of Object.values(value))strings(v,out);return out;};
const words=['Ysolde','Mara','I cast Fireball','The Sunken Chapel','hello world','<script>','bob@example.com'];
let tries=0,accepted=0;
for(const key of Object.keys(good))for(const w of words){tries++;const r=metrics.metricsRecord({...good,[key]:w});if(r.record){accepted++;for(const s of strings(r.record))assert.ok(allowed.has(s)||/^[0-9a-f]{16}$/.test(s)||/^(?:[0-9a-f]{8}|dev)$/.test(s)||/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(s),'a kept string is never free text: '+s);}}
assert.equal(accepted,0,'no field takes a word or a name');
assert.equal(metrics.METRICS_BODY_LIMIT,2000);assert.ok(JSON.stringify(good).length<600,'a record is small');

// 2. The device's counts: mechanical only, opt-out forgets the id, nothing before the agreement.
const store=(()=>{const d={};return {getItem:k=>d[k]??null,setItem:(k,v)=>{d[k]=String(v);},removeItem:k=>{delete d[k];},data:d};})();
let accepted2=true,subscriber=null;const beacons=[];const tab=(()=>{const d={};return {getItem:k=>d[k]??null,setItem:(k,v)=>{d[k]=String(v);},removeItem:k=>{delete d[k];},data:d};})();
const ctx={localStorage:store,crypto:require('node:crypto').webcrypto,location:{hostname:'questbound.example'},navigator:{sendBeacon:(url,blob)=>{beacons.push({url,blob});return true;}},Blob:class{constructor(parts,opts){this.text=parts.join('');this.type=opts?.type;}},
 sessionStorage:tab,agreementStatus:()=>({accepted:accepted2}),subscribeProblems:fn=>{subscriber=fn;return()=>{};},recentProblems:()=>[],pageBuild:()=>'1a2b3c4d',fetch:async()=>({}),Date:class extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}},Math,JSON,Number,Object,Array,String,Set,Uint8Array,setTimeout,clearTimeout};
const pm=load('playMetrics.js',['readInsight','setInsight','placeOf','formOf','failureOf','notePlayActivity','sessionSeconds','deviceSeconds','countTurn','notePlace','noteTalking','noteTale','noteStoryWait','sessionSummary','playRecord','sendPlayRecord','startPlayMetrics','noteRatingShown','noteRatingAnswered','noteRatingDismissed','insightKey'],ctx);
assert.deepEqual(plain(pm.readInsight()),{counts:true,ask:true,device:null,playSeconds:0,rating:{asked:null,answered:null,dismissed:null,dismissals:0}},'on by default, no id until something is sent');
// placeOf and failureOf: fixed words only.
assert.equal(pm.placeOf({launched:false}),'launch');assert.equal(pm.placeOf({storyCover:true,screen:'Adventure Opening'}),'story-loading');assert.equal(pm.placeOf({screen:'Home'}),'title');
assert.equal(pm.placeOf({screen:'Adventure',inGame:true,stage:'combat',fighting:true}),'fight');assert.equal(pm.placeOf({screen:'Adventure',inGame:true,stage:'dying',fighting:true}),'dying');assert.equal(pm.placeOf({screen:'Adventure',inGame:true,stage:'dead'}),'dead');
assert.equal(pm.placeOf({screen:'Adventure',inGame:true,stage:'wild',talking:true}),'talk');assert.equal(pm.placeOf({screen:'Character Creation'}),'builder');assert.equal(pm.placeOf({screen:'Something new'}),'title');
for(const screen of ['Home','Character Selection','Character Creation','Adventure Opening','Level Up','Multiplayer','Legal','Settings','Character Sheet','Campaign Journal','Followers','Dice Roller','Adventure'])assert.ok(metrics.metricsPlaces.includes(pm.placeOf({screen})),screen);
assert.equal(pm.failureOf({kind:'dm',error:'The DM took too long. Nothing was applied.'}),'unreachable');assert.equal(pm.failureOf({kind:'dm',error:'The host’s Dungeon Master is offline right now.'}),'unreachable');
assert.equal(pm.failureOf({kind:'dm',error:'The reply did not fit the rules.'}),'error');assert.equal(pm.failureOf({kind:'refused',error:'You cannot cast that.'}),'refused');assert.equal(pm.failureOf({kind:'table'}),'table');assert.equal(pm.failureOf({kind:'odd'}),null);
// A session: activity, turns, failures (from the problem log), a tale and its wait, where it ended.
const t0=NOW;pm.notePlayActivity(t0);
for(let i=1;i<=20;i++)pm.notePlayActivity(t0+i*60000);
pm.notePlayActivity(t0+20*60000+20*60000);// twenty minutes away: not counted
for(let i=0;i<9;i++)pm.countTurn();
ctx.addEventListener=()=>{};ctx.document={addEventListener:()=>{}};pm.startPlayMetrics();
subscriber([{id:'p1',kind:'refused',said:'I cast Fireball at Mara',error:'You have no slot left.'},{id:'p2',kind:'dm',said:'I go to the Sunken Chapel',error:'The DM took too long. Nothing was applied.'}]);
subscriber([{id:'p1',kind:'refused'},{id:'p2',kind:'dm'},{id:'p3',kind:'save',error:'Adventure not saved'}]);
pm.noteTale('easy',true);pm.noteStoryWait('start',t0+1000);pm.noteStoryWait('done',t0+181000);pm.noteStoryWait('start',t0+30*60000);
pm.notePlace('explore');pm.noteTalking(true);
assert.equal(pm.sessionSeconds(t0+40*60000),1200,'twenty minutes of play; time away is not counted');
const record=plain(pm.playRecord(t0+40*60000));assert.equal(record,null,'no record while the device has no id yet');
assert.equal(pm.sendPlayRecord(t0+40*60000),true);assert.equal(beacons.length,1);assert.equal(beacons[0].url,'/api/metrics');assert.equal(beacons[0].blob.type,'text/plain');
const sent=JSON.parse(beacons[0].blob.text);
assert.equal(sent.turns,9);assert.deepEqual(sent.failed,{refused:1,unreachable:1,save:1});assert.equal(sent.ended,'talk');assert.equal(sent.tale,'easy');assert.equal(sent.easy,true);assert.equal(sent.first,true);
assert.deepEqual(sent.wait,{started:2,done:1,failed:0,waited:180,pending:600},'a finished wait and one still pending (abandoned if the session ends here)');
assert.equal(sent.active,1200);assert.equal(sent.form,'desktop');assert.equal(sent.build,'1a2b3c4d');
for(const w of ['Fireball','Mara','Sunken','slot','took too long','saved'])assert.ok(!beacons[0].blob.text.includes(w),'nothing typed or said reaches the record: '+w);
assert.ok(metrics.metricsRecord(sent).record,'the server takes what the game sends');
assert.match(pm.readInsight().device,/^[0-9a-f]{32}$/);
assert.equal(pm.sendPlayRecord(t0+40*60000),false,'an unchanged record is not sent again');
pm.countTurn();assert.equal(pm.sendPlayRecord(t0+41*60000),true);assert.equal(JSON.parse(beacons[1].blob.text).seq,1,'the next send of the same session carries the next number');
assert.equal(JSON.parse(beacons[1].blob.text).session,sent.session);
// The opt-out: the id is forgotten and nothing more is sent; turned on again, a new id.
const oldId=pm.readInsight().device;pm.setInsight({counts:false});assert.equal(pm.readInsight().device,null);pm.countTurn();assert.equal(pm.sendPlayRecord(t0+42*60000),false);assert.equal(beacons.length,2);
pm.setInsight({counts:true});pm.countTurn();assert.equal(pm.sendPlayRecord(t0+43*60000),true);assert.notEqual(JSON.parse(beacons[2].blob.text).device,oldId,'a new id after turning the counts on again');
// Nothing before the current agreement is accepted.
accepted2=false;pm.countTurn();assert.equal(pm.sendPlayRecord(t0+44*60000),false);accepted2=true;
// The device's own total play time (for the rating rules) and the summary a rating carries.
assert.ok(pm.deviceSeconds()>=1140);
assert.deepEqual(plain(pm.sessionSummary(t0+44*60000)),{minutes:21,turns:13,failed:2,form:'desktop',build:'1a2b3c4d'},'a minute after the last tap still counts');
// A reload of the tab carries on the same session (sessionStorage) while it is under half an hour old, and problems
// already in the log are not counted twice.
{const again=load('playMetrics.js',['sessionSummary','sendPlayRecord','startPlayMetrics','countTurn'],{...ctx,recentProblems:()=>[{id:'p1'},{id:'p2'},{id:'p3'}],Date:{now:()=>t0+50*60000}});
 again.startPlayMetrics();subscriber([{id:'p1',kind:'refused'},{id:'p2',kind:'dm'},{id:'p3',kind:'save'},{id:'p4',kind:'table'}]);
 assert.deepEqual(plain(again.sessionSummary(t0+50*60000)),{minutes:21,turns:13,failed:3,form:'desktop',build:'1a2b3c4d'},'the same session after a reload, with only the new problem counted');
 again.countTurn();assert.equal(again.sendPlayRecord(t0+50*60000),true);const resent=JSON.parse(beacons.at(-1).blob.text);assert.equal(resent.session,JSON.parse(beacons[2].blob.text).session);assert.ok(resent.seq>=1);
 const later=load('playMetrics.js',['sessionSummary'],{...ctx,Date:{now:()=>t0+3*3600000}});assert.equal(later.sessionSummary(t0+3*3600000).turns,0,'after half an hour away a new session begins');}
pm.noteRatingShown(5);pm.noteRatingDismissed(6);pm.noteRatingDismissed(7);assert.deepEqual(plain(pm.readInsight().rating),{asked:5,answered:null,dismissed:7,dismissals:2});pm.noteRatingAnswered(8);assert.equal(pm.readInsight().rating.dismissals,0);

// 3. The rating rules, and the same lists on both sides.
const rr=load('ratingRules.js',['ratingAnswers','ratingMoments','ratingBest','ratingWrong','ratingChipLabels','ratingAnswerLabels','ratingMinimums','ratingMomentOf','mayAskRating','ratingFirstPlay','ratingGap'],{});
const notes=require('./feedback-notes.cjs');
assert.deepEqual(plain(rr.ratingAnswers),notes.ratingAnswers);assert.deepEqual(plain(rr.ratingMoments),notes.ratingMoments);assert.deepEqual([...rr.ratingBest,...rr.ratingWrong],notes.ratingChips);
for(const id of notes.ratingChips)assert.ok(rr.ratingChipLabels[id],'a label for '+id);
const ok={ask:true,record:{},moment:'chapter',sessionSeconds:900,deviceSeconds:3000,now:NOW};
assert.equal(rr.mayAskRating(ok),true);
assert.equal(rr.mayAskRating({...ok,ask:false}),false,'turned off in Settings');
assert.equal(rr.mayAskRating({...ok,blocked:true}),false,'never in a fight, dying, typing or waiting for a tale');
assert.equal(rr.mayAskRating({...ok,moment:'fight'}),false);
assert.equal(rr.mayAskRating({...ok,deviceSeconds:600}),false,'never in a device\'s first twenty minutes');
assert.equal(rr.mayAskRating({...ok,moment:'leave',sessionSeconds:600}),false,'leaving play needs a quarter of an hour');assert.equal(rr.mayAskRating({...ok,moment:'leave',sessionSeconds:900}),true);
assert.equal(rr.mayAskRating({...ok,moment:'rest',sessionSeconds:1200}),false,'a long rest after a good while');
assert.equal(rr.mayAskRating({...ok,record:{asked:NOW-3*3600000}}),false,'at most once a day');assert.equal(rr.mayAskRating({...ok,record:{asked:NOW-21*3600000}}),true);
assert.equal(rr.mayAskRating({...ok,record:{answered:NOW-DAY-1}}),false,'two days after an answer');
assert.equal(rr.mayAskRating({...ok,record:{dismissed:NOW-6*DAY,dismissals:1}}),false,'a week after Not now');assert.equal(rr.mayAskRating({...ok,record:{dismissed:NOW-8*DAY,dismissals:1}}),true);
assert.equal(rr.mayAskRating({...ok,record:{dismissed:NOW-8*DAY,dismissals:2}}),false,'a month after two in a row');
const tale={story:{title:'The Drowned Bell',chapter:1,status:'active'},stage:'wild',storyLog:[{id:4,kind:'travel',text:'Reached the bell.'}]};
assert.equal(rr.ratingMomentOf(tale,{...tale,story:{...tale.story,chapter:2}}),'chapter');
assert.equal(rr.ratingMomentOf(tale,{...tale,story:{...tale.story,status:'complete'}}),'tale');
assert.equal(rr.ratingMomentOf(tale,{...tale,stage:'dead'}),'death');
assert.equal(rr.ratingMomentOf(tale,{...tale,storyLog:[...tale.storyLog,{id:5,kind:'rest',text:'Took a long rest at the inn.'}]}),'rest');
assert.equal(rr.ratingMomentOf(tale,{...tale,storyLog:[...tale.storyLog,{id:5,kind:'rest',text:'Took a short rest at the inn.'}]}),null);
assert.equal(rr.ratingMomentOf({stage:'inn'},{...tale,stage:'dead'}),null,'loading a save is no stopping point');
assert.equal(rr.ratingMomentOf(tale,{...tale,story:{...tale.story,title:'Another tale',chapter:3}}),null,'nor is a new tale');
assert.equal(rr.ratingMomentOf(tale,{...tale,stage:'combat'}),null);
// The card and the settings are where the game shows them.
{const app=['App.js','MenuScreens.js'].map(f=>fs.readFileSync(f,'utf8')).join(' '),card=fs.readFileSync('SessionRating.js','utf8'),dm=['DungeonMaster.js','useDmTurn.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');
 assert.ok(app.includes("{screen === 'Settings' && <InsightSettings/>}")&&app.includes('<SessionRating key={rating.id}')&&app.includes('startPlayMetrics()')&&app.includes("noteStoryWait('start')")&&app.includes("noteStoryWait('done')")&&app.includes("noteStoryWait('failed')"));
 assert.ok(/ratingBlocked\.current=!launched\|\|agreementShown\|\|storyCover\|\|feedbackOpen\|\|typingPlay\|\|\(fighting&&game\.stage!=='dead'\)\|\|game\.stage==='dying'/.test(app),'never mid-fight, dying, typing or under a cover');
 assert.ok(dm.includes("playSound('send');countTurn();")&&dm.includes('noteTalking(!!person)'));
 assert.ok(card.includes("kind:'session',rating:value,moment,session:sessionSummary()")&&!/hero|story|name/.test(card.match(/sendRating\(\{[^}]*\}/g).join(' ')),'a rating sends the answer, the moment and the counts only');
 assert.ok(card.includes("pointerEvents:'box-none'")&&/const s=StyleSheet\.create\(\{\r?\n layer:\{[^}]*pointerEvents:'box-none'/.test(card),'the card\'s layer lets taps through (in StyleSheet.create)');}

// 4. Retention: old records are pruned, by the writer too.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-metrics-'));
try{
 const file=path.join(dir,'.questbound-metrics.jsonl');
 fs.writeFileSync(file,[{at:new Date(NOW-200*DAY).toISOString(),session:'x'},{at:new Date(NOW-179*DAY).toISOString(),session:'y'},'not json'].map(r=>typeof r==='string'?r:JSON.stringify(r)).join('\n')+'\n');
 assert.equal(metrics.pruneMetrics(file,{now:NOW}),2,'the old record and the unreadable line go');assert.equal(fs.readFileSync(file,'utf8').trim().split('\n').length,1);
 assert.equal(metrics.pruneMetrics(file,{now:NOW}),0);assert.equal(metrics.pruneMetrics(path.join(dir,'missing.jsonl'),{now:NOW}),0);
 fs.appendFileSync(file,JSON.stringify({at:new Date(NOW-400*DAY).toISOString()})+'\n');
 const write=metrics.metricsWriter(file,{now:()=>NOW});write(kept.record);
 const lines=fs.readFileSync(file,'utf8').trim().split('\n').map(l=>JSON.parse(l));assert.equal(lines.length,2,'the writer prunes before it appends');
 assert.equal(path.basename(metrics.metricsFileIn(dir)),'.questbound-metrics.jsonl');assert.equal(path.basename(metrics.metricsFileIn(dir,true)),'metrics.jsonl');
}finally{fs.rmSync(dir,{recursive:true,force:true});}

// 5. The report's numbers from fixture records.
const report=require('./play-report.cjs');
const rdir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-play-report-'));
const rec=(day,hour,o)=>({at:new Date(NOW-day*DAY+hour*3600000).toISOString(),from:'link',device:'d1',session:'s',seq:0,first:false,build:'1a2b3c4d',form:'phone',active:600,span:700,turns:10,failed:{refused:0,unreachable:0,error:0,table:0,save:0,reported:0},ended:'explore',tale:null,easy:null,wait:{started:0,done:0,failed:0,waited:0,pending:0},...o});
const fixtures=[
 rec(20,0,{device:'old',session:'s0'}),// before the window: makes 'old' a device that came back
 rec(3,0,{device:'old',session:'s1',active:1800,turns:40,failed:{refused:1,unreachable:1,error:0,table:0,save:0,reported:0},ended:'fight'}),
 rec(3,1,{device:'d2',session:'s2',seq:0,active:60,turns:0,ended:'story-loading',wait:{started:1,done:0,failed:0,waited:0,pending:40}}),
 rec(3,2,{device:'d2',session:'s2',seq:1,active:300,turns:0,ended:'story-loading',wait:{started:1,done:0,failed:0,waited:0,pending:200}}),// the later send of the same session wins
 rec(2,0,{device:'d3',session:'s3',first:true,active:3600,turns:120,failed:{refused:2,unreachable:0,error:1,table:0,save:0,reported:1},ended:'dead',tale:'easy',easy:true,wait:{started:1,done:1,failed:0,waited:180,pending:0}}),
 rec(1,0,{device:'d3',session:'s4',active:900,turns:40,ended:'title',tale:'crown',easy:false,form:'desktop'}),
 rec(1,1,{device:'host',session:'s5',from:'desktop',active:7200,turns:300,ended:'explore'}),
];
fs.writeFileSync(path.join(rdir,'.questbound-metrics.jsonl'),fixtures.map(r=>JSON.stringify(r)).join('\n')+'\nnot json\n');
const rating=(day,o)=>({ref:'fb-'+(1000+day).toString(36)+'abc-00'+day+'a',at:new Date(NOW-day*DAY).toISOString(),guest:null,kind:'session',rating:'good',moment:'chapter',chips:[],text:null,session:{minutes:30,turns:20,failed:1,form:'phone',build:'1a2b3c4d'},follows:null,...o});
const r1=rating(2,{rating:'great'}),r2=rating(1,{rating:'rough',moment:'death'});
fs.writeFileSync(path.join(rdir,'.questbound-feedback.jsonl'),[r1,r2,rating(1,{ref:'fb-x-0001',follows:r2.ref,rating:null,session:null,chips:['slow','errors'],text:'Replies took ages'}),rating(1,{rating:'okay',from:'desktop'}),{ref:'fb-n',at:new Date(NOW-DAY).toISOString(),text:'A feedback note',rating:4}].map(r=>JSON.stringify(r)).join('\n')+'\n');
try{
 const s=report.playSummary({dir:rdir,days:7,now:NOW});
 assert.equal(s.sessions,4,'one per session, the host\'s own left out');assert.equal(s.leftOutFromThisPc,1);
 assert.deepEqual(plain(s.devices),{active:3,new:2,cameBack:2});
 assert.equal(s.length.medianMinutes,22.5,'median of 5, 15, 30 and 60 minutes');assert.equal(s.length.distribution['15-30 min'],1);assert.equal(s.length.distribution['30-60 min'],1);assert.equal(s.length.distribution['1-2 h'],1);
 assert.deepEqual(plain(s.ended),{fight:1,'story-loading':1,dead:1,title:1});assert.equal(s.noTurns,1);
 assert.equal(s.turns.total,200);assert.equal(s.turns.failedPer200,5,'five failed turns in two hundred');assert.equal(s.turns.per200.refused,3);assert.equal(s.turns.failed.reported,1);
 assert.deepEqual(plain(s.storyWaits),{started:2,done:1,failed:0,abandoned:1,averageDoneSeconds:180,medianAbandonedSeconds:200});
 assert.deepEqual(plain(s.openings),{easy:1,crown:1});assert.equal(s.easyStart,1);assert.deepEqual(plain(s.forms),{phone:3,desktop:1});
 assert.equal(s.ratings.count,2);assert.deepEqual(plain(s.ratings.answers),{great:1,good:0,okay:0,rough:1});assert.equal(s.ratings.average,2.5);assert.deepEqual(plain(s.ratings.chips),{slow:1,errors:1});
 assert.deepEqual(plain(s.ratings.list[1].notes),['Replies took ages'],'an addition is folded into its answer');
 const third=s.perDay.find(d=>d.day===new Date(NOW-3*DAY).toISOString().slice(0,10));assert.equal(third.sessions,2);assert.equal(third.turns,40);assert.equal(third.failedPer200,10);
 const withHost=report.playSummary({dir:rdir,days:7,now:NOW,host:true});assert.equal(withHost.sessions,5);assert.equal(withHost.ratings.count,3);
 const out=[];report.report(['--days','7'],{dir:rdir,now:NOW,print:t=>out.push(t)});const text=out.join('\n');
 assert.match(text,/4 sessions on 3 devices \(2 came back\), median 22.5 min, 5 failed turns per 200, 1 story wait abandoned; ratings 1 great, 0 good, 0 okay, 1 rough\./);
 assert.match(text,/story-loading\s+1/);assert.match(text,/rough after death .*slow, errors · "Replies took ages"/);assert.match(text,/1 session\(s\) from this PC left out/);
 const brief=[];report.report(['--brief','--days','7'],{dir:rdir,now:NOW,print:t=>brief.push(t)});assert.equal(brief.length,1);assert.match(brief[0],/^Play, last 7 days: 4 sessions/);
 const json=[];report.report(['--json'],{dir:rdir,now:NOW,print:t=>json.push(t)});assert.equal(JSON.parse(json[0]).sessions,4);
 const empty=fs.mkdtempSync(path.join(os.tmpdir(),'qb-play-empty-'));const none=[];report.report(['--brief'],{dir:empty,now:NOW,print:t=>none.push(t)});assert.match(none[0],/no sessions recorded yet/);fs.rmSync(empty,{recursive:true,force:true});
 // A hosted data folder (metrics.jsonl and feedback.jsonl).
 const hosted=fs.mkdtempSync(path.join(os.tmpdir(),'qb-play-hosted-'));fs.writeFileSync(path.join(hosted,'metrics.jsonl'),JSON.stringify(rec(1,0,{device:'h1',session:'h1',from:'hosted'}))+'\n');
 assert.equal(report.playSummary({dir:hosted,days:7,now:NOW}).sessions,1);fs.rmSync(hosted,{recursive:true,force:true});
}finally{fs.rmSync(rdir,{recursive:true,force:true});}

// 6. Through the gateway and the desktop server.
const request=(port,method,route,body,{origin,host,cookie='',type='application/json'}={})=>new Promise((resolve,reject)=>{const raw=body==null?'':typeof body==='string'?body:JSON.stringify(body);const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:host,...(origin?{Origin:origin}:{}),'Content-Type':type,Cookie:cookie,'Content-Length':Buffer.byteLength(raw)}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:t}));});req.on('error',reject);req.end(raw);});
(async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'qb-metrics-gate-')),site=path.join(home,'site');fs.mkdirSync(site);fs.writeFileSync(path.join(site,'index.html'),'<h1>game</h1>');
 const metricsFile=path.join(home,'.questbound-metrics.jsonl');let clock=NOW;
 const {createPhoneServer}=require('./phone-server.cjs');
 const gate=createPhoneServer({host:'127.0.0.1',port:0,root:site,code:'13572468',now:()=>clock,fetchImpl:async()=>{throw Error('no backend');},metricsFile});
 const bare=createPhoneServer({host:'127.0.0.1',port:0,root:site,code:'13572468',fetchImpl:async()=>{throw Error('no backend');}});
 await new Promise(r=>gate.server.listen(0,'127.0.0.1',r));await new Promise(r=>bare.server.listen(0,'127.0.0.1',r));
 const at={host:'127.0.0.1:0',origin:'http://127.0.0.1:0'};
 try{
  const port=gate.server.address().port;
  assert.equal((await request(port,'POST','/api/metrics',good,at)).status,401,'an unpaired browser sends nothing');
  const paired=await request(port,'POST','/pair',{code:'13572468'},at);const cookie=paired.headers['set-cookie'][0].split(';')[0];
  const as={...at,cookie};
  assert.equal((await request(port,'POST','/api/metrics',good,as)).status,200);
  assert.equal((await request(port,'POST','/api/metrics',JSON.stringify({...good,seq:1}),{...as,type:'text/plain;charset=UTF-8'})).status,200,'sendBeacon sends text/plain');
  assert.equal((await request(port,'POST','/api/metrics',good,{...as,origin:'https://elsewhere.example'})).status,403,'another site cannot post');
  assert.equal((await request(port,'POST','/api/metrics','a=1',{...as,type:'application/x-www-form-urlencoded'})).status,403);
  assert.equal((await request(port,'POST','/api/metrics',{...good,ended:'Mara'},as)).status,400,'the schema is checked');
  assert.equal((await request(port,'POST','/api/metrics',{...good,pad:'x'.repeat(3000)},as)).status,413,'records are small');
  const saved=fs.readFileSync(metricsFile,'utf8').trim().split('\n').map(l=>JSON.parse(l));assert.equal(saved.length,2);assert.ok(saved.every(r=>r.from==='link'&&!('guest' in r)&&!/cookie|address/i.test(JSON.stringify(r))),'no label, cookie or address is kept');
  let limited=0;for(let i=0;i<70;i++){const r=await request(port,'POST','/api/metrics',{...good,seq:2+i%400},as);if(r.status===429){limited++;assert.match(r.headers['retry-after'],/^\d+$/);}}
  assert.equal(limited,14,'sixty an hour per browser (the four above, refused or not, count too)');
  clock+=3600001;assert.equal((await request(port,'POST','/api/metrics',good,as)).status,200,'the window slides');
  // Without a metrics file the route is not there.
  const bport=bare.server.address().port,bpaired=await request(bport,'POST','/pair',{code:'13572468'},at);
  assert.equal((await request(bport,'POST','/api/metrics',good,{...at,cookie:bpaired.headers['set-cookie'][0].split(';')[0]})).status,404);
 }finally{gate.server.close();bare.server.close();}
 // The host's desktop: its own page only, marked as this PC's; the summary for Developer checks.
 const {createDesktopServer}=require('./desktop-server.cjs');
 const probe=createDesktopServer({root:site,port:0});await new Promise(r=>probe.listen(0,'127.0.0.1',r));const dport=probe.address().port;probe.close();
 const deskFile=path.join(home,'desk','.questbound-metrics.jsonl');fs.mkdirSync(path.dirname(deskFile));
 const desk=createDesktopServer({root:site,port:dport,feedbackFile:path.join(home,'desk','playtest-feedback.md'),metricsFile:deskFile});await new Promise(r=>desk.listen(dport,'127.0.0.1',r));
 try{
  const own={host:'localhost:'+dport,origin:'http://localhost:'+dport};
  assert.equal((await request(dport,'POST','/api/metrics',good,own)).status,200);
  assert.equal((await request(dport,'POST','/api/metrics',good,{...own,origin:'https://elsewhere.example'})).status,403);
  assert.equal((await request(dport,'POST','/api/metrics',{...good,v:3},own)).status,400);
  assert.equal(JSON.parse(fs.readFileSync(deskFile,'utf8').trim()).from,'desktop');
  const summary=await request(dport,'GET','/api/metrics/summary',null,{host:'localhost:'+dport});assert.equal(summary.status,200);assert.match(JSON.parse(summary.text).line,/^Play, last 7 days: no sessions recorded yet\./,'this PC\'s own sessions are left out of the headline');
  assert.equal((await request(dport,'GET','/api/metrics/summary',null,{host:'questbound.example:'+dport})).status,403,'the Host check stays');
 }finally{desk.close();fs.rmSync(home,{recursive:true,force:true});}
 console.log('Metrics: the schema keeps only numbers, fixed words and random ids (nothing typed or named, '+tries+' tries); the device counts time, turns and failures without words, sends once per change, forgets its id when turned off and waits for the agreement; the gateway and desktop take records from the game\'s own page within sixty an hour; records older than 180 days are pruned; play-report works out sessions, devices, length, where sessions ended, failed turns per 200, story waits and ratings; the session question asks only at a stopping point, once a day at most, never early or after a recent Not now.');
})().catch(e=>{console.error(e);process.exit(1);});
