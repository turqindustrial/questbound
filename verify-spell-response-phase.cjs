const assert=require('node:assert/strict');
const {generate}=require('./dm-server.cjs');
const r=require('./verify-dm-integration.cjs');
const hero={name:'Spell QA',class:'Wizard',species:'Human',level:1,scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['acid-splash']};
hero.equipment=r.equipmentFor(hero);
const game=r.newAdventure(hero),input='I cast Acid Splash on the keeper';
const command=r.dmCommand(hero,game,input),preview=r.adventureStep(game,null,hero,command.action,()=>0.5);
assert.equal(preview.waiting,true);
const context=r.dmContext(hero,preview.game,preview.health);
const empty={narration:'The keeper watches you.',actionId:null,castCommand:null,ruling:null,check:null,worldEvent:null};
async function run(reply,ctx=context){let request;const result=await generate({input,context:ctx},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})};}});return {result,request};}
(async()=>{
 await assert.rejects(run(empty),/must return.*ruling/);
 for(const decision of ['cast','deny','clarify']){
  const ruling={decision,note:decision==='clarify'?'Which creature are you targeting?':'Resolve the stated spell using engine dice.',damage:0,selfDamage:0,healing:0,temporaryHP:0};
  const {request,result}=await run({...empty,ruling});
  const fields=request.text.format.schema.properties;
  assert.equal(fields.ruling.type,'object');
  for(const field of ['actionId','castCommand','check'])assert.equal(fields[field].type,'null');
  const committed=r.commitDmTurn(hero,game,null,{type:'ai-spell',request:command.action.request,ruling:result.ruling},{question:input,narration:result.narration},()=>0);
  assert.equal(committed.error,undefined);
  assert.deepEqual(committed.game.spellSlotsUsed,game.spellSlotsUsed);
  if(decision==='cast')assert.equal(committed.game.pendingSpell,undefined);
  else assert.deepEqual(committed.game.npcHP,game.npcHP);
 }
 const {request}=await run(empty,{...context,engineResolved:['Acid Splash resolved.']});
 for(const field of ['actionId','castCommand','ruling','check','worldEvent'])assert.equal(request.text.format.schema.properties[field].type,'null');
 console.log('Passed: pending spells require rulings; cast/deny/clarify preserve cantrip costs; non-casts do not damage; narration cannot repeat effects.');
 if(process.argv.includes('--live')){
  const response=await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input,context})});
  const body=await response.json();assert.ok(response.ok,body.error);assert.ok(body.ruling);assert.equal(body.castCommand,null);
  console.log('Live isolated Acid Splash ruling:',JSON.stringify(body));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
