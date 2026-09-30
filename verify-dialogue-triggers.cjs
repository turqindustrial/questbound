const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),r=require('./verify-dm-integration.cjs');
const hero={name:'Trigger tester',class:'Fighter',species:'Human',level:1,scores:{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[]};hero.equipment=r.equipmentFor(hero);
const p=vm.runInNewContext(['npcRules.js','storyRules.js','mapRules.js','playbackRules.js','sceneTriggers.js','hostileEncounter.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n({sceneTrigger,withSceneTrigger,recordedTurn,conversationPeople,conversationTarget,freshStoryGame,validStory,hostileEncounterGame,hostileFoes})',{combatBasics:r.combatBasics});
const hp={current:12,temp:0},valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
// Location triggers: returning to the inn, first arrival with a companion, once each.
const start=r.newAdventure(hero),left=r.adventureStep(start,hp,hero,'listen',()=>0).game;
assert.equal(p.sceneTrigger(start,left,'listen'),null,'Nobody present at the bridge to speak');
const back=r.adventureStep(left,hp,hero,{type:'travel',destination:'inn'},()=>0).game,cued=p.withSceneTrigger(left,back,{type:'travel',destination:'inn'});
assert.equal(cued.sceneCue.id,'return-inn');assert.equal(cued.sceneCue.speakerId,'keeper');assert.ok(cued.sceneCue.scene.includes('Crossroads Inn'));assert.ok(valid(cued));
const away=r.adventureStep(cued,hp,hero,{type:'travel',destination:'tower'},()=>0).game,again=r.adventureStep(away,hp,hero,{type:'travel',destination:'inn'},()=>0).game;
assert.equal(p.sceneTrigger(away,again,{type:'travel',destination:'inn'}),null,'Return greeting fires once');
const rested=r.adventureStep(again,hp,hero,'long-rest',()=>0).game;assert.equal(JSON.stringify(rested.firedTriggers),'["return-inn"]','Long rest keeps fired triggers');assert.equal(p.sceneTrigger(again,rested,'long-rest').id,'rest');
const joined=r.commitDmTurn(hero,start,hp,{type:'recruitment',plans:[{npcId:'mara',decision:'join',reason:'She wants the road safe.',terms:'Keep travelers safe.',dc:null}]},{question:'Mara, will you join me?',narration:'She agrees.',npcId:'mara'},()=>.9).game;
const tower=r.adventureStep(joined,hp,hero,{type:'travel',destination:'tower'},()=>0).game,arrival=p.sceneTrigger(joined,tower,{type:'travel',destination:'tower'});
assert.equal(arrival.id,'arrive:tower');assert.equal(arrival.speakerId,'mara');
// A trigger turn commits dialogue without a player line or mechanics.
const conversation={question:cued.sceneCue.scene,narration:'The keeper looks up.',dialogue:[{speakerId:'keeper',text:'You are back. What did you see?'}],trigger:true,npcId:'keeper'};
const committed=r.commitDmTurn(hero,cued,hp,null,conversation);assert.equal(committed.error,undefined);assert.ok(committed.game.journal.entries.at(-1).text.startsWith('Scene: '));
const turn=p.recordedTurn(hero,cued,hp,committed,conversation,'keeper');assert.equal(turn.turn.events[0].kind,'action');assert.equal(turn.turn.events.at(-1).speakerName,'The keeper');assert.ok(valid(turn.game));
// Random hostile encounter: starts in combat, uses the opening attack and the foe's damage type.
const hostile=p.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);
assert.equal(hostile.stage,'combat');assert.equal(hostile.story.foe,'Bandit Cutthroat');assert.equal(hostile.openingAttackAvailable,true);assert.ok(valid(hostile,null));
assert.equal(r.encounterFoe(hero,hostile).type,'Slashing');
for(const [i] of p.hostileFoes.entries())assert.ok(p.validStory(p.hostileEncounterGame(hero,r.newAdventure(hero),()=>i/p.hostileFoes.length).story));
const weapon=r.weaponAttacks(hero).find(w=>!w.blocked&&!w.ranged).name;
let g=hostile,h={current:12,temp:0},first=r.adventureStep(g,h,hero,'attack:'+weapon,()=>0.1);
assert.equal(first.error,undefined);assert.equal(first.events[0],'Opening attack.');assert.ok(first.events.some(t=>t.includes('Turn order')));
const slash=r.adventureStep({...first.game,openingAttackAvailable:false},first.health,hero,'dodge',()=>0.99);assert.ok(slash.events.some(t=>t.includes('Slashing damage')),'Foe deals its own damage type');
g=first.game;h=first.health;for(let i=0;i<30&&g.stage==='combat';i++){const step=r.adventureStep(g,h,hero,'attack:'+weapon,()=>0.7);g=step.game;h=step.health;}
assert.equal(g.stage,'victory');assert.ok(valid(g,h));
// Losing a story fight returns the player to the starting location, where residents react; the foe keeps its HP.
const fled=r.adventureStep({...first.game,openingAttackAvailable:false},first.health,hero,'flee',()=>0.5);
assert.equal(fled.game.stage,'inn');assert.ok(fled.events.some(t=>t.includes('You retreat to Caravan Camp. The Bandit Cutthroat is still out there')));assert.equal(fled.game.enemyHP,first.game.enemyHP);assert.ok(valid(fled.game,fled.health));
assert.equal(p.sceneTrigger(first.game,fled.game,'flee').id,'retreat');
const knocked=r.adventureStep({...first.game,openingAttackAvailable:false},{current:1,temp:0},hero,'dodge',()=>0.99);
assert.equal(knocked.game.stage,'inn');assert.equal(knocked.health.current,0);assert.ok(knocked.events.at(-1).startsWith('You wake at Caravan Camp'));assert.ok(valid(knocked.game,knocked.health));
const recovered=r.adventureStep(knocked.game,knocked.health,hero,'long-rest',()=>0.5);assert.equal(recovered.health,null);
const rematch=r.adventureStep(r.adventureStep(recovered.game,null,hero,{type:'travel',destination:'bridge'},()=>0.5).game,null,hero,'approach',()=>0.5);assert.equal(rematch.game.stage,'combat');assert.equal(rematch.game.enemyHP,first.game.enemyHP);
// People can be addressed by first name or surname; titles alone do not select anyone.
const camp=fled.game;assert.equal(p.conversationTarget(camp,'Tobin, will you scout for me?','keeper'),'mara');assert.equal(p.conversationTarget(camp,'Ask Brask about the road'),'keeper');assert.equal(p.conversationTarget(camp,'Hello captain'),null);
assert.equal(JSON.stringify(r.recruitmentTargets(camp,'Tobin, will you join me as a scout?','keeper')),'["mara"]');
// Spells target the story foe by name and resolve automatically.
const caster={name:'Caster',class:'Wizard',species:'Human',level:1,scores:{Strength:8,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['fire-bolt']};caster.equipment=r.equipmentFor(caster);
const bolt=r.dmCommand(caster,hostile,'I cast Fire Bolt at the Bandit Cutthroat',null);assert.ok(bolt.action,bolt.error);
const bolted=r.adventureStep(hostile,null,caster,bolt.action,()=>0.9);assert.equal(bolted.waiting,undefined);assert.ok(bolted.events.some(t=>t.startsWith('Fire Bolt:')));
// Opening dialogue plays as the first turn of a generated story.
const story={...hostile.story,id:'story-1',introId:'caravan',openingDialogue:[{speakerId:'keeper',text:'Nobody touches the wagons.'},{speakerId:'mara',text:'Captain, they only want water.'}]};delete story.foeDamageType;
const opened=p.freshStoryGame(hero,story,r.newAdventure(hero));assert.equal(opened.playback[0].events.filter(e=>e.kind==='dialogue').length,2);assert.equal(opened.playback[0].events[2].speakerName,'Tobin Reed');assert.ok(valid(opened,null));
assert.equal(p.validStory({...story,openingDialogue:[{speakerId:'stranger',text:'Hi.'}]}),false);
(async()=>{
 const {generate}=require('./dm-server.cjs');let sent;
 const reply=body=>async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(body)}]}]})};};
 const context={choices:[],conversationParticipants:[{id:'keeper',name:'The keeper'}],sceneTrigger:{id:'return-inn',cue:'The player has just returned.'}};
 const spoken=await generate({input:'You return to the inn.',context},{apiKey:'test',model:'test',fetchImpl:reply({narration:'The keeper looks up.',dialogue:[{speakerId:'keeper',text:'Welcome back.'}],recruitment:[],actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null})});
 assert.equal(spoken.dialogue[0].text,'Welcome back.');assert.ok(sent.instructions.includes('SCENE TRIGGER'));assert.deepEqual(sent.text.format.schema.properties.actionId,{type:'null'});
 const checked=await generate({input:'I search the camp for tracks.',context:{choices:[],conversationParticipants:[]}},{apiKey:'test',model:'test',fetchImpl:reply({narration:'You search.',dialogue:[],recruitment:[],actionId:null,castCommand:null,ruling:null,worldEvent:null,check:{skill:'Survival',ability:'Wisdom',dc:12,mode:'normal',reason:'Search for tracks',success:'You find tracks.',failure:'The ground is too trampled.',damageCount:0,damageDie:0,damageOn:'none'}})});
 assert.equal(checked.check.damageDie,6,'A no-damage check with die 0 is accepted');
 const {generateAdventure}=require('./adventure-generator.cjs');
 await assert.rejects(()=>generateAdventure({context:{introId:'hostile'}},{apiKey:'test',model:'test',fetchImpl:reply({})}),/without the AI/);
 const lines=[{speakerId:'keeper',text:'Nobody touches the wagons.'},{speakerId:'mara',text:'They only want water.'}];
 const generated=await generateAdventure({context:{introId:'caravan'}},{apiKey:'test',model:'test',fetchImpl:reply({...story,npcs:{keeper:story.npcs.keeper,mara:story.npcs.mara},openingDialogue:lines})});
 assert.ok(sent.text.format.schema.required.includes('openingDialogue'));assert.deepEqual(generated.story.openingDialogue,lines);
 await generateAdventure({context:{introId:'garden'}},{apiKey:'test',model:'test',fetchImpl:reply(story)});assert.ok(!sent.text.format.schema.required.includes('openingDialogue'));
 console.log('Passed: return/arrival/rest triggers fire once, companions speak on arrival, trigger turns save without player lines, instant hostile encounter with opening attack and foe damage type, opening dialogue playback, and server trigger/generator schemas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
