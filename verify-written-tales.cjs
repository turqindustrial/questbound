// The Written tales shelf (the stories spec, sections 1 and 2.8; written-shelf.cjs, shelfRules.js): tales written by hand
// are served for good from the host's data folder, checked by the game's own rules, listed with their cards only (never
// a secret), started at once as a player's own copy that costs no AI and no new-tale allowance, begun at a table by the
// same journey id, and never bundled into the game a browser downloads. Also the device's side: the cards it keeps, its
// record of each tale, the default choice and Let fate decide, the completion card, and the play counts of a written
// tale (version 2 records, old ones still accepted).
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {rulesSource,readText}=require('./rules-files.cjs');
const read=f=>fs.readFileSync(f,'utf8');
// Values made in another context (vm) compare by their JSON.
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const fixture=JSON.parse(read('written-fixture.json'));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-written-'));
const shelfDir=path.join(tmp,'.questbound-written');fs.mkdirSync(shelfDir);
const listed={...fixture,listed:true,firstTale:true,order:1};
const write=(name,value)=>fs.writeFileSync(path.join(shelfDir,name),typeof value==='string'?value:JSON.stringify(value));
write(fixture.slug+'.json',listed);
// A second tale (a Medium, unlisted), a broken file, a misnamed one, a duplicate id and one the rules refuse.
const otherId='3a1f6c2e-4b5d-4e7f-8a9b-0c1d2e3f4a5b';
write('hidden-copy.json',{...listed,id:otherId,slug:'hidden-copy',length:'medium',minutes:[120,180],listed:false,firstTale:undefined});
write('broken.json','{"format":1,');
write('wrong-name.json',{...listed,id:'4b2a7d3f-5c6e-4f80-9bac-1d2e3f4a5b6c'});
write('zz-duplicate.json',{...listed,slug:'zz-duplicate'});
write('refused-tale.json',{...listed,id:'5c3b8e40-6d7f-4091-8cbd-2e3f4a5b6c7d',slug:'refused-tale',story:{...listed.story,chapters:[listed.story.chapters[0]]}});
write('plays.json','{}');
(async()=>{
 const {createShelf,publicTale,revision,fileProblem}=require('./written-shelf.cjs');
 assert.equal(revision,3);
 assert.ok(read('dm-server.cjs').includes("function loadWritten(){if(require('./written-shelf.cjs').revision!==3)"),'the Dungeon Master reloads the shelf only when its revision changes');
 const refused=[];const shelf=createShelf({dir:shelfDir,onRefused:n=>refused.push(n),fresh:0});

 // ---- 1. The shelf: what passes, what is listed, what is refused (noted with mechanical fields only) ----
 const cards=shelf.list();
 assert.deepEqual(cards.map(c=>c.slug),['kettle-camp'],'only the listed tale that passes the checks is on the shelf');
 const why=Object.fromEntries(refused.map(n=>[n.file,n.reason]));
 assert.equal(why['broken.json'],'unreadable');assert.equal(why['wrong-name.json'],'file:slug','a file must be named <slug>.json');assert.equal(why['refused-tale.json'],'rules','the game\'s own rules refuse a tale with one chapter');assert.equal(why['zz-duplicate.json'],'duplicate','two files with one id: the first is served');
 for(const n of refused){assert.deepEqual(Object.keys(n).sort(),['file','problems','reason']);assert.ok(!/Kettle|wolf/i.test(JSON.stringify(n)),'never the tale\'s words');}
 assert.ok(!refused.some(n=>n.file==='hidden-copy.json'),'an unlisted tale is served only to nobody, but it is not refused');
 assert.equal(shelf.info().tales,2);assert.equal(shelf.info().listed,1);
 // A file is checked once for its time and size: the same scan refuses nothing twice.
 const before=refused.length;shelf.list();shelf.list();assert.equal(refused.length,before,'a refused file is noted once');
 // The card: its pitch and the card's fields, never a secret, the staging, the walkthrough, chapter titles or endings' words.
 const card=cards[0];
 assert.deepEqual(Object.keys(card).sort(),['addedAt','blurb','chapters','cover','difficulty','edition','endings','firstTale','hook','id','length','levels','minutes','mood','notes','order','party','region','slug','special','terrain','title'].sort());
 assert.equal(card.chapters,2);assert.equal(card.endings,3);assert.equal(card.firstTale,true);assert.equal(card.cover,null,'no cover unless it costs nothing');
 const listing=JSON.stringify(cards);
 for(const secret of [fixture.story.secret,fixture.story.staging.endings[0].text,fixture.story.chapters[1].title,fixture.story.chapters[0].turn,JSON.stringify(fixture.walkthrough).slice(2,40)])assert.ok(!listing.includes(String(secret).slice(0,40)),'the listing never carries: '+String(secret).slice(0,30));
 const covered=publicTale({...listed,story:listed.story},{cover:()=>true});assert.equal(covered.cover.campaignId,'journey-'+fixture.id,'the cover is the tale\'s own opening place, under its art id');assert.equal(covered.cover.id,'inn');
 // A start: the player's own copy, tagged; counted in plays.json; an unknown, unlisted or malformed id starts nothing.
 const copy=shelf.start(fixture.id);
 assert.match(copy.id,uuid);assert.notEqual(copy.id,fixture.id);assert.equal(copy.status,'active');assert.equal(copy.libraryId,fixture.id);assert.equal(copy.artId,'journey-'+fixture.id);
 assert.deepEqual(copy.written,{slug:'kettle-camp',edition:1,length:'short'});assert.ok(copy.staging&&copy.secret,'the copy is the whole tale (the player\'s save holds it, as every tale\'s does)');
 assert.equal(shelf.start(fixture.id).id===copy.id,false,'every start is a copy of its own');
 assert.equal(shelf.plays()[fixture.id].plays,2,'starts are counted for measurement');
 assert.equal(shelf.start(otherId),null,'an unlisted tale is not started');assert.equal(shelf.start('nope'),null);assert.equal(shelf.start('00000000-0000-4000-8000-000000000000'),null);
 assert.equal(shelf.any('short').libraryId,fixture.id);assert.equal(shelf.any('long').libraryId,fixture.id,'any length when the tier has none');
 assert.equal(shelf.has(fixture.id),true);assert.equal(shelf.has(otherId),false);
 // A tale for a land (2026-10-23, match): a listed tale of that terrain, never one played on this device nor one whose
 // title the hero has lived; read only (starts are counted by start).
 {const t=fixture.story.terrain,was=shelf.plays()[fixture.id].plays;assert.equal(shelf.match({terrain:t}).id,fixture.id);assert.equal(shelf.match({terrain:t==='coast'?'snow':'coast'}),null,'only the same terrain');assert.equal(shelf.match({terrain:'lava'}),null);
  assert.equal(shelf.match({terrain:t,exclude:[fixture.id]}),null,'not one played on this device');assert.equal(shelf.match({terrain:t,titles:['  '+fixture.story.title.toUpperCase()]}),null,'nor one the hero lived');
  assert.equal(shelf.match({}).id,fixture.id,'any terrain when none is given');assert.equal(shelf.plays()[fixture.id].plays,was,'matching starts nothing');}
 // The rules accept the copy: it seats a hero into a valid adventure with its staging.
 {const r=require('./rules-engine.cjs').storyChecks();assert.equal(r.writtenCheck(copy).ok,true);}
 // Read again on a change (within 30 s live; at once here), and never retired: a tale stays on the shelf.
 write('hidden-copy.json',{...listed,id:otherId,slug:'hidden-copy',length:'medium',minutes:[120,180],listed:true,firstTale:undefined,order:2});
 assert.deepEqual(shelf.list().map(c=>c.slug),['kettle-camp','hidden-copy'],'the shelf\'s own order, never newest first');
 assert.equal(shelf.match({terrain:fixture.story.terrain}).id,otherId,'the least started tale is matched first');
 assert.equal(fileProblem({...listed,pitch:{...listed.pitch,hook:'x'.repeat(141)}},'kettle-camp.json'),'pitch');
 assert.equal(fileProblem({...listed,firstTale:false},'kettle-camp.json'),null,'firstTale false is as good as absent (the checker accepts it; on 2026-10-23 the shelf refused The Siege of Dunscaur for it)');assert.equal(fileProblem({...listed,firstTale:'yes'},'kettle-camp.json'),'firstTale');
 {const lazy=createShelf({dir:shelfDir,fresh:30000,now:()=>1000});assert.equal(lazy.list().length,2);fs.rmSync(path.join(shelfDir,'hidden-copy.json'));assert.equal(lazy.list().length,2,'a change is read within 30 s, not on every request');}

 // ---- 2. The Dungeon Master: the listing, a written start first, no new-tale allowance for it ----
 const dm=require('./dm-server.cjs');
 const noAi=async()=>{throw Error('no AI in checks');};
 const library={list:()=>[{id:'0f8fad5b-d9cb-469f-a165-70867728950e',title:'A Journey',hook:'h',blurb:'b',mood:'m',special:'s',chapters:2,region:null,terrain:null,cover:null}],start:id=>id==='0f8fad5b-d9cb-469f-a165-70867728950e'?{title:'A Journey',id:'copy',status:'active'}:null,any:()=>({title:'A Journey',id:'copy',status:'active'}),topUp:()=>false};
 const ask=(context,extra={})=>dm.generate({input:'Create a fresh adventure for my character.',context:{choices:[],...context},...extra},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library,...extra.options});
 const both=await ask({mode:'art',journeys:'list'});
 assert.deepEqual(Object.keys(both).sort(),['journeys','written']);assert.equal(both.journeys.length,1);assert.equal(both.written[0].slug,'kettle-camp');
 const alone=await dm.generate({input:'x',context:{mode:'art',journeys:'list',choices:[]}},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library:null});
 assert.deepEqual(alone.journeys,[]);assert.equal(alone.written.length,1,'the written tales are listed without the story writer\'s library');
 // A guest's written start: the host's ceilings are checked, but no 'tale' allowance is spent; a journey's start spends one.
 const spent=[];const spend={check:g=>{spent.push('check:'+g);return {ok:true};},allow:(g,kind)=>{spent.push('allow:'+kind);return {ok:true};}};
 const guest='account-'+'a'.repeat(64);
 const started=await dm.generate({input:'Create a fresh adventure for my character.',guest,context:{mode:'adventure',introId:'written',journey:fixture.id,choices:[]}},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library,spending:spend});
 assert.equal(started.written,true);assert.equal(started.journey,true);assert.equal(started.story.libraryId,fixture.id);assert.deepEqual(spent,['check:'+guest],'a written start spends no allowance');
 spent.length=0;
 const journey=await dm.generate({input:'Create a fresh adventure for my character.',guest,context:{mode:'adventure',introId:'easy',journey:'0f8fad5b-d9cb-469f-a165-70867728950e',easyStart:true,choices:[]}},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library,spending:spend});
 assert.equal(journey.story.title,'A Journey');assert.equal(journey.written,undefined);assert.deepEqual(spent,['check:'+guest,'allow:tale'],'a journey of the story writer\'s still counts');
 // Past the host's ceilings even a written start is refused (the pause and the ceilings hold for everything a guest asks).
 await assert.rejects(dm.generate({input:'Create a fresh adventure for my character.',guest,context:{mode:'adventure',journey:fixture.id,choices:[]}},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library,spending:{check:()=>({ok:false,error:'Paused.',status:503}),allow:()=>({ok:true})}}),e=>e.httpStatus===503);
 // A game from before the shelf asking for Let fate decide or Easy to get into gets a Short written tale first.
 for(const introId of ['easy','surprise']){const old=await ask({mode:'adventure',introId});assert.equal(old.story.libraryId,fixture.id,introId+' gets a written tale');assert.equal(old.written,true);}
 assert.equal((await ask({mode:'adventure',introId:'easy'},{options:{written:createShelf({dir:path.join(tmp,'empty')})}})).story.title,'A Journey','with no written tales, a journey as before');
 // A journey id the shelf does not know goes to the story writer's library (and, gone from it, the usual 409).
 await assert.rejects(ask({mode:'adventure',journey:'11111111-2222-4333-8444-555555555555'}),e=>e.httpStatus===409);
 // A tale for a land (2026-10-23): the next tale in a region, or a tale in a land the hero reaches, takes a written tale
 // of that terrain first (dm-server.cjs taleMatch), at once and with no allowance spent; with none it is written.
 spent.length=0;
 {const next=extra=>dm.generate({input:'Create the next chapter of my character\'s journey in the same region.',guest,context:{mode:'adventure',introId:'surprise',continuing:{previousTitle:'Old'},land:{name:'The Kettle Wood',terrain:fixture.story.terrain},previousTitles:['Old'],choices:[],...extra}},{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library,spending:spend});
  const here=await next({});assert.ok(here.written===true&&here.matched===true&&here.journey===true&&here.story.libraryId===fixture.id,'a written tale for the land');assert.deepEqual(spent,['check:'+guest],'no allowance spent');
  spent.length=0;await assert.rejects(next({playedTales:[fixture.id]}),/no AI in checks/,'played on this device: written by the story writer');assert.deepEqual(spent,['check:'+guest,'allow:tale']);
  spent.length=0;await assert.rejects(next({idea:'A wolf pack that hunts by lantern light',introId:'idea'}),/no AI in checks/,'the player\'s own idea is always written');}

 // ---- 3. A table's tale started by the written tale's id (campaigns.cjs unchanged) ----
 {const {createCampaigns}=require('./campaigns.cjs'),rules=require('./rules-engine.cjs').rules(),{createOperations}=require('./operations.cjs');
  const dir=path.join(tmp,'table');const operations=createOperations({dir,key:crypto.randomBytes(32)});
  const c=createCampaigns({dir:path.join(dir,'campaigns'),operations,ask:async p=>dm.generate(p,{apiKey:null,model:'m',fetchImpl:noAi,written:shelf,library:null}),randomImpl:()=>.5});
  const r=vm.runInNewContext(rulesSource()+'\n({readyHero,newAdventure,adventureSnapshot})',{AsyncStorage:{}});
  const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),A={id:'a'.repeat(64)},B={id:'b'.repeat(64)};
  const solo=(hero,game)=>JSON.parse(JSON.stringify(r.adventureSnapshot(hero,game,null,true)));
  const made=c.create(A,{snapshot:solo(kara,r.newAdventure(kara)),name:'Al'});
  const joined=c.join(B,{invite:made.invite,name:'Bo',snapshot:solo(ilyra,r.newAdventure(ilyra))});
  const begun=await c.tale(A,{campaignId:made.campaignId,baseVersion:joined.version,journey:fixture.id});
  const g=begun.snapshot.game;assert.equal(g.story.title,fixture.story.title);assert.equal(g.story.libraryId,fixture.id);assert.equal(begun.tale.libraryId,fixture.id);
  assert.ok(g.story.staging&&g.story.written&&g.pace,'the table keeps the staging and the pace (world state)');assert.equal(Object.keys(g.party.members).length,2,'every hero at the table begins it');
  assert.ok(rules.validAdventure(begun.snapshot,JSON.parse(begun.snapshot.character)),'a valid table');}

 // ---- 4. The device: cards, records, the default choice, Let fate decide, the completion card ----
 const helpers=vm.runInNewContext(rulesSource({extra:['shelfRules.js']})+'\n({cleanWritten,cleanTaleRecords,nextTaleRecord,shelfStatus,shelfDefault,shelfTab,shelfTabFor,shelfTiersShown,shelfLived,fateWritten,shelfFinishCard,taleEndCard,landTaleCard,writtenChoice,writtenIdOf,readyHero,newAdventure,freshStoryGame,taleQuestView,taleSayLines})',{AsyncStorage:{}});
 {const h=helpers,medium={...both.written[0],id:otherId,slug:'hidden-copy',length:'medium',order:2,firstTale:false,title:'Another'},long={...medium,id:'6d4c9f51-7e80-41a2-9dce-3f4a5b6c7d8e',slug:'long-one',length:'long',order:3,title:'Long One'};
  const sent=[{...long,secret:'no',staging:{v:1}},both.written[0],medium,{id:'bad',length:'short',title:'x',hook:'y'},{...medium}];
  const clean=h.cleanWritten(sent);same(clean.map(c=>c.slug),['kettle-camp','hidden-copy','long-one'],'malformed and repeated cards dropped, the shelf\'s order kept');assert.equal(clean[2].secret,undefined);assert.equal(clean[2].staging,undefined);
  same(h.shelfTiersShown(clean),['short','medium','long']);assert.equal(h.shelfTabFor(clean,'nonsense'),'short');assert.equal(h.shelfTabFor(clean,'long'),'long');
  assert.equal(h.writtenIdOf(h.writtenChoice(fixture.id)),fixture.id);assert.equal(h.writtenIdOf('journey:'+fixture.id),null);
  // A new device: Start here; then the first unfinished tale of the tab used last.
  assert.equal(h.shelfDefault(clean,{},null),fixture.id);
  const kara=h.readyHero('fighter'),game=h.freshStoryGame(kara,{...copy,id:'copy-1'},h.newAdventure(kara));
  const rec=h.nextTaleRecord(null,game,kara,{now:5,seconds:100});assert.equal(rec.chapter,1);assert.equal(rec.of,2);assert.equal(rec.hero,kara.name);assert.equal(rec.done,false);assert.equal(rec.began,100);
  assert.equal(h.nextTaleRecord(rec,game,kara,{now:6,seconds:120}),null,'nothing changed, nothing written');
  assert.equal(h.shelfStatus(clean[0],rec).text,'Chapter 1 of 2, with '+kara.name);assert.equal(h.shelfStatus(clean[0],null).text,'New');
  const ending=fixture.story.staging.endings.at(-1).id,done={...game,story:{...game.story,status:'complete',chapter:1},pace:{...game.pace,ending}};
  const fin=h.nextTaleRecord(rec,done,kara,{now:7,seconds:100+47*60});assert.equal(fin.done,true);assert.equal(fin.finished,true);same(fin.endings,[ending]);assert.equal(fin.took,47);
  assert.equal(h.shelfStatus(clean[0],fin).text,'Finished · 1 of 3 endings');
  const card=h.shelfFinishCard(clean[0],fin,done);assert.equal(card.line,'You finished a Short tale in 47 minutes.');assert.match(card.ending,/^Ending found: .+ \(1 of 3\)\.$/);assert.equal(card.next,'Try a Medium tale next?');
  // Another copy later: a new run, the endings found kept.
  const again=h.nextTaleRecord(fin,{...game,story:{...game.story,id:'copy-2'}},kara,{now:8,seconds:5000});assert.equal(again.done,false);same(again.endings,[ending]);assert.equal(again.began,5000);
  const records=h.cleanTaleRecords({[fixture.id]:fin,'nope':fin});same(Object.keys(records),[fixture.id]);
  same(h.shelfTab(clean,'short',records).map(c=>c.slug),['kettle-camp']);
  assert.equal(h.shelfDefault([...clean,{...clean[0],id:'7e5d0a62-8f91-42b3-8edf-4a5b6c7d8e9f',slug:'short-two',order:9}],records,'short'),'7e5d0a62-8f91-42b3-8edf-4a5b6c7d8e9f','a finished tale gives way to one not finished');
  // Lived: by its title among the hero's tales once this device finished it, or the copy under way. A tale only tried
  // and left part-way (the review of 2026-10-22: two minutes of it locked the tale for good) can be begun again, and
  // its card says where it was left; the default choice passes over a tale the hero cannot begin.
  assert.equal(h.shelfLived(clean[0],{titles:[fixture.story.title.toUpperCase()],records}),'lived');assert.equal(h.shelfLived(clean[0],{current:game.story}),'playing');assert.equal(h.shelfLived(clean[1],{titles:[fixture.story.title]}),null);
  assert.equal(h.shelfLived(clean[0],{titles:[fixture.story.title],records:{[fixture.id]:rec}}),null,'a tale left part-way is not lived');
  assert.equal(h.shelfStatus(clean[0],rec,{id:'another-tale'}).text,'Left at chapter 1 of 2','a copy left part-way');assert.equal(h.shelfStatus(clean[0],rec,game.story).kind,'playing');
  {const other={...clean[0],id:'7e5d0a62-8f91-42b3-8edf-4a5b6c7d8e9f',slug:'short-two',order:9};
   assert.equal(h.shelfDefault([clean[0],other],{[fixture.id]:fin,[other.id]:{...rec,copy:'x'}},'short',{titles:[fixture.story.title],current:null}),other.id,'never the tale the hero has lived while another can be begun');}
  assert.equal(h.shelfFinishCard(clean[0],fin,done,{tiers:['short']}).next,'Try another written tale?','no Medium tab: no Medium suggested');assert.equal(h.shelfFinishCard(clean[0],fin,done,{tiers:['short','medium']}).nextTier,'medium');
  // Let fate decide: one not played, from the open tab; never one the hero lived.
  assert.equal(h.fateWritten(clean,{records,tab:'short',random:()=>0}).slug,'hidden-copy','a tale not played comes first');
  assert.equal(h.fateWritten(clean,{records:{},tab:'long',random:()=>0}).slug,'long-one','from the open tab');
  assert.equal(h.fateWritten([clean[0]],{titles:[fixture.story.title],records}),null,'never a tale the hero lived');
  // The Quest tab and Say: the tale's state as it stands, the first lines on the opening turn.
  const view=h.taleQuestView(game);assert.equal(view.tier,'Short tale');assert.ok(view.stakes.length>0);same(view.choices,[]);assert.equal(view.ending,null);
  same(h.taleSayLines(game),fixture.story.staging.firstSay.slice(0,3),'the tale\'s first lines on its opening turn');
  // startTale.js: a written tale is asked for by its id, as 'written', with no Easy start and no story so far.
  const strip=f=>readText(f).replace(/^\s*import .*;\n/gm,'').replace(/export /g,'');
  const st=vm.runInNewContext(strip('startTale.js')+'\n({taleChoice,taleRequest})',{writtenIdOf:h.writtenIdOf,fateWritten:h.fateWritten,taleStart:({selected})=>({introId:selected,easyStart:true}),fateJourney:l=>l[0],regionSummary:()=>null,storySoFarForWriter:()=>'lived',heroSpecies:x=>x.species,Math,Date});
  const chosen=st.taleChoice({selectedIntro:'written:'+fixture.id,continuing:false,idea:'',easyStart:true,journeysOnOffer:[],written:{cards:clean}});
  assert.equal(chosen.journeyId,fixture.id);assert.equal(chosen.introId,'written');assert.equal(chosen.written.slug,'kettle-camp');
  const asked=st.taleRequest({hero:kara,game:h.newAdventure(kara),characterChosen:true,continuing:false,bearing:'N',...chosen});
  assert.equal(asked.context.journey,fixture.id);assert.equal(asked.context.introId,'written');assert.equal(asked.context.easyStart,undefined);
  const fated=st.taleChoice({selectedIntro:'surprise',continuing:false,idea:'',easyStart:true,journeysOnOffer:[{id:'0f8fad5b-d9cb-469f-a165-70867728950e'}],written:{cards:clean,records,tab:'long'}});
  assert.equal(fated.written.slug,'long-one','Let fate decide takes a written tale of the open tab before a journey');
  assert.equal(st.taleChoice({selectedIntro:'surprise',continuing:false,idea:'',easyStart:true,journeysOnOffer:[{id:'0f8fad5b-d9cb-469f-a165-70867728950e'}],written:{cards:[]}}).journeyId,'0f8fad5b-d9cb-469f-a165-70867728950e','with no written tales, as before');
  assert.equal(st.taleChoice({selectedIntro:'written:'+fixture.id,continuing:true,idea:'',easyStart:true,journeysOnOffer:[],written:{cards:clean}}).written,null,'never for the next tale in a region');}

 // ---- 5. Play counts: a written tale's session is a version 2 record; version 1 records are still taken ----
 {const metrics=require('./play-metrics.cjs');
  const base={v:1,device:'a'.repeat(32),session:'b'.repeat(16),seq:1,first:false,build:'dev',form:'phone',active:60,span:60,turns:3,failed:{},ended:'explore',tale:'easy',easy:true,wait:{started:0,done:0,failed:0,waited:0,pending:0}};
  assert.ok(metrics.metricsRecord(base).record,'a version 1 record');
  const v2=metrics.metricsRecord({...base,v:2,tale:'w-kettle-camp',chapter:2,finished:true,ending:3,beats:12,quietMax:6});
  assert.ok(v2.record,v2.error);assert.equal(v2.record.tale,'w-kettle-camp');assert.equal(v2.record.ending,3);assert.equal(v2.record.quietMax,6);
  assert.equal(metrics.metricsRecord({...base,tale:'w-kettle-camp'}).record.tale,'w-kettle-camp','a written tale is counted by its slug');
  assert.equal(metrics.metricsRecord({...base,tale:'w-Kettle Camp'}).error,'Bad tale.');
  assert.ok(metrics.metricsRecord({...base,chapter:2}).error,'the tale\'s counts only in a version 2 record');
  for(const bad of [{chapter:7},{ending:5},{beats:201},{quietMax:-1},{finished:'yes'},{chapter:'2'}])assert.ok(metrics.metricsRecord({...base,v:2,chapter:1,finished:false,ending:0,beats:0,quietMax:0,...bad}).error,JSON.stringify(bad));
  const legal=read('legalText.js');assert.ok(legal.includes('which tale, the chapter you reached, whether you finished it and which of its endings you found, how many story moments were told and the longest quiet stretch'),'the privacy policy names the new counts');
  const pm=read('playMetrics.js');assert.ok(pm.includes("s.tale='w-'+w.slug")&&pm.includes('v:told?2:1'),'the device counts a written tale and sends version 2');}

 // ---- 6. The bundle canary: no client file imports a tale, and the game a browser downloads holds no tale's secret ----
 {const client=fs.readdirSync('.').filter(f=>/\.js$/.test(f));
  for(const f of client){const src=read(f);assert.ok(!/(?:\bfrom\s*|\brequire\(\s*|\bfetch\(\s*)['"`][^'"`]*(?:questbound-written|written-fixture|written-shelf|tales\/drafts)/.test(src),f+' never imports or fetches a tale');}
  const dist=path.join(__dirname,'dist-phone');
  const roots=[process.env.QUESTBOUND_DATA,__dirname].filter(Boolean);try{const common=execFileSync('git',['-C',__dirname,'rev-parse','--git-common-dir'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim();if(common)roots.push(path.dirname(path.resolve(__dirname,common)));}catch{}
  const secrets=[fixture.story.secret];
  for(const root of [...new Set(roots)]){const dir=path.join(root,'.questbound-written');let names=[];try{names=fs.readdirSync(dir).filter(n=>n.endsWith('.json')&&n!=='plays.json');}catch{}for(const n of names){try{const t=JSON.parse(read(path.join(dir,n)));if(typeof t?.story?.secret==='string')secrets.push(t.story.secret);}catch{}}}
  let scanned=0;
  if(fs.existsSync(dist)){const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(js|html|json|css|map)$/.test(e.name)){scanned++;const text=read(p);for(const s of secrets)assert.ok(!text.includes(s.slice(0,40)),p+' holds a tale\'s secret');}}};walk(dist);}
  console.log('  bundle canary: '+secrets.length+' secret(s) looked for in '+scanned+' built file(s)'+(fs.existsSync(dist)?'':' (no dist-phone here)')+'.');}

 // ---- 7. The screens: the shelf first, Easy start hidden for a written tale, nothing sideways ----
 {const screen=read('AdventureIntros.js'),app=read('App.js');
  assert.ok(screen.includes('function TaleShelf')&&screen.includes('function TaleCard')&&screen.includes("{shelfOn&&<TaleShelf ")&&screen.includes('More journeys from the story writer')&&screen.includes('Or write a new one'),'written tales first; the journeys folded under them');
  assert.ok(!screen.includes('<EasyStart'),'no Easy start switch: a written tale never had one, and every other tale now begins with orders in hand');
  assert.ok(screen.includes("screenWidth<360?'':' '+cards.filter(c=>c.length===t).length")&&!/horizontal|overflowX/.test(screen),'counts hidden under 360 px; nothing scrolls sideways');
  assert.ok(app.includes("['Home','Adventure Opening'].includes(screen)")&&app.includes('refreshShelf('),'the shelf is fetched on the title screen too');
  assert.ok(app.includes('noteTaleRecord(game,hero,{seconds:deviceSeconds()})')&&app.includes('<TaleFinished '),'progress per tale, and the completion card');
  // The 2026-10-23 campaign: the card for every tale (a written one's, and one of the story writer's: taleEndCard), with
  // the next tale here begun at once, the shelf and somewhere new; at a table only its host chooses; and "A tale waits in
  // <Land>" on a first arrival in a land beyond (sequelRules.js landTaleOffer, verify-tales-ahead.cjs).
  assert.ok(app.includes("if(!story.written){if(finished&&story.introId!=='hostile')setTaleDone({...taleEndCard(game,")&&app.includes("{key:'here',label:'Next tale here'")&&app.includes("{key:'shelf',label:'Written tales'")&&app.includes("{key:'new',label:'Somewhere new'")&&app.includes("{key:'choose',label:'Choose the next tale'"),'what next for every tale');
  assert.ok(app.includes('<TaleFinished kind="waits" card={landTaleCard(landOffer,game)}')&&app.includes("table.joined?null:landTaleOffer(game,{dismissed:landNots})")&&app.includes('playCharacter(true,{here:true})'),'a tale waits in a land reached, solo');
  {const card=read('TaleFinished.js');assert.ok(card.includes("flexWrap:'wrap'")&&card.includes("flexBasis:'auto'")&&card.includes("maxWidth:460")&&!/horizontal|overflowX/.test(card),'its buttons wrap to a new row on a narrow phone, never cut short or sideways');}
  {const h=helpers,end=h.taleEndCard({story:{title:'The Reed Crown',status:'complete'}});assert.equal(end.line,'You finished The Reed Crown.');assert.match(end.next,/Every land and everyone you know comes with you/);
   assert.equal(h.taleEndCard({story:{title:'X'}},{table:'member'}).next,'The table’s host chooses the next tale.');
   const waits=h.landTaleCard({name:'The Ashfold'},{story:{title:'The Reed Crown',status:'active'}});assert.equal(waits.title,'A tale waits in The Ashfold');assert.match(waits.next,/^The Reed Crown is left unfinished\. /);}}
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Written tales: the shelf serves only listed tales its checks and the rules accept (refusals noted without the tale\'s words, each once), lists cards without secrets in its own order, starts a tagged copy of its own each time (counted, never retired), reads changes within half a minute; the Dungeon Master lists {journeys, written}, starts a written tale before any journey and spends no new-tale allowance on it (the ceilings still hold), gives older games a Short tale; a table begins one by its id; the device keeps its cards, records and endings, chooses Start here, lets fate pick an unplayed tale of the open tab and words the completion card; written tales are counted in version 2 records named in the privacy policy; and no tale reaches the game\'s bundle.');
})().catch(e=>{console.error(e);fs.rmSync(tmp,{recursive:true,force:true});process.exit(1);});
