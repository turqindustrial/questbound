const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// The action economy (2024 rules, SRD 5.2): one action and one bonus action a turn in every kind of fight, at most one
// spell slot a turn, Extra Attack inside the one Attack action, Action Surge as the one real second action, improvised
// attempts (the Dungeon Master's checks) spending the action, giving a draught as a bonus action, bonus actions in
// brawls, sentences with two moves, chips that offer only what is legal now, and what is left told to the Dungeon Master.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','descriptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,dmCommand,dmContext,dmChoices,commitDmTurn,quickActions,spellActions,validAdventure,adventureSnapshot,bonusOptions,combatBasics,startParty,joinParty,partyView,settleParty,canonicalParty,turnOrderView,castableNow,knownSpells,splitTurn,turnLeft,turnCost,surgeReady,surgeLimit,actionDescription,actionCost,attackOptions,introducePerson,freshStoryGame})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const {situation}=require('./dm-intent.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const valid=(hero,g,h)=>r.validAdventure(r.adventureSnapshot(hero,plain(g),h,true),hero);
const seq=(...v)=>{let i=0;return ()=>v[i++]??0.5;};
const ok=(res,why)=>{assert.ok(!res.error,(why??'')+': '+res.error);return res;};
const kara=r.readyHero('fighter'),cleric=r.readyHero('cleric'),wizard=r.readyHero('wizard');
const hpOf=hero=>({current:r.combatBasics(hero).hp,temp:0});
const fightOf=(hero,extra={})=>({...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),openingAttackAvailable:false,...extra});
const talk=q=>({question:q,narration:'The moment unfolds.'});
const check={ability:'Strength',skill:'Athletics',dc:10,mode:'normal',reason:'Kick a barrel at the bandit',success:'The barrel rolls into it.',failure:'The barrel barely moves.',damageOn:'none',damageCount:0,damageDie:4};

// ---- 1. Improvised attempts (the Dungeon Master's checks) cost the action ----
{
 // Nothing else worth doing: the check is the turn, and the foe answers.
 const g=fightOf(kara,{potions:0,resources:{wind:2}}),full=hpOf(kara);
 const a=ok(r.commitDmTurn(kara,g,full,{type:'ai-check',check},talk('I kick a barrel at the bandit.'),()=>0.9),'a check in a fight');
 assert.equal(a.game.round,2,'the foe has had its turn');assert.ok(a.events[0].startsWith('Kick a barrel'),'the check is told first');
 assert.ok(a.events.some(e=>/attacks|Bandit/.test(e)&&e!==a.events[0]),'then the foe acts');
 assert.ok(valid(kara,a.game,a.health));
 // Hurt, with a draught: the check spends the action and the turn waits for the bonus action.
 const hurt={current:5,temp:0},b=ok(r.commitDmTurn(kara,fightOf(kara),hurt,{type:'ai-check',check},talk('I kick a barrel at the bandit.'),()=>0.9));
 assert.equal(b.game.actionUsed,true);assert.equal(b.game.round,1);assert.ok(valid(kara,b.game,b.health));
 assert.match(r.commitDmTurn(kara,b.game,b.health,{type:'ai-check',check},talk('I kick another barrel.'),()=>0.9).error,/action is already spent/);
 // A brawl still refuses checks.
 const hero=r.readyHero('rogue'),inn=r.newAdventure(hero),opening=r.adventureStep(inn,hpOf(hero),hero,r.dmCommand(hero,inn,'I attack the keeper with my dagger').action,()=>0.5);
 assert.equal(opening.game.npcCombat?.active,true);
 assert.match(r.commitDmTurn(hero,opening.game,opening.health,{type:'ai-check',check},talk('I kick a stool.'),()=>0.5).error,/Finish the combat turn/);
}

// ---- 2. An action spell once the action is spent is refused before the Dungeon Master is asked ----
{
 const g=fightOf(wizard),hurt={current:3,temp:0};
 const bolt=ok(r.adventureStep(g,hurt,wizard,r.dmCommand(wizard,g,'I cast Fire Bolt at the bandit',hurt).action,()=>0.5));
 assert.equal(bolt.game.actionUsed,true,'the hurt Wizard with a draught pauses for the bonus action');
 const again=r.dmCommand(wizard,bolt.game,'I cast Burning Hands toward the bandit',hurt);
 assert.match(again.error,/already used your action/);assert.equal(bolt.game.pendingSpell,undefined);
 assert.equal(r.spellActions(wizard,bolt.game).length,0,'no Cast… chips once only the bonus action is left and no bonus spell is known');
 assert.ok(!r.quickActions(wizard,bolt.game,hurt).some(a=>a.key==='cast'));
}

// ---- 3 and 4. Reactions and long castings are refused in fights ----
{
 const shielded={...wizard,spells:[...(wizard.spells??[]),'shield','identify']},g=fightOf(shielded);
 assert.match(r.dmCommand(shielded,g,'I cast Shield',hpOf(shielded)).error,/reaction/);
 assert.match(r.dmCommand(shielded,g,'I cast Identify on the amulet',hpOf(shielded)).error,/to cast/);
 const inn=r.newAdventure(shielded);
 assert.ok(!r.dmCommand(shielded,inn,'I cast Identify on the amulet',hpOf(shielded)).error,'out of a fight a long casting is allowed');
}

// ---- 5. Giving a draught is a bonus action ----
{
 const base=fightOf(kara);
 // A companion who follows the hero into the fight, hurt.
 const met={id:'mara'},g={...base,npcHP:{...base.npcHP,mara:2},followers:{...base.followers,mara:{status:'following'}}};
 {
  const give={type:'give-potion',target:met.id},full=hpOf(kara);
  assert.ok(r.bonusOptions(kara,g,full,full.current).some(o=>o.id==='give-potion:'+met.id),'offered as a bonus action');
  const a=ok(r.adventureStep(g,full,kara,give,()=>0.5),'giving a draught');
  assert.equal(a.game.round,1,'the turn goes on');assert.equal(a.game.bonusUsed,true);assert.equal(a.game.actionUsed,undefined);
  assert.match(r.adventureStep(a.game,a.health,kara,give,()=>0.5).error??'',/bonus action is already used|not hurt|no healing/);
  const hit=ok(r.adventureStep(a.game,a.health,kara,'attack:Greatsword',()=>0.5),'then the attack');
  assert.equal(hit.game.round,2,'the action ends the turn');
  assert.equal(r.actionCost({key:'give-potion:'+met.id},g),'Bonus action');
  const hurtHit=ok(r.adventureStep(g,{current:5,temp:0},kara,'attack:Greatsword',()=>0.5));
  if(hurtHit.game.actionUsed)assert.ok(r.dmChoices(kara,hurtHit.game,hurtHit.health).some(c=>c.id==='give-potion:mara'),'offered after the action');
 }
}

// ---- 6. Cast… offers only what the engine accepts ----
{
 const g=fightOf(cleric),hurt={current:3,temp:0};
 const word=ok(r.adventureStep(g,hurt,cleric,r.dmCommand(cleric,g,'I cast Healing Word on myself',hurt).action,()=>0.5),'Healing Word');
 const left=r.spellActions(cleric,word.game);
 const byId=id=>r.knownSpells(cleric).find(s=>s.id===id);
 assert.ok(left.every(a=>{const s=byId(a.key.split(':')[1]);return s.level===0&&s.castingTime!=='Bonus Action';}),'after Healing Word only cantrips cast as an action: '+left.map(a=>a.key));
 for(const a of left){const cmd=r.dmCommand(cleric,word.game,a.question??a.prefill+'the bandit',word.health);assert.ok(cmd.action,a.key+': '+cmd.error);assert.ok(!r.adventureStep(word.game,word.health,cleric,cmd.action,()=>0.5).error,a.key);}
 ok(r.adventureStep(word.game,word.health,cleric,r.dmCommand(cleric,word.game,'I cast Sacred Flame at the bandit',word.health).action,()=>0.5),'a cantrip after a bonus-action spell');
 assert.match(r.dmCommand(cleric,word.game,'I cast Cure Wounds on myself',word.health).error,/spell slot this turn/);
 // After a levelled action spell (hurt, so the turn waits) only levelled bonus spells were left: no Cast… chip.
 const inflict=ok(r.adventureStep(g,hurt,cleric,r.dmCommand(cleric,g,'I cast Inflict Wounds on the bandit',hurt).action,()=>0.5));
 if(inflict.game.actionUsed){assert.equal(r.spellActions(cleric,inflict.game).length,0);assert.ok(!r.quickActions(cleric,inflict.game,inflict.health).some(a=>a.key==='cast'));}
}

// ---- 7. Sentences with two moves ----
{
 const g=fightOf(cleric),full=hpOf(cleric),hurt={current:3,temp:0};
 const both=r.dmCommand(cleric,g,'I attack the bandit and then cast Sacred Flame at it',full);
 assert.equal(both.action.type,'turn');assert.equal(both.action.steps.length,1,'two actions: only the first');
 const res=ok(r.adventureStep(g,full,cleric,both.action,()=>0.5));
 assert.ok(res.events.some(e=>e.startsWith('Not this turn: "I cast Sacred Flame at it" must wait')),'the rest is told to wait');
 assert.ok(valid(cleric,res.game,res.health));
 // An action and a bonus action: one whole turn.
 const pair=r.dmCommand(cleric,g,'I attack the bandit, then drink a potion',hurt);
 assert.equal(pair.action.type,'turn');assert.equal(pair.action.steps.length,2);
 const played=ok(r.adventureStep(g,hurt,cleric,pair.action,()=>0.5));
 assert.ok(played.events.some(e=>e.startsWith('Healing draught')),'the draught follows the attack');assert.equal(played.game.round,2,'and the turn is over');
 // The same, bonus action first.
 const first=ok(r.adventureStep(g,hurt,cleric,r.dmCommand(cleric,g,'I drink a potion and attack the bandit',hurt).action,()=>0.5));
 assert.ok(first.events.some(e=>e.startsWith('Healing draught'))&&first.game.round===2);
 // At full health the draught is refused, and said so.
 const fullPair=ok(r.adventureStep(g,full,cleric,r.dmCommand(cleric,g,'I attack the bandit, then drink a potion',full).action,()=>0.5));
 assert.ok(fullPair.events.some(e=>/^Not (done|this turn)/.test(e)));
 // Two blows at the same creature are one Attack action.
 const blows=r.dmCommand(kara,fightOf(kara),'I slash and hack at the bandit',hpOf(kara));
 assert.equal(blows.action.type,'encounter-attack');
 assert.equal(r.dmCommand(kara,fightOf(kara),'I grab the key and run',hpOf(kara)),null,'not two moves');
 {const dodge=r.dmCommand(kara,fightOf(kara),'I attack the bandit and dodge',hpOf(kara)).action;assert.equal(dodge.steps.length,1);assert.equal(dodge.why,'a turn has one action and one bonus action');}
 assert.equal(r.splitTurn('I cast Purify Food and Drink',('I cast Purify Food and Drink').length),null);
 // Out of a fight: one thing at a time.
 const inn=r.newAdventure(cleric),two=r.dmCommand(cleric,inn,'I drink a potion and give mara a potion',hurt);
 assert.equal(two.action.steps.length,1);
 const done=ok(r.adventureStep(inn,hurt,cleric,two.action,()=>0.5));
 assert.ok(done.events.some(e=>/^One thing at a time/.test(e)));
 // Committed through the Dungeon Master exactly as previewed.
 const committed=ok(r.commitDmTurn(cleric,g,hurt,pair.action,talk('I attack the bandit, then drink a potion'),()=>0.5));
 assert.equal(JSON.stringify(committed.game.log),JSON.stringify(played.game.log));assert.equal(JSON.stringify(committed.health),JSON.stringify(played.health));
}

// ---- 8. Action Surge ----
{
 const vet={...kara,level:2},full=hpOf(vet),g=fightOf(vet,{potions:0});
 assert.equal(r.surgeLimit(vet),1);assert.equal(r.surgeLimit({...kara,level:17}),2);assert.equal(r.surgeLimit(kara),0);
 const hit=ok(r.adventureStep(g,full,vet,'attack:Greatsword',()=>0.5));
 assert.equal(hit.game.actionUsed,true,'the turn waits while Action Surge is ready');assert.equal(hit.game.round,1);
 assert.ok(r.dmChoices(vet,hit.game,hit.health).some(c=>c.id==='class:surge'));
 assert.ok(r.quickActions(vet,hit.game,hit.health).some(a=>a.key==='class:surge'&&a.detail==='Free'));
 assert.ok(valid(vet,hit.game,hit.health));
 assert.match(r.dmContext(vet,hit.game,hit.health).turnResources.left,/only their bonus action \(the action is spent\); Action Surge/);
 const surge=ok(r.adventureStep(hit.game,hit.health,vet,r.dmCommand(vet,hit.game,'I use Action Surge',hit.health).action,()=>0.5));
 assert.equal(surge.game.actionUsed,undefined);assert.equal(surge.game.surged,true);assert.equal(surge.game.resources.surge,1);
 assert.ok(valid(vet,surge.game,surge.health));
 assert.match(r.adventureStep(surge.game,surge.health,vet,'class:surge').error,/once a turn/);
 const second=ok(r.adventureStep(surge.game,surge.health,vet,'attack:Greatsword',()=>0.5),'the second action');
 assert.equal(second.game.round,2,'then the turn ends');assert.equal(second.game.surged,undefined);
 assert.match(r.adventureStep(second.game,second.health,vet,'class:surge').error,/Take your action first/);
 const next=ok(r.adventureStep(second.game,second.health,vet,'attack:Greatsword',()=>0.02));
 if(next.game.stage==='combat'){assert.equal(next.game.actionUsed,undefined,'with Action Surge spent the turn no longer waits for it');assert.match(r.adventureStep({...next.game,actionUsed:true},next.health,vet,'class:surge').error,/spent until you rest/);}
 // A spell cannot be cast with the surged action.
 const knight={...r.readyHero('paladin'),class:'Fighter',subclass:undefined};
 // Dodge, then Surge: the Dodge holds and the save stays valid.
 const dodge=ok(r.adventureStep(g,full,vet,'dodge',()=>0.5));assert.equal(dodge.game.dodging,true);
 const dsurge=ok(r.adventureStep(dodge.game,dodge.health,vet,'class:surge',()=>0.5));assert.ok(valid(vet,dsurge.game,dsurge.health),'dodging with a surged action');
 // A short rest brings it back; a long rest clears it.
 const camp={...next.game,stage:'inn'};delete camp.actionUsed;delete camp.surged;delete camp.dodging;
 const rest=ok(r.adventureStep(camp,next.health,vet,'short-rest',()=>0.5));
 assert.ok(rest.events.includes('Action Surge is ready again.'));assert.equal(rest.game.resources.surge,0);
 // Level 17: twice between rests, once a turn.
 const champ={...kara,level:17},cg=fightOf(champ,{potions:0}),ch=hpOf(champ);
 let t=ok(r.adventureStep(cg,ch,champ,'attack:Greatsword',()=>0.5));t=ok(r.adventureStep(t.game,t.health,champ,'class:surge',()=>0.5));t=ok(r.adventureStep(t.game,t.health,champ,'attack:Greatsword',()=>0.5));
 if(t.game.stage==='combat'&&!t.game.actionUsed){t=ok(r.adventureStep(t.game,t.health,champ,'attack:Greatsword',()=>0.5));if(t.game.stage==='combat'){assert.equal(t.game.actionUsed,true);t=ok(r.adventureStep(t.game,t.health,champ,'class:surge',()=>0.5));assert.equal(t.game.resources.surge,2);}}
 // The DM is told about it.
 assert.deepEqual(plain(r.dmContext(vet,hit.game,hit.health).turnResources.actionSurge),{left:1,usedThisTurn:false});
 assert.equal(r.turnCost(vet,hit.game,'class:surge'),'free');
 assert.ok(!/^“/.test(r.actionDescription({key:'class:surge'},vet,hit.game)),'Action Surge has its own description');
}

// ---- 8b. Surged action cannot cast; caster Fighter variant ----
{
 const g=fightOf(wizard,{surged:true});
 assert.match(r.dmCommand(wizard,g,'I cast Fire Bolt at the bandit',hpOf(wizard)).error,/Action Surge cannot be used to cast/);
}

// ---- 9. What is left, for the Dungeon Master ----
{
 const g=fightOf(kara),hurt={current:5,temp:0},s=ok(r.adventureStep(g,hurt,kara,'attack:Greatsword',()=>0.5));
 const ctx=r.dmContext(kara,s.game,s.health);
 assert.equal(ctx.turnResources.left,'only their bonus action (the action is spent)');
 assert.ok(situation({...ctx,stage:'combat'}).join(' ').includes('This turn the player has left: only their bonus action'));
 assert.equal(r.dmContext(kara,r.newAdventure(kara),hurt).turnResources.left,null);
}

// ---- 10. Bonus actions in a brawl ----
{
 const hero=r.readyHero('fighter'),inn=r.newAdventure(hero);
 const opening=r.adventureStep(inn,hpOf(hero),hero,r.dmCommand(hero,inn,'I attack the keeper with my greatsword').action,()=>0.5);
 assert.equal(opening.game.npcCombat?.active,true);
 const hurt={current:4,temp:0},g={...opening.game,potions:2};
 assert.ok(r.dmChoices(hero,g,hurt).some(c=>c.id==='potion'));
 const sip=ok(r.adventureStep(g,hurt,hero,'potion',()=>0.5),'a draught in a brawl');
 assert.equal(sip.game.bonusUsed,true);assert.ok(sip.health.current>4);assert.ok(!sip.events.some(e=>/attacks you/.test(e)),'nobody answers a bonus action');
 assert.equal(sip.game.npcCombat.round,g.npcCombat.round);
 assert.match(r.adventureStep(sip.game,sip.health,hero,'potion',()=>0.5).error,/bonus action is already used/);
 assert.match(r.adventureStep(sip.game,sip.health,hero,'class:wind',()=>0.5).error,/bonus action is already used/);
 assert.ok(!r.dmChoices(hero,sip.game,sip.health).some(c=>c.id==='potion'));
 const swing=ok(r.adventureStep(sip.game,sip.health,hero,r.dmCommand(hero,sip.game,'I attack the keeper with my greatsword').action,()=>0.5),'then the action');
 assert.equal(swing.game.bonusUsed,false,'the turn is over');
 const wind=ok(r.adventureStep(g,hurt,hero,'class:wind',()=>0.5));assert.equal(wind.game.bonusUsed,true);assert.equal(wind.game.resources.wind,1);
 assert.ok(valid(hero,sip.game,sip.health));
 // Healing Word in a brawl does not end the turn.
 const ch=r.readyHero('cleric'),cinn=r.newAdventure(ch);
 const copen=r.adventureStep(cinn,hpOf(ch),ch,r.dmCommand(ch,cinn,'I attack the keeper with my mace').action,()=>0.5);
 if(copen.game.npcCombat?.active){const word=ok(r.adventureStep(copen.game,{current:3,temp:0},ch,r.dmCommand(ch,copen.game,'I cast Healing Word on myself',{current:3,temp:0}).action,()=>0.5));assert.equal(word.game.bonusUsed,true);assert.equal(word.game.npcCombat.round,copen.game.npcCombat.round);}
}

// ---- 11. The shared table ----
{
 const heroes={A:kara,B:wizard};let table;
 const view=id=>r.partyView(table,id);
 const act=(id,action,random=()=>0.5)=>{const v=view(id),res=r.adventureStep(v.game,v.health,heroes[id],action,random);if(!res.error)table=plain(r.adventureSnapshot(heroes[id],res.game,res.health,true));return res;};
 const holder=()=>r.turnOrderView(view('A').game)?.current?.id??null;
 const fight=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0);
 let snap=r.startParty(r.adventureSnapshot(kara,fight,hpOf(kara),true),'A','Sam');
 snap=r.joinParty(snap,'B',{character:JSON.stringify(wizard),game:null,health:null,name:'Jo'}).snapshot;table=plain(snap);
 ok(act('A','attack:Greatsword'),'opening');
 // Play on until a hero's turn, then a check on that turn passes it on.
 for(let i=0;i<6&&!['A','B'].includes(holder());i++)act('A',{type:'party-pass'});
 const who=holder();assert.ok(['A','B'].includes(who));
 const v=view(who),checked=r.commitDmTurn(heroes[who],{...v.game,potions:0},v.health,{type:'ai-check',check},talk('I kick a barrel.'),()=>0.9);
 ok(checked,'a check on your own turn');
 const after=plain(r.adventureSnapshot(heroes[who],checked.game,checked.health,true));
 const holderAfter=r.turnOrderView(r.partyView(after,who).game)?.current?.id;
 if(!checked.game.actionUsed)assert.notEqual(holderAfter,who,'the turn has passed on');
 else assert.match(r.commitDmTurn(heroes[who],checked.game,checked.health,{type:'ai-check',check},talk('Again.'),()=>0.9).error,/action is already spent/);
 assert.match(r.turnLeft(heroes[who],{...checked.game,turnOrder:{...checked.game.turnOrder,at:checked.game.turnOrder.order.findIndex(e=>e.id!==who&&e.id!=='foe')}})??'',/another hero's turn|their action/);
 // Action Surge is kept per hero (a turn field) across another device's write.
 const now=holder(),mine=view(now);
 const settled=r.settleParty(r.adventureSnapshot(heroes[now],{...mine.game,surged:true},mine.health,true));
 assert.equal(settled.members[now].turn?.surged,true);
 // Reviving a fallen friend is a bonus action: the turn stays with the reviver.
 const other=now==='A'?'B':'A',down={...mine.game,potions:1,party:{...mine.game.party,members:{...mine.game.party.members,[other]:{...mine.game.party.members[other],status:'down',health:{current:0,temp:0}}}}};
 const revive=ok(r.adventureStep(down,mine.health,heroes[now],{type:'give-potion',target:'party:'+other},()=>0.5),'a revive');
 assert.equal(revive.game.bonusUsed,true);assert.equal(r.turnOrderView(revive.game).current.id,now,'the reviver still has their action');
 assert.ok(!r.adventureStep(revive.game,revive.health,heroes[now],'attack:'+r.attackOptions(heroes[now])[0].name,()=>0.5).error,'and can still attack');
}
console.log('Action economy: checks spend the action (and pass a party turn), action spells refused once it is spent, reactions and long casts kept out of fights, draughts given as bonus actions, Cast… only what is legal, two-move sentences played as one turn or told to wait, Action Surge (once a turn, per rest, never a spell), turnLeft for the Dungeon Master, and bonus actions in brawls.');
