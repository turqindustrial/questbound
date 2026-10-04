const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Spoils and magic items (lootRules.js): every won fight leaves something to search (a creature, a lair's owner and its
// hoard, a person, the tale's foe), once; the Loot chip and typed searches resolve it in the engine from tables by kind
// and level; the tale's foe always yields a magic item that suits the looter; and magic items really work in the rules
// (attack and damage, armor class for this hero and for the party, saves, checks, spell attacks, the wand, the
// draughts, the periapt). Saves stay valid, old ones still load, and a party's spoils are shared but its packs are not.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','descriptions.js','chronicleRules.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,freshStoryGame,adventureStep,commitDmTurn,dmCommand,dmContext,dmChoices,quickActions,validAdventure,adventureSnapshot,combatBasics,gearedHero,attackOptions,applyLoot,magicItems,magicItemIds,spoilsHere,takeSpoils,makeMagicItem,magicSuits,bossItem,attuneItem,withSpoils,startParty,joinParty,partyView,settleParty,canonicalParty,partyMembers,skillCheckBonus,itemDescription,actionDescription,actionCost,describeEvent,deedList,spoilNotes,masteryOf,foeHitExtras,deathSave,lootTier})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const plain=v=>JSON.parse(JSON.stringify(v));
const seq=list=>{let i=0;return ()=>list[i++%list.length];};
const rng=seed=>{let x=seed*7919+13;return ()=>(x=(x*16807)%2147483647)/2147483647;};
const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),pip=r.readyHero('rogue');
const big={current:80,temp:0};
// (Fights here are fought with plenty of hit points; a save is checked at the hero's own.)
const valid=(hero,g,h=null)=>r.validAdventure(r.adventureSnapshot(hero,plain(g),h&&h.current<=r.combatBasics(hero).hp?h:null,true),hero);
const camp=hero=>{const g={...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stage:'inn'};delete g.openingAttackAvailable;return g;};
const fight=(g,h,hero,action,random,n=40)=>{let last={game:g,health:h};for(let i=0;i<n&&last.game.stage==='combat';i++){const step=r.adventureStep(last.game,last.health,hero,typeof action==='function'?action(last.game):action,random);assert.equal(step.error,undefined,step.error);last={...step,health:step.health??last.health};}return last;};
const mainOf=hero=>r.attackOptions(hero)[0].name;

// ---- 1. Spoils are noted for every kind of win ----
// The Skirmish: its creature (here a bandit) falls at the bridge.
const skirmish=hero=>{const g=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);return g;};
let s=skirmish(kara);assert.equal(s.story.id,'hostile-encounter-bandit');
let won=fight(s,big,kara,'attack:'+mainOf(kara),()=>0.9);
assert.equal(won.game.stage,'victory');same(won.game.spoils,[{kind:'creature',template:'bandit',name:s.story.foe,place:'bridge'}],'the Skirmish foe can be searched where it fell');
assert.ok(valid(kara,won.game));
// The Loot choice and its chip appear at once, and only there.
const lootChoice=(hero,g,h=big)=>r.dmChoices(hero,g,h).find(c=>c.id==='loot');
assert.ok(lootChoice(kara,won.game),'the loot choice is offered after a win');
let chips=r.quickActions(kara,won.game,big);assert.equal(chips[0].key,'loot','the Loot chip leads the row after a win');assert.equal(chips[0].primary,true);
assert.match(r.actionDescription(chips[0],kara,won.game),/Search the fallen/);assert.equal(r.actionCost(chips[0],won.game),null);
// Determinism: the same dice give the same spoils (the DM preview and the commit agree).
const rolls=()=>seq([0.1,0.3,0.6,0.2,0.9,0.4,0.05]);
const a1=r.adventureStep(won.game,big,kara,{type:'loot'},rolls()),a2=r.adventureStep(won.game,big,kara,{type:'loot'},rolls());
same(a1.game.pack,a2.game.pack,'the same dice find the same things');
assert.match(a1.events[0],/^You search the /);assert.match(a1.events[1],/^Found: \d+ gold/);
const gold=a1.game.pack.gold-r.gearedHero(kara,won.game).equipment.totalGold;assert.ok(gold>=1*2+2&&gold<=12+2,'a bandit carries 2d6 + 2 per level gold at tier 1: '+gold);
assert.equal(a1.game.spoils,undefined,'searched once, the spoils are gone');assert.ok(valid(kara,a1.game));
assert.equal(lootChoice(kara,a1.game),undefined);assert.match(r.adventureStep(a1.game,big,kara,{type:'loot'},rolls()).error,/Nothing left to search here/);
// Through the Dungeon Master: the chip's action commits like any other, and the typed words find it too.
const chip=r.quickActions(kara,won.game,big).find(c=>c.key==='loot');
const committed=r.commitDmTurn(kara,won.game,big,chip.action,{question:chip.question,narration:'You kneel by the body and turn out its pockets.'},rolls());
assert.equal(committed.error,undefined,committed.error);same(committed.game.pack,a1.game.pack,'commit equals the preview');
same(r.dmCommand(kara,won.game,'I search the bandit\'s body',big),{action:{type:'loot'}});same(r.dmCommand(kara,won.game,'I loot him',big),{action:{type:'loot'}});
assert.equal(r.dmCommand(kara,a1.game,'I search the bandit\'s body',big),null,'with nothing left the words go to the Dungeon Master');
// Bandit spoils over many rolls: sometimes a scimitar, sometimes a draught; never more than the table allows.
let sawBlade=false,sawDraught=false;for(let i=0;i<40;i++){const rnd=rng(i+1);const l=r.adventureStep(won.game,big,kara,{type:'loot'},rnd);if(l.game.pack.items.some(it=>it.name==='Scimitar'))sawBlade=true;if(l.game.potions>won.game.potions)sawDraught=true;const got=l.game.pack.gold-kara.equipment.totalGold;assert.ok(got>=4&&got<=14,'bandit gold in range: '+got);}
assert.ok(sawBlade&&sawDraught,'a bandit sometimes carries a scimitar and a draught');
// Not during a fight, a spell waiting, or a party's turn order.
assert.equal(lootChoice(kara,{...won.game,stage:'combat'}),undefined);assert.equal(lootChoice(kara,{...won.game,pendingSpell:{id:'x'}}),undefined);
assert.equal(lootChoice(kara,{...won.game,turnOrder:{order:[],at:0,round:1}}),undefined);assert.equal(lootChoice(kara,{...won.game,npcCombat:{active:true,order:[]}}),undefined);
// Only where they fell: at the inn the bandit's body is not here.
assert.equal(lootChoice(kara,{...won.game,stage:'inn'}),undefined);

// A lair: the Grey Widow and her hoard, the place's feature named.
let g0=camp(kara);
const lair={name:'Widow Hollow',description:'A dripping hollow strung with grey silk and the husks of deer.',kind:'cave',bearing:'E',miles:1,travel:true,danger:'lair',feature:'A half-buried satchel lies under the webs.',lair:{template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled, with a pale cross on its back.'}};
let found=r.adventureStep(g0,big,kara,{type:'discover',place:lair,travel:true},()=>0.5);assert.equal(found.error,undefined);
let widow=fight(found.game,big,kara,'attack:'+mainOf(kara),()=>0.85);
assert.equal(widow.game.stage,'wild');same(widow.game.spoils,[{kind:'creature',template:'spider',name:'Grey Widow',place:'p1',lair:true,feature:'A half-buried satchel lies under the webs.'}],'a lair win leaves the creature and its lair');
assert.ok(valid(kara,widow.game));assert.ok(lootChoice(kara,widow.game));
same(r.dmContext(kara,widow.game,big).spoils,[{name:'Grey Widow',kind:'creature',what:'Giant spider',lair:true,feature:'A half-buried satchel lies under the webs.'}],'the Dungeon Master is told what lies here unsearched');
let lw=r.adventureStep(widow.game,big,kara,{type:'loot'},seq([0.2,0.1,0.5,0.7]));
assert.equal(lw.error,undefined);assert.match(lw.events[0],/^You search the Grey Widow and its lair \(A half-buried satchel lies under the webs\)\.$/);
assert.ok(lw.game.pack.items.some(i=>i.name==='Spider silk')&&lw.game.pack.items.some(i=>['Small garnet','Silver chalice'].includes(i.name)),'a spider yields silk, the lair a gem or a cup');
assert.ok(lw.game.pack.gold>kara.equipment.totalGold,'the hoard holds coin');assert.ok(valid(kara,lw.game));
// A dire wolf: pelt and fangs and no coin.
const wolfGame={...widow.game,spoils:[{kind:'creature',template:'wolf',name:'Starving Dire Wolf',place:'p1'}]};
let lwf=r.adventureStep(wolfGame,big,kara,{type:'loot'},()=>0.5);assert.equal(lwf.game.pack.gold,kara.equipment.totalGold,'beasts carry no coin');
same(lwf.game.pack.items.map(i=>i.name).sort(),['Dire wolf pelt','Wolf fangs']);
// A goblin pack: three of them, searched together.
const goblins={...widow.game};delete goblins.spoils;
let gob=r.adventureStep(goblins,big,kara,{type:'ambush',foe:{template:'goblin',name:'Goblin Raider',appearance:'A wiry goblin with a jagged grin and a dented helmet.'}},()=>0.5);
assert.equal(gob.error,undefined,gob.error);gob=fight(gob.game,big,kara,'attack:'+mainOf(kara),()=>0.85);
assert.equal(gob.game.spoils.at(-1).count,3,'a pack is searched as one, all three members');
// A creature at the leader's side: searched only when it was slain, not when it ran.
const hound={template:'wolf',name:'War Hound',appearance:'A lean, scarred hound in a spiked leather collar.'};
const bandits={name:'Cutthroat Hollow',description:'A bandit camp in a ravine, smoke and bones.',kind:'camp',bearing:'W',miles:1,danger:'lair',feature:null,lair:{template:'bandit',name:'Red Maddock',appearance:'A rangy bandit with a red scarf and a notched cutlass.',ally:hound}};
let camp2=r.adventureStep(camp(kara),big,kara,{type:'discover',place:bandits,travel:true},()=>0.5).game;
// Kill the hound first, then the leader.
let both=fight(camp2,big,kara,g=>g.foeAllies?.[0]?.hp>0?{type:'encounter-attack',weapon:mainOf(kara),target:'ally:0'}:'attack:'+mainOf(kara),()=>0.85);
assert.ok(both.game.spoils.some(e=>e.name==='War Hound'&&e.ally===true&&e.template==='wolf'),'a slain hound can be searched');
let fled=fight(r.adventureStep(camp(kara),big,kara,{type:'discover',place:bandits,travel:true},()=>0.5).game,big,kara,'attack:'+mainOf(kara),()=>0.85);
assert.ok(fled.game.spoils.some(e=>e.name==='Red Maddock')&&!fled.game.spoils.some(e=>e.name==='War Hound'),'a hound that scattered leaves nothing behind');
// A person: killing Mara leaves her to be searched.
let inn=camp(kara);
let slay={game:inn,health:big};for(let i=0;i<12&&!slay.game.npcFate?.mara;i++){const act=slay.game.npcCombat?.active?{type:'npc-attack',target:'mara',weapon:mainOf(kara)}:{type:'npc-attack',target:'mara',weapon:mainOf(kara)};const st=r.adventureStep(slay.game,slay.health,kara,act,()=>0.95);assert.equal(st.error,undefined,st.error);slay={...st,health:st.health??slay.health};}
assert.equal(slay.game.npcFate.mara,'dead');assert.ok(slay.game.spoils.some(e=>e.kind==='person'&&e.person==='mara'),'a person who fell to the hero can be searched');assert.ok(valid(kara,slay.game,slay.health));
const ml=r.adventureStep({...slay.game,npcCombat:undefined},slay.health,kara,{type:'loot'},()=>0.1);assert.equal(ml.error,undefined,ml.error);assert.ok(ml.events[1].startsWith('Found: '));

// The tale's own foe: always one magic item that suits the looter.
// The written tale of verify-chapters.cjs (its foe is the tale's main foe), borrowed as it stands.
const chaptersSource=fs.readFileSync('verify-chapters.cjs','utf8');
const story=vm.runInNewContext(chaptersSource.slice(chaptersSource.indexOf('const person='),chaptersSource.indexOf('const fresh='))+';written');
const tale=hero=>r.freshStoryGame(hero,plain(story),r.newAdventure(hero));
let t=tale(kara);assert.ok(valid(kara,t),'the tale fixture is valid');
const atBoss=g=>({...g,stage:'bridge'});
let boss=r.adventureStep(atBoss(t),big,kara,'approach',()=>0.5);assert.equal(boss.error,undefined,boss.error);
boss=fight(boss.game,big,kara,'attack:'+mainOf(kara),()=>0.9,80);assert.equal(boss.game.stage,'victory');
same(boss.game.spoils,[{kind:'boss',name:story.foe,place:'bridge'}],'the tale\'s foe can be searched');
const bossLoot=(hero,g,rnd=()=>0.3)=>r.adventureStep(g,big,hero,{type:'loot'},rnd);
let bl=bossLoot(kara,boss.game);assert.equal(bl.error,undefined,bl.error);
const magicOf=g=>g.pack.items.filter(i=>i.magic&&i.kind!=='potion');
assert.equal(magicOf(bl.game).length,1,'the tale\'s foe always yields one magic item');assert.ok(bl.events.some(t=>t.startsWith('Among the hoard: ')));
assert.ok(bl.game.pack.items.some(i=>i.name==='Engraved silver armband'),'and a treasure for the tier');assert.ok(valid(kara,bl.game));
// Over many searches: a Wizard never gets a magic weapon; a Fighter in chain mail can get magic chain mail (once the
// tier allows rare); an unarmoured Wizard can get Bracers of Defense.
const bossFor=hero=>({...tale(hero),stage:'victory',enemyHP:0,foeFate:'slain',map:boss.game.map,spoils:[{kind:'boss',name:story.foe,place:'bridge'}]});
const many=(hero,level,n=60)=>{const h={...hero,level},ids=new Set();for(let i=0;i<n;i++){const rnd=rng(i+101);const l=r.adventureStep(bossFor(h),big,h,{type:'loot'},rnd);assert.equal(l.error,undefined,l.error);for(const it of magicOf(l.game)){ids.add(it.magic.id);assert.ok(r.magicSuits(it.magic.id,r.gearedHero(h,bossFor(h)))||it.magic.id==='cloak-of-protection','suits '+h.class+': '+it.magic.id);}assert.ok(valid(h,l.game,null),'valid at level '+level);}return ids;};
const wiz=many(ilyra,1);assert.ok(![...wiz].some(id=>id.startsWith('weapon+')),'a Wizard never gets a magic weapon');
const fighter6=many(kara,6);assert.ok(fighter6.has('armor+1'),'a Fighter in chain mail can get Chain Mail +1 at tier 2: '+[...fighter6]);
const robed=many(ilyra,6);assert.ok(robed.has('bracers-of-defense'),'an unarmoured hero (the Wizard) can get Bracers of Defense: '+[...robed]);assert.ok(![...robed].some(id=>id.startsWith('weapon+')||id.startsWith('armor+')));
for(const id of many(kara,1))assert.equal(r.magicItems[id].rarity,'uncommon','tier 1 rewards are uncommon');
// The story writer's hoard is used when its rarity fits the tier, with its own name and note.
const hoarded={...bossFor(kara),story:{...bossFor(kara).story,hoard:{item:'cloak-of-protection',name:'Varek\'s Ashen Mantle',note:'A grey cloak that smells faintly of woodsmoke.'}}};
const hl=r.adventureStep(hoarded,big,kara,{type:'loot'},()=>0.3);const mantle=hl.game.pack.items.find(i=>i.magic?.id==='cloak-of-protection');
same([mantle.name,mantle.note,mantle.attuned],['Varek\'s Ashen Mantle','A grey cloak that smells faintly of woodsmoke.',true],'the writer\'s hoard, attuned at once');assert.ok(valid(kara,hl.game));
const tooRare={...hoarded,story:{...hoarded.story,hoard:{item:'ring-of-protection',name:'The Ember Ring',note:'A ring of dark iron.'}}};
assert.ok(!r.adventureStep(tooRare,big,kara,{type:'loot'},()=>0.3).game.pack.items.some(i=>i.name==='The Ember Ring'),'a rare hoard waits for tier 2');

// ---- 6. Magic works in the engine ----
const withItems=(g,items)=>({...g,pack:{gold:10,items,spent:{}}});
const sword=r.makeMagicItem('weapon+1',kara,{base:'Greatsword'});same([sword.name,sword.base,sword.magic],['Greatsword +1','Greatsword',{id:'weapon+1',plus:1}]);
let mg=withItems(skirmish(kara),[sword]);assert.ok(valid(kara,mg));
const geared=r.gearedHero(kara,mg),opts=r.attackOptions(geared);
assert.equal(opts[0].name,'Greatsword +1','the magic weapon leads');assert.equal(opts[0].attackBonus,opts.find(w=>w.name==='Greatsword').attackBonus+1);
assert.equal(r.masteryOf(geared,opts[0]),'Graze','mastery is of the kind: a magic greatsword grazes');
const hit=r.adventureStep(mg,big,kara,'attack:Greatsword +1',seq([0.5,0.5,0.5,0.5,0.5,0.5]));assert.equal(hit.error,undefined,hit.error);
const line=hit.events.find(t=>t.startsWith('You use Greatsword +1'));assert.match(line,/\+ 2 proficiency \+ 1 magic = /,'the attack line shows the magic');
const dmg=hit.events.find(t=>/slashing damage \(/.test(t));assert.match(dmg,/\+ 1 magic\)/);
const plainHit=r.adventureStep(skirmish(kara),big,kara,'attack:Greatsword',seq([0.5,0.5,0.5,0.5,0.5,0.5]));
const total=t=>Number(t.match(/= (\d+) vs AC/)[1]),dealt=t=>Number(t.match(/^(\d+) /)[1]);
assert.equal(total(line),total(plainHit.events.find(t=>t.startsWith('You use Greatsword'))) +1,'one higher to hit');
assert.equal(dealt(dmg),dealt(plainHit.events.find(t=>/slashing damage \(/.test(t)))+1,'one more damage');
assert.ok(r.describeEvent({text:line,kind:'roll'}),'the chronicle reads the magic attack line');
// Armor class: a Ring of Protection +1; Bracers only with no armour and no shield.
const ac=(hero,g)=>r.combatBasics(r.gearedHero(hero,g)).ac,baseAc=r.combatBasics(kara).ac;
const ring=r.makeMagicItem('ring-of-protection',kara);let ringed=withItems(skirmish(kara),[{...ring,attuned:true}]);
assert.equal(ac(kara,ringed),baseAc+1,'a Ring of Protection adds 1');assert.match(r.combatBasics(r.gearedHero(kara,ringed)).acFormula,/\+1 Ring of Protection/);
assert.equal(ac(kara,withItems(skirmish(kara),[{...ring}])),baseAc,'not until it is attuned');
const bracers={...r.makeMagicItem('bracers-of-defense',ilyra),attuned:true};
assert.equal(ac(kara,withItems(skirmish(kara),[bracers])),baseAc,'bracers do nothing over chain mail');
assert.equal(ac(ilyra,withItems(skirmish(ilyra),[bracers])),r.combatBasics(ilyra).ac+2,'and +2 with no armour');
const mail=r.makeMagicItem('armor+1',kara);assert.equal(mail.name,'Chain Mail +1');assert.equal(ac(kara,withItems(skirmish(kara),[mail])),baseAc+1,'magic chain mail adds 1');
// Saves: a Cloak of Protection helps against the dire wolf's Knockdown.
const cloak={...r.makeMagicItem('cloak-of-protection',kara),attuned:true};
const wolfFight={...skirmish(kara),story:{...skirmish(kara).story,id:'hostile-encounter-wolf'}};
const knock=(g)=>r.foeHitExtras(g,r.gearedHero(kara,g),{name:'Wolf'},1,()=>0.4).lines[0];
assert.match(knock(withItems(wolfFight,[])),/\+ 3 = 12 vs DC 13/);assert.match(knock(withItems(wolfFight,[cloak])),/\+ 4 = 13 vs DC 13\. Success/,'the cloak lifts the save');
// Checks: a Stone of Good Luck adds 1; Boots of Elvenkind give advantage on Stealth.
const stone={...r.makeMagicItem('stone-of-good-luck',pip),attuned:true},boots=r.makeMagicItem('boots-of-elvenkind',pip);
const lucky=withItems(camp(pip),[stone,boots]);
assert.equal(r.skillCheckBonus(r.gearedHero(pip,lucky),lucky,'Wisdom','Perception').total,r.skillCheckBonus(pip,lucky,'Wisdom','Perception').total+1);
const check={type:'ai-check',check:{ability:'Dexterity',skill:'Stealth',dc:12,mode:'normal',reason:'Slip past the sentry',success:'You pass unseen.',failure:'A shout goes up.',damageOn:'none',damageCount:0,damageDie:4}};
const checked=r.commitDmTurn(pip,lucky,big,check,{question:'I sneak past the sentry.',narration:'You hold your breath.'},seq([0.1,0.9]));
assert.equal(checked.error,undefined,checked.error);assert.match(checked.events[0],/d20 \[3, 19\]/,'boots of elvenkind: advantage on Stealth');assert.match(checked.events[0],/\+ 1 magic/,'and the stone adds 1');
// Spell attacks: a Wand of the War Mage +1 adds to Fire Bolt.
const war={...r.makeMagicItem('wand-of-the-war-mage+1',ilyra),attuned:true};
const bolt=g=>{const cmd=r.dmCommand(ilyra,g,'I cast Fire Bolt at the bandit',big);assert.ok(cmd?.action,'Fire Bolt parses');const st=r.adventureStep(g,big,ilyra,cmd.action,()=>0.5);assert.equal(st.error,undefined,st.error);return st.events.find(t=>t.startsWith('Fire Bolt'));};
const plainBolt=bolt(skirmish(ilyra)),warBolt=bolt(withItems(skirmish(ilyra),[war]));
assert.equal(total(warBolt),total(plainBolt)+1,'the wand adds 1 to the spell attack');assert.match(warBolt,/\+ 1 magic/);
// The Wand of Magic Missiles: three darts of 1d4 + 1, a charge spent; a long rest brings 1d6 + 1 back (at most 7).
const wand=r.makeMagicItem('wand-of-magic-missiles',kara);let wg=withItems({...skirmish(kara),openingAttackAvailable:false},[{...wand,magic:{...wand.magic,charges:2}}]);
assert.ok(r.dmChoices(kara,wg,big).some(c=>c.id==='item:wand-of-magic-missiles'));const wandChip=r.quickActions(kara,wg,big).find(c=>c.key==='item:wand-of-magic-missiles');assert.equal(wandChip.detail,'2 charges');
assert.equal(r.actionCost(wandChip,wg),'Action');assert.match(r.actionDescription(wandChip,kara,wg),/three darts/);
const zap=r.adventureStep(wg,big,kara,'item:wand-of-magic-missiles',()=>0.5);assert.equal(zap.error,undefined,zap.error);
const zapLine=zap.events.find(t=>t.startsWith('Wand of Magic Missiles'));assert.match(zapLine,/\[3, 3, 3\] \+ 3 = 12 force damage\. 1 charge left\./);
assert.equal(zap.game.enemyHP,wg.enemyHP-12,'the darts never miss');assert.ok(valid(kara,zap.game,zap.health));
same(r.dmCommand(kara,wg,'I use my wand on it',big),{action:'item:wand-of-magic-missiles'});
const rested=r.adventureStep({...withItems(camp(kara),[{...wand,magic:{...wand.magic,charges:1}}])},{current:5,temp:0},kara,'long-rest',()=>0.5);
assert.equal(rested.game.pack.items[0].magic.charges,6,'1 + 1d6 [4] + 1');
const full=r.adventureStep(withItems(camp(kara),[wand]),{current:5,temp:0},kara,'long-rest',()=>0.99);assert.equal(full.game.pack.items[0].magic.charges,7,'never more than 7');
// The last charge may crumble it.
const last=r.adventureStep(withItems({...skirmish(kara),openingAttackAvailable:false},[{...wand,magic:{...wand.magic,charges:1}}]),big,kara,'item:wand-of-magic-missiles',seq([0.5,0.5,0.5,0]));
assert.ok(last.events.some(t=>/crumbles to ash/.test(t)));assert.equal(last.game.pack.items.length,0);
// A Potion of Greater Healing: 4d4 + 4 as a bonus action in a fight.
const greater={name:'Potion of Greater Healing',kind:'potion',qty:1,magic:{id:'potion-greater-healing'}};
let pg=withItems({...skirmish(kara),openingAttackAvailable:false},[greater]);
assert.ok(r.dmChoices(kara,pg,{current:3,temp:0}).some(c=>c.id==='drink:potion-greater-healing'),'offered when hurt');assert.ok(!r.dmChoices(kara,pg,big).some(c=>c.id==='drink:potion-greater-healing'),'not when whole');
const drinkChip=r.quickActions(kara,pg,{current:3,temp:0}).find(c=>c.key==='drink:potion-greater-healing');assert.equal(drinkChip.detail,'Bonus');assert.equal(r.actionCost(drinkChip,pg),'Bonus action');assert.match(r.actionDescription(drinkChip,kara,pg),/4d4 \+ 4/);
const drunk=r.adventureStep(pg,{current:3,temp:0},kara,'drink:potion-greater-healing',()=>0);assert.equal(drunk.error,undefined,drunk.error);
assert.equal(drunk.health.current,3+4+4,'4d4 [1,1,1,1] + 4');assert.ok(drunk.events.some(t=>t==='Greater healing draught: 4d4 [1, 1, 1, 1] + 4; restored 8 HP.'));
assert.equal(drunk.game.pack.items.length,0);assert.equal(drunk.game.stage,'combat','a bonus action: the turn goes on');assert.equal(drunk.game.bonusUsed,true);
same(r.dmCommand(kara,pg,'I drink the potion of greater healing',{current:3,temp:0}),{action:'drink:potion-greater-healing'});
// Away from a fight too.
const calm=r.adventureStep(withItems(camp(kara),[greater]),{current:3,temp:0},kara,'drink:potion-greater-healing',()=>0);assert.equal(calm.health.current,11);
// The Periapt of Wound Closure stabilises a dying hero.
const periapt={...r.makeMagicItem('periapt-of-wound-closure',kara),attuned:true};
const dyingGame={...withItems(camp(kara),[periapt]),stage:'dying',dying:{successes:0,failures:0,place:'inn',placeName:'the inn',cause:'Struck down.'}};
const saved=r.adventureStep(dyingGame,{current:0,temp:0},kara,'death-save',()=>0.05);assert.equal(saved.error,undefined,saved.error);
assert.equal(saved.game.stage,'inn');assert.equal(saved.health.current,1);assert.ok(saved.events.some(t=>/Periapt of Wound Closure/.test(t)));
// A death save gains the cloak's +1 (a natural 1 is still two failures).
same(r.deathSave({stage:'dying',dying:{successes:0,failures:0,place:'inn'}},null,()=>0.42,{bonus:1}).events,['Death saving throw: d20 [9] + 1 = 10 vs DC 10. Success. Successes 1, failures 0.']);

// The feed reads the engine's own lines: the attack with its magic, the search, what was found, a magic item.
{const kindOf=t=>/initiative|turn order/i.test(t)?'initiative':/d20|\bd\d+\b|save |damage|\bHP\b/i.test(t)?'roll':'action',card=t=>r.describeEvent({text:t,kind:kindOf(t)});
 const swing=card(line);assert.equal(swing.type,'roll');assert.equal(swing.verdict,'hit');assert.match(swing.math,/\+ 1 magic = /);
 assert.equal(card(dmg).type,'damage');same([card(lw.events[0]).type,card(lw.events[1]).type],['search','found']);assert.ok(card(lw.events[1]).items.includes('Spider silk (worth 6 gold)'));
 const gem=card(bl.events.find(t=>t.startsWith('Among the hoard: ')));assert.equal(gem.type,'treasure');assert.equal(gem.rarity,'uncommon');
 same(card(drunk.events.find(t=>/Greater healing draught/.test(t))),{type:'heal',title:'Greater healing draught',amount:8});}
// A deed for carrying off a magic item.
assert.ok(r.deedList.some(d=>d.id==='treasure-hunter'&&d.earned({game:bl.game,hero:kara,log:[]})),'Treasure Hunter: a magic item carried off');
// The Dungeon Master's server and the story writer keep their own copies of the catalogue's ids: they must agree.
{const dm=fs.readFileSync('dm-server.cjs','utf8'),rarity=vm.runInNewContext('('+dm.match(/const magicRarity=(\{[^}]+\})/)[1]+')');
 same(Object.entries(rarity).sort(),r.magicItemIds.map(id=>[id,r.magicItems[id].rarity]).sort(),'dm-server.cjs magicRarity matches lootRules.js');
 const gen=fs.readFileSync('adventure-generator.cjs','utf8'),hoard=vm.runInNewContext(gen.match(/const hoardItems=(\[[^\]]+\])/)[1]);
 same(hoard,r.magicItemIds.filter(id=>!r.magicItems[id].heal),'the story writer offers every non-draught item');}
// ---- 7. Validators ----
const bad=items=>!valid(kara,withItems(camp(kara),items));
assert.ok(bad([1,2,3,4].map(n=>({...r.makeMagicItem('cloak-of-protection',kara),name:'Cloak '+n,attuned:true}))),'four attuned items are refused');
assert.ok(bad([{...wand,magic:{...wand.magic,charges:8}}]),'eight charges are refused');
assert.ok(bad([{name:'Odd Thing',kind:'gear',qty:1,magic:{id:'amulet-of-health'}}]),'an unknown magic item is refused');
assert.ok(bad([{name:'Potion of Healing',kind:'potion',qty:1}]),'an ordinary draught is not kept in the pack');
assert.ok(!valid(kara,{...camp(kara),spoils:Array.from({length:7},()=>({kind:'creature',template:'wolf',name:'Wolf',place:'inn'}))}),'more than six spoils are refused');
assert.ok(!valid(kara,{...camp(kara),spoils:[{kind:'person',person:'n9',name:'Nobody',place:'inn'}]}),'a person who does not exist is refused');
assert.ok(valid(kara,{...camp(kara),wield:'Greatsword +1',pack:{gold:1,items:[sword],spent:{}}}),'a magic weapon can be taken in hand');
// An old save: a plain pack, no spoils, a story without a hoard.
const old=tale(kara);delete old.spoils;old.pack={gold:5,items:[{name:'Longsword',kind:'weapon',qty:1},{name:'Silver locket',kind:'treasure',qty:1,value:15}],spent:{Arrow:2}};
assert.ok(valid(kara,old),'an old save still loads');assert.equal(old.story.hoard,undefined);
// Attunement from the inventory: the oldest attuned item gives way to a fourth.
const three=withItems(camp(kara),['cloak-of-protection','ring-of-protection','stone-of-good-luck'].map(id=>({...r.makeMagicItem(id,kara),attuned:true})).concat([r.makeMagicItem('periapt-of-wound-closure',kara)]));
const att=r.attuneItem(three,kara,'Periapt of Wound Closure');assert.equal(att.error,undefined);assert.equal(att.game.pack.items.filter(i=>i.attuned).length,3);assert.ok(!att.game.pack.items.find(i=>i.name==='Cloak of Protection').attuned);assert.ok(valid(kara,att.game));
// Descriptions: every magic item and every spoil has its own words.
for(const id of r.magicItemIds){const it=r.makeMagicItem(id,id.startsWith('armor+')?kara:id.startsWith('shield+')?r.readyHero('cleric'):kara);assert.ok(it,id);const d=r.itemDescription(it.name,it.kind,it.note??null,it);assert.ok(d.length>30&&!/^(A weapon you can fight with|Useful gear|Part of your kit)/.test(d),id+': '+d);}
assert.match(r.itemDescription('Greatsword +1','weapon',null,sword),/\+1 to attack and damage/);
for(const [name] of Object.entries(r.spoilNotes))assert.ok(r.itemDescription(name,'treasure',r.spoilNotes[name]).length>10);

// ---- 8. A party: the spoils are shared, the pack is the looter's own ----
{
 const fightA=skirmish(kara),maxA=r.combatBasics(kara).hp;
 const hosted=r.startParty(r.adventureSnapshot(kara,{...fightA,pack:{gold:5,items:[ring].map(i=>({...i,attuned:true})),spent:{}}},{current:maxA,temp:0},true),'A','Sam');
 const joined=r.joinParty(hosted,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'}).snapshot;
 const viewB=joined;assert.equal(viewB.game.party.members.A.stats.ac,baseAc+1,'foes strike Kara against her ring too');
 const viewA=r.partyView(viewB,'A');
 // Kara wins; the spoils are written to the shared world.
 const winGame={...viewA.game,stage:'victory',enemyHP:0,foeFate:'slain',spoils:[{kind:'creature',template:'bandit',name:'Bandit Cutthroat',place:'bridge'}]};delete winGame.turnOrder;
 const afterA={...viewA,game:winGame};assert.ok(r.validAdventure(plain(afterA),kara),'a party with spoils is valid');
 const asB=r.partyView(afterA,'B');assert.ok(r.spoilsHere(asB.game).length===1,'Jo sees the same spoils');
 const looted=r.adventureStep(asB.game,asB.health,ilyra,{type:'loot'},()=>0.2);assert.equal(looted.error,undefined,looted.error);
 const afterB={...asB,game:looted.game};assert.ok(r.validAdventure(plain(afterB),ilyra));
 const backA=r.partyView(afterB,'A');assert.equal(backA.game.spoils,undefined,'the spoils are gone for everyone');
 same(backA.game.pack,afterA.game.pack,'Kara\'s pack is untouched');assert.notEqual(JSON.stringify(looted.game.pack),JSON.stringify(asB.game.pack),'Jo\'s pack holds the finds');
 assert.equal(r.canonicalParty(backA),r.canonicalParty(afterB),'every point of view settles to the same table');
}
console.log('Loot: spoils for every kind of win (Skirmish, lair, pack, the creature at its side, a person, the tale\'s foe), searched once from tables by kind and level, magic that works (attack, damage, mastery, armor class for the hero and the party, saves, checks, spell attacks, the wand, the draughts, the periapt), valid saves (old ones too), and shared spoils with private packs at the table.');
