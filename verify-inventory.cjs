const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Gold and the pack: loot found, rewards paid, purchases and gifts; arrows used up; found weapons fought with at once;
// healing draughts drunk away from a fight or given to someone (bringing round a companion lying senseless).
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmCommand,dmContext,dmChoices,validAdventure,adventureSnapshot,applyLoot,packOf,arrowsLeft,gearedHero,attackOptions,quickActions})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),pip=r.readyHero('rogue'),hp={current:12,temp:0};
const valid=(hero,g,h=null)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const camp=hero=>{const g={...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stage:'inn'};delete g.openingAttackAvailable;return g;};
let g=camp(kara);
assert.equal(r.packOf(g,kara).gold,kara.equipment.totalGold,'You start with your kit\'s gold');assert.equal(r.gearedHero(kara,g),kara);
// ---- Loot: gold and items in, purchases and gifts out ----
let l=r.applyLoot(g,kara,{gold:25,items:[{name:'longsword',kind:'gear',qty:1,value:0},{name:'Silver locket',kind:'treasure',qty:1,value:15},{name:'healing potion',kind:'gear',qty:2,value:0}]});
assert.equal(l.error,undefined);assert.equal(l.game.pack.gold,kara.equipment.totalGold+25);assert.equal(l.game.potions,3,'Healing potions become draughts');
same(l.game.pack.items.map(i=>[i.name,i.kind,i.qty]),[['Longsword','weapon',1],['Silver locket','treasure',1]],'A known weapon is a weapon, whatever the DM called it');
assert.ok(l.lines.includes('You gain 25 gold (now '+(kara.equipment.totalGold+25)+').'));assert.ok(valid(kara,l.game));
g=l.game;
assert.match(r.applyLoot(g,kara,{gold:-1000,items:[]}).error,/enough gold/);assert.match(r.applyLoot(g,kara,{gold:9999,items:[]}).error,/not plausible/);
assert.match(r.applyLoot(g,kara,{gold:0,items:[{name:'Crown of Ages',kind:'quest',qty:-1}]}).error,/do not have/);assert.match(r.applyLoot(g,kara,{gold:0,items:[{name:'Laser',kind:'weapon',qty:1}]}).error,/not described clearly|Only weapons/);
const sold=r.applyLoot(g,kara,{gold:7,items:[{name:'Silver locket',kind:'treasure',qty:-1}]});assert.equal(sold.game.pack.items.length,1,'A sold item leaves the pack');
// A found weapon can be fought with straight away.
assert.ok(r.attackOptions(r.gearedHero(kara,g)).some(w=>w.name==='Longsword'));
const fight={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),pack:g.pack,openingAttackAvailable:false};
same(r.dmCommand(kara,fight,'I attack it with my longsword',hp).action,{type:'encounter-attack',weapon:'Longsword'});
assert.ok(r.adventureStep(fight,hp,kara,'attack:Longsword',()=>0.5).events.some(t=>t.startsWith('You use Longsword:')));
// ---- Arrows run out ----
let rogueFight={...r.hostileEncounterGame(pip,r.newAdventure(pip),()=>0),openingAttackAvailable:false},rh={current:10,temp:0};
const start=r.arrowsLeft(rogueFight,pip);assert.equal(start,20);
const shot=r.adventureStep(rogueFight,rh,pip,'attack:Shortbow',()=>0.5);assert.equal(r.arrowsLeft(shot.game,pip),19);assert.ok(valid(pip,shot.game,shot.health));
const empty={...rogueFight,pack:{gold:8,items:[],spent:{Arrow:20}}};
assert.ok(!r.attackOptions(r.gearedHero(pip,empty)).some(w=>w.name==='Shortbow'),'No arrows, no bow');assert.ok(!r.dmChoices(pip,empty).some(c=>c.id==='attack:Shortbow'));
const restocked=r.applyLoot(empty,pip,{gold:-1,items:[{name:'arrows',kind:'gear',qty:20,value:0}]});assert.equal(restocked.error,undefined);assert.equal(r.arrowsLeft(restocked.game,pip),20);
assert.ok(r.attackOptions(r.gearedHero(pip,restocked.game)).some(w=>w.name==='Shortbow'));
// ---- Healing draughts ----
const hurt={current:4,temp:0};let drink=r.adventureStep(camp(kara),hurt,kara,'potion',()=>0.5);
assert.equal(drink.error,undefined);assert.equal(drink.health.current,12);assert.equal(drink.game.potions,0);
assert.match(r.adventureStep(camp(kara),{current:12,temp:0},kara,'potion',()=>0.5).error,/full health/);
assert.match(r.adventureStep(drink.game,hurt,kara,'potion',()=>0.5).error,/no healing draughts/);
same(r.dmCommand(kara,camp(kara),'I drink a potion',hurt).action,'potion');
// Giving one to a companion lying senseless brings him round, and he owes you his life.
const knocked={...camp(kara),npcHP:{mara:0},npcFate:{mara:'unconscious'}};
const chips=r.quickActions(kara,knocked);assert.ok(chips.some(a=>a.label==='Revive Tobin'),'A Revive chip for someone down');
same(r.dmCommand(kara,knocked,'I give Tobin a potion',hp).action,{type:'give-potion',target:'mara'});
const revived=r.adventureStep(knocked,hp,kara,{type:'give-potion',target:'mara'},()=>0.5);
assert.equal(revived.error,undefined);assert.equal(revived.game.npcHP.mara,8);assert.equal(revived.game.npcFate,undefined);assert.equal(revived.game.potions,0);
assert.ok(revived.events.some(t=>t.startsWith('You give Tobin Reed a healing draught')));assert.equal(revived.game.npcMemory.mara.bond,'The player saved my life when I lay dying.');assert.ok(valid(kara,revived.game));
assert.match(r.adventureStep(camp(kara),hp,kara,{type:'give-potion',target:'mara'},()=>0.5).error,/not hurt/);
// ---- Through the Dungeon Master ----
const bought=r.commitDmTurn(kara,camp(kara),hp,null,{question:'I buy two healing potions from the captain.',narration:'She counts out two vials.',loot:{gold:-50,items:[{name:'Potion of Healing',kind:'potion',qty:2,value:0}],reason:'Bought from the captain.'}});
assert.equal(bought.error,undefined);assert.equal(bought.game.potions,3);assert.equal(r.packOf(bought.game,kara).gold,kara.equipment.totalGold-50);
assert.match(r.commitDmTurn(kara,camp(kara),hp,null,{question:'I buy a greatsword.',narration:'x',loot:{gold:-500,items:[],reason:'x'}}).error,/enough gold/);
const inv=r.dmContext(kara,g,hp).inventory;assert.equal(inv.gold,g.pack.gold);assert.equal(inv.healingDraughts,3);assert.equal(inv.priceList['Potion of Healing'],50);
// ---- Saves and level-ups keep the pack ----
assert.ok(!valid(kara,{...g,pack:{...g.pack,gold:-5}}));assert.ok(!valid(kara,{...g,potions:21}));assert.ok(!valid(kara,{...g,pack:{...g.pack,items:[{name:'Laser',kind:'weapon',qty:1}]}}));
const next=r.newAdventure(kara,g);same(next.pack,g.pack);assert.equal(next.potions,3);
console.log('Passed: starting gold, loot in and out (gold checked, weapons and potions recognised), selling, found weapons fought with, arrows spent and restocked, draughts drunk and given (reviving a companion who then owes you), DM trades, and packs kept through saves and level-ups.');
