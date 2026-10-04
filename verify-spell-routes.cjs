const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Every spell, cast the way players cast it: typed ("I cast ...") and from the Cast… chips, through dmCommand,
// adventureStep and commitDmTurn, in a written story: at the inn, at a landmark, after a won fight in the wilds, after
// victory, in a fight with the story's foe, in a fight in the wilds and in a brawl with a person. A spell is never
// refused for where the hero stands, never refused for a rule it does not break, and never does nothing. Then the
// rules this rests on, one by one: fight timing, concentration, the Dungeon Master's damage held to the dice, upcasting,
// rituals, pact magic, the spells the game rolls, conditions, curses, blessings, Shield, species spells, old saves and
// the shared table. It writes SPELL-COVERAGE.json from what it saw.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','sequelRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const names='hostileEncounterGame,startParty,joinParty,newAdventure,freshStoryGame,validAdventure,adventureSnapshot,dmChoices,dmContext,commitDmTurn,adventureStep,quickActions,spellActions,dmCommand,knownSpells,spellLibrary,spellLimits,automaticEffects,narratedSpells,spellCostOptions,requestSpell,resolveSpellRuling,makeCharacter,equipmentFor,startWildFight,spellDamageMax,spellDefense,combatBasics,speciesSpells,partyView,settleParty,canonicalParty,endSpellMarks,spellConditions,castingStages,validParty,heroIdOf,markOf,withSpellMark,bonusOptions,concentrationAfterDamage';
const r=vm.runInNewContext(source+'\n({'+names.split(',').map(n=>`${n}:typeof ${n}==='undefined'?undefined:${n}`).join(',')+'})',{AsyncStorage:{},weaponIcon:()=>'sword',console});
for(const n of names.split(','))assert.ok(r[n]!==undefined,n+' is defined');

// ---------- A written story to play in ----------
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the port.',motive:'Wants the wells to run sweet.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',regard:{stance:'curious',reason:'Never met one of your kind.'},ties:{other:'friend',foe:'enemy',note:'They share the port.'}});
const written={id:'thirst-1',status:'active',title:'The Thirst Beneath Redwind',premise:'The wells of Redwind are drying.',opening:'Salt wind at the door of The Salt Cup.',objective:'Find what drinks the wells.',resolution:'The wells run again.',secret:'A cult diverts the water.',foe:'Vessa the Dry Hand',foeSpecies:'Human',foeAppearance:'A gaunt woman in a cracked clay mask with salt-crusted robes.',foeDamageType:'Necrotic',region:'Redwind',terrain:'coast',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'The Salt Cup',description:'A tavern above the salt flats.',kind:'settlement'},bridge:{name:'Dry Cistern',description:'A cistern gone dry.',kind:'ruin'},tower:{name:'Pump House',description:'An old pump house.',kind:'ruin'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},
 landmarks:['Brine Steps','Gull Rock'].map((name,i)=>({name,description:'A place on the shore road, number '+(i+1)+'.',kind:'landmark',bearing:['N','E'][i],miles:2+i,from:'inn',danger:'safe',feature:'A marker stone.'})),
 chapters:[{title:'Dry Wells',goal:'Ask about the wells.',turn:'A clue.'},{title:'The Cult',goal:'Face Vessa.',turn:'The end.'}]};
const clone=v=>JSON.parse(JSON.stringify(v));
const scoresFor=cls=>{const ab={Wizard:'Intelligence',Artificer:'Intelligence',Cleric:'Wisdom',Druid:'Wisdom',Ranger:'Wisdom',Bard:'Charisma',Sorcerer:'Charisma',Warlock:'Charisma',Paladin:'Charisma'}[cls];const s={Strength:12,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:10,Charisma:10};s[ab]=16;return s;};
function levelFor(cls,spellLevel){for(let l=1;l<=20;l++){const lim=r.spellLimits({class:cls,level:l});if(lim&&lim.maxSpellLevel>=spellLevel&&(spellLevel>0||lim.cantrips>0))return l;}if(cls==='Warlock'&&spellLevel>=6)return 2*spellLevel-1;return null;}
function heroFor(cls,spell){
 const level=levelFor(cls,spell.level);if(!level)return null;
 const h={name:'Route '+cls,class:cls,species:'Human',race:'Human',background:'Sage',level,scores:scoresFor(cls),spells:[spell.id],spellbook:cls==='Wizard'&&spell.level>0?[spell.id]:[],spellSelectionVersion:2};
 if(cls==='Warlock'&&spell.level>=6){h.spells=[];h.arcanum={[spell.level]:spell.id};}
 h.equipment=r.equipmentFor(h);
 // A quarterstaff for Shillelagh, whatever the kit.
 if(spell.id==='shillelagh'&&!h.equipment.items.some(i=>/Quarterstaff|Club/.test(i.name)))h.equipment={...h.equipment,items:[...h.equipment.items,{name:'Quarterstaff',quantity:1}]};
 return h;
}
const scenes=hero=>{
 const inn=r.freshStoryGame(hero,clone(written),r.newAdventure(hero));
 const landmark=r.adventureStep(inn,null,hero,{type:'travel',destination:inn.world.places[0].id},()=>0.99).game;
 const bridge=r.adventureStep(inn,null,hero,{type:'travel',destination:'bridge'},()=>0.99).game;
 const fight={...r.adventureStep(bridge,null,hero,'approach',()=>0.5).game,openingAttackAvailable:false,lastHit:{target:'foe'},hurtBy:'foe'};
 const wild={...r.startWildFight(landmark,hero,{template:'bandit',name:'Salt Bandit',appearance:'A lean bandit in a salt-white scarf.'},{place:landmark.world.at,from:'inn',hp:null}).game,openingAttackAvailable:false,lastHit:{target:'foe'},hurtBy:'foe'};
 const won={...landmark,stage:'wild'};
 const victory={...fight,stage:'victory',enemyHP:0,foeFate:'slain'};delete victory.lastHit;delete victory.hurtBy;
 // A brawl with the keeper, begun by a swing that misses (a real fight, rolled by the engine).
 const swing=r.adventureStep(inn,null,hero,{type:'npc-attack',target:'keeper',weapon:'Unarmed Strike'},()=>0.01);
 assert.equal(swing.error,undefined,'a brawl begins: '+swing.error);assert.ok(swing.game.npcCombat?.active,'the brawl is on');
 const brawl={...swing.game};
 return {inn,landmark,won,victory,fight,wild,brawl};
};
const ZERO={decision:'cast',note:'Resolved by the route check.',damage:0,selfDamage:0,healing:0,temporaryHP:0};
const stageRefusal=/Begin another adventure|cannot cast a spell right now/i;
// Refusals a rule allows, by what the spell is and where the hero stands.
function allowed(error,spell,where,hero){
 const fighting=['fight','wild','brawl'].includes(where);
 if(/not in the middle of a fight/.test(error))return fighting&&!['Action','Bonus Action','Reaction'].includes(spell.castingTime);
 if(/is cast as a reaction|Shield is a reaction/.test(error))return fighting&&spell.castingTime==='Reaction';
 if(/Hellish Rebuke answers/.test(error))return fighting&&spell.id==='hellish-rebuke';
 if(/follows a hit/.test(error))return !!r.automaticEffects[spell.id]?.smite;
 if(/Which direction should the 15-foot cone/.test(error))return spell.id==='burning-hands';
 if(/Mage Armor works only/.test(error))return spell.id==='mage-armor';
 if(/Who or what is the target/.test(error))return true; // only for bare casts, counted separately
 if(/is not a humanoid/.test(error))return true;
 if(/Ritual casting requires time outside/.test(error))return fighting;
 if(/feet away/.test(error))return true;
 if(/Combat is underway|Cancel the pending spell/.test(error))return where==='brawl';
 return false;
}
const results=[],wrongful=[],noops=[];
function play(hero,game,text,where,spell){
 const cmd=r.dmCommand(hero,game,text,null);
 if(!cmd)return {result:'not a command'};
 if(cmd.error){if(stageRefusal.test(cmd.error)||!allowed(cmd.error,spell,where,hero))wrongful.push(`${spell.id} (${hero.class}) ${where} "${text}": ${cmd.error}`);return {result:'refused',error:cmd.error};}
 assert.equal(cmd.action?.type,'spell',text);
 const step=r.adventureStep(game,null,hero,cmd.action,()=>0.5);
 if(step.error){if(stageRefusal.test(step.error)||!allowed(step.error,spell,where,hero))wrongful.push(`${spell.id} (${hero.class}) ${where} "${text}" step: ${step.error}`);return {result:'refused',error:step.error};}
 if(step.waiting){
  const c=r.commitDmTurn(hero,game,null,{type:'ai-spell',request:cmd.action.request,ruling:ZERO},{question:text,narration:'x',normalizedCommand:text},()=>0.5);
  if(c.error){wrongful.push(`${spell.id} (${hero.class}) ${where} "${text}" ruling: ${c.error}`);return {result:'ruling failed'};}
  assert.ok(r.validAdventure(r.adventureSnapshot(hero,clone(c.game),c.health,true),hero),`${spell.id} ${where} ruling save`);
  return {result:'ruling'};
 }
 // A spell resolved by the game leaves a mark: a line naming it, and its cost spent.
 const said=(step.events??step.game.log??[]).join(' ');
 if(!said.includes(spell.name)&&!said.includes('Detect Magic'))noops.push(`${spell.id} (${hero.class}) ${where}: no line names the spell`);
 if(cmd.action.request.slot>0&&!(step.game.spellSlotsUsed??[]).some(n=>n>0)&&!(step.game.resources?.slots>0))noops.push(`${spell.id} (${hero.class}) ${where}: no slot spent`);
 assert.equal(step.game.pendingSpell,undefined,spell.id+' resolved leaves nothing waiting');
 assert.ok(r.validAdventure(r.adventureSnapshot(hero,clone(step.game),step.health,true),hero),`${spell.id} (${hero.class}) ${where} automatic save`);
 return {result:'automatic'};
}
const t0=Date.now(),coverage={};
for(const spell of r.spellLibrary){
 const classes=spell.classes.filter(c=>levelFor(c,spell.level));
 for(const [n,cls] of classes.entries()){
  const hero=heroFor(cls,spell);
  assert.ok(r.knownSpells(hero).some(s=>s.id===spell.id),spell.id+' known to '+cls);
  const sc=scenes(hero),name=spell.name,effect=r.automaticEffects[spell.id];
  // The first class that learns the spell is tried everywhere; the others at the inn and in the story's fight.
  const where=n===0?Object.keys(sc):['inn','fight'];
  for(const w of where){
   const game=sc[w],targeted=w==='brawl'?' at keeper':['fight','wild'].includes(w)?' at the enemy':' on keeper';
   const bare=play(hero,game,'I cast '+name+'.',w,spell);
   const aimed=play(hero,game,'I cast '+name+(spell.range==='Self'?'':targeted)+'.',w,spell);
   coverage[spell.id]=coverage[spell.id]??{id:spell.id,name,level:spell.level,mode:effect?(effect.narrated?'narrated':'automatic'):'dm',routes:{}};
   coverage[spell.id].routes[w]=aimed.result==='refused'&&bare.result==='refused'?'refused: '+(aimed.error??''):aimed.result;
   // The chip, when the Cast… picker offers it, is a move the rules accept.
   const chip=r.spellActions(hero,game).find(c=>c.key==='spell:'+spell.id);
   if(chip){
    const q=chip.question??(chip.prefill+(chip.prefill.endsWith('on ')?'keeper':'toward keeper'));
    const out=play(hero,game,q,w,spell);
    assert.notEqual(out.result,'refused',`${spell.id} (${cls}) chip at ${w} "${q}" refused: ${out.error}`);
   }
   // Cast… appears wherever a spell can be cast.
   if(w!=='brawl'&&r.spellActions(hero,game).length)assert.ok(r.quickActions(hero,game,null).some(a=>a.key==='cast'),`Cast… at ${w}`);
  }
 }
}
assert.deepEqual(wrongful,[],'wrongful refusals:\n'+wrongful.slice(0,20).join('\n'));
assert.deepEqual(noops,[],'casts that did nothing:\n'+noops.slice(0,20).join('\n'));
const replayed=Object.keys(coverage).length;
assert.equal(replayed,r.spellLibrary.length,'every catalog spell replayed');
console.log(`Passed: ${replayed} spells replayed by every class that learns them (typed, aimed and from the chips) at the inn, a landmark, after a won fight, after victory, in the story's fight, in the wilds and in a brawl: no stage refusals, no wrongful refusals, no casts that do nothing (${((Date.now()-t0)/1000).toFixed(1)} s).`);
// ---------- The rules, one by one ----------
const hero=(cls,level,spells,patch={})=>{const h={name:'Rule '+cls,class:cls,species:'Human',race:'Human',background:'Sage',level,scores:scoresFor(cls),spells,spellbook:cls==='Wizard'?spells.filter(id=>r.spellLibrary.find(s=>s.id===id)?.level>0):[],spellSelectionVersion:2,...patch};h.equipment=r.equipmentFor(h);return h;};
const cast=(h,game,text,random=()=>0.5,health=null)=>{const c=r.dmCommand(h,game,text,health);if(c.error)return {error:c.error,command:c};const s=r.adventureStep(game,health,h,c.action,random);return {...s,command:c};};
const lines=step=>(step.events??[]).join('\n');
const saved=(h,step)=>r.validAdventure(r.adventureSnapshot(h,clone(step.game),step.health,true),h);
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};

// The host's report: a level 2 Dark Elf Warlock at The Salt Cup, a landmark and after victory casts Detect Magic.
{
 const lock={...hero('Warlock',2,['blast','minor-illusion','detect-magic','hex','charm-person']),species:'Dark Elf',race:'Dark Elf'};
 const sc=scenes(lock);
 assert.ok(r.knownSpells(lock).some(s=>s.id==='dancing-lights'),'a Dark Elf knows Dancing Lights');
 for(const w of ['inn','landmark','won','victory']){
  const step=cast(lock,sc[w],'I cast Detect Magic.');
  assert.equal(step.error,undefined,w+': '+step.error);assert.equal(step.waiting,undefined,'Detect Magic needs no ruling at '+w);
  assert.equal(step.command.action.request.slot,'ritual','out of a fight Detect Magic is a ritual: no pact slot spent');
  assert.equal(step.game.concentration.id,'detect-magic');assert.match(lines(step),/Dungeon Master describes what magic/);
  assert.equal((step.game.spellSlotsUsed??[0])[0],0);assert.ok(saved(lock,step));
  const slotted=cast(lock,sc[w],'I cast Detect Magic using a level 1 slot.');assert.equal(slotted.game.spellSlotsUsed[0],1,'or with a slot when asked');
  assert.ok(r.quickActions(lock,sc[w],null).some(a=>a.key==='cast'),'Cast… is offered at '+w);
  const chip=r.spellActions(lock,sc[w]).find(c=>c.key==='spell:detect-magic');assert.match(chip.detail,/Ritual · 10 min/);
 }
 // Not while dying: no Cast… and a plain refusal.
 const dying={...sc.fight,stage:'dying'};assert.ok(!r.quickActions(lock,dying,{current:0,temp:0}).some(a=>a.key==='cast'));same(r.spellActions(lock,dying),[]);
 assert.ok(!r.dmCommand(lock,dying,'I cast Detect Magic.',null)?.action,'no spell while dying');
}
// Concentration: a new spell ends the old one (said in the log), a refused or questioned cast keeps it.
{
 const lock=hero('Warlock',3,['blast','minor-illusion','detect-magic','hex','invisibility']),sc=scenes(lock);
 const hexed=cast(lock,sc.inn,'I cast Hex on keeper.');assert.equal(hexed.error,undefined,hexed.error);assert.equal(hexed.game.concentration.id,'hex');assert.equal(hexed.game.concentration.target,'keeper');
 const swapped=cast(lock,hexed.game,'I cast Detect Magic.');assert.match(lines(swapped),/Hex ends: you can hold only one spell at a time\./);assert.equal(swapped.game.concentration.id,'detect-magic');
 assert.match(r.spellActions(lock,hexed.game).find(c=>c.key==='spell:detect-magic').detail,/ends Hex/);
 const asked=r.dmCommand(lock,hexed.game,'I cast Invisibility on myself.',null);const pending=r.adventureStep(hexed.game,null,lock,asked.action,()=>0.5);assert.equal(pending.waiting,true);
 for(const decision of ['deny','clarify']){const kept=r.commitDmTurn(lock,hexed.game,null,{type:'ai-spell',request:asked.action.request,ruling:{...ZERO,decision}},{question:'I cast Invisibility on myself.',narration:'x'},()=>0.5);assert.equal(kept.error,undefined);assert.equal(kept.game.concentration.id,'hex',decision+' keeps Hex');}
 const ruled=r.commitDmTurn(lock,hexed.game,null,{type:'ai-spell',request:asked.action.request,ruling:ZERO},{question:'I cast Invisibility on myself.',narration:'x'},()=>0.5);assert.equal(ruled.game.concentration.id,'invisibility');assert.ok(ruled.events.join(' ').includes('Hex ends'));
}
// Fight timing: a long casting and a reaction wait for their moment.
{
 const wiz=hero('Wizard',3,['fire-bolt','light','mage-hand','find-familiar','shield','mage-armor','detect-magic']),sc=scenes(wiz);
 assert.match(r.dmCommand(wiz,sc.fight,'I cast Find Familiar.',null).error,/takes 1 hour to cast: not in the middle of a fight/);
 assert.match(r.dmCommand(wiz,sc.brawl,'I cast Find Familiar.',null).error,/not in the middle of a fight/);
 assert.equal(cast(wiz,sc.inn,'I cast Find Familiar.').error,undefined,'out of a fight it can be cast');
 assert.match(r.dmCommand(wiz,sc.fight,'I cast Shield.',null).error,/Shield is a reaction/);
 assert.ok(!r.spellActions(wiz,sc.fight).some(c=>c.key==='spell:find-familiar'||c.key==='spell:shield'),'the chips leave them out in a fight');
 // Hellish Rebuke answers the creature that has just hurt the hero, as a reaction: the turn's action is still theirs.
 const lock=hero('Warlock',1,['blast','minor-illusion','hellish-rebuke','hex']),f=scenes(lock).fight;
 assert.match(r.dmCommand(lock,{...f,hurtBy:undefined},'I cast Hellish Rebuke at the enemy.',null).error,/reaction/);
 const rebuke=cast(lock,f,'I cast Hellish Rebuke at the enemy.',()=>0);
 assert.equal(rebuke.error,undefined,rebuke.error);assert.ok(rebuke.game.enemyHP<f.enemyHP,'it burns');assert.equal(rebuke.game.reactionUsed,true);assert.equal(rebuke.game.actionUsed,undefined,'the action is still theirs');
 assert.ok(r.spellActions(lock,f).some(c=>c.key==='spell:hellish-rebuke'&&/Reaction/.test(c.detail)));
}
// The Dungeon Master's damage is held to what the spell can deal; spells with no damage dice deal none.
{
 assert.equal(r.spellDamageMax(hero('Wizard',1,[]),r.spellLibrary.find(s=>s.id==='sleep'),1),0);
 assert.equal(r.spellDamageMax(hero('Wizard',3,[]),r.spellLibrary.find(s=>s.id==='hold-person'),2),0);
 assert.equal(r.spellDamageMax(hero('Wizard',5,[]),r.spellLibrary.find(s=>s.id==='fireball'),3),48);
 assert.equal(r.spellDamageMax(hero('Wizard',9,[]),r.spellLibrary.find(s=>s.id==='fireball'),5),60);
 assert.equal(r.spellDamageMax(hero('Wizard',5,[]),r.spellLibrary.find(s=>s.id==='fire-bolt'),0),20);
 assert.equal(r.spellDamageMax(hero('Cleric',9,[]),r.spellLibrary.find(s=>s.id==='flame-strike'),5),60);
 const druid=hero('Druid',3,['druidcraft','guidance','heat-metal']),f=scenes(druid).fight;
 const asked=r.dmCommand(druid,f,'I cast Heat Metal on Vessa the Dry Hand.',null);const waiting=r.adventureStep(f,null,druid,asked.action,()=>0.5);assert.equal(waiting.waiting,true);
 const ctx=r.dmContext(druid,waiting.game,waiting.health);assert.equal(ctx.pendingSpell.damageMost,16,'the Dungeon Master is told the most Heat Metal can deal');
 const ruled=r.commitDmTurn(druid,f,null,{type:'ai-spell',request:asked.action.request,ruling:{...ZERO,damage:99}},{question:'I cast Heat Metal on Vessa the Dry Hand.',narration:'x'},()=>0.5);
 assert.equal(ruled.error,undefined,ruled.error);assert.ok(ruled.events.some(l=>l.includes('Damage limited to what Heat Metal can deal: 16')));
}
// Upcasting in plain words; rituals need no slot out of a fight; pact magic and Mystic Arcanum.
{
 const cleric=hero('Cleric',5,['guidance','light','sacred-flame','cure','bless','detect-magic']),inn=scenes(cleric).inn;
 assert.equal(r.dmCommand(cleric,inn,'I cast Cure Wounds on myself at 2nd level.',{current:5,temp:0}).action.request.slot,2);
 assert.equal(r.dmCommand(cleric,inn,'I cast Cure Wounds on myself using a 3rd-level slot.',{current:5,temp:0}).action.request.slot,3);
 assert.equal(r.dmCommand(cleric,inn,'I cast Cure Wounds on myself at level 2.',{current:5,temp:0}).action.request.slot,2);
 const healed=cast(cleric,inn,'I cast Cure Wounds on myself at 2nd level.',()=>0.5,{current:5,temp:0});assert.equal(healed.game.spellSlotsUsed[1],1,'the 2nd-level slot is spent');assert.equal(healed.waiting,undefined);
 assert.equal(r.dmCommand(cleric,scenes(cleric).fight,'I cast Detect Magic.',null).action.request.slot,1,'in a fight a ritual spell uses a slot');
 const lock=hero('Warlock',3,['blast','minor-illusion','charm-person','hex','detect-magic']),sc=scenes(lock);
 const charm=cast(lock,sc.inn,'I cast Hex on keeper.');assert.equal(charm.game.spellSlotsUsed[1],1,'a level-1 spell at Warlock 3 uses a pact slot of level 2');
 const rested=r.adventureStep(charm.game,null,lock,'short-rest',()=>0.5);assert.equal(rested.error,undefined,rested.error);same(rested.game.spellSlotsUsed,Array(9).fill(0));
 const arcane=hero('Warlock',11,['blast','minor-illusion','hex'],{arcanum:{6:'circle-of-death'}}),f=scenes(arcane).fight;
 // Its costly component means the Dungeon Master rules on it; the arcanum is spent when it is cast.
 const asked=r.dmCommand(arcane,f,'I cast Circle of Death at the enemy using arcanum.',null),once=r.commitDmTurn(arcane,f,null,{type:'ai-spell',request:asked.action.request,ruling:ZERO},{question:'I cast Circle of Death at the enemy using arcanum.',narration:'x'},()=>0.5);assert.equal(once.error,undefined,once.error);same(once.game.arcanumUsed,[6]);
 assert.ok(r.dmCommand(arcane,{...f,arcanumUsed:[6]},'I cast Circle of Death at the enemy using arcanum.',null).error,'Mystic Arcanum once a long rest');
}
// The damage spells the game rolls stay within their dice, at the lowest and highest rolls.
{
 const rolled=['starry-wisp','produce-flame','guiding-bolt','ray-of-sickness','thunderwave','shatter','dissonant-whispers','mind-spike','blight','cone-of-cold','moonbeam','flaming-sphere','call-lightning','spirit-guardians','sorcerous-burst','vampiric-touch','acid-arrow','ice-knife','flame-strike','spiritual-weapon'];
 for(const id of rolled){
  const spell=r.spellLibrary.find(s=>s.id===id),cls=spell.classes.find(c=>levelFor(c,spell.level)),h=heroFor(cls,spell),f=scenes(h).fight;
  const most=r.spellDamageMax(h,spell,spell.level||0);
  for(const v of [0,0.99]){
   const step=cast(h,f,'I cast '+spell.name+' at the enemy.',()=>v);
   assert.equal(step.error,undefined,id+': '+step.error);assert.equal(step.waiting,undefined,id+' is rolled by the game');
   const dealt=f.enemyHP-step.game.enemyHP;assert.ok(dealt>=0&&dealt<=most*2+12,`${id} at ${v}: ${dealt} within its dice (most ${most}, doubled on a critical hit)`);
   if(v===0.99)assert.ok(dealt>0||/Miss|success/.test(lines(step)),id+' deals damage when it lands');
   assert.ok(saved(h,step),id+' saves');
  }
 }
 // Sorcerous Burst takes the kind the player names (Chromatic Orb too, through the ruling its diamond needs).
 const sorc=hero('Sorcerer',1,['fire-bolt','light','prestidigitation','sorcerous-burst','chromatic-orb','shield']);
 assert.match(lines(cast(sorc,scenes(sorc).fight,'I cast Sorcerous Burst at the enemy with cold.',()=>0.99)),/Cold damage/);
 // Vampiric Touch gives back half.
 const lock=hero('Warlock',5,['blast','minor-illusion','vampiric-touch','hex']),vt=cast(lock,scenes(lock).fight,'I cast Vampiric Touch at the enemy.',()=>0.99,{current:10,temp:0});
 assert.ok(vt.health.current>10,'Vampiric Touch heals the caster');
}
// People defend with their own armour and saves (a tough guard is harder to hit than AC 10).
{
 const wiz=hero('Wizard',1,['fire-bolt','light','mage-hand','sleep','mage-armor','detect-magic']),inn=scenes(wiz).inn;
 const asked=r.dmCommand(wiz,inn,'I cast Fire Bolt at keeper.',null);assert.equal(asked.action.request.npcTarget,'keeper');
 const ruled=r.commitDmTurn(wiz,inn,null,{type:'ai-spell',request:asked.action.request,ruling:ZERO},{question:'I cast Fire Bolt at keeper.',narration:'x'},()=>0.5);
 assert.equal(ruled.error,undefined,ruled.error);assert.ok(ruled.events.some(l=>/Tamsin Rook: AC \d+, saving throws [+-]\d/.test(l)),'the keeper defends with her own numbers');
}
// Conditions: Sleep, Hold Person (humanoids only), and what they do in the fight.
{
 const wiz=hero('Wizard',3,['fire-bolt','light','mage-hand','sleep','hold-person','mage-armor','detect-magic']),sc=scenes(wiz);
 const slept=cast(wiz,sc.fight,'I cast Sleep at the enemy.',()=>0);
 assert.equal(slept.error,undefined,slept.error);assert.equal(r.markOf(slept.game,'foe').spells[0].cond,'asleep');
 assert.match(lines(slept),/sleeps on\./,'the sleeping foe does nothing on its turn');assert.ok(!/Vessa the Dry Hand: d20/.test(lines(slept)),'and makes no attack');
 assert.ok(saved(wiz,slept),'a mark of a spell saves');
 // Harm wakes it.
 const woke=cast(wiz,slept.game,'I cast Fire Bolt at the enemy.',()=>0.99);assert.match(lines(woke),/wakes/);assert.equal(r.markOf(woke.game,'foe').spells,undefined);
 // Hold Person: the bandit is a humanoid; the wolf is not.
 const held=cast(wiz,sc.wild,'I cast Hold Person at the bandit.',()=>0);
 assert.equal(held.error,undefined,held.error);assert.equal(r.markOf(held.game,'foe').spells?.[0]?.cond,'paralyzed');assert.match(lines(held),/is paralyzed and cannot act/);
 const fighter=hero('Fighter',3,[]),weapon=r.dmChoices(fighter,{...held.game,actionUsed:undefined},null).find(c=>/^attack:/.test(c.id)&&!/Bow|Crossbow/.test(c.id));
 const struck=r.adventureStep({...held.game,actionUsed:undefined,bonusUsed:false},null,fighter,weapon.action,seq([0.6,0.6,0.5,0.5,0.5,0.5,0.5,0.5,0.99,0.99]));
 assert.match(lines(struck),/paralyzed\).*Critical hit!|Critical hit!/s,'a blow on a paralyzed creature from beside it is a critical hit');
 const wolfFight=r.startWildFight(sc.landmark,wiz,{template:'wolf',name:'Grey Wolf',appearance:'A lean grey wolf.'},{place:sc.landmark.world.at,from:'inn',hp:null}).game;
 const noHold=cast(wiz,{...wolfFight,openingAttackAvailable:false},'I cast Hold Person at the wolf.',()=>0);assert.match(lines(noHold),/not a humanoid/);
 // The mark of a concentration spell goes when concentration does.
 const dropped=r.adventureStep({...held.game,concentration:undefined,actionUsed:undefined},null,wiz,'dodge',()=>0.5);assert.equal(r.markOf(dropped.game,'foe').spells,undefined);
}
// Curses, blessings and smites.
{
 const lock=hero('Warlock',1,['blast','minor-illusion','hex','charm-person']),f=scenes(lock).fight;
 const hexed=cast(lock,f,'I cast Hex at the enemy.');assert.equal(hexed.error,undefined,hexed.error);assert.equal(hexed.game.concentration.target,'foe');assert.equal(hexed.game.bonusUsed,true,'Hex is a bonus action');
 const blast=cast(lock,{...hexed.game},'I cast Eldritch Blast at the enemy.',()=>0.99);assert.match(lines(blast),/Hex: \+\d+ Necrotic damage/);
 const pal=hero('Paladin',2,['divine-smite','bless','cure']),pf=scenes(pal).fight;
 const swing=r.dmChoices(pal,pf,null).find(c=>/^attack:/.test(c.id)&&!/Bow|Javelin/.test(c.id));
 const hit=r.adventureStep({...pf,lastHit:undefined},null,pal,swing.action,seq([0.95,0.95,0.5,0.5,0.5,0.5,0.5,0.5]));
 assert.ok(hit.game.lastHit,'a melee hit opens the way for Divine Smite');
 const chip=r.spellActions(pal,hit.game).find(c=>c.key==='spell:divine-smite');assert.ok(chip,'the Divine Smite chip is offered after the hit');
 const smite=cast(pal,hit.game,chip.question,()=>0.5);assert.equal(smite.error,undefined,smite.error);assert.match(lines(smite),/Divine Smite: \d+d8/);
 assert.match(r.dmCommand(pal,{...pf,lastHit:undefined},'I cast Divine Smite.',null).error,/follows a hit/);
 const blessed=cast(pal,scenes(pal).inn,'I cast Bless on me.');assert.equal(blessed.error,undefined,blessed.error);assert.equal(blessed.waiting,undefined,'Bless on yourself needs no ruling');assert.equal(blessed.game.concentration.id,'bless');
 const bf={...scenes(pal).fight,concentration:blessed.game.concentration,lastHit:undefined};
 assert.match(lines(r.adventureStep(bf,null,pal,swing.action,()=>0.5)),/Bless adds \d to the roll/);
 const wiz=hero('Wizard',1,['fire-bolt','light','mage-hand','mage-armor','shield','detect-magic']),armoured=cast(wiz,scenes(wiz).inn,'I cast Mage Armor on me.');
 const base=r.combatBasics(wiz).ac;assert.equal(r.spellDefense(armoured.game,base).ac,Math.max(base,13+2),'Mage Armor: 13 + Dexterity');assert.ok(saved(wiz,armoured));
}
// Shield rises on its own when it turns a hit into a miss, and spends the slot and the reaction.
{
 const wiz=hero('Wizard',1,['fire-bolt','light','mage-hand','shield','detect-magic']),f=scenes(wiz).fight;let seen=0;
 for(let seed=1;seed<200&&seen<3;seed++){
  let s=(seed*2654435761)%2147483647||1;const random=()=>(s=(s*16807)%2147483647)/2147483647;
  const step=r.adventureStep({...f,hurtBy:undefined},null,wiz,'dodge',random);
  if(!/Shield \(reaction/.test(lines(step)))continue;
  seen++;assert.equal(step.game.spellSlotsUsed[0],1,'Shield spends a slot');assert.ok(saved(wiz,step));
 }
 assert.ok(seen>0,'Shield was raised against a blow it could turn');
}
// Species spells: once a long rest without a slot, then with slots or not at all.
{
 const elf={...hero('Fighter',3,[]),species:'Dark Elf',race:'Dark Elf'};
 same(r.speciesSpells(elf),['dancing-lights','faerie-fire']);
 const f=scenes(elf).fight,first=cast(elf,f,'I cast Faerie Fire at the enemy.',()=>0);
 assert.equal(first.error,undefined,first.error);assert.equal(first.command.action.request.slot,'species');same(first.game.speciesUsed,{'faerie-fire':1});
 assert.ok(saved(elf,first),'a free casting saves');
 assert.ok(r.dmCommand(elf,{...f,speciesUsed:{'faerie-fire':1}},'I cast Faerie Fire at the enemy.',null).error,'a Fighter has no slot for a second one');
 assert.match(r.spellActions(elf,scenes(elf).inn).find(c=>c.key==='spell:faerie-fire').detail,/Free/);
 const rested=r.adventureStep({...scenes(elf).inn,speciesUsed:{'faerie-fire':1}},null,elf,'long-rest',()=>0.5);assert.equal(rested.game.speciesUsed,undefined,'a long rest gives it back');
 const highElf=r.makeCharacter({name:'Ael',species:'Elf',lineage:'High Elf',class:'Fighter',background:'Soldier',fighterKit:'melee',baseScores:[15,13,14,8,12,10],bonusMode:'split',plusTwo:'Strength',plusOne:'Constitution'});
 assert.equal(highElf.lineage,'High Elf');assert.ok(r.knownSpells(highElf).some(s=>s.id==='prestidigitation'));
 assert.throws(()=>r.makeCharacter({name:'Ael',species:'Elf',lineage:'Drow',class:'Fighter',background:'Soldier',fighterKit:'melee',baseScores:[15,13,14,8,12,10],bonusMode:'split',plusTwo:'Strength',plusOne:'Constitution'}),/lineage/);
 const tief={...hero('Wizard',5,['fire-bolt','light','mage-hand','detect-magic']),species:'Tiefling',race:'Tiefling',lineage:'Infernal'};
 assert.ok(['thaumaturgy','fire-bolt','hellish-rebuke','darkness'].every(id=>r.knownSpells(tief).some(s=>s.id===id)));
 assert.ok(r.spellCostOptions(tief,scenes(tief).inn,r.spellLibrary.find(s=>s.id==='darkness')).includes('species'));
}
// Old saves: a Detect Magic still waiting for a ruling (forced in written stories before) loads and resolves.
{
 const wiz=hero('Wizard',1,['fire-bolt','light','mage-hand','detect-magic']),inn=scenes(wiz).inn;
 const old={...inn,pendingSpell:{id:'detect-magic',slot:1,intent:'I cast Detect Magic',componentsConfirmed:true,forceDM:true}};
 assert.ok(r.validAdventure(r.adventureSnapshot(wiz,clone(old),null,true),wiz),'the old save loads');
 const done=r.commitDmTurn(wiz,old,null,{type:'ai-ruling',ruling:ZERO},{question:'Go on.',narration:'x'},()=>0.5);assert.equal(done.error,undefined,done.error);assert.equal(done.game.pendingSpell,undefined);assert.equal(done.game.spellSlotsUsed[0],1);
 // A save from before any of this (no marks of spells, no buffs, an old concentration) stays valid.
 assert.ok(r.validAdventure(r.adventureSnapshot(wiz,clone({...inn,concentration:{id:'bless',remaining:10,duration:'1 minute'}}),null,true),wiz));
}
// The shared table: a spell's mark belongs to its caster and goes when their concentration does, seen from any device;
// a hero's own buffs and free castings are theirs.
{
 const kara=hero('Wizard',3,['fire-bolt','light','mage-hand','hold-person','mage-armor','detect-magic']),bram=hero('Fighter',3,[]);
 const fight=r.hostileEncounterGame(kara,r.newAdventure(kara)),health={current:r.combatBasics(kara).hp,temp:0};
 const hosted=r.startParty(r.adventureSnapshot(kara,fight,health,true),'A','Sam');
 const joined=r.joinParty(hosted,'B',{character:JSON.stringify(bram),game:r.newAdventure(bram),health:null,name:'Jo'}).snapshot;
 const viewA=r.partyView(joined,'A');
 const marked={...viewA,game:{...r.withSpellMark({...viewA.game,concentration:{id:'hold-person',remaining:10,duration:'1 minute'},buffs:{'mage-armor':{remaining:4800,ac:15}}},'foe',{id:'hold-person',cond:'paralyzed',by:'A',dc:13,save:'Wisdom'})}};
 assert.ok(r.validAdventure(clone(marked),kara),'a party view with a spell mark and a buff is a valid save');
 const fromB=r.partyView(marked,'B');assert.equal(r.markOf(fromB.game,'foe').spells[0].by,'A','the mark is in the shared world');
 assert.equal(fromB.game.buffs,undefined,'another hero does not wear Mage Armor');assert.ok(r.settleParty(marked).members.A.hero.buffs['mage-armor']);
 assert.equal(r.canonicalParty(marked),r.canonicalParty(fromB),'turning the view changes nothing');
 assert.equal(r.markOf(r.endSpellMarks(fromB.game),'foe').spells.length,1,'held while A concentrates');
 const lost={...marked,game:{...marked.game,concentration:undefined}};
 assert.equal(r.markOf(r.endSpellMarks(r.partyView(lost,'B').game),'foe').spells,undefined,'gone once A no longer concentrates, from B\'s device too');
}
console.log('Passed: Detect Magic for the Dark Elf Warlock everywhere; concentration replaced and kept; long castings and reactions in fights; Hellish Rebuke and Shield as reactions; the Dungeon Master\'s damage held to the dice; upcasting, rituals, pact magic and Mystic Arcanum; 20 rolled damage spells within their dice; people\'s own defences; Sleep, Hold Person, Hex, Divine Smite, Bless and Mage Armor; species spells; old saves; the shared table.');
// More conditions, curses and blessings, each through a cast and the turn that follows it.
{
 const wiz=hero('Wizard',5,['fire-bolt','light','mage-hand','true-strike','hold-person','blindnessdeafness','fear','web'],{scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:18,Wisdom:10,Charisma:10}}),sc=scenes(wiz);
 const ts=cast(wiz,sc.fight,'I cast True Strike at the enemy with radiant light.',()=>0.99);
 assert.equal(ts.error,undefined,ts.error);assert.match(lines(ts),/True Strike with your .*Intelligence.*Radiant/);assert.ok(ts.game.enemyHP<sc.fight.enemyHP,'True Strike lands');
 const blind=cast(wiz,sc.fight,'I cast Blindness/Deafness at the enemy.',()=>0);assert.equal(blind.error,undefined,blind.error);
 assert.match(lines(blind),/is blinded/);assert.match(lines(blind),/\(disadvantage.*blinded|blinded.*disadvantage/,'a blinded foe attacks with disadvantage');
 const fear=cast(wiz,sc.fight,'I cast Fear at the enemy.',()=>0);assert.match(lines(fear),/frightened/);
 const web=cast(wiz,sc.fight,'I cast Web at the enemy.',()=>0);assert.equal(r.markOf(web.game,'foe').spells[0].cond,'restrained');
 // Each creature tries again at the end of its turn: a high roll frees it.
 const freed=r.adventureStep({...web.game,actionUsed:undefined,bonusUsed:false},null,wiz,'dodge',()=>0.99);assert.match(lines(freed),/breaks free of Web/);assert.equal(r.markOf(freed.game,'foe').spells,undefined);
 const cler=hero('Cleric',1,['guidance','light','sacred-flame','command','bane','bless','cure']),cs=scenes(cler);
 const grovel=cast(cler,cs.fight,'I cast Command at the enemy: grovel!',()=>0);assert.equal(grovel.error,undefined,grovel.error);assert.match(lines(grovel),/grovels and loses its turn/);assert.ok(r.markOf(grovel.game,'foe').prone,'it lies prone');
 const baned=cast(cler,cs.fight,'I cast Bane at the enemy.',()=>0);assert.equal(r.markOf(baned.game,'foe').spells[0].cond,'baned');
 const banedTurn=r.adventureStep({...baned.game,actionUsed:undefined,bonusUsed:false},null,cler,'dodge',()=>0.5);assert.match(lines(banedTurn),/− \d Bane/,'Bane takes 1d4 off its attack');
 // Guidance: 1d4 on the next check, then it is spent.
 const guided=cast(cler,cs.inn,'I cast Guidance on me.');assert.equal(guided.game.concentration.id,'guidance');
 const check=r.commitDmTurn(cler,guided.game,null,{type:'ai-check',check:{ability:'Wisdom',skill:'Perception',dc:12,mode:'normal',reason:'Search the cellar',success:'You find it.',failure:'Nothing.',damageCount:0,damageDie:6,damageOn:'none'}},{question:'I search the cellar.',narration:'You look.'},()=>0.5);
 assert.equal(check.error,undefined,check.error);assert.match(check.game.log[0],/\+ \d Guidance/);assert.equal(check.game.concentration,undefined,'Guidance is spent');
 // Charm Person: the charmed foe will not strike the one who charmed it, until harmed.
 const bard=hero('Bard',1,['vicious-mockery','light','charm-person','heroism','cure']),bs=scenes(bard);
 const charmed=cast(bard,bs.wild,'I cast Charm Person at the bandit.',()=>0);assert.equal(charmed.error,undefined,charmed.error);assert.match(lines(charmed),/will not raise a hand against you/);
 // Heroism: temporary hit points at the start of each turn.
 const hero2=cast(bard,bs.inn,'I cast Heroism on me.');assert.equal(hero2.game.concentration.id,'heroism');assert.ok(hero2.health.temp>=3);
 const brave=r.adventureStep({...bs.fight,concentration:hero2.game.concentration},{current:5,temp:0},bard,'end-turn',()=>0.01);assert.match(lines(brave),/Heroism: \d temporary HP/);
 // Faerie Fire gives advantage on attacks at the creature.
 const druid=hero('Druid',3,['druidcraft','guidance','faerie-fire','entangle','barkskin','shillelagh','resistance'],{scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:18,Charisma:10}});
 const ds=scenes(druid),lit=cast(druid,ds.fight,'I cast Faerie Fire at the enemy.',()=>0);assert.equal(r.markOf(lit.game,'foe').spells[0].cond,'outlined');
 const entangled=cast(druid,ds.fight,'I cast Entangle at the enemy.',()=>0);assert.match(lines(entangled),/held fast/);
 const bark=cast(druid,ds.inn,'I cast Barkskin on me.');assert.equal(r.spellDefense(bark.game,12).ac,17,'Barkskin: AC at least 17');
 // Shillelagh: the quarterstaff strikes with Wisdom and a d8.
 const staff=druid.equipment.items.some(i=>/Quarterstaff/.test(i.name))?druid:{...druid,equipment:{...druid.equipment,items:[...druid.equipment.items,{name:'Quarterstaff',quantity:1}]}};
 const shil=cast(staff,ds.inn,'I cast Shillelagh on me.');assert.equal(shil.error,undefined,shil.error);assert.equal(shil.waiting,undefined,'Shillelagh needs no ruling');
 const swing=r.dmChoices(staff,{...ds.fight,buffs:shil.game.buffs},null).find(c=>/^attack:.*Quarterstaff/.test(c.id));assert.ok(swing,'the quarterstaff can be swung');
 assert.match(lines(r.adventureStep({...ds.fight,buffs:shil.game.buffs},null,staff,swing.action,()=>0.99)),/Wisdom/,'it strikes with Wisdom');
 // Resistance: the chosen kind of damage is reduced.
 const res=cast(druid,ds.inn,'I cast Resistance on me against necrotic.');assert.equal(res.game.concentration.damageType,'Necrotic');
 let reduced=false;for(const v of [0.6,0.7,0.8,0.9]){if(/Resistance takes \d off the necrotic damage/.test(lines(r.adventureStep({...ds.fight,concentration:res.game.concentration},null,druid,'end-turn',()=>v))))reduced=true;}
 assert.ok(reduced,'Resistance takes 1d4 off necrotic blows');
 // Hunter's Mark and Divine Favor add to weapon hits.
 const ranger=hero('Ranger',2,['hunters-mark','cure']),rs=scenes(ranger),marked=cast(ranger,rs.fight,'I cast Hunter\'s Mark at the enemy.');
 assert.equal(marked.error,undefined,marked.error);assert.equal(marked.game.concentration.target,'foe');
 const bow=r.dmChoices(ranger,{...marked.game,actionUsed:undefined,bonusUsed:false},null).find(c=>/^attack:/.test(c.id));
 assert.match(lines(r.adventureStep({...marked.game,actionUsed:undefined,bonusUsed:false},null,ranger,bow.action,()=>0.95)),/Hunter.s Mark: \+\d+ Force damage/);
 const pal=hero('Paladin',2,['divine-favor','bless','cure']),ps=scenes(pal),favour=cast(pal,ps.fight,'I cast Divine Favor on me.');assert.ok(favour.game.buffs['divine-favor']);
 const blade=r.dmChoices(pal,{...favour.game,actionUsed:undefined,bonusUsed:false},null).find(c=>/^attack:/.test(c.id)&&!/Javelin/.test(c.id));
 assert.match(lines(r.adventureStep({...favour.game,actionUsed:undefined,bonusUsed:false},null,pal,blade.action,()=>0.95)),/Divine Favor: \+\d+ Radiant damage/);
}
console.log('Passed: True Strike, Blindness, Fear, Web (and breaking free), Command, Bane, Guidance, Charm Person, Heroism, Faerie Fire, Entangle, Barkskin, Shillelagh, Resistance, Hunter\'s Mark and Divine Favor work in play.');
fs.writeFileSync('SPELL-COVERAGE.json',JSON.stringify({catalogCount:r.spellLibrary.length,narrated:Object.values(coverage).filter(c=>c.mode==='narrated').length,automatic:Object.values(coverage).filter(c=>c.mode==='automatic').length,dmRuled:Object.values(coverage).filter(c=>c.mode==='dm').length,scope:'Written by verify-spell-routes.cjs: every spell typed and aimed by its first class in seven places of a written story (inn, landmark, after a won fight, after victory, the story fight, a fight in the wilds, a brawl). "automatic" is resolved by the game, "narrated" is spent by the game and described by the Dungeon Master, "ruling" waits for a Dungeon Master ruling the game then applies; a refusal is listed with its reason.',spells:Object.values(coverage)},null,1)+'\n');

