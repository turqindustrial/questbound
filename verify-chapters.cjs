const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The long tale: a story told in chapters, with leads, landmarks and lands beyond its own country; the Dungeon
// Master moves it on one chapter at a time, levels are earned along the way, and old stories play as they did.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','sequelRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,validAdventure,adventureSnapshot,validStory,questState,currentGoal,levelUpReady,foeForLevel,storyFoeStats,dmChoices,offeredChoices,dmContext,commitDmTurn,adventureStep,quickActions,mapRegions,regionOfPlace,worldPlaces,travelRoute,withStoryLog,joinRegion,carriedBase,maxLandmarks,maxWorldPlaces})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter'),hp=null;
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the refuge.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',regard:{stance:'curious',reason:'I have never met one of your kind.'},ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const written={id:'saga-1',status:'active',title:'The Seal Beneath the Snow',premise:'An heir is missing and a pretender marches.',opening:'A seal is pressed into your hand at the gate.',objective:'Find the heir and settle the succession.',resolution:'The truth of the succession is known and the war averted or faced.',secret:'The heir chose to vanish.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'Bellwether Refuge',description:'A pilgrim refuge under the pass.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A narrow cut in the ridge.',kind:'mountain'},tower:{name:'Shrine of Last Steps',description:'A shrine of worn stairs.',kind:'shrine'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},
 landmarks:['Three-Cairn Road','Sister Bell Shrine','Slate Widow Farm','Meltwater Ford','Hearthvale','Old Toll House','A Seventh Place'].map((name,i)=>({name,description:'A place on the old royal road, number '+(i+1)+'.',kind:'landmark',bearing:['N','E','S','W','NE','SW','SE'][i],miles:2+i,from:'inn',danger:i%2?'risky':'safe',feature:'A marker stone.'})),
 chapters:[
  {title:'A Seal at the Gate',goal:'Question the people of Bellwether Refuge and find a lead to the heir.',turn:'A receipt shows the forged itinerary was paid for from the queen\'s own household.'},
  {title:'The Pass That Remembers',goal:'Reach the Shrine of Last Steps and search its records.',turn:'The heir crossed the pass alive; a mark points to Orthell.'},
  {title:'A Road Beyond Veyr',goal:'Travel to the Orthell border and find who carried the heir\'s last message.',turn:'The heir chose to vanish, and a palace official feared her return.'},
  {title:'The Keeper of the Notch',goal:'Return to Veyr and deal with the guardian of Redknife Notch.',turn:'The guardian was hired to blame the pretender.'},
  {title:'Two Claims, One Crown',goal:'Bring the proof to the capital and face the queen.',turn:'The heir must choose.'}],
 leads:[{title:'The Copyist\'s Debt',hook:'Tamsin asks you to recover her brother\'s wages from the Slate Widow Farm.'},{title:'The Missing Muleteer',hook:'Rusk wants news of a friend last seen at Meltwater Ford.'},{title:'',hook:'nothing'}],
 lands:[{name:'Orthell Lowlands',terrain:'plains',bearing:'SW',miles:64,place:{name:'Pale Reed Ferry',description:'A ferry stage on a slow brown river.',kind:'water'},rumour:'A veiled noble paid for passage under a false name.'},{name:'Veyr',terrain:'coast',bearing:'E',miles:90,place:{name:'Nowhere',description:'The same country cannot be a far land.',kind:'ruin'},rumour:'x'},{name:'Coast of Namar',terrain:'coast',bearing:'E',miles:900,place:{name:'Saltglass Abbey',description:'An abbey of sea-green glass on a headland.',kind:'shrine'},rumour:'Letters of the first queen.'}]};
const fresh=()=>r.freshStoryGame(hero,JSON.parse(JSON.stringify(written)),r.newAdventure(hero));
const valid=g=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),hp,true),hero);
let g=fresh();
// ---- A long tale begins ----
assert.equal(g.story.chapters.length,5);assert.equal(g.story.chapter,0);assert.deepEqual(JSON.parse(JSON.stringify(g.story.leads.map(l=>l.id))),['l1','l2'],'A lead with no title is left out');
assert.equal(r.maxLandmarks,6);assert.equal(r.worldPlaces(g).length,8,'Six landmarks and two far places are on the map from the start');
assert.deepEqual(JSON.parse(JSON.stringify(r.mapRegions(g).map(x=>x.name))),['Veyr','Orthell Lowlands','Coast of Namar'],'The story\'s own country is never a far land');
const ferry=r.worldPlaces(g).find(p=>p.name==='Pale Reed Ferry'),abbey=r.worldPlaces(g).find(p=>p.name==='Saltglass Abbey');
assert.equal(ferry.region,'r1');assert.equal(abbey.region,'r2');assert.equal(ferry.feature,'A veiled noble paid for passage under a false name.');
const miles=p=>Math.hypot(p.x,p.y)/5280;assert.ok(Math.abs(miles(ferry)-64)<.01);assert.ok(Math.abs(miles(abbey)-300)<.01,'A far land is at most 300 miles away');
const road=r.travelRoute(g,'inn',ferry.id);assert.ok(road.minutes>2*24*60,'The road to another land takes days');
assert.ok(valid(g),'A long tale saves');assert.ok(g.journal.entries[0].text.includes('Chapter 1: A Seal at the Gate'));
assert.equal(r.currentGoal(g),written.chapters[0].goal);
// Stories without chapters are told as one, as before.
const plain=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(written)),chapters:[written.chapters[0]],leads:undefined,lands:'none',landmarks:[]},r.newAdventure(hero));
assert.equal(plain.story.chapters,undefined);assert.equal(plain.story.chapter,undefined);assert.equal(plain.story.leads,undefined);assert.equal(plain.world,undefined);assert.ok(valid(plain));
assert.equal(r.currentGoal(plain),written.objective);assert.ok(r.dmChoices(hero,plain).some(c=>c.id==='story-complete'));assert.ok(!r.dmChoices(hero,plain).some(c=>c.id==='story-advance'));
// A saved story whose chapter index runs off the end, or with a malformed lead, is refused.
assert.ok(!r.validStory({...g.story,chapter:5}));assert.ok(!r.validStory({...g.story,chapter:undefined}));assert.ok(!r.validStory({...g.story,leads:[{id:'l9',title:'x',hook:'y'}]}));assert.ok(!r.validStory({...plain.story,chapter:0}));
// ---- What the Dungeon Master is offered and told ----
let choices=r.dmChoices(hero,g);
assert.ok(choices.some(c=>c.id==='story-advance'));assert.ok(!choices.some(c=>c.id==='story-complete'),'The tale cannot be concluded before its last chapter');
assert.deepEqual(JSON.parse(JSON.stringify(choices.filter(c=>c.id.startsWith('lead-done:')).map(c=>c.action))),[{type:'lead-done',id:'l1'},{type:'lead-done',id:'l2'}]);
assert.ok(choices.every(c=>c.label.length<=150));
const context=r.dmContext(hero,g,hp);
assert.equal(context.story.chapters,undefined,'Later chapters are not handed to the Dungeon Master');assert.equal(context.story.leads,undefined);assert.equal(context.story.title,written.title);
assert.equal(context.quest.chapter,1);assert.equal(context.quest.of,5);assert.equal(context.quest.goal,written.chapters[0].goal);assert.equal(context.quest.revealedWhenAchieved,written.chapters[0].turn);assert.equal(context.quest.next.title,'The Pass That Remembers');assert.equal(context.quest.finalChapter,false);
assert.equal(context.quest.openLeads.length,2);assert.equal(context.quest.levelEarned,false);assert.ok(context.choices.length<=30);
assert.equal(r.dmContext(hero,plain,hp).quest,undefined);
// The chips never offer to move the tale on: that is the Dungeon Master's call.
assert.ok(!r.quickActions(hero,g,hp).some(a=>/story-advance|lead-done|story-complete/.test(a.key)));
// With a crowd present the offer still fits in thirty, and the tale's own choices are kept.
const crowd=[...Array.from({length:6},(_,n)=>['A','B','C','D'].map(w=>({id:'npc-attack:n'+n+':'+w,label:'x'}))).flat(),...Array.from({length:8},(_,i)=>({id:'travel-p'+i,label:'x'})),{id:'short-rest',label:'x'},{id:'story-advance',label:'x'},{id:'lead-done:l1',label:'x'},{id:'lead-done:l2',label:'x'}];
const offered=r.offeredChoices(crowd);assert.ok(offered.length<=30);for(const id of ['story-advance','lead-done:l1','lead-done:l2','short-rest'])assert.ok(offered.some(c=>c.id===id),id+' is kept');assert.equal(offered.filter(c=>c.id.startsWith('npc-attack:')).length,6,'One attack is kept for each person');
assert.equal(r.offeredChoices(crowd.slice(0,12)).length,12);
// ---- Chapters move on one at a time ----
const say={question:'I lay the receipt on the table.',narration:'Tamsin goes pale.'};
assert.match(r.commitDmTurn(hero,g,hp,'story-complete',say,()=>.5).error,/chapters still to come|no longer available/);
let turn=r.commitDmTurn(hero,g,hp,'story-advance',say,()=>.5);assert.ok(!turn.error,turn.error);
assert.equal(turn.game.story.chapter,1);assert.match(turn.events[0],/^Chapter 1 complete: A Seal at the Gate\. A receipt shows/);assert.match(turn.events[1],/^Chapter 2 begins: The Pass That Remembers\. Reach the Shrine/);
assert.equal(turn.game.levelsOwed,undefined,'The first chapter earns no level');assert.ok(turn.game.journal.entries.some(e=>e.title==='Chapter 2: The Pass That Remembers'));assert.ok(turn.game.worldFacts.some(t=>t.includes('is finished')));
let logged=r.withStoryLog(g,turn.game,hero,{action:'story-advance'});assert.deepEqual(JSON.parse(JSON.stringify(logged.storyLog.slice(-2).map(e=>[e.kind,e.text]))),[['quest','Finished chapter 1: A Seal at the Gate.'],['story','Chapter 2: The Pass That Remembers']]);
assert.ok(valid(logged));assert.equal(r.currentGoal(logged),written.chapters[1].goal);
g=logged;const before=g;
turn=r.commitDmTurn(hero,g,hp,'story-advance',say,()=>.5);assert.equal(turn.game.story.chapter,2);assert.equal(turn.game.levelsOwed,1,'Every second chapter earns a level');assert.match(turn.events[2],/earned a level/);
g=r.withStoryLog(before,turn.game,hero,{action:'story-advance'});assert.ok(g.storyLog.some(e=>e.kind==='level'));assert.ok(valid(g));
assert.equal(r.dmContext(hero,g,hp).quest.levelEarned,true);
// ---- A level earned on the road ----
assert.equal(r.levelUpReady(g,hero),true);assert.equal(r.levelUpReady({...g,stage:'combat'},hero),false,'Not in a fight');assert.equal(r.levelUpReady({...g,levelsOwed:0},hero),false);assert.equal(r.levelUpReady({...plain,stage:'victory',enemyHP:0},hero),true,'After the main foe falls, as ever');assert.equal(r.levelUpReady(g,{...hero,level:20}),false);
const grown=r.foeForLevel(g,3);assert.equal(grown.story.foeStats.maximum,r.storyFoeStats(3,'Slashing').maximum);assert.equal(grown.enemyHP,grown.story.foeStats.maximum,'A foe not yet fought grows with the hero');
assert.equal(r.foeForLevel({...g,enemyHP:g.enemyHP-3},3).story.foeStats.maximum,g.story.foeStats.maximum,'Once the fight is joined the foe stays as it is');
assert.equal(r.foeForLevel({...g,foeFate:'slain',enemyHP:0},3).enemyHP,0);
// ---- Leads ----
turn=r.commitDmTurn(hero,g,hp,{type:'lead-done',id:'l1'},say,()=>.5);assert.ok(!turn.error,turn.error);assert.equal(turn.game.story.leads[0].done,true);assert.equal(turn.events[0],'Lead seen through: The Copyist\'s Debt.');
const led=r.withStoryLog(g,turn.game,hero,{action:{type:'lead-done',id:'l1'}});assert.equal(led.storyLog.at(-1).text,'Saw a lead through: The Copyist\'s Debt.');assert.ok(valid(led));
assert.ok(r.commitDmTurn(hero,led,hp,{type:'lead-done',id:'l1'},say,()=>.5).error,'A lead is closed once');
assert.deepEqual(JSON.parse(JSON.stringify(r.dmContext(hero,led,hp).quest.leadsSeenThrough)),['The Copyist\'s Debt']);assert.equal(r.dmChoices(hero,led).filter(c=>c.id.startsWith('lead-done:')).length,1);
// ---- The last chapter ends the tale ----
g=led;for(let i=0;i<2;i++){const next=r.commitDmTurn(hero,g,hp,'story-advance',say,()=>.5);assert.ok(!next.error,next.error);g=r.withStoryLog(g,next.game,hero,{});}
assert.equal(g.story.chapter,4);assert.equal(g.levelsOwed,2);assert.equal(r.questState(g).last,true);
choices=r.dmChoices(hero,g);assert.ok(choices.some(c=>c.id==='story-complete'));assert.ok(!choices.some(c=>c.id==='story-advance'));
assert.ok(r.adventureStep(g,hp,hero,'story-advance',()=>.5).error);
turn=r.commitDmTurn(hero,g,hp,'story-complete',say,()=>.5);assert.equal(turn.game.story.status,'complete');assert.ok(valid(turn.game));
// ---- The next tale in the same region keeps both stories' lands apart ----
const second=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(written)),id:'saga-2',title:'The Second Winter',region:'Hollow Vale',locations:{inn:{name:'Greywater',description:'A mill town.',kind:'settlement'},bridge:{name:'The Weir',description:'A broken weir.',kind:'water'},tower:{name:'Ash Chapel',description:'A burned chapel.',kind:'ruin'}},npcs:{keeper:person('Odda Fenn','woman'),mara:person('Bram Tull','man')},landmarks:written.landmarks.slice(0,2).map(l=>({...l,name:'New '+l.name}))},r.newAdventure(hero));
const joined=r.joinRegion(second,turn.game,{sameRegion:true,bearing:'N',miles:5});
const ids=joined.world.regions.map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'Region ids stay unique');assert.ok(ids.length>=3);assert.ok(joined.world.regions.some(x=>x.name==='Veyr'),'The earlier country is a land of its own');
assert.ok(joined.world.places.length<=r.maxWorldPlaces);assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(joined)),null,true),hero),'The joined tale saves');
assert.equal(joined.story.chapter,0);
// A level earned and not yet taken stays earned when the next tale begins.
const carried=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(written)),id:'saga-3',title:'A Third Tale'},r.newAdventure(hero,r.carriedBase(turn.game)));assert.equal(carried.levelsOwed,2);assert.ok(valid(carried));
console.log('Passed: a long tale starts with its chapters, leads, six landmarks and far lands (days away, each its own map); the Dungeon Master is told only the chapter under way and is offered moving on, never an early ending; chapters advance one at a time with what they reveal, a level is earned every second chapter and can be taken on the road, a foe not yet fought grows with the hero, leads close once, the last chapter ends the tale, the next tale keeps both stories\' lands apart, and stories without chapters play as before.');
