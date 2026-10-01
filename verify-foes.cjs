const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),r=require('./verify-dm-integration.cjs');
const p=vm.runInNewContext(['deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','mapRules.js','playbackRules.js','sceneTriggers.js','hostileEncounter.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n({hostileEncounterGame,hostileFoes,foeStatsFor,validStory,storyText})',{combatBasics:r.combatBasics});
const a=vm.runInNewContext(fs.readFileSync('adventureRules.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')+'\n({foeStanding})',{});
const hero={name:'Foe tester',class:'Fighter',species:'Human',level:1,scores:{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[]};hero.equipment=r.equipmentFor(hero);
const pick=key=>()=>(p.hostileFoes.findIndex(f=>f.key===key)+.5)/p.hostileFoes.length;
// Every foe has a valid, level-scaled stat block that the encounter uses.
for(const f of p.hostileFoes)for(const level of [1,2,5,10,20]){const stats=p.foeStatsFor(f,level);assert.ok(p.validStory({...p.hostileEncounterGame({...hero,level},r.newAdventure({...hero,level}),pick(f.key)).story,foeStats:stats}),f.key+' L'+level);}
assert.ok(p.foeStatsFor(p.hostileFoes[0],5).maximum>p.foeStatsFor(p.hostileFoes[0],1).maximum,'Foes scale with level');
const bandit=p.hostileEncounterGame(hero,r.newAdventure(hero),pick('bandit'));
assert.equal(bandit.enemyHP,16);assert.equal(r.encounterFoe(hero,bandit).ac,12);assert.equal(r.encounterFoe(hero,bandit).attackBonus,3);assert.equal(r.encounterFoe(hero,bandit).type,'Slashing');
assert.ok(r.validAdventure(r.adventureSnapshot(hero,bandit,null,true),hero));
// Groups: one HP pool, members fall as damage accumulates, and each standing member attacks.
const goblins=p.hostileEncounterGame(hero,r.newAdventure(hero),pick('goblin')),foe=r.encounterFoe(hero,goblins);
assert.equal(foe.group.size,3);assert.equal(goblins.enemyHP,21);assert.equal(a.foeStanding(foe,21),3);assert.equal(a.foeStanding(foe,14),2);assert.equal(a.foeStanding(foe,8),2);assert.equal(a.foeStanding(foe,7),1);assert.equal(a.foeStanding(foe,0),0);
assert.match(goblins.story.opening,/^Three Goblin raiders burst/);
const turn=r.adventureStep({...goblins,openingAttackAvailable:false,enemyHP:14},{current:12,temp:0},hero,'dodge',()=>0.5);
assert.equal(turn.events.filter(t=>/^Goblin Raider \d: d20/.test(t)).length,2,'Two standing goblins attack');
const hit=r.adventureStep({...goblins,openingAttackAvailable:false,enemyHP:21},{current:12,temp:0},hero,'attack:Greatsword',()=>0.9);
assert.ok(hit.events.some(t=>/goblin raiders? (falls|fall) dead — \d still standing/.test(t)),'A fall is announced');
assert.ok(r.validAdventure(r.adventureSnapshot(hero,hit.game,hit.health,true),hero));
// Story text keeps foe names intact (the legacy renamer only replaces whole words).
const orc=p.hostileEncounterGame(hero,r.newAdventure(hero),pick('orc'));
assert.equal(p.storyText(orc,'The Orc Marauder swings. Mara looks on.'),'The Orc Marauder swings. Tobin Reed looks on.');
// Invalid stat blocks are rejected.
assert.equal(p.validStory({...bandit.story,foeStats:{...bandit.story.foeStats,die:7}}),false);
assert.equal(p.validStory({...goblins.story,foeStats:{...goblins.story.foeStats,maximum:20}}),false);
console.log('Passed: 9 foe stat blocks at levels 1–20, encounter stats, group HP pools and per-member attacks, fall announcements, save validity and whole-word story renaming.');
