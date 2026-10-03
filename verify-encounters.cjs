const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Fights out in the wilds: a lair's creature waiting at a found place, a risky place's ambush on first arrival, the
// DM springing a creature, fleeing and returning, falling there; every monster's signature move; companions who fight
// beside the hero, can be knocked down, and drag a dying hero to safety.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','iconPaths.js','quickActions.js','pregens.js','worldArtRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmContext,validAdventure,adventureSnapshot,mapLocation,recordedTurn,storyText,creatureArtSubject,foeHitExtras,undeadFortitude,shieldBlow,foeRoundMoves,foeAttackMode,startWildFight,quickActions})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const kara=r.readyHero('fighter'),hp={current:12,temp:0},big={current:60,temp:0};
const valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
const seq=list=>{let i=0;return ()=>list[i++%list.length];};
let camp={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),stage:'inn'};delete camp.openingAttackAvailable;
const storyHP=camp.enemyHP;
// ---- A lair: the creature waits there ----
const lair={name:'Widow Hollow',description:'A dripping hollow strung with grey silk and the husks of deer.',kind:'cave',bearing:'E',miles:1,travel:true,danger:'lair',feature:'A half-buried satchel lies under the webs.',lair:{template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled, with a pale cross on its back.'}};
let found=r.adventureStep(camp,big,kara,{type:'discover',place:lair,travel:true},()=>0.5);
assert.equal(found.error,undefined);assert.equal(found.game.stage,'combat');assert.equal(found.game.wildFight.name,'Grey Widow');assert.equal(found.game.wildFight.storyFoeHP,storyHP);
assert.equal(r.mapLocation(found.game),'p1');assert.equal(found.game.world.places[0].feature,'A half-buried satchel lies under the webs.');assert.ok(found.events.some(t=>t.startsWith('A Grey Widow bursts out at Widow Hollow!')));
assert.ok(valid(found.game));assert.equal(r.creatureArtSubject(found.game).name,'Grey Widow');
assert.equal(r.dmContext(kara,found.game,big).encounter.name,'Grey Widow');assert.equal(r.dmContext(kara,found.game,big).encounter.signatureMove.name,'Web');
// Win: back at the place, the story's foe untouched, the lair cleared.
let g=found.game,h=big,last;for(let i=0;i<30&&g.stage==='combat';i++){last=r.adventureStep(g,h,kara,'attack:Greatsword',()=>0.75);g=last.game;h=last.health;}
assert.equal(g.stage,'wild');assert.equal(g.wildFight,undefined);assert.equal(g.enemyHP,storyHP);assert.equal(g.foeFate,undefined);assert.equal(g.world.places[0].cleared,true);assert.equal(g.world.places[0].threat,undefined);
assert.ok(last.events.includes('The Grey Widow is slain.'));assert.ok(!last.events.some(t=>/wisp|crossing/.test(t)));assert.ok(valid(g));
assert.ok(g.journal.entries.some(e=>e.title==='Defeated Grey Widow'));
const turn=r.recordedTurn(kara,last.game===g?found.game:found.game,big,{...last,game:g},{question:'I attack.',narration:'It dies.'});
// ---- Fleeing, and coming back to it ----
let fled=r.adventureStep(found.game,big,kara,'flee',()=>0.5);
assert.equal(fled.game.stage,'inn');assert.equal(fled.game.world.places[0].threat.hp,found.game.enemyHP);assert.ok(fled.events.some(t=>t.startsWith('You flee from the Grey Widow back toward Caravan Camp')));assert.ok(valid(fled.game));
const back=r.adventureStep(fled.game,fled.health,kara,{type:'travel',destination:'p1'},()=>0.5);assert.equal(back.game.stage,'combat');assert.equal(back.game.enemyHP,found.game.enemyHP,'It still bears its wounds');
// ---- A risky place: an ambush on first arrival, sometimes ----
const risky={...lair,name:'Bramble Track',description:'A deer track tunnelling through thick brambles.',kind:'forest',danger:'risky',lair:null,feature:null};
assert.equal(r.adventureStep(camp,big,kara,{type:'discover',place:risky,travel:true},()=>0.9).game.stage,'wild','No ambush this time');
const ambushed=r.adventureStep(camp,big,kara,{type:'discover',place:risky,travel:true},seq([0.1,0]));assert.equal(ambushed.game.stage,'combat');assert.ok(valid(ambushed.game));
assert.equal(r.adventureStep(camp,big,kara,{type:'discover',place:{...risky,danger:'safe'},travel:true},()=>0).game.stage,'wild','Safe places are safe');
// ---- The DM springs a creature ----
const out=r.adventureStep(camp,big,kara,{type:'discover',place:{...risky,danger:'safe'},travel:true},()=>0).game;
const sprung=r.commitDmTurn(kara,out,big,{type:'ambush',foe:{template:'boar',name:'Tusked Brute',appearance:'A boar with tusks like sickles and a hide like old bark.'}},{question:'I kick the sleeping boar.',narration:'It wakes, furious.'},()=>0.5);
assert.equal(sprung.error,undefined);assert.equal(sprung.game.wildFight.name,'Tusked Brute');assert.equal(sprung.game.openingAttackAvailable,true);
assert.match(r.adventureStep(camp,big,kara,{type:'ambush',foe:{template:'boar',name:'Tusked Brute',appearance:'x x x'}},()=>0.5).error,/out in the wilds/);
assert.equal(r.dmContext(kara,out,big).world.canAmbush,true);assert.equal(r.dmContext(kara,camp,big).world.canAmbush,false);
// ---- Falling out there ----
const doomed=r.adventureStep({...found.game,openingAttackAvailable:false,potions:0,resources:{wind:2}},{current:1,temp:0},kara,'dodge',()=>0.9);
assert.equal(doomed.game.stage,'dying');assert.equal(doomed.game.dying.place,'wild');assert.equal(r.mapLocation(doomed.game),'p1');assert.equal(doomed.game.wildFight,undefined);assert.ok(doomed.game.world.places[0].threat);assert.ok(valid(doomed.game,doomed.health));
// ---- Signature moves ----
const kinds=key=>({...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>[ 'bandit','wolf','goblin','skeleton','boar','spider','zombies','orc','wolves'].indexOf(key)/9+0.01),openingAttackAvailable:false});
const foe=g=>({name:g.story.foe,saves:g.story.foeStats.saves,ac:g.story.foeStats.ac});
const boar=kinds('boar');let x=r.foeHitExtras(boar,kara,foe(boar),1,()=>0.5);assert.equal(x.extra,8);assert.ok(x.note.includes('Charge 2d6'));assert.equal(r.foeHitExtras(x.game,kara,foe(boar),1,()=>0.5).extra,0,'Charge once a fight');
const wolf=kinds('wolf');x=r.foeHitExtras(wolf,kara,foe(wolf),1,()=>0);assert.equal(x.game.heroCondition,'prone');assert.equal(r.foeAttackMode(x.game,{},1),'advantage');
const struck=r.adventureStep(x.game,big,kara,'attack:Greatsword',()=>0.5);assert.ok(struck.events.some(t=>t.startsWith('You use Greatsword: d20 [11, 11] (disadvantage)')),'Prone: your next attack has disadvantage');
const bandit={...kinds('bandit'),round:2};x=r.foeHitExtras(bandit,kara,foe(bandit),1,()=>0.5);assert.equal(x.game.heroCondition,'blinded');assert.equal(r.foeHitExtras({...bandit,round:1},kara,foe(bandit),1,()=>0.5).game.heroCondition,undefined,'Not in round 1');
const orc=kinds('orc');assert.ok(r.foeHitExtras({...orc,round:1},kara,foe(orc),1,()=>0.5).note.includes('Savage Blow'));
const goblins=kinds('goblin');assert.ok(r.foeHitExtras(goblins,kara,foe(goblins),3,()=>0.5).note.includes('Ganging Up'));assert.equal(r.foeHitExtras(goblins,kara,foe(goblins),1,()=>0.5).extra,0);
const wolves=kinds('wolves');assert.equal(r.foeAttackMode(wolves,{},2),'advantage');assert.equal(r.foeAttackMode(wolves,{},1),'normal');assert.equal(r.foeAttackMode(wolves,{},2,{dodge:true}),'normal','Advantage and Dodge cancel');
const skeleton=kinds('skeleton');x=r.shieldBlow(skeleton,9,()=>0.5);assert.equal(x.damage,5);assert.equal(r.shieldBlow(x.game,9,()=>0.5).damage,9);
const zombies={...kinds('zombies'),enemyHP:0};x=r.undeadFortitude(zombies,foe(zombies),()=>0.9);assert.equal(x.game.enemyHP,1);assert.equal(r.undeadFortitude({...x.game,enemyHP:0},foe(zombies),()=>0.9).game.enemyHP,0,'Once a fight');
const spider={...kinds('spider'),round:2};x=r.foeRoundMoves(spider,kara,foe(spider),()=>0);assert.equal(x.game.heroCondition,'restrained');assert.equal(r.foeRoundMoves(x.game,kara,foe(spider),()=>0).lines.length,0);
assert.ok(valid({...x.game,heroCondition:'restrained'}));assert.ok(!valid({...x.game,heroCondition:'stunned'}));
// ---- Companions fight beside you ----
const joined=r.commitDmTurn(kara,camp,hp,{type:'recruitment',plans:[{npcId:'mara',decision:'join',reason:'He wants to help.',terms:'Share the stew.',dc:null}]},{question:'Tobin, come with me.',narration:'He grins.',npcId:'mara'},()=>.9).game;
const together={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),followers:joined.followers,npcMemory:joined.npcMemory,openingAttackAvailable:false};
const round=r.adventureStep(together,big,kara,'attack:Greatsword',seq([0.1,0.9,0.5,0.9,0.5,0.7,0.95,0.5]));
assert.ok(round.events.some(t=>t.startsWith('Tobin Reed attacks the Bandit Cutthroat: d20')),'The companion strikes');
assert.ok(round.events.some(t=>t.startsWith('Bandit Cutthroat attacks Tobin Reed:')),'The foe turns on the companion');
let beaten=together,bh=big;for(let i=0;i<12&&(beaten.npcHP?.mara??9)>0&&beaten.stage==='combat';i++){const s=r.adventureStep(beaten,bh,kara,'dodge',seq([0,0.9,0.95,0.9]));beaten=s.game;bh=s.health;}
assert.equal(beaten.npcHP.mara,0,'A companion can be knocked down');assert.ok(valid(beaten));
// A companion beside a dying hero stops the bleeding and carries them home.
const dying=r.adventureStep({...together,openingAttackAvailable:false,potions:0,resources:{wind:2}},{current:1,temp:0},kara,'dodge',seq([0,0.1,0.99,0.99,0.5,0.5]));
if(dying.game.stage==='dying'){const aided=r.adventureStep(dying.game,dying.health,kara,'death-save',()=>0.9);assert.equal(aided.game.stage,'inn');assert.equal(aided.health.current,1);assert.ok(aided.events[0].startsWith('Tobin Reed kneels beside you'));assert.ok(aided.game.npcMemory.mara.memories.at(-1).includes('brink of death'));assert.ok(valid(aided.game,aided.health));}
else assert.fail('Setup: the hero should be dying ('+dying.game.stage+')');
// Chips and art keep up with the creature.
assert.ok(r.quickActions(kara,found.game).some(a=>a.label==='Greatsword'));
assert.equal(r.storyText(found.game,'The Grey Widow attacks with disadvantage this turn.'),'The Grey Widow attacks with disadvantage this turn.');
console.log('Passed: lairs, risky arrivals and DM ambushes, winning (story foe untouched), fleeing and returning wounded, falling in the wilds, all nine signature moves, companions striking and being struck, and a companion pulling a dying hero to safety.');
