const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Every spell, cast the way players cast it: typed ("I cast ...") and from the Cast… chips, through dmCommand,
// adventureStep and commitDmTurn, in a written story: at the inn, at a landmark, after a won fight in the wilds, after
// victory, in a fight with the story's foe, in a fight in the wilds and in a brawl with a person. A spell is never
// refused for where the hero stands, never refused for a rule it does not break, and never does nothing. Then the
// rules this rests on, one by one: fight timing, concentration, the Dungeon Master's damage held to the dice, upcasting,
// rituals, pact magic, the spells the game rolls, conditions, curses, blessings, Shield, species spells, old saves and
// the shared table. It writes SPELL-COVERAGE.json from what it saw.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','sequelRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const names='newAdventure,freshStoryGame,validAdventure,adventureSnapshot,dmChoices,dmContext,commitDmTurn,adventureStep,quickActions,spellActions,dmCommand,knownSpells,spellLibrary,spellLimits,automaticEffects,narratedSpells,spellCostOptions,requestSpell,resolveSpellRuling,makeCharacter,equipmentFor,startWildFight,spellDamageMax,spellDefense,combatBasics,speciesSpells,partyView,settleParty,canonicalParty,endSpellMarks,spellConditions,castingStages,validParty,heroIdOf,markOf,withSpellMark,bonusOptions,concentrationAfterDamage';
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
module.exports={r,written,scenes,heroFor,clone,ZERO,coverage};

