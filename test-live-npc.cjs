const fs=require('fs'),assert=require('node:assert/strict'),r=require('./verify-dm-integration.cjs');
const hero={name:'QA traveler',class:'Wizard',level:1,species:'Human',scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['acid-splash']};hero.equipment=r.equipmentFor(hero);
async function ask(input,context){const res=await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input,context})});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
(async()=>{
 const game=r.newAdventure(hero),hp={current:8,temp:0},command=r.dmCommand(hero,game,'I attack the keeper with my dagger',hp);
 const attacked=r.adventureStep(game,hp,hero,command.action,()=>0);
 const context=r.dmContext(hero,attacked.game,attacked.health);
 const reaction=await ask('I attack the keeper with my dagger',{...context,engineResolved:attacked.game.log.slice(0,8)});
 for(const field of ['actionId','castCommand','ruling','check','worldEvent'])assert.equal(reaction[field],null);
 const memory=await ask('Mara, why are you upset with me?',context);assert.equal(memory.actionId,null);assert.equal(memory.castCommand,null);assert.equal(memory.ruling,null);assert.equal(memory.check,null);
 const interpreted=await ask('I lunge at Mara and slash her with my dagger.',r.dmContext(hero,game,hp));
 const report={scope:'Isolated QA state; no player save changed. Human review required for narrative correctness.',reaction,memory,interpreted};
 fs.writeFileSync('LIVE-NPC-TEST-REPORT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(interpreted.actionId,'npc-attack:mara:Dagger');
})().catch(e=>{console.error(e);process.exitCode=1;});
