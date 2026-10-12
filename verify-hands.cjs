const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Hands (weaponRules.js, the host on 2026-10-11: "2 handed weapons should take up both hands unless otherwise capable of
// dual wielding, even so there should be a small bonus added for 2 handedly holding a weapon with one handed
// potential"): a shield takes a hand; a two-handed weapon takes both, so while one is the weapon in hand the shield is
// slung and adds nothing to armor class (its magic neither), and no other hand strikes; with a shield on the arm a
// hero fights one-handed unless the player takes the two-hander in hand; a versatile weapon in both hands deals its
// larger die, one-handed (a shield, a throw, a grapple held) its own. The engine, the Attack… picker, the descriptions,
// the Dungeon Master's context and the campaign edit agree, and old saves still load.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({weapons,weaponAttacks,attackOptions,readyLoadout,loadoutWarnings,shieldSlung,shieldInUse,canTakeInHand,thrownAttack,oneHanded,offhandWeapons,gearedHero,magicEffects,makeMagicItem,equipmentFor,readyHero,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,validAdventure,adventureSnapshot,combatBasics,dmChoices,dmContext,attackActions,itemDescription,actionDescription,rollDamage})',{AsyncStorage:{}});
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const scores={Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10};
const make=(cls,{level=1,items=null,wield=null}={})=>{const hero={name:'Hands tester',class:cls,species:'Human',level,background:'Soldier',scores,spells:[]};hero.equipment=r.equipmentFor(hero);if(items)hero.equipment={...hero.equipment,items};if(wield)hero.equipment={...hero.equipment,wield};return hero;};
const withItems=(hero,extra)=>({...hero,equipment:{...hero.equipment,items:[...hero.equipment.items,...extra]}});
const named=(hero,name)=>r.weaponAttacks(hero).find(w=>w.name===name);
const fightFor=(hero,foe='bandit')=>({...r.hostileEncounterGame(hero,r.newAdventure(hero),pick(foe)),openingAttackAvailable:false});
const hpOf=hero=>({current:r.combatBasics(hero).hp,temp:0});
const valid=(hero,game,health)=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(game)),health,true),hero),'the save is valid');

// ---- The weapon table: two-handed and versatile weapons as in the 2024 table ----
for(const name of ['Greataxe','Greatsword','Shortbow','Longbow','Maul','Glaive','Halberd'])assert.ok(r.weapons[name].twoHands,name+' needs both hands');
for(const [name,die,both] of [['Quarterstaff',6,8],['Spear',6,8],['Longsword',8,10],['Battleaxe',8,10],['Trident',8,10]]){assert.equal(r.weapons[name].die,die,name);assert.equal(r.weapons[name].versatile,both,name+' in both hands');}
assert.ok(Object.values(r.weapons).every(w=>!(w.light&&(w.versatile||w.twoHands))),'no Light weapon is versatile or two-handed: two-weapon fighting never meets a two-handed grip');
assert.deepEqual(['Battleaxe','Trident','Maul','Glaive','Halberd'].map(n=>r.weapons[n].mastery),['Topple','Topple','Topple','Graze','Cleave']);
assert.match(r.itemDescription('Longsword'),/versatile \(1d10 in both hands\)/);assert.match(r.itemDescription('Halberd'),/heavy, two-handed, reach/);assert.match(r.itemDescription('Shield'),/two-handed weapon/);

// ---- A shield on the arm: one-handed blows, the shield's AC counted, two-handers kept on the back ----
const paladin=make('Paladin');
assert.equal(r.combatBasics(paladin).ac,18,'Chain Mail and a shield');
assert.equal(named(paladin,'Longsword').die,8,'a longsword beside a shield is one-handed');assert.equal(named(paladin,'Longsword').grip,'one');
assert.ok(r.shieldInUse(paladin)&&!r.shieldSlung(paladin));
const foundGreatsword={gold:0,items:[{name:'Greatsword',kind:'weapon',qty:1}],spent:{}};
const carrying=r.gearedHero(paladin,{...r.newAdventure(paladin),pack:foundGreatsword});
const blocked=named(carrying,'Greatsword');assert.ok(blocked.blocked&&blocked.handsBlocked,'a found greatsword waits on the back');
assert.ok(!r.attackOptions(carrying).some(w=>w.name==='Greatsword'),'and is not offered while the shield is up');
assert.equal(r.readyLoadout(carrying).mainWeapon,'Longsword','a hero with a shield prefers a one-handed weapon');
assert.ok(r.canTakeInHand(carrying,'Greatsword'),'but it can be taken in hand');
assert.equal(r.combatBasics(carrying).ac,18);
assert.ok(r.loadoutWarnings(carrying).some(t=>/Greatsword.*both hands/.test(t)),'the loadout warning says so: '+r.loadoutWarnings(carrying).join(' | '));
// Taken in hand: the shield is slung, armor class drops by 2, and the greatsword leads.
const twoHanded=r.gearedHero(paladin,{...r.newAdventure(paladin),pack:foundGreatsword,wield:'Greatsword'});
assert.ok(r.shieldSlung(twoHanded)&&!r.shieldInUse(twoHanded));
assert.equal(r.combatBasics(twoHanded).ac,16,'no shield bonus with a two-handed weapon in hand');
assert.match(r.combatBasics(twoHanded).armorNote,/shield is on your back/);
assert.equal(r.attackOptions(twoHanded)[0].name,'Greatsword');assert.equal(r.readyLoadout(twoHanded).mainWeapon,'Greatsword');
assert.ok(r.loadoutWarnings(twoHanded).some(t=>/slung/.test(t)),'the warning says the shield is slung');
// A magic shield slung on the back lends nothing either.
const magicShield=r.makeMagicItem('shield+1',paladin);
assert.equal(r.magicEffects(paladin,{items:[magicShield]}).ac,1);
assert.equal(r.magicEffects(twoHanded,{items:[magicShield]}).ac,0,'a +1 shield on the back adds nothing');
// Bows are two-handed too: a hero with a shield takes the bow in hand to shoot, and the shield goes on the back.
const archer=withItems(make('Ranger'),[{name:'Shield',quantity:1}]);
assert.ok(named(archer,'Longbow').handsBlocked,'a longbow is not drawn with a shield on the arm');
const drawn={...archer,equipment:{...archer.equipment,wield:'Longbow'}};
assert.ok(!named(drawn,'Longbow').blocked&&r.shieldSlung(drawn),'taken in hand, the bow shoots and the shield is slung');
assert.equal(r.combatBasics(drawn).ac,r.combatBasics(archer).ac-2);
// A hero whose only close-range weapons need both hands fights with them, shield slung (nothing to hold one-handed).
const heavy=make('Fighter',{items:[{name:'Chain Mail',quantity:1},{name:'Greatsword',quantity:1},{name:'Shield',quantity:1}]});
assert.ok(r.shieldSlung(heavy));assert.equal(r.combatBasics(heavy).ac,16);assert.equal(r.attackOptions(heavy)[0].name,'Greatsword');

// ---- Both hands on a versatile weapon: the larger die ----
const fighter=withItems(make('Fighter'),[{name:'Longsword',quantity:1}]);
const sword=named(fighter,'Longsword');assert.equal(sword.die,10,'a longsword in both hands deals 1d10');assert.equal(sword.grip,'two');assert.equal(sword.oneHandDie,8);
assert.equal(r.thrownAttack(named(make('Monk'),'Spear')).die,6,'a thrown spear is one-handed');
assert.equal(named(make('Monk'),'Spear').die,8,'a Monk holds the spear in both hands: 1d8 (more than the d6 Martial Arts die)');
assert.equal(named(make('Wizard'),'Quarterstaff').die,8,'a wizard’s staff in both hands');
assert.equal(named(make('Druid'),'Quarterstaff').die,6,'a druid with a shield holds the staff in one hand');
assert.equal(r.oneHanded(sword).die,8);
// The Attack… picker shows the grip.
{const sworded={...fighter,equipment:{...fighter.equipment,wield:'Longsword'}},g=fightFor(sworded);
 const row=r.attackActions(sworded,g,hpOf(sworded)),chip=row.find(a=>a.weapon==='Longsword');assert.match(chip.detail,/1d10\+3 two-handed/,chip.detail);
 const pal=r.attackActions(paladin,fightFor(paladin),hpOf(paladin)).find(a=>a.weapon==='Longsword');assert.match(pal.detail,/1d8\+3 one-handed/,pal.detail);
 assert.match(r.actionDescription(chip,sworded,g),/both hands on it; 1d8 in one hand/);
 // The engine rolls the larger die: a hit with every die at its top deals 10 + 3.
 const hit=r.adventureStep(g,hpOf(sworded),sworded,'attack:Longsword',seq([0.9,0.999,0.999,0.5]));
 assert.ok(hit.events.some(t=>/13 slashing damage \(10 \+3\)/.test(t)),hit.events.join(' | '));valid(sworded,hit.game,hit.health);
 // The Dungeon Master is told how the hero holds it.
 const ctx=r.dmContext(sworded,g,hpOf(sworded));assert.ok(ctx.attackOptions.carried.some(t=>/Longsword \(versatile, in both hands: 1d10\)/.test(t)),ctx.attackOptions.carried.join(' | '));assert.match(ctx.attackOptions.hands,/versatile/);
 const ctx2=r.dmContext(twoHanded,fightFor(twoHanded),hpOf(twoHanded));assert.match(ctx2.attackOptions.hands,/slung/);}
// A hand holding a grapple leaves one for the sword: after the grapple, Extra Attack strikes one-handed (1d8).
{const f5={...withItems(make('Fighter',{level:5}),[{name:'Longsword',quantity:1}])};const held={...f5,equipment:{...f5.equipment,wield:'Longsword'}};
 const g=fightFor(held),grip=r.adventureStep(g,hpOf(held),held,'grapple',seq([0.01,0.9,0.999,0.999,0.5,0.5,0.5,0.5]));
 const text=grip.events.join(' | ');assert.match(text,/Grapple:.*failure/,text);assert.match(text,/11 slashing damage \(8 \+3\)/,'the second attack is one-handed: '+text);}

// ---- No other hand strikes beside a two-handed weapon or a shield ----
{const rogue=make('Rogue'),g=fightFor(rogue),first=r.adventureStep(g,hpOf(rogue),rogue,'attack:Shortsword',seq([0.95,0.5,0.5,0.1,0.1]));
 assert.ok(r.dmChoices(rogue,first.game,first.health).some(c=>c.id==='offhand:Dagger'),'two Light weapons: the other hand strikes');
 const big={gold:0,items:[{name:'Greatsword',kind:'weapon',qty:1}],spent:{}};
 const gripping=r.gearedHero(rogue,{...first.game,pack:big,wield:'Greatsword'});assert.equal(r.offhandWeapons(gripping,'Shortsword').length,0,'both hands are on the greatsword');
 const k=r.readyHero('fighter'),kg=fightFor(k),swung=r.adventureStep(kg,hpOf(k),k,'attack:Greatsword',seq([0.95,0.5,0.5,0.1,0.1]));
 assert.ok(!r.dmChoices(k,swung.game,swung.health).some(c=>/^offhand:/.test(c.id)),'no off-hand attack after a greatsword');}

// ---- Old saves: a game with a two-hander in hand, and the ready-made heroes, load as before ----
for(const key of ['fighter','rogue','wizard','cleric']){const h=r.readyHero(key);valid(h,r.newAdventure(h),hpOf(h));}
valid(paladin,{...r.newAdventure(paladin),pack:foundGreatsword,wield:'Greatsword'},hpOf(paladin));
console.log('Passed: two-handed weapons take both hands (the shield slung and its armor class and magic dropped, no other hand, bows included, a shield-bearer fighting one-handed unless the two-hander is taken in hand); versatile weapons deal their larger die in both hands and their own beside a shield, thrown or with a grapple held; picker, descriptions, Dungeon Master context and old saves agree.');
