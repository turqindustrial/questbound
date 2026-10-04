const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Spells that work on others and go on working (2024 rules, SRD 5.2): Aid on the hero, companions and other heroes;
// spells for friends at the shared table; areas and many targets; lasting damage (Moonbeam, Heat Metal, Spiritual
// Weapon, Call Lightning, Spirit Guardians, Acid Arrow, Searing Smite, burning webs); Hex moved as a bonus action; Shield
// by the device's choice; Counterspell and Feather Fall refused plainly. Everything through dmCommand, adventureStep,
// commitDmTurn and the chips, in a written story.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','experienceRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js','storyLog.js','sequelRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const names='hostileEncounterGame,startParty,joinParty,newAdventure,freshStoryGame,validAdventure,adventureSnapshot,dmChoices,dmContext,commitDmTurn,adventureStep,quickActions,spellActions,dmCommand,knownSpells,spellLibrary,spellLimits,automaticEffects,narratedSpells,spellCostOptions,requestSpell,resolveSpellRuling,makeCharacter,equipmentFor,startWildFight,spellDamageMax,spellDefense,combatBasics,speciesSpells,partyView,settleParty,canonicalParty,endSpellMarks,spellConditions,castingStages,validParty,heroIdOf,markOf,withSpellMark,bonusOptions,concentrationAfterDamage,gearedHero,npcProfile,attackBoost,companionsAttack,heroTurnBegins,guidanceBonus,resistedDamage,wardEdge,encounterFoe,lastingTurn,riderDamage,markGone,turnCost,shieldReaction';
const r=vm.runInNewContext(source+'\n({'+names.split(',').map(n=>`${n}:typeof ${n}==='undefined'?undefined:${n}`).join(',')+'})',{AsyncStorage:{},weaponIcon:()=>'sword',console});
for(const n of names.split(','))assert.ok(r[n]!==undefined,n+' is defined');

// ---------- A written story to play in ----------
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the port.',motive:'Wants the wells to run sweet.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',regard:{stance:'curious',reason:'Never met one of your kind.'},ties:{other:'friend',foe:'enemy',note:'They share the port.'}});
const written={id:'thirst-1',status:'active',title:'The Thirst Beneath Redwind',premise:'The wells of Redwind are drying.',opening:'Salt wind at the door of The Salt Cup.',objective:'Find what drinks the wells.',resolution:'The wells run again.',secret:'A cult diverts the water.',foe:'Vessa the Dry Hand',foeSpecies:'Human',foeAppearance:'A gaunt woman in a cracked clay mask with salt-crusted robes.',foeDamageType:'Necrotic',region:'Redwind',terrain:'coast',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'The Salt Cup',description:'A tavern above the salt flats.',kind:'settlement'},bridge:{name:'Dry Cistern',description:'A cistern gone dry.',kind:'ruin'},tower:{name:'Pump House',description:'An old pump house.',kind:'ruin'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},
 landmarks:['Brine Steps','Gull Rock'].map((name,i)=>({name,description:'A place on the shore road, number '+(i+1)+'.',kind:'landmark',bearing:['N','E'][i],miles:2+i,from:'inn',danger:'safe',feature:'A marker stone.'})),
 chapters:[{title:'Dry Wells',goal:'Ask about the wells.',turn:'A clue.'},{title:'The Cult',goal:'Face Vessa.',turn:'The end.'}]};
const clone=v=>JSON.parse(JSON.stringify(v));
const scoresFor=cls=>{const ab={Wizard:'Intelligence',Artificer:'Intelligence',Cleric:'Wisdom',Druid:'Wisdom',Ranger:'Wisdom',Bard:'Charisma',Sorcerer:'Charisma',Warlock:'Charisma',Paladin:'Charisma'}[cls];const s={Strength:12,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:10,Charisma:10};s[ab]=16;return s;};
function levelFor(cls,spellLevel){for(let l=1;l<=20;l++){const lim=r.spellLimits({class:cls,level:l});if(lim&&lim.maxSpellLevel>=spellLevel&&(spellLevel>0||lim.cantrips>0))return l;}if(cls==='Warlock'&&spellLevel>=6)return 2*spellLevel-1;return null;}
function heroFor(cls,spell){
 const level=levelFor(cls,spell.level);if(!level)return null;
 const h={name:'Route '+cls,class:cls,species:'Human',race:'Human',background:'Sage',level,scores:scoresFor(cls),spells:[spell.id],spellbook:cls==='Wizard'&&spell.level>0?[spell.id]:[],spellSelectionVersion:2};
 if(cls==='Warlock'&&spell.level>=6){h.spells=[];h.arcanum={[spell.level]:spell.id};}
 h.equipment=r.equipmentFor(h);
 // A quarterstaff for Shillelagh, whatever the kit.
 if(spell.id==='shillelagh'&&!h.equipment.items.some(i=>/Quarterstaff|Club/.test(i.name)))h.equipment={...h.equipment,items:[...h.equipment.items,{name:'Quarterstaff',quantity:1}]};
 return h;
}
const scenes=hero=>{
 const inn=r.freshStoryGame(hero,clone(written),r.newAdventure(hero));
 const landmark=r.adventureStep(inn,null,hero,{type:'travel',destination:inn.world.places[0].id},()=>0.99).game;
 const bridge=r.adventureStep(inn,null,hero,{type:'travel',destination:'bridge'},()=>0.99).game;
 const fight={...r.adventureStep(bridge,null,hero,'approach',()=>0.5).game,openingAttackAvailable:false,lastHit:{target:'foe'},hurtBy:'foe'};
 const wild={...r.startWildFight(landmark,hero,{template:'bandit',name:'Salt Bandit',appearance:'A lean bandit in a salt-white scarf.'},{place:landmark.world.at,from:'inn',hp:null}).game,openingAttackAvailable:false,lastHit:{target:'foe'},hurtBy:'foe'};
 const won={...landmark,stage:'wild'};
 const victory={...fight,stage:'victory',enemyHP:0,foeFate:'slain'};delete victory.lastHit;delete victory.hurtBy;
 // A brawl with the keeper, begun by a swing that misses (a real fight, rolled by the engine).
 const swing=r.adventureStep(inn,null,hero,{type:'npc-attack',target:'keeper',weapon:'Unarmed Strike'},()=>0.01);
 assert.equal(swing.error,undefined,'a brawl begins: '+swing.error);assert.ok(swing.game.npcCombat?.active,'the brawl is on');
 const brawl={...swing.game};
 return {inn,landmark,won,victory,fight,wild,brawl};
};
const ZERO={decision:'cast',note:'Resolved by the effects check.',damage:0,selfDamage:0,healing:0,temporaryHP:0};
const hero=(cls,level,spells,patch={})=>{const h={name:'Rule '+cls,class:cls,species:'Human',race:'Human',background:'Sage',level,scores:scoresFor(cls),spells,spellbook:cls==='Wizard'?spells.filter(id=>r.spellLibrary.find(s=>s.id===id)?.level>0):[],spellSelectionVersion:2,...patch};h.equipment=r.equipmentFor(h);return h;};
const cast=(h,game,text,random=()=>0.5,health=null)=>{const c=r.dmCommand(h,game,text,health);if(!c||c.error)return {error:c?.error??'no command',command:c};const s=r.adventureStep(game,health,h,c.action,random);return {...s,command:c};};
const lines=step=>(step.events??[]).join('\n');
const saved=(h,step)=>r.validAdventure(r.adventureSnapshot(h,clone(step.game),step.health,true),h);
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const seq=values=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const maxHp=(h,game)=>r.combatBasics(r.gearedHero(h,game)).hp;
// A fight in the wilds with a bandit and a goblin at its side (both humanoid).
const banditFight=h=>{const sc=scenes(h);return {...r.startWildFight(sc.landmark,h,{template:'bandit',name:'Salt Bandit',appearance:'A lean bandit in a salt-white scarf.',ally:{template:'goblin',name:'Snag',appearance:'A one-eyed goblin in a wolfskin hood.'}},{place:sc.landmark.world.at,from:'inn',hp:null}).game,openingAttackAvailable:false};};
// Mara follows the hero (a companion at their side).
const withMara=game=>({...game,followers:{mara:{status:'following',location:'inn',reason:'She wants to see the wells run again.',terms:'Shares the road.'}}});
// The shared table: Kara (A, this device) and Bram (B).
const table=(kara,bram,game,health)=>{
 const hosted=r.startParty(r.adventureSnapshot(kara,game,health??{current:r.combatBasics(kara).hp,temp:0},true),'A','Sam');
 return r.joinParty(hosted,'B',{character:JSON.stringify(bram),game:r.newAdventure(bram),health:null,name:'Jo'}).snapshot;
};

// ---------- Aid: hit point maximum and current hit points, through the HUD's numbers, ending on a long rest ----------
{
 const cleric=hero('Cleric',3,['guidance','sacred-flame','aid','bless']),sc=scenes(cleric),base=r.combatBasics(cleric).hp;
 const aided=cast(cleric,sc.inn,'I cast Aid.');
 assert.equal(aided.error,undefined,aided.error);assert.match(lines(aided),/Aid on you: .*rise by 5 for 8 hours/);
 assert.equal(aided.game.buffs.aid.amount,5);assert.equal(aided.health.current,base+5,'current hit points rise by 5');
 assert.equal(maxHp(cleric,aided.game),base+5,'the maximum the HUD shows rises by 5');assert.ok(saved(cleric,aided),'an Aided hero above their old maximum saves');
 assert.match(r.combatBasics(r.gearedHero(cleric,aided.game)).hpFormula,/\+5 Aid/);
 // Healing tops out at the raised maximum.
 const cure=r.requestSpell(cleric,{...aided.game},{current:1,temp:0},maxHp(cleric,aided.game),{id:'aid',slot:2,intent:'again',componentsConfirmed:true,allies:['self']},()=>0.5);
 assert.equal(cure.error,undefined,cure.error);assert.match(cure.logs.join(' '),/already has as much from Aid/,'a second casting does not add to the first');
 // A higher slot: +10.
 const high=hero('Cleric',5,['guidance','aid']),hs=scenes(high),up=cast(high,hs.inn,'I cast Aid using a level 3 slot.');
 assert.equal(up.error,undefined,up.error);assert.equal(up.game.buffs.aid.amount,10);assert.equal(maxHp(high,up.game),r.combatBasics(high).hp+10);
 // A long rest ends it: the hero is whole at their own maximum again.
 const rested=r.adventureStep(aided.game,aided.health,cleric,'long-rest',()=>0.5);
 assert.equal(rested.error,undefined,rested.error);assert.equal(rested.game.buffs,undefined,'Aid ends with a long rest');assert.equal(maxHp(cleric,rested.game),base);
 // On a companion: their own maximum rises (npcProfile), and on the party's other hero.
 const inn=withMara(sc.inn);
 const both=cast(cleric,inn,'I cast Aid on me and Rusk.');
 assert.equal(both.error,undefined,both.error);same(both.command.action.request.allies,['self','mara']);
 assert.equal(both.game.aided.mara,5);assert.equal(r.npcProfile(both.game,'mara').maximumHP,r.npcProfile(inn,'mara').maximumHP+5);
 assert.equal(both.game.npcHP.mara,r.npcProfile(inn,'mara').maximumHP+5);assert.ok(saved(cleric,both));
 // With no one named, Aid reaches the caster and the companion at their side.
 const bare=cast(cleric,inn,'I cast Aid.');same(bare.command.action.request.allies,['self','mara']);
 // In a fight at the shared table: Bram's hit points and maximum rise, seen from his own device.
 const bram=hero('Fighter',3,[],{name:'Bram Ironfist'}),fight=r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0.5),party=table(cleric,bram,fight);
 const viewA=r.partyView(party,'A'),onBram=cast(cleric,{...viewA.game,openingAttackAvailable:false},'I cast Aid on Bram.',()=>0.5,viewA.health);
 assert.equal(onBram.error,undefined,onBram.error);
 const m=onBram.game.party.members.B;assert.equal(m.hero.buffs.aid.amount,5);assert.equal(m.stats.hp,r.combatBasics(bram).hp+5);assert.equal(m.health.current,r.combatBasics(bram).hp+5);
 const settled={...viewA,game:onBram.game,health:onBram.health},fromB=r.partyView(settled,'B');
 assert.equal(maxHp(bram,fromB.game),r.combatBasics(bram).hp+5,'Bram\'s own device sees the raised maximum');
 assert.ok(r.validAdventure(clone(fromB),bram),'Bram\'s view with more hit points than before is a valid save');
}

// ---------- Spells for friends: Bless, Heroism, Shield of Faith, Guidance, Resistance, wards on others ----------
{
 const cleric=hero('Cleric',3,['guidance','resistance','sacred-flame','bless','shield-of-faith','heroism','protection-from-evil-and-good','longstrider']);
 const bram=hero('Fighter',3,[],{name:'Bram Ironfist'}),fight=r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0.5),party=table(cleric,bram,fight),viewA=r.partyView(party,'A');
 const start={...withMara(viewA.game),openingAttackAvailable:false},hp=viewA.health;
 // Bless with no one named: the caster, Bram and Mara (three creatures at 1st level).
 const bless=cast(cleric,start,'I cast Bless.',()=>0.5,hp);
 assert.equal(bless.error,undefined,bless.error);same(bless.command.action.request.allies,['self','party:B','mara']);
 assert.match(lines(bless),/Bless on you, Bram Ironfist and [A-Za-z]+ [A-Za-z]+: each adds 1d4/);
 assert.ok(bless.game.boons['h:B'].some(b=>b.id==='bless'&&b.by==='A'));assert.ok(bless.game.boons.mara.some(b=>b.id==='bless'));
 assert.ok(r.attackBoost(bless.game,()=>0.5).amount>0,'the caster is blessed too');
 const blessedB=r.partyView({...viewA,game:bless.game,health:bless.health},'B');
 assert.ok(r.attackBoost(blessedB.game,()=>0.5).amount>0,'Bram adds 1d4 on his own device');
 assert.ok(r.validAdventure(clone(blessedB),bram),'boons are a valid shared save');
 assert.equal(r.canonicalParty({...viewA,game:bless.game,health:bless.health}),r.canonicalParty(blessedB),'turning the view changes nothing');
 // Mara's attacks add 1d4 while it holds.
 const helped=r.companionsAttack(bless.game,{name:'Lantern Wisp',ac:12,saves:{}},seq([0.99,0.5,0.5]),0);
 assert.match(helped.lines.join(' '),/Bless/,'a blessed companion adds the die');
 // Bless on Bram alone: the caster gains nothing from it.
 const only=cast(cleric,start,'I cast Bless on Bram.',()=>0.5,hp);
 assert.equal(only.error,undefined,only.error);assert.equal(only.game.concentration.self,false);assert.equal(r.attackBoost(only.game,()=>0.5).amount,0);
 // Too many named for the slot.
 const crowd=cast(cleric,start,'I cast Heroism on me and Bram.',()=>0.5,hp);assert.match(crowd.error??'',/reaches one creature/);
 // Shield of Faith on Bram: +2 to his AC, seen on his device; it ends with the caster's concentration.
 const sof=cast(cleric,start,'I cast Shield of Faith on Bram.',()=>0.5,hp);
 assert.equal(sof.error,undefined,sof.error);
 const sofB=r.partyView({...viewA,game:sof.game,health:sof.health},'B');assert.equal(r.spellDefense(sofB.game,16).ac,18);assert.equal(r.spellDefense(sof.game,14).ac,14,'not the caster');
 const lost={...viewA,game:{...sof.game,concentration:undefined},health:sof.health};
 assert.equal(r.endSpellMarks(r.partyView(lost,'B').game).boons,undefined,'gone once the caster stops concentrating, from Bram\'s device too');
 // Heroism on Bram: temporary hit points at once and at the start of his turns.
 const hero2=cast(cleric,start,'I cast Heroism on Bram.',()=>0.5,hp);
 assert.equal(hero2.error,undefined,hero2.error);assert.equal(hero2.game.party.members.B.health.temp,3);
 const turnB=r.heroTurnBegins(bram,r.partyView({...viewA,game:hero2.game,health:hero2.health},'B').game,{current:20,temp:0});assert.equal(turnB.health.temp,3);
 // Guidance and Resistance on Bram: spent on his next check, and 1d4 off the damage type once a turn.
 const out=r.partyView({...viewA,game:{...start,stage:'inn'},health:hp},'A');
 const guide=cast(cleric,{...start,stage:'inn'},'I cast Guidance on Bram.',()=>0.5,hp);assert.equal(guide.error,undefined,guide.error);
 const guidedB=r.partyView({...out,game:guide.game},'B').game,used=r.guidanceBonus(guidedB,()=>0.5);assert.ok(used&&used.die>=1);assert.equal(used.game.boons,undefined,'spent on the check');
 const res=cast(cleric,start,'I cast Resistance on Bram against fire.',()=>0.5,hp);assert.equal(res.error,undefined,res.error);
 const resB=r.partyView({...viewA,game:res.game,health:res.health},'B').game,cut=r.resistedDamage(resB,'Fire',8,()=>0.5);assert.equal(cut.amount,5);
 assert.equal(r.resistedDamage(cut.game,'Fire',8,()=>0.5).amount,8,'once a turn');
 // Guidance on a companion is for the Dungeon Master to rule.
 const guideMara=cast(cleric,{...withMara(scenes(cleric).inn)},'I cast Guidance on Rusk.');assert.equal(guideMara.waiting,true);
 // Protection from Evil and Good on yourself against an undead foe: its attacks have disadvantage.
 // (Its holy water is used up, so the typed casting waits for the Dungeon Master to check it; once allowed it works so.)
 assert.equal(cast(cleric,{...start,stage:'inn'},'I cast Protection from Evil and Good.',()=>0.5,hp).waiting,true);
 const ward=r.requestSpell(cleric,{...start,stage:'inn'},hp,r.combatBasics(cleric).hp,{id:'protection-from-evil-and-good',slot:1,intent:'on myself',componentsConfirmed:true,allies:['self']},()=>0.5);assert.equal(ward.error,undefined,ward.error);
 same(r.wardEdge({...ward.game,stage:'combat',wildFight:{template:'skeleton',name:'Old Bones'}},'foe','h:A'),['Protection from Evil and Good']);
 same(r.wardEdge({...ward.game,stage:'combat',wildFight:{template:'bandit',name:'Salt Bandit'}},'foe','h:A'),[]);
 // Longstrider on two at a 2nd-level slot; it outlasts a fight, and a long rest ends it.
 const stride=cast(cleric,withMara({...scenes(cleric).inn}),'I cast Longstrider on me and Rusk using a level 2 slot.');
 assert.equal(stride.error,undefined,stride.error);assert.ok(stride.game.boons.mara&&stride.game.boons['h:hero']);
 assert.equal(r.adventureStep(stride.game,stride.health,cleric,'long-rest',()=>0.5).game.boons,undefined);
}

// ---------- Areas and many targets: the foe and the creature beside it ----------
{
 const wiz=hero('Wizard',5,['fire-bolt','light','fireball','sleep','hold-person','web','faerie-fire'],{scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:18,Wisdom:10,Charisma:10}});
 const fight=banditFight(wiz);
 const fb=cast(wiz,fight,'I cast Fireball at the bandit.',()=>0.3);
 assert.equal(fb.error,undefined,fb.error);assert.match(lines(fb),/Fireball also reaches the Snag|Fireball also reaches Snag/);
 assert.ok(fb.game.enemyHP<fight.enemyHP||fb.game.stage==='victory','the bandit burns');assert.ok((fb.game.foeAllies?.[0]?.hp??0)<fight.foeAllies[0].hp,'and so does the goblin beside it');
 const sleep=r.adventureStep(fight,null,wiz,r.dmCommand(wiz,fight,'I cast Sleep at the bandit.',null).action,()=>0.01);
 assert.equal(sleep.error,undefined,sleep.error);assert.ok(r.markOf(sleep.game,'foe').spells?.some(m=>m.cond==='asleep'));assert.ok(r.markOf(sleep.game,'ally:0').spells?.some(m=>m.cond==='asleep'),'the area catches the goblin too');
 const one=r.adventureStep(fight,null,wiz,r.dmCommand(wiz,fight,'I cast Hold Person at the bandit.',null).action,()=>0.01);
 assert.equal(one.error,undefined,one.error);assert.ok(r.markOf(one.game,'foe').spells?.some(m=>m.cond==='paralyzed'));assert.equal(r.markOf(one.game,'ally:0').spells,undefined,'one humanoid at 2nd level');
 const two=r.adventureStep(fight,null,wiz,r.dmCommand(wiz,fight,'I cast Hold Person at the bandit using a level 3 slot.',null).action,()=>0.01);
 assert.ok(r.markOf(two.game,'ally:0').spells?.some(m=>m.cond==='paralyzed'),'a second humanoid at 3rd level');
 // Fire burns the web away: the creature is free, and burns as its next turn begins.
 const webbed=r.adventureStep(fight,null,wiz,r.dmCommand(wiz,fight,'I cast Web at the bandit.',null).action,()=>0.01);
 assert.ok(r.markOf(webbed.game,'foe').spells?.some(m=>m.id==='web'&&m.cond==='restrained'));
 const burning=r.requestSpell(wiz,{...webbed.game,actionUsed:false,bonusUsed:false,slotSpentThisTurn:false},{current:30,temp:0},30,{id:'fire-bolt',slot:0,intent:'at the bandit',componentsConfirmed:true},()=>0.99,{...r.encounterFoe(wiz,webbed.game),name:'Salt Bandit'});
 assert.match(burning.logs.join(' '),/webs around the Salt Bandit catch fire/);assert.ok(r.markOf(burning.game,'foe').spells.some(m=>m.cond==='aflame'));
 const flames=r.lastingTurn(burning.game,'foe','start',{name:'The Salt Bandit',saves:{}},()=>0.5);assert.match(flames.lines.join(' '),/Web: The Salt Bandit takes \d+ Fire damage/);
 // Bane on up to three.
 const cleric=hero('Cleric',1,['sacred-flame','guidance','bane']),bf=banditFight(cleric);
 const bane=r.adventureStep(bf,null,cleric,r.dmCommand(cleric,bf,'I cast Bane at the bandit.',null).action,()=>0.01);
 assert.equal(bane.error,undefined,bane.error);assert.ok(['foe','ally:0'].every(k=>r.markOf(bane.game,k).spells?.some(m=>m.cond==='baned')));
 // In a brawl: Thunderwave at the keeper reaches Rusk too when both fight the hero.
 const sorc=hero('Sorcerer',3,['fire-bolt','light','thunderwave']),sc=scenes(sorc);
 const brawl={...sc.brawl,npcCombat:{...sc.brawl.npcCombat,order:[...sc.brawl.npcCombat.order.filter(n=>n.id!=='mara'),{id:'mara',side:'enemy',role:'attack',initiative:1}]}};
 const asked=r.dmCommand(sorc,brawl,'I cast Thunderwave at the keeper.',null);assert.equal(asked.error,undefined,asked.error);
 const done=r.commitDmTurn(sorc,brawl,null,{type:'ai-spell',request:asked.action.request,ruling:ZERO},{question:'I cast Thunderwave at the keeper.',narration:'x'},()=>0.01);
 assert.equal(done.error,undefined,done.error);assert.ok((done.game.npcHP?.mara??99)<r.npcProfile(brawl,'mara').maximumHP,'Rusk is caught in the thunder too');
 // Mass Healing Word reaches a hurt companion.
 const healer=hero('Cleric',5,['guidance','mass-healing-word']),hs=withMara(scenes(healer).inn),hurt={...hs,npcHP:{mara:2}};
 const mass=cast(healer,hurt,'I cast Mass Healing Word.',()=>0.5,{current:5,temp:0});
 assert.equal(mass.error,undefined,mass.error);assert.ok(mass.game.npcHP.mara>2,'the companion is healed too');assert.match(lines(mass),/also heals Rusk/);
}

// ---------- Spells that go on working ----------
{
 // Moonbeam: the creature in the light burns as its turn ends, every round, until concentration ends.
 const druid=hero('Druid',3,['druidcraft','guidance','moonbeam','heat-metal','flaming-sphere']),f=scenes(druid).fight;
 const beam=cast(druid,f,'I cast Moonbeam at the enemy.',()=>0.6);
 assert.equal(beam.error,undefined,beam.error);assert.equal(beam.game.concentration.target,'foe');assert.equal(beam.game.concentration.level,2);
 assert.match(lines(beam),/Moonbeam: The Vessa the Dry Hand ends its turn in it|Moonbeam: The .* ends its turn in it/,'the foe burns as its turn ends');
 assert.ok(saved(druid,beam));
 // Ending concentration ends it.
 const ended=r.adventureStep({...beam.game},beam.health,druid,{type:'end-concentration'},()=>0.5);assert.equal(ended.game.concentration,undefined);
 const after=r.adventureStep({...ended.game,potions:0},ended.health,druid,'dodge',()=>0.6);assert.match(lines(after),/attacks|Vessa/,'the foe has its turn');assert.doesNotMatch(lines(after),/Moonbeam/,'no light once concentration ends');
 // Moving the beam is an action on a later turn; the chip offers it.
 const later={...beam.game};const chips=r.quickActions(druid,later,beam.health).map(a=>a.key);
 assert.ok(chips.includes('again:foe'),'a chip to move the beam');
 const moved=r.adventureStep(later,beam.health,druid,'again:foe',()=>0.1);assert.equal(moved.error,undefined,moved.error);assert.match(lines(moved),/Moonbeam \(action\) on/);
 // Heat Metal: fire with no save, again as a bonus action on later turns (not on the turn it was cast).
 const heat=cast(druid,f,'I cast Heat Metal on Vessa the Dry Hand.',()=>0.3);
 assert.equal(heat.error,undefined,heat.error);assert.match(lines(heat),/glows red-hot/);
 const sameTurn=r.adventureStep({...heat.game,concentration:{...heat.game.concentration,fresh:true}},heat.health,druid,'again:foe',()=>0.3);assert.match(sameTurn.error??'',/later turn/);
 assert.equal(heat.game.concentration.fresh,undefined,'the casting turn is over once the foe has acted');
 const typed=r.dmCommand(druid,heat.game,'I heat the metal again.',heat.health);assert.equal(typed.action,'again:foe');
 const again=r.adventureStep(heat.game,heat.health,druid,typed.action,()=>0.3);
 assert.equal(again.error,undefined,again.error);assert.match(lines(again),/Heat Metal \(bonus action\)/);assert.ok(again.game.enemyHP<heat.game.enemyHP);
 assert.ok(again.game.bonusUsed||again.game.actionUsed===undefined,'a bonus action');
 assert.equal(r.turnCost(druid,heat.game,'again:foe'),'bonus');
 // Spiritual Weapon: strikes as it is cast, then as a bonus action on later turns.
 const cleric=hero('Cleric',3,['guidance','sacred-flame','spiritual-weapon','spirit-guardians']),cf=scenes(cleric).fight;
 const sw=cast(cleric,cf,'I cast Spiritual Weapon at the enemy.',()=>0.9);
 assert.equal(sw.error,undefined,sw.error);assert.equal(sw.game.concentration.fresh,true,'cast this turn');
 assert.match(r.adventureStep(sw.game,sw.health,cleric,'again:foe',()=>0.9).error??'',/later turn|bonus action is already used/);
 const turnOver=r.adventureStep(sw.game,sw.health,cleric,'end-turn',()=>0.5);
 const strike=r.adventureStep(turnOver.game,turnOver.health,cleric,r.dmCommand(cleric,turnOver.game,'I strike with my spiritual weapon.',turnOver.health).action,()=>0.9);
 assert.equal(strike.error,undefined,strike.error);assert.match(lines(strike),/Spiritual Weapon \(bonus action\) at .*Hit/);
 // Call Lightning: again as the Magic action, never with Action Surge's extra one.
 const druid5=hero('Druid',5,['druidcraft','guidance','call-lightning']),d5=scenes(druid5).fight;
 const storm=cast(druid5,d5,'I cast Call Lightning at the enemy.',()=>0.5);assert.equal(storm.error,undefined,storm.error);
 const ready={...storm.game};delete ready.concentration.fresh;
 assert.equal(r.turnCost(druid5,ready,'again:foe'),'action');
 const bolt=r.adventureStep(ready,storm.health,druid5,'again:foe',()=>0.2);assert.equal(bolt.error,undefined,bolt.error);assert.match(lines(bolt),/Call Lightning \(action\)/);
 assert.match(r.adventureStep({...ready,actionUsed:true},storm.health,druid5,'again:foe',()=>0.2).error??'',/already used your action/);
 // Spirit Guardians: every creature beside the hero burns as its turn ends (the goblin too).
 const cleric5=hero('Cleric',5,['guidance','sacred-flame','spirit-guardians']),gf=banditFight(cleric5);
 const guard=cast(cleric5,gf,'I cast Spirit Guardians.',()=>0.6);assert.equal(guard.error,undefined,guard.error);
 assert.match(lines(guard),/Spirit Guardians: The Salt Bandit ends its turn in it/);assert.match(lines(guard),/Spirit Guardians: The Snag ends its turn in it/);
 // Acid Arrow: more acid at the end of the creature's next turn, once.
 const wiz=hero('Wizard',3,['fire-bolt','light','acid-arrow']),wf=scenes(wiz).fight;
 const acid=cast(wiz,wf,'I cast Acid Arrow at the enemy.',seq([0.95,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5]));
 assert.equal(acid.error,undefined,acid.error);assert.match(lines(acid),/Acid Arrow: .* takes \d+ Acid damage/,'the later acid as its turn ends');
 assert.equal((r.markOf(acid.game,'foe').spells??[]).some(m=>m.cond==='acid'),false,'and only once');
 // Searing Smite: after a melee hit, the flames burn as each of its turns begins until it saves.
 const paladin=hero('Paladin',2,['searing-smite']),pf=scenes(paladin).fight;
 const smite=cast(paladin,{...pf,lastHit:{target:'foe'},actionUsed:true},'I cast Searing Smite.',()=>0.1);
 assert.equal(smite.error,undefined,smite.error);assert.match(lines(smite),/Searing Smite: .* Fire damage/);
 const burns=r.markOf(smite.game,'foe').spells?.find(m=>m.id==='searing-smite');assert.ok(burns,'the flames cling');
 const begun=r.lastingTurn(smite.game,'foe','start',{name:'The foe',saves:{Constitution:0}},()=>0.1);assert.match(begun.lines.join(' '),/keeps burning/);assert.ok(begun.game.enemyHP<smite.game.enemyHP);
 const out=r.lastingTurn(smite.game,'foe','start',{name:'The foe',saves:{Constitution:0}},()=>0.99);assert.match(out.lines.join(' '),/flames die out/);assert.equal(r.markOf(out.game,'foe').spells,undefined);
 // A lasting spell that drops the foe on its own turn wins the fight.
 const last={...beam.game,enemyHP:1,potions:0};delete last.concentration.fresh;
 const won=r.adventureStep(last,beam.health,druid,'dodge',()=>0.6);assert.equal(won.game.stage==='victory'||won.game.enemyHP===0,true,'the light finishes it');
 // At the shared table: Kara's Moonbeam burns the foe on the turn played from Bram's device, named for her.
 const bram=hero('Fighter',3,[],{name:'Bram Ironfist'}),party=table(druid,bram,beam.game,beam.health),fromB=r.partyView(party,'B');
 assert.equal(fromB.game.concentration,undefined,'Bram holds nothing');
 const burnt=r.lastingTurn(fromB.game,'foe','end',{name:'The foe',saves:{}},()=>0.3);assert.match(burnt.lines.join(' '),/Moonbeam \(Rule Druid\)/);
}

// ---------- More areas that go on working: Insect Plague, Wall of Fire, Black Tentacles, Vitriolic Sphere ----------
{
 const plays=[['Druid',9,'insect-plague',/Insect Plague: The Salt Bandit ends its turn in it/],['Wizard',7,'wall-of-fire',/Wall of Fire: The Snag ends its turn in it/],['Wizard',7,'black-tentacles',/Black Tentacles: The Salt Bandit ends its turn in it/],['Wizard',7,'vitriolic-sphere',/Vitriolic Sphere: The Salt Bandit takes \d+ Acid damage/]];
 for(const [cls,level,id,told] of plays){
  // (Both are given more hit points than they really have, so that they live to take the lasting damage.)
  const h=hero(cls,level,[id],{scores:{Strength:10,Dexterity:14,Constitution:16,Intelligence:18,Wisdom:18,Charisma:10}}),fight={...banditFight(h),potions:0,enemyHP:200,foeAllies:banditFight(h).foeAllies.map(a=>({...a,hp:200,maximum:200}))};
  const spell=r.spellLibrary.find(s=>s.id===id),step=cast(h,fight,'I cast '+spell.name+' at the bandit.',()=>0.05);
  assert.equal(step.error,undefined,id+': '+step.error);
  assert.match(lines(step),new RegExp(spell.name+' also reaches'),id+' catches the goblin too');
  assert.ok(step.game.foeAllies[0].hp<200&&step.game.enemyHP<200,id+' hurts both');
  assert.match(lines(step),told,id+' goes on working');
 }
}
// ---------- Hex and Hunter's Mark move as a bonus action once their creature drops ----------
{
 const lock=hero('Warlock',2,['eldritch-blast','hex']),fight=banditFight(lock);
 const hexed=cast(lock,fight,'I cast Hex at the goblin.',()=>0.5);
 assert.equal(hexed.error,undefined,hexed.error);assert.equal(hexed.game.concentration.target,'ally:0');
 // The goblin drops: the curse waits to be moved, and does nothing on the bandit meanwhile.
 const dropped={...hexed.game,foeAllies:hexed.game.foeAllies.map(a=>({...a,hp:0})),bonusUsed:false,actionUsed:false};
 const step=r.adventureStep(dropped,hexed.health,lock,'dodge',()=>0.5);
 assert.equal(step.game.concentration.lost,true);assert.equal(step.game.concentration.target,undefined);
 assert.equal(r.riderDamage(lock,step.game,'foe',false,()=>0.5).amount,0,'no free curse on the next creature hit');
 const chips=r.quickActions(lock,step.game,step.health);assert.ok(chips.some(c=>c.key==='move-mark:foe'),'a chip to move it');
 const typed=r.dmCommand(lock,step.game,'I move my hex to the bandit.',step.health);assert.equal(typed.action,'move-mark:foe');
 const moved=r.adventureStep(step.game,step.health,lock,typed.action,()=>0.5);
 assert.equal(moved.error,undefined,moved.error);assert.equal(moved.game.concentration.target,'foe');assert.match(lines(moved),/Hex moves to the Salt Bandit \(bonus action\)/);
 assert.ok(r.riderDamage(lock,moved.game,'foe',false,()=>0.5).amount>0);
 assert.match(r.dmCommand(lock,hexed.game,'I move my hex to the bandit.',hexed.health).error??'',/only once the creature it is on has dropped/);
 // A won fight: the next creature is not cursed for nothing.
 const after=r.markGone({...moved.game,stage:'victory',enemyHP:0});assert.equal(after.concentration.lost,true);
 assert.ok(saved(lock,{game:{...moved.game,concentration:after.concentration},health:moved.health}),'a curse waiting to move saves');
}

// ---------- Shield, by the device's choice; Counterspell and Feather Fall refused plainly ----------
{
 const wiz=hero('Wizard',1,['fire-bolt','light','mage-hand','shield','feather-fall']),f=scenes(wiz).fight;
 const game={...f,openingAttackAvailable:false},ac=r.combatBasics(wiz).ac;
 assert.ok(r.shieldReaction(wiz,game,ac+1,ac,false),'Shield rises when it saves the hero');
 assert.equal(r.shieldReaction({...wiz,autoShield:false},game,ac+1,ac,false),null,'unless the player turned it off on their device');
 assert.match(r.dmCommand(wiz,game,'I cast Feather Fall.',null).error,/No one is falling/);
 const sorc=hero('Sorcerer',5,['fire-bolt','light','counterspell']),sf=scenes(sorc).fight;
 assert.match(r.dmCommand(sorc,sf,'I cast Counterspell.',null).error,/cast none, so there is nothing to counter/);
}

// ---------- Saves ----------
{
 const cleric=hero('Cleric',3,['guidance','bless']),inn=scenes(cleric).inn;
 assert.ok(r.validAdventure(r.adventureSnapshot(cleric,clone({...inn,boons:{mara:[{id:'bless',by:'hero'}]},aided:{mara:5}}),null,true),cleric));
 assert.equal(r.validAdventure(r.adventureSnapshot(cleric,clone({...inn,boons:{mara:[{id:'fireball',by:'hero'}]}}),null,true),cleric),false,'only spells for friends');
 assert.ok(r.validAdventure(r.adventureSnapshot(cleric,clone({...inn,concentration:{id:'moonbeam',remaining:10,duration:'1 minute',level:2,dc:13,target:'foe',fresh:true}}),null,true),cleric));
 assert.ok(r.validAdventure(r.adventureSnapshot(cleric,clone({...inn,concentration:{id:'hex',remaining:600,duration:'1 hour',lost:true}}),null,true),cleric));
}
console.log('Passed: Aid raises hit points and the maximum for the hero, a companion and another hero until a long rest; Bless, Heroism, Shield of Faith, Guidance, Resistance, Protection from Evil and Good and Longstrider reach friends at the table and companions; areas and many-target spells catch the creatures beside the foe and the people in a brawl; Moonbeam, Heat Metal, Spiritual Weapon, Call Lightning, Spirit Guardians, Insect Plague, Wall of Fire, Black Tentacles, Vitriolic Sphere, Acid Arrow, Searing Smite and burning webs go on working; Hex moves as a bonus action once its creature drops; Shield follows the device\'s choice; Counterspell and Feather Fall are refused plainly; the saves hold it all.');
