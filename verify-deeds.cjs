const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Deeds (deedRules.js): lasting marks of what a hero has done, worked out from the story so far and the game, written
// down once, validated with the save, carried into the next tale, and shown with an icon the game has.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,validAdventure,adventureSnapshot,carriedBase,withStoryLog,appendStoryLog,deedList,deedById,earnedDeeds,withDeeds,validEarnedDeeds,iconPaths})',{AsyncStorage:{}});
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const plain=v=>JSON.parse(JSON.stringify(v)),sorted=v=>[...v].sort();
const valid=(g,h=hp,hero=kara)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
// The catalogue: unique ids, titles and lines, and an icon the game can draw.
assert.ok(r.deedList.length>=20);assert.equal(new Set(r.deedList.map(d=>d.id)).size,r.deedList.length);
for(const d of r.deedList){assert.ok(/^[a-z-]+$/.test(d.id)&&d.title.length>2&&d.line.length>8,d.id);assert.ok(r.iconPaths[d.icon],d.id+' has the icon '+d.icon);}
// A fresh tale earns nothing; the first victory is First Blood, written down once with the log line it came at.
let g=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0);
assert.deepEqual(plain(r.earnedDeeds(g,kara)),[]);assert.equal(r.withDeeds(g,kara).game,g,'nothing earned, nothing changed');
let won={...g,stage:'inn',enemyHP:0,storyLog:r.appendStoryLog(g.storyLog,'victory','Slew the Caravan Raider.')};
const first=r.withDeeds(won,kara);assert.deepEqual(plain(first.fresh),['first-blood']);assert.deepEqual(plain(first.game.deeds),[{id:'first-blood',at:won.storyLog.at(-1).id,tale:g.story.title}]);
assert.equal(r.withDeeds(first.game,kara).game,first.game,'earned once');assert.ok(valid(first.game));
// Five victories make a Slayer; a spared foe, Merciful; three places found, a Pathfinder; five places visited, a Wanderer.
let log=won.storyLog;for(let i=0;i<4;i++)log=r.appendStoryLog(log,'victory','Slew a wolf.');log=r.appendStoryLog(log,'victory','Beat the warden and spared it.');
for(let i=0;i<3;i++)log=r.appendStoryLog(log,'place','Found a place '+i+'.');
let many=r.withDeeds({...first.game,storyLog:log},kara);
assert.deepEqual(sorted(many.fresh),['merciful','pathfinder','slayer']);assert.ok(valid(many.game));
assert.ok(r.withDeeds({...g,map:{...g.map,visited:['inn','bridge','tower','p1','p2']}},kara).fresh.includes('wanderer'));
// People: won over three times, a debt for life, a grudge, a companion; gold and goods; rests; chapters and the end of the tale.
log=many.game.storyLog;for(const text of ['You won Ada over.','You won Bran over.','You won Cole over.','Ada owes you a debt for life.','Dorn swore never to forgive you.'])log=r.appendStoryLog(log,'deed',text);
log=r.appendStoryLog(log,'person','Bran joined you.');for(let i=0;i<3;i++)log=r.appendStoryLog(log,'rest','Took a long rest at the inn.');
log=r.appendStoryLog(log,'quest','Finished chapter 1: The Road.');log=r.appendStoryLog(log,'quest','Adventure complete: The Tale.');
const rich=r.withDeeds({...many.game,storyLog:log,pack:{gold:120,items:Array.from({length:8},(_,i)=>({name:'Thing '+i,kind:'gear',qty:1,value:1})),spent:{}}},kara);
assert.deepEqual(sorted(rich.fresh),sorted(['silver-tongue','sworn-friend','marked','good-company','full-purse','pack-rat','well-rested','page-turner','storyteller']));
// Levels: Veteran at 3, Champion at 5, Legend at 10.
const seasoned={...kara,level:5};assert.deepEqual(sorted(r.withDeeds({...g,encounterLevel:5,enemyHP:10},seasoned).fresh),['champion','veteran']);
assert.ok(r.withDeeds({...g,encounterLevel:10,enemyHP:10},{...kara,level:10}).fresh.includes('legend'));
// Survival and flight.
assert.deepEqual(plain(r.withDeeds({...g,storyLog:r.appendStoryLog(g.storyLog,'fall','Clung to life and woke at the inn.')},kara).fresh),['survivor']);
let fled=g.storyLog;for(let i=0;i<2;i++)fled=r.appendStoryLog(fled,'flight','Fled from the wolf.');assert.deepEqual(plain(r.withDeeds({...g,storyLog:fled},kara).fresh),['quick-feet']);
// The save refuses deeds that do not exist, repeats, or odd records; the next tale keeps what was earned.
assert.ok(r.validEarnedDeeds(undefined)&&r.validEarnedDeeds([])&&r.validEarnedDeeds([{id:'veteran',at:0,tale:null}]));
for(const bad of [[{id:'nope',at:1}],[{id:'veteran',at:1},{id:'veteran',at:2}],[{id:'veteran',at:-1}],[{id:'veteran',at:1,tale:'x'.repeat(121)}],'veteran',[null]])assert.equal(r.validEarnedDeeds(bad),false,JSON.stringify(bad));
assert.equal(valid({...first.game,deeds:[{id:'nope',at:1}]}),false);
assert.equal(r.newAdventure(kara,rich.game).deeds,rich.game.deeds);assert.equal(r.carriedBase(rich.game).deeds,rich.game.deeds);assert.equal(r.newAdventure(kara,g).deeds,undefined);
// A turn through the engine keeps the deeds beside the log (the play screen calls withDeeds after withStoryLog).
const step=r.adventureStep({...first.game,stage:'inn'},hp,kara,{type:'travel',destination:'bridge'},()=>0.5);assert.equal(step.error,undefined,step.error);
assert.equal(r.withDeeds(r.withStoryLog(first.game,step.game,kara,{action:{type:'travel'}}),kara).game.deeds,first.game.deeds);
// The screens: written down after every turn and on a level taken, announced with the deed cue, shown in the Quest tab and the share card.
const play=fs.readFileSync('Adventure.js','utf8'),app=fs.readFileSync('App.js','utf8'),layer=fs.readFileSync('CinematicLayer.js','utf8');
assert.ok(play.includes('const marked=withDeeds(result.game,hero);result.game=partyVictory(from.game,marked.game);')&&play.includes("cue('deed',{deed:deedById(id)})")&&play.includes('{deedsPanel}')&&play.includes('withDeeds(withStoryLog(game,next,hero,{}),hero).game'));
assert.ok(app.includes('const marked=withDeeds(advanced,character);')&&layer.includes("event.kind==='deed'")&&layer.includes('Deed earned'));
console.log('Deeds: '+r.deedList.length+' marks earned from the story and the game, written once with their line and tale, validated, carried into the next tale, announced and shown.');
