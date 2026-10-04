const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// People remember: a killing leaves a grudge in those who loved the victim (forgiven only through amends and time, or
// a grave one by saving a life), a life saved leaves a permanent bond, the main foe's end touches those tied to it, and the Dungeon Master records lesser deeds either way.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmCommand,dmContext,validAdventure,adventureSnapshot,validStory,attitudeLabel,npcScene,recordDeed,withAttackIntent,forgivenessOf,grudgeWeight,validDeeds,validNpcState,appendStoryLog,recordConsequences})',{AsyncStorage:{}});
const cleric=r.readyHero('cleric'),hp={current:10,temp:0};
const valid=(g,h=hp)=>r.validAdventure(r.adventureSnapshot(cleric,JSON.parse(JSON.stringify(g)),h,true),cleric);
// These checks are about deeds: whatever the camp makes of a dwarf at first sight is set aside (verify-regard covers it).
const camp=(()=>{const g={...r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0),stage:'inn'};delete g.openingAttackAvailable;delete g.npcMemory;return g;})();
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
assert.equal(r.attitudeLabel(r.npcScene(kindness.game).find(n=>n.id==='keeper')).label,'Sworn enemy · holds a grudge');
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
for(let i=0;i<80&&fight.stage==='combat';i++){const s=r.adventureStep(fight,h,cleric,fight.actionUsed?'end-turn':'attack:Mace',()=>0.7);fight=s.game;h=s.health;}
assert.equal(fight.foeFate,'slain');assert.ok(mem(fight,'keeper').memories.includes('The player killed the Bandit Cutthroat that threatened us.'));assert.equal(mem(fight,'keeper').attitude,'friendly');
// A story where the captain is the bandit's own kin: killing it is unforgivable, sparing it earns her thanks.
const kinStory=r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0);kinStory.story={...kinStory.story,npcs:{...kinStory.story.npcs,keeper:{...kinStory.story.npcs.keeper,ties:{other:'friend',foe:'kin',note:'The bandit is her runaway son.'}}}};
assert.ok(r.validStory(kinStory.story));
let k=kinStory;h={current:60,temp:0};for(let i=0;i<80&&k.stage==='combat';i++){const s=r.adventureStep(k,h,cleric,k.actionUsed?'end-turn':'attack:Mace',()=>0.7);k=s.game;h=s.health;}
assert.equal(mem(k,'keeper').grudge,'The player killed Bandit Cutthroat, my own kin.');assert.equal(mem(k,'mara').attitude,'friendly');
k=kinStory;h={current:60,temp:0};for(let i=0;i<80&&k.stage==='combat';i++){const s=r.adventureStep({...k,subdue:true},h,cleric,k.actionUsed?'end-turn':'attack:Mace',()=>0.7);k=s.game;h=s.health;}
assert.equal(k.foeFate,'subdued');assert.equal(mem(k,'keeper').grudge,undefined);assert.equal(mem(k,'keeper').attitude,'friendly');
// Bad ties are refused.
assert.ok(!r.validStory({...camp.story,npcs:{...camp.story.npcs,mara:{...camp.story.npcs.mara,ties:{other:'soulmate',foe:'enemy'}}}}));
// ---- Companions and the DM's view ----
const joined=r.commitDmTurn(cleric,camp,hp,{type:'recruitment',plans:[{npcId:'mara',decision:'join',reason:'He wants adventure.',terms:'Share the cooking.',dc:null}]},{question:'Tobin, will you join me?',narration:'He grins.',npcId:'mara'},()=>.9).game;
const left=r.recordDeed(joined,'mara','grudge','The player burned down my family farm.');assert.equal(left.game.followers.mara.status,'dismissed');assert.ok(left.lines.includes('Tobin Reed leaves your party.'));assert.ok(valid(left.game));
const refused=r.commitDmTurn(cleric,kill.game.npcCombat?{...kill.game,npcCombat:undefined}:kill.game,hp,{type:'recruitment',plans:[{npcId:'keeper',decision:'join',reason:'x y z',terms:'',dc:null}]},{question:'Captain, will you join me?',narration:'No.',npcId:'keeper'});
assert.match(refused.error,/will never travel with you/);
const social=r.dmContext(cleric,saved.game,hp).npcSocialState.find(n=>n.id==='keeper');assert.equal(social.bond,'The player saved the life of Tobin Reed, my friend.');assert.equal(social.ties.toOther,'friend');
// ---- Forgiveness: amends and time, never cheap ----
const keeperOf=g=>r.npcScene(g).find(n=>n.id==='keeper'),plainJson=v=>JSON.parse(JSON.stringify(v));
assert.ok(mem(kill.game,'keeper').memories.includes('You saw the player kill Tobin Reed, whom you knew.'),'Witnesses remember the victim by the story name: '+mem(kill.game,'keeper').memories.join(' | '));
const sworn=mem(kill.game,'keeper');assert.equal(sworn.grudgeWeight,'grave','A friend killed is a grave grudge');assert.equal(sworn.grudgeSince,camp.storyLog?.at(-1)?.id??0);assert.equal(sworn.amends,0);
assert.deepEqual(plainJson(r.forgivenessOf(kill.game,'keeper')),{weight:'grave',amends:0,needed:2,amendsToGo:2,daysPassed:0,daysNeeded:1,daysToGo:1,canForgive:false});
assert.equal(r.forgivenessOf(kill.game,'mara'),null,'The dead hold no grudge to forgive');
let fg={...kill.game,npcCombat:undefined};
const amend=(g,memory)=>{const t=r.commitDmTurn(cleric,g,hp,null,{question:'I try to make it right.',narration:'She hears you out.',relationships:[{npcId:'keeper',change:'amends',memory}]});assert.equal(t.error,undefined);return t;};
let step=amend(fg,'The player dug Tobin a grave with their own hands.');assert.ok(step.events.includes('Captain Oona Brask listens, if coldly.'));
assert.equal(r.attitudeLabel(keeperOf(step.game)).label,'Sworn enemy · amends 1 of 2');assert.match(mem(step.game,'keeper').response,/amends so far: 1 of 2/);
step=amend(step.game,'The player paid Tobin\'s debts to the last coin.');fg=step.game;
assert.equal(mem(fg,'keeper').amends,2);assert.equal(mem(fg,'keeper').attitude,'hostile','Amends alone do not lift a grudge');assert.ok(valid(fg));
// Too soon: a night has not passed since, so forgiveness the Dungeon Master records is dropped.
assert.equal(r.validDeeds([{npcId:'keeper',change:'forgave',memory:'I forgive you.'}],fg),false);
const early=r.commitDmTurn(cleric,fg,hp,null,{question:'I beg her to forgive me.',narration:'She turns away.',relationships:[{npcId:'keeper',change:'forgave',memory:'I forgive you.'}]});
assert.equal(early.error,undefined);assert.ok(mem(early.game,'keeper').grudge,'Forgiveness too soon is refused');
// A night's rest later the grudge can be set down.
fg={...fg,storyLog:r.appendStoryLog(fg.storyLog,'rest','Took a long rest at the camp.')};
assert.equal(r.forgivenessOf(fg,'keeper').canForgive,true);assert.equal(r.attitudeLabel(keeperOf(fg)).label,'Sworn enemy · might forgive you');
const mended=r.commitDmTurn(cleric,fg,hp,null,{question:'I stand by her at the grave.',narration:'At last she nods.',relationships:[{npcId:'keeper',change:'forgave',memory:'You buried him and paid what he owed. I forgive you.'}]});
assert.equal(mended.error,undefined);assert.ok(mended.events.includes('Captain Oona Brask forgives you.'));
const kept=mem(mended.game,'keeper');assert.equal(kept.grudge,undefined);assert.equal(kept.attitude,'indifferent');assert.equal(kept.forgave.weight,'grave');assert.equal(kept.forgave.grudge,'The player killed Tobin Reed, my friend.');
assert.equal(kept.amends,undefined);assert.equal(kept.grudgeWeight,undefined);assert.match(kept.response,/^Has forgiven the player/);
assert.equal(r.attitudeLabel(keeperOf(mended.game)).label,'Forgave you · trust is thin');assert.ok(mended.game.journal.entries.some(e=>e.title==='A grudge forgiven: Captain Oona Brask'));assert.ok(valid(mended.game));
// A later deed keeps the memory of forgiveness; a new grudge after it is harder to forgive.
const warmer=r.commitDmTurn(cleric,mended.game,hp,null,{question:'I bring her bread.',narration:'She takes it.',relationships:[{npcId:'keeper',change:'pleased',memory:'The player brought me bread.'}]}).game;
assert.ok(mem(warmer,'keeper').forgave,'The forgiveness is remembered');assert.equal(mem(warmer,'keeper').attitude,'friendly');
const again=r.recordDeed(mended.game,'keeper','grudge','The player burned my ship.');assert.equal(r.forgivenessOf(again.game,'keeper').needed,3);assert.ok(valid(again.game));
// ---- Saving the life of someone who holds a grudge ----
const downed=g=>({...g,npcCombat:undefined,npcHP:{...g.npcHP,keeper:0},npcFate:{...g.npcFate,keeper:'unconscious'}});
const rescue=g=>{const cmd=r.dmCommand(cleric,g,'I cast Cure Wounds on Brask',hp);assert.ok(cmd.action,cmd.error);const s=r.adventureStep(g,hp,cleric,cmd.action,()=>0.5);assert.equal(s.error,undefined);return s;};
const graveSaved=rescue(downed(kill.game));
assert.ok(graveSaved.events.includes('Captain Oona Brask forgives you: you saved a life.'),graveSaved.events.join(' | '));
assert.equal(mem(graveSaved.game,'keeper').grudge,undefined);assert.ok(mem(graveSaved.game,'keeper').bond);assert.equal(mem(graveSaved.game,'keeper').attitude,'friendly','A life saved: forgiven, and in their debt');assert.ok(valid(graveSaved.game));
// A blood grudge (the foe was her own kin): a life saved goes a long way, but is not the end of it.
let blood=kinStory;h={current:60,temp:0};for(let i=0;i<80&&blood.stage==='combat';i++){const s=r.adventureStep(blood,h,cleric,blood.actionUsed?'end-turn':'attack:Mace',()=>0.7);blood=s.game;h=s.health;}
assert.equal(mem(blood,'keeper').grudgeWeight,'blood');
blood={...blood,stage:'inn'};const bloodSaved=rescue(downed(blood));
assert.ok(bloodSaved.events.includes('Captain Oona Brask is grateful, but has not forgiven you.'),bloodSaved.events.join(' | '));
assert.equal(mem(bloodSaved.game,'keeper').amends,2);assert.ok(mem(bloodSaved.game,'keeper').grudge);assert.equal(mem(bloodSaved.game,'keeper').attitude,'hostile');
assert.deepEqual(plainJson(r.forgivenessOf(bloodSaved.game,'keeper')),{weight:'blood',amends:2,needed:2,amendsToGo:0,daysPassed:0,daysNeeded:2,daysToGo:2,canForgive:false});
// Two days on (a rest and a new chapter), it can be forgiven.
const later={...bloodSaved.game,storyLog:r.appendStoryLog(r.appendStoryLog(bloodSaved.game.storyLog,'rest','Took a long rest at the camp.'),'story','Chapter 2: The Long Road')};
assert.equal(r.forgivenessOf(later,'keeper').canForgive,true);
// ---- Old saves and forged records ----
const oldSave={...camp,npcMemory:{keeper:{attitude:'hostile',response:'Holds a grudge.',memories:['x y z'],grudge:'The player killed Tobin, my family.'}}};
assert.equal(r.grudgeWeight(oldSave.npcMemory.keeper),'blood');assert.equal(r.forgivenessOf(oldSave,'keeper').needed,3);assert.equal(r.forgivenessOf(oldSave,'keeper').daysNeeded,2);assert.ok(valid(oldSave),'An old grudge without a weight still loads');
for(const forged of [{amends:9},{forgave:{grudge:'x y z',memory:'Fine.'}},{grudgeWeight:'mild'},{grudgeSince:-1}])assert.equal(r.validNpcState({...oldSave,npcMemory:{keeper:{...oldSave.npcMemory.keeper,...forged}}}),false,JSON.stringify(forged));
assert.equal(r.validDeeds([{npcId:'mara',change:'amends',memory:'I am sorry.'}],camp),false,'No amends to someone not wronged');
assert.equal(r.validDeeds([{npcId:'keeper',change:'forgave',memory:'Let it go.'}],{...camp,npcMemory:{keeper:{attitude:'unfriendly',response:'Wary.',memories:[]}}}),true,'A lesser wrong may be let go');
const letGo=r.recordDeed({...camp,npcMemory:{keeper:{attitude:'hostile',response:'Wary.',memories:[]}}},'keeper','forgave','Words were said. Let it go.');assert.equal(letGo.game.npcMemory.keeper.attitude,'indifferent');assert.ok(letGo.lines.includes('Captain Oona Brask lets it go.'));
console.log('Passed: grudges for killing someone dear (outlasting a debt; forgiven only through amends and time, or a grave one at once by saving a life; harder the second time; old grudges weighed by their words), bonds for saving a life (permanent through lesser offences), healing people instead of yourself, gradual DM-recorded deeds, the foe\'s end by tie, and companions leaving over a grudge.');
