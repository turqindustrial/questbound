// Every save any tester-reachable build ever wrote still loads, is upgraded once to the current format and plays
// (SAVES.md, saveMigrations.js). The fixtures in save-fixtures/ were made by the builds themselves (make-save-fixtures.cjs
// runs each commit's own rules from git): heroes built and ready-made (an old Dark Elf and plain Elf, a Monk on a path
// since renamed), fresh adventures, written tales a few turns in (journeys, fights won, lost and under way, heroes
// dying), skirmishes, a hero set aside in the roster, a save code and a shared table with a party. For each one: the
// save checks accept it as it was; the device's own load (loadCharacter, loadAdventure) upgrades it, keeps the
// upgrade and loads it the same way again; the upgrade means the same game (the same experience, the subclass by its
// new name, the species as written, the story so far remembered); a load cut short between its two writes still finds
// the adventure; and the upgraded save, and the save as it was, both play a turn. The campaign server upgrades an old
// table (seats and all) when it reads it and plays on.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// Objects made inside the rules' own context have its prototypes: compare them as JSON.
const same=(a,b,why)=>assert.equal(JSON.stringify(a),JSON.stringify(b),why);
const store=new Map(),AsyncStorage={getItem:async k=>store.get(k)??null,setItem:async(k,v)=>{store.set(k,v);},removeItem:async k=>{store.delete(k);}};
const r=vm.runInNewContext(rulesSource({extra:['rosterRules.js','saveCodes.js']})+'\n;({currentSaveVersion,saveFormats,upgradeCharacter,upgradeAdventure,sameHeroText,isValidCharacter,validAdventure,loadCharacter,loadAdventure,saveCharacter,heroXp,levelUpReady,withMemory,memoryOf,quickActions,settleTurn,adventureSnapshot,makeCharacter,readyHero,validRosterEntry,restoreEntry,readSave,applySave,partyView,isPartyGame,currentSubclass,heroSpecies})',{AsyncStorage,console,TextEncoder,TextDecoder,atob,btoa,Blob,Response});
const dir=path.join(__dirname,'save-fixtures'),builds=fs.readdirSync(dir).filter(f=>/^\d{4}-\d\d-\d\d-[0-9a-f]{7}\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const KEYS={character:'questbound.character.v1',adventure:'questbound.adventure.v1'};
const now=r.currentSaveVersion;
assert.ok(Number.isInteger(now)&&now>=1&&r.saveFormats.at(-1).version===now,'the formats are listed up to the current one');
assert.equal(builds[0].commit,'235726f','the oldest fixtures come from the first playtest build, the first that reached testers');
assert.ok(builds.length>=12&&builds.every(b=>b.saves.length>=5),'fixtures from every milestone build');
// A turn from a save as it stands: the first chip offered (an attack in a fight, a death save when dying...).
function playsATurn(hero,adventure,why){
 const {game,health}=adventure;let chips=r.quickActions(hero,game,health)??[];
 if(!chips.length)chips=[{action:'long-rest'}];
 let done=null;for(const chip of chips.slice(0,6)){const s=r.settleTurn({hero,game,health,action:chip.action,random:()=>.6});if(!s.error){done=s;break;}}
 assert.ok(done,why+': no move on offer plays ('+chips.map(c=>c.key).join(', ')+')');
 const next=r.adventureSnapshot(hero,done.result.game,done.result.health,true);
 assert.ok(r.validAdventure(next,hero),why+': the turn leaves a valid save');assert.equal(next.saveVersion,now,why+': saved in the current format');
}
const sameExperience=(before,after,hero)=>r.heroXp(before.game,hero)===r.heroXp(after.game,hero)&&r.levelUpReady(before.game,hero)===r.levelUpReady(after.game,hero);
let saves=0,renamed=0,kept=0,remembered=0,crossed=0;
(async()=>{
 for(const build of builds){
  for(const save of build.saves){
   const why=build.commit+' '+save.label,old=JSON.parse(save.character);saves++;
   // 1. The save checks accept it as that build wrote it.
   assert.ok(r.isValidCharacter(old),why+': the hero passes as saved');assert.ok(r.validAdventure(save.adventure,old),why+': the adventure passes as saved');
   assert.equal(save.adventure.character,save.character,why+': the fixture is one hero and their adventure');
   // 2. The device's own load upgrades it, keeps it, and loads it the same way again.
   store.clear();store.set(KEYS.character,save.character);store.set(KEYS.adventure,JSON.stringify(save.adventure));
   const hero=await r.loadCharacter(),adventure=await r.loadAdventure(hero);
   assert.ok(adventure,why+': the adventure is found for the hero');
   assert.equal(hero.saveVersion,now,why+': the hero is upgraded');assert.equal(adventure.saveVersion,now,why+': the adventure is upgraded');
   assert.equal(adventure.character,JSON.stringify(hero),why+': and they stay one hero and their adventure');
   assert.ok(r.isValidCharacter(hero)&&r.validAdventure(adventure,hero),why+': the upgrade passes the save checks');
   assert.equal(store.get(KEYS.character),JSON.stringify(hero),why+': the upgraded hero is kept');same(JSON.parse(store.get(KEYS.adventure)),adventure,why+': the upgraded adventure is kept');
   const hero2=await r.loadCharacter(),adventure2=await r.loadAdventure(hero2);
   same(hero2,hero,why+': a second load changes nothing');same(adventure2,adventure,why+': a second load changes nothing');
   assert.equal(r.upgradeAdventure(adventure),adventure,why+': a current save is left as it is');assert.equal(r.upgradeCharacter(hero),hero);
   // 3. The upgrade means the same game.
   assert.ok(sameExperience(save.adventure,adventure,old),why+': the same experience and the same level waiting');
   if(old.plannedSubclass==='Warrior of the Hidden Step'){assert.equal(hero.plannedSubclass,'Warrior of the Quiet Step',why);assert.equal(r.currentSubclass(old.plannedSubclass),hero.plannedSubclass);renamed++;}
   if(['Elf','Dark Elf'].includes(old.species)){assert.equal(hero.species,old.species,why+': the species is kept as written');assert.equal(r.heroSpecies(hero),r.heroSpecies(old));kept++;}
   const {saveVersion,plannedSubclass,...restNew}=hero,{plannedSubclass:p0,...restOld}=old;same(restNew,restOld,why+': nothing else about the hero changes');
   assert.equal(adventure.game.levelsOwed,undefined,why+': no level owed is left to read lazily (solo)');
   if(save.adventure.game.storyLog?.length){same(adventure.game.memory,r.memoryOf(save.adventure.game),why+': the story so far is remembered');remembered++;}
   for(const k of ['story','stage','enemyHP','health'])same(k==='health'?adventure.health:adventure.game[k],k==='health'?save.adventure.health:save.adventure.game[k],why+': '+k+' unchanged');
   // 4. A load cut short between its two writes (the hero kept upgraded, the adventure not yet) still finds it.
   store.set(KEYS.character,JSON.stringify(hero));store.set(KEYS.adventure,JSON.stringify(save.adventure));
   assert.ok(await r.loadAdventure(await r.loadCharacter()),why+': found again after a load cut short');crossed++;
   assert.ok(r.sameHeroText(save.character,JSON.stringify(hero))&&!r.sameHeroText(save.character,JSON.stringify({...hero,name:'Someone else'})),why+': the same hero, and only the same hero');
   // 5. Both the upgraded save and the save as it was play a turn.
   playsATurn(hero,adventure,why+' (upgraded)');playsATurn(old,save.adventure,why+' (as saved)');
  }
  // A hero set aside in the roster comes back upgraded.
  if(build.roster){for(const entry of build.roster){assert.ok(r.validRosterEntry(entry),build.commit+': the roster entry passes as saved');
   const back=r.restoreEntry(entry);assert.equal(back.hero.saveVersion,now);assert.equal(back.adventure.character,JSON.stringify(back.hero));assert.ok(r.validAdventure(back.adventure,back.hero),build.commit+': the roster hero comes back upgraded');
   assert.equal(back.game,back.adventure.game);playsATurn(back.hero,back.adventure,build.commit+' roster');}}
  // A save code made by that build opens here and loads upgraded.
  if(build.saveCode){const opened=await r.readSave(build.saveCode),mem=new Map();r.applySave(opened,{setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)});
   store.clear();for(const [k,v] of mem)store.set(k,v);const hero=await r.loadCharacter(),adventure=await r.loadAdventure(hero);
   assert.ok(adventure&&adventure.saveVersion===now&&r.validAdventure(adventure,hero),build.commit+': the save code loads upgraded');}
 }
 // 6. Shared tables: the campaign server reads an old table (here also from before seats), upgrades it and plays on.
 {const {createCampaigns}=require('./campaigns.cjs'),engine=require('./rules-engine.cjs').rules(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-saves-'));
  try{
   const c=createCampaigns({dir:tmp,ask:async()=>({narration:'The road goes on.',actionId:null}),randomImpl:()=>.5});let tables=0;
   for(const build of builds.filter(b=>b.party)){
    const A={id:'a'.repeat(64)},B={id:'b'.repeat(64)},id=build.commit.padEnd(32,'0');
    // The fixture's party seats are 'A' and 'B': as account ids, which tables from before seats used.
    const snapshot=JSON.parse(JSON.stringify(build.party).replace(/"A"/g,JSON.stringify(A.id)).replace(/"B"/g,JSON.stringify(B.id)));
    fs.writeFileSync(path.join(tmp,id+'.json'),JSON.stringify({id,owner:A.id,members:{[A.id]:{name:'Brenna',role:'owner'},[B.id]:{name:'Vey',role:'player'}},inviteHash:'x',inviteUntil:0,version:3,updatedAt:'2026-10-05T00:00:00.000Z',updatedBy:'Brenna',snapshot,receipts:[]}));
    for(const user of [A,B]){const seen=c.poll(user,{campaignId:id,knownVersion:-1}),view=seen.snapshot,hero=JSON.parse(view.character);
     assert.ok(engine.isValidCharacter(hero)&&engine.validAdventure(view,hero),build.commit+': each member sees a valid table');assert.equal(hero.saveVersion,now,build.commit+': with their hero upgraded');}
    const file=JSON.parse(fs.readFileSync(path.join(tmp,id+'.json'),'utf8'));assert.equal(file.snapshot.saveVersion,now,build.commit+': the table is kept upgraded');
    assert.ok(Object.values(file.members).every(m=>/^seat-[0-9a-f]{16}$/.test(m.seat))&&!JSON.stringify(file.snapshot).includes(A.id),build.commit+': and seated');
    assert.ok(Object.values(file.snapshot.game.party.members).every(m=>JSON.parse(m.character).saveVersion===now),build.commit+': every seated hero upgraded');
    const noted=c.edit(A,{campaignId:id,baseVersion:file.version,kind:'note',text:'We made camp by the old road.'});assert.equal(noted.version,file.version+1,build.commit+': the table plays on');
    tables++;
   }
   assert.ok(tables>=7,'tables from every build since parties');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 }
 // 7. Levels owed on the road (builds of 2 to 4 October gave one for every second chapter, before experience points):
 // the test stories of those builds have no chapters, so the shape is made from one of their saves by hand. The
 // upgrade turns them into the same experience, and the level waits as before.
 {const build=builds.find(b=>b.commit==='b1fcc0f'),save=build.saves.find(s=>s.label.endsWith('-story')&&s.adventure.game.stage==='inn');
  for(const owed of [1,2]){
   const hero=JSON.parse(save.character),old={...save.adventure,game:{...save.adventure.game,levelsOwed:owed}};
   assert.ok(r.validAdventure(old,hero),'a level owed passes as saved');assert.ok(r.levelUpReady(old.game,hero),'and is ready to take');
   store.clear();store.set(KEYS.character,save.character);store.set(KEYS.adventure,JSON.stringify(old));
   const up=await r.loadAdventure(await r.loadCharacter());
   assert.equal(up.game.levelsOwed,undefined);assert.ok(sameExperience(old,up,hero),owed+' owed: the same experience');assert.ok(r.levelUpReady(up.game,hero),'the level still waits');
  }}
 // 8. New heroes and new saves carry the current format; a later build's save is still accepted (a rollback).
 {const hero=r.readyHero('fighter');assert.equal(hero.saveVersion,now,'a new hero carries the format');
  const snap=r.adventureSnapshot(hero,{stage:'inn',enemyHP:10,potions:1,round:1,log:[]},null,false);assert.equal(snap.saveVersion,now,'a new save carries the format');
  assert.ok(r.isValidCharacter({...hero,saveVersion:now+1})&&r.validAdventure({...snap,saveVersion:now+1},hero),'a later build\'s save is accepted');
  assert.equal(r.upgradeAdventure({...snap,saveVersion:now+1}).saveVersion,now+1,'and left as it is');
  assert.ok(!r.isValidCharacter({...hero,saveVersion:'1'})&&!r.validAdventure({...snap,saveVersion:0},hero),'a malformed format is refused');}
 assert.ok(renamed>=1&&kept>=10&&remembered>=10,'the fixtures cover the renamed path, the old elves and the story log');
 console.log('Saves: '+saves+' saves from '+builds.length+' builds ('+builds[0].date+' to '+builds.at(-1).date+') load as written, upgrade once to format '+now+' and play a turn either way; '+renamed+' renamed paths, '+kept+' old elves kept as written, '+remembered+' stories remembered, '+crossed+' cut-short loads recovered; roster entries, save codes and shared tables too.');
})().catch(e=>{console.error(e);process.exitCode=1;});
