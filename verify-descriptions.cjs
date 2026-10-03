const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Nothing on screen is without an explanation: every item in every starting kit, every weapon, every found thing,
// every one-tap action in every situation and every spell has a description. Also: a carried weapon can be taken
// in hand, and what the Dungeon Master says a found thing is travels with it.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','descriptions.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,readyHeroes,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,validAdventure,adventureSnapshot,quickActions,spellActions,dmChoices,itemDescription,weaponSummary,actionDescription,actionCost,spellSummary,spellFacts,defenceText,goldDescription,draughtDescription,starterKits,instruments,weapons,equipmentFor,makeCharacter,blankBuild,gearedHero,attackOptions,readyLoadout,applyLoot,packOf,validPack,spellLibrary,knownSpells})',{AsyncStorage:{}});
const generic=new Set(['Part of your kit.','A weapon you can fight with.','Useful gear. Tell the Dungeon Master how you use it.','Do this.']);
const good=(text,what)=>{assert.equal(typeof text,'string',what);assert.ok(text.length>=20&&text.length<=420,what+': '+text);assert.ok(/[.!?”…)]$/.test(text),what+' ends as a sentence: '+text);assert.ok(!/undefined|NaN|\[object/.test(text),what+': '+text);};
// ---- Items: every kit, every weapon ----
let kitItems=0;
for(const [cls,kit] of Object.entries(r.starterKits))for(const [name] of kit.items){
 for(const item of name==='Instrument'?r.instruments:[name]){const text=r.itemDescription(item);good(text,cls+' kit: '+item);assert.ok(!generic.has(text),item+' has a description of its own');kitItems++;}
}
for(const name of ['Studded Leather Armor','Scimitar','Shortsword','Longbow','Arrow','Quiver'])assert.ok(!generic.has(r.itemDescription(name)),name);
for(const name of Object.keys(r.weapons)){const text=r.itemDescription(name,'weapon');good(text,name);assert.match(text,/\dd\d+ (slashing|piercing|bludgeoning) damage/,name);assert.match(r.weaponSummary(name),/^(Simple|Martial) (melee|ranged) weapon/);}
assert.match(r.itemDescription('Longbow'),/Martial ranged weapon: 1d8 piercing damage; heavy, two-handed, range 150\/600 ft\./);assert.match(r.itemDescription('Dagger'),/finesse/);
assert.match(r.itemDescription('Chain Mail'),/armor class 16/);assert.match(r.itemDescription('Shield'),/\+2/);good(r.goldDescription,'gold');good(r.draughtDescription,'draught');assert.match(r.draughtDescription,/2d4 \+ 2/);
// Found things: what the Dungeon Master said of them, else a line for their kind.
assert.equal(r.itemDescription('Brass crow token','quest','A token stamped with a crow: the smugglers\' pass.'),'A token stamped with a crow: the smugglers\' pass.');
for(const kind of ['treasure','gear','quest','ammunition'])good(r.itemDescription('Something odd',kind),kind);
assert.equal(r.itemDescription('Longsword','weapon','A fine blade.').includes('1d8 slashing'),true,'A known weapon always shows its numbers');
// The note is kept with the item, in the save.
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
let camp={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),stage:'inn'};delete camp.openingAttackAvailable;
const looted=r.applyLoot(camp,kara,{gold:10,items:[{name:'Brass crow token',kind:'quest',qty:1,value:0,note:'  A token stamped with a crow: the smugglers\' pass.  '},{name:'Silver ring',kind:'treasure',qty:1,value:25,note:''},{name:'Longsword',kind:'weapon',qty:1,value:0,note:'Notched but true.'}],reason:'Searched the cart.'});
assert.equal(looted.error,undefined);assert.equal(looted.game.pack.items[0].note,'A token stamped with a crow: the smugglers\' pass.');assert.equal(looted.game.pack.items[1].note,undefined);assert.ok(r.validPack(looted.game.pack));
assert.ok(r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(looted.game)),hp,true),kara));
assert.ok(!r.validPack({...looted.game.pack,items:[{...looted.game.pack.items[0],note:'x'.repeat(200)}]}));
// ---- A weapon taken in hand leads the attacks ----
const armed=looted.game;
assert.equal(r.attackOptions(r.gearedHero(kara,armed))[0].name,'Greatsword','Left alone, the best weapon leads');
const chosen={...armed,wield:'Longsword'};
assert.equal(r.attackOptions(r.gearedHero(kara,chosen))[0].name,'Longsword');assert.equal(r.readyLoadout(r.gearedHero(kara,chosen)).mainWeapon,'Longsword');
assert.equal(r.quickActions(kara,{...chosen,stage:'combat',enemyHP:8},hp).find(a=>a.weapon)?.weapon,'Longsword','The first attack chip is the weapon in hand');
assert.ok(r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(chosen)),hp,true),kara));
assert.equal(r.attackOptions(r.gearedHero(kara,{...armed,wield:'Halberd'}))[0].name,'Greatsword','A weapon you do not carry changes nothing');
assert.ok(!r.validAdventure(r.adventureSnapshot(kara,{...JSON.parse(JSON.stringify(armed)),wield:'<script>'},hp,true),kara));
const swing=r.adventureStep({...chosen,stage:'combat',enemyHP:8,potions:0,resources:{wind:2}},hp,kara,'attack:Longsword',()=>0.7);assert.equal(swing.error,undefined);assert.ok(swing.events.some(t=>/Longsword/.test(t)));
// ---- Actions: every chip, for every ready-made hero, in every situation ----
let chips=0;const seen=new Set();
for(const {key} of r.readyHeroes){
 const hero=r.readyHero(key),full={current:9,temp:0},hurt={current:3,temp:0};
 const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),campGame={...fight,stage:'inn'};delete campGame.openingAttackAvailable;
 const situations=[[fight,hurt],[{...fight,actionUsed:true},hurt],[campGame,hurt],[campGame,full],[{...campGame,stage:'bridge'},full],[{...fight,stage:'dying',dying:{successes:0,failures:0,place:'bridge',placeName:'the road'}},{current:0,temp:0}]];
 for(const [game,health] of situations){
  for(const a of [...r.quickActions(hero,game,health),{key:'level-up',label:'Level up'}]){
   const text=r.actionDescription(a,hero,game);good(text,key+' '+a.key);assert.ok(!generic.has(text),a.key+' is explained');chips++;seen.add(a.key.replace(/:.*$/,''));
   const cost=r.actionCost(a,game);assert.ok(cost===null||cost==='Action'||cost==='Bonus action');
  }
  for(const a of r.spellActions(hero,game)){good(r.actionDescription(a,hero,game),key+' '+a.key);chips++;}
 }
}
for(const kind of ['attack','dodge','flee','potion','end-turn','short-rest','long-rest','travel-inn','death-save','cast','class'])assert.ok(seen.has(kind)||[...seen].some(k=>k.startsWith(kind.split('-')[0])),'Seen a '+kind+' chip');
const fighter=r.readyHero('fighter'),fray=r.hostileEncounterGame(fighter,r.newAdventure(fighter),()=>0);
assert.match(r.actionDescription({key:'attack:Greatsword'},fighter,fray),/Roll a d20 \+ 5 against the target’s armor class; a hit deals 2d6 \+ 3 slashing damage\. Uses your action\./);
assert.equal(r.actionCost({key:'potion'},fray),'Bonus action');assert.equal(r.actionCost({key:'attack:Greatsword'},fray),'Action');assert.equal(r.actionCost({key:'dodge'},{...fray,stage:'inn'}),null,'No cost outside a fight');
assert.match(r.actionDescription({key:'class:wind'},fighter,fray),/1d10 \+ 1 hit points/);assert.match(r.actionDescription({key:'short-rest'},fighter,fray),/2 short rests between long rests/);
assert.match(r.actionDescription({key:'travel-bridge',destination:'bridge'},fighter,{...fray,stage:'inn'}),/^Walk to Overgrown Roadside: .* on foot\.$/);
// ---- Spells: all of them ----
for(const spell of r.spellLibrary){const text=r.spellSummary(spell);assert.ok(text.length>=20&&text.length<=232,spell.name+': '+text.length);assert.ok(!/[*_]/.test(text),spell.name);const facts=r.spellFacts(spell);assert.match(facts,/^(Cantrip|Level \d) · /,spell.name);assert.ok(facts.split(' · ').length>=4,spell.name+': '+facts);}
assert.equal(r.spellFacts(r.spellLibrary.find(s=>s.id==='fire-bolt')),'Cantrip · Action · 120 feet · Instantaneous');
assert.match(r.defenceText(fighter),/^Chain Mail: 16 from Chain Mail$/);
console.log('Passed: '+kitItems+' kit items, '+Object.keys(r.weapons).length+' weapons, found things (with the Dungeon Master\'s own note), '+chips+' action chips across every ready-made hero and situation and all '+r.spellLibrary.length+' spells are described; a carried weapon can be taken in hand and leads the attacks.');
