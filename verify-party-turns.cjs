const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// A party's fight in turns (adventureStep in adventureRules.js): the first move is anyone's; then every standing hero
// and the foe roll initiative, each hero acts only on their own turn (from their own device), the foe acts once a
// round at its place against any standing hero, a hero who took the Dodge is harder to hit until their next turn, a
// spent action survives another device's write, a hero who is down rolls their death save on their turn, an absent
// player's turn can be passed, a hero who joins mid-fight takes the last place, a brawl with people goes the same way,
// and a won fight ends the order. Every device's view stays a valid save throughout.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,hostileFoes,newAdventure,adventureStep,validAdventure,adventureSnapshot,combatBasics,startParty,joinParty,partyView,settleParty,canonicalParty,turnOrderView,dmChoices,dmContext,quickActions,spellActions,dmCommand,attackOptions,freshStoryGame,commitDmTurn})',{AsyncStorage:{}});
const plain=v=>JSON.parse(JSON.stringify(v));
// Seeds spread over the generator's range (a small seed's first draws are all near 0).
const seeded=seed=>{let s=(seed*48271+12345)%2147483647;return ()=>(s=(s*16807)%2147483647)/2147483647;};
const always=v=>()=>v;
const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),wren=r.readyHero('rogue'),brother=r.readyHero('cleric');
const heroes={A:kara,B:ilyra,C:wren,D:brother};
const pick=key=>()=>(r.hostileFoes.findIndex(f=>f.key===key)+.5)/r.hostileFoes.length;
let table;
const view=id=>r.partyView(table,id);
const valid=id=>r.validAdventure(plain(view(id)),heroes[id]);
const allValid=(why)=>{for(const id of Object.keys(table.game.party.members))assert.ok(valid(id),why+': '+id+'’s view is a valid save');};
const act=(id,action,random=Math.random)=>{const v=view(id),res=r.adventureStep(v.game,v.health,heroes[id],action,random);if(!res.error)table=plain(r.adventureSnapshot(heroes[id],res.game,res.health,true));return res;};
const turn=()=>r.turnOrderView(view('A').game);
const holder=()=>turn()?.current?.id??null;
const main=id=>'attack:'+r.attackOptions(heroes[id])[0].name;
// A whole turn: the action, then End turn if a bonus action is still waiting.
const takeTurn=(id,action,random)=>{const first=act(id,action,random);if(first.error||holder()!==id||!view(id).game.actionUsed)return first;const end=act(id,'end-turn',random);return {...end,events:[...first.events,...(end.events??[])]};};
const weaponOf=id=>r.attackOptions(heroes[id])[0].name;
// A party of three in a fight with a bandit, before anyone has moved.
function startTable(foe='bandit'){
 const fight=r.hostileEncounterGame(kara,r.newAdventure(kara),pick(foe));
 let snap=r.startParty(r.adventureSnapshot(kara,fight,{current:r.combatBasics(kara).hp,temp:0},true),'A','Sam');
 snap=r.joinParty(snap,'B',{character:JSON.stringify(ilyra),game:null,health:null,name:'Jo'}).snapshot;
 snap=r.joinParty(snap,'C',{character:JSON.stringify(wren),game:null,health:null,name:'Ash'}).snapshot;
 table=plain(snap);
}
startTable();
assert.equal(table.game.turnOrder,undefined,'no order before the first move');
allValid('at the start');

// ---- The first move is anyone's; then everyone rolls initiative ----
const opening=act('B',main('B'),seeded(11));
assert.ok(!opening.error,opening.error);
const t0=table.game.turnOrder;assert.ok(t0,'initiative is rolled once the first move is made');
assert.deepEqual(t0.order.map(e=>e.id).sort(),['A','B','C','foe'],'every hero and the foe have a place');
for(const h of [kara,ilyra,wren])assert.ok(opening.events.some(e=>e.startsWith(h.name+' initiative: d20')),h.name+' rolled initiative');
assert.ok(opening.events.some(e=>/^Turn order: .+ → .+ → .+ → .+\.$/.test(e))&&opening.events.includes('Round 1 begins.'));
assert.ok(opening.events[0]==='Opening attack.','the opening attack comes first');
assert.equal(turn().current.kind,'hero','the turn rests with a hero, never the foe');
assert.ok(opening.events[opening.events.length-1]===r.turnOrderView(view('A').game).current.name+'’s turn.','the feed says whose turn it is');
allValid('after initiative');
// The same table from every point of view, and the views say whose turn it is.
assert.equal(r.canonicalParty(view('A')),r.canonicalParty(view('C')));
for(const id of ['A','B','C'])assert.equal(r.turnOrderView(view(id).game).mine,holder()===id);

// ---- Nobody acts out of turn ----
const waiting=['A','B','C'].find(id=>id!==holder());
const refused=act(waiting,main(waiting),seeded(3));
assert.match(refused.error,/’s turn\. Wait for it\./,'acting out of turn is refused');
assert.equal(r.dmChoices(heroes[waiting],view(waiting).game,view(waiting).health).map(c=>c.id).join(),'party-pass','and offered nothing but passing an absent player’s turn');
assert.ok(r.dmChoices(heroes[holder()],view(holder()).game,view(holder()).health).length>0,'the hero whose turn it is has their choices');
assert.match(r.commitDmTurn(heroes[waiting],view(waiting).game,view(waiting).health,{type:'encounter-attack',weapon:weaponOf(waiting)},{question:'I attack.',narration:'You swing.'}).error,/not your turn/);
assert.ok(!r.commitDmTurn(heroes[waiting],view(waiting).game,view(waiting).health,null,{question:'Hold on, Kara!',narration:'Your shout rings out.'}).error,'talking is free at any time');

// ---- Three rounds: each hero acts once a round, the foe once a round ----
const miss=()=>0.04;
for(let round=0;round<3;round++){
 const start=table.game.turnOrder.round,gameRound=table.game.round,acted=[];
 let foeTurns=0;
 for(let step=0;step<10&&table.game.turnOrder&&table.game.turnOrder.round===start;step++){
  const id=holder();acted.push(id);
  const v=view(id),action=v.game.stage==='dying'?'death-save':'dodge';
  const res=takeTurn(id,action,seeded(100+round*10+step));
  assert.ok(!res.error,id+': '+res.error);
  if(res.events.some(e=>/^Round \d+ begins\.$/.test(e)))foeTurns+=0;
  foeTurns+=res.events.filter(e=>/initiative|Round/.test(e)===false&&/^Bandit/.test(e)&&/: d20|attacks .*: d20/.test(e)).length>0?1:0;
 }
 if(!table.game.turnOrder)break;
 assert.equal(table.game.turnOrder.round,start+1,'the round turns over');
 assert.equal(new Set(acted).size,acted.length,'nobody acted twice in round '+start+': '+acted.join(','));
 assert.equal(acted.length,3,'all three heroes acted in round '+start);
 assert.equal(table.game.round,gameRound+1,'the foe acted once (its round passed once)');
 assert.ok(foeTurns<=1,'the foe struck in one turn only');
 allValid('after round '+start);
}

// ---- A hero who took the Dodge is harder to hit until their next turn ----
let dodgedLines=[],otherLines=[];
for(let seed=1;seed<=40;seed++){
 startTable();act('A',main('A'),seeded(5));
 table.game.turnOrder={...table.game.turnOrder,order:[{id:'A',init:20},{id:'foe',init:15},{id:'B',init:10},{id:'C',init:5}],at:0};
 const res=takeTurn('A','dodge',seeded(seed));assert.ok(!res.error,res.error);
 for(const line of res.events.filter(e=>/: d20/.test(e)&&!/initiative/.test(e))){if(/vs your AC/.test(line))dodgedLines.push(line);else if(/ attacks /.test(line))otherLines.push(line);}
}
assert.ok(dodgedLines.length>0&&otherLines.length>0,'the foe went for Kara and for the others');
assert.ok(dodgedLines.every(l=>/\(disadvantage\)/.test(l)),'every blow at the dodging hero had disadvantage');
assert.ok(otherLines.every(l=>/\(normal\)/.test(l)),'the others were struck normally: '+otherLines.find(l=>!/\(normal\)/.test(l)));

// ---- A spent action survives another device's write; the turn waits for the bonus action ----
startTable();act('A',main('A'),seeded(5));
table.game.turnOrder={...table.game.turnOrder,order:[{id:'A',init:20},{id:'B',init:15},{id:'foe',init:10},{id:'C',init:5}],at:0};
table.health={current:4,temp:0};
const struck=act('A',main('A'),miss);assert.ok(!struck.error,struck.error);
assert.equal(holder(),'A','Kara still has a bonus action (Second Wind): her turn waits');
assert.equal(view('A').game.actionUsed,true);assert.equal(view('B').game.actionUsed,undefined,'it is not Jo’s spent action');
// Jo says something at the table meanwhile (a write from another device).
{const v=view('B');table=plain(r.adventureSnapshot(ilyra,{...v.game,worldFacts:[...(v.game.worldFacts??[]),'Jo shouts a warning.']},v.health,true));}
assert.equal(view('A').game.actionUsed,true,'Kara’s spent action is still spent after Jo’s write');
assert.match(act('A',main('A'),miss).error??'',/already used your action/);
const ended=act('A','end-turn',seeded(9));assert.ok(!ended.error,ended.error);assert.equal(holder(),'B','then the turn passes');
allValid('after the bonus-action pause');

// ---- A hero who is down rolls their death save on their turn; the foe turns to those standing ----
startTable();act('A',main('A'),seeded(5));
table.game.turnOrder={...table.game.turnOrder,order:[{id:'B',init:20},{id:'C',init:15},{id:'A',init:12},{id:'foe',init:10}],at:2};
table.health={current:0,temp:0};table.game={...table.game,stage:'dying',dying:{successes:0,failures:0,place:'bridge',cause:'The Bandit',placeName:'The road',fight:true}};
assert.ok(valid('A')&&valid('B'),'a party with a hero down is valid');
assert.equal(view('B').game.stage,'combat','the others fight on');
assert.match(act('A',main('A'),seeded(1)).error??'',/dying|death saving throw/i,'a hero who is down can only fight to hold on');
const held=act('A','death-save',seeded(21));assert.ok(!held.error,held.error);
assert.ok(held.events.some(e=>/^Death saving throw/.test(e)),'Kara rolls her death save');
const told=held.events.filter(e=>/: d20/.test(e)&&!/initiative|Death saving/.test(e));
assert.ok(told.length>0,'the foe acted next');
assert.ok(told.every(l=>!/vs your AC/.test(l)&&(l.includes(' attacks '+ilyra.name)||l.includes(' attacks '+wren.name))),'played from a standing hero, and told of them by name: '+told.join(' | '));
assert.ok(['B','C'].includes(holder()),'then a standing hero’s turn');
assert.equal(r.settleParty(table).world.stage,'combat','the party is still in the fight');
allValid('after a death save');

// ---- An absent player's turn can be passed ----
const absent=holder(),other=['A','B','C'].find(id=>id!==absent&&view(id).game.stage!=='dying');
const passed=act(other,{type:'party-pass'},seeded(4));assert.ok(!passed.error,passed.error);
assert.ok(passed.events[0].endsWith('holds their ground.'),'the feed says the turn was passed');assert.notEqual(holder(),absent);
assert.match(act(holder(),{type:'party-pass'},seeded(4)).error??'',/your own turn/,'nobody passes their own turn');

// ---- A hero who joins mid-fight takes the last place ----
{const v=view('A');table=plain(r.joinParty(table,'D',{character:JSON.stringify(brother),game:null,health:null,name:'Kit'}).snapshot);}
for(let i=0;i<8&&holder()!=='D'&&table.game.turnOrder;i++){const id=holder(),res=takeTurn(id,view(id).game.stage==='dying'?'death-save':'dodge',seeded(40+i));assert.ok(!res.error,res.error);}
assert.ok(table.game.turnOrder.order.some(e=>e.id==='D'),'Kit joined the order');assert.equal(holder(),'D','and gets a turn');

// ---- A won fight ends the order ----
startTable();act('A',main('A'),seeded(5));
table.game.enemyHP=1;
const finisher=holder(),win=act(finisher,main(finisher),always(0.97));assert.ok(!win.error,win.error);
assert.equal(table.game.stage,'victory');assert.equal(table.game.turnOrder,undefined,'no turn order once the fight is won');
allValid('after the victory');

// ---- A brawl with people goes in turns too ----
const written={title:'The Test Road',premise:'A quiet inn.',opening:'You arrive.',objective:'Find the thief.',resolution:'Catch them.',secret:'The keeper knows.',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'The Lamp',description:'An inn.'},bridge:{name:'The Ford',description:'A ford.'},tower:{name:'The Mill',description:'A mill.'}},npcs:{keeper:{name:'Ivo Brask',species:'Human',role:'Innkeeper',motive:'Keep the peace.',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera Vane',species:'Elf',role:'Scribe',motive:'Learn the truth.',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}}};
{const inn=r.freshStoryGame(kara,{...written,id:'test-story',status:'active'},r.newAdventure(kara));
 let snap=r.startParty(r.adventureSnapshot(kara,inn,null,true),'A','Sam');snap=r.joinParty(snap,'B',{character:JSON.stringify(ilyra),game:null,health:null,name:'Jo'}).snapshot;table=plain(snap);}
const brawl=act('A',{type:'npc-attack',target:'keeper',weapon:weaponOf('A')},always(0.3));assert.ok(!brawl.error,brawl.error);
assert.ok(table.game.npcCombat?.active,'the brawl began');{
 assert.ok(table.game.turnOrder.order.some(e=>e.id==='npc:keeper'),'the keeper has a place in the order');
 assert.ok(['A','B'].includes(holder()));
 const notNow=holder()==='A'?'B':'A';assert.match(act(notNow,'npc-dodge',seeded(2)).error??'',/turn/);
 let keeperStruck=false;
 for(let i=0;i<8&&table.game.turnOrder;i++){const id=holder(),res=takeTurn(id,view(id).game.stage==='dying'?'death-save':'npc-dodge',seeded(60+i));assert.ok(!res.error,res.error);if(res.events.some(e=>/^Ivo Brask attacks/.test(e)))keeperStruck=true;}
 assert.ok(keeperStruck,'the keeper attacked on his own turns');
 allValid('in a brawl');
}

// ---- Healing spells reach the other heroes ----
{const cleric=r.readyHero('cleric');heroes.D=cleric;
 const calm=r.hostileEncounterGame(cleric,r.newAdventure(cleric),pick('bandit'));
 let snap=r.startParty(r.adventureSnapshot(cleric,{...calm,stage:'bridge'},{current:r.combatBasics(cleric).hp,temp:0},true),'D','Kit');
 snap=r.joinParty(snap,'A',{character:JSON.stringify(kara),game:null,health:null,name:'Sam'}).snapshot;table=plain(snap);
 // Kara is down; the cleric heals her by name.
 const down=view('D');down.game.party.members.A={...down.game.party.members.A,status:'down',health:{current:0,temp:0},hero:{...down.game.party.members.A.hero,dying:{successes:1,failures:0,place:'bridge',cause:'The Bandit',placeName:'The road',fight:false}}};table=plain(down);
 const cure=r.dmCommand(cleric,view('D').game,'I cast Cure Wounds on '+kara.name.split(' ')[0]+'.',view('D').health);
 assert.equal(cure.action?.request?.partyTarget,'A','“on Kara” is Kara: '+JSON.stringify(cure));
 const healed=act('D',cure.action,seeded(7));assert.ok(!healed.error,healed.error);
 const back=table.game.party.members.A;assert.equal(back.status,'up');assert.ok(back.health.current>0);assert.equal(back.hero.dying,undefined,'she wakes');
 assert.ok(healed.events.some(e=>e.startsWith('Cure Wounds on '+kara.name)&&/opens their eyes/.test(e)));
 assert.ok(valid('A')&&valid('D'));
 // The Cast… picker offers it for every hurt friend.
 const hurt=view('D');hurt.game.party.members.A={...hurt.game.party.members.A,health:{current:3,temp:0}};
 assert.ok(r.spellActions(cleric,hurt.game).some(a=>a.key==='spell:cure:party:A'&&a.question==='I cast Cure Wounds on '+kara.name+'.'),'a chip to heal Kara');}
// ---- The Dungeon Master knows whose turn it is ----
startTable();act('A',main('A'),seeded(5));
const ctx=r.dmContext(heroes[holder()],view(holder()).game,view(holder()).health);
assert.equal(ctx.turnOrder.yourTurn,true);assert.equal(ctx.turnOrder.order.length,4);assert.equal(ctx.turnOrder.current,heroes[holder()].name);
console.log('Party turns: the first move is anyone’s, then initiative for every hero and the foe; each hero acts only on their own turn (nothing offered, nothing accepted out of turn, talking free); the foe once a round against any standing hero; Dodge until your next turn; a spent action kept across devices; death saves on your turn with the foe told of the standing heroes by name; passing an absent player; joining mid-fight; brawls in turns; the order gone once the fight is won.');
