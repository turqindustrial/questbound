const assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
const hero={name:'Target tester',class:'Wizard',species:'Human',level:3,scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['fire-bolt','shock','blur']};hero.equipment=r.equipmentFor(hero);
const game=r.newAdventure(hero),hp={current:r.combatBasics(hero).hp,temp:0};
let command=r.dmCommand(hero,game,'stab them',hp,'mara');
assert.equal(command.action.target,'mara');assert.equal(command.action.weapon,'Dagger');
let result=r.commitDmTurn(hero,game,hp,command.action,{question:'stab them',normalizedCommand:command.normalizedCommand,narration:'You lunge at Mara.'},()=>0);
assert.equal(result.error,undefined);assert.ok(result.events.some(t=>t.startsWith('You use Dagger')&&t.includes('(normal)')));
assert.equal(r.dmCommand(hero,result.game,'hit them',result.health).action.target,'mara','Continue attacking the same conscious opponent');
assert.ok(r.dmCommand(hero,game,'stab them',hp).error,'Two bystanders without context require a target');
assert.equal(r.dmCommand(hero,{...game,npcHP:{keeper:0}},'stab them',hp,'keeper').action.target,'mara','Never select an unconscious conversation target');
const combat={...game,stage:'combat'};
assert.equal(r.dmCommand(hero,combat,'stab it',hp).action.type,'encounter-attack');
for(const [id,distance,expected,target] of [['fire-bolt',5,'disadvantage',{}],['fire-bolt',30,'normal',{}],['shock',5,'normal',{}],['fire-bolt',5,'normal',{incapacitated:true}],['fire-bolt',5,'normal',{canSeeAttacker:false}]]){
 const cast=r.requestSpell(hero,{...combat,castingConditions:{targetDistance:distance}},hp,hp.current,{id,slot:0,componentsConfirmed:true,intent:'Cast at the wisp.'},()=>0,{ac:11,...target});
 assert.equal(cast.error,undefined);assert.ok(cast.logs.some(t=>t.includes('('+expected+')')),id+' at '+distance+' feet: '+cast.logs.join('\n'));
}
const blurred={...game,concentration:{id:'blur',remaining:10,automaticProtection:true},npcCombat:{active:true,round:1,order:[{id:'player',side:'player',initiative:20},{id:'keeper',side:'enemy',role:'attack',initiative:10}]}};
result=r.adventureStep(blurred,hp,hero,'npc-wait',()=>0);
assert.ok(result.events.some(t=>t.includes('attacks you')&&t.includes('(disadvantage, Blur)')),'NPC attacks must honor Blur');
result=r.adventureStep({...blurred,npcCombat:{...blurred.npcCombat,help:'enemy'}},hp,hero,'npc-dodge',()=>0);
assert.ok(result.events.some(t=>t.includes('attacks you')&&t.includes('(normal, Help, Dodge, Blur)')),'One advantage cancels all disadvantage sources');
result=r.adventureStep({...combat,concentration:blurred.concentration},hp,hero,'attack:Dagger',()=>0);
assert.ok(result.events.some(t=>t.startsWith('You use Dagger')&&t.includes('(normal)')));
// Two daggers: the turn waits for the other hand's attack (two-weapon fighting), so the wizard ends it.
if(result.game.actionUsed){const ended=r.adventureStep(result.game,result.health,hero,'end-turn',()=>0);result={...ended,events:[...result.events,...ended.events]};}
assert.ok(result.events.some(t=>t.startsWith('Lantern Wisp:')&&t.includes('(disadvantage)')));
assert.equal(r.rollAttack({attackBonus:2,heavyDisadvantage:true},'normal',()=>0).mode,'disadvantage','Keep actual Heavy weapon requirement');
assert.equal(r.rollAttack({attackBonus:2,heavyDisadvantage:true},'advantage',()=>0).mode,'normal');
const tower={...game,stage:'tower',map:{...game.map,accepted:true}};
const arrival=r.commitDmTurn(hero,tower,hp,{type:'travel',destination:'inn'},{question:'Go to the inn',narration:'The keeper greets you.',dialogue:[{speakerId:'keeper',text:'Welcome back.'}]},()=>0);
assert.equal(arrival.error,undefined,'Arrival dialogue validates against destination');
const departure=r.commitDmTurn(hero,game,hp,{type:'travel',destination:'tower'},{question:'Go to the tower',narration:'The keeper speaks.',dialogue:[{speakerId:'keeper',text:'I am with you.'}]},()=>0);
assert.ok(departure.error,'A resident left behind cannot speak from the new scene');assert.equal(departure.game,game,'Invalid reply applies no travel');
console.log('Passed: contextual pronouns, exact target replay, melee proximity, actual ranged-spell distance, conscious seeing threats, NPC/creature Blur, Dodge and Help cancellation, Heavy requirements and destination speakers.');
