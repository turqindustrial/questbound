const assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
const hero={name:'Combat QA',class:'Wizard',level:1,species:'Human',scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['acid-splash']};hero.equipment=r.equipmentFor(hero);
const game=r.newAdventure(hero),hp={current:8,temp:2};
const attack=r.dmCommand(hero,game,'I attack the keeper with my dagger',hp).action;
const sequence=values=>()=>values.length?values.shift():0;
// Opening attack misses before initiative; keeper then hits for 4 and Mara Helps before the normal player turn.
let result=r.adventureStep(game,hp,hero,attack,sequence([0,0,.9,.8,.8,.75]));
assert.equal(result.error,undefined);assert.equal(result.game.npcCombat.active,true);
assert.equal(result.health.current,6);assert.equal(result.health.temp,0);
assert.equal(result.game.npcCombat.order.length,3);assert.equal(result.game.npcHP.keeper,12);
assert.ok(result.game.log.some(t=>t.includes('keeper attacks you')));
assert.ok(result.game.log.some(t=>t.includes('Mara distracts')));
assert.equal(game.npcCombat,undefined);assert.equal(hp.current,8);
assert.ok(r.validAdventure(r.adventureSnapshot(hero,result.game,result.health,true),hero));
let saved=JSON.parse(JSON.stringify(result.game));
let next=r.adventureStep(saved,result.health,hero,'npc-wait',()=>.8);
assert.ok(next.health.current<result.health.current,'retaliation continues on later turns');
assert.equal(next.game.npcCombat.round,2);
assert.ok(r.adventureStep(saved,result.health,hero,{type:'travel',destination:'tower'}).error);
const escaped=r.adventureStep(saved,result.health,hero,'npc-flee');
assert.equal(escaped.game.stage,'bridge');assert.equal(escaped.game.npcCombat,undefined);
assert.ok(r.validAdventure(r.adventureSnapshot(hero,escaped.game,escaped.health,true),hero));
const surrendered=r.adventureStep(saved,result.health,hero,'npc-surrender');assert.equal(surrendered.game.npcCombat.active,false);
// The opening attack lands before a faster NPC can knock the player out.
result=r.adventureStep(game,{current:1,temp:0},hero,attack,sequence([.5,0,0,.99,.1,.99,.9,.9]));
assert.equal(result.health.current,0);assert.equal(result.game.npcCombat.active,false);assert.equal(result.game.npcHP.keeper,9);
// Absent/downed witnesses are excluded; established player allies defend the player.
result=r.adventureStep({...game,npcHP:{mara:0}},hp,hero,attack,()=>0);
assert.equal(result.game.npcCombat.order.length,2);
const ally={...game,npcMemory:{mara:{allegiance:'player',attitude:'indifferent',response:'Protects the player.',memories:[]}}};
result=r.adventureStep(ally,hp,hero,attack,sequence([0,0,.9,.95,.8,.75,0]));
assert.equal(result.game.npcCombat.order.find(n=>n.id==='mara').side,'ally');
assert.ok(result.game.npcHP.keeper<12);
assert.ok(r.validAdventure(r.adventureSnapshot(hero,result.game,result.health,true),hero));
// Pending spells do not begin combat. Committed hostile cantrips do, with no slot cost.
const spell=r.dmCommand(hero,game,'I cast Acid Splash on the keeper',hp).action;
const pending=r.adventureStep(game,hp,hero,spell,()=>0);assert.equal(pending.game.npcCombat,undefined);
const ruling={decision:'cast',note:'Resolve the save and damage through the engine.',damage:0,selfDamage:0,healing:0,temporaryHP:0};
result=r.commitDmTurn(hero,game,hp,{type:'ai-spell',request:spell.request,ruling},{question:'I cast Acid Splash on the keeper',narration:'Resolve the spell.'},()=>0);
assert.equal(result.error,undefined);assert.ok(result.game.npcCombat);assert.equal(result.game.spellSlotsUsed,undefined);
const invalid={...saved,npcCombat:{...saved.npcCombat,order:[{id:'fake',side:'enemy'}]}};
assert.equal(r.validAdventure(r.adventureSnapshot(hero,invalid,hp,true),hero),false);
console.log('Passed: initiative, retaliation damage/temp HP, continuing turns, Help, allies, downed exclusion, opening attack precedence, casting, escape/surrender, persistence and corrupt encounter rejection.');
