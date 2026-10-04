const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Balance across the side (encounterRules.js scaledFoe, adventureRules.js withFoeScale): a hero alone meets the foe as
// it was written; companions, allies and other heroes at the shared table scale the foe (more hit points and blows, a
// bigger pack), kept for the fight and never lowered as the side falls, in creature fights, the tale's foe, the wilds
// and brawls with people; leaving a party gives the foe back its numbers for one hero. Also the remaining party gaps:
// a subclass's action turned on a person in a brawl, a subclass ward on another device's turn, and a short rest
// offered to bring a fallen companion round. Every result is a valid save.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','descriptions.js','playbackHp.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,validAdventure,adventureSnapshot,encounterFoe,combatBasics,attackOptions,startParty,joinParty,partyView,settleParty,soloFromParty,foeScaleOf,sideStrength,brawlStrength,foeOffense,scaledFoe,foeScaling,sideWeightOf,dmChoices,dmCommand,quickActions,foeHitsPartyHero,equipmentFor,worldPlaces,subclassUses})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const plain=o=>JSON.parse(JSON.stringify(o));
const always=v=>()=>v;
const seeded=seed=>{let s=(seed*48271+12345)%2147483647;return ()=>(s=(s*16807)%2147483647)/2147483647;};
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
const valid=(hero,game,health,what='')=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,plain(game),health,true),hero),'the save is valid '+what);
const lines=s=>(s.events??[]).join(' | ');
const hpOf=hero=>({current:r.combatBasics(hero).hp,temp:0});
const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),wren=r.readyHero('rogue');
const swing=hero=>'attack:'+r.attackOptions(hero)[0].name;
const fightFor=(hero,foe='bandit')=>({...r.hostileEncounterGame(hero,r.newAdventure(hero),pick(foe)),potions:0});
// A companion travelling with the hero, trained in a class (followerRules.js, npcRules.js npcClasses).
const withCompanion=(g,cls='Fighter',level=1)=>({...g,followers:{mara:{status:'following',location:'inn',reason:'Test.',terms:''}},npcClasses:{mara:{class:cls,level}}});
const make=(cls,sub,level=3)=>{const h={name:'Brawler',class:cls,species:'Human',level,background:'Soldier',scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:[],plannedSubclass:sub};h.equipment=r.equipmentFor(h);return h;};

// ---- 1. A hero alone: the foe exactly as written, nothing kept ----
{const g=fightFor(kara),base=r.encounterFoe(kara,g);
 assert.equal(r.sideStrength(g,kara),1,'one hero is a side of 1');
 assert.equal(base.maximum,g.story.foeStats.maximum);assert.equal(base.swings,undefined,'no extra blows');assert.equal(r.scaledFoe(base,1),base,'scale 1 changes nothing');
 const step=r.adventureStep(g,hpOf(kara),kara,swing(kara),seeded(3));assert.ok(!step.error,step.error);
 assert.equal(step.game.foeScale,undefined,'nothing kept for a hero alone');assert.deepEqual(plain(r.foeOffense(1)),{swings:1,mult:1});
 valid(kara,step.game,step.health,'solo');}

// ---- 2. A companion: the side is stronger, so is the foe ----
{const g=withCompanion(fightFor(kara)),f=r.sideStrength(g,kara),w=r.sideWeightOf('Fighter');
 assert.equal(f,1+w,'a trained companion at the hero\'s level adds their class\'s share of a hero');
 assert.equal(r.sideStrength(g,{...kara,level:5}),Math.round(100*(1+w*0.3))/100,'a companion far below the hero adds less');
 assert.equal(r.sideStrength({...g,npcClasses:{}},kara),1+r.foeScaling.untrained,'one without a class adds a quarter');
 const step=r.adventureStep(g,hpOf(kara),kara,swing(kara),seeded(4));assert.ok(!step.error,step.error);
 assert.deepEqual(plain(step.game.foeScale),{f,key:'story'},'the scale is kept for the fight');
 const foe=r.encounterFoe(kara,step.game),base=g.story.foeStats;
 assert.equal(foe.maximum,Math.round(base.maximum*Math.pow(f,r.foeScaling.hp)),'more hit points');
 assert.ok(foe.bonus>base.bonus||foe.swings>1,'and harder blows');
 assert.ok(step.game.enemyHP<=foe.maximum&&step.game.enemyHP>0);valid(kara,step.game,step.health,'with a companion');
 // The companion falls: the foe stays as it is (never lowered mid-fight).
 const down=r.adventureStep({...step.game,npcHP:{mara:0}},step.health,kara,swing(kara),seeded(5));assert.ok(!down.error,down.error);
 if(down.game.stage==='combat')assert.deepEqual(plain(down.game.foeScale),{f,key:'story'},'not lowered when the side falls');
 // Two blows a turn against a side of two.
 assert.equal(r.foeOffense(2).swings,2,'a side of two draws two blows');
 const fierce=r.adventureStep({...step.game,followers:{},foeScale:{f:2,key:'story'},enemyHP:30},{current:999,temp:0},kara,'dodge',seeded(6));
 assert.ok(!fierce.error,fierce.error);assert.equal((fierce.events??[]).filter(l=>/^Bandit Cutthroat: d20/.test(l)).length,2,'two blows: '+lines(fierce));
 // A pack grows by members instead.
 const pack=withCompanion(fightFor(kara,'wolves')),packFoe=r.encounterFoe(kara,{...pack,foeScale:{f:1.5,key:'story'}});
 assert.equal(packFoe.group.size,3,'three wolves instead of two');assert.equal(packFoe.maximum,3*packFoe.group.memberHP);
 // A save holding a scale is checked; a bad one is refused.
 assert.equal(r.validAdventure(r.adventureSnapshot(kara,plain({...step.game,foeScale:{f:9,key:'story'}}),step.health,true),kara),false,'an impossible scale is refused');
 assert.equal(r.validAdventure(r.adventureSnapshot(kara,plain({...step.game,foeScale:{f:1.5,key:'elsewhere'}}),step.health,true),kara),false,'an unknown key is refused');}

// ---- 3. A party at the shared table: every standing hero counts ----
{const fight=fightFor(kara);
 let table=r.startParty(r.adventureSnapshot(kara,fight,hpOf(kara),true),'A','Sam');
 table=r.joinParty(table,'B',{character:JSON.stringify(ilyra),game:null,health:null,name:'Jo'}).snapshot;
 table=plain(r.joinParty(table,'C',{character:JSON.stringify(wren),game:null,health:null,name:'Ash'}).snapshot);
 const view=id=>r.partyView(table,id);
 const three=Math.round(100*(1+2*r.foeScaling.hero))/100;
 assert.equal(r.sideStrength(view('A').game,kara),three,'three heroes');
 const opening=r.adventureStep(view('B').game,view('B').health,ilyra,swing(ilyra),seeded(11));assert.ok(!opening.error,opening.error);
 table=plain(r.adventureSnapshot(ilyra,opening.game,opening.health,true));
 assert.equal(table.game.foeScale?.f,three,'the foe is scaled to the party');
 for(const [id,h] of [['A',kara],['B',ilyra],['C',wren]])valid(h,view(id).game,view(id).health,'party view '+id);
 assert.equal(r.encounterFoe(kara,view('A').game).maximum,r.encounterFoe(wren,view('C').game).maximum,'the same foe from every point of view');
 assert.ok(r.encounterFoe(kara,view('A').game).swings>=2,'the foe strikes more than once a turn at a party');
 // Leaving the table: the foe goes back to its numbers for one hero.
 const alone=r.soloFromParty(view('A'),1);assert.equal(alone.game.foeScale,undefined);assert.ok(alone.game.enemyHP<=fight.story.foeStats.maximum,'hit points back within one hero\'s foe');
 valid(kara,alone.game,alone.health,'after leaving the party');}

// ---- 4. The wilds: a creature's scale is its own; the tale's foe keeps its own ----
{const camp={...withCompanion(fightFor(kara)),stage:'inn',foeScale:{f:1.5,key:'story'},enemyHP:20};delete camp.openingAttackAvailable;
 const lair={name:'Cutthroat Hollow',description:'A bandit camp in a ravine, smoke and bones.',kind:'camp',bearing:'E',miles:1,danger:'lair',feature:null,lair:{template:'bandit',name:'Red Maddock',appearance:'A rangy bandit with a red scarf and a notched cutlass.'}};
 const arrive=r.adventureStep(camp,hpOf(kara),kara,{type:'discover',place:lair,travel:true},always(.5));assert.ok(!arrive.error,arrive.error);
 const g=arrive.game;assert.ok(g.wildFight,'the lair owner attacks');assert.deepEqual(plain(g.wildFight.storyFoeScale),{f:1.5,key:'story'},'the tale\'s foe keeps its scale aside');
 assert.equal(g.foeScale?.key,'wild','the creature is scaled to the side');assert.equal(g.enemyHP,r.encounterFoe(kara,g).maximum);valid(kara,g,arrive.health,'in the wilds');
 const fled=r.adventureStep(g,arrive.health,kara,'flee',always(.5));assert.ok(!fled.error,fled.error);
 assert.deepEqual(plain(fled.game.foeScale),{f:1.5,key:'story'},'the tale\'s foe gets its scale back');assert.equal(fled.game.enemyHP,20);
 const left=r.worldPlaces(fled.game).find(p=>p.threat)?.threat;assert.ok(left&&left.hp<=g.wildFight.stats.maximum,'the creature left behind keeps its wounds at one hero\'s numbers');
 valid(kara,fled.game,fled.health,'after fleeing');}

// ---- 5. Brawls with people: more blows against a bigger side, never against a hero alone ----
{const brute=make('Fighter','Champion',3),inn={...fightFor(brute),stage:'inn',enemyHP:0};delete inn.openingAttackAvailable;
 const begun=r.adventureStep(inn,{current:999,temp:0},brute,{type:'npc-attack',target:'keeper',weapon:r.attackOptions(brute)[0].name},always(.02));assert.ok(!begun.error,begun.error);
 assert.ok(begun.game.npcCombat?.active,'a brawl begins');assert.equal(r.brawlStrength(begun.game,brute),1,'a hero alone');
 const blows=res=>(res.events??[]).filter(l=>/^Captain Oona Brask attacks you/.test(l)).length;
 const solo=r.adventureStep(begun.game,{current:999,temp:0},brute,'npc-dodge',always(.3));assert.ok(!solo.error,solo.error);
 assert.equal(blows(solo),1,'one blow at a hero alone: '+lines(solo));
 const allied={...begun.game,npcCombat:{...begun.game.npcCombat,order:[...begun.game.npcCombat.order.filter(n=>n.id!=='mara'),{id:'mara',side:'ally',role:'attack',initiative:1}]},npcClasses:{mara:{class:'Fighter',level:3}}};
 assert.equal(r.brawlStrength(allied,brute),1+r.sideWeightOf('Fighter'),'an ally fighting beside the hero');
 const pressed=r.adventureStep({...allied,npcCombat:{...allied.npcCombat,order:allied.npcCombat.order}},{current:999,temp:0},brute,'npc-dodge',always(.3));assert.ok(!pressed.error,pressed.error);
 assert.equal(blows(pressed),r.foeOffense(1+r.sideWeightOf('Fighter')).swings,'blows against a side with an ally: '+lines(pressed));
 valid(brute,pressed.game,{current:Math.min(pressed.health.current,r.combatBasics(brute).hp),temp:0},'a brawl against a bigger side');}

// ---- 6. A subclass's action turned on a person in a brawl ----
{const snare=make('Artificer','Snarewright'),g={...fightFor(snare),stage:'inn',enemyHP:0,resources:{}};delete g.openingAttackAvailable;
 const hp={current:r.combatBasics(snare).hp,temp:0};
 const begun=r.adventureStep(g,{current:hp.current,temp:0},snare,{type:'npc-attack',target:'keeper',weapon:r.attackOptions(snare)[0].name},always(.02));assert.ok(!begun.error,begun.error);
 assert.ok(begun.game.npcCombat?.active,'a brawl begins');
 const choices=r.dmChoices(snare,begun.game,begun.health);assert.ok(choices.some(c=>c.id==='npc-feat:keeper'),'offered at the person: '+choices.map(c=>c.id).join());
 const typed=r.dmCommand(snare,begun.game,'I fire a tangle-bolt at Oona',begun.health);
 assert.deepEqual(plain(typed.action),{type:'npc-attack',target:'keeper',feat:true},'typed at the one named');
 const bolt=r.adventureStep(begun.game,begun.health,snare,typed.action,always(.02));assert.ok(!bolt.error,bolt.error);
 assert.match(lines(bolt),/Tangle-Bolt: Captain Oona Brask makes a Dexterity save d20 \[1\]/,lines(bolt));
 assert.equal(bolt.game.resources.feat,1,'a use spent');assert.ok((bolt.game.npcHP?.keeper??99)<(begun.game.npcHP?.keeper??99),'she is hurt');
 valid(snare,bolt.game,bolt.health,'after a Tangle-Bolt in a brawl');
 const none=r.adventureStep({...begun.game,resources:{feat:r.subclassUses(snare,'Intelligence')}},begun.health,snare,typed.action,always(.5));assert.match(none.error,/No uses of Tangle-Bolt remain/);
 // Every chip offered in the brawl is accepted by the engine.
 for(const chip of r.quickActions(snare,begun.game,begun.health).filter(c=>c.action&&!c.question)){const res=r.adventureStep(begun.game,begun.health,snare,chip.action,always(.5));assert.ok(!res.error,chip.key+': '+res.error);}
 // A bonus action that heals (an Alchemist's Field Tonic) works in a brawl when hurt.
 const alch=make('Artificer','Alchemist'),ag={...fightFor(alch),stage:'inn',enemyHP:0,resources:{}};delete ag.openingAttackAvailable;
 const ab=r.adventureStep(ag,{current:3,temp:0},alch,{type:'npc-attack',target:'keeper',weapon:r.attackOptions(alch)[0].name},always(.02));assert.ok(ab.game.npcCombat?.active);
 assert.ok(r.dmChoices(alch,ab.game,ab.health).some(c=>c.id==='class:tonic'),'Field Tonic offered in a brawl');
 const tonic=r.adventureStep(ab.game,ab.health,alch,'class:tonic',always(.5));assert.ok(!tonic.error,tonic.error);
 assert.ok(tonic.health.current>ab.health.current&&tonic.game.bonusUsed,'healed with the bonus action: '+lines(tonic));valid(alch,tonic.game,tonic.health,'after a tonic in a brawl');}

// ---- 7. A ward on another device's turn ----
{const bulwark=make('Barbarian','Path of the Bulwark');
 let table=r.startParty(r.adventureSnapshot(kara,fightFor(kara),hpOf(kara),true),'A','Sam');
 table=plain(r.joinParty(table,'B',{character:JSON.stringify(bulwark),game:null,health:null,name:'Bo'}).snapshot);
 const g=r.partyView(table,'A').game,foe={...r.encounterFoe(kara,g),attackBonus:20};
 const hit=r.foeHitsPartyHero(g,foe,'Bandit Cutthroat','B','normal',always(.6));
 assert.match(hit.lines.join(' | '),/Iron Brace: the blow is reduced by \d+/,'the ward fires: '+hit.lines.join(' | '));
 assert.match(hit.lines.join(' | '),/(− \d+ Iron Brace = \d+ \w+ damage to Brawler|No damage gets through)/);
 const b=hit.game.party.members.B;assert.equal(b.hero.resources.feat,1,'their own use spent');assert.equal(b.reacted,g.turnOrder?.round??g.round??0);
 const again=r.foeHitsPartyHero(hit.game,foe,'Bandit Cutthroat','B','normal',always(.6));assert.ok(!/Iron Brace/.test(again.lines.join(' ')),'one reaction a round');
 valid(kara,hit.game,hpOf(kara),'after a ward on another hero');}

// ---- 8. A short rest is offered to bring a fallen companion round ----
{const g={...withCompanion(fightFor(kara)),stage:'inn',enemyHP:16,npcHP:{mara:0}};delete g.openingAttackAvailable;
 assert.ok(r.dmChoices(kara,g,hpOf(kara)).some(c=>c.id==='short-rest'),'offered though the hero is unhurt');
 const rest=r.adventureStep(g,hpOf(kara),kara,'short-rest',always(.5));assert.ok(!rest.error,rest.error);assert.ok(rest.game.npcHP.mara>0,'the companion comes round');
 assert.ok(!r.dmChoices(kara,{...g,npcHP:{}},hpOf(kara)).some(c=>c.id==='short-rest'),'not offered with nothing to recover');}
console.log('verify-balance: ok');
