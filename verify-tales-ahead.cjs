const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
// Better than a wait and a fixed list: ready journeys start at once (tale-library.cjs; verify-journeys.cjs checks the
// library itself), a player can ask for a tale of their own idea, and a narrator of their choosing tells it. Nothing
// here calls the provider.
const {revision,generation}=require('./tale-library.cjs');
const {generate}=require('./dm-server.cjs');
const {requestParts,requestScene}=require('./dm-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-tales-'));

const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',regard:{stance:'wary',reason:'I lost a brother to your kind.'},ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',regard:{stance:'warm',reason:'Travellers bring news.'},ties:{other:'friend',foe:'neutral',note:'n'}}}};
(async()=>{
 // ---- The library ----
 assert.equal(revision,5);assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes("require('./tale-library.cjs').revision!=="+revision+')'),'the Dungeon Master reloads the library when its revision changes');assert.equal(generation,5,'tales written before the library (and before introductions) are cleared');

 // ---- The Dungeon Master: a ready journey starts at once; written openings, ideas and the next tale are written fresh ----
 const calls=[];const storyFetch=async(url,options)=>{const request=JSON.parse(options.body);calls.push(request);return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 const keys={apiKey:'k',model:'gpt-6-luna',storyReasoning:'high',fetchImpl:storyFetch};
 const taken=[];const stand={start:id=>{taken.push('journey:'+id);return id==='0f8fad5b-d9cb-469f-a165-70867728950e'?{...story,title:'Stocked',id:'copy-1',status:'active',libraryId:id,artId:'journey-'+id}:null;},any:()=>{taken.push('any');return {...story,id:'copy-2',status:'active'};},list:()=>[],topUp:()=>false};
 const ask=(context,extra={})=>generate({input:'Create a fresh adventure.',...extra,context:{choices:[],...context}},{...keys,library:stand});
 const instant=await ask({mode:'adventure',introId:'easy',journey:'0f8fad5b-d9cb-469f-a165-70867728950e',easyStart:true,job:'verify-job-ahead-000001'});
 assert.equal(instant.story.title,'Stocked');assert.equal(instant.story.status,'active');assert.equal(calls.length,0,'no wait and no call');
 taken.length=0;await ask({mode:'adventure',introId:'crown',continuing:{previousTitle:'Old'}});assert.equal(taken.length,0,'the next tale in a region is written fresh');
 await ask({mode:'adventure',introId:'idea',idea:'A haunted lighthouse on a frozen coast'});assert.equal(taken.length,0,'so is the player\'s own idea');

 // ---- The story writer: the player's own idea, and tales written before the hero is known ----
 const idea=calls.at(-1);assert.match(requestParts(idea).instructions,/PLAYER'S IDEA/);assert.match(requestParts(idea).instructions,/take only its mood/);assert.ok(idea.input.includes('haunted lighthouse'));assert.match(requestScene(idea).creativeDirection,/own idea: A haunted lighthouse/);
 await assert.rejects(ask({mode:'adventure',introId:'idea',idea:'  '}),/Write your idea/);
 const odd=await ask({mode:'adventure',introId:'idea',idea:'A cursed\u0000 bell\n\n tolls   at noon'});assert.ok(requestScene(calls.at(-1)).creativeDirection.endsWith('A cursed bell tolls at noon'),'one clean line');
 assert.ok(odd.story.npcs.keeper.regard,'a tale for a known hero keeps the people\'s view of their kind');
 // Easy start with a written opening: written fresh, so it begins with orders in hand; Easy to get into and Let fate
 // decide (from a game before the library) are a ready journey, and every journey begins with orders in hand.
 taken.length=0;await ask({mode:'adventure',introId:'crown',easyStart:true});assert.equal(taken.length,0,'an easy start on a written opening is written fresh');
 const easyStocked=await ask({mode:'adventure',introId:'easy',easyStart:true});assert.equal(JSON.stringify(taken),JSON.stringify(['any']),'Easy to get into is a ready journey');assert.equal(easyStocked.story.title,'T');
 taken.length=0;await ask({mode:'adventure',introId:'crown',easyStart:false});assert.equal(taken.length,0,'a written opening is always written fresh now');
 const {generateAdventure}=require('./adventure-generator.cjs');
 const intros0=JSON.parse(fs.readFileSync('adventureIntros.json','utf8'));
 const ahead=await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(requestParts(calls.at(-1)).instructions,/WRITTEN AHEAD/);assert.equal(ahead.story.npcs.keeper.regard,undefined,'written ahead, the view of the hero\'s kind is left to the game');
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'crown',continuing:{previousTitle:'Old',newStartBearing:'north'},idea:'my sister comes looking for me',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(requestScene(calls.at(-1)).creativeDirection,/The player wishes: my sister comes looking for me/);
 const intros=JSON.parse(fs.readFileSync('adventureIntros.json','utf8')),own=intros.find(i=>i.id==='idea');assert.ok(own&&own.idea&&!own.local&&intros[0].id==='idea'&&intros[1].id==='easy'&&intros[2].id==='surprise','Your own tale first, then Easy to get into, then Let fate decide');
 const easyIntro=intros[1];assert.ok(easyIntro.errand&&easyIntro.openingDialogue&&easyIntro.scale==='saga'&&!easyIntro.local,'Easy to get into is an errand with voices');assert.ok(intros.find(i=>i.id==='surprise').openingDialogue&&own.openingDialogue,'Let fate decide and Your own tale open with voices');
 // ---- The story writer: residents for every tale, an errand for Easy to get into, and a varied opening ----
 const {errandDirections,openingScenes}=(()=>{const src=fs.readFileSync('adventure-generator.cjs','utf8');return vm.runInNewContext(src.match(/const openingScenes=\[[^\]]*\];/)[0]+src.match(/const errandDirections=\[[^\]]*\];/)[0]+'({openingScenes,errandDirections})');})();
 assert.equal(errandDirections.length,12);assert.equal(openingScenes.length,12);
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'easy',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 const easyCall=calls.at(-1),easySchema=easyCall.text.format.schema,easyInput=requestScene(easyCall);
 for(const field of ['residents','errand','openingDialogue'])assert.ok(easySchema.required.includes(field),'an errand tale must have '+field);
 assert.match(requestParts(easyCall).instructions,/EASY TO GET INTO/);assert.match(requestParts(easyCall).instructions,/RESIDENTS:/);assert.ok(!requestParts(easyCall).instructions.includes('Only the two specified NPCs'),'the writer may put more than two people at the start');
 assert.ok(errandDirections.some(d=>easyInput.creativeDirection.endsWith(d)),'an errand from the list');assert.ok(openingScenes.includes(easyInput.openingScene),'a kind of opening moment');
 assert.deepEqual(easySchema.properties.openingDialogue.items.properties.speakerId.enum.slice(0,3),['keeper','mara','resident1']);assert.equal(easySchema.properties.residents.maxItems,12);
 assert.equal(easySchema.properties.errand.properties.threat.properties.ally.type.join(),'object,null');
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 const fate=calls.at(-1);assert.ok(fate.text.format.schema.required.includes('residents')&&!fate.text.format.schema.required.includes('errand'),'every tale has residents; only Easy to get into has an errand');assert.ok(openingScenes.includes(requestScene(fate).openingScene));assert.ok(!requestParts(fate).instructions.includes('EASY TO GET INTO'));
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'crown',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});assert.equal(requestScene(calls.at(-1)).openingScene,undefined,'a written opening keeps its own arrival');
 // ---- Easy start: any opening but the Skirmish asks the writer for the errand, its voices and a direction to match ----
 const easyFor=async context=>{await generateAdventure({input:'Create',context:{mode:'adventure',choices:[],...context}},{apiKey:'k',model:'m',fetchImpl:storyFetch});const call=calls.at(-1);return {schema:call.text.format.schema,instructions:requestParts(call).instructions,input:requestScene(call)};};
 for(const [label,context] of [['a written opening',{introId:'crown'}],['an idea of their own',{introId:'idea',idea:'A heist in a city on a sleeping giant'}],['the next tale',{introId:'surprise',continuing:{previousTitle:'Old',newStartBearing:'north'}}],['Let fate decide',{introId:'surprise'}]]){
  const on=await easyFor({...context,easyStart:true});
  for(const field of ['errand','openingDialogue','residents'])assert.ok(on.schema.required.includes(field),label+' with Easy start must have '+field);
  assert.match(requestParts(on).instructions,/EASY TO GET INTO/,label+' with Easy start is told how an errand begins');assert.ok(/errand/i.test(on.input.creativeDirection)||errandDirections.some(d=>on.input.creativeDirection.endsWith(d)),label+': the direction sets an errand');
  const off=await easyFor({...context,easyStart:false});assert.ok(!off.schema.required.includes('errand')&&!requestParts(off).instructions.includes('EASY TO GET INTO'),label+' without Easy start has no errand');
 }
 {const on=await easyFor({introId:'crown',easyStart:true});assert.ok(on.input.creativeDirection.startsWith(intros0.find(i=>i.id==='crown').setting),'a written opening keeps its own setting');assert.equal(on.input.openingScene,undefined,'and its own arrival');}
 await assert.rejects(easyFor({introId:'hostile',easyStart:true}),/without the AI/,'the Skirmish is never written, easy or not');
 {const truthy=await easyFor({introId:'crown',easyStart:'yes'});assert.ok(!truthy.schema.required.includes('errand'),'only easyStart:true counts');}
 // Written ahead, residents' views of the hero's kind are dropped too; their lines are kept by residentN.
 const peopled={...story,residents:[{name:'Old Tam',regard:{stance:'scornful',reason:'x'}}],openingDialogue:[{speakerId:'resident1',text:'Orders are orders.'},{speakerId:'resident13',text:'No.'},{speakerId:'keeper',text:'Go now.'}]};
 const peopledFetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(peopled)}]}]})};};
 const aheadEasy=await generateAdventure({input:'Create',context:{mode:'adventure',introId:'easy',ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:peopledFetch});
 assert.equal(aheadEasy.story.residents[0].regard,undefined,'written ahead, what the residents think of the hero\'s kind is left to the game');assert.deepEqual(aheadEasy.story.openingDialogue.map(l=>l.speakerId),['resident1','keeper'],'only known voices');

 // ---- The New Adventure screen and the game ----
 const screen=fs.readFileSync('AdventureIntros.js','utf8'),app=['App.js','startTale.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');
 assert.ok(screen.includes('function IdeaBox')&&screen.includes('ideaReady(idea)')&&screen.includes('<NarratorChoice compact/>'),'the idea box, its gate and the narrator choice');
 assert.ok(app.includes("...(wish?{idea:wish}:{})")&&app.includes("selectedIntro==='idea'&&!wish"),'the idea reaches the story writer');
 // Easy start: a per-device switch on the New Adventure and next-tale screens, on unless turned off, hidden for the Skirmish.
 assert.ok(screen.includes('function EasyStart')&&screen.includes("label=\"Easy start\"")&&(screen.match(/<EasyStart /g)??[]).length===2&&screen.includes("selected!=='hostile'"),'the Easy start switch on both screens, not for the Skirmish');
 assert.ok(app.includes("taleStart({selected:selectedIntro,continuing,easyStart})")&&app.includes("taleChoice({selectedIntro,continuing,idea,easyStart:storyPreferences().easyStart,journeysOnOffer,written:shelfFor()})")&&app.includes("introId=journeyId?'easy':start.introId")&&app.includes("...(written?{journey:journeyId}:journeyId?{journey:journeyId,easyStart:true}:start.easyStart?{easyStart:true}:{})")&&app.includes("freshStoryGame(hero,{...body.story,introId},base)"),'the game sends the easy start and keeps the opening it asked for');
 // startTale.js builds the story writer's request from the choice (App.playCharacter only sends it): run here with the
 // rules, storyPreferences.js's taleStart and journeyLibrary.js's fateJourney beside it.
 {const {rulesSource}=require('./rules-files.cjs'),strip=f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'');
  const r=vm.runInNewContext(rulesSource()+'\n({readyHero,newAdventure,regionSummary,sequelBearings,nextTalePlacement,storySoFarForWriter,heroSpecies})',{AsyncStorage:{}});
  const prefs=vm.runInNewContext(strip('storyPreferences.js')+'\n({taleStart})',{}),fate=vm.runInNewContext(fs.readFileSync('journeyLibrary.js','utf8').match(/export const fateJourney=.*$/m)[0].replace('export ','')+'\nfateJourney',{});
  const shelfHelpers=vm.runInNewContext(strip('shelfRules.js')+'\n({writtenIdOf,fateWritten})',{});
  const st=vm.runInNewContext(strip('startTale.js')+'\n({sequelPlacement,taleChoice,taleRequest,taleRepeats,taleHistory})',{...shelfHelpers,taleStart:prefs.taleStart,fateJourney:fate,regionSummary:r.regionSummary,sequelBearings:r.sequelBearings,nextTalePlacement:r.nextTalePlacement,storySoFarForWriter:r.storySoFarForWriter,heroSpecies:r.heroSpecies,Math,Date});
  const kara=r.readyHero('fighter'),fresh=r.newAdventure(kara),offer=[{id:'0f8fad5b-d9cb-469f-a165-70867728950e'}];
  const place=st.sequelPlacement();assert.ok(r.sequelBearings.includes(place.bearing)&&place.miles>=4&&place.miles<=7,'a next tale lies a few miles off');
  // Somewhere new (the 2026-10-23 campaign: every land kept): the earlier world lies days away, never forgotten.
  for(let i=0;i<20;i++){const far=st.sequelPlacement(Math.random,{far:true});assert.ok(r.sequelBearings.includes(far.bearing)&&far.miles>=60&&far.miles<=200,'somewhere new lies days off');}
  {let n=0;const seeded=()=>[0,.999,.5][n++%3];const a=st.sequelPlacement(seeded,{far:true});assert.equal(a.bearing,'N');assert.ok(a.miles>=199,'its miles from the random given');}
  assert.throws(()=>st.taleChoice({selectedIntro:'idea',continuing:false,idea:'  ',easyStart:true,journeysOnOffer:null}),/Write your idea/);
  const own=st.taleChoice({selectedIntro:'idea',continuing:false,idea:' A heist on a frozen river. ',easyStart:false,journeysOnOffer:offer});assert.equal(own.wish,'A heist on a frozen river.');assert.equal(own.journeyId,null);
  const ready=st.taleChoice({selectedIntro:'journey:'+offer[0].id,continuing:false,idea:'',easyStart:false,journeysOnOffer:offer});assert.equal(ready.journeyId,offer[0].id);assert.equal(ready.introId,'easy','a journey is asked for as Easy to get into');
  assert.equal(st.taleChoice({selectedIntro:'surprise',continuing:false,idea:'',easyStart:true,journeysOnOffer:offer}).journeyId,offer[0].id,'Let fate decide takes a journey on offer');
  assert.equal(st.taleChoice({selectedIntro:'journey:'+offer[0].id,continuing:true,idea:'',easyStart:true,journeysOnOffer:offer}).journeyId,null,'never a journey for the next tale');
  const asked=st.taleRequest({hero:kara,game:fresh,characterChosen:false,continuing:false,bearing:'N',...ready});
  assert.equal(asked.input,'Create a fresh adventure for my character.');assert.equal(asked.context.journey,offer[0].id);assert.equal(asked.context.easyStart,true);assert.equal(asked.context.introId,'easy');assert.equal(asked.context.storySoFar,undefined,'no story so far with a ready journey');assert.equal(asked.context.player.name,kara.name);
  const lived={...fresh,story:{title:'The Reed Crown'},storyHistory:['Old Tale']};
  assert.ok(st.taleRepeats(lived,{story:{title:'the reed crown'}})&&!st.taleRepeats(lived,{story:{title:'New Tale'}}),'a tale already lived is caught, whatever its case');
  assert.equal(JSON.stringify(st.taleHistory(lived,{story:{title:'New Tale'}})),'["Old Tale","The Reed Crown","New Tale"]');}

 // ---- Narrators ----
 const prefs=vm.runInNewContext(fs.readFileSync('storyPreferences.js','utf8').replace(/export /g,'')+'\n({narrators,narratorOf,storyPreferences,setStoryPreferences})',{globalThis:{localStorage:{store:{},getItem(k){return this.store[k]??null;},setItem(k,v){this.store[k]=v;}}},JSON,Set});
 assert.equal(JSON.stringify(prefs.narrators.map(n=>n.id)),JSON.stringify(['chronicler','lamplighter','bard']));assert.equal(prefs.storyPreferences().narrator,'chronicler','the Chronicler unless chosen');
 prefs.setStoryPreferences({narrator:'lamplighter'});assert.equal(prefs.storyPreferences().narrator,'lamplighter');prefs.setStoryPreferences({narrator:'old-greg'});assert.equal(prefs.storyPreferences().narrator,'lamplighter','only our own narrators');
 assert.equal(prefs.narratorOf('nobody').id,'chronicler');for(const n of prefs.narrators)assert.ok(n.name&&n.description&&n.sample&&n.voice.rate>0&&n.voice.pitch>0&&n.icon,n.id);
 // Easy start: on by default, kept per device, only true or false; Let fate decide with it on is Easy to get into.
 assert.equal(prefs.storyPreferences().easyStart,true,'Easy start is on unless turned off');prefs.setStoryPreferences({easyStart:'no'});assert.equal(prefs.storyPreferences().easyStart,true,'only a yes or a no');
 prefs.setStoryPreferences({easyStart:false});assert.equal(prefs.storyPreferences().easyStart,false);
 {const start=vm.runInNewContext(fs.readFileSync('storyPreferences.js','utf8').replace(/export /g,'')+';({taleStart})',{globalThis:{localStorage:{getItem:()=>JSON.stringify({easyStart:false}),setItem(){}}},JSON,Set}).taleStart;
  const map=o=>JSON.stringify(start(o));
  assert.equal(map({selected:'surprise'}),JSON.stringify({introId:'easy',easyStart:true}),'Let fate decide with Easy start is Easy to get into (stocked ahead)');
  assert.equal(map({selected:'surprise',easyStart:false}),JSON.stringify({introId:'surprise',easyStart:false}));
  assert.equal(map({selected:'crown'}),JSON.stringify({introId:'crown',easyStart:true}));assert.equal(map({selected:'idea'}),JSON.stringify({introId:'idea',easyStart:true}));assert.equal(map({selected:'easy',easyStart:false}),JSON.stringify({introId:'easy',easyStart:false}));
  assert.equal(map({selected:'hostile'}),JSON.stringify({introId:'hostile',easyStart:false}),'never for the Skirmish');
  assert.equal(map({selected:'hostile',continuing:true}),JSON.stringify({introId:'surprise',easyStart:true}),'the next tale is asked for as Let fate decide, easy when on');
  assert.equal(map({selected:'surprise',continuing:true,easyStart:false}),JSON.stringify({introId:'surprise',easyStart:false}));}
 {const saved=vm.runInNewContext(fs.readFileSync('storyPreferences.js','utf8').replace(/export /g,'')+';({storyPreferences})',{globalThis:{localStorage:{getItem:()=>JSON.stringify({easyStart:false}),setItem(){}}},JSON,Set});assert.equal(saved.storyPreferences().easyStart,false,'a saved choice is read back');}
 const dm=fs.readFileSync(require.resolve('./dm-server.cjs'),'utf8')+fs.readFileSync(require.resolve('./dm-instructions.cjs'),'utf8');assert.ok(/NARRATOR: context\.storyPreferences\.narrator/.test(dm)&&dm.includes('standingPrompt=instructions+narratorInstructions+')&&dm.includes('instructions:standingPrompt,')&&/never changes the rules/.test(dm)&&dm.includes('phaseInstructions+note+narratorVoice(body)')&&/NARRATOR THIS TURN: Wick the Lamplighter/.test(dm)&&/NARRATOR THIS TURN: Sable the Bard/.test(dm),'the Dungeon Master is told who narrates, in its standing instructions and, concretely, last in each turn');
 const header=['DungeonMaster.js','DmHeader.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');assert.ok(header.includes('{teller.name}')&&header.includes('name={teller.icon}'),'the narrator heads the story');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log("Tales ahead, your own idea and narrators: a ready journey starts at once (the library itself: verify-journeys.cjs), written openings, the next tale and the player's own idea are written fresh, the idea cleaned and kept to Questbound's own world, Easy start on every opening, and three narrators of our own.");
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
