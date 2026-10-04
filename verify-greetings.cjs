const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Turning to someone: they speak first. The Dungeon Master is asked for the line; a stand-in that fits how they feel
// about the hero is always ready, and someone who has only just spoken is not made to greet again.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','greetings.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,greeting,shouldGreet,greetingPools,commitDmTurn,recordedTurn,conversationPeople,validAdventure,adventureSnapshot,replyIdeas,speakingPeople,adventureStep})',{AsyncStorage:{},weaponIcon:()=>'sword'});
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
// Someone who forgave the hero a grudge is civil but has not forgotten; once warm again they greet as a friend.
const pardon={grudge:'The player killed my friend.',weight:'grave',memory:'You made it right. I forgive you.'};
assert.equal(mood({forgave:pardon,attitude:'indifferent'}),'forgiven');assert.equal(mood({forgave:pardon,attitude:'unfriendly'}),'forgiven');assert.equal(mood({forgave:pardon,attitude:'friendly'}),'friendly');
assert.ok(plain.cue.includes('but answers in words of their own'),'A hostile person still answers');
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
// ---- Things the player might say next (the Suggestions tab's stand-in) ----
const ideas=(g,id=null)=>JSON.parse(JSON.stringify(r.replyIdeas(g,hero,id)));
const goodLine=t=>typeof t==='string'&&t.length>=8&&t.length<=110&&!/[‘’“”]/.test(t)&&!/^(?:DM\b|\(?ooc)/i.test(t)&&!/^["']/.test(t);
const grudging={...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',response:'Holds a grudge.',memories:[],grudge:'The player killed my friend.'}}};
for(const g of [grudging,game,{...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',response:'Cold.',memories:[]}}},{...game,followers:{[first.id]:{status:'following',location:'inn'}}},{...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'indifferent',response:'Civil.',memories:[],forgave:pardon}}}]){
 const lines=ideas(g,first.id);assert.ok(lines.length>=2&&lines.length<=3,JSON.stringify(lines));assert.equal(new Set(lines).size,lines.length);for(const t of lines)assert.ok(goodLine(t),t);
}
assert.ok(ideas(grudging,first.id).some(t=>/set this right|what I did|leave you be|excuses/.test(t)),'A grudge-holder is offered amends, not small talk');
const neutral=ideas(game,first.id);assert.ok(neutral.includes('What do you know about '+game.story.foe+'?'),JSON.stringify(neutral));assert.ok(neutral.includes('Is there anything you need?'));
const around=ideas(game);assert.equal(around[0],'I look around.');assert.ok(around.some(t=>/^I ask \S+ what is going on here\.$/.test(t)),JSON.stringify(around));
const alone=ideas({...game,stage:'bridge'});assert.ok(alone.includes('I look around.'));assert.ok(alone.some(t=>/^I head toward .+\.$/.test(t)),JSON.stringify(alone));for(const t of alone)assert.ok(goodLine(t),t);
for(const g of [{...game,stage:'combat',enemyHP:5},{...game,npcCombat:{active:true}},{...game,stage:'dying'},{...game,stage:'dead'},{...game,pendingSpell:{id:'x'}}])assert.deepEqual(ideas(g,first.id),[]);
const varied=new Set(Array.from({length:12},(_,i)=>ideas({...grudging,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]},first.id).join('|')));assert.ok(varied.size>=2,'The picks change from turn to turn');
// ---- In a brawl the people fighting may still speak (no conversation screen, but words) ----
const brawl=r.adventureStep(game,{current:40,temp:0},hero,{type:'npc-attack',target:first.id,weapon:'Greatsword'},()=>0.02);
assert.equal(brawl.error,undefined,brawl.error);assert.equal(brawl.game.npcCombat?.active,true);
assert.deepEqual(JSON.parse(JSON.stringify(r.conversationPeople(brawl.game))),[]);assert.ok(r.speakingPeople(brawl.game).some(n=>n.id===first.id&&n.name===name),'The one you are fighting can shout back');
assert.deepEqual(JSON.parse(JSON.stringify(r.speakingPeople({...game,stage:'combat',enemyHP:5}))),[]);assert.deepEqual(r.speakingPeople(game).map(n=>n.id),people.map(n=>n.id));
console.log('Passed: things to say next stand in for the Dungeon Master (fitting a grudge, coldness, a companion, forgiveness or a plain talk; never in a fight), people in a brawl may speak, and someone who forgave you greets you civilly.');
console.log('Passed: people speak first when turned to (never in a fight, never twice running), the Dungeon Master is asked for a line in their own voice, the stand-in line fits a grudge, hostility, friendship, a companion or their view of the hero\'s kind, and the greeting is saved as a turn without putting words in the player\'s mouth.');
