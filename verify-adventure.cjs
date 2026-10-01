const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+['spellOptions.js','campaignRules.js','mapRules.js','journalRules.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','classActions.js','spellRules.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','adventureRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({newAdventure,adventureStep,equipmentFor,classes})');
const hero={species:'Goliath',class:'Artificer',level:1,background:'Wayfarer',scores:{Strength:15,Dexterity:16,Constitution:13,Intelligence:12,Wisdom:11,Charisma:8}};hero.equipment=r.equipmentFor(hero);
let game=r.newAdventure(),health=null;
function step(action,rand=()=>0.5){const result=r.adventureStep(game,health,hero,action,rand);game=result.game;health=result.health;}
step('study');assert.equal(game.stage,'bridge');assert.equal(health.temp,3);
step('approach');assert.equal(game.stage,'combat');
step('attack:Dagger',()=>0.99);assert.equal(game.stage,'victory');assert.equal(health.current,9);assert.equal(game.enemyHP,0);
const done=game;step('attack:Dagger');assert.equal(game,done);
game={...r.newAdventure(),stage:'combat',map:undefined};health={current:2,temp:0};let dice=[0,0,0];step('potion',()=>dice.shift());assert.equal(health.current,6);assert.equal(game.potions,0);
const noPotion=game;step('potion');assert.equal(game,noPotion);
step('flee');assert.equal(game.stage,'escaped');
game={...r.newAdventure(),stage:'combat',map:undefined};health={current:1,temp:0};dice=[0,0.99,0.99,0.99];step('attack:Dagger',()=>dice.shift());assert.equal(game.stage,'dying');assert.equal(health.current,0);
game={...r.newAdventure(),stage:'combat',map:undefined};health={current:9,temp:0};dice=[0.99,0];step('dodge',()=>dice.shift());assert.equal(health.current,9);assert.equal(game.round,2);
for(const className of r.classes){const h={...hero,class:className};h.equipment=r.equipmentFor(h);const next=r.adventureStep(r.newAdventure(),null,h,'listen');assert.equal(next.game.stage,'bridge',className);}
console.log('Passed: quest choices, all classes enter, victory stops retaliation, loss, retreat, potion consumption, dodge, and terminal state guards.');
