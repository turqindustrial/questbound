const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// People remember: a killing leaves a permanent grudge in those who loved the victim, a life saved leaves a permanent
// bond, the main foe's end touches those tied to it, and the Dungeon Master records lesser deeds either way.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmCommand,dmContext,validAdventure,adventureSnapshot,validStory,attitudeLabel,npcScene,recordDeed,withAttackIntent})',{AsyncStorage:{}});
const cleric=r.readyHero('cleric'),hp={current:10,temp:0};
const valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(cleric,JSON.parse(JSON.stringify(g)),h,true),cleric);
const camp=(()=>{const g={...r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0),stage:'inn'};delete g.openingAttackAvailable;return g;})();
const mem=(g,id)=>g.npcMemory?.[id];
assert.ok(valid(camp));assert.equal(camp.story.npcs.keeper.ties.other,'friend');
// ---- Killing someone dear: a grudge that never fades ----
const kill=r.adventureStep(camp,hp,cleric,{type:'npc-attack',target:'mara',weapon:'Mace'},()=>0.99);
assert.equal(kill.game.npcFate.mara,'dead');
assert.equal(mem(kill.game,'keeper').attitude,'hostile');assert.equal(mem(kill.game,'keeper').grudge,'The player killed Tobin Reed, my friend.');
assert.ok(kill.events.includes('Captain Oona Brask will never forgive you.'));assert.ok(kill.game.journal.entries.some(e=>e.title==='A grudge: Captain Oona Brask'));assert.ok(valid(kill.game));
// Kindness, gifts and apologies never undo it; she will not travel with you or serve you.
const kindness=r.commitDmTurn(cleric,{...kill.game,npcCombat:undefined},hp,null,{question:'I bury Tobin and give the captain my purse.',narration:'She takes it without a word.',relationships:[{npcId:'keeper',change:'grateful',memory:'The player buried Tobin and gave me their purse.'}]});
assert.equal(kindness.error,undefined);assert.equal(mem(kindness.game,'keeper').attitude,'hostile');assert.ok(mem(kindness.game,'keeper').memories.at(-1).includes('buried Tobin'));
assert.equal(r.attitudeLabel(r.npcScene(kindness.game).find(n=>n.id==='keeper')).label,'Sworn enemy · will never forgive you');
// ---- Saving a life: a bond that never fades ----
const knocked=r.adventureStep(r.withAttackIntent(camp,'I knock Tobin out'),hp,cleric,{type:'npc-attack',target:'mara',weapon:'Mace'},()=>0.99);
assert.equal(knocked.game.npcFate.mara,'unconscious');assert.equal(mem(knocked.game,'keeper').attitude,'hostile','Beating her friend senseless angers her');
const calm={...knocked.game};delete calm.npcCombat;
const heal=r.dmCommand(cleric,calm,'I cast Cure Wounds on Tobin',hp);assert.equal(heal.action?.request?.npcTarget,'mara');assert.equal(heal.action.request.forceDM,false,'Healing a person here resolves on its own');
const saved=r.adventureStep(calm,hp,cleric,heal.action,()=>0.5);
assert.equal(saved.error,undefined);assert.ok(saved.game.npcHP.mara>0);assert.equal(saved.game.npcFate,undefined);assert.equal(saved.health.current,hp.current,'Healing Tobin does not heal you');
assert.ok(saved.events.some(t=>/Cure Wounds on Tobin Reed: .*restored \d+ HP\. Tobin Reed stirs/.test(t)));
assert.equal(mem(saved.game,'mara').bond,'The player saved my life when I lay dying.');assert.equal(mem(saved.game,'mara').attitude,'devoted');
assert.equal(mem(saved.game,'keeper').bond,'The player saved the life of Tobin Reed, my friend.');assert.equal(mem(saved.game,'keeper').attitude,'devoted','Saving her friend outweighs having knocked him down');
assert.ok(saved.events.includes('Tobin Reed owes you a debt they will never forget.'));assert.ok(valid(saved.game));
// A bond survives lesser offences: still friendly at worst.
const rude=r.commitDmTurn(cleric,saved.game,hp,null,{question:'I mock Tobin\'s cooking.',narration:'He laughs it off, hurt.',relationships:[{npcId:'mara',change:'angered',memory:'The player mocked my cooking in front of everyone.'}]});
assert.equal(mem(rude.game,'mara').attitude,'friendly');assert.equal(r.attitudeLabel(r.npcScene(rude.game).find(n=>n.id==='mara')).label,'Devoted · owes you a debt');
// …but killing someone they love turns even a debt into a grudge.
const betrayal=r.adventureStep(saved.game,hp,cleric,{type:'npc-attack',target:'keeper',weapon:'Mace'},()=>0.99);
assert.equal(betrayal.game.npcFate.keeper,'dead');assert.equal(mem(betrayal.game,'mara').attitude,'hostile');assert.ok(mem(betrayal.game,'mara').grudge);assert.ok(mem(betrayal.game,'mara').bond,'The debt is still remembered');
assert.ok(betrayal.events.includes('Tobin Reed will never forgive you.'));assert.ok(valid(betrayal.game));
// Can't heal the dead.
assert.match(r.dmCommand(cleric,{...betrayal.game,npcCombat:undefined},'I cast Cure Wounds on Brask',hp).error,/dead/);
// ---- Ordinary deeds move people gradually ----
let g=camp;for(const [change,memory] of [['pleased','The player shared their rations with me.'],['grateful','The player mended my cart wheel.']])g=r.commitDmTurn(cleric,g,hp,null,{question:'I help Tobin.',narration:'He beams.',relationships:[{npcId:'mara',change,memory}]}).game;
assert.equal(mem(g,'mara').attitude,'friendly','Kindness warms, but devotion needs a life saved');assert.equal(mem(g,'mara').memories.length,2);assert.ok(valid(g));
g=r.commitDmTurn(cleric,g,hp,null,{question:'I call the captain a coward.',narration:'Her jaw tightens.',relationships:[{npcId:'keeper',change:'offended',memory:'The player called me a coward in front of my crew.'}]}).game;
assert.equal(mem(g,'keeper').attitude,'unfriendly');
g=r.commitDmTurn(cleric,g,hp,null,{question:'I pocket the captain\'s ledger.',narration:'She sees you do it.',relationships:[{npcId:'keeper',change:'angered',memory:'The player stole my ledger.'}]}).game;
assert.equal(mem(g,'keeper').attitude,'hostile');assert.equal(mem(g,'keeper').grudge,undefined,'Hostile, but not forever');assert.ok(valid(g));
// The DM's notes about someone dead this turn are dropped; a forged note type is refused.
const dropped=r.commitDmTurn(cleric,{...kill.game,npcCombat:undefined},hp,null,{question:'I look at the body.',narration:'Silence.',relationships:[{npcId:'mara',change:'grateful',memory:'Thanks from beyond.'},{npcId:'keeper',change:'adores',memory:'x y z'}]});
assert.equal(dropped.error,undefined);assert.ok(!mem(dropped.game,'mara').memories.includes('Thanks from beyond.'));assert.ok(!mem(dropped.game,'keeper').memories.includes('x y z'));
// ---- The main foe's end ----
let fight=r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0),h={current:60,temp:0};
for(let i=0;i<40&&fight.stage==='combat';i++){const s=r.adventureStep(fight,h,cleric,'attack:Mace',()=>0.7);fight=s.game;h=s.health;}
assert.equal(fight.foeFate,'slain');assert.ok(mem(fight,'keeper').memories.includes('The player killed the Bandit Cutthroat that threatened us.'));assert.equal(mem(fight,'keeper').attitude,'friendly');
// A story where the captain is the bandit's own kin: killing it is unforgivable, sparing it earns her thanks.
const kinStory=r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0);kinStory.story={...kinStory.story,npcs:{...kinStory.story.npcs,keeper:{...kinStory.story.npcs.keeper,ties:{other:'friend',foe:'kin',note:'The bandit is her runaway son.'}}}};
assert.ok(r.validStory(kinStory.story));
let k=kinStory;h={current:60,temp:0};for(let i=0;i<40&&k.stage==='combat';i++){const s=r.adventureStep(k,h,cleric,'attack:Mace',()=>0.7);k=s.game;h=s.health;}
assert.equal(mem(k,'keeper').grudge,'The player killed Bandit Cutthroat, my own kin.');assert.equal(mem(k,'mara').attitude,'friendly');
k=kinStory;h={current:60,temp:0};for(let i=0;i<40&&k.stage==='combat';i++){const s=r.adventureStep({...k,subdue:true},h,cleric,'attack:Mace',()=>0.7);k=s.game;h=s.health;}
assert.equal(k.foeFate,'subdued');assert.equal(mem(k,'keeper').grudge,undefined);assert.equal(mem(k,'keeper').attitude,'friendly');
// Bad ties are refused.
assert.ok(!r.validStory({...camp.story,npcs:{...camp.story.npcs,mara:{...camp.story.npcs.mara,ties:{other:'soulmate',foe:'enemy'}}}}));
// ---- Companions and the DM's view ----
const joined=r.commitDmTurn(cleric,camp,hp,{type:'recruitment',plans:[{npcId:'mara',decision:'join',reason:'He wants adventure.',terms:'Share the cooking.',dc:null}]},{question:'Tobin, will you join me?',narration:'He grins.',npcId:'mara'},()=>.9).game;
const left=r.recordDeed(joined,'mara','grudge','The player burned down my family farm.');assert.equal(left.game.followers.mara.status,'dismissed');assert.ok(left.lines.includes('Tobin Reed leaves your party.'));assert.ok(valid(left.game));
const refused=r.commitDmTurn(cleric,kill.game.npcCombat?{...kill.game,npcCombat:undefined}:kill.game,hp,{type:'recruitment',plans:[{npcId:'keeper',decision:'join',reason:'x y z',terms:'',dc:null}]},{question:'Captain, will you join me?',narration:'No.',npcId:'keeper'});
assert.match(refused.error,/will never travel with you/);
const social=r.dmContext(cleric,saved.game,hp).npcSocialState.find(n=>n.id==='keeper');assert.equal(social.bond,'The player saved the life of Tobin Reed, my friend.');assert.equal(social.ties.toOther,'friend');
console.log('Passed: grudges for killing someone dear (permanent, even over a debt), bonds for saving a life (permanent through lesser offences), healing people instead of yourself, gradual DM-recorded deeds, the foe\'s end by tie, and companions leaving over a grudge.');
