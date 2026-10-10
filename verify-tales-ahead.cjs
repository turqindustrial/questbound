const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
// Better than a wait and a fixed list: tales written ahead start at once (tale-pantry.cjs), a player can ask for a
// tale of their own idea, and a narrator of their choosing tells it. Nothing here calls the provider.
const {createPantry,stockFor,revision,generation}=require('./tale-pantry.cjs');
const {generate}=require('./dm-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-tales-'));
const tick=(ms=5)=>new Promise(resolve=>setTimeout(resolve,ms));
const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',regard:{stance:'wary',reason:'I lost a brother to your kind.'},ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',regard:{stance:'warm',reason:'Travellers bring news.'},ties:{other:'friend',foe:'neutral',note:'n'}}}};
(async()=>{
 // ---- The stock ----
 assert.equal(revision,3);assert.equal(generation,3);assert.equal(stockFor('surprise'),2);assert.equal(stockFor('easy'),2,'Easy to get into is meant to start fast');assert.equal(stockFor('crown'),1);
 // Tales stocked by an earlier story writer (no residents, no errands) are cleared away and never served.
 fs.mkdirSync(path.join(tmp,'stock'),{recursive:true});const legacy=path.join(tmp,'stock','crown-0f8fad5b-d9cb-469f-a165-70867728950e.json'),older=path.join(tmp,'stock','crown-g2-0f8fad5b-d9cb-469f-a165-70867728950f.json'),other=path.join(tmp,'stock','notes.txt');
 for(const file of [legacy,older])fs.writeFileSync(file,JSON.stringify({story:{...story,title:'Legacy'}}));fs.writeFileSync(other,'kept');
 let clock=1000;const pantry=createPantry({dir:path.join(tmp,'stock'),now:()=>clock});
 assert.ok(!fs.existsSync(legacy)&&!fs.existsSync(older)&&fs.existsSync(other),'old generations removed, nothing else touched');assert.equal(pantry.count('crown'),0);
 assert.equal(JSON.stringify(pantry.wanted(['surprise','crown'])),JSON.stringify(['surprise','crown']));assert.equal(pantry.take('crown'),null,'nothing in stock yet');
 let wrote=[];const write=async id=>{wrote.push(id);return {story:{...story,title:'Tale '+wrote.length}};};
 assert.equal(pantry.topUp(['surprise','crown'],write),true);assert.equal(pantry.topUp(['surprise','crown'],write),false,'one tale at a time');
 await pantry.settled();assert.equal(pantry.count('surprise'),1);assert.ok(fs.readdirSync(path.join(tmp,'stock')).some(f=>/^surprise-g3-[0-9a-f-]{36}.json$/.test(f)),'stocked as <opening>-g3-<uuid>.json');
 for(let i=0;i<3;i++){pantry.topUp(['surprise','crown'],write);await pantry.settled();}
 assert.equal(pantry.count('surprise'),2);assert.equal(pantry.count('crown'),1);assert.equal(JSON.stringify(wrote),JSON.stringify(['surprise','surprise','crown']));
 assert.equal(pantry.topUp(['surprise','crown'],write),false,'full: nothing more is written');
 const first=pantry.take('surprise');assert.equal(first.title,'Tale 1','the oldest first');assert.equal(pantry.count('surprise'),1);
 assert.equal(pantry.take('../etc'),null,'only opening names');
 // A failed write waits ten minutes before the next try.
 pantry.topUp(['surprise'],async()=>{throw Error('provider down');});await pantry.settled();
 assert.equal(pantry.topUp(['surprise'],write),false,'paused after a failure');clock+=11*60*1000;assert.equal(pantry.topUp(['surprise'],write),true);await pantry.settled();assert.equal(pantry.count('surprise'),2);
 // Each finished tale starts the next until the stock is full (the rest of the chain written by the host's writer).
 const chain=createPantry({dir:path.join(tmp,'chain'),now:()=>clock}),who=[];
 chain.topUp(['surprise','crown','winter'],async id=>{who.push('asker:'+id);return {story};},async id=>{who.push('host:'+id);return {story};});await chain.settled();
 assert.equal(JSON.stringify(who),JSON.stringify(['asker:surprise','host:surprise','host:crown','host:winter']));assert.equal(chain.wanted(['surprise','crown','winter']).length,0);
 // A restart keeps the stock (it is on disk).
 assert.equal(createPantry({dir:path.join(tmp,'stock')}).count('surprise'),2);

 // ---- The Dungeon Master: a stocked tale starts at once; its replacement is written at the asker's cost ----
 const calls=[];const storyFetch=async(url,options)=>{const request=JSON.parse(options.body);calls.push(request);return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 const keys={apiKey:'k',model:'gpt-6-luna',storyReasoning:'high',fetchImpl:storyFetch};
 const taken=[],toppedUp=[];const stand={take:id=>{taken.push(id);return id==='crown'?{...story,title:'Stocked'}:null;},topUp:(openings,w)=>{toppedUp.push(openings);return false;}};
 const ask=(context,extra={})=>generate({input:'Create a fresh adventure.',...extra,context:{choices:[],...context}},{...keys,pantry:stand});
 const instant=await ask({mode:'adventure',introId:'crown',job:'verify-job-ahead-000001'});
 assert.equal(instant.story.title,'Stocked');assert.equal(instant.story.status,'active');assert.match(instant.story.id,/^[0-9a-f-]{36}$/);assert.equal(calls.length,0,'no wait and no call');
 assert.ok(toppedUp.length>=1&&toppedUp.at(-1).includes('surprise')&&!toppedUp.at(-1).includes('idea')&&!toppedUp.at(-1).includes('hostile'),'every written opening is kept in stock, not Your own tale or the Skirmish');
 // The replacement written at an account player's cost carries the same OpenAI safety identifier as their own turns.
 {let asker=null;const account='account-'+'ab'.repeat(32);
  await generate({input:'Create a fresh adventure.',guest:account,context:{choices:[],mode:'adventure',introId:'crown'}},{...keys,pantry:{take:()=>({...story,title:'Stocked'}),topUp:(openings,w)=>{asker??=w;return false;}}});
  assert.ok(asker,'the asker writes the replacement');await asker('surprise');assert.equal(calls.at(-1).safety_identifier,'qb-acct-'+'ab'.repeat(16));}
 taken.length=0;await ask({mode:'adventure',introId:'crown',continuing:{previousTitle:'Old'}});assert.equal(taken.length,0,'the next tale in a region is written fresh');
 await ask({mode:'adventure',introId:'idea',idea:'A haunted lighthouse on a frozen coast'});assert.equal(taken.length,0,'so is the player\'s own idea');

 // ---- The story writer: the player's own idea, and tales written before the hero is known ----
 const idea=calls.at(-1);assert.match(idea.instructions,/PLAYER'S IDEA/);assert.match(idea.instructions,/take only its mood/);assert.ok(idea.input.includes('haunted lighthouse'));assert.match(JSON.parse(idea.input).creativeDirection,/own idea: A haunted lighthouse/);
 await assert.rejects(ask({mode:'adventure',introId:'idea',idea:'  '}),/Write your idea/);
 const odd=await ask({mode:'adventure',introId:'idea',idea:'A cursed\u0000 bell\n\n tolls   at noon'});assert.ok(JSON.parse(calls.at(-1).input).creativeDirection.endsWith('A cursed bell tolls at noon'),'one clean line');
 assert.ok(odd.story.npcs.keeper.regard,'a tale for a known hero keeps the people\'s view of their kind');
 // Easy start with another opening: written fresh, so it begins with orders in hand; Easy to get into itself is still stocked.
 taken.length=0;await ask({mode:'adventure',introId:'crown',easyStart:true});assert.equal(taken.length,0,'an easy start on a written opening is written fresh');
 await ask({mode:'adventure',introId:'surprise',easyStart:true});assert.equal(taken.length,0,'and on Let fate decide (the game asks for Easy to get into instead)');
 const easyStocked=await ask({mode:'adventure',introId:'easy',easyStart:true});assert.equal(JSON.stringify(taken),JSON.stringify(['easy']),'Easy to get into comes from the stock');assert.equal(easyStocked.story.title,'T');
 taken.length=0;await ask({mode:'adventure',introId:'crown',easyStart:false});assert.equal(JSON.stringify(taken),JSON.stringify(['crown']),'without Easy start the stock is used as before');
 const {generateAdventure}=require('./adventure-generator.cjs');
 const intros0=JSON.parse(fs.readFileSync('adventureIntros.json','utf8'));
 const ahead=await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(calls.at(-1).instructions,/WRITTEN AHEAD/);assert.equal(ahead.story.npcs.keeper.regard,undefined,'written ahead, the view of the hero\'s kind is left to the game');
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'crown',continuing:{previousTitle:'Old',newStartBearing:'north'},idea:'my sister comes looking for me',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(JSON.parse(calls.at(-1).input).creativeDirection,/The player wishes: my sister comes looking for me/);
 const intros=JSON.parse(fs.readFileSync('adventureIntros.json','utf8')),own=intros.find(i=>i.id==='idea');assert.ok(own&&own.idea&&!own.local&&intros[0].id==='idea'&&intros[1].id==='easy'&&intros[2].id==='surprise','Your own tale first, then Easy to get into, then Let fate decide');
 const easyIntro=intros[1];assert.ok(easyIntro.errand&&easyIntro.openingDialogue&&easyIntro.scale==='saga'&&!easyIntro.local,'Easy to get into is an errand with voices');assert.ok(intros.find(i=>i.id==='surprise').openingDialogue&&own.openingDialogue,'Let fate decide and Your own tale open with voices');
 // ---- The story writer: residents for every tale, an errand for Easy to get into, and a varied opening ----
 const {errandDirections,openingScenes}=(()=>{const src=fs.readFileSync('adventure-generator.cjs','utf8');return vm.runInNewContext(src.match(/const openingScenes=\[[^\]]*\];/)[0]+src.match(/const errandDirections=\[[^\]]*\];/)[0]+'({openingScenes,errandDirections})');})();
 assert.equal(errandDirections.length,12);assert.equal(openingScenes.length,12);
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'easy',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 const easyCall=calls.at(-1),easySchema=easyCall.text.format.schema,easyInput=JSON.parse(easyCall.input);
 for(const field of ['residents','errand','openingDialogue'])assert.ok(easySchema.required.includes(field),'an errand tale must have '+field);
 assert.match(easyCall.instructions,/EASY TO GET INTO/);assert.match(easyCall.instructions,/RESIDENTS:/);assert.ok(!easyCall.instructions.includes('Only the two specified NPCs'),'the writer may put more than two people at the start');
 assert.ok(errandDirections.some(d=>easyInput.creativeDirection.endsWith(d)),'an errand from the list');assert.ok(openingScenes.includes(easyInput.openingScene),'a kind of opening moment');
 assert.deepEqual(easySchema.properties.openingDialogue.items.properties.speakerId.enum.slice(0,3),['keeper','mara','resident1']);assert.equal(easySchema.properties.residents.maxItems,8);
 assert.equal(easySchema.properties.errand.properties.threat.properties.ally.type.join(),'object,null');
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 const fate=calls.at(-1);assert.ok(fate.text.format.schema.required.includes('residents')&&!fate.text.format.schema.required.includes('errand'),'every tale has residents; only Easy to get into has an errand');assert.ok(openingScenes.includes(JSON.parse(fate.input).openingScene));assert.ok(!fate.instructions.includes('EASY TO GET INTO'));
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'crown',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});assert.equal(JSON.parse(calls.at(-1).input).openingScene,undefined,'a written opening keeps its own arrival');
 // ---- Easy start: any opening but the Skirmish asks the writer for the errand, its voices and a direction to match ----
 const easyFor=async context=>{await generateAdventure({input:'Create',context:{mode:'adventure',choices:[],...context}},{apiKey:'k',model:'m',fetchImpl:storyFetch});const call=calls.at(-1);return {schema:call.text.format.schema,instructions:call.instructions,input:JSON.parse(call.input)};};
 for(const [label,context] of [['a written opening',{introId:'crown'}],['an idea of their own',{introId:'idea',idea:'A heist in a city on a sleeping giant'}],['the next tale',{introId:'surprise',continuing:{previousTitle:'Old',newStartBearing:'north'}}],['Let fate decide',{introId:'surprise'}]]){
  const on=await easyFor({...context,easyStart:true});
  for(const field of ['errand','openingDialogue','residents'])assert.ok(on.schema.required.includes(field),label+' with Easy start must have '+field);
  assert.match(on.instructions,/EASY TO GET INTO/,label+' with Easy start is told how an errand begins');assert.ok(/errand/i.test(on.input.creativeDirection)||errandDirections.some(d=>on.input.creativeDirection.endsWith(d)),label+': the direction sets an errand');
  const off=await easyFor({...context,easyStart:false});assert.ok(!off.schema.required.includes('errand')&&!off.instructions.includes('EASY TO GET INTO'),label+' without Easy start has no errand');
 }
 {const on=await easyFor({introId:'crown',easyStart:true});assert.ok(on.input.creativeDirection.startsWith(intros0.find(i=>i.id==='crown').setting),'a written opening keeps its own setting');assert.equal(on.input.openingScene,undefined,'and its own arrival');}
 await assert.rejects(easyFor({introId:'hostile',easyStart:true}),/without the AI/,'the Skirmish is never written, easy or not');
 {const truthy=await easyFor({introId:'crown',easyStart:'yes'});assert.ok(!truthy.schema.required.includes('errand'),'only easyStart:true counts');}
 // Written ahead, residents' views of the hero's kind are dropped too; their lines are kept by residentN.
 const peopled={...story,residents:[{name:'Old Tam',regard:{stance:'scornful',reason:'x'}}],openingDialogue:[{speakerId:'resident1',text:'Orders are orders.'},{speakerId:'resident9',text:'No.'},{speakerId:'keeper',text:'Go now.'}]};
 const peopledFetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(peopled)}]}]})};};
 const aheadEasy=await generateAdventure({input:'Create',context:{mode:'adventure',introId:'easy',ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:peopledFetch});
 assert.equal(aheadEasy.story.residents[0].regard,undefined,'written ahead, what the residents think of the hero\'s kind is left to the game');assert.deepEqual(aheadEasy.story.openingDialogue.map(l=>l.speakerId),['resident1','keeper'],'only known voices');

 // ---- The New Adventure screen and the game ----
 const screen=fs.readFileSync('AdventureIntros.js','utf8'),app=fs.readFileSync('App.js','utf8');
 assert.ok(screen.includes('function IdeaBox')&&screen.includes('ideaReady(idea)')&&screen.includes('<NarratorChoice compact/>'),'the idea box, its gate and the narrator choice');
 assert.ok(app.includes("...(wish?{idea:wish}:{})")&&app.includes("selectedIntro==='idea'&&!wish"),'the idea reaches the story writer');
 // Easy start: a per-device switch on the New Adventure and next-tale screens, on unless turned off, hidden for the Skirmish.
 assert.ok(screen.includes('function EasyStart')&&screen.includes("label=\"Easy start\"")&&(screen.match(/<EasyStart /g)??[]).length===2&&screen.includes("selected!=='hostile'"),'the Easy start switch on both screens, not for the Skirmish');
 assert.ok(app.includes("taleStart({selected:selectedIntro,continuing,easyStart:storyPreferences().easyStart})")&&app.includes("introId:start.introId,...(start.easyStart?{easyStart:true}:{})")&&app.includes("freshStoryGame(hero,{...body.story,introId:start.introId},base)"),'the game sends the easy start and keeps the opening it asked for');

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
 const dm=fs.readFileSync(require.resolve('./dm-server.cjs'),'utf8');assert.ok(/NARRATOR: context\.storyPreferences\.narrator/.test(dm)&&dm.includes('instructions:instructions+narratorInstructions+')&&/never changes the rules/.test(dm)&&dm.includes('phaseInstructions+narratorVoice(body)+note')&&/NARRATOR THIS TURN: Wick the Lamplighter/.test(dm)&&/NARRATOR THIS TURN: Sable the Bard/.test(dm),'the Dungeon Master is told who narrates, in its standing instructions and, concretely, last in each turn');
 const header=fs.readFileSync('DungeonMaster.js','utf8');assert.ok(header.includes('{teller.name}')&&header.includes('name={teller.icon}'),'the narrator heads the story');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Tales ahead, your own idea and narrators: a stock of tales written ahead by the current story writer (two for Let fate decide and Easy to get into, one per opening, refilled one at a time at the asker\'s cost, kept on disk), the next tale and the player\'s own idea written fresh, the idea cleaned and kept to Questbound\'s own world, and three narrators of our own.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
