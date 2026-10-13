// Moderation (asked for by the host on 2026-10-13: "add per-player mute or report and a host ban, and run players'
// text through OpenAI's free moderation check"). Nothing here calls OpenAI: the moderation check is given a fake fetch.
//  1. moderation.cjs: verdicts by category score (violence never held back, minors always), the caring line for
//     self-harm, stricter names, the short cache, failing open on errors and timeouts, strikes and pauses, and a
//     security log with category names and pseudonymous labels only.
//  2. dm-server.cjs generate: typed words are checked before the story model is asked (and held back with 422), a
//     paused player waits (403), scene cues are not checked, mode 'moderate' answers for names, and nothing is
//     checked without a moderation instance (the other fake-fetch checks).
//  3. The account service: table names vetted, a report reaching the host's notes (and feedback-report.cjs) with the
//     reported member's label and lines, the host's remove-and-ban, the removed device's calm answer, invites refused,
//     unban, and the game-wide ban (node accounts.cjs ban) refusing the Dungeon Master, tables, guests and feedback.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {createModeration,verdictFor,moderationLine,pauseLine,ENDPOINT,MODEL}=require('./moderation.cjs');
const {generate,typedByPlayer}=require('./dm-server.cjs');
const {moderationLabel}=require('./bans.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-moderation-'));
const scores=(over={})=>({categories:Object.fromEntries(Object.keys(over).map(k=>[k,over[k]>=0.5])),category_scores:{'sexual':0.001,'sexual/minors':0.0001,'hate':0.001,'hate/threatening':0.0001,'harassment':0.002,'harassment/threatening':0.001,'self-harm':0.0001,'self-harm/intent':0.0001,'self-harm/instructions':0.0001,'violence':0.01,'violence/graphic':0.001,'illicit':0.001,'illicit/violent':0.001,...over}});
// The fake provider: each text's scores by a keyword in it.
const table={
 'clean':scores(),
 'gore':scores({'violence':0.99,'violence/graphic':0.97,'harassment/threatening':0.6}),
 'insult':scores({'harassment':0.7}),
 'slur':scores({'hate':0.93,'harassment':0.8}),
 'slur2':scores({'hate':0.91}),
 'slur3':scores({'hate':0.95}),
 'minor':scores({'sexual/minors':0.12,'sexual':0.4}),
 'hurtme':scores({'self-harm':0.9,'self-harm/intent':0.88}),
 'lewd':scores({'sexual':0.9}),
};
const fakeModeration=(log=[])=>async(url,options)=>{
 assert.equal(url,ENDPOINT);assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer test-only');
 const sent=JSON.parse(options.body);assert.equal(sent.model,MODEL);assert.equal(sent.model,'omni-moderation-latest');log.push(sent.input);
 const key=Object.keys(table).sort((a,b)=>b.length-a.length).find(k=>sent.input.includes(k))??'clean';
 return {ok:true,json:async()=>({id:'modr-test',model:MODEL,results:[table[key]]})};
};
async function unit(){
 // Pure verdicts.
 assert.deepEqual(verdictFor(table.clean),{action:'allow',categories:[]});
 assert.equal(verdictFor(table.gore).action,'allow','violence, even graphic, is the game: never held back');
 assert.equal(verdictFor(table.insult).action,'allow','tavern insults pass at the table');
 assert.equal(verdictFor(table.insult,'name').action,'refuse','but not as a table name');
 assert.deepEqual(verdictFor(table.slur),{action:'refuse',categories:['hate']});
 assert.deepEqual(verdictFor(table.minor).categories,['sexual/minors'],'sexual content involving minors is always held back');
 assert.equal(verdictFor({categories:{'sexual/minors':true},category_scores:{'sexual/minors':0.01}}).action,'refuse','the provider\'s own flag counts for minors');
 assert.deepEqual(verdictFor(table.hurtme),{action:'care',categories:['self-harm/intent','self-harm']});
 assert.equal(verdictFor(table.lewd).action,'refuse');
 assert.match(moderationLine({action:'care',categories:['self-harm/intent']}),/988.*116 123.*findahelpline\.com/);
 assert.match(moderationLine({action:'refuse',categories:['hate']}),/hateful words.*never saw it.*unchanged/);
 assert.match(moderationLine({action:'refuse',categories:['harassment']},'name'),/^That name was held back.*Choose another name\.$/);
 for(const line of [moderationLine({action:'refuse',categories:['hate']}),moderationLine({action:'care',categories:['self-harm']}),pauseLine(600000)])
  assert.doesNotMatch(line,/Please wait before asking|busy with other players/,'the game must not keep retrying a held-back message');
 // The check itself, with a fake provider.
 let t=Date.parse('2026-10-13T12:00:00Z');const now=()=>t,logFile=path.join(root,'security.jsonl'),sent=[];
 const m=createModeration({fetchImpl:fakeModeration(sent),now,logFile,timeout:200});
 const guest='account-'+'ab'.repeat(32);
 assert.deepEqual(await m.check('I swing at the goblin and split it in two (gore)',{apiKey:'test-only',guest}),{action:'allow',categories:[]});
 const held=await m.check('you slur',{apiKey:'test-only',guest});assert.equal(held.action,'refuse');assert.match(held.line,/hateful/);
 assert.equal((await m.check('you slur',{apiKey:'test-only',guest})).action,'refuse');assert.equal(sent.length,2,'a verdict is remembered for a while');
 assert.equal(m.paused(guest),0,'a message sent twice at once counts once');
 const cared=await m.check('hurtme please',{apiKey:'test-only',guest});assert.equal(cared.action,'care');assert.match(cared.line,/reach out/);
 assert.equal(m.paused(guest),0,'words about the player\'s own safety never count against them');
 assert.equal((await m.check('a slur2 again',{apiKey:'test-only',guest})).action,'refuse');assert.equal(m.paused(guest),0);
 t+=40000;assert.equal((await m.check('more slur3',{apiKey:'test-only',guest})).action,'refuse');
 assert.ok(m.paused(guest)>0,'three held back in an hour pause that player');assert.match(m.pauseLine(m.paused(guest)),/about 20 minutes/);
 t+=1200001;assert.equal(m.paused(guest),0,'the pause ends');
 assert.equal((await m.check('minor',{apiKey:'test-only',guest:'cd'.repeat(16)})).action,'refuse');assert.equal(m.paused('cd'.repeat(16)),0);
 t+=40000;assert.equal((await m.check('a minor again',{apiKey:'test-only',guest:'cd'.repeat(16)})).action,'refuse');assert.ok(m.paused('cd'.repeat(16))>0,'minors count twice');
 // Names are checked against their own, stricter limits, cached apart from turns.
 assert.equal((await m.check('insult',{apiKey:'test-only',purpose:'name'})).action,'refuse');assert.equal((await m.check('insult',{apiKey:'test-only'})).action,'allow');
 assert.deepEqual(await m.check('   ',{apiKey:'test-only'}),{action:'allow',categories:[]},'nothing typed, nothing checked');
 // Failing open: an error, a bad answer or a timeout lets the words through, noted once.
 let calls=0;
 const broken=createModeration({fetchImpl:async()=>{calls++;return {ok:false,status:500,json:async()=>({})};},now,logFile});
 assert.deepEqual(await broken.check('slur',{apiKey:'test-only',guest}),{action:'allow',categories:[],unchecked:true});
 assert.equal((await broken.check('slur',{apiKey:'test-only',guest})).unchecked,true);assert.equal(calls,2,'an unchecked verdict is not remembered');
 const slow=createModeration({fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))),now,logFile:null,timeout:50});
 const started=Date.now();assert.equal((await slow.check('slur',{apiKey:'test-only',guest})).unchecked,true);assert.ok(Date.now()-started<2000,'a slow check gives up quickly');
 const odd=createModeration({fetchImpl:async()=>({ok:true,json:async()=>({results:[]})}),now,logFile:null});assert.equal((await odd.check('slur',{apiKey:'test-only'})).unchecked,true);
 // The security log: event names, categories and pseudonymous labels, never the words or ids.
 const rows=fs.readFileSync(logFile,'utf8').trim().split('\n').map(l=>JSON.parse(l)),text=JSON.stringify(rows);
 assert.ok(rows.some(r=>r.event==='moderation-refused'&&r.route==='turn:hate'&&r.account===moderationLabel('ab'.repeat(32))));
 assert.ok(rows.some(r=>r.event==='moderation-care'&&r.route==='turn:self-harm:intent+self-harm'));
 assert.ok(rows.some(r=>r.event==='moderation-paused'));assert.equal(rows.filter(r=>r.event==='moderation-unavailable').length,1,'an outage is noted at most every ten minutes');
 assert.ok(rows.some(r=>r.event==='moderation-refused'&&r.route==='name:harassment'&&r.account==='host'));
 for(const word of ['slur','hurtme','insult','a minor again','ab'.repeat(32),'cd'.repeat(16)])assert.ok(!text.includes(word),'the log never holds the words or the id ('+word+')');
 return now;
}
async function dm(){
 const body={input:'I return to the inn.',context:{choices:[{id:'travel-inn',label:'Travel to inn'}]}};
 let asked=0;const story=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');asked++;return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'The road leads back to the inn.',actionId:'travel-inn'})}]}]})};};
 const sent=[],check=createModeration({fetchImpl:fakeModeration(sent),logFile:null}),opts={apiKey:'test-only',model:'test-model',fetchImpl:story,moderation:check};
 const guest='account-'+'ef'.repeat(32);
 assert.equal((await generate({...body,guest},opts)).actionId,'travel-inn');assert.equal(asked,1);assert.deepEqual(sent,['I return to the inn.'],'typed words are checked first');
 await assert.rejects(generate({...body,input:'I shout a slur at the innkeeper.',guest},opts),e=>e.httpStatus===422&&/hateful words/.test(e.message));
 assert.equal(asked,1,'held-back words never reach the story model');
 await assert.rejects(generate({...body,input:'hurtme, I mean it',guest},opts),e=>e.httpStatus===422&&/988/.test(e.message));
 assert.equal((await generate({...body,input:'I cleave the orc in a spray of gore.',guest},opts)).actionId,'travel-inn','fantasy violence goes through');
 // A scene cue the game wrote is not checked; the idea for a tale of one's own is; a hero drafted from a description is.
 assert.equal(typedByPlayer({input:'slur cue',context:{sceneTrigger:{id:'x',cue:'c'}}}),'');
 assert.equal(typedByPlayer({input:'Create a fresh adventure.',context:{mode:'adventure',idea:'A slur-filled tale'}}),'A slur-filled tale');
 assert.equal(typedByPlayer({input:'A brave knight',context:{mode:'character'}}),'A brave knight');
 assert.equal(typedByPlayer({input:'x',context:{mode:'art'}}),'');
 await assert.rejects(generate({input:'Create a fresh adventure.',context:{mode:'adventure',idea:'a lewd idea for a tale',choices:[]},guest},{...opts,fetchImpl:async()=>{throw Error('never asked');}}),e=>e.httpStatus===422);
 // Names from the account service (mode 'moderate'): a verdict, never a turn.
 const named=await generate({input:'Lord insult',context:{mode:'moderate',choices:[]},guest},opts);assert.equal(named.moderation.action,'refuse');assert.match(named.moderation.line,/Choose another name/);
 assert.equal((await generate({input:'Sam',context:{mode:'moderate',choices:[]},guest},opts)).moderation.action,'allow');assert.equal(asked,2,'a name check never asks the story model');
 assert.deepEqual((await generate({input:'Sam',context:{mode:'moderate',choices:[]}},{apiKey:'test-only',model:'test-model',fetchImpl:story})).moderation,{action:'allow',categories:[],unchecked:true});
 // Three held back (a turn, an idea and a name): that player's Dungeon Master is paused, even for clean words.
 assert.ok(check.paused(guest)>0);await assert.rejects(generate({...body,guest},opts),e=>e.httpStatus===403&&/paused/.test(e.message));
 // Without a moderation instance (every other fake-fetch check) nothing extra is asked.
 let only=0;await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async(url,o)=>{only++;assert.equal(url,'https://api.openai.com/v1/responses');return story(url,o);}});assert.equal(only,1);
 // A paused player: refused with 403 before any call.
 const tick={t:Date.now()},paused=createModeration({fetchImpl:fakeModeration([]),logFile:null,now:()=>tick.t});
 for(const w of ['slur','slur2','slur3'])await paused.check(w,{apiKey:'test-only',guest});
 await assert.rejects(generate({...body,guest},{...opts,moderation:paused,fetchImpl:async()=>{throw Error('never asked');}}),e=>e.httpStatus===403&&/paused for about 20 minutes/.test(e.message));
 assert.equal((await generate(body,{...opts,moderation:paused})).actionId,'travel-inn','the host\'s own requests are never paused');
 // The live path loads moderation.cjs and keeps it loaded (revision literal in dm-server.cjs).
 assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes("require('./moderation.cjs').revision!==1")&&require('./moderation.cjs').revision===1);
}
async function service(){
 const {createSyncServer}=require('./account-server.cjs'),{fixtures}=require('./test-fixtures.cjs'),{report:feedbackReport}=require('./feedback-report.cjs'),{findIdentity}=require('./accounts.cjs');
 const home=path.join(root,'svc');let tick=Date.parse('2026-10-13T12:00:00Z');const names=[];
 const fx=fixtures(home,{now:()=>tick,moderate:async(text,user)=>{names.push(text);return /Vile/.test(text)?{action:'refuse',categories:['hate'],line:'That name was held back by the game’s content check (hateful words). Choose another name.'}:{action:'allow',categories:[]};}});
 const svc=createSyncServer(fx.options);await new Promise(r=>svc.server.listen(0,'127.0.0.1',r));const at='http://127.0.0.1:'+svc.server.address().port;
 const ask=async(route,body={},cookie='',headers={})=>{const response=await fetch(at+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie,...headers},body:JSON.stringify({expectedAccountId:'guest',...body})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};};
 const guest=async n=>{const g=await ask('account-guest',{},'',{'X-Questbound-Client':'198.51.100.'+n});assert.equal(g.status,200);return {cookie:g.cookie.split(';')[0],id:g.body.id};};
 const servers=[svc.server];
 try{
  const A=await guest(1),B=await guest(2),C=await guest(3);
  // Table names go through the content check.
  const bad=await ask('campaign-create',{snapshot:fx.snapshot('fighter'),party:true,name:'Vile Ann'},A.cookie);assert.equal(bad.status,400);assert.match(bad.body.error,/Choose another name/);
  const made=await ask('campaign-create',{snapshot:fx.snapshot('fighter'),party:true,name:'Ann'},A.cookie);assert.equal(made.status,200,JSON.stringify(made.body));const campaignId=made.body.campaignId;
  assert.equal((await ask('campaign-join',{invite:made.body.invite,snapshot:fx.snapshot('wizard'),name:'Vile Ben'},B.cookie)).status,400);
  const joined=await ask('campaign-join',{invite:made.body.invite,snapshot:fx.snapshot('wizard'),name:'Ben'},B.cookie);assert.equal(joined.status,200,JSON.stringify(joined.body));
  assert.deepEqual(names,['Vile Ann','Ann','Vile Ben','Ben']);
  const ben=joined.body.you,ann=made.body.you;
  assert.deepEqual(joined.body.members.map(m=>m.name),['Ann','Ben'],'every member is listed, here or not');assert.equal(joined.body.banned,undefined,'only the host sees who is kept out');
  assert.deepEqual(made.body.banned,[]);
  // Ben types something; his line in the shared feed carries his seat.
  const turn=await ask('campaign-turn',{campaignId,question:'I mutter something rude at Ann.',requestId:crypto.randomUUID(),baseVersion:joined.body.version},B.cookie);assert.equal(turn.status,200,JSON.stringify(turn.body));
  const line=turn.body.snapshot.game.playback.flatMap(t=>t.events).find(e=>e.kind==='player'&&e.text==='I mutter something rude at Ann.');
  assert.equal(line.speakerSeat,ben);assert.equal(line.speakerName,'Ben');
  // Ann reports Ben: it lands in the host's notes with his label and lines, never an id.
  assert.equal((await ask('campaign-report',{campaignId,seat:ann,reason:'hateful'},A.cookie)).status,400,'not yourself');
  assert.equal((await ask('campaign-report',{campaignId,seat:ben,reason:'mean'},A.cookie)).status,400,'a reason from the list');
  const reported=await ask('campaign-report',{campaignId,seat:ben,reason:'harassment',words:'He keeps insulting me.\n## not a heading'},A.cookie);assert.equal(reported.status,200,JSON.stringify(reported.body));
  assert.equal((await ask('campaign-report',{campaignId,seat:ben,reason:'harassment'},A.cookie)).status,429,'one report a member per ten minutes');
  const notes=fs.readFileSync(path.join(home,'feedback.md'),'utf8'),records=fs.readFileSync(path.join(home,'feedback.jsonl'),'utf8');
  assert.match(notes,/Report: Ben \(Harassment\)/);assert.match(notes,/- I mutter something rude at Ann\./);assert.ok(notes.includes(moderationLabel(B.id)));assert.ok(notes.includes('node accounts.cjs ban '+moderationLabel(B.id)));
  assert.ok(!/\n## not a heading/.test(notes),'a report cannot write headings');
  for(const id of [A.id,B.id])assert.ok(!notes.includes(id)&&!records.includes(id),'no guest id in a report');
  const record=JSON.parse(records.trim().split('\n').at(-1));assert.equal(record.kind,'report');assert.equal(record.report.reported.seat,ben);assert.deepEqual(record.report.lines,['I mutter something rude at Ann.']);
  const printed=[];feedbackReport(['--all'],{dir:home,print:l=>printed.push(l)});assert.match(printed.join('\n'),/REPORT \(harassment\): Ben · mod-[a-f0-9]{20} · reported by Ann/);assert.match(printed.join('\n'),/typed: I mutter something rude at Ann\./);
  // Only the host removes; the host bans Ben, whose seat and hero leave the table.
  assert.equal((await ask('campaign-ban',{campaignId,seat:ann},B.cookie)).status,403);
  assert.equal((await ask('campaign-ban',{campaignId,seat:ann},A.cookie)).status,400,'the host cannot remove themselves');
  const banned=await ask('campaign-ban',{campaignId,seat:ben},A.cookie);assert.equal(banned.status,200,JSON.stringify(banned.body));
  assert.deepEqual(banned.body.members.map(m=>m.name),['Ann']);assert.equal(banned.body.banned.length,1);assert.equal(banned.body.banned[0].name,'Ben');assert.match(banned.body.banned[0].ref,/^[a-f0-9]{12}$/);
  assert.ok(!JSON.stringify(banned.body).includes(B.id)&&!('hash' in banned.body.banned[0]),'the host sees a name and a ref, never a hash or id');
  assert.ok(!Object.keys(banned.body.snapshot.game.party.members).includes(ben),'his hero left the party');
  const stored=JSON.parse(fs.readFileSync(path.join(home,'table','campaigns',campaignId+'.json'),'utf8'));assert.ok(require('./campaigns.cjs').validSnapshot(stored.snapshot),'the table is still valid');
  assert.ok(!JSON.stringify(stored.banned).includes(B.id),'kept as a keyed hash');
  // Ben's device is told calmly; old and new invites refuse him; the host can still play.
  const poll=await ask('poll',{campaignId},B.cookie);assert.equal(poll.status,403);assert.equal(poll.body.removed,true);assert.match(poll.body.error,/removed you from it.*not affected/);
  assert.equal((await ask('campaign-turn',{campaignId,question:'Hello?',requestId:crypto.randomUUID(),baseVersion:banned.body.version},B.cookie)).body.removed,true);
  const again=await ask('campaign-join',{invite:made.body.invite,snapshot:fx.snapshot('wizard'),name:'Ben'},B.cookie);assert.equal(again.status,403);assert.equal(again.body.removed,true);
  const invite=(await ask('campaign-invite',{campaignId},A.cookie)).body.invite;assert.equal((await ask('campaign-join',{invite,snapshot:fx.snapshot('wizard'),name:'Ben'},B.cookie)).status,403);
  const cara=await ask('campaign-join',{invite,snapshot:fx.snapshot('cleric'),name:'Cara'},C.cookie);assert.equal(cara.status,200,'others still join');
  const play=await ask('campaign-turn',{campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:cara.body.version},A.cookie);assert.equal(play.status,200,JSON.stringify(play.body));
  // Unbanning: only the host, by ref; then Ben may join again with an invite.
  assert.equal((await ask('campaign-unban',{campaignId,ref:banned.body.banned[0].ref},C.cookie)).status,403);
  assert.equal((await ask('campaign-unban',{campaignId,ref:'0'.repeat(12)},A.cookie)).status,404);
  const unbanned=await ask('campaign-unban',{campaignId,ref:banned.body.banned[0].ref},A.cookie);assert.equal(unbanned.status,200);assert.deepEqual(unbanned.body.banned,[]);
  const back=await ask('campaign-join',{invite,snapshot:fx.snapshot('wizard'),name:'Ben'},B.cookie);assert.equal(back.status,200,JSON.stringify(back.body));
  // The game-wide ban: the host finds Ben by the label in the report and bans him (node accounts.cjs ban <label>).
  assert.deepEqual(findIdentity(moderationLabel(B.id),svc.accounts.knownIds()),[B.id]);
  assert.deepEqual(findIdentity('account-'+B.id.slice(0,16),svc.accounts.knownIds()),[B.id]);assert.deepEqual(findIdentity('qb-acct-'+B.id.slice(0,32),svc.accounts.knownIds()),[B.id]);
  assert.deepEqual(findIdentity('beef',svc.accounts.knownIds()),[],'too short to name anyone');
  assert.equal(svc.bans.ban(B.id,{note:'harassment at a table'}),moderationLabel(B.id));
  for(const route of ['poll','usage','campaign-list','account-status']){const r=await ask(route,{campaignId,kind:'dm'},B.cookie);assert.equal(r.status,403,route);assert.equal(r.body.banned,true,route);}
  const noNew=await ask('account-guest',{},B.cookie,{'X-Questbound-Client':'198.51.100.2'});assert.equal(noNew.status,403,'a banned browser is not handed a fresh guest');assert.equal(noNew.cookie,null);
  assert.equal((await ask('poll',{campaignId},A.cookie)).status,200,'others are untouched');
  assert.deepEqual(svc.bans.list().map(b=>b.label),[moderationLabel(B.id)]);
  // The gateway refuses the banned browser's feedback (it asks /usage as for the Dungeon Master).
  const {createPhoneServer}=require('./phone-server.cjs'),site=path.join(home,'site');fs.mkdirSync(site,{recursive:true});fs.writeFileSync(path.join(site,'index.html'),'<h1>Q</h1>');
  const share=createPhoneServer({host:'127.0.0.1',port:0,root:site,publicOrigin:'https://play.example',code:'24681357',backends:[],syncBackend:at,feedbackFile:path.join(home,'gateway-notes.md')});servers.push(share.server);
  await new Promise(r=>share.server.listen(0,'127.0.0.1',r));const gw=share.server.address().port;
  const via=(route,body,cookie='')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:gw,path:route,method:'POST',headers:{Host:'play.example',Origin:'https://play.example','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.7',Cookie:cookie}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(raw||'{}'),cookie:res.headers['set-cookie']?.[0]??''}));});req.on('error',reject);req.end(JSON.stringify(body));});
  const paired=(await via('/pair',{code:'24681357'})).cookie.split(';')[0];
  const refusedNote=await via('/api/feedback',{text:'Let me back in'},paired+'; '+B.cookie);assert.equal(refusedNote.status,403);assert.match(refusedNote.body.error,/closed it to this browser/);
  assert.ok(!fs.existsSync(path.join(home,'gateway-notes.md')),'nothing was kept');
  assert.equal((await via('/api/feedback',{text:'All good here'},paired+'; '+A.cookie)).status,200,'others still send notes');
  const dmTurn=await via('/api/dm',{input:'Hello',context:{choices:[]}},paired+'; '+B.cookie);assert.equal(dmTurn.status,403,'and the Dungeon Master refuses him');
  assert.equal(svc.bans.unban(moderationLabel(B.id)),moderationLabel(B.id));assert.equal((await ask('poll',{campaignId},B.cookie)).status,200,'unbanned');
  const security=fs.readFileSync(path.join(home,'.questbound-security.jsonl'),'utf8');for(const e of ['campaign-member-banned','campaign-ban-refused','campaign-member-unbanned','campaign-report','banned-refused'])assert.ok(security.includes('"'+e+'"'),e);
  // Rate: at most five reports an hour from one player.
  const D=await guest(4),dj=await ask('campaign-join',{invite,snapshot:fx.snapshot('rogue'),name:'Dee'},D.cookie);assert.equal(dj.status,200,JSON.stringify(dj.body));
  const seats=(await ask('poll',{campaignId},D.cookie)).body.members.filter(m=>m.name!=='Dee').map(m=>m.id);assert.equal(seats.length,3);
  for(const s of seats)assert.equal((await ask('campaign-report',{campaignId,seat:s,reason:'spam'},D.cookie)).status,200);
  tick+=11*60000;for(const s of seats.slice(0,2))assert.equal((await ask('campaign-report',{campaignId,seat:s,reason:'other'},D.cookie)).status,200);
  assert.equal((await ask('campaign-report',{campaignId,seat:seats[2],reason:'other'},D.cookie)).status,429,'five an hour');
 }finally{for(const s of servers)await new Promise(r=>s.close(r));}
}
// The device side: mute is kept per device and per campaign, and hides only the muted member's typed lines.
function mutes(){
 const vm=require('node:vm'),store=new Map();
 const src=fs.readFileSync('tableMutes.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const ctx={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},profileKey:k=>'questbound.profile.guest.'+k,tableMembership:()=>({campaignId:'c'.repeat(32)}),useState:()=>[0,()=>{}],useEffect:()=>{}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src+'\n;this.out={mutedMembers,setMuted,isMutedLine};',ctx);const {mutedMembers,setMuted,isMutedLine}=ctx.out;
 const ben={id:'seat-'+'1'.repeat(16),name:'Ben'};
 assert.deepEqual([...mutedMembers()],[]);setMuted(ben,true);assert.deepEqual(JSON.parse(JSON.stringify(mutedMembers())),[{seat:ben.id,name:'Ben'}]);
 const list=mutedMembers();
 assert.equal(isMutedLine({kind:'player',text:'rude',speakerSeat:ben.id,speakerName:'Ben'},list),true);
 assert.equal(isMutedLine({kind:'player',text:'old line',speakerName:'Ben'},list),true,'lines from before seats were recorded, by name');
 assert.equal(isMutedLine({kind:'player',text:'hi',speakerSeat:'seat-'+'2'.repeat(16),speakerName:'Ben'},list),false,'another member who shares the name is not muted');
 assert.equal(isMutedLine({kind:'dialogue',text:'NPC',speakerName:'Ben'},list),false,'only what players type');
 assert.equal(mutedMembers('d'.repeat(32)).length,0,'per campaign');
 setMuted(ben,false);assert.equal(mutedMembers().length,0);
 assert.ok(store.has('questbound.profile.guest.questbound.mutes.v1'),'kept on this device, in the player\'s profile');
}
// AbortSignal.timeout's timer does not keep the process alive by itself; this does, until the checks finish.
const alive=setInterval(()=>{},1000);
(async()=>{
 await unit();await dm();await service();mutes();
 console.log('Verified moderation: OpenAI\'s moderation check (fake provider) holds back hate, harassment, threats against people, sexual content and self-harm instructions by score, never violence, always minors; offers help for self-harm; checks table names more strictly; caches, fails open and pauses repeat offenders; logs only categories and labels; generate checks typed words before the story model; table reports reach the host\'s notes and feedback-report.cjs; the host\'s remove-and-ban, calm removal, refused invites and unban; the game-wide ban refusing the Dungeon Master, tables, new guests and feedback; per-device mutes.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearInterval(alive);fs.rmSync(root,{recursive:true,force:true});});
