const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Weapon Mastery, two-weapon fighting, and grappling and shoving, against the 2024 rules (SRD 5.2): each weapon's own
// mastery property, the classes that master weapons and how many kinds, every property doing what the rules say
// (Graze, Sap, Vex, Slow, Topple, Cleave, Nick), the Light property's extra attack (a bonus action, no ability bonus to
// its damage, not with a shield), and an Unarmed Strike that grapples or shoves (a save against 8 + Strength +
// proficiency, size limits, a grappled creature's speed 0 and disadvantage at others, prone's advantage and
// disadvantage, letting go to swing a two-handed weapon). Saves stay valid; nothing outlasts the fight.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({weapons,masteryCount,masteredWeapons,masteryOf,offhandWeapons,creatureSize,withinGrip,unarmedDC,readyHero,equipmentFor,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,validAdventure,adventureSnapshot,combatBasics,dmChoices,dmCommand,dmContext,quickActions,attackActions,actionDescription,itemDescription,freshStoryGame,bonusOptions})',{AsyncStorage:{}});
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const always=v=>()=>v;
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const make=(cls,{level=1,scores={Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},items=null,species='Human'}={})=>{const hero={name:'Mastery tester',class:cls,species,level,background:'Soldier',scores,spells:[]};hero.equipment=r.equipmentFor(hero);if(items)hero.equipment={...hero.equipment,items};return hero;};
const fightFor=(hero,foe='bandit')=>{const g=r.hostileEncounterGame(hero,r.newAdventure(hero),pick(foe));return {...g,openingAttackAvailable:false};};
const hpOf=hero=>({current:r.combatBasics(hero).hp,temp:0});
const valid=(hero,game,health)=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(game)),health,true),hero),'the save is valid');
const lines=s=>(s.events??[]).join(' | ');

// ---- Each weapon's mastery property, as in the 2024 weapon table ----
const table={Dagger:'Nick',Handaxe:'Vex',Javelin:'Slow',Mace:'Sap',Quarterstaff:'Topple',Sickle:'Nick',Spear:'Sap',Greataxe:'Cleave',Greatsword:'Graze',Flail:'Sap',Longsword:'Sap',Scimitar:'Nick',Shortsword:'Vex',Shortbow:'Vex',Longbow:'Slow'};
for(const [name,mastery] of Object.entries(table))assert.equal(r.weapons[name].mastery,mastery,name);
assert.deepEqual(Object.keys(r.weapons).filter(n=>r.weapons[n].light).sort(),['Dagger','Handaxe','Scimitar','Shortsword','Sickle'],'the Light weapons');
// ---- Who masters weapons, and how many kinds ----
for(const [cls,levels] of Object.entries({Fighter:[[1,3],[4,4],[10,5],[16,6]],Barbarian:[[1,2],[4,3],[10,4]],Paladin:[[1,2],[20,2]],Ranger:[[1,2]],Rogue:[[1,2]],Wizard:[[1,0]],Cleric:[[5,0]],Monk:[[1,0]]}))for(const [level,count] of levels)assert.equal(r.masteryCount({class:cls,level}),count,cls+' '+level);
const kara=r.readyHero('fighter');assert.equal(r.masteredWeapons(kara).join(),'Greatsword,Javelin,Flail','a Fighter masters three kinds: the main weapon, one for range, one more');
const pip=r.readyHero('rogue');assert.equal(r.masteredWeapons(pip).join(),'Shortsword,Shortbow','a Rogue masters two: the main weapon and the bow');
const wizard=make('Wizard',{scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10}});assert.equal(r.masteredWeapons(wizard).length,0,'a Wizard masters none');
const barbarian=make('Barbarian');assert.ok(r.masteredWeapons(barbarian).every(n=>!r.weapons[n].ranged),'a Barbarian masters melee weapons only: '+r.masteredWeapons(barbarian));

// ---- Graze: a miss still deals the ability bonus ----
{const g=fightFor(kara),miss=r.adventureStep(g,hpOf(kara),kara,'attack:Greatsword',seq([0.1,0.9,0.9,0.9]));
 assert.match(lines(miss),/Miss\..*Graze: the swing still deals 3 slashing damage\./);assert.equal(miss.game.enemyHP,g.enemyHP-3);
 const plain=r.adventureStep(fightFor(wizard),hpOf(wizard),wizard,'attack:'+r.masteredWeapons(wizard).concat(['Quarterstaff'])[0],seq([0.1]));assert.ok(!/Graze/.test(lines(plain)),'no mastery, no graze');}

// ---- Sap: the creature's next attack has disadvantage ----
{const flail={...kara,equipment:{...kara.equipment,wield:'Flail'}};
 const g=fightFor(flail),hit=r.adventureStep(g,hpOf(flail),flail,'attack:Flail',seq([0.9,0.5,0.5,0.5,0.5,0.5]));
 assert.match(lines(hit),/Sap: the Bandit Cutthroat has disadvantage on its next attack\./);
 assert.match(lines(hit),/Bandit Cutthroat: d20 \[\d+, \d+\] \(disadvantage, Sap\)/,'its attack that round: '+lines(hit));
 assert.equal(hit.game.marks,undefined,'spent, and gone by the hero\'s next turn');valid(flail,hit.game,hit.health);}

// ---- Vex: advantage on the next attack against that creature, until the end of the hero's next turn ----
{const g=fightFor(pip),hit=r.adventureStep(g,hpOf(pip),pip,'attack:Shortsword',seq([0.9,0.5,0.1,0.1,0.1,0.1,0.1]));
 assert.match(lines(hit),/Vex: your next attack against the Bandit Cutthroat has advantage\./);
 // The rogue's other hand may follow up (two-weapon fighting); either way the turn ends and Vex carries over.
 let after=hit;if(after.game.actionUsed)after=r.adventureStep(after.game,after.health,pip,'end-turn',always(0.1));
 assert.equal(after.game.vex?.target,'foe');valid(pip,after.game,after.health);
 const next=r.adventureStep(after.game,after.health,pip,'attack:Shortsword',seq([0.1,0.1,0.1]));
 assert.match(lines(next),/You use Shortsword: d20 \[\d+, \d+\] \(advantage, Vex\)/,'the next attack has advantage');
 // Unused, it ends with the hero's next turn.
 const idle=r.adventureStep(after.game,after.health,pip,'dodge',always(0.1));let later=idle.game.actionUsed?r.adventureStep(idle.game,idle.health,pip,'end-turn',always(0.1)):idle;
 assert.equal(later.game.vex,undefined,'Vex is gone after the next turn');}

// ---- Slow: speed down 10 feet until the hero's next turn ----
{const g=fightFor(kara),thrown=r.adventureStep(g,hpOf(kara),kara,'throw:Javelin',seq([0.9,0.5,0.1,0.1,0.1]));
 assert.match(lines(thrown),/Slow: the Bandit Cutthroat loses 10 feet of speed until your next turn\./);}

// ---- Topple: a Constitution save or prone; prone gives melee advantage and ranged disadvantage, and it gets up ----
{const monkish=make('Fighter',{items:[{name:'Quarterstaff',quantity:1},{name:'Shortbow',quantity:1},{name:'Arrow',quantity:20},{name:'Leather Armor',quantity:1}]});
 assert.equal(r.masteryOf(monkish,{name:'Quarterstaff'}),'Topple');
 const g=fightFor(monkish),hit=r.adventureStep(g,hpOf(monkish),monkish,'attack:Quarterstaff',seq([0.9,0.5,0.01,0.99,0.5,0.5,0.5]));
 assert.match(lines(hit),/Topple: the Bandit Cutthroat makes a Constitution save d20 \[1\] \+ \d+ = \d+ vs DC \d+: failure\. It falls prone\./);
 assert.match(lines(hit),/gets back to its feet/,'on its turn it stands up (it is not held)');
 const prone={...g,marks:{foe:{prone:true}}};
 assert.match(lines(r.adventureStep(prone,hpOf(monkish),monkish,'attack:Quarterstaff',seq([0.1,0.1,0.1]))),/\(advantage, prone\)/,'a melee attack at a prone creature has advantage');
 assert.match(lines(r.adventureStep(prone,hpOf(monkish),monkish,'attack:Shortbow',seq([0.9,0.9,0.1]))),/\(disadvantage, prone\)/,'a shot at it has disadvantage');}

// ---- Cleave: a second foe beside the first, once a turn, without the ability bonus ----
{const axe=make('Barbarian',{items:[{name:'Greataxe',quantity:1},{name:'Handaxe',quantity:4}]});
 const camp={...r.hostileEncounterGame(axe,r.newAdventure(axe),()=>0),stage:'inn'};delete camp.openingAttackAvailable;
 const lair={name:'Cutthroat Hollow',description:'A bandit camp in a ravine.',kind:'camp',bearing:'E',miles:1,danger:'lair',feature:null,lair:{template:'bandit',name:'Red Maddock',appearance:'A rangy bandit with a red scarf.',ally:{template:'wolf',name:'War Hound',appearance:'A lean, scarred hound.'}}};
 const arrive=r.adventureStep(camp,hpOf(axe),axe,{type:'discover',place:lair,travel:true},()=>0.5);assert.equal(arrive.error,undefined);
 const g={...arrive.game,openingAttackAvailable:false},hit=r.adventureStep(g,hpOf(axe),axe,'attack:Greataxe',seq([0.95,0.3,0.95,0.5,0.5,0.5,0.5]));
 assert.match(lines(hit),/Cleave: you swing on into the War Hound: d20 \[\d+\] \(normal\) \+ \d+ = \d+ vs AC \d+\. (Hit|Critical hit)/);
 assert.match(lines(hit),/Cleave:.*?\| \d+ slashing damage \(\d+\)\./,'no ability bonus on the second blow');
 assert.ok((hit.game.foeAllies?.[0]?.hp??0)<g.foeAllies[0].hp,'the hound is hurt (or down)');valid(axe,hit.game,hit.health);}

// ---- Two weapons: the Light property, Nick, no shield ----
{// A rogue (no Nick mastery) with a shortsword and a dagger: the other hand's blow is a bonus action.
 const g=fightFor(pip),first=r.adventureStep(g,hpOf(pip),pip,'attack:Shortsword',seq([0.1,0.1]));
 assert.equal(first.game.actionUsed,true,'the turn waits: the other hand can still strike');assert.equal(first.game.lightAttack.weapon,'Shortsword');
 assert.ok(r.dmChoices(pip,first.game,first.health).some(c=>c.id==='offhand:Dagger'),'offered as a bonus action');
 const chip=r.quickActions(pip,first.game,first.health).find(a=>a.key==='offhand:Dagger');assert.ok(chip&&chip.detail==='Bonus');assert.ok(r.actionDescription(chip,pip,first.game).length>40);
 const off=r.adventureStep(first.game,first.health,pip,'offhand:Dagger',seq([0.9,0.5,0.5,0.1,0.1]));
 assert.match(lines(off),/You use Dagger \(other hand\): d20/);assert.match(lines(off),/\d+ piercing damage \(\d+ \+0\)\./,'no ability bonus to its damage: '+lines(off));
 assert.equal(off.game.actionUsed,undefined,'a bonus action taken after the action ends the turn');assert.equal(off.game.lightAttack,undefined);
 assert.match(r.adventureStep(g,hpOf(pip),pip,'offhand:Dagger',always(0.5)).error,/light weapon first/,'never before the light attack');
 // A greatsword is not light: no extra attack.
 const big=r.adventureStep(fightFor(kara),{current:5,temp:0},kara,'attack:Greatsword',seq([0.1,0.1]));assert.ok(!r.dmChoices(kara,big.game,big.health).some(c=>/^offhand:/.test(c.id)));
 // With a shield on one arm there is no hand for a second weapon.
 const shielded={...pip,equipment:{...pip.equipment,items:[...pip.equipment.items,{name:'Shield',quantity:1}]}};assert.equal(r.offhandWeapons(shielded,'Shortsword').length,0);
 // Nick: a Fighter who has mastered daggers makes the second blow as part of the Attack action.
 const twin=make('Fighter',{scores:{Strength:10,Dexterity:16,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},items:[{name:'Dagger',quantity:2},{name:'Leather Armor',quantity:1}]});
 assert.equal(r.masteryOf(twin,{name:'Dagger'}),'Nick');
 const t1=r.adventureStep(fightFor(twin),{current:5,temp:0},twin,'attack:Dagger',seq([0.1,0.1]));
 const nickChip=r.quickActions(twin,t1.game,t1.health).find(a=>a.key==='offhand:Dagger');assert.equal(nickChip?.detail,'Nick');
 const t2=r.adventureStep(t1.game,t1.health,twin,'offhand:Dagger',seq([0.1,0.1]));
 assert.equal(t2.game.nickUsed,true);assert.notEqual(t2.game.bonusUsed,true,'Nick leaves the bonus action free');
 assert.equal(t2.game.actionUsed,true,'so Second Wind (hurt) is still on offer');assert.ok(r.dmChoices(twin,t2.game,t2.health).some(c=>c.id==='class:wind'));
 assert.ok(!r.dmChoices(twin,t2.game,t2.health).some(c=>/^offhand:/.test(c.id)),'once a turn');valid(twin,t2.game,t2.health);}

// ---- Grapple and Shove ----
{assert.equal(r.unarmedDC(kara),8+3+2,'8 + Strength + proficiency');
 const g=fightFor(kara);
 // Grapple: the bandit fails its save and is held.
 const held=r.adventureStep(g,hpOf(kara),kara,'grapple',seq([0.05,0.5,0.5,0.5,0.5,0.5]));assert.equal(held.error,undefined,held.error);
 assert.match(lines(held),/Grapple: the Bandit Cutthroat resists with a (Strength|Dexterity) save d20 \[2\] \+ \d+ = \d+ vs DC 13: failure\. You have it in your grip/);
 assert.equal(held.game.marks.foe.grappled,'hero');valid(kara,held.game,held.health);
 assert.ok(!r.dmChoices(kara,held.game,held.health).some(c=>c.id==='grapple'),'already held: no second grapple');
 // A two-handed weapon needs the hand: Kara lets go to swing her greatsword.
 const swing=r.adventureStep(held.game,held.health,kara,'attack:Greatsword',seq([0.5,0.5,0.5,0.5]));
 assert.match(lines(swing),/You let go of the Bandit Cutthroat\./);assert.equal(swing.game.marks?.foe?.grappled,undefined);
 // Shove while holding it: it falls prone and cannot get up while held (its speed is 0).
 const pinned={...held.game},shoved=r.adventureStep(pinned,held.health,{...kara,equipment:{...kara.equipment,wield:'Flail'}},'shove',seq([0.05,0.5,0.5,0.5,0.5,0.5,0.5]));
 assert.match(lines(shoved),/Shove: .* failure\. It goes down prone\./);assert.match(lines(shoved),/is held down and cannot get up/);
 assert.match(lines(shoved),/Bandit Cutthroat: d20 \[\d+, \d+\] \(disadvantage, prone\)/,'prone, its attacks have disadvantage: '+lines(shoved));
 // Size: a halfling cannot grapple a Large giant spider; a human can.
 const halfling=make('Fighter',{species:'Halfling'}),spider=fightFor(halfling,'spider');assert.equal(r.creatureSize(spider,'foe'),'Large');
 assert.match(r.adventureStep(spider,hpOf(halfling),halfling,'grapple',always(0.5)).error,/too big/);assert.ok(!r.dmChoices(halfling,spider,null).some(c=>c.id==='grapple'));
 assert.ok(r.dmChoices(kara,fightFor(kara,'spider'),null).some(c=>c.id==='grapple'),'Medium against Large is within reach');
 // Extra Attack: a grapple takes one attack; the next is made with a weapon that leaves a hand free.
 const vet={...r.readyHero('fighter'),level:5},both=r.adventureStep(fightFor(vet),hpOf(vet),vet,'grapple',seq([0.05,0.5,0.5,0.5,0.5,0.5,0.5]));
 assert.match(lines(both),/You use Flail: d20/,'the second attack with the one-handed flail: '+lines(both));
 // The Attack… picker and the typed words.
 const row=r.attackActions(kara,g,hpOf(kara));assert.ok(row.some(a=>a.key==='grapple'&&a.label==='Grapple'&&a.detail==='DC 13')&&row.some(a=>a.key==='shove'));
 assert.equal(JSON.stringify(r.dmCommand(kara,g,'I grapple the bandit',hpOf(kara)).action),JSON.stringify({type:'encounter-attack',weapon:'Unarmed Strike',unarmed:'grapple'}));
 assert.equal(r.dmCommand(kara,g,'I shove him to the ground',hpOf(kara)).action.unarmed,'shove');
 assert.notEqual(r.dmCommand(kara,{...g,stage:'inn'},'I grab the key',hpOf(kara))?.action?.unarmed,'grapple','grabbing a thing is not a grapple');
 assert.ok(r.actionDescription({key:'grapple'},kara,g).includes('DC 13'));
 // Typed off-hand words.
 const lit=r.adventureStep(fightFor(pip),hpOf(pip),pip,'attack:Shortsword',seq([0.1,0.1]));assert.equal(r.dmCommand(pip,lit.game,'I stab with my other dagger',lit.health).action,'offhand:Dagger');}

// ---- People: Sap and grapples in a brawl ----
{const written={title:'The Test Road',premise:'A quiet inn.',opening:'You arrive.',objective:'Find the thief.',resolution:'Catch them.',secret:'The keeper knows.',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone.',locations:{inn:{name:'The Lamp',description:'An inn.'},bridge:{name:'The Ford',description:'A ford.'},tower:{name:'The Mill',description:'A mill.'}},npcs:{keeper:{name:'Ivo Brask',species:'Human',role:'Innkeeper',motive:'Keep the peace.',appearance:'A tall man with a grey beard.',personality:'Gruff, slow to trust.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera Vane',species:'Elf',role:'Scribe',motive:'Learn the truth.',appearance:'A slight elf with ink on her hands.',personality:'Curious and precise.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
 const flail={...kara,equipment:{...kara.equipment,wield:'Flail'}},inn=r.freshStoryGame(flail,{...written,id:'test-story',status:'active'},r.newAdventure(flail));
 assert.ok(r.dmChoices(flail,inn,null).some(c=>c.id==='npc-grapple:keeper'),'a person can be grappled');
 const blow=r.adventureStep(inn,null,flail,{type:'npc-attack',target:'keeper',weapon:'Flail'},seq([0.9,0.1,0.5,0.5,0.5,0.5,0.5,0.5]));assert.equal(blow.error,undefined,blow.error);
 assert.match(lines(blow),/Sap: Ivo Brask has disadvantage on their next attack\./);
 if(blow.game.npcCombat?.active){const theirs=(blow.events??[]).find(e=>/^Ivo Brask attacks you/.test(e));if(theirs)assert.match(theirs,/Sap/);}
 valid(flail,blow.game,blow.health);}

// ---- Nothing of a fight outlasts it ----
{const g={...fightFor(kara),marks:{foe:{prone:true}},vex:{target:'foe'}};const won=r.adventureStep({...g,enemyHP:1},hpOf(kara),kara,'attack:Greatsword',seq([0.95,0.9,0.9]));
 assert.equal(won.game.stage,'victory');assert.equal(won.game.marks,undefined);assert.equal(won.game.vex,undefined);}
// ---- The Dungeon Master knows ----
{const ctx=r.dmContext(kara,{...fightFor(kara),marks:{foe:{prone:true,grappled:'hero'}}},hpOf(kara));
 assert.equal(ctx.attackOptions.masteries.length,3);assert.match(ctx.attackOptions.masteries[0],/^Greatsword: Graze:/);assert.equal(JSON.stringify(ctx.fightConditions[0].conditions),JSON.stringify(['prone','grappled']));}
assert.match(r.itemDescription('Greatsword'),/Mastery for those trained in it: Graze/);assert.match(r.itemDescription('Dagger'),/light \(one in each hand\)/);
console.log('Weapon Mastery as in the 2024 rules: every weapon\'s own property; Fighters, Barbarians, Paladins, Rangers and Rogues master their weapons (3–6, 2–4, 2 kinds); Graze, Sap, Vex, Slow, Topple and Cleave doing what they say; two-weapon fighting (a bonus action, no ability bonus, no shield; Nick as part of the action); Grapple and Shove (DC 8 + Strength + proficiency, size limits, held down while prone, letting go for a two-handed weapon, Extra Attack); people too; nothing outlasting the fight.');
