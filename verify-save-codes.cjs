const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Loads the save rules the way the other checks do, plus the story modules and the save-code module.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','characterStorage.js','playbackRules.js','sceneTriggers.js','hostileEncounter.js','saveCodes.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({exportSave,readSave,applySave,hostileEncounterGame,newAdventure,adventureSnapshot,equipmentFor})',{AsyncStorage:{},TextEncoder,TextDecoder,Blob,Response,CompressionStream,DecompressionStream,btoa,atob});
const b64=text=>Buffer.from(text,'utf8').toString('base64');
const storage=(seed={})=>{const data={...seed};return {data,getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{delete data[k];}};};
const hero={name:'Code Carrier',race:'Human',species:'Human',class:'Fighter',level:1,background:'Soldier',scores:{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[]};hero.equipment=r.equipmentFor(hero);
const game=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>.1);
const saved={'questbound.character.v1':JSON.stringify(hero),'questbound.adventure.v1':JSON.stringify(r.adventureSnapshot(hero,game,{current:7,temp:0},true))};
(async()=>{
 // A compressed code round-trips the exact save into an empty browser.
 const code=await r.exportSave(storage(saved));assert.match(code,/^QB2\./);
 assert.ok(code.length<saved['questbound.adventure.v1'].length,'Compression keeps codes short ('+code.length+' characters)');
 const read=await r.readSave(code.replace(/(.{60})/g,'$1\n  '));assert.equal(read.hero.name,'Code Carrier','Line breaks from chat apps are ignored');
 const target=storage({'questbound.adventure.v1':'old adventure'});r.applySave(read,target);
 assert.equal(target.data['questbound.character.v1'],saved['questbound.character.v1']);assert.equal(target.data['questbound.adventure.v1'],saved['questbound.adventure.v1']);
 // Browsers without compression make plain codes, which also load; a hero with no adventure clears the old one.
 const plain=await r.exportSave(storage({'questbound.character.v1':saved['questbound.character.v1']}),false);assert.match(plain,/^QB1\./);
 const heroOnly=await r.readSave(plain);assert.equal(heroOnly.adventure,null);r.applySave(heroOnly,target);assert.equal(target.data['questbound.adventure.v1'],undefined);
 // Nothing broken, foreign or tampered is ever loaded.
 await assert.rejects(r.exportSave(storage()),/no saved hero/);
 await assert.rejects(r.readSave('hello'),/not a Questbound save code/);
 await assert.rejects(r.readSave(code.slice(0,-12)),/damaged/);
 await assert.rejects(r.readSave('QB1.'+b64(JSON.stringify({character:JSON.stringify({...hero,level:99}),adventure:null}))),/hero in that code/);
 const other={...hero,name:'Someone Else'};
 await assert.rejects(r.readSave('QB1.'+b64(JSON.stringify({character:JSON.stringify(other),adventure:saved['questbound.adventure.v1']}))),/adventure in that code/);
 const tampered=JSON.parse(saved['questbound.adventure.v1']);tampered.health.current=999;
 await assert.rejects(r.readSave('QB1.'+b64(JSON.stringify({character:saved['questbound.character.v1'],adventure:JSON.stringify(tampered)}))),/adventure in that code/);
 console.log('Passed: save codes (compressed and plain) round-trip a hero and adventure, survive line breaks, stay short, and reject broken, foreign or tampered saves.');
})().catch(e=>{console.error(e);process.exitCode=1;});
