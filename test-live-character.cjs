const fs=require('fs'),r=require('./verify-dm-integration.cjs');
(async()=>{
 const response=await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input:'Create a level 1 goblin wizard, a young adult scholar with a missing mentor. Choose all remaining details.',context:r.characterDraftContext()})});const body=await response.json();if(!response.ok)throw Error(body.error);fs.writeFileSync('AI-CHARACTER-RAW.json',JSON.stringify(body.draft,null,2));const draft=r.validateCharacterDraft(body.draft);fs.writeFileSync('AI-CHARACTER-TEST.json',JSON.stringify(draft,null,2));console.log(JSON.stringify({name:draft.name,age:draft.age,class:draft.class,species:draft.species,background:draft.background,spells:draft.spells,gearItems:draft.equipment.items.length,hasBackstory:!!draft.backstory,hasConnections:!!draft.connections,valid:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});

