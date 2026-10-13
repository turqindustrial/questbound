// What the game offers is what the rules accept (dmContext.js dmChoices, quickActions.js, dmCommands.js,
// adventureRules.js): Hellish Rebuke after the action is spent is a reaction the engine takes; a written story offers
// no long rest once the keeper is dead or hostile, no healing draught at full health and no vault of the old crossroads
// tale; a party's Cast… chip heals the hero it was made for even when two heroes share a name, and a typed name is
// read whole before a first name.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
const source=rulesSource();
const r=vm.runInNewContext(source+'\n;({readyHero,makeCharacter,blankBuild,newAdventure,freshStoryGame,hostileEncounterGame,hostileFoes,adventureStep,combatBasics,dmChoices,dmCommand,quickActions,spellActions,attackOptions,startParty,joinParty,partyView,validAdventure,adventureSnapshot})',{AsyncStorage:{},console});
const plain=v=>JSON.parse(JSON.stringify(v));
const person=name=>({name,species:'Human',gender:'man',role:'A resident.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar.',personality:'Plain.',ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const story={id:'offers-1',status:'active',title:'The Notch',premise:'A pass is closed.',opening:'Snow at the gate.',objective:'Open the pass.',resolution:'The pass is open.',secret:'The warden sold it.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 locations:{inn:{name:'Bellwether Refuge',description:'A refuge.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A cut.',kind:'mountain'},tower:{name:'Shrine',description:'A shrine.',kind:'shrine'}},npcs:{keeper:person('Tamsin Rook'),mara:person('Rusk Hale')}};
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;

// ---- Hellish Rebuke once the action is spent ----
{
 const hero=r.makeCharacter({...r.blankBuild(),name:'Ash Paladin',species:'Human',class:'Paladin',background:'Soldier',bonusMode:'three',baseScores:[15,10,13,8,12,14],level:3,advancements:[],spellSelectionVersion:2,plannedSubclass:'Oath of Ashes',spells:[]});
 let g={...r.hostileEncounterGame(hero,r.newAdventure(hero),pick('bandit')),openingAttackAvailable:false,potions:2,enemyHP:300},h={current:r.combatBasics(hero).hp,temp:0},seen=false;
 const w='attack:'+r.attackOptions(hero)[0].name;
 for(let i=0;i<16&&g.stage==='combat'&&!seen;i++){
  const s=r.adventureStep(g,h,hero,g.actionUsed?'end-turn':w,()=>0.85);assert.ok(!s.error,s.error);g=s.game;h=s.health;
  if(!(g.actionUsed&&g.hurtBy&&r.spellActions(hero,g).some(c=>c.key==='spell:hellish-rebuke')))continue;
  seen=true;
  const cmd=r.dmCommand(hero,g,'I cast Hellish Rebuke at the enemy.',h);assert.ok(cmd.action?.request?.reaction,'the chip reads as a reaction');
  const done=r.adventureStep(g,h,hero,cmd.action,()=>0.5);
  assert.equal(done.error,undefined,'Hellish Rebuke after the action is a reaction the engine takes');
  assert.ok(done.game.reactionUsed&&done.game.actionUsed,'it spends the reaction and leaves the action spent');
  assert.ok(!r.spellActions(hero,done.game).some(c=>c.key==='spell:hellish-rebuke'),'and is not offered twice');
  assert.ok(r.adventureStep(done.game,done.health,hero,w,()=>0.5).error,'the action is still spent');
 }
 assert.ok(seen,'the scene reaches a hurt paladin with the action spent');
 // Health not known is full health (a hero who has just joined a party): nothing that only heals is offered.
 const fresh={...r.hostileEncounterGame(hero,r.newAdventure(hero),pick('bandit')),openingAttackAvailable:false,potions:2};
 const offered=r.dmChoices(hero,fresh,null).map(c=>c.id);
 for(const id of ['potion','class:hands'])assert.ok(!offered.includes(id),id+' is not offered at full health');
 for(const c of r.dmChoices(hero,fresh,null))assert.ok(!r.adventureStep(fresh,null,hero,c.action,()=>0.5).error||/^npc-|^again:/.test(c.id),'in the fight, '+c.id+' is accepted');
 // The same in a brawl at the refuge.
 const inn={...r.freshStoryGame(hero,plain(story),r.newAdventure(hero)),potions:2},blow=r.dmChoices(hero,inn,null).find(c=>c.id.startsWith('npc-attack:mara'));
 const brawl=r.adventureStep(inn,null,hero,blow.action,()=>0.2);assert.ok(brawl.game.npcCombat?.active,'a brawl breaks out');
 const inBrawl=r.dmChoices(hero,brawl.game,null).map(c=>c.id);
 for(const id of ['potion','class:hands'])assert.ok(!inBrawl.includes(id),id+' is not offered in a brawl at full health');
}

// ---- A written story at the refuge: long rest, draughts, the vault ----
{
 const hero=r.readyHero('fighter'),max=r.combatBasics(hero).hp;
 const g={...r.freshStoryGame(hero,plain(story),r.newAdventure(hero)),potions:2};
 const ids=(game,health)=>r.dmChoices(hero,game,health).map(c=>c.id);
 assert.ok(ids(g,{current:max-4,temp:0}).includes('long-rest'),'the keeper offers a long rest');
 assert.ok(!ids(g,{current:max,temp:0}).includes('potion'),'no draught is offered at full health');
 assert.ok(!ids(g,null).includes('potion'),'nor with health unknown (taken as full, as the engine does)');
 assert.ok(ids(g,{current:max-4,temp:0}).includes('potion'),'a draught is offered when hurt');
 assert.equal(r.adventureStep(g,{current:max-4,temp:0},hero,'potion',()=>0.5).error,undefined,'and drunk');
 const dead={...g,npcFate:{keeper:'dead'},npcHP:{keeper:0}},hostile={...g,npcMemory:{...(g.npcMemory??{}),keeper:{...(g.npcMemory?.keeper??{}),attitude:'hostile'}}};
 for(const [why,scene] of [['dead',dead],['hostile',hostile]]){
  assert.ok(!ids(scene,{current:max-4,temp:0}).includes('long-rest'),'no long rest once the keeper is '+why);
  assert.ok(!r.quickActions(hero,scene,{current:max-4,temp:0}).some(c=>c.key==='long-rest'),'nor a Long rest chip ('+why+')');
  assert.ok(r.adventureStep(scene,{current:max-4,temp:0},hero,'long-rest',()=>0.5).error,'which the engine would refuse ('+why+')');
 }
 // The tale's foe beaten at the notch: the crossroads vaults are no part of a story.
 const notch={...g,stage:'bridge',enemyHP:0,foeFate:'slain'};
 assert.ok(!ids(notch,{current:max,temp:0}).some(id=>id.startsWith('dungeon:')),'no vault choices in a written story');
 // Everything offered at the refuge and the notch is accepted.
 for(const [where,scene,health] of [['the refuge',g,{current:max-4,temp:0}],['the notch',notch,{current:max-4,temp:0}]])
  for(const c of r.dmChoices(hero,scene,health)){const res=r.adventureStep(scene,health,hero,c.action,()=>0.5);assert.ok(!res.error||/ONLY when/.test(c.label),where+': '+c.id+' is accepted ('+res.error+')');}
}

// ---- A party's Cast… chips when two heroes share a name ----
{
 const cleric=r.readyHero('cleric'),kara=r.readyHero('fighter'),twin=r.readyHero('fighter'),heroes={A:cleric,B:kara,C:twin};
 const max=r.combatBasics(kara).hp;
 let snap=r.startParty(r.adventureSnapshot(cleric,r.newAdventure(cleric),{current:r.combatBasics(cleric).hp,temp:0},true),'A','Sam');
 for(const id of ['B','C'])snap=r.joinParty(snap,id,{character:JSON.stringify(heroes[id]),game:null,health:null,name:'P'+id}).snapshot;
 const table=plain(r.partyView(snap,'A'));
 // The first Kara Vell has died; the second is hurt.
 table.game.party.members.B={...table.game.party.members.B,status:'dead',health:null,hero:{...table.game.party.members.B.hero,death:{cause:'Struck down by a bandit',place:'The inn',at:'inn',massive:false}}};
 table.game.party.members.C={...table.game.party.members.C,health:{current:3,temp:0}};
 const v=r.partyView(table,'A');
 const chips=r.spellActions(cleric,v.game).filter(c=>/:party:/.test(c.key));
 assert.ok(chips.length>0&&chips.every(c=>c.key.endsWith(':party:C')),'the Cast… chips are for the hurt hero, not the dead one');
 for(const c of chips){
  assert.equal(c.action?.request?.partyTarget,'C','the chip carries the hero it was made for: '+c.key);
  const res=r.adventureStep(v.game,v.health,cleric,c.action,()=>0.5);
  assert.equal(res.error,undefined,c.key+' is accepted');
  assert.ok(res.game.party.members.C.health.current>3,c.key+' heals the hurt Kara Vell');
 }
 const typed=r.dmCommand(cleric,v.game,'I cast Cure Wounds on Kara Vell.',v.health);
 assert.equal(typed.action?.request?.partyTarget,'C','a typed full name goes to the living namesake');
 // Two living heroes called Kara: a first name alone is not enough.
 table.game.party.members.B={...table.game.party.members.B,status:'up',health:{current:2,temp:0},hero:{...table.game.party.members.B.hero}};delete table.game.party.members.B.hero.death;
 const both=r.partyView(table,'A'),asked=r.dmCommand(cleric,both.game,'I cast Cure Wounds on Kara.',both.health);
 assert.ok(asked.error&&asked.soft&&/Name them in full/.test(asked.error),'a shared first name asks for the whole name');
 const twins=r.spellActions(cleric,both.game).filter(c=>c.key==='spell:cure:party:B'||c.key==='spell:cure:party:C');
 assert.deepEqual(plain(twins.map(c=>c.action?.request?.partyTarget).sort()),['B','C'],'each namesake has a chip of their own');
}
console.log('Offered moves: Hellish Rebuke after the action is taken as a reaction; a story offers no long rest from a dead or hostile keeper, no draught at full health and no crossroads vaults, and everything it offers is accepted; party heal chips carry their hero, whatever the names.');
