const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Turns and rests: one action and one bonus action a turn (the turn waits for a bonus action or End turn after the
// action), a healing draught is a bonus action, and a short rest follows Baldur's Gate 3: two between long rests,
// half the hero's hit points, half of each companion's, Second Wind and a Warlock's slots back.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,readyHeroes,makeCharacter,blankBuild,introducePerson,hostileEncounterGame,newAdventure,adventureStep,dmCommand,dmContext,dmChoices,commitDmTurn,quickActions,spellActions,validAdventure,adventureSnapshot,bonusOptions,shortRestLimit,shortRestsLeft,combatBasics})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const valid=(hero,g,h)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const seq=(...v)=>{let i=0;return ()=>v[i++]??0.5;};
const kara=r.readyHero('fighter'),max=r.combatBasics(kara).hp;
const fightOf=hero=>({...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),openingAttackAvailable:false});
const camp=hero=>{const g={...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stage:'inn'};delete g.openingAttackAvailable;return g;};
// ---- At full health with nothing to use, the foe answers at once (as before) ----
let fight=fightOf(kara),full={current:max,temp:0};
let s=r.adventureStep(fight,full,kara,'dodge',()=>0.01);assert.equal(s.game.round,2);assert.equal(s.game.actionUsed,undefined);
same(r.bonusOptions(kara,fight,full,max),[]);
// ---- Hurt, with a draught and Second Wind: the turn waits ----
const hurt={current:5,temp:0};
same(r.bonusOptions(kara,fight,hurt,max).map(o=>o.id),['class:wind','potion']);
s=r.adventureStep(fight,hurt,kara,'attack:Greatsword',()=>0.5);
assert.equal(s.game.actionUsed,true);assert.equal(s.game.round,1,'The foe has not acted yet');assert.equal(s.health.current,5);
assert.ok(s.events.at(-1).startsWith('You still have a bonus action'));assert.ok(valid(kara,s.game,s.health));
assert.equal(r.dmContext(kara,s.game,s.health).turnResources.actionUsed,true);
same(r.dmChoices(kara,s.game,s.health).map(c=>c.id),['end-turn','class:wind','potion']);
for(const again of ['attack:Greatsword','dodge','flee'])assert.match(r.adventureStep(s.game,s.health,kara,again).error,/already used your action/,again);
// A bonus action after the action ends the turn: the foe then attacks.
let wind=r.adventureStep(s.game,s.health,kara,'class:wind',seq(0.5,0.01));
assert.equal(wind.error,undefined);assert.ok(wind.events[0].startsWith('Second Wind: 6 + 1; restored 7 HP.'));assert.equal(wind.game.round,2);assert.equal(wind.game.actionUsed,undefined);assert.equal(wind.game.bonusUsed,false);assert.equal(wind.game.resources.wind,1);
assert.ok(wind.events.some(t=>/^Bandit Cutthroat: d20/.test(t)),'The foe takes its turn');assert.ok(valid(kara,wind.game,wind.health));
// Or End turn, in a chip or in words.
const end=r.adventureStep(s.game,s.health,kara,'end-turn',()=>0.01);assert.equal(end.events[0],'You end your turn.');assert.equal(end.game.round,2);assert.equal(end.game.actionUsed,undefined);
same(r.dmCommand(kara,s.game,'I end my turn',s.health),{action:'end-turn'});same(r.dmCommand(kara,s.game,'done',s.health),{action:'end-turn'});
same(r.dmCommand(kara,s.game,'I use my second wind',s.health),{action:'class:wind'});
const typed=r.commitDmTurn(kara,s.game,s.health,'end-turn',{question:'I end my turn.',narration:'You brace.'},()=>0.01);assert.equal(typed.error,undefined);assert.equal(typed.game.round,2);
// Ending the turn without acting is allowed too.
const pass=r.adventureStep(fight,full,kara,'end-turn',()=>0.01);assert.equal(pass.events[0],'You hold your ground and end your turn.');assert.equal(pass.game.round,2);
// ---- A draught is a bonus action: drink, then still act; one bonus action a turn ----
let drink=r.adventureStep(fight,hurt,kara,'potion',seq(0.5,0.5));
assert.equal(drink.health.current,12);assert.equal(drink.game.round,1);assert.equal(drink.game.bonusUsed,true);assert.equal(drink.game.potions,fight.potions-1);assert.ok(!drink.events.some(t=>/uses your turn/.test(t)));
assert.match(r.adventureStep(drink.game,drink.health,kara,'class:wind').error,/bonus action is already used/);
const after=r.adventureStep(drink.game,drink.health,kara,'attack:Greatsword',()=>0.5);assert.equal(after.game.round,2,'With the bonus action spent, the action ends the turn');assert.equal(after.game.actionUsed,undefined);
assert.match(r.adventureStep(fight,full,kara,'potion').error,/full health/);assert.match(r.adventureStep(fight,full,kara,'class:wind').error,/full health/);
// A draught before the first blow leaves the opening attack in place.
const opening=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),sip=r.adventureStep(opening,hurt,kara,'potion',()=>0.5);
assert.equal(sip.game.openingAttackAvailable,true);const first=r.adventureStep(sip.game,sip.health,kara,'attack:Greatsword',()=>0.5);assert.equal(first.events[0],'Opening attack.');
// ---- Chips: bonus actions are marked, Cast… narrows to bonus spells once the action is spent ----
const borin=r.readyHero('cleric'),cfight=fightOf(borin),chp={current:4,temp:0};
same(r.bonusOptions(borin,cfight,chp,r.combatBasics(borin).hp).map(o=>o.id),['potion','spell:healing-word','spell:shield-of-faith']);
const flame=r.dmCommand(borin,cfight,'I cast Sacred Flame at the bandit',chp).action,cs=r.adventureStep(cfight,chp,borin,flame,()=>0.5);
assert.equal(cs.game.actionUsed,true);
const row=r.quickActions(borin,cs.game,cs.health);assert.equal(row[0].key,'end-turn');assert.ok(row.some(q=>q.key==='cast'));
same(r.spellActions(borin,cs.game).map(a=>a.label),['Healing Word','Shield of Faith']);assert.ok(r.spellActions(borin,cs.game).every(a=>/Bonus/.test(a.detail)));
const word=r.dmCommand(borin,cs.game,'I cast Healing Word on me',cs.health).action,healed=r.adventureStep(cs.game,cs.health,borin,word,seq(0.5,0.5,0.01));
assert.equal(healed.error,undefined);assert.ok(healed.health.current>4);assert.equal(healed.game.round,2,'The bonus spell ends the turn');
assert.match(r.adventureStep(cs.game,cs.health,borin,flame).error,/already used your action/);
// A levelled spell as the action leaves no slot for a levelled bonus spell this turn.
const inflict=r.dmCommand(borin,{...cfight,potions:0},'I cast Inflict Wounds on the bandit',{current:10,temp:0}).action,slotted=r.adventureStep({...cfight,potions:0},{current:10,temp:0},borin,inflict,()=>0.5);
assert.equal(slotted.game.round,2,'No bonus action left worth offering: full health, slot spent');
// A Monk always has a bonus strike.
const monk=r.makeCharacter({...r.blankBuild(),name:'Bo',species:'Human',class:'Monk',background:'Hermit',baseScores:[10,15,13,8,14,12],plusTwo:'Wisdom',plusOne:'Constitution',level:1,advancements:[],spellSelectionVersion:2}),mfight={...fightOf(monk),potions:0};
const mfull={current:r.combatBasics(monk).hp,temp:0},jab=r.adventureStep(mfight,mfull,monk,'attack:Spear',()=>0.5);assert.equal(jab.game.actionUsed,true);
same(r.dmChoices(monk,jab.game,jab.health).map(c=>c.id),['end-turn','class:strike']);
const flurry=r.adventureStep(jab.game,jab.health,monk,'class:strike',()=>0.5);assert.equal(flurry.error,undefined);assert.ok(flurry.events[0].startsWith('Martial Arts strike'));assert.equal(flurry.game.round,2);
// ---- Short rests ----
assert.equal(r.shortRestLimit(kara),2);assert.equal(r.shortRestLimit({class:'Bard',level:2}),3);assert.equal(r.shortRestLimit({class:'Bard',level:1}),2);
let g=camp(kara);same(r.dmCommand(kara,g,'I take a short rest',hurt),{action:'short-rest'});same(r.dmCommand(kara,g,'short rest',hurt),{action:'short-rest'});
assert.ok(r.dmChoices(kara,g,hurt).some(c=>c.id==='short-rest'&&/2 left/.test(c.label)));
const chip=r.quickActions(kara,g,hurt).find(q=>q.key==='short-rest');assert.equal(chip.label,'Short rest');assert.equal(chip.detail,'2 left');assert.equal(r.quickActions(kara,g,hurt).find(q=>q.key==='long-rest').label,'Long rest');
assert.match(r.adventureStep(g,full,kara,'short-rest').error,/nothing to recover/);
let rest=r.adventureStep({...g,resources:{wind:2}},hurt,kara,'short-rest');
assert.equal(rest.error,undefined);assert.equal(rest.health.current,5+Math.floor(max/2));assert.equal(rest.game.shortRests,1);assert.equal(rest.game.resources.wind,0);
same(rest.events,['Short rest (1 of 2).','You bind your wounds and catch your breath: restored '+Math.floor(max/2)+' HP.','Second Wind is ready again.']);assert.ok(valid(kara,rest.game,rest.health));
assert.equal(r.shortRestsLeft(kara,rest.game),1);assert.equal(r.dmContext(kara,rest.game,rest.health).shortRests.left,1);
// Never above the maximum; the second rest is the last until a long rest.
rest=r.adventureStep(rest.game,{current:max-1,temp:2},kara,'short-rest');assert.equal(rest.health.current,max);assert.equal(rest.health.temp,2);assert.equal(rest.game.shortRests,2);
assert.match(r.adventureStep(rest.game,hurt,kara,'short-rest').error,/no short rests left/);
assert.ok(!r.dmChoices(kara,rest.game,hurt).some(c=>c.id==='short-rest'));
const slept=r.adventureStep(rest.game,hurt,kara,'long-rest');assert.equal(slept.error,undefined);assert.equal(slept.game.shortRests,undefined);assert.equal(r.shortRestsLeft(kara,slept.game),2);
// A long rest restores the hero and nothing else: the places found, the people met, the pack and the story stay.
{
 const found=r.adventureStep(g,full,kara,{type:'discover',place:{name:'Drowned Chapel',description:'A sunken chapel in the reeds, its bell half under water.',kind:'ruin',bearing:'N',miles:2,danger:'safe',feature:null,lair:null},travel:false},()=>0.5).game;
 const met=r.introducePerson(found,{name:'Old Hob',species:'Human',role:'A ferryman.',appearance:'A stooped old man in a tarred coat.',personality:'Gruff.',toughness:'frail',attitude:'friendly',foe:'neutral',tie:null}).game;
 const before={...met,pack:{gold:77,items:[],spent:{}},playback:[{id:1,npcId:null,events:[{kind:'narration',text:'The camp settles.'}]}],shortRests:2,resources:{wind:2},spellSlotsUsed:[1,0,0,0,0,0,0,0,0],followers:{mara:{status:'following',location:'inn',reason:'r',terms:''}},npcHP:{mara:2}};
 assert.ok(valid(kara,before,hurt));
 const night=r.adventureStep(before,hurt,kara,'long-rest');assert.equal(night.error,undefined);
 assert.equal(night.health,null,'Back to full hit points');assert.equal(night.game.world.places.length,1,'The map keeps its places');assert.equal(Object.keys(night.game.people).length,1,'The people met are still known');
 assert.equal(night.game.pack.gold,77);assert.equal(night.game.playback.length,1,'The story so far stays on screen');assert.equal(night.game.story.title,before.story.title);
 for(const key of ['shortRests','resources','spellSlotsUsed'])assert.equal(night.game[key],undefined,key+' restored');
 assert.equal(night.game.npcHP.mara,9,'A companion at your side is whole again');assert.ok(night.events.some(t=>/Tobin Reed is rested and whole again/.test(t)));
 assert.ok(valid(kara,night.game,night.health));
}
// Not in a fight, not while down.
assert.match(r.adventureStep(fight,hurt,kara,'short-rest').error,/middle of a fight/);
assert.match(r.adventureStep(g,{current:0,temp:0},kara,'short-rest').error,/while down|dying|unconscious/i);
// A companion travelling with you rests too; someone left behind does not.
const party={...g,followers:{mara:{status:'following',location:'inn',reason:'r',terms:''},keeper:{status:'waiting',location:'inn',reason:'r',terms:''}},npcHP:{mara:2,keeper:3}};
const both=r.adventureStep(party,hurt,kara,'short-rest');assert.ok(both.game.npcHP.mara>2);assert.equal(both.game.npcHP.keeper,3);assert.ok(both.events.some(t=>/^Tobin Reed rests too: restored \d+ HP\.$/.test(t)));
// A Warlock's pact slots come back.
const lock=r.makeCharacter({...r.blankBuild(),name:'Vex',species:'Tiefling',class:'Warlock',background:'Charlatan',baseScores:[8,14,13,12,10,15],plusTwo:'Charisma',plusOne:'Constitution',spells:['blast','chill-touch','hex','armor-of-agathys'].filter(id=>true),level:1,advancements:[],spellSelectionVersion:2});
const pact=r.adventureStep({...camp(lock),spellSlotsUsed:[1,0,0,0,0,0,0,0,0],resources:{slots:1}},{current:r.combatBasics(lock).hp,temp:0},lock,'short-rest');
assert.equal(pact.error,undefined);same(pact.game.spellSlotsUsed,Array(9).fill(0));assert.ok(pact.events.includes('Your pact magic returns: spell slots restored.'));
// Through the Dungeon Master's commit, and into the story feed.
const committed=r.commitDmTurn(kara,g,hurt,'short-rest',{question:'I take a short rest.',narration:'You sit a while by the wagons.'},()=>0.5);
assert.equal(committed.error,undefined);assert.equal(committed.game.shortRests,1);
console.log('Passed: the turn waits for a bonus action or End turn after the action (and not when nothing is worth using), a draught and Second Wind are bonus actions, bonus spells and a Monk\'s strike end the turn, Dodge carries over, chips and commands follow; short rests restore half HP twice between long rests, with companions, Second Wind and pact slots.');
