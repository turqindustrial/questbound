const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// The Log: one short line for every thing that matters in the hero's story (places reached and found, people met,
// fights and how they ended, deaths, debts and grudges, gold and finds, rests, levels, the end of the tale), worked
// out from the game itself turn by turn, kept in the save, carried into the next chapter.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,validAdventure,adventureSnapshot,freshStoryGame,joinRegion,carriedBase,resolveRecruitment,withAttackIntent,storyEvents,withStoryLog,appendStoryLog,validStoryLog,storyLogKinds,maxStoryLog})',{AsyncStorage:{}});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
// A turn through the engine, with the log kept the way the game keeps it.
const turn=(g,action,{health=hp,random=()=>0.5,words=null}={})=>{const s=words?r.commitDmTurn(kara,g,health,action,words,random):r.adventureStep(g,health,kara,action,random);assert.equal(s.error,undefined,JSON.stringify(action)+': '+s.error);return {...s,game:r.withStoryLog(g,s.game,kara,{action})};};
const texts=g=>g.storyLog.map(e=>e.text),last=(g,n=1)=>texts(g).slice(-n);
// ---- A new tale opens the log ----
let fight=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0);
same(fight.storyLog,[{id:1,kind:'story',text:fight.story.title+': the tale began at Caravan Camp.'}]);assert.ok(valid(fight));
let g={...fight,stage:'inn'};delete g.openingAttackAvailable;
// ---- Places: heard of, found, reached, returned to ----
g=turn(g,{type:'discover',place:{name:'Smokewood Hut',description:'A woodcutter\'s hut in the northern hills.',kind:'settlement',bearing:'N',miles:2.5,danger:'safe'},travel:false}).game;
same(last(g),['Learned of Smokewood Hut, 2.5 miles from Caravan Camp.']);
g=turn(g,{type:'travel',destination:'p1'}).game;same(last(g),['Reached Smokewood Hut for the first time.']);
g=turn(g,{type:'travel',destination:'inn'}).game;same(last(g),['Returned to Caravan Camp.']);
g=turn(g,{type:'discover',place:{name:'Gallows Ford',description:'A shallow river crossing under a leaning gibbet.',kind:'water',bearing:'E',miles:1,danger:'safe'},travel:true}).game;same(last(g),['Found Gallows Ford.']);
// ---- People: met, joined, won over, killed, a grudge sworn ----
const meeting=turn(g,null,{words:{question:'I hail the ferryman.',narration:'A man looks up from his nets.',introduce:{name:'Harlan Voss',species:'Dwarf',role:'A ferryman who works the ford alone.',appearance:'A broad, grey-bearded dwarf in a tarred coat.',personality:'Terse.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null,gender:'man',regard:{stance:'curious',reason:'He has ferried few sellswords.'}}}});
g=meeting.game;same(last(g),['Met Harlan Voss, a ferryman.']);
g=turn(g,null,{words:{question:'I give Harlan my rations and mend his net.',narration:'He nods slowly.',relationships:[{npcId:'n1',change:'grateful',memory:'The fighter mended my net and fed me.'}],loot:{gold:-5,items:[{name:'Ferry token',kind:'quest',qty:1,value:0,note:'A stamped lead disc: one free crossing.'}],reason:'A trade.'}}}).game;
same(last(g,3),['You won Harlan Voss over.','Paid 5 gold.','Got Ferry token.']);
g=turn(g,{type:'travel',destination:'inn'}).game;
const joined=r.resolveRecruitment(kara,g,hp,[{npcId:'mara',decision:'join',reason:'He wants to see the world.',terms:'He cooks.',dc:null}],'Tobin, come with me.',null,()=>0.5);
g=r.withStoryLog(g,joined.game,kara,{});same(last(g),['Tobin Reed joined you.']);
const murder=turn({...g,followers:undefined},{type:'npc-attack',target:'keeper',weapon:'Greatsword'},{random:()=>0.99});
assert.ok(texts(murder.game).includes('You killed Captain Oona Brask.'));assert.ok(texts(murder.game).some(t=>/^A fight broke out/.test(t))||texts(murder.game).includes('Tobin Reed swore never to forgive you.'),texts(murder.game).slice(-4).join(' | '));
// ---- Fights: begun, won, fled, lost ----
let f=fight,h={current:60,temp:0};const before=f;
for(let i=0;i<80&&f.stage==='combat';i++){const s=turn(f,f.actionUsed?'end-turn':'attack:Greatsword',{health:h,random:()=>0.7});f=s.game;h=s.health;}
assert.equal(f.stage,'victory');assert.ok(texts(f).includes('Slew the Bandit Cutthroat.'),texts(f).join(' | '));assert.ok(valid(f));
assert.equal(texts(f).filter(t=>/Slew/.test(t)).length,1,'Once, however many rounds it took');
const ran=turn(before,'flee',{random:()=>0.99});assert.ok(texts(ran.game).includes('Fled from the Bandit Cutthroat.'));assert.ok(!texts(ran.game).some(t=>/^(Returned|Reached)/.test(t)),'Running is not a journey');
let d=before,dh={current:1,temp:0};for(let i=0;i<40&&d.stage==='combat';i++){const s=turn(d,d.actionUsed?'end-turn':'dodge',{health:dh,random:()=>0.99});d=s.game;dh=s.health;}
assert.ok(['dying','dead'].includes(d.stage));assert.ok(texts(d).some(t=>/^Fell to the Bandit Cutthroat\.$/.test(t)),texts(d).join(' | '));
for(let i=0;i<12&&d.stage==='dying';i++){const s=turn(d,'death-save',{health:dh,random:()=>0.05});d=s.game;dh=s.health;}
assert.equal(d.stage,'dead');assert.match(texts(d).at(-1),/^Died at /);assert.ok(valid(d,dh));
// A fight that starts on arrival: the place, then the fight.
const lair=turn({...g,followers:undefined},{type:'discover',place:{name:'Widow Hollow',description:'A dripping hollow strung with grey silk.',kind:'cave',bearing:'S',miles:1,danger:'lair',feature:null,lair:{template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled.'}},travel:true});
same(last(lair.game,2),['Found Widow Hollow.','Fought the Grey Widow at Widow Hollow.']);
// ---- Rests, the end of the tale, levels ----
const hurt={...g,stage:'inn'};
const rested=turn(hurt,'short-rest',{health:{current:3,temp:0}});same(last(rested.game),['Took a short rest at Caravan Camp.']);
const slept=turn(hurt,'long-rest',{health:{current:3,temp:0}});same(last(slept.game),['Took a long rest at Caravan Camp.']);
const done={...f,story:{...f.story,status:'complete'}};assert.ok(r.storyEvents(f,done,kara,{}).some(([kind,text])=>kind==='quest'&&text==='Adventure complete: '+f.story.title+'.'));
// Someone cooling toward the hero is worth a line too.
const cooled=turn(g,null,{words:{question:'I call Harlan a liar.',narration:'His face closes.',relationships:[{npcId:'n1',change:'angered',memory:'The fighter called me a liar at my own ford.'}]}});
same(last(cooled.game),['Harlan Voss turned cold toward you.']);
// Nothing happened: nothing is written.
same(r.storyEvents(g,g,kara,{}),[]);same(r.storyEvents(g,{...g,log:['x',...g.log]},kara,{}),[]);
const chat=turn(g,null,{words:{question:'I ask about the weather.',narration:'It will rain.'}});assert.equal(chat.game.storyLog.length,g.storyLog.length);
// A turn taken back takes its lines with it (the log is part of the state the turn started from).
assert.equal(g.storyLog.length<lair.game.storyLog.length,true);
// ---- Kept in the save, bounded, carried into the next chapter ----
assert.ok(r.validStoryLog(g.storyLog));assert.ok(!r.validStoryLog([{id:2,kind:'travel',text:'x'},{id:1,kind:'travel',text:'y'}]));assert.ok(!r.validStoryLog([{id:1,kind:'gossip',text:'x'}]));assert.ok(!r.validStoryLog([{id:1,kind:'travel',text:''}]));
let long=[];for(let i=0;i<r.maxStoryLog+25;i++)long=r.appendStoryLog(long,'travel','Step '+i+'.');assert.equal(long.length,r.maxStoryLog);assert.equal(long.at(-1).text,'Step '+(r.maxStoryLog+24)+'.');assert.ok(r.validStoryLog(long));
assert.equal(r.appendStoryLog([],'travel','x'.repeat(400))[0].text.length,150);same(r.appendStoryLog([],'gossip','x'),[]);
for(const e of g.storyLog){assert.ok(r.storyLogKinds.includes(e.kind));assert.ok(e.text.length<=150&&/[.!?]$/.test(e.text),e.text);}
const story2={...g.story,id:'s2',title:'The Salt Road',status:'active',locations:{inn:{name:'Saltmere',description:'A salt-pan village on stilts.'},bridge:{name:'The Drowned Causeway',description:'A sunken stone road.'},tower:{name:'Gull Tower',description:'A leaning lighthouse.'}},npcs:{keeper:{...g.story.npcs.keeper,name:'Ysolde Fenn'},mara:{...g.story.npcs.mara,name:'Pim Ashdown'}}};delete story2.openingDialogue;delete story2.geography;
const next=r.joinRegion(r.freshStoryGame(kara,story2,r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion:true,bearing:'N',miles:5});
assert.equal(next.storyLog.length,g.storyLog.length+1);same(last(next),['The Salt Road: a new chapter began at Saltmere.']);assert.equal(next.storyLog.at(-1).kind,'story');assert.ok(valid(next,null));
same(last(r.joinRegion(r.freshStoryGame(kara,story2,r.newAdventure(kara,r.carriedBase(g))),g,{sameRegion:false})),['The Salt Road: a new tale began, far away, at Saltmere.']);
console.log('Passed: the log opens with the tale and gains one short line for each place heard of, found, reached or returned to, each person met, joined, won over or killed, each fight begun and how it ended, deaths, gold and finds, rests and the end of the tale; nothing for small talk; it is bounded, guarded in saves and carried into the next chapter.');
