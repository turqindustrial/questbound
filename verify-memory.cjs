const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {requestParts,requestScene}=require('./dm-server.cjs');
const {rulesSource,rulesFiles}=require('./rules-files.cjs');
// The Dungeon Master remembers each adventure from start to finish (memoryRules.js; the host, 2026-10-13). The story
// log keeps 400 lines; the chronicle in game.memory keeps every tale and chapter, compressed (never dropped) as it
// grows, across next tales, new lands, level-ups, old saves and the shared table. Facts the game cannot see (a promise,
// a secret, a name) are kept from the Dungeon Master's `remember` field, two a turn at most, and settled by id. Each
// turn the Dungeon Master gets a block within a fixed budget, with what bears on this moment first.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI.
const files=rulesFiles;
assert.ok(files.includes('memoryRules.js'),'the campaign server loads the memory rules');
const source=rulesSource();
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,joinRegion,carriedBase,adventureStep,dmChoices,dmContext,commitDmTurn,settleTurn,validAdventure,adventureSnapshot,appendStoryLog,withStoryLog,memoryOf,withMemory,rememberFacts,memoryBlock,storySoFarForWriter,validMemory,chronicleView,closedMemory,memoryLimits,introducePerson,maxStoryLog,npcScene})',{AsyncStorage:{},weaponIcon:()=>'sword',console});
const plain=v=>JSON.parse(JSON.stringify(v));
const hero=r.readyHero('fighter'),hp=null;
const valid=g=>r.validAdventure(r.adventureSnapshot(hero,plain(g),hp,true),hero);
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the refuge.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const written=(id,title)=>({id,status:'active',title,premise:'An heir is missing and a pretender marches.',opening:'A seal is pressed into your hand at the gate.',objective:'Find the heir and settle the succession.',resolution:'The truth is known.',secret:'The heir chose to vanish.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'Bellwether Refuge '+id,description:'A pilgrim refuge under the pass.',kind:'settlement'},bridge:{name:'Redknife Notch '+id,description:'A narrow cut in the ridge.',kind:'mountain'},tower:{name:'Shrine of Last Steps '+id,description:'A shrine of worn stairs.',kind:'shrine'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},landmarks:[],lands:'none',
 chapters:[{title:'A Seal at the Gate',goal:'Question the people of the refuge.',turn:'A receipt shows the forgery.'},{title:'The Pass That Remembers',goal:'Search the shrine records.',turn:'The heir crossed the pass alive.'},{title:'Two Claims, One Crown',goal:'Face the queen.',turn:'The heir must choose.'}]});
const step=(g,action)=>{const next=r.adventureStep(g,hp,hero,action,()=>0.5);assert.equal(next.error,undefined,next.error);return r.withMemory(r.withStoryLog(g,next.game,hero,{action:typeof action==='string'?action:null}));};
const choice=(g,id)=>r.dmChoices(hero,g).find(c=>c.id===id)?.action;
// Story lines as a turn adds them (a settled turn folds them into the memory at once).
const tell=(g,lines)=>{let log=g.storyLog;for(const [kind,text] of lines)log=r.appendStoryLog(log,kind,text);return r.withMemory({...g,storyLog:log});};
// Facts in distinct words (two facts sharing most of their words are one fact).
const lexicon='amber barrow cinder dapple ember fallow gorse heron ingot juniper kestrel lantern meadow nettle osier pewter quarry rowan sorrel thistle umber vellum willow yarrow zither'.split(' ');
const distinct=(i,long=false)=>'Fact '+i+': '+Array.from({length:long?16:5},(_,k)=>lexicon[(i*7+k*11+Math.floor(i/26)*k)%26]+(i*31+k)).join(' ');
const filler=(n,tag)=>Array.from({length:n},(_,i)=>[['travel','loot','rest','place','person','fight','victory'][i%7],[`Returned to the ford ${tag}-${i}.`,`Gained ${i+1} gold.`,`Took a short rest at the ford ${tag}-${i}.`,`Learned of Cairn ${tag}-${i}, a mile from the ford.`,`Met Person ${tag}-${i}, a drover.`,`Fought the wolf ${tag}-${i} at the ford.`,`Slew the wolf ${tag}-${i}.`][i%7]]);

// ---- 1. A tale in chapters: the chronicle follows it, chapter by chapter ----
let g=r.freshStoryGame(hero,written('t1','The Seal Beneath the Snow'),r.newAdventure(hero));
assert.equal(g.memory,undefined,'a fresh tale has no memory saved yet');
let m=r.memoryOf(g);assert.equal(m.tales.length,1);assert.equal(m.tales[0].title,'The Seal Beneath the Snow');assert.equal(m.tales[0].chapters[0].title,'A Seal at the Gate','the first chapter takes its title from the story');
g=tell(g,[['person','Met Ilsa Marrow, a copyist.'],['deed','Ilsa Marrow owes you a debt for life.'],...filler(30,'a')]);
assert.ok(valid(g),'a save with a memory is valid');
m=g.memory;assert.ok(m.tales[0].chapters[0].beats.length<=r.memoryLimits.activeBeats,'a chapter keeps at most 14 lines while it is played');
assert.ok(m.tales[0].chapters[0].beats.includes('Ilsa Marrow owes you a debt for life.'),'what matters most stays word for word');
const f0=m.tales[0].chapters[0].folded;assert.ok(f0.places.length>=1&&f0.gold>0&&f0.rests>0,'the rest is folded into names and counts: '+JSON.stringify(f0));
g=step(g,choice(g,'story-advance'));
m=g.memory;assert.equal(m.tales[0].chapters.length,2);assert.ok(m.tales[0].chapters[0].done);assert.ok(m.tales[0].chapters[0].beats.length<=r.memoryLimits.closedBeats,'a finished chapter keeps eight lines');assert.equal(m.tales[0].chapters[1].title,'The Pass That Remembers');
g=tell(g,[['death','You killed Varro Quill.'],...filler(10,'b')]);
g=step(g,choice(g,'story-advance'));g=step(g,choice(g,'story-complete'));
m=g.memory;assert.equal(m.tales[0].status,'complete');assert.equal(m.tales[0].chapters.length,3);assert.ok(valid(g));

// ---- 2. Facts the Dungeon Master asks the game to keep ----
const keeper='keeper',ask=list=>r.rememberFacts(g,list).game;
let kept=ask([{text:'Tamsin made the hero promise to bring her brother\'s ring back from the Notch.',about:['keeper','bridge','nobody'],settles:null},{text:'The password at the shrine door is "Last Lantern".',about:['tower'],settles:null},{text:'A third fact in one turn.',about:[],settles:null}]);
let facts=kept.memory.facts;assert.equal(facts.length,2,'two facts a turn at most');
assert.deepEqual(plain(facts[0].about),['keeper','bridge'],'ids nobody knows are dropped');assert.deepEqual(plain(facts[0].names),['Tamsin Rook','Redknife Notch t1']);
assert.equal(r.rememberFacts(kept,[{text:'The hero has 12 hit points left after the fight.',about:[],settles:null}]).game,kept,'mechanics are not facts');
assert.equal(r.rememberFacts(kept,[{text:'Short',about:[],settles:null}]).game,kept,'too short');
assert.equal(r.rememberFacts(kept,[{text:'Tamsin made the hero promise to bring back her brother\'s ring from the Notch.',about:[],settles:null}]).game,kept,'a repeat of an open fact is left out');
assert.equal(r.rememberFacts(kept,[{text:'The ring was returned at last.',about:[],settles:'f99'}]).game,kept,'only an open fact can be settled');
let settled=r.rememberFacts(kept,[{text:'The hero returned the ring and Tamsin wept.',about:[],settles:'f1'}]).game;
assert.equal(settled.memory.facts[0].settled,'The hero returned the ring and Tamsin wept.');assert.ok(valid(settled));
assert.ok(settled.memory.tales.at(-1).chapters.at(-1).beats.some(b=>/^Settled: Tamsin made the hero promise.* — The hero returned the ring/.test(b)),'settling is a line of the chronicle');
// Someone the reply introduces is "new" in about.
{const met=r.introducePerson(kept,{name:'Old Hob',species:'Human',role:'A ferryman.',appearance:'A stooped man with a long pole and a wet hat.',personality:'Gruff.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null});
 const withHob=r.rememberFacts(met.game,[{text:'Old Hob knows the ford path that floods at dusk.',about:['new'],settles:null}],{newId:met.id}).game;assert.deepEqual(plain(withHob.memory.facts.at(-1).about),[met.id]);}
// Many facts: the oldest open ones are folded into the chronicle, settled ones let go past twenty.
{let many=kept;for(let i=0;i<46;i++)many=r.rememberFacts(many,[{text:distinct(i),about:[],settles:null}]).game;
 assert.equal(many.memory.facts.filter(f=>!f.settled).length,r.memoryLimits.openFacts);assert.ok(many.memory.tales.flatMap(t=>t.chapters.flatMap(c=>[...c.beats,...(c.folded.more?['folded']:[])])).length>0);
 assert.ok(r.memoryOf(many).tales.at(-1).chapters.at(-1).beats.some(b=>/^Remembered: /.test(b))||r.memoryOf(many).tales.at(-1).chapters.at(-1).folded.more>0,'an old fact is folded into the chronicle, not lost');assert.ok(valid(many));}

// ---- 3. Through a turn: the reply's remember field is kept by commitDmTurn and the turn's lines are folded ----
{const conversation={question:'I promise Tamsin I will find her brother.',narration:'She grips your hand.',dialogue:[],remember:[{text:'The hero promised Tamsin to find her brother Edric.',about:['keeper'],settles:null}]};
 const before={...g,stage:'inn'};const settledTurn=r.settleTurn({hero,game:before,health:hp,action:null,conversation,random:()=>0.5});
 assert.equal(settledTurn.error,undefined,settledTurn.error);const after=settledTurn.result.game;
 assert.ok(after.memory.facts.some(f=>/promised Tamsin/.test(f.text)),'the fact is kept with the turn');assert.ok(valid(after));
 const ctx=r.dmContext(hero,after,hp,'I ask Tamsin about her brother.');
 assert.ok(ctx.memory.facts.some(t=>/^f\d+ \[Tamsin Rook\]: The hero promised Tamsin/.test(t)),'a fact about someone named comes first: '+JSON.stringify(ctx.memory));
 assert.ok(ctx.memory.taleNow[0].startsWith('Tale 1 of 1: The Seal Beneath the Snow'));
 assert.equal(ctx.nearbyNPCs.some(n=>n.memories),false,'memories of the people here are sent once, in npcSocialState');
 g=after;}

// ---- 4. The next tale in the region, then somewhere new: the whole chronicle comes along ----
const fact=r.rememberFacts(g,[{text:'Ilsa Marrow the copyist keeps the forged itinerary hidden in her bible.',about:['keeper'],settles:null}]).game;
const next=r.joinRegion(r.freshStoryGame(hero,written('t2','The Salt Road'),r.newAdventure(hero,r.carriedBase(fact))),fact,{sameRegion:true,bearing:'N'});
assert.ok(valid(next),'the next tale is a valid save');
m=r.memoryOf(next);assert.deepEqual(plain(m.tales.map(t=>[t.title,t.status])),[['The Seal Beneath the Snow','complete'],['The Salt Road','active']]);
assert.ok(m.tales[0].summary.includes('completed')&&m.tales[0].summary.includes('A Seal at the Gate'),'a closed tale has a summary with its chapters: '+m.tales[0].summary);
assert.ok(/Ilsa Marrow owes you a debt for life|met Ilsa Marrow|Varro Quill/.test(m.tales[0].summary),'and what mattered most');
const moved=m.facts.find(f=>/forged itinerary/.test(f.text));assert.ok(moved,'facts come along');
assert.ok(moved.about.every(id=>next.people?.[id]&&next.people[id].name.startsWith('Tamsin Rook')),'a fact follows its person to their new id: '+JSON.stringify(moved.about));
const far=r.joinRegion(r.freshStoryGame(hero,written('t3','Ash Over Corvel'),r.newAdventure(hero,r.carriedBase(next))),next,{sameRegion:false});
assert.deepEqual(plain(r.memoryOf(far).tales.map(t=>t.title)),['The Seal Beneath the Snow','The Salt Road','Ash Over Corvel'],'somewhere new keeps the hero\'s whole story');
assert.equal(r.memoryOf(far).tales[1].status,'left');assert.ok(valid(far));
// Without the old tale's log (a skirmish or the crossroads before): the memory starts the new tale anyway.
{const base=r.newAdventure(hero,r.carriedBase(far)),skirmish={...base,story:{...far.story,title:'Random hostile encounter: 3 wolves'},storyLog:r.appendStoryLog([],'fight','Fought the wolves at the road.')};
 const mm=r.memoryOf(skirmish);assert.equal(mm.tales.at(-1).title,'Random hostile encounter: 3 wolves');assert.equal(mm.tales.length,4);assert.ok(mm.tales.slice(0,3).every(t=>t.summary));}

// ---- 5. A very long life: 130 tales, the first never lost, the save and the budget held ----
let life=r.freshStoryGame(hero,written('L1','The First Road Home'),r.newAdventure(hero));
life=tell(life,[['deed','Corin Ashe swore never to forgive you.'],['person','Met Wenna Dray, a smith.']]);
const firstLines=life.storyLog.length;
life=tell(life,[['quest','Adventure complete: The First Road Home.']]);
for(let t=2;t<=130;t++){
 life=tell(life,[['story',('Tale number '+t+' with a rather long and winding title: the tale began at Haven '+t+'.')],...filler(8,'L'+t)]);
 for(let c=2;c<=4;c++)life=tell(life,[['quest','Finished chapter '+(c-1)+': Part '+(c-1)+'.'],['story','Chapter '+c+': Part '+c+' of tale '+t],...filler(12,'L'+t+'c'+c)]);
 if(t<130)life=tell(life,[['quest','Adventure complete: Tale number '+t+'.']]);
}
assert.equal(life.storyLog.length,r.maxStoryLog,'the story log itself keeps only the last 400 lines');assert.ok(life.storyLog[0].id>firstLines,'the first tale has long left the log');
m=life.memory;assert.ok(r.validMemory(plain(m)),'the memory of a very long life is valid');
assert.equal(m.tales.length,r.memoryLimits.tales);assert.equal(m.era.count,10);assert.ok(m.era.text.startsWith('The First Road Home (completed)'),'the first tale is still remembered: '+m.era.text.slice(0,80));
assert.ok(m.tales.at(-1).chapters.length===4&&!m.tales.at(-1).summary&&m.tales.at(-2).chapters.length===4,'the newest closed tales keep their chapters');assert.equal(m.tales[0].chapters.length,0,'older tales keep their summary alone');
const lifeSize=Buffer.byteLength(JSON.stringify(m));assert.ok(lifeSize<120000,'the memory of 130 tales stays small in the save: '+lifeSize+' bytes');
// Facts at their most: forty open, twenty settled, long words.
for(let i=0;i<60;i++)life=r.rememberFacts(life,[{text:distinct(i,true).slice(0,158),about:i%3?['keeper','inn']:[],settles:null}]).game;
for(let i=0;i<20;i++)life=r.rememberFacts(life,[{text:('It was settled at last, after a long road, number '+i+' of them, with words that run long as well').slice(0,158),about:[],settles:life.memory.facts.find(f=>!f.settled).id}]).game;
assert.ok(valid(life),'a long life with every fact is still a valid save');
const block=r.memoryBlock(life,{input:'I ask Tamsin Rook about the ring and the old ford.',present:['keeper']}),blockSize=JSON.stringify(block).length;
assert.ok(blockSize<=r.memoryLimits.budget+40,'the block the Dungeon Master reads stays within its budget: '+blockSize);
assert.ok(block.taleNow?.length&&block.facts?.length&&block.earlierTales?.length,'it holds the tale under way, facts that bear on this and earlier tales');
assert.ok(block.facts.every(t=>/\[.*Tamsin Rook/.test(t)),'facts about whoever is here come first');assert.ok(block.moreFacts>0,'and says how many more there are');
assert.ok(block.earlierTales.some(t=>/^Before that, oldest first: The First Road Home/.test(t)),'the first tale is told, briefly');
// A person named who is not here: their history from the chronicle.
{let s=r.freshStoryGame(hero,written('h1','The Hollow Crown'),r.newAdventure(hero));s=r.introducePerson(s,{name:'Corin Ashe',species:'Human',role:'A ferryman.',appearance:'A tall man with a burnt hand and a grey cloak.',personality:'Bitter.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null}).game;
 s=tell(s,[['person','Met Corin Ashe, a ferryman.'],['deed','Corin Ashe swore never to forgive you.'],...filler(20,'h')]);
 const b=r.memoryBlock(s,{input:'Where is Corin now?',present:[]});assert.ok(b.about?.[0]?.startsWith('Corin Ashe: Met Corin Ashe, a ferryman. Corin Ashe swore never to forgive you.'),JSON.stringify(b.about));}

// ---- 6. Old saves: no memory, a log already trimmed, earlier titles in storyHistory ----
{const old={...far,storyHistory:['A Very Old Tale','The Seal Beneath the Snow','The Salt Road','Ash Over Corvel']};delete old.memory;
 assert.ok(valid(old),'an old save without a memory still loads');
 const built=r.memoryOf(old);assert.equal(built.tales[0].title,'A Very Old Tale','titles the log no longer holds come from storyHistory');assert.ok(built.tales[0].summary);
 assert.ok(built.tales.some(t=>t.title==='The Seal Beneath the Snow'));assert.ok(r.validMemory(plain(built)));
 const ctx=r.dmContext(hero,old,hp);assert.ok(ctx.memory.taleNow&&ctx.memory.earlierTales,'the Dungeon Master is told the story of an old save too');
 assert.equal(r.validMemory({v:1,cursor:{id:0,text:''},tales:[{no:1,title:'x',status:'active',summary:'y',chapters:[]}],facts:[],nextFact:1}),false,'a tale under way has no summary');
 assert.equal(r.validMemory({v:1,cursor:{id:0,text:''},tales:[],facts:[{id:'f1',text:'x',about:['Bad Id'],names:[],tale:0,at:0}],nextFact:2}),false);
 assert.equal(r.validMemory({v:1,cursor:{id:0,text:''},tales:[],facts:[{id:'f3',text:'x',about:[],names:[],tale:0,at:0}],nextFact:2}),false,'fact ids run below nextFact');}

// ---- 7. The Log tab's earlier tales ----
{const view=r.chronicleView(far);assert.deepEqual(plain(view.tales.map(t=>t.title)),['The Salt Road','The Seal Beneath the Snow']);}

// ---- 8. The Dungeon Master's side: the field is in the strict reply format, tidied, and explained ----
(async()=>{
 const server=require(process.env.QB_DM??'./dm-server.cjs');
 assert.ok(server.contractInstructions.includes('THE STORY SO FAR')&&server.contractInstructions.includes('REMEMBER:'),'the instruction is in the cached part');
 const context={memory:{facts:['f3 [Tamsin Rook]: The hero promised Tamsin to find her brother.'],otherFacts:['f7: The ferry runs at dawn.']},npcSocialState:[{id:'keeper'}]};
 const clean=server.cleanRemember([{text:'  The shrine password is   "Last Lantern".  ',about:['tower','n5','who knows'],settles:null},{text:'The hero found the brother alive in the mines.',about:[],settles:'f3'},{text:'third',about:[],settles:null}],context);
 assert.deepEqual(clean,[{text:'The shrine password is "Last Lantern".',about:['tower','n5'],settles:null},{text:'The hero found the brother alive in the mines.',about:[],settles:'f3'}]);
 assert.deepEqual(server.cleanRemember([{text:'The hero promised Tamsin to find her brother.',about:[],settles:null},{text:'The ferry closes.',about:[],settles:'f9'},{text:'Down to 3 HP after the fall.',about:[],settles:null}],context),[],'repeats, unknown ids and mechanics are dropped');
 let request=null;const reply={narration:'She nods.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,fault:null,remember:[{text:'Tamsin\'s brother Edric went to the salt mines.',about:['keeper'],settles:null}],suggestions:[]};
 const fake=body=>async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(body)}]}]})};};
 const ctx=r.dmContext(hero,g,hp,'Tell me about Edric.'),body={input:'Tell me about Edric.',context:{...plain(ctx),storyPreferences:{},conversationWith:null,conversationParticipants:[]}};
 const answer=await server.generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake(reply)});
 assert.deepEqual(answer.remember,[{text:'Tamsin\'s brother Edric went to the salt mines.',about:['keeper'],settles:null}]);
 const schema=require('./dm-schemas.cjs').asFields(request.text.format.schema);assert.ok(schema.required.includes('remember'),'required, as strict mode wants');
 assert.deepEqual(plain(schema.properties.remember.items.required),['text','about','settles']);assert.equal(schema.properties.remember.items.additionalProperties,false);assert.deepEqual(schema.properties.remember.items.properties.settles.type,['string','null']);
 assert.ok(Object.keys(schema.properties).indexOf('remember')<Object.keys(schema.properties).indexOf('suggestions'),'suggestions stay last');
 assert.ok(requestScene(request).context.memory,'the model reads the memory');
 // Out of character nothing is remembered; a reply that starts an action keeps its facts for the telling.
 const ooc=await server.generate({...body,context:{...body.context,outOfCharacter:{canRewind:false,lastTurn:null}}},{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({...reply,rewind:false,fault:false})});
 assert.deepEqual(ooc.remember,[],'a fact written out of character is left out');assert.equal(require('./dm-schemas.cjs').asFields(request.text.format.schema).properties.remember.maxItems,2,'the one schema for every phase');
 const acting=await server.generate(body,{apiKey:'k',model:'gpt-6-luna',fetchImpl:fake({...reply,actionId:ctx.choices[0].id})});assert.deepEqual(acting.remember,[]);
 // ---- 9. A shared table: facts from any member's turn are kept in the shared world ----
 const engine=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
 const snap=engine.adventureSnapshot(hero,plain({...g,stage:'inn'}),null,true);
 const table=await resolveTurn(snap,{question:'I ask about the ferry.'},{ask:async()=>({...reply,remember:[{text:'The ferryman owes Tamsin a favour from the flood year.',about:['keeper'],settles:null}]}),randomImpl:()=>0.5});
 assert.ok(table.snapshot.game.memory.facts.some(f=>/ferryman owes Tamsin/.test(f.text)),'a table turn keeps the fact');
 let party=engine.startParty(table.snapshot,'A','Al');party=engine.joinParty(party,'B',{character:JSON.stringify(r.readyHero('wizard')),game:engine.newAdventure(r.readyHero('wizard')),health:null,name:'Bo'}).snapshot;
 const view=engine.partyView(party,'B');assert.ok(view.game.memory.facts.some(f=>/ferryman owes Tamsin/.test(f.text)),'every member reads the same memory');
 const second=await resolveTurn(view,{question:'I ask Tamsin.'},{ask:async()=>({...reply,remember:[{text:'Bo swore to guard the refuge gate until spring.',about:['inn'],settles:null}]}),randomImpl:()=>0.5,actorName:'Bo'});
 const canon=engine.canonicalParty(second.snapshot),shared=JSON.parse(canon).world.memory.facts.map(f=>f.text);
 assert.ok(shared.some(t=>/ferryman owes Tamsin/.test(t))&&shared.some(t=>/Bo swore/.test(t)),'facts from every member\'s turn are kept');
 // ---- The story writer is told the story so far when it writes this hero's next tale (storySoFarForWriter) ----
 {const told=r.storySoFarForWriter(life),size=JSON.stringify(told).length;
  assert.ok(told.tales.length>=4&&/^Tale 130: /.test(told.tales[0]),'the tale just lived comes first, then the earlier ones: '+told.tales[0].slice(0,60));
  assert.ok(told.tales.some(t=>/The First Road Home/.test(t)),'and the first tale of all is still named');
  assert.ok(told.openFacts.length>=6&&!told.openFacts.some(f=>/^f\d/.test(f)),'with the threads still open, without their ids');
  assert.ok(size<=r.memoryLimits.budget+400,'within the memory budget: '+size);
  assert.equal(r.storySoFarForWriter(r.newAdventure(hero)),null,'a new hero has no story so far');
  const app=['App.js','startTale.js'].map(f=>fs.readFileSync(f,'utf8')).join(' ');assert.ok(app.includes('storySoFarForWriter(game):null;return lived?{storySoFar:lived}:{}')&&app.includes('!journeyId&&characterChosen&&game.story'),'the game sends it with a tale written for its hero, never with a ready journey');
  const {generateAdventure,tidyStorySoFar}=require('./adventure-generator.cjs'),{journeyStory}=require('./journey-fixtures.cjs'),asked=[];
  const writer=async(url,options)=>{asked.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(journeyStory(1))}]}]})};};
  await generateAdventure({input:'Create the next chapter.',context:{mode:'adventure',introId:'surprise',continuing:{previousTitle:'Tale number 130',newStartBearing:'north'},storySoFar:told,choices:[]}},{apiKey:'k',model:'m',fetchImpl:writer});
  let sent=requestScene(asked.at(-1)).context.storySoFar;
  assert.ok(/STORY SO FAR: context\.storySoFar/.test(requestParts(asked.at(-1)).instructions),'the writer is told what it is');
  assert.equal(JSON.stringify(sent),JSON.stringify(tidyStorySoFar(told)),'and gets it, tidied');assert.equal(sent.tales[0],told.tales[0]);
  assert.ok(Buffer.byteLength(asked.at(-1).input)<20000,'the request stays small: '+Buffer.byteLength(asked.at(-1).input));
  await generateAdventure({input:'Create',context:{mode:'adventure',introId:'surprise',ahead:true,storySoFar:told,choices:[]}},{apiKey:'k',model:'m',fetchImpl:writer});
  assert.ok(!/STORY SO FAR/.test(requestParts(asked.at(-1)).instructions)&&requestScene(asked.at(-1)).context.storySoFar===undefined,'a tale written ahead (no hero yet) never gets one');
  assert.equal(tidyStorySoFar({tales:'not a list'}),null);assert.equal(tidyStorySoFar(['x']),null);
  const rough=tidyStorySoFar({tales:Array.from({length:30},(_,i)=>'Tale '+i+'\u0000 '+'x'.repeat(900))});
  assert.ok(rough.tales.length===16&&rough.tales.every(t=>t.length<=600&&!/\u0000/.test(t)),'anything else is cut to size');}
 console.log('Passed: the story so far is remembered from the first turn to the last (tales and chapters folded, never dropped: 130 tales keep the first, '+lifeSize+' bytes of memory), facts are kept two a turn, settled by id and follow people into the next tale, old saves build theirs, the Dungeon Master reads a block of '+blockSize+' characters at most and answers in the strict format, and a shared table keeps every member\'s facts.');
})().catch(e=>{console.error(e.stack??e);process.exit(1);});
