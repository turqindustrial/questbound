const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// The long tale: a story told in chapters, with leads, landmarks and lands beyond its own country; the Dungeon
// Master moves it on one chapter at a time, levels are earned along the way, and old stories play as they did.
const source=rulesSource({extra:['worldArtRules.js']});
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,freshStoryGame,validAdventure,adventureSnapshot,validStory,questState,currentGoal,levelUpReady,foeForLevel,storyFoeStats,dmChoices,offeredChoices,dmContext,commitDmTurn,adventureStep,quickActions,mapRegions,regionOfPlace,worldPlaces,travelRoute,withStoryLog,joinRegion,carriedBase,maxLandmarks,maxWorldPlaces,withExperience,heroXp,xpForLevel,truthText,taleArc,arcCut})',{AsyncStorage:{},weaponIcon:()=>'sword'});
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
assert.equal(context.quest.openLeads.length,2);assert.equal(context.quest.levelEarned,undefined);assert.equal(context.levelReady,undefined,'No level waiting');assert.ok(context.choices.length<=30);
// What the Dungeon Master reads (the stories spec, Phase A1, 2026-10-22: a chapter's answer hidden from it while it was
// asked to steer toward it meant no chapter ever closed): the chapter's truth (at most 200 characters, cut at a
// sentence) and the next chapter's title out of a fight, neither in one; the rule to tell the find where it is found.
{assert.equal(context.quest.truth,written.chapters[0].turn,'the chapter\'s truth, whole when short');
 const long='The receipt was paid from the queen\'s household. '.repeat(3)+'x'.repeat(200);assert.ok(r.truthText(long).length<=200&&r.truthText(long).endsWith('.'),'a long truth is cut at a sentence: '+r.truthText(long));
 const {sceneFor,standingPrompt}=require('./dm-server.cjs'),read=sceneFor({input:'I look around.',context:JSON.parse(JSON.stringify(context))}).context;
 assert.equal(read.quest.truth,written.chapters[0].turn,'out of a fight the model reads the truth');assert.equal(read.quest.next,'The Pass That Remembers','and the next chapter by its title');assert.equal(read.quest.revealedWhenAchieved,undefined);
 const older=JSON.parse(JSON.stringify(context));delete older.quest.truth;assert.equal(sceneFor({input:'I look around.',context:older}).context.quest.truth,written.chapters[0].turn,'a device that sends only revealedWhenAchieved');
 const fighting=sceneFor({input:'I attack.',context:{...JSON.parse(JSON.stringify(context)),stage:'combat'}}).context;assert.equal(fighting.quest?.truth,undefined,'not in a fight');assert.equal(fighting.quest?.next,undefined);
 assert.ok(standingPrompt.includes('When the player pursues the goal where it points (searches there, asks the right person, clears it), the find is certain, no check: tell the truth in that very reply')&&standingPrompt.includes('a journey or fight there is told as it falls, the find with the next move')&&standingPrompt.includes('tells that find if not yet told'),'find where found, in a reply that can select story-advance');
 // The telling of a chapter closed reads the found chapter's truth in its line, never the next chapter's (the project
 // review, 2026-10-22).
 const closing=sceneFor({input:'',context:{...JSON.parse(JSON.stringify(context)),engineResolved:['Chapter 1 complete: '+written.chapters[0].title+'. '+written.chapters[0].turn,'Chapter 2 begins.']}}).context;assert.equal(closing.quest.truth,undefined,'no next chapter\'s truth in the telling of a chapter closed');assert.equal(closing.quest.next,undefined);
 assert.equal(sceneFor({input:'',context:{...JSON.parse(JSON.stringify(context)),engineResolved:['You travel to the ford.']}}).context.quest.truth,written.chapters[0].turn,'other tellings read it as before (one cached part a chapter changes)');
 // The tale's road (quest.arc, the 2026-10-23 campaign, the host: "each pre made story should have a clearly written plot
 // line for the DM to work off of, but should be freely explorable by the player"): a line a chapter, title and goal,
 // the one under way marked (now), earlier ones (done); never a truth, the secret, the resolution or an ending; out of a
 // fight only; and the standing prompt says to steer toward it and never skip ahead.
 {const arc=context.quest.arc;assert.equal(arc.length,written.chapters.length,'a line a chapter');
  assert.equal(arc[0],'1. '+written.chapters[0].title+': '+written.chapters[0].goal+' (now)');assert.equal(arc[1],'2. '+written.chapters[1].title+': '+written.chapters[1].goal);
  const text=JSON.stringify(arc);for(const c of written.chapters)assert.ok(!text.includes(c.turn.slice(0,24)),'no chapter truth in the road: '+c.turn.slice(0,24));
  for(const hidden of [written.secret,written.resolution])assert.ok(!text.includes(hidden.slice(0,20)),'never the secret or the resolution');
  assert.deepEqual(JSON.parse(JSON.stringify(read.quest.arc)),JSON.parse(JSON.stringify(arc)),'read out of a fight');assert.equal(fighting.quest?.arc,undefined,'not in a fight');
  const on=r.taleArc({...written,chapter:2});assert.ok(on[0].endsWith(' (done)')&&on[1].endsWith(' (done)')&&on[2].endsWith(' (now)')&&!on[3].endsWith(')'),'earlier chapters done, the one under way now');
  assert.equal(r.taleArc({...written,chapters:written.chapters.slice(0,1)}),null,'a tale of one chapter has no road');
  const cut=r.arcCut('A very long goal that keeps going '.repeat(8),120);assert.ok(cut.length<=120&&cut.endsWith('…')&&!/\s…$/.test(cut),'cut at a word: '+cut);
  assert.ok(r.taleArc({...written,chapters:written.chapters.map(c=>({...c,title:'T'.repeat(90),goal:'word '.repeat(60)}))}).every(l=>l.length<=200),'titles to 60 and goals to 120');
  assert.ok(standingPrompt.includes('quest.arc: the road the tale means to take; steer toward (now), never tell, skip to or count as reached a later chapter; the player may wander anywhere.'),'steer toward the chapter under way');}
 assert.ok(!standingPrompt.includes('Pace it like a campaign'),'paced by the tale\'s length');}
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
assert.equal(turn.game.levelsOwed,undefined,'Chapters no longer owe levels');assert.ok(turn.game.journal.entries.some(e=>e.title==='Chapter 2: The Pass That Remembers'));assert.ok(turn.game.worldFacts.some(t=>t.includes('is finished')));
// Experience is worked out after the turn (Adventure.act): a chapter finished is worth a share of the level.
const gain=(a,b)=>r.withExperience(a,b,hero,{}).game;
let logged=r.withStoryLog(g,gain(g,turn.game),hero,{action:'story-advance'});assert.deepEqual(JSON.parse(JSON.stringify(logged.storyLog.slice(-3).map(e=>[e.kind,e.text]))),[['quest','Finished chapter 1: A Seal at the Gate.'],['story','Chapter 2: The Pass That Remembers'],['level','Ready for level 2.']]);
assert.ok(logged.xp>r.xpForLevel(1)&&logged.xp>=r.xpForLevel(2),'The first chapter is worth level 2 to a new hero');
assert.ok(valid(logged));assert.equal(r.currentGoal(logged),written.chapters[1].goal);
g=logged;const before=g;
turn=r.commitDmTurn(hero,g,hp,'story-advance',say,()=>.5);assert.equal(turn.game.story.chapter,2);assert.equal(turn.game.levelsOwed,undefined);assert.ok(!turn.events.some(t=>/earned a level/.test(t)),'The engine no longer hands out levels');
g=r.withStoryLog(before,gain(before,turn.game),hero,{action:'story-advance'});assert.ok(g.storyLog.some(e=>e.kind==='level'));assert.ok(valid(g));assert.ok(g.xp>before.xp&&g.xp<r.xpForLevel(3),'More experience, but never two levels waiting');
assert.equal(r.dmContext(hero,g,hp).levelReady,true);assert.equal(r.dmContext(hero,g,hp).quest.levelEarned,undefined);
// ---- A level earned on the road ----
assert.equal(r.levelUpReady(g,hero),true);assert.equal(r.levelUpReady({...g,stage:'combat'},hero),false,'Not in a fight');assert.equal(r.levelUpReady({...g,xp:undefined},hero),false);assert.equal(r.levelUpReady({...plain,stage:'victory',enemyHP:0,xp:0},hero),false,'A win alone no longer grants a level');assert.equal(r.levelUpReady({...plain,stage:'victory',enemyHP:0},hero),true,'An old save at victory keeps its level');assert.equal(r.levelUpReady({...plain,levelsOwed:1},hero),true,'An old owed level still counts');assert.ok(valid({...plain,levelsOwed:2}));assert.equal(r.levelUpReady(g,{...hero,level:20}),false);
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
assert.equal(g.story.chapter,4);assert.equal(g.levelsOwed,undefined);assert.equal(r.questState(g).last,true);
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
const carried=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(written)),id:'saga-3',title:'A Third Tale'},r.newAdventure(hero,r.carriedBase(turn.game)));assert.ok(Number.isInteger(turn.game.xp));assert.equal(carried.xp,turn.game.xp,'Experience carries into the next tale');assert.ok(valid(carried));
const oldCarried=r.newAdventure(hero,r.carriedBase({...turn.game,xp:undefined,levelsOwed:2}));assert.equal(oldCarried.levelsOwed,2,'An old save keeps its owed levels');assert.equal(r.heroXp(oldCarried,hero),r.xpForLevel(3));
const pendingChecks=[];
// ---- The errand closes where it is found (the stories spec, Phase A3, 2026-10-22) ----
// A tale with an errand closes chapter 1 once the errand's place is cleared: in the very step that wins the lair, so the
// telling of the fight's end (a device's preview, the campaign server's) already holds the find ("Chapter 1 complete:
// … <the chapter's truth>"); the reward stays owed (rewardDue) until keeper hands it over when the hero next speaks with
// them, and no longer waits for the hero to report back and the Dungeon Master to move the tale on.
{const {journeyStory}=require('./journey-fixtures.cjs'),e=vm.runInNewContext(rulesSource()+'\n({readyHero,newAdventure,freshStoryGame,adventureStep,settleTurn,dmChoices,dmContext,validAdventure,adventureSnapshot,errandFound,withErrandReward,npcScene})',{AsyncStorage:{}});
 const kara=e.readyHero('fighter'),plainOf=v=>JSON.parse(JSON.stringify(v)),story={...journeyStory(0),errand:{...journeyStory(0).errand,reward:'30 gold, paid by the reeve'}};
 let g=plainOf(e.freshStoryGame(kara,story,e.newAdventure(kara)));g={...g,map:{...g.map,accepted:true}};
 const lair=g.story.errand.place,go=e.dmChoices(kara,g,null).find(c=>c.action?.type==='travel'&&c.action.destination===lair);assert.ok(go,'the errand\'s place is a journey on offer');
 let h=null,s=e.settleTurn({hero:kara,game:g,health:h,action:go.action,random:()=>.99});assert.equal(s.result.game.stage,'combat','the lair\'s creature waits');assert.equal(s.result.game.story.chapter,0,'no find before the lair is won');
 g=s.result.game;h=s.result.health;let won=null;
 for(let i=0;i<12&&g.stage==='combat';i++){const a=e.dmChoices(kara,g,h).find(c=>/^attack:/.test(c.id)).action;const preview=e.adventureStep(g,h,kara,a,()=>.95);s=e.settleTurn({hero:kara,game:g,health:h,action:a,random:()=>.95});assert.equal(s.error,undefined,s.error);
  if(s.result.game.stage!=='combat'){won=s;assert.ok(preview.events.some(t=>/^Chapter 1 complete: /.test(t)),'the preview a device tells from holds the find');}g=s.result.game;h=s.result.health;}
 assert.ok(won,'the lair is won');assert.equal(g.story.chapter,1,'chapter 1 closed at the cleared place');
 assert.ok(won.result.events.some(t=>t.startsWith('Chapter 1 complete: ')&&t.includes(story.chapters[0].turn)),'its truth is told there');assert.ok(won.result.events.some(t=>/Chapter 1 finished/.test(t)),'and paid in experience');
 assert.equal(g.story.errand.rewardDue,true,'the reward is owed');assert.ok(e.validAdventure(e.adventureSnapshot(kara,plainOf(g),h,true),kara),'the save is valid');
 assert.equal(e.errandFound(g),false,'once only');assert.equal(e.adventureStep(g,h,kara,'short-rest',()=>.5).game?.story?.chapter??1,1);
 // What the Dungeon Master reads: the errand's reward while owed, after chapter 1.
 {const {sceneFor}=require('./dm-server.cjs'),c=plainOf(e.dmContext(kara,g,h));assert.equal(c.story.errand.rewardDue,true);const read=sceneFor({input:'I look around.',context:c}).context;
  assert.equal(read.story.errand.rewardDue,true,'the owed reward is read after chapter 1');assert.equal(read.story.errand.reward,'30 gold, paid by the reeve');assert.equal(read.story.errand.task,undefined);}
 // The reward handed over by keeper (here) settles it; loot from anyone else, or none, does not.
 const keeperHere=plainOf({...g,world:{...g.world,at:'inn'},stage:'inn'});assert.ok(e.npcScene(keeperHere).some(n=>n.id==='keeper'&&n.present),'keeper is at the inn');
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{loot:null}).story.errand.rewardDue,true);
 assert.equal(e.withErrandReward(g,g,{loot:{gold:30,items:[],reason:'x'}}).story.errand.rewardDue,true,'not paid where keeper is not');
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{loot:{gold:30,items:[],reason:'The reward.'}}).story.errand.rewardDue,undefined,'paid');
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{npcId:'keeper',loot:{gold:30,items:[],reason:'For the road.'}}).story.errand.rewardDue,undefined,'handed over by keeper in a talk with them');
 // A purchase, a gift from someone else or a find while keeper is about is not the reward (the project review, 2026-10-22).
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{npcId:'keeper',loot:{gold:-50,items:[{name:'Potion of Healing',kind:'potion',qty:1,value:0,note:'A draught.'}],reason:'A draught bought from the keeper.'}}).story.errand.rewardDue,true,'a purchase is not the reward');
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{npcId:'mara',loot:{gold:0,items:[{name:'Charm',kind:'gear',qty:1,value:0,note:'A charm.'}],reason:'A gift from Tobin.'}}).story.errand.rewardDue,true,'a gift from someone else is not');
 assert.equal(e.withErrandReward(keeperHere,keeperHere,{npcId:null,loot:{gold:12,items:[],reason:'Coins found in the straw.'}}).story.errand.rewardDue,true,'a find is not');
 assert.equal(e.withErrandReward(keeperHere,{...keeperHere,npcFate:{keeper:'dead'}},null).story.errand.rewardDue,undefined,'never paid by the dead');
 // The game pays the promised purse itself when the reply speaking with keeper hands over nothing (dm-replies.cjs errandPaidTurn).
 {const {errandPaidTurn}=require('./dm-replies.cjs'),c=plainOf(e.dmContext(kara,keeperHere,h));
  assert.equal(errandPaidTurn(c),false,'not without speaking to keeper');assert.equal(errandPaidTurn({...c,conversationWith:{id:'keeper'}}),true,'speaking with keeper: paid');
  assert.equal(errandPaidTurn({...c,conversationWith:{id:'keeper'},engineResolved:['You take a short rest.']}),false,'not in a telling');
  // That turn's note says so (the project review, 2026-10-22: no note named the reward), one item may carry magic (its
  // chapter's "Chapter 1 complete" was told with the lair's fall, where no loot can be), and the game pays the purse
  // itself only when the telling hands the reward over.
  const {clampedLoot}=require('./dm-replies.cjs'),talk={...c,conversationWith:{id:'keeper'},nearbyNPCs:[...(c.nearbyNPCs??[]).filter(n=>n.id!=='keeper'),{id:'keeper',name:'keeper'}]};
  const cloak={gold:30,items:[{name:'Grey cloak',kind:'gear',qty:1,value:0,note:'A cloak.',magic:'cloak-of-protection'}],reason:'The promised reward.'};
  assert.equal(clampedLoot(cloak,talk).loot.items[0].magic,'cloak-of-protection','a magic reward on the payment turn');assert.equal(clampedLoot(cloak,{...talk,conversationWith:{id:'mara'}}).loot.items[0].magic,null,'not elsewhere');
  pendingChecks.push((async()=>{const {generate,requestParts}=require('./dm-server.cjs');let asked=null;const reply=o=>async(u,opt)=>{asked=JSON.parse(opt.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({narration:'x',dialogue:[],effects:[],suggestions:[],...o})}]}]})};};
  const road=await generate({input:'Captain, which road is safest?',context:talk},{apiKey:'k',model:'m',fetchImpl:reply({narration:'She taps the map.',dialogue:[{speakerId:'keeper',text:'The river road.'}]})});
  assert.match(requestParts(asked).tail??'',/ERRAND REWARD: .*keeper hands over the promised reward \(30 gold, paid by the reeve\) in this reply/,'the turn\'s note names the reward');assert.equal(road.loot,null,'a telling that hands nothing over pays nothing');
  const purse=await generate({input:'I am back.',context:talk},{apiKey:'k',model:'m',fetchImpl:reply({narration:'She counts the promised gold into your palm.',dialogue:[]})});assert.equal(purse.loot?.gold,30,'the purse the telling hands over is paid');})());}
 // A save stalled with its place already cleared closes the chapter at its next move.
 {let stalled=plainOf(e.freshStoryGame(kara,story,e.newAdventure(kara)));stalled={...stalled,map:{...stalled.map,accepted:true},world:{...stalled.world,places:stalled.world.places.map(p=>p.id===lair?(({threat,...rest})=>({...rest,cleared:true}))(p):p)}};
  const moved=e.adventureStep(stalled,null,kara,e.dmChoices(kara,stalled,null).find(c=>c.action?.type==='travel').action,()=>.5);assert.equal(moved.game.story.chapter,1,'a stalled save moves on');
  assert.equal(moved.game.story.errand.rewardDue,undefined,'owing nothing: its keeper may already have paid while it stalled');}
 // A tale written with staging of its own (Phase B) is left to it; a tale without an errand is untouched.
 {const staged=plainOf({...g,story:{...g.story,chapter:0,staging:{}}});assert.equal(e.errandFound(staged),false);}
}
Promise.all(pendingChecks).then(()=>console.log('Passed: a long tale starts with its chapters, leads, six landmarks and far lands (days away, each its own map); the Dungeon Master is told only the chapter under way and is offered moving on, never an early ending; chapters advance one at a time with what they reveal, each chapter is worth experience and a level can be taken on the road, a foe not yet fought grows with the hero, leads close once, the last chapter ends the tale, the next tale keeps both stories\' lands apart, and stories without chapters play as before.')).catch(e=>{console.error(e);process.exit(1);});
