const fs=require('fs'),assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
const hero={name:'QA climber',class:'Fighter',level:1,background:'Soldier',scores:{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:10,Charisma:10},spells:[]};hero.equipment=r.equipmentFor(hero);
async function ask(input,context){const res=await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input,context})});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
(async()=>{
 const game={...r.newAdventure(hero),worldFacts:['There is a slick 10-foot ledge beside the inn; falling from it risks 1d6 damage.']},hp={current:12,temp:0},question='I try to climb the slick ledge using my Athletics training.';
 const plan=await ask(question,r.dmContext(hero,game,hp));assert.equal(plan.check?.skill,'Athletics');assert.equal(plan.check.ability,'Strength');
 const resolved=r.commitDmTurn(hero,game,hp,{type:'ai-check',check:plan.check},{question,narration:plan.narration},()=>0.5);assert.equal(resolved.error,undefined);assert.ok(resolved.game.log[0].includes('+ 3 ability + 2 training = 16'));
 const narration=await ask(question,{...r.dmContext(hero,resolved.game,resolved.health),engineResolved:resolved.game.log.slice(0,4)});assert.equal(narration.check,null);assert.equal(narration.actionId,null);
 const report={plan:plan.check,result:resolved.game.log[0],narration:narration.narration};fs.writeFileSync('LIVE-SKILL-TEST-REPORT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
