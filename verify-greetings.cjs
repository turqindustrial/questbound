const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Turning to someone: they speak first. The Dungeon Master is asked for the line; a stand-in that fits how they feel
// about the hero is always ready, and someone who has only just spoken is not made to greet again.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','greetings.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,greeting,shouldGreet,greetingPools,commitDmTurn,recordedTurn,conversationPeople,validAdventure,adventureSnapshot})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter');
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),game={...fight,stage:'inn',enemyHP:0,foeFate:'slain'};delete game.openingAttackAvailable;
const people=r.conversationPeople(game);assert.ok(people.length>=2,'Two people are here to talk to');
const [first,second]=people,name=first.name;
// ---- When someone speaks first ----
assert.equal(r.shouldGreet(game,first.id),true);
assert.equal(r.shouldGreet({...game,stage:'combat',enemyHP:5},first.id),false,'Nobody chats in a fight');assert.equal(r.shouldGreet({...game,npcCombat:{active:true}},first.id),false);assert.equal(r.shouldGreet({...game,stage:'dying'},first.id),false);
const spoke={...game,playback:[{id:1,npcId:null,events:[{kind:'narration',text:'They look up.'},{kind:'dialogue',speakerId:first.id,text:'You made it.'}]}]};
assert.equal(r.shouldGreet(spoke,first.id),false,'Someone who has only just spoken does not greet again');assert.equal(r.shouldGreet(spoke,second.id),true);
// ---- What they say when the Dungeon Master cannot be reached ----
const said=(g,id=first.id)=>r.greeting(g,id,hero);
const plain=said(game);assert.equal(plain.scene,'You turn to '+name+'.');assert.ok(plain.cue.includes('Only '+name+' speaks'));assert.ok(plain.cue.includes('regardsYourKind'));assert.ok(plain.fallback.length>5);
const mood=memory=>said({...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'indifferent',memories:[],...memory}}}).mood;
assert.equal(mood({grudge:'They killed my brother.'}),'grudge');assert.equal(mood({attitude:'hostile'}),'hostile');assert.equal(mood({attitude:'unfriendly'}),'unfriendly');assert.equal(mood({attitude:'friendly'}),'friendly');assert.equal(mood({attitude:'devoted'}),'bond');assert.equal(mood({bond:'They saved my life.'}),'bond');
assert.equal(mood({grudge:'x',bond:'y',attitude:'friendly'}),'grudge','A grudge outweighs everything');
assert.equal(said({...game,followers:{[first.id]:{status:'following',location:'inn'}}}).mood,'following');
// Someone with no feeling either way greets by how they take to the hero's kind.
const regarded=stance=>said({...game,story:{...game.story,npcs:{...game.story.npcs,[first.id]:{...game.story.npcs[first.id],regard:{stance,reason:'A reason of my own.'}}}}}).mood;
for(const stance of ['kin','warm','curious','wary','scornful'])assert.equal(regarded(stance),stance);
assert.ok(Object.keys(r.greetingPools).length>=12);
for(const [key,lines] of Object.entries(r.greetingPools)){assert.ok(lines.length>=2,key+' has a choice of lines');for(const line of lines){assert.ok(line.length>=8&&line.length<=120,line);assert.ok(!/[‘’“”]/.test(line),'Plain quotes only');}}
// The stand-in line changes from one turn to the next more often than not.
const seen=new Set(Array.from({length:12},(_,i)=>said({...game,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]}).fallback));assert.ok(seen.size>=2);
// ---- The greeting is a turn of its own: no words put in the player's mouth ----
const opening=said(game),talk={question:opening.scene,narration:opening.aside,dialogue:[{speakerId:first.id,text:opening.fallback}],trigger:true,npcId:first.id};
const turn=r.commitDmTurn(hero,game,null,null,talk,()=>.5);assert.ok(!turn.error,turn.error);
const recorded=r.recordedTurn(hero,game,null,turn,turn.conversation??talk,first.id);
assert.deepEqual(JSON.parse(JSON.stringify(recorded.turn.events.map(e=>e.kind))),['action','narration','dialogue']);assert.equal(recorded.turn.events[0].text,opening.scene);assert.equal(recorded.turn.events[2].speakerId,first.id);assert.equal(recorded.turn.events[2].text,opening.fallback);
assert.ok(!recorded.turn.events.some(e=>e.kind==='player'));assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(recorded.game)),null,true),hero));
assert.equal(r.shouldGreet(recorded.game,first.id),false,'Having greeted, they wait for an answer');
console.log('Passed: people speak first when turned to (never in a fight, never twice running), the Dungeon Master is asked for a line in their own voice, the stand-in line fits a grudge, hostility, friendship, a companion or their view of the hero\'s kind, and the greeting is saved as a turn without putting words in the player\'s mouth.');
