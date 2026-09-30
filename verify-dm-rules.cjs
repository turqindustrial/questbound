const assert=require('node:assert/strict');
const {rulesFor,validateGroundedReply}=require('./dm-rules.cjs');
const {generate}=require('./dm-server.cjs');
const spells=require('./spellCatalog.json');
const body={input:'Can I use Detect Magic or Burning Hands?',context:{player:{class:'Wizard',level:1},choices:[],spellReference:[{name:'Detect Magic'},{name:'Burning Hands'}]}};
const rules=rulesFor(body);
assert.equal(rules.spells.length,2);
assert.ok(rules.spells.every(s=>s.availableToCharacter&&s.description&&s.components&&s.duration));
assert.ok(rules.availableFeatures.every(f=>f.level<=1&&!f.subclass));
assert.equal(rulesFor({...body,input:'Can I cast Wish?'}).spells[0].availableToCharacter,false);
for(const spell of spells){
 const reference=rulesFor({...body,input:'Resolve this spell.',context:{...body.context,pendingSpell:{id:spell.id}}}).spells[0];
 assert.equal(reference.id,spell.id);
 assert.equal(reference.description,spell.description);
 assert.equal(reference.higherLevel,spell.higherLevel);
}
const barb=rulesFor({input:'Rage',context:{player:{class:'Barbarian',level:1}}});
assert.ok(barb.featureDetails.some(f=>f.name==='Rage'&&f.description.includes('Concentration')));
assert.ok(!rulesFor({input:'Rage',context:{player:{class:'Wizard',level:1}}}).featureDetails.length);
const empty={actionId:null,castCommand:null,ruling:null,check:null,worldEvent:null};
validateGroundedReply({engineResolved:['3 Fire damage']},empty);
for(const key of Object.keys(empty))assert.throws(()=>validateGroundedReply({engineResolved:['3 Fire damage']},{...empty,[key]:'extra effect'}),/already resolved/);
const ruling={decision:'deny',damage:1,selfDamage:0,healing:0,temporaryHP:0};
assert.throws(()=>validateGroundedReply({}, {...empty,ruling}),/cannot apply effects/);
assert.throws(()=>validateGroundedReply({pendingSpell:{engineDamage:true}}, {...empty,ruling:{...ruling,decision:'cast'}}),/rolled by the game/);
(async()=>{
 let captured;
 await generate(body,{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{captured=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...empty,narration:'Detect Magic requires concentration.'})}]}]})};}});
 assert.ok(captured.instructions.includes('Cantrips are level 0'));
 assert.ok(captured.instructions.includes('one spell slot'));
 assert.ok(captured.instructions.includes('natural 20 is not automatic success'));
 assert.ok(captured.instructions.includes(rules.spells[0].description.slice(0,35)));
 console.log(`Passed: ${spells.length} exact spell references, availability and level gating, class-feature retrieval, duplicate-action protection, denied-effect protection, engine damage ownership, and API rules injection. Mocked provider; no paid calls.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
