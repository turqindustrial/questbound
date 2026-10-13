const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
// A clear introduction for every tale (2026-10-11, the host's words: "map out intros with a clear introduction and make
// sure all adventure beginnings have this rule applied"). However a tale begins (a written opening, Let fate decide,
// Easy to get into, Your own tale, the next tale in a region or somewhere new, a tale stocked ahead, the Skirmish, and
// Easy start on any of them), it opens by saying who the hero is here, where they are (the place and the land), what is
// going on, who is in front of them (by name) and what they could do first. The story writer is asked for it
// (`introduction`, five short fields); a tale without one gets one built from its own fields (storyRules.js
// introductionFor). It is the first card of the feed and the first lines of the journal, and the Dungeon Master keeps
// the first answer to it. Stand-in providers only: no network, no AI.
const source=rulesSource();
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,freshStoryGame,validStory,validIntroduction,introductionFor,storyIntroduction,introductionFields,introductionLines,introductionCard,dmContext,validAdventure,adventureSnapshot,joinRegion,carriedBase,commitDmTurn,recordedTurn})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const chronicle=vm.runInNewContext(fs.readFileSync('chronicleRules.js','utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')+'\n({describeEvent})',{});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const hero=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=g=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),hp,true),hero);
const intro={you:'You are a sellsword the reeve hired at the gate last night.',place:'Stillwater Market, in the Reedmarch: a market on stilts over black water.',trouble:'A barrow out in the reeds has woken, and the dead are walking the causeway.',people:'Reeve Ormund, who gives the orders here; Wren Halloway, a barge guide; Tilda Marsh and Brom Ashby at their stalls.',first:'Hear the reeve out, then take Wren\'s barge to the barrow.'};
const written={id:'intro-1',title:'The Reed Crown',premise:'A drowned barrow wakes under the reeds. The reeve knows why.',opening:'At Stillwater Market the reeve hands you a sealed order.',objective:'Learn who woke the barrow.',resolution:'Lay the barrow to rest.',secret:'The reeve opened it for silver.',foe:'Barrow warden',status:'active',region:'The Reedmarch',terrain:'marsh',introduction:intro,
 locations:{inn:{name:'Stillwater Market',description:'A crowded market on stilts above the reeds. Boats knock against the piles.',kind:'settlement'},bridge:{name:'The Drowned Barrow',description:'A mound half sunk in black water.',kind:'ruin'},tower:{name:'Saltmarsh Chapel',description:'A leaning chapel.',kind:'shrine'}},
 npcs:{keeper:{name:'Reeve Ormund',role:'The reeve of Stillwater, who gives orders here.',motive:'Keep his office.',appearance:'A heavy man in a fur-trimmed robe.',personality:'Brisk.',ties:{other:'acquaintance',foe:'neutral',note:'n'}},mara:{name:'Wren Halloway',role:'A barge guide, who knows the reeds.',motive:'Find her brother.',appearance:'A lean young woman with a pole.',personality:'Blunt.',ties:{other:'rival',foe:'enemy',note:'n'}}},
 residents:[{name:'Tilda Marsh',species:'Human',gender:'woman',role:'A fishwife at the market.',appearance:'A broad woman with scaled hands and a red shawl.',personality:'Loud.',motive:'Sell.',toughness:'common',attitude:'indifferent',at:'inn',foe:'neutral',tie:null,noticed:true},{name:'Brom Ashby',species:'Human',gender:'man',role:'A rope-maker.',appearance:'A wiry man with tarred fingers and a hemp coat.',personality:'Quiet.',motive:'Mend.',toughness:'common',attitude:'indifferent',at:'inn',foe:'neutral',tie:null,noticed:true},{name:'Old Nettle',species:'Human',gender:'woman',role:'A hermit who hides in the chapel crypt.',appearance:'A bent woman wrapped in sacking and dried reeds.',personality:'Whispers.',motive:'Be left alone.',toughness:'frail',attitude:'unfriendly',at:'tower',foe:'neutral',tie:null,noticed:false}],
 openingDialogue:[{speakerId:'keeper',text:'You have your orders.'},{speakerId:'resident2',text:'Rope, if you are going out there. Good rope.'},{speakerId:'mara',text:'You have your orders.'}]};
// ---- The writer's introduction: kept, in the journal and as the first card of the feed ----
const game=r.freshStoryGame(hero,written,r.newAdventure(hero));
same(game.story.introduction,intro,'the writer\'s introduction is kept');assert.ok(r.validStory(game.story)&&valid(game));
const first=game.playback[0];same(first.events.map(e=>e.kind),['effect','narration','dialogue','dialogue'],'the card, the opening, then the people speaking (a line said twice is said once)');
assert.equal(first.events[0].text,r.introductionCard(intro));const card=chronicle.describeEvent(first.events[0]);assert.equal(card.type,'intro');
same(card.rows.map(x=>x[0]),['You','Where','What is happening','Who is here','What you could do first']);assert.equal(card.rows[3][1],intro.people);
assert.ok(game.journal.entries[0].text.includes('Where: '+intro.place)&&game.journal.entries[0].text.includes('What you could do first: '+intro.first),'the journal opens with it too');
// Someone who keeps out of sight is never in the opening and never named among the people here.
assert.ok(Object.values(game.people).some(p=>p.name==='Old Nettle'&&p.hidden===true));assert.ok(!first.participants.some(id=>game.people[id]?.name==='Old Nettle'));
// ---- Built from the story when the writer gave none (an older writer, a stocked tale, a bad field) ----
const {introduction,...bare}=written,built=r.freshStoryGame(hero,{...bare,id:'intro-2'},r.newAdventure(hero)).story.introduction;
assert.ok(r.validIntroduction(built));assert.match(built.place,/^Stillwater Market, in The Reedmarch\. A crowded market on stilts above the reeds\.$/);assert.equal(built.trouble,'A drowned barrow wakes under the reeds.');
assert.ok(built.people.includes('Reeve Ormund, the reeve of Stillwater')&&built.people.includes('Wren Halloway, a barge guide')&&built.people.includes('Tilda Marsh')&&built.people.includes('Brom Ashby')&&!built.people.includes('Nettle'),built.people);
assert.equal(built.first,'Learn who woke the barrow.','with no chapters, the aim of the tale');
for(const broken of [{...intro,first:''},{...intro,you:'x'.repeat(900)},{you:'Only one field.'},'A sentence instead.']){const g2=r.freshStoryGame(hero,{...written,id:'intro-3',introduction:broken},r.newAdventure(hero));assert.ok(r.validIntroduction(g2.story.introduction),JSON.stringify(broken).slice(0,40));assert.ok(valid(g2));}
assert.equal(r.freshStoryGame(hero,{...written,id:'intro-4',introduction:{...intro,you:'You are a sellsword. '.repeat(30)}},r.newAdventure(hero)).story.introduction.you.length<=200,true,'a long field is trimmed to its limit');
// An errand tale names the orders; a chaptered tale the first chapter's goal.
const errand={...bare,id:'intro-5',landmarks:[{name:'Old Weir Camp',description:'A reed camp by a broken weir where smoke rises at night.',kind:'camp',bearing:'E',miles:1.5,danger:'risky'}],errand:{title:'Clear the weir',task:'Drive the reavers out of Old Weir Camp.',place:'Old Weir Camp',reward:'Forty gold pieces from the reeve.',threat:{template:'bandit',name:'Weir Reavers',appearance:'Mud-streaked raiders in stolen fishing leathers with hooked spears.',ally:null}},chapters:[{title:'The weir',goal:'Clear Old Weir Camp and report to Reeve Ormund.',turn:'A letter.'},{title:'The barrow',goal:'Go to the barrow.',turn:'The warden wakes.'}]};
const orders=r.freshStoryGame(hero,errand,r.newAdventure(hero)).story.introduction;
assert.equal(orders.you,'You are here on Reeve Ormund\'s orders: Clear the weir.');assert.equal(orders.first,'Drive the reavers out of Old Weir Camp, then return to Reeve Ormund for forty gold pieces from the reeve.');
const {errand:e0,...chaptered}=errand;assert.equal(r.freshStoryGame(hero,{...chaptered,id:'intro-6'},r.newAdventure(hero)).story.introduction.first,'Clear Old Weir Camp and report to Reeve Ormund.');
// A save from before introductions loads, and the game builds one for it when asked.
const old={...game,story:{...game.story}};delete old.story.introduction;assert.ok(valid(old),'old saves still load');assert.ok(r.validIntroduction(r.storyIntroduction(old)));
assert.ok(!r.validStory({...game.story,introduction:{...intro,first:''}}),'a broken introduction is never saved');
// ---- The Skirmish opens the same way ----
const skirmish=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);
assert.ok(r.validIntroduction(skirmish.story.introduction));assert.match(skirmish.story.introduction.first,/first move/);assert.match(skirmish.story.introduction.people,/Captain Oona Brask/);
assert.equal(skirmish.playback[0].events[0].kind,'effect');assert.equal(chronicle.describeEvent(skirmish.playback[0].events[0]).type,'intro');assert.ok(valid(skirmish));
// ---- The next tale in a region keeps its own introduction ----
const nextTale=r.joinRegion(r.freshStoryGame(hero,{...written,id:'intro-7',title:'The Second Reed'},r.newAdventure(hero,r.carriedBase(game))),game,{sameRegion:true,bearing:'N',miles:5});
same(nextTale.story.introduction,intro);assert.ok(valid(nextTale));
// ---- The Dungeon Master: the first move keeps to the introduction ----
const ctx=r.dmContext(hero,game,hp);assert.equal(ctx.openingTurn,true);same(ctx.introduction,intro);
const said=r.recordedTurn(hero,game,hp,{game,health:hp,events:[]},{question:'Where am I?',narration:'You stand in the market.'},null).game;
const later=r.dmContext(hero,said,hp);assert.equal(later.openingTurn,undefined,'only the first move');assert.equal(later.introduction,undefined);
const server=require('./dm-server.cjs'),scene=server.sceneFor({input:'Where am I?',context:JSON.parse(JSON.stringify(ctx))},{}).context;
same(scene.introduction,intro);assert.equal(scene.story.introduction,undefined,'read once, not twice');
assert.equal(server.sceneFor({input:'x',context:JSON.parse(JSON.stringify(later))},{}).context.story.introduction,undefined,'and not on later turns');
(async()=>{
 // ---- The story writer: every opening is asked for an introduction and opening voices ----
 const {generateAdventure}=require('./adventure-generator.cjs');
 const story={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',introduction:intro,locations:{inn:{name:'A',description:'a'},bridge:{name:'B',description:'b'},tower:{name:'C',description:'c'}},npcs:{keeper:{name:'Ivo',species:'Human',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
 const calls=[];const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(story)}]}]})};};
 const intros=JSON.parse(fs.readFileSync('adventureIntros.json','utf8'));
 // The map of openings: every way a tale begins, each with and without Easy start.
 const openings=[];
 for(const i of intros.filter(i=>!i.local))for(const easyStart of [false,true])openings.push({introId:i.id,easyStart,...(i.idea?{idea:'A lighthouse keeper who hears the drowned sing.'}:{})});
 openings.push({introId:'surprise',ahead:true},{introId:'easy',ahead:true},{introId:'crown',continuing:{previousTitle:'Old',newStartBearing:'The new starting place lies a few miles south of A.'}},{introId:'surprise',continuing:{previousTitle:'Old',newStartBearing:'north'},easyStart:true});
 for(const o of openings){
  calls.length=0;const out=await generateAdventure({input:'Create a fresh adventure.',context:{mode:'adventure',choices:[],...o}},{apiKey:'k',model:'m',fetchImpl});
  const call=calls[0],schema=call.text.format.schema;
  assert.ok(schema.required.includes('introduction')&&schema.required.includes('openingDialogue'),JSON.stringify(o)+': asked for an introduction and opening voices');
  same(Object.keys(schema.properties.introduction.properties),['you','place','trouble','people','first']);
  assert.match(call.instructions,/INTRODUCTION: every tale opens with a clear introduction/);assert.match(call.instructions,/two different voices, and give each speaker something of their own/);
  same(out.story.introduction,intro);
 }
 await assert.rejects(generateAdventure({input:'x',context:{mode:'adventure',introId:'hostile',choices:[]}},{apiKey:'k',model:'m',fetchImpl}),/starts on your device/);
 // Tales written ahead before introductions (or before the library of ready journeys) are never served.
 assert.ok(require('./tale-library.cjs').generation>=5);
 // The Dungeon Master is told how to treat the first move.
 const turnCalls=[];const dm=async(url,options)=>{turnCalls.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'You stand in Stillwater Market.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,suggestions:[]})}]}]})};};
 await server.generate({input:'Where am I?',context:{...JSON.parse(JSON.stringify(ctx)),choices:[]}},{apiKey:'test-only',model:'test-model',fetchImpl:dm});
 assert.match(turnCalls[0].instructions,/FIRST TURN: context.openingTurn means this is the player's first move/);assert.ok(JSON.parse(turnCalls[0].input).context.introduction.place===intro.place);
 console.log('Introductions: every way a tale begins ('+openings.length+' openings with and without Easy start, written ahead, the next tale, and the Skirmish) opens by saying who you are here, where, what is happening, who is in front of you and what you could do first: asked of the story writer, built from the story when missing, shown as the first card and journal lines, and kept to by the Dungeon Master on the first move.');
})().catch(e=>{console.error(e);process.exit(1);});
