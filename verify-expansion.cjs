const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const catalog=JSON.parse(fs.readFileSync('spellCatalog.json','utf8'));
const source='const catalog='+JSON.stringify(catalog)+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+['subclassOptions.js','spellOptions.js','campaignRules.js','mapRules.js','journalRules.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','npcRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({spellDefense,subclassOptions,validPlannedSubclass,classes,combatBasics,weaponAttacks,attacksPerAction,rollAttack,equipmentFor,newAdventure,requestSpell,resolveSpellRuling,adventureStep,castError,spellSlots,slotUsed,spellCostOptions,spellMode,automaticSpells,concentrationAfterDamage,validAdventure,adventureSnapshot,spellSelectionError,makeCharacter,blankBuild})');
const scores={Strength:16,Dexterity:16,Constitution:14,Intelligence:18,Wisdom:16,Charisma:18};
const hero=(name,level=1,spells=[])=>{const h={name:'QA',class:name,race:'Human',species:'Human',level,scores,spells};h.equipment=r.equipmentFor(h);return h;};
for(const name of r.classes){
 assert.equal(Object.keys(r.subclassOptions[name]).length,4,name+' must have exactly four choices');
 for(const [sub,description] of Object.entries(r.subclassOptions[name])){assert.ok(description.length>35);assert.equal(r.validPlannedSubclass({class:name,plannedSubclass:sub}),true);}
 for(let level=1;level<=20;level++){const h=hero(name,level),stats=r.combatBasics(h);assert.ok(stats.available);assert.equal(stats.proficiency,2+Math.floor((level-1)/4));assert.ok(stats.hp>0);if(level>1)assert.ok(stats.hp>r.combatBasics(hero(name,level-1)).hp);assert.equal(r.validAdventure(r.adventureSnapshot(h,r.newAdventure(h),null,true),h),true);}
}
assert.equal(r.validPlannedSubclass({class:'Artificer',plannedSubclass:'Cartographer'}),true);
assert.equal(r.validPlannedSubclass({class:'Wizard',plannedSubclass:'Armorer'}),false);
assert.equal(r.combatBasics(hero('Wizard',21)).available,false);
const champion={...hero('Fighter',3),plannedSubclass:'Champion'};
assert.equal(r.weaponAttacks(champion)[0].criticalThreshold,19);
assert.equal(r.weaponAttacks({...champion,level:2})[0].criticalThreshold,20);
assert.equal(r.weaponAttacks({...champion,level:15})[0].criticalThreshold,18);
assert.equal(r.attacksPerAction(hero('Fighter',20)),4);
assert.equal(r.attacksPerAction(hero('Fighter',4)),1);
assert.equal(r.attacksPerAction({...hero('Artificer',5),plannedSubclass:'Alchemist'}),1);
assert.equal(r.attacksPerAction({...hero('Artificer',5),plannedSubclass:'Battle Smith'}),2);
const dragon={...hero('Sorcerer',3),plannedSubclass:'Draconic Sorcery'};
assert.equal(r.combatBasics(dragon).hp-r.combatBasics({...dragon,plannedSubclass:''}).hp,3);
assert.equal(r.combatBasics(dragon).ac,17);
assert.ok(r.automaticSpells({...hero('Cleric',3),plannedSubclass:'Life Domain'}).includes('aid'));
assert.equal(r.automaticSpells({...hero('Cleric',2),plannedSubclass:'Life Domain'}).includes('aid'),false);

const report=[];
for(const spell of catalog){
 const name=spell.classes.find(c=>c!=='Artificer' && c!=='Warlock')??spell.classes[0];
 const h=hero(name,20,[spell.id]);if(name==='Warlock'&&spell.level>=6)h.arcanum={[spell.level]:spell.id};
 const game={...r.newAdventure(h),stage:'combat',map:undefined},maximum=r.combatBasics(h).hp,hp={current:1,temp:0};
 const cost=r.spellCostOptions(h,game,spell).find(x=>x!=='ritual');assert.notEqual(cost,undefined,spell.name+' must have a casting route');
 const request={id:spell.id,slot:cost,intent:'DM verifies a legal target and completed casting requirements.',componentsConfirmed:true};
 const original=JSON.stringify({game,hp});
 let result=r.requestSpell(h,game,hp,maximum,request,()=>0.5);
 assert.equal(result.error,undefined,spell.name);assert.equal(JSON.stringify({game,hp}),original,spell.name+' must not mutate input');
 if(r.spellMode(spell.id)==='dm'){
   assert.equal(result.waiting,true,spell.name);assert.equal(r.slotUsed(result.game,typeof cost==='number'?cost:1),0);
   assert.equal(r.validAdventure(r.adventureSnapshot(h,result.game,hp,true),h),true,spell.name+' pending save');
   const reloaded=JSON.parse(JSON.stringify(result.game));
   assert.ok(r.resolveSpellRuling(h,reloaded,hp,maximum,{note:'',damage:0,healing:0,temporaryHP:0}).error);
   result=r.resolveSpellRuling(h,reloaded,hp,maximum,{note:'DM resolved the effect; no direct damage or healing in this scenario.',damage:0,healing:0,temporaryHP:0});
   assert.equal(result.error,undefined,spell.name);assert.equal(result.game.pendingSpell,undefined);
 } else {assert.equal(result.waiting,undefined);assert.ok(Number.isFinite(result.damage));assert.ok(result.health.current<=maximum);}
 if(typeof cost==='number'&&cost>0)assert.equal(r.slotUsed(result.game,cost),1,spell.name+' correct slot');
 if(cost==='arcanum')assert.ok(result.game.arcanumUsed.includes(spell.level));
 assert.equal(r.validAdventure(r.adventureSnapshot(h,result.game,result.health,true),h),true,spell.name+' resolved save');
 report.push({id:spell.id,name:spell.name,level:spell.level,mode:r.spellMode(spell.id),castingRoute:'passed',effectsVerified:r.spellMode(spell.id)==='automatic'?'supported single-encounter effect only':'DM adjudication; spell-specific mechanics not automated'});
}
// Independent expected outcomes at scaling and resource boundaries.
const h=hero('Wizard',17,['shock','missile','false-life']),g={...r.newAdventure(h),stage:'combat',map:undefined},hp={current:20,temp:0};
const cast=(id,slot,rand=()=>0.99,patch={})=>r.requestSpell(h,{...g,...patch},hp,100,{id,slot,intent:'Use the stated default target.',componentsConfirmed:true},rand);
assert.equal(cast('shock',0).damage,64); // Critical: eight d8 at level 17.
assert.equal(cast('missile',9).damage,55); // Eleven darts, five each.
assert.equal(cast('false-life',9,()=>0).health.temp,46);
assert.ok(cast('missile',1,()=>0,{slotSpentThisTurn:true}).error);
assert.equal(cast('shock',0,()=>0,{slotSpentThisTurn:true}).error,undefined);
assert.ok(cast('missile',1,()=>0,{spellSlotsUsed:[4,0,0,0,0,0,0,0,0]}).error);
assert.equal(r.castError(h,g,{id:'wish',slot:9,intent:'Wish.',componentsConfirmed:true}),'That spell is not prepared or granted to this character.');
const life={...hero('Cleric',3,['cure']),plannedSubclass:'Life Domain'};
const healed=r.requestSpell(life,{...r.newAdventure(life),stage:'combat',map:undefined},{current:1,temp:0},100,{id:'cure',slot:2,intent:'Heal yourself.',componentsConfirmed:true},()=>0);
assert.equal(healed.health.current,12); // 4d8 minimum + WIS 3 + Disciple 4 + initial 1.
const concentration={...g,concentration:{id:'bless',remaining:10,duration:'1 minute'}};
assert.equal(r.concentrationAfterDamage(h,concentration,10,()=>0).game.concentration,undefined);
assert.ok(r.concentrationAfterDamage(h,concentration,10,()=>0.99).game.concentration);
assert.equal(r.concentrationAfterDamage(h,concentration,0,()=>0).game,concentration);
fs.writeFileSync('SPELL-COVERAGE.json',JSON.stringify({catalogCount:catalog.length,automaticCount:report.filter(x=>x.mode==='automatic').length,dmCount:report.filter(x=>x.mode==='dm').length,fullRulesAutomation:false,scope:'Casting routes, cost accounting, save/restore and selected effect boundaries. A passing DM route is not a passing automated spell implementation.',spells:report},null,2));
console.log('Passed: exactly 4 subclasses × 13 classes; level 1–20 stats; passive subclass gates; all 339 casting routes, costs and save states; scaling, concentration and slot limits. Full spell/subclass automation remains incomplete.');
const low = {'acid-splash':4,'sacred-flame':4,'vicious-mockery':4,shock:0,blast:0,'fire-bolt':0,'poison-spray':0,'chill-touch':0,'ray-of-frost':0,'burning-hands':3,fireball:8,'lightning-bolt':8,'chain-lightning':10,'circle-of-death':8,'scorching-ray':0,'inflict-wounds':2,missile:6};
const high = {'acid-splash':0,'sacred-flame':0,'vicious-mockery':0,shock:64,blast:80,'fire-bolt':80,'poison-spray':96,'chill-touch':80,'ray-of-frost':64,'burning-hands':9,fireball:24,'lightning-bolt':24,'chain-lightning':40,'circle-of-death':32,'scorching-ray':72,'inflict-wounds':10,missile:15};
for(const [id,expected] of Object.entries(low)){
 const spell=catalog.find(s=>s.id===id),name=spell.classes.find(c=>c!=='Artificer'&&c!=='Warlock')??spell.classes[0],h=hero(name,20,[id]);
 h.scores={...scores,Wisdom:18};const game={...r.newAdventure(h),stage:'combat',map:undefined};
 const req={id,slot:spell.level,intent:'Use the supported target.',componentsConfirmed:true};
 // Warlocks cast Eldritch Blast without a slot; other damage cases use a full caster.
 assert.equal(r.requestSpell(h,game,{current:1,temp:0},100,req,()=>0).damage,expected,id+' minimum/miss case');
 assert.equal(r.requestSpell(h,game,{current:1,temp:0},100,req,()=>0.99).damage,high[id],id+' maximum/critical/save case');
}
for(const [id,min,max] of [['cure',6,20],['healing-word',6,12],['mass-cure-wounds',9,44],['mass-healing-word',6,12]]){
 const spell=catalog.find(s=>s.id===id),h=hero('Bard',20,[id]);h.scores={...scores,Wisdom:18};const game={...r.newAdventure(h),stage:'combat',map:undefined},req={id,slot:spell.level,intent:'Heal yourself.',componentsConfirmed:true};
 assert.equal(r.requestSpell(h,game,{current:1,temp:0},100,req,()=>0).health.current,1+min,id+' minimum');
 assert.equal(r.requestSpell(h,game,{current:1,temp:0},100,req,()=>0.99).health.current,1+max,id+' maximum');
}
const healingBard=hero('Bard',1,['healing-word']);
let bonus=r.adventureStep({...r.newAdventure(healingBard),stage:'combat',map:undefined},{current:1,temp:0},healingBard,{type:'spell',request:{id:'healing-word',slot:1,intent:'Heal yourself.',componentsConfirmed:true}},()=>0);
assert.equal(bonus.game.round,1);assert.equal(bonus.game.bonusUsed,true);assert.equal(bonus.game.slotSpentThisTurn,true);
assert.ok(r.castError(healingBard,bonus.game,{id:'healing-word',slot:1,intent:'Heal again.',componentsConfirmed:true}));
console.log('Passed: independent low/high effect expectations for damage and healing spells and bonus-action spell timing.');
const lifeAtOne={...hero('Wizard',1,['false-life'])},lifeGame={...r.newAdventure(lifeAtOne),stage:'combat',map:undefined},lifeReq={id:'false-life',slot:1,intent:'Protect yourself.',componentsConfirmed:true};
assert.equal(r.requestSpell(lifeAtOne,lifeGame,{current:1,temp:0},6,lifeReq,()=>0).health.temp,6);
assert.equal(r.requestSpell(lifeAtOne,lifeGame,{current:1,temp:0},6,lifeReq,()=>0.99).health.temp,12);
assert.deepEqual(new Set(catalog.filter(s=>s.automated).map(s=>s.id)),new Set([...Object.keys(low),'cure','healing-word','mass-cure-wounds','mass-healing-word','false-life','blur','shield-of-faith']));
const protectedHero=hero('Cleric',5,['shield-of-faith','blur','guidance']);
const protectionGame={...r.newAdventure(protectedHero),stage:'combat',map:undefined};
const protectionHP={current:r.combatBasics(protectedHero).hp,temp:0};
const protectionRequest=id=>({id,slot:id==='blur'?2:id==='guidance'?0:1,intent:'Protect myself.',componentsConfirmed:true});
let faith=r.adventureStep(protectionGame,protectionHP,protectedHero,{type:'spell',request:protectionRequest('shield-of-faith')},()=>0);
assert.equal(faith.game.round,1);assert.equal(faith.game.bonusUsed,true);
assert.equal(r.spellDefense(faith.game,15).ac,17);
assert.equal(faith.game.concentration.remaining,100);
assert.equal(r.validAdventure(r.adventureSnapshot(protectedHero,JSON.parse(JSON.stringify(faith.game)),faith.health,true),protectedHero),true);
const end=r.adventureStep(faith.game,faith.health,protectedHero,{type:'end-concentration'});
assert.equal(r.spellDefense(end.game,15).ac,15);
const lost=r.concentrationAfterDamage(protectedHero,faith.game,5,()=>0);
assert.equal(r.spellDefense(lost.game,15).ac,15);
const kept=r.concentrationAfterDamage(protectedHero,faith.game,5,()=>0.99);
assert.equal(r.spellDefense(kept.game,15).ac,17);
const expired=r.adventureStep({...faith.game,concentration:{...faith.game.concentration,remaining:1}},faith.health,protectedHero,'dodge',()=>0);
assert.equal(expired.game.concentration,undefined);
const precombat=r.requestSpell(protectedHero,r.newAdventure(protectedHero),protectionHP,100,protectionRequest('blur'));
assert.equal(precombat.waiting,undefined);assert.equal(precombat.game.concentration.remaining,10);
assert.equal(r.spellDefense(precombat.game,15).disadvantage,true);
assert.equal(r.spellDefense(precombat.game,15,{blindsight:true}).disadvantage,false);
assert.equal(r.spellDefense(precombat.game,15,{truesight:true}).disadvantage,false);
let blur=r.adventureStep(protectionGame,protectionHP,protectedHero,{type:'spell',request:protectionRequest('blur')},()=>0);
assert.ok(blur.game.log.some(line=>line.startsWith('Lantern Wisp: d20 [1, 1]')));
assert.equal(blur.game.concentration.remaining,9);
assert.equal(r.spellDefense({...faith.game,concentration:blur.game.concentration},15).ac,15);
const manual=r.requestSpell(protectedHero,protectionGame,protectionHP,100,{...protectionRequest('shield-of-faith'),forceDM:true});
const ruled=r.resolveSpellRuling(protectedHero,manual.game,protectionHP,100,{note:'Shield protects a companion.',damage:0,healing:0,temporaryHP:0});
assert.equal(r.spellDefense(ruled.game,15).ac,15);
const replacement=r.requestSpell(protectedHero,{...faith.game,stage:'inn'},faith.health,100,protectionRequest('guidance'));
const replaced=r.resolveSpellRuling(protectedHero,replacement.game,faith.health,100,{note:'Guidance on the next check.',damage:0,healing:0,temporaryHP:0});
assert.equal(r.spellDefense(replaced.game,15).ac,15);
const invalid=r.adventureSnapshot(protectedHero,{...faith.game,concentration:{...faith.game.concentration,id:'guidance'}},faith.health,true);
assert.equal(r.validAdventure(invalid,protectedHero),false);
// A roll hitting the original AC misses the protected AC.
const armor=r.combatBasics(protectedHero).ac;
const sequence=[0,(armor-3)/20];let index=0;
// Use an available melee weapon so this exercises the real enemy response.
const weapon=r.weaponAttacks(protectedHero).find(w=>!w.blocked&&!w.ranged);
index=0;
const actual=r.adventureStep(faith.game,faith.health,protectedHero,'attack:'+weapon.name,()=>sequence[index++]??0);
assert.ok(actual.game.log.some(line=>line.includes('vs your AC '+(armor+2))));
assert.equal(actual.health.current,faith.health.current);
console.log('Passed: protective spell AC, disadvantage, senses, bonus timing, concentration loss/replacement/end/expiry, and save validation.');
