const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The Attack… button (attackActions in quickActions.js): every way to attack right now, the target first when there is
// a choice (never a default for people), the hero's weapons under Melee and Ranged with to-hit, damage and what is
// left to shoot or throw. Throwing is real: Dagger, Handaxe, Javelin and Spear are thrown as ranged attacks, each throw
// uses one, and they are gathered up when the fight is over. Every chip resolves through the engine and the DM commit.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','dmCommands.js','dmContext.js','playbackRules.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','descriptions.js','chronicleRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({quickActions,attackActions,attackTargets,dmChoices,dmCommand,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,commitDmTurn,equipmentFor,gearedHero,validAdventure,adventureSnapshot,actionDescription,describeEvent,readyHero,validPack,freshStoryGame})',{AsyncStorage:{}});
const make=(cls,scores,extra={})=>{const hero={name:'Pick tester',class:cls,species:'Human',level:1,background:'Soldier',scores,spells:[],...extra};hero.equipment=r.equipmentFor(hero);return hero;};
const fighter=make('Fighter',{Strength:16,Dexterity:12,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10});
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const bandit=r.hostileEncounterGame(fighter,r.newAdventure(fighter),pick('bandit')),health={current:12,temp:0};
const keys=row=>row.map(a=>a.key),section=(row,name)=>{const at=row.findIndex(a=>a.heading===name),next=row.findIndex((a,i)=>i>at&&a.heading);return row.slice(at+1,next<0?undefined:next).filter(a=>!a.heading);};
const held=(hero,game,name)=>(r.gearedHero(hero,game).equipment.items.filter(i=>i.name===name).reduce((n,i)=>n+i.quantity,0));
// ---- In a fight: Back, then Melee and Ranged aimed at the foe ----
const row=r.attackActions(fighter,bandit,health);
assert.equal(row[0].key,'attack-back');assert.ok(row.some(a=>a.heading==='Melee')&&row.some(a=>a.heading==='Ranged'));assert.ok(!row.some(a=>a.target),'one foe: no target to choose');
const melee=section(row,'Melee'),ranged=section(row,'Ranged');
assert.ok(melee.some(a=>a.label==='Greatsword')&&melee.some(a=>a.label==='Unarmed'),'every melee weapon and bare hands: '+keys(melee));
assert.ok(ranged.some(a=>a.key==='throw:Javelin'&&a.label==='Javelin'&&a.icon==='spear'),'javelins are thrown (under Ranged, by name): '+keys(ranged));
const javelin=ranged.find(a=>a.key==='throw:Javelin');assert.match(javelin.detail,/^\+\d · 1d6\+\d · ×8$/,'to hit, damage and how many are left: '+javelin.detail);
assert.match(melee.find(a=>a.label==='Greatsword').detail,/^\+5 · 2d6\+3$/);
assert.equal(javelin.question,'I throw my javelin at the '+r.attackTargets(fighter,bandit,health)[0].name.replace(/^the /i,'')+'.');
for(const a of row.filter(a=>!a.heading))assert.ok(r.actionDescription(a,fighter,bandit).length>20,a.key+' is described');
// Every weapon chip resolves through the engine and the DM commit.
for(const a of [...melee,...ranged]){const s=r.adventureStep(bandit,health,fighter,a.action,()=>.6);assert.ok(!s.error,a.key+': '+s.error);const t=r.commitDmTurn(fighter,bandit,health,a.action,{question:a.question,narration:'Resolved below.'},()=>.6);assert.ok(!t.error,a.key+' commits: '+t.error);}
// ---- Throwing: one javelin a throw, out of hand until the fight is over, then gathered up ----
const thrown=r.adventureStep({...bandit,openingAttackAvailable:false},health,fighter,javelin.action,()=>.6);
assert.ok(!thrown.error);assert.equal(thrown.game.pack.spent.Javelin,1);assert.equal(held(fighter,thrown.game,'Javelin'),7,'seven left in hand');
const line=(thrown.events??[]).find(e=>/^You throw Javelin:/.test(e));assert.ok(line,'the log says it was thrown: '+(thrown.events??[]).join(' | '));
assert.match(line,/\(disadvantage\)/,'thrown with the foe beside you: disadvantage');assert.equal(r.describeEvent({kind:'roll',text:line}).title,'Thrown Javelin','the feed card names the throw');
assert.ok(r.validAdventure(r.adventureSnapshot(fighter,thrown.game,thrown.health,true),fighter),'a save with thrown javelins is valid');
const opening=r.adventureStep(bandit,health,fighter,javelin.action,()=>.6);assert.match((opening.events??[]).find(e=>/^You throw Javelin:/.test(e))??'',/\(normal\)/,'thrown before the foe closes in: no disadvantage');
// Out of javelins: no more throws, and they are no longer offered.
let empty={...thrown.game,pack:{...thrown.game.pack,spent:{Javelin:8}}};
assert.equal(held(fighter,empty,'Javelin'),0);assert.ok(!r.dmChoices(fighter,empty,health).some(c=>c.id==='throw:Javelin'),'no throw offered with none in hand');
assert.match(r.adventureStep(empty,health,fighter,'throw:Javelin',()=>.6).error??'',/no javelin to throw/);
// The fight ends: the javelins are gathered up.
let game=thrown.game,hp=thrown.health;for(let i=0;i<30&&game.stage==='combat';i++){const s=r.adventureStep(game,hp,fighter,game.actionUsed?'end-turn':'attack:Greatsword',()=>.95);game=s.game;hp=s.health;if(s.events?.some(e=>/gather up your thrown javelin/.test(e)))assert.ok(true);}
assert.notEqual(game.stage,'combat');assert.equal(game.pack.spent.Javelin,undefined,'gathered up after the fight');assert.ok(game.log.some(l=>/You gather up your thrown javelin/.test(l)));assert.equal(held(fighter,game,'Javelin'),8);
assert.ok(r.validPack({gold:1,items:[],spent:{Arrow:2,Dagger:1}}));assert.equal(r.validPack({gold:1,items:[],spent:{Longsword:1}}),false,'only thrown weapons and arrows are spent');
// Typed: "I throw my javelin at the bandit" throws; "throw a punch" punches; a sword is not for throwing.
const said=r.dmCommand(fighter,bandit,'I throw my javelin at the bandit.',health);assert.equal(JSON.stringify(said.action),JSON.stringify({type:'encounter-attack',weapon:'Javelin',thrown:true}));
assert.equal(r.dmCommand(fighter,bandit,'I hurl a javelin.',health).action.thrown,true,'at whoever an attack would go for');
assert.match(r.dmCommand(fighter,bandit,'I throw my greatsword at the bandit',health).error,/not made for throwing/);
assert.equal(r.dmCommand(fighter,bandit,'I throw a punch at the bandit',health).action.weapon,'Unarmed Strike');
// ---- A bow under Ranged, with its arrows ----
const archer=make('Fighter',{Strength:12,Dexterity:16,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},{fighterKit:'ranged'});
const shot=section(r.attackActions(archer,r.hostileEncounterGame(archer,r.newAdventure(archer),pick('bandit')),health),'Ranged');
assert.ok(shot.some(a=>a.label==='Longbow'&&/×20$/.test(a.detail)),'the longbow with twenty arrows: '+shot.map(a=>a.label+' '+a.detail));
// ---- People: never a default target ----
const kara=r.readyHero('fighter');
const written={title:'The Test Road',premise:'A quiet inn.',opening:'You arrive.',objective:'Find the thief.',resolution:'Catch them.',secret:'The keeper knows.',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'The Lamp',description:'An inn.'},bridge:{name:'The Ford',description:'A ford.'},tower:{name:'The Mill',description:'A mill.'}},npcs:{keeper:{name:'Ivo Brask',species:'Human',role:'Innkeeper',motive:'Keep the peace.',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera Vane',species:'Elf',role:'Scribe',motive:'Learn the truth.',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
const inn=r.freshStoryGame(kara,{...written,id:'test-story',status:'active'},r.newAdventure(kara));
assert.ok(r.attackTargets(kara,inn,null).length>=2,'the two residents can be attacked');
const calm=r.attackActions(kara,inn,null);
{assert.ok(calm.some(a=>a.heading==='Choose who to attack')&&!calm.some(a=>a.heading==='Melee'),'only people here: choose who first');
 const who=calm.find(a=>a.target);const aimed=r.attackActions(kara,inn,null,who.target);assert.ok(section(aimed,'Melee').every(a=>/^npc-attack:/.test(a.key)),'aimed at that person');
 for(const a of [...section(aimed,'Melee'),...section(aimed,'Ranged')]){assert.ok(/^npc-(attack|throw):/.test(a.key));const s=r.adventureStep(inn,null,kara,a.action,()=>.6);assert.ok(!s.error,a.key+': '+s.error);}
 assert.ok(section(aimed,'Ranged').some(a=>/^npc-throw:/.test(a.key)),'a javelin can be thrown at them');
 const q=r.quickActions(kara,inn,null);assert.ok(q.some(a=>a.key==='attack-menu'&&!a.primary),'Attack… is there, not highlighted, away from a fight');}
// The screen: headings are labels, skipped by the number keys and the guide; a weapon chip closes the picker.
const dm=fs.readFileSync('DungeonMaster.js','utf8');assert.ok(dm.includes("if(a.heading)return <View key={a.key} dataSet={{qb:'action-heading'}}")&&dm.includes('keysRef.current={actions:actions.filter(a=>!a.heading)')&&dm.includes('actions={pressable}')&&dm.includes("if(a.key==='attack-menu'){setSpellsOpen(false);setAttackOpen(true);return;}"));
console.log('Attack…: Back, the target (chosen first when there is a choice, never a default for people), every weapon under Melee and Ranged with to-hit, damage and what is left, all resolving through the engine; thrown daggers, handaxes, javelins and spears (one a throw, disadvantage once the foe is beside you, gathered up after the fight), typed throws, and bows with their arrows.');
