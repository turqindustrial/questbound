const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
// Better than a wait and a fixed list: tales written ahead start at once (tale-pantry.cjs), a player can ask for a
// tale of their own idea, and a narrator of their choosing tells it. Nothing here calls the provider.
const {createPantry,stockFor,revision}=require('./tale-pantry.cjs');
const {generate}=require('./dm-server.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-tales-'));
const tick=(ms=5)=>new Promise(resolve=>setTimeout(resolve,ms));
const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',regard:{stance:'wary',reason:'I lost a brother to your kind.'},ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',regard:{stance:'warm',reason:'Travellers bring news.'},ties:{other:'friend',foe:'neutral',note:'n'}}}};
(async()=>{
 // ---- The stock ----
 assert.equal(revision,2);assert.equal(stockFor('surprise'),2);assert.equal(stockFor('crown'),1);
 let clock=1000;const pantry=createPantry({dir:path.join(tmp,'stock'),now:()=>clock});
 assert.equal(JSON.stringify(pantry.wanted(['surprise','crown'])),JSON.stringify(['surprise','crown']));assert.equal(pantry.take('crown'),null,'nothing in stock yet');
 let wrote=[];const write=async id=>{wrote.push(id);return {story:{...story,title:'Tale '+wrote.length}};};
 assert.equal(pantry.topUp(['surprise','crown'],write),true);assert.equal(pantry.topUp(['surprise','crown'],write),false,'one tale at a time');
 await pantry.settled();assert.equal(pantry.count('surprise'),1);
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
 taken.length=0;await ask({mode:'adventure',introId:'crown',continuing:{previousTitle:'Old'}});assert.equal(taken.length,0,'the next tale in a region is written fresh');
 await ask({mode:'adventure',introId:'idea',idea:'A haunted lighthouse on a frozen coast'});assert.equal(taken.length,0,'so is the player\'s own idea');

 // ---- The story writer: the player's own idea, and tales written before the hero is known ----
 const idea=calls.at(-1);assert.match(idea.instructions,/PLAYER'S IDEA/);assert.match(idea.instructions,/take only its mood/);assert.ok(idea.input.includes('haunted lighthouse'));assert.match(JSON.parse(idea.input).creativeDirection,/own idea: A haunted lighthouse/);
 await assert.rejects(ask({mode:'adventure',introId:'idea',idea:'  '}),/Write your idea/);
 const odd=await ask({mode:'adventure',introId:'idea',idea:'A cursed\u0000 bell\n\n tolls   at noon'});assert.ok(JSON.parse(calls.at(-1).input).creativeDirection.endsWith('A cursed bell tolls at noon'),'one clean line');
 assert.ok(odd.story.npcs.keeper.regard,'a tale for a known hero keeps the people\'s view of their kind');
 const {generateAdventure}=require('./adventure-generator.cjs');
 const ahead=await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(calls.at(-1).instructions,/WRITTEN AHEAD/);assert.equal(ahead.story.npcs.keeper.regard,undefined,'written ahead, the view of the hero\'s kind is left to the game');
 await generateAdventure({input:'Create',context:{mode:'adventure',introId:'crown',continuing:{previousTitle:'Old',newStartBearing:'north'},idea:'my sister comes looking for me',choices:[]}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.match(JSON.parse(calls.at(-1).input).creativeDirection,/The player wishes: my sister comes looking for me/);
 const intros=JSON.parse(fs.readFileSync('adventureIntros.json','utf8')),own=intros.find(i=>i.id==='idea');assert.ok(own&&own.idea&&!own.local&&intros[1].id==='idea','Your own tale is offered second');

 // ---- The New Adventure screen and the game ----
 const screen=fs.readFileSync('AdventureIntros.js','utf8'),app=fs.readFileSync('App.js','utf8');
 assert.ok(screen.includes('function IdeaBox')&&screen.includes('ideaReady(idea)')&&screen.includes('<NarratorChoice compact/>'),'the idea box, its gate and the narrator choice');
 assert.ok(app.includes("...(wish?{idea:wish}:{})")&&app.includes("selectedIntro==='idea'&&!wish"),'the idea reaches the story writer');

 // ---- Narrators ----
 const prefs=vm.runInNewContext(fs.readFileSync('storyPreferences.js','utf8').replace(/export /g,'')+'\n({narrators,narratorOf,storyPreferences,setStoryPreferences})',{globalThis:{localStorage:{store:{},getItem(k){return this.store[k]??null;},setItem(k,v){this.store[k]=v;}}},JSON,Set});
 assert.equal(JSON.stringify(prefs.narrators.map(n=>n.id)),JSON.stringify(['chronicler','lamplighter','bard']));assert.equal(prefs.storyPreferences().narrator,'chronicler','the Chronicler unless chosen');
 prefs.setStoryPreferences({narrator:'lamplighter'});assert.equal(prefs.storyPreferences().narrator,'lamplighter');prefs.setStoryPreferences({narrator:'old-greg'});assert.equal(prefs.storyPreferences().narrator,'lamplighter','only our own narrators');
 assert.equal(prefs.narratorOf('nobody').id,'chronicler');for(const n of prefs.narrators)assert.ok(n.name&&n.description&&n.sample&&n.voice.rate>0&&n.voice.pitch>0&&n.icon,n.id);
 const dm=fs.readFileSync(require.resolve('./dm-server.cjs'),'utf8');assert.ok(/NARRATOR: context\.storyPreferences\.narrator/.test(dm)&&dm.includes('instructions:instructions+narratorInstructions+')&&/never changes the rules/.test(dm)&&dm.includes('phaseInstructions+narratorVoice(body)+note')&&/NARRATOR THIS TURN: Wick the Lamplighter/.test(dm)&&/NARRATOR THIS TURN: Sable the Bard/.test(dm),'the Dungeon Master is told who narrates, in its standing instructions and, concretely, last in each turn');
 const header=fs.readFileSync('DungeonMaster.js','utf8');assert.ok(header.includes('{teller.name}')&&header.includes('name={teller.icon}'),'the narrator heads the story');
 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Tales ahead, your own idea and narrators: a stock of tales written ahead (two for Let fate decide, one per opening, refilled one at a time at the asker\'s cost, kept on disk), the next tale and the player\'s own idea written fresh, the idea cleaned and kept to Questbound\'s own world, and three narrators of our own.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
