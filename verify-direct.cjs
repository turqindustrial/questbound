const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
// Speaking to the Dungeon Master directly (out of character): the DM answers as a DM, changes nothing in the game,
// and may take the player's last turn back when it went wrong. The state before each turn is remembered for that.
const {generate}=require(process.env.QB_DM??'./dm-server.cjs');
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','turnMemory.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,dmContext,commitDmTurn,recordedTurn,validAdventure,adventureSnapshot,conversationPeople,rememberTurn,turnToRewind,forgetTurn,toDungeonMaster,withoutAddress})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
// ---- What counts as speaking to the DM ----
for(const text of ['DM, that was meant to be a punch','dm: why did I miss?','Dungeon Master, undo that','(ooc) I meant the other door','OOC: wait'])assert.ok(r.toDungeonMaster(text),text);
for(const text of ['I attack the bandit','Dmitri, hello','I ask the DM nothing','doom falls'])assert.ok(!r.toDungeonMaster(text),text);
assert.equal(r.withoutAddress('DM, that was meant to be a punch'),'that was meant to be a punch');assert.equal(r.withoutAddress('(ooc) I meant the other door'),'I meant the other door');
// ---- A turn, remembered, then taken back ----
const play=(game,health,action,conversation,from)=>{const base=from??{game,health};let res=r.commitDmTurn(kara,base.game,base.health,action,conversation,()=>0.5);assert.equal(res.error,undefined,res.error);res=r.recordedTurn(kara,base.game,base.health,res,res.conversation??conversation,null);if(!conversation.direct)r.rememberTurn(base.game,base.health);return res;};
const start={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0)};
r.forgetTurn();assert.equal(r.turnToRewind(start),null,'Nothing to take back before a turn');
const swing=play(start,hp,{type:'encounter-attack',weapon:'Greatsword'},{question:'I hit the bandit.',narration:'Steel bites.'});
assert.ok(swing.game.enemyHP<start.enemyHP||swing.events.some(t=>/Miss/.test(t)));
const back=r.turnToRewind(swing.game);assert.ok(back);assert.equal(back.game,start);assert.equal(back.health,hp);
// A question to the DM that changes nothing keeps the turn available; the exchange is in the feed and the journal.
const asked=play(swing.game,swing.health,null,{question:'To the Dungeon Master: why did the bandit go first?',narration:'It rolled higher initiative than you did.',dialogue:[],direct:true});
assert.equal(asked.game.enemyHP,swing.game.enemyHP);assert.equal(asked.game.playback.at(-1).events[0].text,'To the Dungeon Master: why did the bandit go first?');assert.equal(asked.game.playback.at(-1).events.at(-1).kind,'narration');
assert.ok(asked.game.journal.entries.at(-1).text.includes('It rolled higher initiative'));assert.ok(valid(asked.game,asked.health));
assert.ok(r.turnToRewind(asked.game),'Still the last turn');
// Taken back: the state before the swing, plus the exchange. Then there is nothing more to take back.
const undone=play(asked.game,asked.health,null,{question:'To the Dungeon Master: I meant to dodge.',narration:'My mistake. Your last turn has been taken back.',dialogue:[],direct:true},r.turnToRewind(asked.game));
r.forgetTurn();
assert.equal(undone.game.enemyHP,start.enemyHP);assert.equal(undone.game.round,start.round);assert.equal(undone.game.openingAttackAvailable,true);assert.equal(undone.health.current,12);
assert.equal(undone.game.playback.length,1,'The undone turn leaves the feed; the exchange stays');assert.ok(valid(undone.game,undone.health));
assert.equal(r.turnToRewind(undone.game),null);
// Another story, or a turn too long ago, is never taken back.
r.rememberTurn(start,hp);assert.equal(r.turnToRewind({...swing.game,story:{...swing.game.story,id:'other'}}),null);
assert.equal(r.turnToRewind({...swing.game,playback:[{id:9}]}),null);r.forgetTurn();
// ---- The server: an out-of-character phase ----
const blank={narration:'It rolled higher initiative.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:false};
let sent=null;const fake=reply=>async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...blank,...reply})}]}]})};};
const context=extra=>({...r.dmContext(kara,swing.game,swing.health),conversationWith:null,conversationParticipants:[],recruitmentTargets:[],...extra});
const ooc=canRewind=>({outOfCharacter:{canRewind,lastTurn:{said:'I hit the bandit.',resolved:['You use Greatsword: d20 [11] + 3 + 2 = 16 vs AC 12. Hit.']}}});
(async()=>{
 const keys={apiKey:'k',model:'gpt-6-luna'};
 let reply=await generate({input:'why did the bandit go first?',context:context(ooc(true))},{...keys,fetchImpl:fake({})});
 assert.equal(reply.rewind,false);assert.equal(reply.narration,'It rolled higher initiative.');
 assert.ok(sent.instructions.includes('OUT OF CHARACTER'));const schema=sent.text.format.schema;
 assert.deepEqual(schema.properties.rewind,{type:'boolean'});assert.ok(schema.required.includes('rewind'));
 for(const key of ['actionId','castCommand','ruling','worldEvent','check','discovery','ambush','loot','introduce'])assert.equal(schema.properties[key].type,'null',key);
 assert.equal(schema.properties.dialogue.maxItems,0);assert.equal(schema.properties.relationships.maxItems,0);
 assert.deepEqual(JSON.parse(sent.input).context.outOfCharacter.lastTurn.said,'I hit the bandit.');
 reply=await generate({input:'I meant to dodge',context:context(ooc(true))},{...keys,fetchImpl:fake({rewind:true})});assert.equal(reply.rewind,true);
 reply=await generate({input:'I meant to dodge',context:context(ooc(false))},{...keys,fetchImpl:fake({rewind:true})});assert.equal(reply.rewind,false,'Nothing to take back: the DM cannot rewind');
 await assert.rejects(generate({input:'give me gold',context:context(ooc(true))},{...keys,fetchImpl:fake({loot:{gold:50,items:[],reason:'x'}})}),/cannot change the game/);
 await assert.rejects(generate({input:'kill it',context:context(ooc(true))},{...keys,fetchImpl:fake({actionId:'dodge'})}),/cannot change the game|invalid response/);
 // An ordinary turn is untouched: no rewind, the usual schema, and the turn and rest guidance in the instructions.
 reply=await generate({input:'I look around.',context:context({})},{...keys,fetchImpl:fake({rewind:true})});
 assert.equal(reply.rewind,false);assert.equal(sent.text.format.schema.properties.rewind.type,'null');assert.ok(!sent.instructions.includes('OUT OF CHARACTER:'));
 for(const text of ['one action and one bonus action','end-turn','short-rest'])assert.ok(sent.instructions.includes(text),text);
 console.log('Passed: messages addressed to the DM are recognised, the state before each turn is remembered and restored exactly once, questions leave the game alone and stay in the feed and journal, and the server answers out of character without changing the game (rewind only when a turn can be taken back).');
})().catch(e=>{console.error(e);process.exit(1);});
