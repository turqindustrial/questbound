const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Subclasses: every class offers its SRD subclass and three of Questbound's own (the Artificer five specialities), each
// with features in the catalog (source 'Questbound', the same names and levels as subclassRules.js), names that are no
// book's, spells that exist and can be cast, and a level-3 signature the engine plays: passive numbers (hit points,
// armour class, initiative, martial weapons, a second attack, a harder grapple, skills), a once-a-turn extra on a hit,
// a Reaction that blunts a blow, a class action with limited uses (chips, descriptions, typed words, stories, saves),
// spell gifts and a gift on victory. Old saves and a party at the shared table keep working; the Dungeon Master is told.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js','playbackHp.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({subclassOptions,legacySubclassOptions,validPlannedSubclass,subclassEngine,subclassLevels,subclassFeatures,subclassBriefs,subclassPassive,subclassUses,subclassSpells,subclassSpellClass,automaticSpells,spellSelectionError,spellLimits,spellLibrary,equipmentFor,combatBasics,weaponAttacks,attacksPerAction,unarmedDC,trainedSkills,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,validAdventure,adventureSnapshot,dmChoices,dmCommand,dmContext,commitDmTurn,quickActions,actionDescription,actionCost,bonusOptions,settleParty,partyView,startParty,joinParty,shownHp,knownSpells,makeCharacter,blankBuild})',{AsyncStorage:{}});
const catalog=JSON.parse(fs.readFileSync('classFeatureCatalog.json','utf8'));
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const always=v=>()=>v;
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const baseScores={Strength:16,Dexterity:14,Constitution:14,Intelligence:14,Wisdom:14,Charisma:14};
const make=(cls,sub,{level=3,scores=baseScores,species='Human',items=null}={})=>{const h={name:'Subclass tester',class:cls,species,level,background:'Soldier',scores,spells:[],plannedSubclass:sub};h.equipment=r.equipmentFor(h);if(items)h.equipment={...h.equipment,items};return h;};
const hpOf=hero=>({current:r.combatBasics(hero).hp,temp:0});
const fightFor=(hero,foe='bandit')=>({...r.hostileEncounterGame(hero,r.newAdventure(hero),pick(foe)),openingAttackAvailable:false,potions:0});
// The crossroads adventure's own fight with the wisp (no story): listen to the keeper, then approach the bridge.
const plainFight=hero=>{const h=hpOf(hero),a=r.adventureStep(r.newAdventure(hero),h,hero,'listen',always(.5)),b=r.adventureStep(a.game,h,hero,'approach',always(.5));assert.equal(b.game.stage,'combat');return {...b.game,openingAttackAvailable:false,potions:0};};
const valid=(hero,game,health,what='')=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(game)),health,true),hero),'the save is valid '+what);
const lines=s=>(s.events??[]).join(' | ');
const plain=o=>JSON.parse(JSON.stringify(o));

// ---- 1. Roster: the SRD's subclass first, then three of Questbound's own; five Artificer specialities ----
const srd={Barbarian:'Path of the Berserker',Bard:'College of Lore',Cleric:'Life Domain',Druid:'Circle of the Land',Fighter:'Champion',Monk:'Warrior of the Open Hand',Paladin:'Oath of Devotion',Ranger:'Hunter',Rogue:'Thief',Sorcerer:'Draconic Sorcery',Warlock:'Fiend Patron',Wizard:'Evoker'};
const legacyNames=new Set(Object.values(plain(r.legacySubclassOptions)).flat());
const ours=[];
for(const [cls,options] of Object.entries(plain(r.subclassOptions))){
 const names=Object.keys(options);
 if(cls==='Artificer')assert.deepEqual(names,['Alchemist','Armorer','Artillerist','Battle Smith','Snarewright']);
 else{assert.equal(names.length,4,cls+' offers four paths');assert.equal(names[0],srd[cls],cls+': the SRD subclass first');}
 for(const [name,pitch] of Object.entries(options)){
  assert.ok(pitch.length>=36&&pitch.length<=120&&/\.$/.test(pitch),name+' pitch: '+pitch);
  assert.equal(r.validPlannedSubclass({class:cls,plannedSubclass:name}),true,name);
  if(name!==srd[cls]&&!['Alchemist','Armorer','Artillerist','Battle Smith'].includes(name)){assert.ok(!legacyNames.has(name),name+' is not an old name');ours.push([cls,name]);}
 }
}
assert.equal(ours.length,37,'37 new subclasses: three for each SRD class and a fifth Artificer speciality');
for(const [cls,list] of Object.entries(plain(r.legacySubclassOptions)))for(const name of list)assert.equal(r.validPlannedSubclass({class:cls,plannedSubclass:name}),true,'old saves keep '+name);
assert.equal(r.validPlannedSubclass({class:'Wizard',plannedSubclass:'Snarewright'}),false,'a subclass belongs to its class');

// ---- 2. The catalog and the engine's table agree ----
const questbound=[...ours.map(([,n])=>n),'Alchemist','Armorer','Artillerist','Battle Smith'];
const featureNames=new Set();
for(const name of questbound){
 const spec=r.subclassEngine[name];assert.ok(spec,name+' is in subclassRules.js');
 const cls=spec.class,rows=catalog.filter(f=>f.subclass===name);
 assert.ok(rows.length>0,name+' has catalog features');
 for(const level of r.subclassLevels[cls])assert.ok(rows.some(f=>f.level===level),name+' has a feature at level '+level);
 for(const f of rows){
  assert.equal(f.class,cls);assert.ok(r.subclassLevels[cls].includes(f.level),name+' '+f.name+' at a subclass level');
  assert.equal(f.source,'Questbound');assert.ok(['engine','reference'].includes(f.automation));
  assert.ok(f.description.length>=40&&f.description.length<=700&&/[.!?]$/.test(f.description),f.name+': '+f.description);
  assert.ok(!featureNames.has(f.name),'feature names are unique: '+f.name);featureNames.add(f.name);
 }
 const js=spec.features.map(f=>[f.level,f.name,f.engine]),json=rows.map(f=>[f.level,f.name,f.automation==='engine']);
 assert.deepEqual(plain(js),json,name+': subclassRules.js and the catalog agree');
 for(const f of spec.features)assert.ok(f.brief.length>=10&&f.brief.length<=140,f.name+' brief');
 // A level-3 signature the engine plays: an effect from level 3, or spells it grants.
 assert.ok(spec.effects.some(e=>e.level===3)||r.subclassSpells[name]?.[3],name+' plays something at level 3');
 assert.ok(spec.effects.filter(e=>e.kind==='action'||e.kind==='ward').length<=1,name+': at most one effect spends uses');
}
assert.equal(catalog.find(f=>f.subclass==='Hunter'&&f.name==="Hunter's Prey").automation,'engine');
assert.equal(catalog.find(f=>f.subclass==='College of Lore'&&f.name==='Cutting Words').automation,'engine');

// ---- 3. Licence guard: no subclass or feature of ours bears a name from a book outside the SRDs ----
const deny=['Battle Master','Eldritch Knight','Arcane Archer','Cavalier','Samurai','Psi Warrior','Rune Knight','Echo Knight','Banneret','Totem Warrior','Ancestral Guardian','Storm Herald','Zealot','Wild Heart','World Tree','Path of the Beast','Path of the Giant','Valor','Glamour','Swords','Whispers','Creation','Eloquence','Spirits','Dance','Knowledge','Light Domain','Nature Domain','Tempest','Trickery','War Domain','Death Domain','Forge','Grave','Order','Peace','Twilight','Moon','Dreams','Shepherd','Spores','Stars','Wildfire','Circle of the Sea','Shadow','Elements','Mercy','Drunken','Kensei','Sun Soul','Long Death','Astral Self','Ancients','Vengeance','Conquest','Redemption','Glory','Watchers','Crown','Noble Genies','Beast Master','Gloom Stalker','Horizon Walker','Monster Slayer','Fey Wanderer','Swarmkeeper','Drakewarden','Winter Walker','Assassin','Arcane Trickster','Inquisitive','Mastermind','Scout','Swashbuckler','Phantom','Soulknife','Wild Magic','Divine Soul','Shadow Magic','Storm Sorcery','Aberrant','Clockwork','Lunar','Spellfire','Archfey','Great Old One','Celestial','Hexblade','Fathomless','Genie','Undead Patron','Undying','Abjur*','Conjur*','Divin*','Enchant*','Illusion*','Necroman*','Transmut*','Bladesing*','War Magic','Chronurgy','Graviturgy','Scribes','Cartographer',
 'Combat Superiority','Superiority Dice','Arcane Ward','Portent','Shadow Step','Dread Ambusher',"Hexblade's Curse",'Eldritch Cannon','Steel Defender','Experimental Elixir','Arcane Armor','Vow of Enmity','Bladesong','Rakish Audacity','Colossus Slayer','Arcane Jolt','Battle Ready','Fortified Position','Explosive Cannon','Arcane Firearm','Restorative Reagents','Chemical Mastery','Alchemical Savant','Perfected Armor','Improved Defender','Armor Model','Coordinated Attack'];
const banned=deny.map(d=>new RegExp('\\b'+d.replace(/\*$/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/'/g,"['’]")+(d.endsWith('*')?'\\w*':'\\b'),'i'));
for(const name of [...ours.map(([,n])=>n),...catalog.filter(f=>f.source==='Questbound').map(f=>f.name)])for(const re of banned)assert.ok(!re.test(name),name+' matches a book name ('+re+')');

// ---- 4. Spells the subclasses grant ----
const ids=new Set(r.spellLibrary.map(s=>s.id));
for(const [name,cls] of Object.entries(plain(r.subclassSpellClass))){
 assert.equal(r.subclassEngine[name]?.class??(srd[cls]===name?cls:null),cls,name+' belongs to '+cls);
 for(const [at,list] of Object.entries(r.subclassSpells[name])){
  for(const id of list){
   assert.ok(ids.has(id),name+': '+id+' exists');
   const spell=r.spellLibrary.find(s=>s.id===id);
   if(['Fighter','Rogue'].includes(cls))assert.equal(spell.level,0,name+' grants cantrips only');
   else{const limits=r.spellLimits({class:cls,level:Number(at)});assert.ok(spell.level===0||(limits?.maxSpellLevel??0)>=spell.level,name+': a level '+at+' '+cls+' can cast '+id+' (level '+spell.level+')');}
  }
 }
}
for(const [cls,name] of ours){
 if(!r.subclassSpells[name])continue;
 const h=make(cls,name),low={...h,level:2};
 const grants=r.subclassSpells[name][3];
 assert.ok(grants.every(id=>r.automaticSpells(h).includes(id)),name+' grants its spells at level 3');
 assert.ok(!grants.some(id=>r.automaticSpells(low).includes(id)),name+' grants nothing at level 2');
 assert.equal(r.spellSelectionError(h,false),'',name+' at level 3 needs no other spell choices');
}
// A Wardblade's cantrips can be cast (Intelligence), and are offered in a fight.
{const blade=make('Fighter','Wardblade',{scores:{...baseScores,Intelligence:16}});assert.ok(r.knownSpells(blade).some(s=>s.id==='shock')&&r.knownSpells(blade).some(s=>s.id==='fire-bolt'));
 const g=fightFor(blade),cast=r.adventureStep(g,hpOf(blade),blade,{type:'spell',request:{id:'fire-bolt',slot:0,intent:'Fire Bolt at the bandit',componentsConfirmed:true}},always(.9));assert.ok(!cast.error,cast.error);assert.match(lines(cast),/Fire Bolt: d20/);}

// ---- 5. Passive numbers (fixed scores: every modifier +2 but Strength +3) ----
const without=h=>({...h,plannedSubclass:''});
const diff=(h,field)=>r.combatBasics(h)[field]-r.combatBasics(without(h))[field];
{const stone=make('Barbarian','Path of the Stoneborn',{level:5});assert.equal(diff(stone,'hp'),5,'Bedrock: +1 HP a level');assert.equal(r.unarmedDC(stone)-r.unarmedDC(without(stone)),2,'Bedrock: grapple DC +2');assert.match(r.combatBasics(stone).hpFormula,/\+5 Bedrock/);}
for(const [cls,sub] of [['Fighter','Ironclad'],['Paladin','Oath of the Living Wood']])assert.equal(diff(make(cls,sub,{level:7}),'hp'),7,sub+': +1 HP a level');
{const ward=make('Wizard','Wardwright');assert.equal(r.combatBasics(ward).ac,14,'Woven Ward: 10 + Dex + Int');assert.equal(r.combatBasics(without(ward)).ac,12);
 const armoured=make('Wizard','Wardwright',{items:[...ward.equipment.items,{name:'Leather Armor',quantity:1}]});assert.equal(r.combatBasics(armoured).ac,13,'not in armour');}
{const vigil=make('Cleric','Vigil Domain');assert.equal(diff(vigil,'ac'),1,'Steadfast Guard in armour');assert.match(r.combatBasics(vigil).acFormula,/\+1 Steadfast Guard/);
 const bare=make('Cleric','Vigil Domain',{items:vigil.equipment.items.filter(i=>i.name!=='Chain Shirt')});assert.equal(diff(bare,'ac'),0,'not without armour');}
{const crane=make('Monk','Warrior of the Crane');assert.equal(diff(crane,'ac'),1,"Crane's Poise unarmoured");
 const shielded=make('Monk','Warrior of the Crane',{items:[...crane.equipment.items,{name:'Shield',quantity:1}]});assert.equal(diff(shielded,'ac'),0,'not with a shield');}
assert.equal(diff(make('Wizard','Fateweaver'),'initiative'),2,'Foreseen Step: + Int');
assert.equal(diff(make('Paladin','Oath of the Open Road'),'initiative'),2,'Watchful Wayfarer: + Wis');
assert.equal(diff(make('Fighter','Marshal'),'initiative'),0,'Read the Field waits for level 7');assert.equal(diff(make('Fighter','Marshal',{level:7}),'initiative'),2,'Read the Field: + Int');
assert.equal(r.combatBasics(make('Ranger','Trailbreaker')).initiativeAdvantage,true);assert.equal(r.combatBasics(make('Ranger','Trailbreaker',{level:2})).initiativeAdvantage,false,'nothing before level 3');
{const bard=make('Bard','College of Steel Verses',{items:[{name:'Longsword',quantity:1},{name:'Leather Armor',quantity:1}]});const sword=r.weaponAttacks(bard).find(w=>w.name==='Longsword');assert.equal(sword.proficient,true,'martial weapons');assert.equal(r.weaponAttacks(without(bard)).find(w=>w.name==='Longsword').proficient,false);
 assert.equal(r.attacksPerAction(bard),1);assert.equal(r.attacksPerAction({...bard,level:6}),2,'Second Measure');}
assert.ok(['Deception','Insight'].every(s=>r.trainedSkills(make('Bard','College of Borrowed Faces')).includes(s)),'Practised Liar');
assert.ok(r.trainedSkills(make('Rogue','Silvertongue')).includes('Persuasion'));
// At the shared table the others see the new hit points (partyRules statsOf, through settling).
{const stone=make('Barbarian','Path of the Stoneborn',{level:4}),g=r.newAdventure(stone),snap=r.adventureSnapshot(stone,g,hpOf(stone),true);
 const party=r.startParty({...snap,character:JSON.stringify(stone)},'p1','Ana'),settled=r.settleParty(party);assert.equal(settled.members.p1.stats.hp,r.combatBasics(stone).hp);assert.equal(settled.members.p1.stats.hp-r.combatBasics(without(stone)).hp,4);}

// ---- 6. A once-a-turn extra on a hit ----
{const ember=make('Barbarian','Path of the Ember Heart',{level:5}),g=fightFor(ember),hit=r.adventureStep(g,hpOf(ember),ember,'attack:Greataxe',always(.9));
 const kindled=(hit.events??[]).filter(l=>/Kindled Blows/.test(l));assert.equal(kindled.length,1,'one Kindled Blows line in a turn of two hits: '+lines(hit));
 assert.match(kindled[0],/^\d+ Fire damage \(Kindled Blows: 1d6 \[\d\]\)\.$/,'the line begins with the damage, as the feed reads it');
 assert.equal(hit.game.featTurn,undefined,'the turn is over: the extra is ready again');valid(ember,hit.game,hit.health);
 // The feed's playback follows the extra damage.
 const foeName='Bandit Cutthroat',events=[{kind:'roll',text:kindled[0]},{kind:'effect',text:foeName+': '+g.enemyHP+' → 1 HP.'}],shown=r.shownHp(events,1,{foe:foeName});assert.equal(shown.foe,Math.max(1,g.enemyHP-Number(kindled[0].match(/^\d+/)[0])),'playback follows it');
 // Level 10: 2d6; an enemy immune to fire takes none of it.
 const ten={...ember,level:10},big=r.adventureStep(fightFor(ten),hpOf(ten),ten,'attack:Greataxe',always(.9));assert.match(lines(big),/Fire damage \(Kindled Blows: 2d6/);
 const immune={...g,story:{...g.story,foeStats:{...g.story.foeStats,immunities:['Fire']}}},cold=r.adventureStep(immune,hpOf(ember),ember,'attack:Greataxe',always(.9));assert.ok((cold.events??[]).some(l=>/^0 Fire damage \(Kindled Blows/.test(l)),'immune: '+lines(cold));}
{// Hunter's Prey (the SRD Hunter): only on a creature already hurt.
 const ranger=make('Ranger','Hunter'),g=fightFor(ranger),w='attack:'+r.weaponAttacks(ranger)[0].name,fresh=r.adventureStep(g,hpOf(ranger),ranger,w,always(.9));assert.ok(!/Prey: 1d8/.test(lines(fresh)),'not on an unhurt foe: '+lines(fresh));
 const hurt=r.adventureStep({...g,enemyHP:g.enemyHP-3},hpOf(ranger),ranger,w,always(.9));assert.match(lines(hurt),/Hunter's Prey: 1d8/);}
{// First Cut: the opening and the first round, not the second.
 const knife=make('Rogue','Quiet Knife'),g=fightFor(knife),w='attack:'+r.weaponAttacks(knife)[0].name;
 const opening=r.adventureStep({...g,openingAttackAvailable:true},hpOf(knife),knife,w,always(.9));assert.match(lines(opening),/First Cut: 2d6/,'the opening blow');
 assert.match(lines(r.adventureStep({...g,round:1},hpOf(knife),knife,w,always(.9))),/First Cut/,'round 1');
 assert.ok(!/First Cut/.test(lines(r.adventureStep({...g,round:2},hpOf(knife),knife,w,always(.9)))),'round 2 does not');}
{// Running with the Pack: only with a companion fighting beside you.
 const ranger=make('Ranger','Packbound'),g=fightFor(ranger),w='attack:'+r.weaponAttacks(ranger)[0].name;
 assert.ok(!/Running with the Pack/.test(lines(r.adventureStep(g,hpOf(ranger),ranger,w,always(.9)))),'alone: nothing');
 const withFriend={...g,followers:{mara:{status:'following'}}};
 const pack=r.adventureStep(withFriend,hpOf(ranger),ranger,w,always(.9));assert.match(lines(pack),/Running with the Pack: 1d6/,'with a companion: '+lines(pack));}
{// The Monk's bonus strike carries Serpent's Fang; Slip Behind opens the next attack (Vex).
 const serpent=make('Monk','Warrior of the Coiled Serpent'),g=fightFor(serpent);
 const strike=r.adventureStep(g,hpOf(serpent),serpent,'class:strike',always(.9));assert.ok(!strike.error,strike.error);assert.match(lines(strike),/Poison damage \(Serpent's Fang: 1d6/,'the bonus strike: '+lines(strike));
 assert.equal(strike.game.featTurn,true,'spent for this turn');valid(serpent,strike.game,strike.health);
 const after=r.adventureStep(strike.game,strike.health,serpent,'attack:Unarmed Strike',always(.9));assert.ok(!/Serpent's Fang/.test(lines(after)),'once a turn');
 const hidden=make('Monk','Warrior of the Hidden Step'),h=r.adventureStep(fightFor(hidden),hpOf(hidden),hidden,'class:strike',always(.9));
 assert.match(lines(h),/Slip Behind: your next attack against the Bandit Cutthroat has advantage\./,lines(h));assert.equal(h.game.vex?.target,'foe');}

{// Against people: once in the attack, at the person's own defences, and nothing left behind.
 const ash=make('Paladin','Oath of Ashes',{level:5}),g={...fightFor(ash),stage:'inn',enemyHP:0};
 const blow=r.adventureStep(g,hpOf(ash),ash,{type:'npc-attack',target:'keeper',weapon:'Longsword'},always(.9));
 assert.ok(!blow.error,blow.error);assert.equal((blow.events??[]).filter(l=>/Cinder Oath/.test(l)).length,1,'one Cinder Oath line in two hits: '+lines(blow));
 assert.equal(blow.game.featTurn,undefined,'no turn field left behind');valid(ash,blow.game,blow.health);}

// ---- 7. A Reaction that blunts a blow ----
{const bulwark=make('Barbarian','Path of the Bulwark'),g={...fightFor(bulwark),resources:{}},hp=hpOf(bulwark);
 // The foe hits (high rolls); Iron Brace takes 1d8 + Con (2) off the first blow of its turn.
 const turn=r.adventureStep(g,hp,bulwark,'dodge',seq([.99,.99,.99,.5,.5,.5,.5,.5,.5,.5,.5,.5]));
 assert.match(lines(turn),/Iron Brace: the blow is reduced by \d+ \(1d8 \[\d\] \+ 2\)\./,lines(turn));
 assert.equal(turn.game.resources.feat,1,'a use spent');assert.equal(turn.game.reactionUsed,false,'the reaction comes back with the next turn');
 assert.match(lines(turn),/− \d+ Iron Brace = \d+ \w+ damage/,'the damage line shows the reduction');valid(bulwark,turn.game,turn.health);
 // A wolf pack: only the first blow of the round is reduced.
 const pack=fightFor(bulwark,'wolves'),many=r.adventureStep({...pack,resources:{}},hp,bulwark,'dodge',always(.99));
 assert.equal((many.events??[]).filter(l=>/Iron Brace:/.test(l)).length,1,'one reaction a round: '+lines(many));
 // A blow reduced to nothing records no damage and throws nothing.
 const weak={...g,story:{...g.story,foeStats:{...g.story.foeStats,die:1,count:1,bonus:0}}},none=r.adventureStep(weak,hp,bulwark,'dodge',seq([.99,.99,.99,0,.99,.5,.5,.5,.5]));
 assert.ok(!none.error,none.error);assert.match(lines(none),/= 0 \w+ damage\. No damage gets through\./,lines(none));assert.equal(none.health.current,hp.current,'no hit points lost');
 // With no uses left, nothing.
 const spent=r.adventureStep({...g,resources:{feat:2}},hp,bulwark,'dodge',always(.99));assert.ok(!/Iron Brace/.test(lines(spent)),'no uses, no reduction');
 // A long rest clears what was spent.
 const rest=r.adventureStep({...r.newAdventure(bulwark),resources:{feat:2}},{current:5,temp:0},bulwark,'long-rest',always(.5));assert.equal(rest.game.resources,undefined);
 // In a brawl too.
 const brawl=r.adventureStep({...g,stage:'inn',enemyHP:0},hp,bulwark,{type:'npc-attack',target:'keeper',weapon:'Greataxe'},always(.99));assert.ok(!brawl.error,brawl.error);
 const blow=r.adventureStep(brawl.game,brawl.health,bulwark,'npc-dodge',always(.99));assert.ok(!blow.error,blow.error);assert.match(lines(blow),/attacks you: .*Critical hit.* | Iron Brace: the blow is reduced by d+/,'a brawl: '+lines(blow));assert.equal(blow.game.resources.feat,1);valid(bulwark,blow.game,blow.health);}
{// Bark and Bramble comes back on a short rest, and the game offers that rest.
 const grove=make('Warlock','Elder Grove Patron'),g={...r.newAdventure(grove),stage:'bridge',resources:{feat:1}};
 assert.ok(r.dmChoices(grove,g,hpOf(grove)).some(c=>c.id==='short-rest'),'a short rest would help');
 const rested=r.adventureStep(g,hpOf(grove),grove,'short-rest',always(.5));assert.ok(!rested.error,rested.error);assert.equal(rested.game.resources.feat,0);assert.match(lines(rested),/Bark and Bramble is ready again\./);
 assert.ok(!r.dmChoices(grove,{...g,resources:{feat:0}},hpOf(grove)).some(c=>c.id==='short-rest'),'nothing to recover, no rest offered');}
{// The College of Lore's Cutting Words (the SRD's own) blunts a blow with a Bardic Inspiration die.
 const lore=make('Bard','College of Lore'),turn=r.adventureStep(fightFor(lore),hpOf(lore),lore,'dodge',seq([.99,.99,.99,.5,.5,.5,.5,.5]));
 assert.match(lines(turn),/Cutting Words: the blow is reduced by \d+ \(1d6 \[\d\]\)\./,lines(turn));}

// ---- 8. Class actions of the subclasses ----
const actionCases=[['Bard','College of Borrowed Faces','jest'],['Bard','College of the Long Road','hearthsong'],['Druid','Circle of the Thornwall','briar'],['Rogue','Silvertongue','feint'],['Sorcerer','Veilborn Sorcery','veil'],['Warlock','Lantern-Keeper Patron','kindly'],['Artificer','Snarewright','tangle'],['Artificer','Alchemist','tonic'],['Artificer','Artillerist','engine']];
for(const [cls,sub,id] of actionCases){
 const hero=make(cls,sub),spec=r.subclassEngine[sub].effects.find(e=>e.kind==='action'),limit=r.subclassUses(hero,spec.uses),healing=!!spec.effect.heal;
 const hurt={current:Math.max(1,r.combatBasics(hero).hp-6),temp:0};
 for(const [label,game] of [['a story fight',fightFor(hero)],['the crossroads fight',plainFight(hero)]]){
  const g={...game,resources:{}},health=healing?hurt:hpOf(hero);
  const chips=r.quickActions(hero,g,health),chip=chips.find(c=>c.key==='class:'+id);
  assert.ok(chip,sub+': a chip in '+label+': '+chips.map(c=>c.key).join(', '));
  assert.equal(r.actionCost(chip,g),spec.bonus?'Bonus action':'Action',sub+' cost');
  const text=r.actionDescription(chip,hero,g);assert.ok(text.length>=20&&text.length<=420&&/[.!?]$/.test(text)&&!/undefined|NaN/.test(text),sub+': '+text);
  assert.deepEqual(plain(r.dmCommand(hero,g,chip.question,health)),{action:'class:'+id},sub+': the chip\'s sentence is understood');
  const used=r.adventureStep(g,health,hero,'class:'+id,always(.3));assert.ok(!used.error,sub+' '+label+': '+used.error);
  assert.equal(used.game.resources.feat,1,sub+': one use spent');valid(hero,used.game,used.health,sub+' '+label+' '+JSON.stringify(used.health));
  // The Dungeon Master's turn carrying the chip is accepted too.
  const dm=r.commitDmTurn(hero,g,health,chip.action??'class:'+id,{question:chip.question,narration:'Done.'},always(.3));assert.ok(!dm.error,sub+' via the DM: '+dm.error);
  // Every use spent: refused, and said why.
  const out=r.adventureStep({...g,resources:{feat:limit}},health,hero,'class:'+id,always(.3));assert.equal(out.error,'No uses of '+spec.name+' remain until you rest.',sub);
  assert.ok(!r.quickActions(hero,{...g,resources:{feat:limit}},health).some(c=>c.key==='class:'+id),sub+': no chip without uses');
 }
}
{// What each one does.
 const jest=make('Bard','College of Borrowed Faces'),j=r.adventureStep(fightFor(jest),hpOf(jest),jest,'class:jest',seq([0,.5,.5,.5,.5,.5,.5,.5]));
 assert.match(lines(j),/Rattling Jest: the Bandit Cutthroat makes a Wisdom save d20 \[1\] \+ -?\d+ = -?\d+ vs DC 12: failure\./,lines(j));assert.equal(j.game.marks?.foe?.sapped,true,'it has disadvantage on its next attack');
 assert.equal(j.game.actionUsed,undefined,'a bonus action leaves the action');
 const kindly=make('Warlock','Lantern-Keeper Patron'),full=r.adventureStep(fightFor(kindly),hpOf(kindly),kindly,'class:kindly',always(.5));assert.equal(full.error,'You are already at full health.');
 const healed=r.adventureStep(fightFor(kindly),{current:3,temp:0},kindly,'class:kindly',always(.5));assert.match(lines(healed),/Kindly Light: \[5\] \+ 3; restored 8 HP\./,lines(healed));
 const briar=make('Druid','Circle of the Thornwall'),b=r.adventureStep(fightFor(briar),hpOf(briar),briar,'class:briar',always(.5));assert.equal(b.health.temp,6,'twice the Druid level');
 const tangle=make('Artificer','Snarewright'),t=r.adventureStep(fightFor(tangle),hpOf(tangle),tangle,'class:tangle',seq([0,.5,.5,.5,.5,.5,.5,.5,.5]));
 assert.match(lines(t),/Tangle-Bolt: the Bandit Cutthroat makes a Dexterity save d20 \[1\] .*failure\. \d+ Piercing damage \(2d6 \[\d, \d\]\); it is knocked prone\./,lines(t));
 const five={...tangle,level:5},t5=r.adventureStep(fightFor(five),hpOf(five),five,'class:tangle',always(.5));assert.match(lines(t5),/Piercing damage \(3d6/,'Barbed Lines');
 const feint=make('Rogue','Silvertongue'),f=r.adventureStep(fightFor(feint),hpOf(feint),feint,'class:feint',always(.5));assert.equal(f.game.vex?.target,'foe');
 const next=r.adventureStep(f.game,f.health,feint,'attack:'+r.weaponAttacks(feint)[0].name,always(.5));assert.match(lines(next),/\(advantage, Vex\)/,'the feint opens the attack');}
{// A bonus action taken after the action ends the turn (the turn waits for it).
 const bard=make('Bard','College of Borrowed Faces'),g=fightFor(bard),hit=r.adventureStep(g,hpOf(bard),bard,'attack:Dagger',always(.5));
 assert.equal(hit.game.actionUsed,true,'the turn waits for a bonus action');assert.ok(r.bonusOptions(bard,hit.game,hit.health,r.combatBasics(bard).hp).some(o=>o.id==='class:jest'));
 const jest=r.adventureStep(hit.game,hit.health,bard,'class:jest',always(.5));assert.ok(!jest.error,jest.error);assert.equal(jest.game.actionUsed,undefined,'the turn is over');assert.ok(jest.game.round>g.round,'the foe has answered');}
// Typed words reach the same action; another class's words do nothing.
assert.deepEqual(plain(r.dmCommand(make('Bard','College of Borrowed Faces'),fightFor(make('Bard','College of Borrowed Faces')),'I mock the brute with a cruel jest')),{action:'class:jest'});
assert.notDeepEqual(plain(r.dmCommand(make('Fighter','Champion'),fightFor(make('Fighter','Champion')),'I feint')??{}),{action:'class:feint'});
// A save holds what was spent, within bounds; old saves without it load.
{const h=make('Rogue','Silvertongue'),g=r.newAdventure(h);assert.ok(r.validAdventure(r.adventureSnapshot(h,{...g,resources:{feat:2}},null,true),h));assert.ok(!r.validAdventure(r.adventureSnapshot(h,{...g,resources:{feat:21}},null,true),h),'at most 20');
 assert.ok(!r.validAdventure(r.adventureSnapshot(h,{...g,stage:'combat',enemyHP:5,featTurn:'yes'},null,true),h),'featTurn is true or absent');assert.ok(r.validAdventure(r.adventureSnapshot(h,g,null,true),h),'an old save');}

// ---- 9. Spell gifts and the gift on victory ----
{const hearth={...make('Cleric','Hearth Domain',{scores:{...baseScores,Wisdom:16}}),spells:['sacred-flame']},g=fightFor(hearth),cast=r.adventureStep(g,hpOf(hearth),hearth,{type:'spell',request:{id:'sacred-flame',slot:0,intent:'Sacred Flame on the bandit',componentsConfirmed:true}},always(.05));
 assert.ok(!cast.error,cast.error);assert.match(lines(cast),/3 Radiant damage \(Banked Fire\)\./,lines(cast));
 const without_=r.adventureStep(g,hpOf(without(hearth)),without(hearth),{type:'spell',request:{id:'sacred-flame',slot:0,intent:'Sacred Flame on the bandit',componentsConfirmed:true}},always(.05));
 assert.equal(g.enemyHP-cast.game.enemyHP,g.enemyHP-without_.game.enemyHP+3,'Wisdom added once');}
{const saint=make('Sorcerer','Saintblood Sorcery'),cure=r.adventureStep({...fightFor(saint)},{current:2,temp:0},saint,{type:'spell',request:{id:'cure',slot:1,intent:'Cure Wounds on myself',componentsConfirmed:true}},always(.5));
 assert.ok(!cure.error,cure.error);assert.match(lines(cure),/\+ 2 Grace in the Blood; restored/,lines(cure));}
{const voidW={...make('Warlock','Whispering Void Patron',{level:5}),spells:['blast']},g=fightFor(voidW),blast=r.adventureStep(g,hpOf(voidW),voidW,{type:'spell',request:{id:'blast',slot:0,intent:'Eldritch Blast at the bandit',componentsConfirmed:true}},always(.9));
 assert.ok(!blast.error,blast.error);assert.match(lines(blast),/beam 2/,'two beams at level 5');assert.equal((blast.events??[]).filter(l=>/\(Echo of the Void\)/.test(l)).length,1,'once a casting: '+lines(blast));}
{const door=make('Cleric','Threshold Domain'),g={...fightFor(door),enemyHP:1},win=r.adventureStep(g,hpOf(door),door,'attack:Mace',always(.9));
 assert.equal(win.game.stage,'victory');assert.equal(win.health.temp,5,"Ferryman's Due: level 3 + Wisdom 2");assert.match(lines(win),/Ferryman's Due: 5 temporary HP\./);}
{const fiend={...make('Warlock','Fiend Patron'),scores:{...baseScores,Charisma:16}},win=r.adventureStep({...fightFor(fiend),enemyHP:1},hpOf(fiend),fiend,'attack:Dagger',always(.9));assert.equal(win.health.temp,6,"the Fiend's gift is unchanged");}
{// A Marshal's companions add the proficiency bonus.
 const marshal=make('Fighter','Marshal'),g={...fightFor(marshal),resources:{...fightFor(marshal).resources,surge:1},followers:{mara:{status:'following'}}},turn=r.adventureStep(g,hpOf(marshal),marshal,'dodge',always(.5));
 assert.match(lines(turn),/attacks the Bandit Cutthroat: d20 \[\d+\] \(normal\) \+ 4 =/,lines(turn));}

// ---- 10. The Dungeon Master is told ----
{const bulwark=make('Barbarian','Path of the Bulwark',{level:6}),c=r.dmContext(bulwark,fightFor(bulwark),hpOf(bulwark));
 assert.deepEqual(plain(c.player.subclassFeatures).map(f=>[f.name,f.level,f.engine]),[['Iron Brace',3,true],['Stand Between',6,false]]);
 assert.ok(c.player.subclassFeatures.every(f=>f.rule.length<=140));
 const {sceneFor}=require('./dm-server.cjs');const scene=sceneFor({context:plain(c),input:'I brace'}).context;assert.deepEqual(scene.player.subclassFeatures,plain(c.player.subclassFeatures),'the trimmed scene keeps them');
 delete require.cache[require.resolve('./dm-rules.cjs')];const {rulesFor}=require('./dm-rules.cjs'),rules=rulesFor({input:'I use Iron Brace',context:plain(c)});
 assert.ok(rules.availableFeatures.some(f=>f.name==='Iron Brace'&&f.automation==='engine'));assert.deepEqual(rules.featureDetails.map(f=>f.name),['Iron Brace']);
 assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes('SUBCLASS FEATURES: context.player.subclassFeatures'),'the standing instructions explain them');
 assert.deepEqual(plain(r.dmContext(make('Barbarian','Path of the Bulwark',{level:2}),r.newAdventure(make('Barbarian','Path of the Bulwark',{level:2})),null).player.subclassFeatures),[],'nothing before level 3');}
{// The non-bonus action is a choice beside Dodge; the bonus one among the bonus actions.
 const snare=make('Artificer','Snarewright'),choices=r.dmChoices(snare,fightFor(snare),hpOf(snare)).map(c=>c.id);assert.ok(choices.includes('class:tangle'));
 const bard=make('Bard','College of Borrowed Faces');assert.ok(r.dmChoices(bard,fightFor(bard),hpOf(bard)).some(c=>c.id==='class:jest'));}

// ---- A party at the shared table: the spent extra is the hero's turn's, the uses the hero's own ----
{const ember=make('Barbarian','Path of the Ember Heart'),g=fightFor(ember),snap=r.adventureSnapshot(ember,{...g,featTurn:true,resources:{feat:0}},hpOf(ember),true);
 const party=r.startParty({...snap,character:JSON.stringify(ember)},'p1','Ana'),order={order:[{id:'p1',init:15},{id:'foe',init:3}],at:0,round:1};
 const table={...party,game:{...party.game,turnOrder:order}},settled=r.settleParty(table);
 assert.equal(settled.members.p1.turn?.featTurn,true,'kept with the hero whose turn it is');assert.equal(settled.world.featTurn,undefined,'not part of the shared world');
 const view=r.partyView(table,'p1');assert.equal(view.game.featTurn,true,'and given back to them');
 const later=r.partyView({...table,game:{...table.game,turnOrder:{...order,at:1}}},'p1');assert.equal(later.game.featTurn,undefined,'gone once the turn has passed');}

// ---- 11. Every subclass's level-3 signature, played through the engine ----
const castBy={'Hearth Domain':['sacred-flame',0,.05],'Circle of the Fallow Field':['ray-of-sickness',1,.95],'Frostblood Sorcery':['ice-knife',1,.95],'Whispering Void Patron':['mind-spike',2,.05],Bonewright:['chill-touch',0,.95],'Circle of the Hollow Hill':['cure',1,.5],'Saintblood Sorcery':['cure',1,.5]};
const surface=h=>JSON.stringify([r.combatBasics(h),r.weaponAttacks(h).map(w=>w.proficient),r.trainedSkills(h),r.unarmedDC(h),r.subclassPassive(h).companionBonus,r.attacksPerAction(h)]);
let played=0;
for(const [name,spec] of Object.entries(r.subclassEngine)){
 for(const e of spec.effects.filter(x=>x.level===3)){
  const hero=make(spec.class,name),what=name+' ('+e.kind+')';
  if(e.kind==='passive'){
   const fitted=e.acBonus?.when==='armor'||e.martial?make(spec.class,name,{items:[...hero.equipment.items,{name:'Chain Mail',quantity:1},{name:'Longsword',quantity:1}]}):hero;
   assert.notEqual(surface(fitted),surface(without(fitted)),what+' changes the hero');
  } else if(e.kind==='rider'){
   const g={...fightFor(hero),round:1,followers:{mara:{status:'following'}}},foe={...g,enemyHP:g.enemyHP-1};
   const w=e.when==='martialArts'?'attack:Unarmed Strike':'attack:'+r.weaponAttacks(hero).find(x=>e.when!=='melee'||!x.ranged).name;
   const hit=r.adventureStep(foe,hpOf(hero),hero,w,always(.9));assert.ok(!hit.error,what+': '+hit.error);assert.ok(lines(hit).includes(e.name),what+': '+lines(hit));
  } else if(e.kind==='ward'){
   let turn=r.adventureStep({...fightFor(hero),resources:{}},hpOf(hero),hero,'dodge',always(.99));if(turn.game.actionUsed)turn=r.adventureStep(turn.game,turn.health,hero,'end-turn',always(.99));assert.ok(lines(turn).includes(e.name+': the blow is reduced'),what+': '+lines(turn));
  } else if(e.kind==='action'){
   assert.ok(actionCases.some(([,sub])=>sub===name),what+' is played in section 8');
  } else if(e.kind==='spell'){
   const [id,slot,roll]=castBy[name],caster={...hero,spells:[id]},health=e.heal?{current:2,temp:0}:hpOf(caster);
   const cast=r.adventureStep(fightFor(caster),health,caster,{type:'spell',request:{id,slot,intent:'At the bandit',componentsConfirmed:true}},always(roll));
   assert.ok(!cast.error,what+': '+cast.error);assert.ok(lines(cast).includes(e.name),what+': '+lines(cast));
  } else if(e.kind==='victory'){
   const win=r.adventureStep({...fightFor(hero),enemyHP:1},hpOf(hero),hero,'attack:'+r.weaponAttacks(hero)[0].name,always(.9));assert.ok(lines(win).includes(e.name),what);
  } else assert.fail('unknown kind '+e.kind);
  played++;
 }
}
assert.ok(played>=43,'every level-3 effect played: '+played);

console.log('Subclasses: passed.');
