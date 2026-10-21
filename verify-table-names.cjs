// Named at a table of several heroes (the host, 2026-10-21: "make sure that when a player is being talked to or
// interacted with, that character is named instead of just saying "you" so players know who is being interacted with
// and who is available to respond."). Every member reads the same feed, so a turn another member took is told of their
// hero by name:
// 1. the engine's own lines (playbackRules.js heroTold, visibleTurn): "Kara uses Greatsword: d20 …", "vs Kara’s AC 16",
//    with their cards read as before (chronicleRules.js describeEvent), and the foe's blows at my own hero told to me;
// 2. the game's fight lines (fightLines.js twins), played on the campaign server, name the acting hero, never "you";
// 3. people's lines say whom they are said to (recordedTurn: to), and the player's line carries the hero's name;
// 4. the Dungeon Master is told to narrate a table's turns in the third person (PARTY), and the game's own one-line
//    tellings (dm-intent.cjs) name the hero too.
// Alone, everything stays in the second person exactly as before. Synthetic heroes and a stand-in Dungeon Master only.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {rulesSource,helperFiles}=require('./rules-files.cjs');
const x=vm.runInNewContext(rulesSource({extra:helperFiles})+'\n({readyHero,readyHeroes,newAdventure,hostileEncounterGame,adventureStep,adventureSnapshot,combatBasics,startParty,joinParty,partyView,turnOrderView,quickActions,attackActions,heroTold,toldToMe,addressedTo,visibleTurn,recordedTurn,heroesAtTable,describeEvent,fightTelling,fightLineBook,fightBarks,withAttackIntent})',{AsyncStorage:{}});
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const lcg=s=>()=>(s=(s*16807)%2147483647||1)/2147483647;
const you=/\b(?:you|your|yours|yourself)\b/i,outsideQuotes=t=>String(t).replace(/“[^”]*”|"[^"]*"/g,'');

// ---- 1. The engine's lines, told of the hero by name ----
const told={
 'You use Greatsword: d20 [8] (normal) + 3 Strength + 2 proficiency = 13 vs AC 12. Hit.':'Thalion uses Greatsword: d20 [8] (normal) + 3 Strength + 2 proficiency = 13 vs AC 12. Hit.',
 'Bandit Cutthroat: d20 [5] (normal) +3 = 8 vs your AC 14. Miss.':'Bandit Cutthroat: d20 [5] (normal) +3 = 8 vs Thalion’s AC 14. Miss.',
 'You hold your ground and end your turn.':'Thalion holds their ground and ends their turn.',
 'You fall unconscious and are dying. Your attackers leave you where you fell. Each turn, roll to hold on: three successes and you stabilise, three failures and you die.':'Thalion falls unconscious and is dying. Their attackers leave them where they fell. Each turn, roll to hold on: three successes and they stabilise, three failures and they die.',
 'You are stable. Hours later you wake with 1 HP at Caravan Camp. Someone found you and carried you back.':'Thalion is stable. Hours later they wake with 1 HP at Caravan Camp. Someone found them and carried them back.',
 'Grapple: the Goblin Raider resists with a Dexterity save d20 [4] + 2 = 6 vs DC 13: failure. You have it in your grip: it cannot move, and its attacks on anyone but you have disadvantage.':'Grapple: the Goblin Raider resists with a Dexterity save d20 [4] + 2 = 6 vs DC 13: failure. Thalion has it in their grip: it cannot move, and its attacks on anyone but them have disadvantage.',
 'Captain Oona Brask attacks you: d20 [12] (normal) + 4 =16 vs AC 15. Hit; 6 Bludgeoning damage (1d6 [2] + 4).':'Captain Oona Brask attacks Thalion: d20 [12] (normal) + 4 =16 vs AC 15. Hit; 6 Bludgeoning damage (1d6 [2] + 4).',
 'Turn order: You → Bandit Cutthroat.':'Turn order: Thalion → Bandit Cutthroat.',
 'You have earned a level. Take it when you are ready.':'Thalion has earned a level. Take it when they are ready.',
 'You search the bandit cutthroat.':'Thalion searches the bandit cutthroat.',
 'You travel to Lookout Rock. 900 ft; 3 minutes pass.':'Thalion travels to Lookout Rock. 900 ft; 3 minutes pass.',
 'Death saving throw: d20 [20] = 20 vs DC 10. Success. A natural 20: you regain 1 HP and open your eyes.':'Death saving throw: d20 [20] = 20 vs DC 10. Success. A natural 20: Thalion regains 1 HP and opens their eyes.',
 'Knockdown: Strength save d20 [8] + 1 = 9 vs DC 13. Failure. You are knocked prone.':'Knockdown: Strength save d20 [8] + 1 = 9 vs DC 13. Failure. Thalion is knocked prone.',
 'Vex: your next attack against the Bandit Cutthroat has advantage.':'Vex: Thalion’s next attack against the Bandit Cutthroat has advantage.',
 'The keeper lends you one healing draught. Follow the blue sparks to the bridge.':'The keeper lends Thalion one healing draught. Follow the blue sparks to the bridge.',
 'You turn to Mara.':'Thalion turns to Mara.',
 'You already know the way.':'Thalion already knows the way.',
 'Mara says “you are late” and smiles.':'Mara says “you are late” and smiles.',
 'Tobin Reed will never forgive you.':'Tobin Reed will never forgive Thalion.',
};
for(const [line,want] of Object.entries(told))assert.equal(x.heroTold(line,'Thalion'),want,'told of the hero: '+line);
// The foe's blows at my own hero, played from another hero's point of view, are told to me as "you".
assert.equal(x.toldToMe('Wolf attacks Kara: d20 [14] (normal) +4 = 18 vs Kara’s AC 16. Hit.','Kara'),'Wolf attacks you: d20 [14] (normal) +4 = 18 vs your AC 16. Hit.');
assert.equal(x.toldToMe('1d6 [3] + 2 = 5 piercing damage to Kara.','Kara'),'1d6 [3] + 2 = 5 piercing damage to you.');
// Every engine line a party's fights write (each hero, every chip): no "you" left, and the feed's cards read the same.
{const heroes=x.readyHeroes.map(e=>e.key),seen=new Set();let lines=0;
 for(let k=0;k<heroes.length*4;k++){
  const ids=['A','B','C'],hs={A:x.readyHero(heroes[k%heroes.length]),B:x.readyHero(heroes[(k+3)%heroes.length]),C:x.readyHero(heroes[(k+5)%heroes.length])},rand=lcg(k*7919+3);
  const fight=x.hostileEncounterGame(hs.A,x.newAdventure(hs.A),()=>((k*0.137)%1));
  let snap=x.startParty(x.adventureSnapshot(hs.A,fight,{current:x.combatBasics(hs.A).hp,temp:0},true),'A','Sam');
  for(const id of ['B','C'])snap=x.joinParty(snap,id,{character:JSON.stringify(hs[id]),game:null,health:null,name:id}).snapshot;
  let table=plain(snap);
  for(let i=0;i<30;i++){
   const order=x.turnOrderView(x.partyView(table,'A').game),id=ids.includes(order?.current?.id)?order.current.id:'A',v=x.partyView(table,id);if(!v)break;
   const chips=[...x.quickActions(hs[id],v.game,v.health),...x.attackActions(hs[id],v.game,v.health,null)].filter(c=>c.action&&!/^(?:travel|loot)/.test(String(c.action)));if(!chips.length)break;
   const c=chips[Math.floor(rand()*chips.length)],res=x.adventureStep(x.withAttackIntent(v.game,c.question??''),v.health,hs[id],c.action,rand);if(res.error)continue;
   for(const t of res.events??[]){if(!you.test(t)||seen.has(t))continue;seen.add(t);lines++;
    const name=hs[id].name,out=x.heroTold(t,name);
    assert.ok(!you.test(outsideQuotes(out)),'no "you" left: '+t+' → '+out);
    const kind=/initiative|turn order/i.test(t)?'initiative':/d20|\bd\d+\b|save |damage|\bHP\b/i.test(t)?'roll':'action',was=x.describeEvent({kind,text:t}),now=x.describeEvent({kind,text:out,toldOf:name});
    assert.equal(now.type,was.type,'the same card: '+out);
    for(const k of ['natural','verdict','total','actor','mode','damage','amount','round'])assert.deepEqual(plain({v:now[k]}),plain({v:was[k]}),k+' read the same: '+out);
    if(was.type==='roll'&&was.actor==='you'&&/^You (?:use|throw) /.test(t)){assert.equal(now.title,was.title,'the weapon named on the card: '+out);assert.equal(now.who,name,'and whose roll it is');}}
   table=plain(x.adventureSnapshot(hs[id],res.game,res.health,true));
   if(!['combat','dying'].includes(table.game.stage)&&!table.game.npcCombat?.active)break;}}
 assert.ok(lines>=30,'a wide range of the engine\'s lines ('+lines+')');}

// A turn Kara took, as Ilyra's device and Kara's own read it.
{const members={A:{character:JSON.stringify({name:'Kara Vell'})},B:{character:JSON.stringify({name:'Ilyra Dawnmere'})}};
 const turn={id:3,npcId:null,by:{seat:'A',name:'Kara Vell'},events:[{kind:'player',text:'I cast Magic Missile.',speakerName:'Sam',heroName:'Kara Vell'},{kind:'roll',text:'You use Greatsword: d20 [14] (normal) + 5 = 19 vs AC 12. Hit.'},{kind:'effect',text:'Spent 1 level 1 spell slot.'},{kind:'effect',text:'Kara Vell: 20 → 14 HP.'},{kind:'roll',text:'Wolf attacks Ilyra Dawnmere: d20 [15] (normal) +4 = 19 vs Ilyra Dawnmere’s AC 13. Hit.'},{kind:'action',text:'Ilyra Dawnmere’s turn.'}]};
 const theirs=plain(x.visibleTurn(turn,{party:{lead:'B',members}}).events),mine=plain(x.visibleTurn(turn,{party:{lead:'A',members}}).events);
 assert.deepEqual(theirs.map(e=>e.text),['I cast Magic Missile.','Kara Vell uses Greatsword: d20 [14] (normal) + 5 = 19 vs AC 12. Hit.','Kara Vell: Spent 1 level 1 spell slot.','Kara Vell: 20 → 14 HP.','Wolf attacks you: d20 [15] (normal) +4 = 19 vs your AC 13. Hit.','Ilyra Dawnmere’s turn.'],'Ilyra reads Kara\'s turn by name, and the blow at her as "you"');
 assert.deepEqual(mine.map(e=>e.text),turn.events.map(e=>e.text),'Kara reads her own turn as it was written');
 assert.equal(x.describeEvent(theirs[1]).who,'Kara Vell');assert.equal(x.describeEvent(theirs[1]).title,'Greatsword');assert.equal(x.describeEvent(theirs[4]).actor,'foe');
 const alone=plain(x.visibleTurn({...turn,by:undefined},{}).events);assert.deepEqual(alone.map(e=>e.text),turn.events.map(e=>e.text),'alone, nothing changes');}

// ---- 2. Whom a person's line is said to ----
assert.equal(x.addressedTo('You look tired, friend.',['Kara','Bram'],'Kara'),'Kara','"you" with no name: the hero acting');
assert.equal(x.addressedTo('Bram, you should sit.',['Kara','Bram Ironfist'],'Kara'),null,'a line that names a hero says whom already');
assert.equal(x.addressedTo('All of you should rest before dark.',['Kara','Bram'],'Kara'),'everyone');
assert.equal(x.addressedTo('The road north is washed out.',['Kara','Bram'],'Kara'),null,'nobody in particular');

(async()=>{
 // ---- 3. A table of two heroes: the server's turns, as each member reads them ----
 const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard');
 const at=(game)=>{let s=r.startParty(r.adventureSnapshot(kara,game,null,true),'A','Sam');s=r.joinParty(s,'B',{character:JSON.stringify(ilyra),game:r.newAdventure(ilyra),health:null,name:'Jo'}).snapshot;return plain(s);};
 // Talk at the inn: the player's line names the hero; people's lines say whom they are said to.
 {const inn=at(r.newAdventure(kara)),ask=async()=>({narration:'Mara looks up from her bread.',dialogue:[{speakerId:'mara',text:'You look tired. Sit a while.'},{speakerId:'keeper',text:'All of you are welcome here.'},{speakerId:'mara',text:'Ilyra, is that a spellbook?'}],suggestions:[]});
  const out=await resolveTurn(r.partyView(inn,'A'),{question:'I greet Mara.'},{ask,randomImpl:()=>0.5,actorName:'Sam',actorSeat:'seat-0123456789abcdef'});
  const turn=out.turn;assert.deepEqual(plain(turn.by),{seat:'A',name:kara.name},'the turn says whose hero acted');
  const said=turn.events.find(e=>e.kind==='player');assert.equal(said.heroName,kara.name,'the player\'s line carries the hero\'s name');assert.equal(said.speakerName,'Sam');
  const lines=turn.events.filter(e=>e.kind==='dialogue');assert.deepEqual(plain(lines.map(l=>l.to??null)),[kara.name,'everyone',null],'to the hero acting, to everyone, and a line that names its hero');
  const theirs=x.visibleTurn(turn,r.partyView(out.snapshot,'B').game),mine=x.visibleTurn(turn,r.partyView(out.snapshot,'A').game);
  assert.deepEqual(plain(theirs.events.filter(e=>e.kind==='dialogue').map(l=>l.toLabel??null)),[kara.name,'all of you',null],'another member reads whom each line is said to');
  assert.deepEqual(plain(mine.events.filter(e=>e.kind==='dialogue').map(l=>l.toLabel??null)),['you','all of you',null],'the hero spoken to reads "you"');
  // Alone, nothing changes.
  const solo=await resolveTurn(r.adventureSnapshot(kara,r.newAdventure(kara),null,true),{question:'I greet Mara.'},{ask,randomImpl:()=>0.5});
  assert.equal(solo.turn.by,undefined);assert.equal(solo.turn.events.find(e=>e.kind==='player').heroName,undefined);assert.ok(solo.turn.events.filter(e=>e.kind==='dialogue').every(l=>l.to===undefined),'alone, no names are added');}
 // A fight: after the first move, routine moves are told by the game, naming the hero who acts; the other member reads
 // the engine's lines told of that hero, while the one who acted keeps "you".
 {let snap=at({...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0.05),enemyHP:400}),told=0,named=0,engine=0;
  const rand=lcg(11),stub=async()=>({narration:'The fight goes on.',suggestions:[]});
  for(let i=0;i<40;i++){
   const order=r.turnOrderView(r.partyView(snap,'A').game),id=order?.current?.id==='B'?'B':'A',hero=id==='A'?kara:ilyra,v=r.partyView(snap,id);
   if(!['combat'].includes(v.game.stage))break;
   const chips=r.quickActions(hero,v.game,v.health).filter(c=>typeof c.action==='string'&&/^(?:attack:|dodge$|end-turn$)/.test(c.action));if(!chips.length)break;
   const c=chips[i%chips.length],out=await resolveTurn(v,{question:c.question,action:c.action},{ask:stub,randomImpl:rand,actorName:id==='A'?'Sam':'Jo',actorSeat:null});
   snap=plain(out.snapshot);
   if(out.turn.told==='game'){told++;
    assert.ok(out.narration.includes(hero.name.split(' ')[0]),'the game\'s telling names the hero acting: '+out.narration);
    assert.ok(!you.test(outsideQuotes(out.narration)),'and never says "you": '+out.narration);named++;
    for(const l of out.turn.events.filter(e=>e.kind==='dialogue'))assert.ok([hero,ilyra,kara].some(h=>l.text.includes(h.name.split(' ')[0])),'a spoken line names the hero it is said to: '+l.text);}
   const other=id==='A'?'B':'A',theirs=x.visibleTurn(out.turn,r.partyView(out.snapshot,other).game),mine=x.visibleTurn(out.turn,r.partyView(out.snapshot,id).game);
   for(const e of theirs.events.filter(e=>['roll','action','effect','initiative'].includes(e.kind))){assert.ok(!/^You\b/.test(e.text),'another member never reads "You …": '+e.text);if(e.toldOf)engine++;}
   assert.ok(mine.events.filter(e=>e.kind==='roll').every(e=>!e.toldOf),'the one who acted keeps their own lines');}
  assert.ok(told>=4,'routine moves told by the game at the table ('+told+')');assert.ok(engine>=4,'engine lines told of the hero ('+engine+')');}
 // Alone, the game's fight lines stay in the second person.
 {const g={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0.05),openingAttackAvailable:false,enemyHP:400},h={current:r.combatBasics(kara).hp,temp:0};
  for(let i=0;i<20;i++){const pre=x.adventureStep(g,h,kara,'attack:Greatsword',lcg(i+5));const t=x.fightTelling({hero:kara,before:{...g,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'.'}]}]},after:pre.game,health:h,afterHealth:pre.health,action:'attack:Greatsword',events:pre.events});
   assert.ok(!t.narration.includes('|')&&!t.narration.includes('{hero}')&&!t.narration.includes(kara.name),'alone, the second person as before: '+t.narration);}}

 // ---- 4. The Dungeon Master and the game's own one-line tellings ----
 {const d=require('./dm-instructions.cjs');assert.ok(d.standingPrompt.includes('never say "you" in narration: tell it in the third person, naming context.player'),'PARTY: third person at a table');
  assert.ok(d.standingPrompt.includes('Someone speaking to one hero names them'),'PARTY: people name the hero they speak to');
  const i=require('./dm-intent.cjs'),base={input:'I take a short rest.',context:{player:{name:'Thalion'},choices:[{id:'short-rest',label:'Short rest'}],stage:'inn',world:{}}};
  assert.equal(i.secondLook(base,{narration:'.',dialogue:[]}).say,'You take a short rest.','alone: "you"');
  assert.equal(i.secondLook({...base,context:{...base.context,party:[{name:'Kara'}]}},{narration:'.',dialogue:[]}).say,'Thalion takes a short rest.','at a table: the hero by name');}
 // ---- 5. The feed shows it (TurnPlayback.js) ----
 {const feed=fs.readFileSync('TurnPlayback.js','utf8');
  assert.ok(feed.includes("event.heroName&&event.heroName!==event.speakerName?event.heroName+' · '+event.speakerName"),'the player\'s line names their hero for the others');
  assert.ok(feed.includes("(event.toLabel?' → '+event.toLabel:'')"),'a person\'s line says whom it is said to');
  assert.ok(feed.includes("view.who?view.who+'’s roll'"),'another hero\'s roll is theirs');
  const dm=fs.readFileSync('DungeonMaster.js','utf8');assert.ok(dm.includes('visibleTurn(t,game)'),'the play panel reads every turn through visibleTurn');}
 console.log('Table names: at a table of several heroes another member reads every turn told of the acting hero by name (engine lines with their cards unchanged, the game\'s fight lines from their hand-written twins, the player\'s line with the hero\'s name, people\'s lines with whom they are said to, the foe\'s blows at my own hero told to me), the Dungeon Master is told the same, and alone everything stays in the second person.');
})().catch(e=>{console.error(e);process.exit(1);});
