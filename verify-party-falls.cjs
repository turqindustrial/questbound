// A party at the shared table when heroes fall (adventureRules.js partyStep, partyRules.js, encounterRules.js,
// npcRules.js, campaigns.cjs validSnapshot): a hero who drops in a fight in the wilds or in a brawl lies there while the
// others fight on, whoever's device rolled the blow; a dead member never stops a later fight; a hero who wakes from
// their death saves wakes where the party stands; a hold ends when its holder drops and nothing of a fight outlasts it.
// Every write is checked as the campaign server checks it (every member's view a valid save), first in set scenes and
// then in a seeded run of 2 to 4 hero parties played through server-turn.cjs resolveTurn, the server's own pipeline.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
const {resolveTurn}=require('./server-turn.cjs'),{validSnapshot}=require('./campaigns.cjs');
// The campaign server's own rules files, with a wider set of names for setting scenes.
const source=rulesSource();
const r=vm.runInNewContext(source+'\n;({readyHero,readyHeroes,makeCharacter,blankBuild,newAdventure,freshStoryGame,hostileEncounterGame,hostileFoes,adventureStep,settleTurn,adventureSnapshot,combatBasics,startParty,joinParty,partyView,settleParty,turnOrderView,dmChoices,quickActions,attackTargets,attackActions,spellActions,attackOptions,isPartyGame})',{AsyncStorage:{},console});
const plain=v=>JSON.parse(JSON.stringify(v));
const seeded=seed=>{let s=(seed*48271+12345)%2147483647||1;return ()=>(s=(s*16807)%2147483647)/2147483647;};
const person=(name,gender)=>({name,species:'Human',gender,role:'A resident of the refuge.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar across one brow.',personality:'Plain-spoken and watchful.',ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const written={id:'falls-1',status:'active',title:'The Seal Beneath the Snow',premise:'An heir is missing and a pretender marches.',opening:'A seal is pressed into your hand at the gate.',objective:'Find the heir and settle the succession.',resolution:'The truth of the succession is known.',secret:'The heir chose to vanish.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 layout:{bridge:{bearing:'N',miles:3},tower:{bearing:'E',miles:2,from:'inn'}},
 locations:{inn:{name:'Bellwether Refuge',description:'A pilgrim refuge under the pass.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A narrow cut in the ridge.',kind:'mountain'},tower:{name:'Shrine of Last Steps',description:'A shrine of worn stairs.',kind:'shrine'}},
 npcs:{keeper:person('Tamsin Rook','woman'),mara:person('Rusk Hale','man')},
 landmarks:['Three-Cairn Road','Sister Bell Shrine','Slate Widow Farm'].map((name,i)=>({name,description:'A place on the old royal road, number '+(i+1)+'.',kind:'landmark',bearing:['N','E','S'][i],miles:1+i,from:'inn',danger:['lair','risky','safe'][i],feature:'A marker stone.'})),
 chapters:[{title:'A Seal at the Gate',goal:'Question the people.',turn:'A receipt.'},{title:'The Pass',goal:'Reach the shrine.',turn:'The heir crossed.'}],
 leads:[{title:'The Copyist\'s Debt',hook:'Recover wages.'}]};
const full=h=>({current:r.combatBasics(h).hp,temp:0});
function partyOf(heroes,game){
 const ids=Object.keys(heroes);let snap=r.startParty(r.adventureSnapshot(heroes[ids[0]],game,full(heroes[ids[0]]),true),ids[0],'P'+ids[0]);
 for(const id of ids.slice(1))snap=r.joinParty(snap,id,{character:JSON.stringify(heroes[id]),game:null,health:null,name:'P'+id}).snapshot;
 // Seen from the first hero (joining hands back the table as the joiner sees it).
 return plain(r.partyView(snap,ids[0]));
}
const statusOf=(table,id)=>r.settleParty(table).members[id]?.status;
const fightOn=table=>{const s=r.settleParty(table);return s.world.stage==='combat'||!!s.world.npcCombat?.active;};
// The campaign server's check, and the hold and fight invariants, after every write.
function check(table,why){
 assert.ok(validSnapshot(table),why+': the campaign server accepts the table');
 const s=r.settleParty(table),down=Object.keys(s.members).filter(id=>s.members[id].status!=='up');
 for(const [key,mark] of Object.entries(s.world.marks??{}))assert.ok(!down.includes(mark.grappled),why+': '+key+' is not held by a hero who has fallen');
 if(!fightOn(table)){assert.equal(s.world.marks,undefined,why+': nothing of a fight outlasts it');assert.equal(s.world.turnOrder,undefined,why+': no turn order out of a fight');}
}
// One move by one hero, played on their device's view (adventureStep, as Adventure.act does).
function move(table,heroes,id,action,random){
 const v=r.partyView(table,id),res=r.adventureStep(v.game,v.health,heroes[id],action,random);
 return res.error?{error:res.error,table}:{res,table:plain(r.adventureSnapshot(heroes[id],res.game,res.health,true))};
}
const holderOf=table=>r.turnOrderView(r.partyView(table,Object.keys(table.game.party.members)[0]).game)?.current?.id??null;
const lair={type:'discover',place:{name:'Wolf Hollow',description:'A den among the roots of an old oak.',kind:'camp',bearing:'E',miles:1,danger:'lair',feature:null,lair:{template:'wolf',name:'Grey Wolf',appearance:'A great grey wolf with a torn ear and yellow teeth.'}},travel:true};
const fighter=r.readyHero('fighter'),wizard=r.readyHero('wizard'),rogue=r.readyHero('rogue'),cleric=r.readyHero('cleric');

// ---- 1. A hero who falls in a fight in the wilds lies there while the others fight on ----
{
 const heroes={A:wizard,B:fighter,C:rogue};let table=null;
 // The wizard ends his turns in the open; the others dodge. Some seed drops him while the others stand.
 for(let seed=1;seed<60&&!table;seed++){
  let t=partyOf(heroes,r.freshStoryGame(wizard,plain(written),r.newAdventure(wizard)));
  ({table:t}=move(t,heroes,'A',lair,seeded(seed)));
  assert.ok(t.game.wildFight&&t.game.stage==='combat','the party meets the lair’s creature');check(t,'the lair fight begins');
  const rand=seeded(seed*13);
  for(let i=0;i<60&&fightOn(t);i++){
   const id=holderOf(t)??'A',v=r.partyView(t,id),act=v.game.stage==='dying'?'death-save':v.game.actionUsed||id==='A'?'end-turn':'dodge';
   const out=move(t,heroes,id,act,rand);assert.ok(!out.error,out.error);t=out.table;check(t,'seed '+seed+' round '+i);
   if(statusOf(t,'A')!=='up'){if(['B','C'].some(m=>statusOf(t,m)==='up')&&t.game.enemyHP>0)table=t;break;}
  }
 }
 assert.ok(table,'the wizard falls while the others stand');
 assert.ok(table.game.wildFight&&fightOn(table),'the fight in the wilds goes on for those standing');
 assert.equal(r.partyView(table,'A').game.stage,'dying');
 const up=['B','C'].find(m=>statusOf(table,m)==='up');assert.equal(r.partyView(table,up).game.stage,'combat');
 // A hold by the fallen wizard ends with the next move; one by a hero standing stays.
 const gripped=plain(table);gripped.game.marks={foe:{grappled:'A',prone:true},...(table.game.foeAllies?{}:{})};
 const id=holderOf(gripped),v=r.partyView(gripped,id),act=v.game.stage==='dying'?'death-save':'dodge';
 const held=r.adventureStep(v.game,v.health,heroes[id],act,seeded(2));assert.ok(!held.error,held.error);
 assert.equal(held.game.marks?.foe?.grappled,undefined,'a hold ends when its holder has fallen');
}

// ---- 2. Whoever's device plays the foe's turn, a hero who drops leaves the fight to the others ----
for(const seed of [3,8,21,34,55]){
 const heroes={A:fighter,B:wizard,C:cleric};
 let table=partyOf(heroes,r.freshStoryGame(fighter,plain(written),r.newAdventure(fighter)));
 ({table}=move(table,heroes,'A',lair,seeded(seed)));
 const rand=seeded(seed*7);
 for(let i=0;i<120&&fightOn(table);i++){
  const id=holderOf(table)??'A',v=r.partyView(table,id),standing=Object.keys(heroes).filter(m=>statusOf(table,m)==='up');
  // The wizard ends every turn with a bonus action, so the foe's turn is often played from his device.
  const act=v.game.stage==='dying'?'death-save':v.game.actionUsed?'end-turn':id==='B'?'dodge':'end-turn';
  const out=move(table,heroes,id,act,rand);if(out.error)break;
  const before=standing.length;table=out.table;check(table,'seed '+seed+' step '+i);
  const now=Object.keys(heroes).filter(m=>statusOf(table,m)==='up');
  if(now.length&&now.length<before&&r.settleParty(table).world.enemyHP>0)assert.ok(table.game.wildFight,'seed '+seed+': a fall leaves the fight going for the '+now.length+' standing');
 }
}

// ---- 3. A dead member never stops a later fight, and a hero can die in a brawl ----
{
 const heroes={A:fighter,B:wizard};
 let table=partyOf(heroes,r.freshStoryGame(fighter,plain(written),r.newAdventure(fighter)));
 // The wizard has died (three failed saves some time ago).
 const s=r.settleParty(table);
 table.game.party.members.B={...table.game.party.members.B,status:'dead',health:null,hero:{...table.game.party.members.B.hero,death:{cause:'Struck down by a bandit',place:'Bellwether Refuge',at:'inn',massive:false}}};
 check(table,'a dead member at the inn');
 const wild=move(table,heroes,'A',lair,seeded(5));assert.ok(!wild.error,wild.error);check(wild.table,'a lair fight with a dead member');
 assert.equal(r.partyView(wild.table,'B').game.stage,'dead');
 const brawl=move(table,heroes,'A',{type:'npc-attack',target:'mara',weapon:r.attackOptions(fighter)[0].name},seeded(6));
 assert.ok(!brawl.error,brawl.error);check(brawl.table,'a brawl with a dead member');
 void s;
}

// ---- 4. Waking from three death saves outside a turn order: where the party stands ----
{
 const heroes={A:wizard,B:fighter};
 let table=partyOf(heroes,r.freshStoryGame(wizard,plain(written),r.newAdventure(wizard)));
 ({table}=move(table,heroes,'A',lair,seeded(4)));
 for(let i=0;i<200&&Object.keys(heroes).some(m=>statusOf(table,m)==='up');i++){
  const id=holderOf(table)??'A',v=r.partyView(table,id),act=v.game.stage==='dying'?'death-save':v.game.actionUsed?'end-turn':'dodge';
  const out=move(table,heroes,id,act,act==='death-save'?()=>0.5:()=>0.97);if(out.error)break;table=out.table;check(table,'everyone falling, step '+i);
 }
 assert.ok(['A','B'].every(m=>statusOf(table,m)!=='up'),'nobody is left standing');
 assert.equal(table.game.wildFight,undefined,'and the creature leaves them where they fell');
 const at=table.game.world.at;
 for(let i=0;i<6&&statusOf(table,'A')==='down';i++){const out=move(table,heroes,'A','death-save',()=>0.5);assert.ok(!out.error,out.error);table=out.table;check(table,'a death save out of a fight');}
 assert.equal(statusOf(table,'A'),'up','three successes wake the hero');
 const woke=r.partyView(table,'A').game;
 assert.equal(woke.stage,'wild','they wake where the party fell');assert.equal(woke.world.at,at,'with the world where it was');
 assert.ok(r.dmChoices(wizard,woke,r.partyView(table,'A').health).length>0,'and can act again');
}

// ---- 5. A seeded run of 2 to 4 hero parties through the campaign server's own turn (resolveTurn) ----
(async()=>{
 const pool=[...r.readyHeroes.map(e=>e.key)];
 const refusedBadly=[],stats={turns:0,falls:0,deaths:0,wakes:0,wild:0,brawls:0,travels:0};
 const asked={reply:null},ask=async()=>{const reply=asked.reply??{narration:'The moment unfolds.',actionId:null};asked.reply=null;return reply;};
 // QB_FALLS_TABLES=40 plays a longer run.
 const tables=Number(process.env.QB_FALLS_TABLES)||8;
 for(let t=0;t<tables;t++){
  // Ready-made heroes at level 1 (a valid hero for the server, and quick to fall).
  const rand=seeded(900+t),size=2+(t%3);
  const heroes=Object.fromEntries(['A','B','C','D'].slice(0,size).map(id=>[id,r.readyHero(pool[Math.floor(rand()*pool.length)])]));
  const lead=heroes.A,story=t%2===0;
  let table=partyOf(heroes,story?r.freshStoryGame(lead,plain(written),r.newAdventure(lead)):r.hostileEncounterGame(lead,r.newAdventure(lead),rand));
  check(table,'table '+t+' at the start');
  for(let step=0;step<80;step++){
   const ids=Object.keys(heroes).filter(id=>statusOf(table,id)!=='dead');if(!ids.length)break;
   const holder=holderOf(table),id=holder&&heroes[holder]?holder:ids[Math.floor(rand()*ids.length)],v=r.partyView(table,id),hero=heroes[id];
   const before=Object.fromEntries(Object.keys(heroes).map(m=>[m,statusOf(table,m)])),wasWild=!!table.game.wildFight;
   const offered=[...r.dmChoices(hero,v.game,v.health),...r.quickActions(hero,v.game,v.health),...r.attackTargets(hero,v.game,v.health).flatMap(x=>r.attackActions(hero,v.game,v.health,x.key)),...r.spellActions(hero,v.game).filter(c=>c.action)].filter(c=>c.action);
   let request;
   // Now and then the Dungeon Master opens a lair in the wilds (a fight) instead.
   if(story&&!fightOn(table)&&v.game.stage!=='dying'&&rand()<0.12){request={question:'I go looking for the den.'};asked.reply={narration:'A den lies ahead.',actionId:null,discovery:{...plain(lair.place),name:'Hollow '+step,travel:true}};}
   else if(offered.length){const c=offered[Math.floor(rand()*offered.length)];request={question:c.question??c.label??'I act.',action:plain(c.action)};}
   else continue;
   let out;
   try{out=await resolveTurn(plain(v),request,{ask,randomImpl:rand,actorName:'P'+id});}
   catch(e){asked.reply=null;if(/did not pass the game rules/.test(e.message))refusedBadly.push('table '+t+' step '+step+' '+id+' '+JSON.stringify(request.action??request.question).slice(0,60)+': '+e.message);continue;}
   table=plain(out.snapshot);stats.turns++;
   check(table,'table '+t+' step '+step+' ('+id+' '+JSON.stringify(request.action??request.question).slice(0,50)+')');
   for(const m of Object.keys(heroes)){const now=statusOf(table,m);if(before[m]==='up'&&now==='down')stats.falls++;if(before[m]!=='dead'&&now==='dead')stats.deaths++;if(before[m]==='down'&&now==='up')stats.wakes++;}
   if(!wasWild&&table.game.wildFight)stats.wild++;
   if(table.game.npcCombat?.active)stats.brawls++;
   if(request.action?.type==='travel')stats.travels++;
  }
 }
 assert.deepEqual(refusedBadly,[],'no turn the server resolves leaves an invalid table');
 assert.ok(stats.falls>0&&stats.wild>0&&stats.brawls>0&&stats.travels>0,'the run covers falls, fights in the wilds, brawls and travel: '+JSON.stringify(stats));
 console.log('Party falls: a hero who drops in the wilds or a brawl lies there while the rest fight on, whoever rolled the blow; a dead member never stops a later fight; a hero wakes where the party stands; holds end with their holder and nothing outlasts a fight; '+stats.turns+' server turns in '+tables+' parties of 2 to 4 ('+stats.falls+' falls, '+stats.deaths+' deaths, '+stats.wakes+' wakes, '+stats.wild+' fights in the wilds) all pass the campaign server’s check.');
})().catch(e=>{console.error(e);process.exit(1);});
