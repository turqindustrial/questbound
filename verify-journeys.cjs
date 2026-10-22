const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// Ready journeys (2026-10-13, the host's words: "refill the pre written tales list and make each of them a much more
// inviting journey, I want the players to have to think hard between which inviting journey reaches out to them the
// most, while not having to wait forever on new journeys and simultaneously using up less API costs overall"):
// a shared library of finished tales (tale-library.cjs), each written once with a pitch and played by many (each player
// their own copy), never offered twice to one device, retired after plays or days and replaced at a pace; the Dungeon
// Master lists them and starts one at once (dm-server.cjs); the New Adventure screen shows them as cards to compare
// (AdventureIntros.js, journeyLibrary.js, App.js); a journey's own places and people are painted once for all its
// players (worldArtRules.js). Stand-in writers only: nothing here calls the provider.
const lib=require('./tale-library.cjs'),{createLibrary,librarySettings,journeyTerrains,journeyMoods,journeySeeds,tidyPitch,validPitch,coverSubject}=lib;
const {generate,topUpLibrary,journeyCheck,startLibrary,libraryPaused}=require('./dm-server.cjs');
const {generateAdventure}=require('./adventure-generator.cjs');
const {journeyStory,journeyPitch}=require('./journey-fixtures.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-journeys-'));
const day=86400000,same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
(async()=>{
 // ---- The numbers ----
 same(librarySettings,{size:10,floor:6,perDay:4,retirePlays:20,retireDays:14,graceDays:2,failurePause:600000},'ten on offer, refilled freely below six and four a day above, retired after twenty plays or fourteen days');
 assert.ok(lib.revision>=1&&lib.generation>=5);assert.equal(journeyTerrains.length,9);assert.equal(journeyMoods.length,10);assert.ok(journeySeeds.length>=24&&new Set(journeySeeds).size===journeySeeds.length,'two dozen different seed premises');
 assert.ok(journeyMoods.every(m=>m.id&&m.label&&m.steer.length>30),'every mood tells the writer what it means');

 // ---- The library on disk: old stock cleared, one journey at a time, the first fill unpaced ----
 const dir=path.join(tmp,'shelf');fs.mkdirSync(dir,{recursive:true});
 const oldStock=path.join(dir,'crown-g4-0f8fad5b-d9cb-469f-a165-70867728950e.json'),oldJourney=path.join(dir,'journey-g4-0f8fad5b-d9cb-469f-a165-70867728950f.json'),other=path.join(dir,'notes.txt');
 for(const f of [oldStock,oldJourney])fs.writeFileSync(f,'{}');fs.writeFileSync(other,'kept');
 let clock=Date.UTC(2026,9,13,12),seq=0;const random=()=>((seq=(seq*9301+49297)%233280)/233280);
 const shelf=createLibrary({dir,now:()=>clock,random});
 assert.ok(!fs.existsSync(oldStock)&&!fs.existsSync(oldJourney)&&fs.existsSync(other),'the old stock and earlier generations are cleared, nothing else touched');
 same(shelf.list(),[],'nothing on offer yet');assert.equal(shelf.due(),true);assert.equal(shelf.start('0f8fad5b-d9cb-469f-a165-70867728950e'),null);
 const briefs=[];let n=0;const write=async b=>{briefs.push(b);const i=n++;return {story:journeyStory(i),pitch:journeyPitch(i)};};
 assert.equal(shelf.topUp(write,{accept:journeyCheck}),true);assert.equal(shelf.topUp(write,{accept:journeyCheck}),false,'one journey at a time');
 await shelf.settled();
 assert.equal(shelf.list().length,10,'the first fill goes on, one at a time, until the library is full');assert.equal(n,10);
 assert.ok(fs.readdirSync(dir).filter(f=>/^journey-g5-[0-9a-f-]{36}\.json$/.test(f)).length===10,'kept on disk as journey-g5-<uuid>.json');
 assert.equal(shelf.topUp(write),false,'full: nothing more is written');
 // ---- Variety: each new journey gets the terrain and mood the library has least of, and a seed none on offer used ----
 assert.equal(new Set(briefs.slice(0,9).map(b=>b.terrain)).size,9,'nine journeys, nine different terrains');
 assert.equal(new Set(briefs.map(b=>b.mood.id)).size,10,'ten journeys, ten different moods');
 assert.equal(new Set(briefs.map(b=>b.seedIndex)).size,10,'ten different seed premises');
 assert.equal(briefs[0].others.length,0);assert.equal(briefs[9].others.length,9,'the writer is shown every journey on offer to differ from');
 const told=JSON.stringify(briefs[9].others);assert.ok(told.includes('The Reed Crown')&&told.includes('Stillwater Market')&&!told.includes('opened it for silver'),'the others\' titles, hooks and starts, never their secrets');
 // ---- What a device sees: pitches only ----
 const shown=shelf.list();
 for(const j of shown){assert.deepEqual(Object.keys(j).sort(),['blurb','chapters','cover','hook','id','mood','region','special','terrain','title']);assert.ok(validPitch(j)&&j.chapters===3&&j.cover===null,'a pitch, the chapters and no cover unless it costs nothing');}
 assert.ok(!JSON.stringify(shown).includes('opened it for silver')&&!JSON.stringify(shown).includes('Put the trouble'),'no secret and no resolution leaves the library');
 {const withCover=shelf.list({cover:s=>s.campaignId==='journey-'+shown[0].id});assert.deepEqual(withCover[0].cover,{campaignId:'journey-'+shown[0].id,kind:'landscape',id:'inn',name:withCover[0].cover.name,description:'A crowded place where the road meets the river, smoky and loud.',setting:withCover[0].cover.setting,...(withCover[0].cover.terrain?{terrain:withCover[0].cover.terrain}:{}),...(withCover[0].cover.placeKind?{placeKind:withCover[0].cover.placeKind}:{})},'the cover is the painting of where the journey begins');assert.ok(!withCover[0].cover.terrain||['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'].includes(withCover[0].cover.terrain),'the cover names the land of the journey, so the place library matches it');assert.ok(withCover[0].cover.setting.includes(withCover[0].cover.name));assert.equal(withCover[1].cover,null);}
 // ---- Starting: a copy of one's own, instantly, the journey stays on offer ----
 const first=shown[0].id,a=shelf.start(first),b=shelf.start(first);
 assert.ok(a&&b&&a.id!==b.id&&a.libraryId===first&&a.artId==='journey-'+first&&a.status==='active','each player gets a copy of their own, which knows its journey and its art id');
 assert.equal(a.title,shown[0].title);assert.equal(shelf.list().length,10,'a journey is not used up by being played');
 assert.equal(shelf.start('../etc'),null,'only journey ids');assert.equal(shelf.start('0f8fad5b-d9cb-469f-a165-70867728950e'),null);
 assert.ok(journeyCheck(a),'a copy is a tale the game\'s rules accept');
 // ---- Retirement: after twenty plays (with a grace period for a card still on screen), or fourteen days ----
 for(let i=0;i<18;i++)shelf.start(first);
 assert.ok(!shelf.list().some(j=>j.id===first),'played twenty times: retired');assert.ok(shelf.start(first),'still startable for a while by a player who had the card on screen');
 clock+=2*day+1;assert.equal(shelf.start(first),null,'gone after the grace period');assert.ok(!fs.existsSync(path.join(dir,'journey-g5-'+first+'.json')));
 // ---- Paced refill: freely below the floor, then at most four a day ----
 assert.equal(shelf.list().length,9);
 n=20;const paced=async b=>{briefs.push(b);const i=n++;return {story:journeyStory(i,{title:'Paced Tale '+i}),pitch:journeyPitch(i)};};
 clock+=12*day;// eleven journeys reach fourteen days on offer and retire together
 assert.equal(shelf.list().length,0,'fourteen days on offer: retired');
 shelf.topUp(paced,{accept:journeyCheck});await shelf.settled();
 assert.equal(shelf.list().length,librarySettings.floor,'below the floor the library refills freely; above it the day\'s pace (the floor writes count) stops it');
 {const on=shelf.list().length;clock+=day+1;shelf.topUp(paced,{accept:journeyCheck});await shelf.settled();assert.equal(shelf.list().length,Math.min(10,on+4),'a day later, four more');}
 // A restart keeps the library and its pace (both on disk).
 {const again=createLibrary({dir,now:()=>clock,random});assert.equal(again.list().length,shelf.list().length);assert.equal(again.due(),shelf.due());}
 // ---- Failures: a tale the rules refuse, one too like another, or a provider error pauses ten minutes ----
 {const d2=path.join(tmp,'fail'),f2=createLibrary({dir:d2,now:()=>clock,random});
  const heard=[];f2.topUp(async()=>({story:{title:'Broken'},pitch:journeyPitch(0)}),{accept:journeyCheck,onFailure:e=>heard.push(e.kind)});await f2.settled();assert.equal(f2.list().length,0,'a broken tale is never offered');same(heard,['rejected'],'the failure is told with its kind');
  assert.equal(f2.topUp(write,{accept:journeyCheck}),false,'paused after a failure');assert.equal(createLibrary({dir:d2,now:()=>clock}).topUp(write),false,'the pause survives a restart');
  clock+=11*60*1000;n=0;let once=0;const one=async b=>{once++;return {story:journeyStory(0),pitch:journeyPitch(0)};};
  f2.topUp(one,{accept:journeyCheck,onFailure:e=>heard.push(e.kind)});await f2.settled();assert.equal(f2.list().length,1,'the same tale twice is refused: too like a journey on offer');assert.equal(once,2);same(heard,['rejected','too-alike']);}
 // ---- Pitches: kept to their limits, or built from the tale ----
 {const long=tidyPitch({hook:'A '.repeat(200),blurb:'B',mood:'',special:'S'.repeat(400)},journeyStory(0),journeyMoods[0]);assert.ok(validPitch(long)&&long.hook.length<=140&&long.special.length<=160);assert.equal(long.mood,'Mystery','a missing mood is the library\'s');assert.match(long.blurb,/Something has gone wrong/,'a blurb too short is the premise');
  const none=tidyPitch(null,journeyStory(1));assert.ok(validPitch(none),'a journey without a pitch still gets a card');assert.ok(!validPitch({hook:'x'}));}
 assert.equal(coverSubject({id:'x',story:{}}),null);

 // ---- The Dungeon Master: lists the journeys, starts one at once, writes new ones in the background ----
 const calls=[];const fetchFor=(story,pitch)=>async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify({...story,pitch})}]}]})};};
 let written=3;const varied=async(url,options)=>fetchFor(journeyStory(written),journeyPitch(written++))(url,options);
 const keys={apiKey:'k',model:'gpt-6-luna',storyReasoning:'high',fetchImpl:varied};
 const dShelf=createLibrary({dir:path.join(tmp,'dm'),now:()=>clock,random,size:3,floor:3});
 const ask=(context,extra={})=>generate({input:'Create a fresh adventure.',...extra,context:{choices:[],...context}},{...keys,library:dShelf});
 // A browser's brief is dropped: only the library writes journeys.
 await ask({mode:'adventure',introId:'crown',ahead:true,libraryBrief:{seed:'x',others:[]},job:'verify-job-journey-0001'}).catch(()=>{});
 {const sent=calls.at(-1);assert.ok(sent&&!sent.input.includes('libraryBrief')&&!sent.text.format.schema.required.includes('pitch')&&!sent.instructions.includes('READY JOURNEY'),'a brief sent by a browser is ignored');}
 same((await ask({mode:'art',journeys:'list'})).journeys,[],'nothing on offer yet');await dShelf.settled();assert.equal(dShelf.list().length,3,'asking tops the library up (so does any live turn)');
 const before=calls.length,listed=await ask({mode:'art',journeys:'list'});
 assert.equal(listed.journeys.length,3);assert.equal(calls.length,before,'listing calls nothing');assert.ok(!JSON.stringify(listed).includes('opened it for silver'));
 const begun=await ask({mode:'adventure',introId:'easy',journey:listed.journeys[1].id,easyStart:true,job:'verify-job-journey-0002'});
 assert.ok(begun.story&&begun.journey===true&&begun.story.libraryId===listed.journeys[1].id&&begun.story.artId==='journey-'+listed.journeys[1].id,'a chosen journey starts at once, as the player\'s own copy');assert.equal(calls.length,before,'with no wait and no call');
 await assert.rejects(ask({mode:'adventure',introId:'easy',journey:'0f8fad5b-d9cb-469f-a165-70867728950e'}),e=>e.httpStatus===409&&/left the library/.test(e.message),'a journey no longer on offer is refused so the screen can ask again');
 // A game from before the library, asking for Easy to get into or Let fate decide, gets a journey; other openings, the
 // next tale and the player's own idea are written fresh.
 for(const introId of ['easy','surprise']){const got=await ask({mode:'adventure',introId});assert.ok(got.journey&&got.story.libraryId,introId+' from an older game: a journey');}
 {const was=calls.length;await ask({mode:'adventure',introId:'crown',easyStart:false});await ask({mode:'adventure',introId:'surprise',continuing:{previousTitle:'Old'}});await ask({mode:'adventure',introId:'idea',idea:'A haunted lighthouse on a frozen coast'});assert.equal(calls.length,was+3,'written openings, the next tale and ideas are written fresh');}
 // The background writer: the library's brief, the READY JOURNEY instructions, a pitch beside the story.
 {const d=createLibrary({dir:path.join(tmp,'writer'),now:()=>clock,random,size:2,floor:2}),was=calls.length;
  assert.equal(topUpLibrary(d,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:keys.fetchImpl,live:false}),true);await d.settled();
  const sent=calls[was],input=JSON.parse(sent.input);
  assert.ok(sent.instructions.includes('READY JOURNEY')&&sent.instructions.includes('A PREMISE WORTH CHOOSING')&&sent.instructions.includes('DIFFERENT FROM THE OTHERS')&&sent.instructions.includes('THE PITCH')&&sent.instructions.includes('WRITTEN AHEAD')&&sent.instructions.includes('EASY TO GET INTO'),'written ahead, as an easy start, as a journey worth choosing');
  for(const field of ['pitch','errand','introduction','residents','openingDialogue'])assert.ok(sent.text.format.schema.required.includes(field),'a journey must have '+field);
  same(Object.keys(sent.text.format.schema.properties.pitch.properties),['hook','blurb','mood','special']);assert.equal(sent.text.format.schema.properties.pitch.properties.hook.maxLength,140);
  assert.ok(input.context.libraryBrief.terrain&&input.context.libraryBrief.mood.label&&input.context.libraryBrief.seed&&Array.isArray(input.context.libraryBrief.others),'the brief reaches the writer');assert.ok(input.creativeDirection.startsWith(input.context.libraryBrief.seed),'the seed is the starting thought');
  assert.equal(sent.safety_identifier,undefined,'the host\'s own background writing');
  assert.equal(d.list().length,2);assert.ok(d.list().every(j=>j.hook.length>20),'the writer\'s pitch is on the card');}
 // The spending ceilings stop background writing (spending.cjs background(), when the module has it).
 {const d=createLibrary({dir:path.join(tmp,'ceiling'),now:()=>clock,random,size:2,floor:2});
  assert.equal(topUpLibrary(d,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:keys.fetchImpl,live:false,spend:{background:()=>({ok:false,reason:'total'})}}),false,'past a ceiling nothing is written');assert.equal(d.list().length,0);
  assert.equal(topUpLibrary(d,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:keys.fetchImpl,live:false,spend:{check:()=>({ok:true})}}),true,'a spending module without the background check does not stop it');await d.settled();
  assert.equal(topUpLibrary(d,{apiKey:'',storyModel:'m',fetchImpl:keys.fetchImpl,live:false}),false,'no key, no writing');}
 // The host's pause (2026-10-22, the stories spec Phase 0): while .questbound-library-paused exists (read live, under
 // QUESTBOUND_DATA when set) nothing is written, by a top-up, the start-up fill or a listing; journeys already written
 // are still listed and started; a fill under way stops at its next journey; removing the file resumes it at once.
 {const data=path.join(tmp,'paused-data'),was=process.env.QUESTBOUND_DATA;fs.mkdirSync(data,{recursive:true});process.env.QUESTBOUND_DATA=data;
  try{
   const flag=path.join(data,'.questbound-library-paused');fs.writeFileSync(flag,'Paused by the host');assert.equal(libraryPaused(),true);
   const d=createLibrary({dir:path.join(tmp,'paused'),now:()=>clock,random,size:2,floor:2}),was2=calls.length;
   assert.equal(topUpLibrary(d,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:keys.fetchImpl,live:false}),false,'paused: nothing is written');
   assert.equal(startLibrary({apiKey:'k',model:'m',library:d,fetchImpl:keys.fetchImpl}),false,'nor at start-up');
   same((await generate({input:'Create a fresh adventure.',context:{mode:'art',journeys:'list',choices:[]}},{...keys,library:d})).journeys,[],'an empty library stays empty while paused');await d.settled();
   assert.equal(calls.length,was2,'no request was made while paused');assert.equal(d.list().length,0);
   const listing=await generate({input:'Create a fresh adventure.',context:{mode:'art',journeys:'list',choices:[]}},{...keys,library:dShelf});
   assert.ok(listing.journeys.length>0,'journeys already written are still listed');
   const copy=await generate({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'easy',journey:listing.journeys[0].id,easyStart:true,choices:[]}},{...keys,library:dShelf});await dShelf.settled();
   assert.ok(copy.journey&&copy.story.libraryId===listing.journeys[0].id,'and started');assert.equal(calls.length,was2,'with no request');
   // A fill under way stops at its next journey: the write itself looks again, and a pause is not noted as a failure.
   fs.rmSync(flag);const e=createLibrary({dir:path.join(tmp,'paused-fill'),now:()=>clock,random,size:3,floor:3});let wrote=0;
   const pausing=async(url,options)=>{wrote++;if(wrote===1)fs.writeFileSync(flag,'Paused');return keys.fetchImpl(url,options);};
   assert.equal(topUpLibrary(e,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:pausing,live:true,spend:{background:()=>({ok:true})}}),true);await e.settled();
   assert.equal(wrote,1,'the fill stopped at its next journey');assert.equal(e.list().length,1);
   const diag=path.join(data,'.questbound-diagnostics.jsonl');assert.ok(!fs.existsSync(diag)||!fs.readFileSync(diag,'utf8').includes('"write"'),'a pause is not a failure');
   fs.rmSync(flag);assert.equal(libraryPaused(),false);clock+=11*60*1000;
   assert.equal(topUpLibrary(e,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:keys.fetchImpl,live:false}),true,'resumed: writing again');await e.settled();assert.equal(e.list().length,3);
  }finally{if(was===undefined)delete process.env.QUESTBOUND_DATA;else process.env.QUESTBOUND_DATA=was;}
  const ps=fs.readFileSync('launch.ps1','utf8');assert.ok(/\[switch\]\$PauseLibrary,\[switch\]\$ResumeLibrary/.test(ps)&&ps.includes("Join-Path $root '.questbound-library-paused'")&&/if \(\$PauseLibrary\) \{ Set-Content \$libraryPauseFile/.test(ps)&&/if \(\$ResumeLibrary\) \{ Remove-Item \$libraryPauseFile/.test(ps),'Questbound.cmd -PauseLibrary / -ResumeLibrary');
  assert.ok(![...ps].some(ch=>ch.charCodeAt(0)>127),'launch.ps1 stays pure ASCII');}
 // A failed write is noted in the diagnostics with its kind only (live runs), so the next failure can be told apart
 // (the first live journey was cut off by Node's own fetch after 308 s on 2026-10-13 and left no trace).
 {const data=path.join(tmp,'data'),was=process.env.QUESTBOUND_DATA;fs.mkdirSync(data,{recursive:true});process.env.QUESTBOUND_DATA=data;
  try{
   const d=createLibrary({dir:path.join(tmp,'noted'),now:()=>clock,random,size:2,floor:2});
   const down=async()=>new Response(JSON.stringify({error:{code:'server_error',message:'provider words'}}),{status:500,headers:{'content-type':'application/json'}});
   assert.equal(topUpLibrary(d,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:down,live:true,spend:{background:()=>({ok:true})}}),true);await d.settled();
   const notes=fs.readFileSync(path.join(data,'.questbound-diagnostics.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
   assert.equal(notes.length,1);assert.equal(notes[0].write,'library');assert.equal(notes[0].failure,'http');assert.equal(notes[0].status,500);assert.ok(Number.isFinite(notes[0].seconds));assert.ok(!JSON.stringify(notes[0]).includes('provider words'),'never what the provider said');
   const quiet=createLibrary({dir:path.join(tmp,'quiet'),now:()=>clock,random,size:2,floor:2});topUpLibrary(quiet,{apiKey:'k',storyModel:'m',effort:'high',fetchImpl:down,live:false});await quiet.settled();
   assert.equal(fs.readFileSync(path.join(data,'.questbound-diagnostics.jsonl'),'utf8').trim().split('\n').length,1,'a run against a stand-in provider notes nothing');
  }finally{if(was===undefined)delete process.env.QUESTBOUND_DATA;else process.env.QUESTBOUND_DATA=was;}}
 // When the Dungeon Master starts, the library tops itself up.
 {const d=createLibrary({dir:path.join(tmp,'start'),now:()=>clock,random,size:1,floor:1});assert.equal(startLibrary({apiKey:'k',model:'m',library:d,fetchImpl:keys.fetchImpl}),true);await d.settled();assert.equal(d.list().length,1);
  const dm=fs.readFileSync('dm-server.cjs','utf8');assert.ok(dm.includes("if(fetchImpl===fetch&&apiKey&&model&&process.env.QUESTBOUND_LIBRARY!=='off')setTimeout(()=>{try{require(__filename).startLibrary("),'createServer starts it (live only)');}
 // The story writer: a pitch only for the library, beside the story and not in it.
 {const got=await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',ahead:true,libraryBrief:{seed:'a salt town',terrain:'coast',mood:journeyMoods[0],others:[]},choices:[]}},{apiKey:'k',model:'m',fetchImpl:keys.fetchImpl});
  assert.ok(got.pitch&&got.pitch.hook&&got.story.pitch===undefined,'the pitch travels beside the story');
  const plain=await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',libraryBrief:{seed:'a salt town'},choices:[]}},{apiKey:'k',model:'m',fetchImpl:keys.fetchImpl});
  assert.ok(plain.pitch===undefined&&!calls.at(-1).instructions.includes('READY JOURNEY'),'only a tale written ahead can be a journey');}

 // ---- Art: a journey's own places and people are painted once for every player of it ----
 {  const source=rulesSource({extra:['worldArtRules.js']});
  const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,validStory,validAdventure,adventureSnapshot,npcArtSubject,locationArtSubject,placeArtSubject,creatureArtSubject})',{AsyncStorage:{},weaponIcon:()=>'sword'});
  const {artKey}=require('./world-art.cjs'),hero=r.readyHero('fighter'),pip=r.readyHero('rogue');
  const d=createLibrary({dir:path.join(tmp,'art'),now:()=>clock,random,size:1,floor:1});d.topUp(async()=>({story:journeyStory(5),pitch:journeyPitch(5)}),{accept:journeyCheck});await d.settled();
  const id=d.list()[0].id,one=r.freshStoryGame(hero,d.start(id),r.newAdventure(hero)),two=r.freshStoryGame(pip,d.start(id),r.newAdventure(pip));
  assert.ok(one.story.id!==two.story.id&&r.validStory(one.story)&&r.validAdventure(r.adventureSnapshot(hero,one,null,true),hero),'two players, two stories, both valid');
  const resident=g=>Object.keys(g.people).find(k=>g.people[k].name==='Tilda Marsh');
  for(const [what,subject] of [['the opening place',g=>r.locationArtSubject(g)],['keeper',g=>r.npcArtSubject(g,'keeper')],['mara',g=>r.npcArtSubject(g,'mara')],['a resident',g=>r.npcArtSubject(g,resident(g))],['the foe',g=>r.creatureArtSubject({...g,stage:'combat'})],['the place to investigate',g=>r.placeArtSubject(g,g.story.locations.tower.name)]])
   assert.equal(artKey(subject(one)),artKey(subject(two)),what+' is painted once for both players');
  assert.equal(r.npcArtSubject(one,resident(one)).id,'resident-tilda-marsh-w','a resident by name, not by seat');
  assert.equal(artKey(r.locationArtSubject(one)),artKey(d.list({cover:()=>true})[0].cover),'the card\'s cover is the opening scene\'s painting');
  assert.equal(artKey(r.placeArtSubject(one,one.story.locations.inn.name)),artKey(r.locationArtSubject(one)),'the feed\'s arrival plate is the same painting');
  // Someone met in play stays with the player's own copy.
  const met={...one,people:{...one.people,n9:{name:'Odo Fenn',role:'A tinker',appearance:'A small man with a pack of pans.',toughness:'common',home:'inn'}}},met2={...two,people:{...two.people,n9:{name:'Ysolde',role:'A nun',appearance:'A tall woman in grey.',toughness:'common',home:'inn'}}};
  assert.notEqual(artKey(r.npcArtSubject(met,'n9')),artKey(r.npcArtSubject(met2,'n9')),'people met in play are each player\'s own');assert.equal(r.npcArtSubject(met,'n9').campaignId,one.story.id);
  // A tale that is not a journey is painted as before.
  const solo=r.freshStoryGame(hero,journeyStory(6),r.newAdventure(hero));assert.equal(r.locationArtSubject(solo).campaignId,solo.story.id);assert.equal(r.npcArtSubject(solo,resident(solo)).id,resident(solo)+'-w');
  // Saves: a copy's journey fields are checked; old saves have none.
  assert.ok(!r.validStory({...one.story,artId:'journey-elsewhere'})&&!r.validStory({...one.story,libraryId:'x'}),'a copy\'s art id belongs to its journey');}

 // ---- On the device: the journeys on offer, never one already played ----
 {const src=fs.readFileSync('journeyLibrary.js','utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'');
  const c=vm.runInNewContext(src+'\n({cleanJourneys,journeysToOffer,fateJourney,playedJourneys,rememberJourney,journeyKey})',{storage:{},findDmEndpoint:async()=>'',askDm:async()=>({})});
  const raw=shown.slice(0,3).map(j=>({...j,secret:'no'}));raw.push({id:'bad',title:'x',hook:'y'},{...raw[0]},{id:'0f8fad5b-d9cb-469f-a165-70867728950e',title:'',hook:'h'});
  const clean=c.cleanJourneys(raw);assert.equal(clean.length,3,'malformed, nameless and repeated journeys are left out');assert.equal(clean[0].secret,undefined);
  assert.equal(c.cleanJourneys([{...raw[0],cover:{campaignId:'journey-someone-else',kind:'landscape',id:'inn',name:'n',description:'d',setting:'s'}}])[0].cover,undefined,'a cover must be its own journey\'s');
  const offered=c.journeysToOffer(clean,{played:[clean[0].id],titles:['Something Else',clean[1].title.toUpperCase()]});same(offered.map(j=>j.id),[clean[2].id],'not one played on this device, nor one whose title the hero has lived');
  assert.equal(c.fateJourney(clean,()=>.99).id,clean[2].id);assert.equal(c.fateJourney([],Math.random),null);
  const store={v:{},async getItem(k){return this.v[k]??null;},async setItem(k,v){this.v[k]=v;}};
  same(await c.playedJourneys(store),[]);await c.rememberJourney(clean[0].id,store);await c.rememberJourney(clean[0].id,store);await c.rememberJourney('nope',store);same(await c.playedJourneys(store),[clean[0].id],'remembered once, ids only');
  assert.equal(c.journeyKey,'questbound.journeys.v1');}
 // ---- The screen and the game ----
 {const screen=fs.readFileSync('AdventureIntros.js','utf8'),app=['App.js','startTale.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');
  assert.ok(screen.includes('function JourneyShelf')&&screen.includes('function JourneyCard')&&screen.includes("label={busy?'One moment…':'Begin this journey'}")&&screen.includes('READY NOW')&&screen.includes("i.idea||i.id==='surprise'||i.local"),'the journeys as cards between Your own tale and Let fate decide');
  assert.ok(screen.includes('<DynamicArt subject={j.cover} quiet')&&screen.includes("flexWrap:'wrap'")&&!/horizontal|overflowX/.test(screen),'covers, and cards that wrap, never sideways');
  assert.ok(screen.includes("Every ready journey begins this way")&&screen.includes('journey={ready}'),'Easy start shows on, locked, for a journey');
  assert.ok(app.includes("journey:journeyId,easyStart:true")&&app.includes('fateJourney(offered).id')&&app.includes('await rememberJourney(next.story.libraryId)')&&app.includes("freshStoryGame(hero,{...body.story,introId},base)")&&app.includes('journeysToOffer(list,{played,titles:'),'the game starts a journey, remembers it and never offers it again');}
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Ready journeys: a library of ten finished tales with pitches (hook, what you do and face, mood, chapters, what sets it apart) in nine terrains and ten moods from different seeds, each written once and played by many as their own copy, started at once, never offered twice to one device, retired after twenty plays or fourteen days and refilled freely below six and four a day above (stopped by the spending ceilings), checked by the game\'s rules before it is offered, with each journey\'s own places and people painted once for all its players.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
