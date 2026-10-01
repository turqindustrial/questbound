const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let raw=null, fail=false;
const storage={getItem:async()=>raw,setItem:async(key,value)=>{if(fail)throw Error('Disk unavailable');raw=value;}};
const source=['campaignRules.js','mapRules.js','journalRules.js','equipmentRules.js','characterRules.js','combatRules.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','skillRules.js','storyRules.js','followerRules.js','hostileEncounter.js','encounterRules.js','adventureStorage.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const open=()=>vm.runInNewContext(source+'\n({loadAdventure,saveAdventure,adventureSnapshot,validAdventure})',{AsyncStorage:storage});
const hero={name:'Test',class:'Artificer',level:1,scores:{Strength:15,Dexterity:16,Constitution:13,Intelligence:12,Wisdom:11,Charisma:8}};
const game={stage:'combat',map:undefined,enemyHP:5,potions:0,round:4,log:['Test turn']};
(async()=>{
 const r=open();assert.equal(await r.loadAdventure(hero),null);
 const value=r.adventureSnapshot(hero,game,{current:4,temp:2},true);
 await r.saveAdventure(value,hero);
 const restored=await open().loadAdventure(hero);assert.equal(restored.health.current,4);assert.equal(restored.health.temp,2);assert.equal(restored.game.potions,0);assert.equal(restored.game.enemyHP,5);assert.equal(restored.game.round,4);assert.equal(restored.chosen,true);
 assert.equal(await r.loadAdventure({...hero,name:'Other'}),null);
 const before=raw;fail=true;await assert.rejects(r.saveAdventure({...value,health:{current:1,temp:0}},hero));assert.equal(raw,before);
 fail=false;await Promise.all([r.saveAdventure({...value,health:{current:3,temp:0}},hero),r.saveAdventure({...value,health:{current:2,temp:0}},hero)]);assert.equal((await r.loadAdventure(hero)).health.current,2);
 raw=JSON.stringify({...value,health:{current:100,temp:0}});await assert.rejects(r.loadAdventure(hero));
 raw='{broken';await assert.rejects(r.loadAdventure(hero));
 console.log('Passed: fresh saves, full restore, character isolation, failure preserves save, ordered writes/retry and corrupt data protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
