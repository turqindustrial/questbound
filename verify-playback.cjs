const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),r=require('./verify-dm-integration.cjs');
const source=['deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','playbackRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const p=vm.runInNewContext(source+'\n({recordedTurn,activeEffectLines,conversationTarget,conversationPeople})',{combatBasics:r.combatBasics});
const hero={name:'Playback QA',class:'Wizard',species:'Human',level:1,scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['detect-magic','burning-hands','acid-splash']};hero.equipment=r.equipmentFor(hero);
const game=r.newAdventure(hero),hp={current:8,temp:2},attack=r.dmCommand(hero,game,'I attack the keeper with my dagger',hp).action;
const sequence=values=>()=>values.length?values.shift():0;
let result=r.adventureStep(game,hp,hero,attack,sequence([0,0,.9,.8,.8,.75]));
const player=result.events.findIndex(t=>t.startsWith('You use Dagger')),keeper=result.events.findIndex(t=>t.includes('keeper attacks you')),mara=result.events.findIndex(t=>t.includes('Mara distracts'));
assert.ok(player>0&&keeper>player&&mara>keeper,'Execution events must follow opening attack/initiative/retaliation/Help order');
assert.match(result.events[keeper],/d20 \[.*\].*\+ 2.*vs AC/);assert.match(result.events[keeper],/1d4/);
const conversation={question:'I attack the keeper with my dagger',narration:'The keeper retaliates while Mara distracts you.'};
let recorded=p.recordedTurn(hero,game,hp,result,conversation);
assert.ok(r.validAdventure(r.adventureSnapshot(hero,recorded.game,recorded.health,true),hero));
assert.equal(recorded.turn.events[0].kind,'player');assert.equal(recorded.turn.events.at(-1).kind,'narration');
assert.ok(recorded.turn.events.some(e=>e.text.includes('8 → 6 HP')));
assert.ok(recorded.turn.events.some(e=>e.text==='Temporary HP depleted or expired.'));
assert.equal(JSON.stringify(game),JSON.stringify(r.newAdventure(hero)),'Recording must not mutate the original save');
// Identical later turns are still recorded, never removed by text-based deduplication.
let before=recorded.game,beforeHP=recorded.health;
for(let i=0;i<15;i++){
 const turn=r.adventureStep(before,beforeHP,hero,'npc-wait',()=>0);
 recorded=p.recordedTurn(hero,before,beforeHP,turn,{question:'Wait',narration:'The defenders act.'});
 assert.ok(recorded.turn.events.some(e=>e.text.includes('keeper attacks you')));before=recorded.game;beforeHP=recorded.health;
}
assert.equal(before.playback.length,12);assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(before)),beforeHP,true),hero));
result=r.adventureStep(game,{current:1,temp:0},hero,attack,sequence([.5,0,0,.99,.1,.99,.9,.9]));
assert.ok(result.events.some(t=>t.includes('fall unconscious')));assert.ok(result.events.findIndex(t=>t.startsWith('You use'))<result.events.findIndex(t=>t.includes('initiative')),'The opening attack must happen before initiative and cannot be preempted');
const detect=r.dmCommand(hero,game,'I cast Detect Magic').action;
result=r.adventureStep(game,hp,hero,detect,()=>0);recorded=p.recordedTurn(hero,game,hp,result,{question:'I cast Detect Magic',narration:'You sense the lantern.'});
assert.ok(recorded.turn.events.some(e=>e.text.includes('level 1 spell slot')));assert.ok(p.activeEffectLines(result.game,result.health).some(t=>t.includes('Detect Magic')&&t.includes('100 rounds')));
const ended=r.adventureStep(result.game,result.health,hero,{type:'end-concentration'},()=>0);
const endedTurn=p.recordedTurn(hero,result.game,result.health,ended,{question:'End concentration',narration:'The sense fades.'});assert.ok(endedTurn.turn.events.some(e=>e.text==='Detect Magic concentration ended.'));
const fight={...game,stage:'combat'},burn=r.dmCommand(hero,fight,'I cast Burning Hands toward the wisp').action;
result=r.adventureStep(fight,hp,hero,burn,()=>0);assert.match(result.events[0],/3d6 \[1, 1, 1\]/);assert.ok(result.events[0].includes('Dexterity save d20'));
const noSlot=r.adventureStep(fight,hp,hero,r.dmCommand(hero,fight,'I cast Acid Splash at the wisp').action,()=>0);
assert.ok(!p.recordedTurn(hero,fight,hp,noSlot,{question:'Acid Splash',narration:'Acid splashes.'}).turn.events.some(e=>e.text.startsWith('Spent ')));
assert.equal(p.conversationTarget(game,'I talk to the bartender'), 'keeper');assert.equal(p.conversationTarget(game,'I ask Mara about the road'),'mara');
assert.equal(p.conversationTarget(game,'What do you know?','mara'),'mara');assert.equal(p.conversationTarget(game,'I attack Mara','mara'),null);
assert.equal(p.conversationTarget(game,'Why did someone attack the keeper?','mara'),'mara');
assert.equal(p.conversationTarget({...game,npcHP:{mara:0}},'I talk to Mara'),null);assert.equal(p.conversationPeople(before).length,0);
assert.equal(p.conversationTarget({...game,story:{npcs:{keeper:{name:'Ivo'},mara:{name:'Sera'}}}},'Hello Sera'),'mara');
assert.equal(r.validAdventure(r.adventureSnapshot(hero,{...game,playback:[{id:1,npcId:null,events:[{kind:'unsafe',text:'bad'}]}]},hp,true),hero),false);
assert.equal(r.validAdventure(r.adventureSnapshot(hero,{...game,playback:[{id:1,npcId:null,events:[{kind:'action',text:'x'.repeat(2201)}]}]},hp,true),hero),false);
// Opening selection reaches the provider as a server-owned premise, with fresh generation.
(async()=>{
 const {generateAdventure}=require('./adventure-generator.cjs'),intros=require('./adventureIntros.json');
 assert.equal(new Set(intros.map(i=>i.id)).size,intros.length);
 for(const intro of intros.filter(i=>!i.local)){let request;
  await generateAdventure({input:'Begin',context:{mode:'adventure',choices:[],introId:intro.id}},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({foeAppearance:'A spiny plant creature.',npcs:{keeper:{name:'Orin',appearance:'An old dwarf with copper spectacles.',personality:'Patient, gentle and precise.'},mara:{name:'Vessa',appearance:'A green dragonborn with silver horns.',personality:'Quick-witted and restless.'}}})}]}]})};}});
  const body=JSON.parse(request.input);assert.equal(body.selectedOpening?.id??'surprise',intro.id);if(intro.id!=='surprise')assert.ok(body.creativeDirection.includes(intro.conflict));
 }
 // An opening the list no longer has (a browser still on an earlier build) becomes a tale of the writer's choosing.
 {let request;await generateAdventure({input:'Begin',context:{mode:'adventure',choices:[],introId:'caravan'}},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({foeAppearance:'A spiny plant creature.',npcs:{keeper:{name:'Orin',appearance:'An old dwarf with copper spectacles.',personality:'Patient, gentle and precise.'},mara:{name:'Vessa',appearance:'A green dragonborn with silver horns.',personality:'Quick-witted and restless.'}}})}]}]})};}});
  const body=JSON.parse(request.input);assert.equal(body.selectedOpening,null);assert.ok(body.creativeDirection.length>20);}
 assert.ok(intros.filter(i=>i.scale==='saga').length>=6,'A fresh set of long adventures');for(const i of intros.filter(i=>i.scale==='saga'))for(const key of ['title','setting','conflict','journey','stakes','arrival','tone'])assert.ok(typeof i[key]==='string'&&i[key].length>3,i.id+' has '+key);
 console.log('Passed: chronological initiative/retaliation, opening attack precedences, repeated turns, modifiers and damage dice, residual effects/expiration, cantrip costs, bounded save/reload, conversation routing, and all opening prompts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
