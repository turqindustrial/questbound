// The staging engine of written tales (stagingRules.js: seatStaging, withBeats, stagedPreview, taleNow, endingOf,
// stagingChoices, writtenCheck; WRITTEN-TALES.md 4 to 6, 14 and 17), played through the game's own pipeline
// (turnRules.js settleTurn, server-turn.cjs at a table) with the fixture tale (written-fixture.json) and variants of it:
//   1. seating: chapter 1's set piece armed by the level rules, the stakes, the pace; a tale without staging untouched
//   2. events latched for the chapter (reach, won, searched, checked, rest), who spoke, quiet, owed steps
//   3. every effect, in one beat; an offer that waits; leads by their condition; the foe's name refused as a person
//   4. one thing due at a time, never in a fight (but the fight's own: a hold); the find first; the beat a request carried is the one marked told
//   5. the preview and the commit agree; routine moves give way while a beat is due
//   6. the clock: drift, quiet, rests and days owe steps; held and spared steps; the last step closes the chapter;
//      the stall bound (a passive player), and the tale ends late with its default ending
//   7. choices: offered only while open and out of fights, never chips, within the thirty; settled by `when`; late
//   8. the foe held back to its chapter; no road beyond the map before the last chapter; story-advance from outside
//   9. what the Dungeon Master reads (taleNow, quest), the offline line (withBeatLine), the Suggestions' lines
//  10. at a table: a beat told through server-turn.cjs, recorded by the campaign server's own requests
//  11. a rollback: the rules of a build from before written tales load and play a game with a pace
//  12. the 167 fixture saves: untouched by the engine, and each of their heroes seats a written tale and plays it
//  13. total: withBeats, stagedPreview, taleNow and writtenCheck never throw on fuzzed input
// No AI, no network, no ports.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {rulesSource}=require('./rules-files.cjs'),W=require('./written-walk.cjs');
const names=[...new Set([...W.needs,'readyHero','freshStoryGame','newAdventure','withBeats','stagedPreview','seatStaging','beatHolds','taleNow','endingOf','stagingChoices','writtenCheck','beatKey','beatSent','beatDue','withBeatLine','beatLineOf','taleSayLines','placeColour','pressureSign','stagingQuest','bossOpen','bossBlocked','leadOpenNow','isStaged','validPace','validAdventure','adventureSnapshot','dmChoices','quickActions','offeredChoices','mapMoves','beyondError','introducePerson','dmContext','validStaging','stagingIds','upgradeCharacter','upgradeAdventure','startParty','joinParty','partyInTale','partyView','routineTelling','paceDueKey','calmTelling','worldPlace','noteLead'])];
const r=vm.runInNewContext(rulesSource()+'\n;({'+names.join(',')+'})',{AsyncStorage:{},console},{timeout:20000});
const plain=v=>JSON.parse(JSON.stringify(v));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'written-fixture.json'),'utf8'));
let copies=0;
// A copy of the fixture as the shelf starts one, after `mutate` changes its story.
const copy=(mutate=null)=>{const s=plain(fixture.story);if(mutate)mutate(s);return {...s,id:'staging-'+(++copies),status:'active',libraryId:fixture.id,artId:'journey-'+fixture.id,written:{slug:fixture.slug,edition:1,length:'short'}};};
const kara=r.readyHero('fighter');
const seat=(story,hero=kara)=>r.freshStoryGame(hero,story,r.newAdventure(hero));
const ch=(s,i)=>s.staging.chapters[i];
const valid=(game,hero=kara)=>assert.ok(r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero),'a valid adventure');
// One move settled as a device settles it. A DM-told turn names the beats its requests carried.
function settle(game,action,conversation,{hero=kara,health=null,dice=()=>0.5}={}){
 const s=r.settleTurn({hero,game,health,action,conversation:conversation??{question:'I do it.',narration:'It is done.',dialogue:[],npcId:null},random:dice});
 assert.ok(!s.error,'the move is refused: '+s.error);valid(s.result.game,hero);return s.result;
}
const talk=(game,{words='I look around.',dialogue=[],beats=null,npcId=null}={})=>settle(game,null,{question:words,narration:'The Dungeon Master answers.',dialogue,npcId,...(beats?{beats}:{})});
const told=game=>{const k=r.beatKey(game);return k?[k]:null;};
const travel=(game,id,opts={})=>{const move=r.mapMoves(game).find(m=>m.action.type==='travel'&&m.action.destination===id);assert.ok(move,'a road to '+id);return settle(game,move.action,{question:'I travel there.',narration:'You go.',dialogue:[],npcId:null,...(opts.beats?{beats:opts.beats}:{})},opts);};
const place=(game,name)=>r.stagingIds(game).place(name),person=(game,name)=>r.stagingIds(game).person(name);
const fightIt=game=>{let g=game,h=null;for(let i=0;i<60&&(g.stage==='combat'||g.stage==='dying');i++){const c=r.dmChoices(kara,g,h),pick=g.stage==='dying'?c.find(x=>x.id==='death-save'):g.actionUsed?c.find(x=>x.id==='end-turn'):c.find(x=>x.id.startsWith('attack:'));const res=settle(g,pick.action,{question:'I fight.',narration:'Steel rings.',dialogue:[],npcId:null},{health:h,dice:()=>0.9});g=res.game;h=res.health;}return {game:g,health:h};};

// ---------- 1. Seating ----------
{
 const g=seat(copy());
 assert.equal(r.isStaged(g),true);assert.equal(r.validPace(g.pace,g),true,'a sound pace');
 // A written tale's opening card shows where, what is happening and what to do first (WRITTEN-TALES.md 2.5); the journal
 // keeps all five.
 assert.deepEqual(g.playback[0].events[0].text.split('\n').map(l=>l.split(':')[0]),['Your tale begins.','Where','What is happening','What you could do first']);assert.ok(/\nWho is here: /.test(g.journal.entries[0].text));
 const slide=r.worldPlace(g,place(g,'The Log Slide'));assert.equal(slide.danger,'lair');assert.equal(slide.threat.template,'wolf','chapter 1\'s set piece is armed');
 assert.deepEqual(plain(g.pace.stakes),{s1:'holding on',s2:'one sack lost in the dark'},'the stakes as written');assert.equal(g.pace.due,null,'nothing due as the tale begins');
 // The errand's rules: below level 3 a pack becomes one creature and no ally stands beside it; from level 3 the pack.
 const packed=copy(s=>{ch(s,0).fight.threat={template:'wolves',name:'The Camp Wolves',appearance:'A pair of grey wolves with torn ears and meal dust on their muzzles.',ally:{template:'boar',name:'A Rooting Boar',appearance:'A bristled boar with yellow tusks and a muddy snout.'}};});
 assert.equal(r.worldPlace(seat(packed),'p1').threat.template,'wolf','a pack is one creature at level 1');assert.equal(r.worldPlace(seat(packed),'p1').threat.ally,undefined,'and stands alone');
 const lvl3=seat(packed,{...kara,level:3});assert.equal(lvl3.world.places.find(p=>p.id==='p1').threat.template,'wolves','a pack from level 3');assert.equal(lvl3.world.places.find(p=>p.id==='p1').threat.ally.template,'boar','with its ally');
 // fromLevel and otherwise: below the level, the other creature.
 const later=copy(s=>{ch(s,0).fight.fromLevel=3;ch(s,0).fight.otherwise={template:'boar',name:'A Hungry Boar',appearance:'A rangy boar with a torn ear, rooting at the meal sack.'};});
 assert.equal(r.worldPlace(seat(later),'p1').threat.template,'boar','below fromLevel: otherwise');assert.equal(seat(later,{...kara,level:3}).world.places.find(p=>p.id==='p1').threat.template,'wolf','from it: the threat');
 // A tale with no staging is seated exactly as before; writtenCheck passes the fixture and refuses what the engine
 // cannot play.
 const {staging,foeVoice,...old}=copy();const before=seat(old);assert.equal(before.pace,undefined);assert.equal(r.isStaged(before),false);assert.equal(r.worldPlace(before,'p1').threat,undefined,'no set piece without a staging');
 assert.deepEqual(plain(r.writtenCheck(copy())),{ok:true,problems:[]});
 const bad=r.writtenCheck(copy(s=>{ch(s,0).fight.at='Kettle Camp';ch(s,0).beats[0].then={bring:'Mabry Thorne',arm:{at:'The Split Oak',template:'boar',name:'A Boar',appearance:'A boar with tusks and mud.',ally:null}};ch(s,0).found.any[0]={reach:'Nowhere Mere'};}));
 assert.equal(bad.ok,false);for(const p of [/fight: a fight at a starting place/,/bring: keeper and mara are never moved/,/arm: a fight at a starting place/,/"Nowhere Mere" names nothing/])assert.ok(bad.problems.some(x=>p.test(x)),'writtenCheck: '+p);
 // A chapter with no pressure steps could stall for ever: the shelf refuses it (the review of 2026-10-22).
 {const stall=r.writtenCheck(copy(s=>{delete ch(s,0).pressure;}));assert.equal(stall.ok,false);assert.ok(stall.problems.some(x=>/chapters\[0\]\.pressure: a chapter needs pressure steps/.test(x)),'writtenCheck: a chapter without pressure steps');}
}

// ---------- 2. Events kept for the chapter, who spoke, quiet ----------
{
 let g=seat(copy());
 g=travel(g,place(g,'Fernmoot Spring')).game;assert.ok(g.pace.seen.includes('reach:p2'),'reach: an arrival at a named place');assert.equal(g.pace.turns,1);
 // DM-told words: those who speak count once a turn; a turn the game told counts nobody.
 const selwyn=person(g,'Brother Selwyn Ashe');
 g=talk(g,{dialogue:[{speakerId:selwyn,text:'The bell rings at dusk.'},{speakerId:selwyn,text:'Every night.'}],npcId:selwyn}).game;assert.equal(g.pace.spoke[selwyn],1,'spoke: one a turn');
 g=settle(g,null,{question:'Hm.',narration:'Quiet.',dialogue:[{speakerId:selwyn,text:'Yes.'}],npcId:selwyn,told:'game'}).game;assert.equal(g.pace.spoke[selwyn],1,'a turn the game told counts nobody');
 // The lead closes by its condition (reach the spring and two exchanges with the hermit), paid once.
 g=talk(g,{dialogue:[{speakerId:selwyn,text:'Sit with me.'}],npcId:selwyn}).game;assert.equal(g.story.leads[0].done,true,'a lead closed by its condition');
 // Quiet: a move of talk adds one half-move, any other quiet move two; something happening sets it to nought.
 const q0=g.pace.quiet;g=talk(g,{dialogue:[{speakerId:selwyn,text:'Mm.'}],npcId:selwyn}).game;assert.equal(g.pace.quiet,q0+1,'talk adds one');
 g=talk(g).game;assert.equal(g.pace.quiet,q0+3,'a quiet move without talk adds two');
 // A long rest at the start owes nothing unless the tale's clock ticks on rests; checks and searches are kept where made.
 const camp=travel(g,'inn').game,rested=settle(camp,'long-rest',{question:'I rest.',narration:'You sleep.',dialogue:[],npcId:null}).game;assert.ok(rested.pace.seen.includes('rest'),'rest: kept for the chapter');assert.equal(rested.pace.owed,camp.pace.owed,'no step owed for a rest by default');
 const hard=seat(copy(s=>{s.staging.ticks={rest:true};}));const hardRested=settle(hard,'long-rest',{question:'I rest.',narration:'You sleep.',dialogue:[],npcId:null}).game;assert.equal(hardRested.pace.owed>=1||hardRested.pace.step>=1,true,'a tale that ticks on rests owes a step');
 const check={skill:'Investigation',ability:'Intelligence',dc:10,mode:'normal',reason:'A close look.',success:'Found.',failure:'Found, at a cost.',damageCount:0,damageDie:4,damageOn:'none'};
 const checked=settle(seat(copy(s=>{s.staging.places={...s.staging.places,'Kettle Camp':{colour:['The kettle steams over the fire.']}};})),{type:'ai-check',check},{question:'I search the camp closely.',narration:'You search.',dialogue:[],npcId:null},{dice:()=>0}).game;assert.ok(checked.pace.seen.includes('checked:inn'),'checked: a check where the staging names the place, passed or failed');
 // A fight won at the set piece (won, clear) and the fallen searched there (searched).
 let f=travel(seat(copy()),'p1').game;assert.equal(f.stage,'combat','the set piece on arrival');assert.equal(f.pace.turns,0,'a move into a fight is no calm move');
 const won=fightIt(f);assert.ok(won.game.pace.seen.includes('won:p1'),'won');assert.equal(r.beatHolds(won.game,{clear:'The Log Slide'}),true,'clear');
 assert.equal(r.paceDueKey(won.game.pace.due),'beat:b1','the beat that clearing it brings is due once the fight is over');
 const searched=settle(won.game,{type:'loot'},{question:'I search the fallen.',narration:'You search.',dialogue:[],npcId:null,beats:['beat:b1']},{health:won.health}).game;
 assert.ok(searched.story.chapter===1,'searching the slide is chapter 1\'s find');assert.ok(searched.pace.told.includes('b1'),'and the beat its request carried is told');
}

// ---------- 3. Every effect, in one beat; an offer that waits; the foe is no person ----------
{
 const story=copy(s=>{const b=ch(s,0).beats[0];b.when={reach:'Fernmoot Spring'};b.then={bring:'Nim Corley',send:{who:'Hester Gale',to:'The Old Sawpit'},arm:{at:'The Deer-Park Wall',template:'boar',name:'The Old Park Boar',appearance:'A huge boar with yellowed tusks and a scarred snout.',ally:null},place:{at:'The Split Oak',description:'The split oak is burned black down one side.',danger:'risky'},stake:{s1:'half the camp packed'},give:{name:'Hermit\'s Bell-Rope',note:'A frayed rope of plaited willow.'},attitude:{who:'Dob Harker',to:'unfriendly',memory:'The stranger went off to the hermit while the camp burned.'},offer:'Linnet Spey',fact:'The hermit\'s bell rang once as the stranger arrived.',lead:{open:'l1'},flag:'bell-heard',decide:{stell:'refuse'},clock:1,boss:{hurt:true}};});
 let g=seat(story);const at=travel(g,'p2');g=at.game;
 assert.equal(r.paceDueKey(g.pace.due),'beat:b1','the beat fired on arrival');
 const nim=person(g,'Nim Corley'),hester=person(g,'Hester Gale'),dob=person(g,'Dob Harker');
 assert.equal(g.people[nim].home,'p2');assert.equal(g.people[nim].hidden,undefined,'bring: present, no longer hidden');
 assert.equal(g.people[hester].home,place(g,'The Old Sawpit'),'send');
 const wall=r.worldPlace(g,place(g,'The Deer-Park Wall'));assert.equal(wall.danger,'lair');assert.equal(wall.threat.template,'boar','arm');
 assert.equal(r.worldPlace(g,'bridge'),null,'the stronghold is no world place');assert.equal(g.pace.stakes.s1,'half the camp packed','stake');
 assert.ok(g.pack.items.some(i=>i.name==='Hermit\'s Bell-Rope'&&i.kind==='quest'),'give');assert.equal(r.beatHolds(g,{carry:'hermit\'s bell-rope'}),true,'carry, case aside');
 assert.equal(g.npcMemory[dob].attitude,'unfriendly');assert.ok(g.npcMemory[dob].memories.at(-1).startsWith('The stranger went off'),'attitude, with a memory');
 assert.ok(g.pace.offers.includes('mara')&&!g.joinOffers?.mara,'offer: waits while Linnet is not with the hero');
 assert.ok(g.worldFacts.includes('The hermit\'s bell rang once as the stranger arrived.'),'fact');assert.ok(g.pace.leads.includes('l1'),'lead opened');assert.ok(g.pace.flags.includes('bell-heard'),'flag');
 assert.equal(g.pace.marks.stell,'refuse','decide: the choice let lapse');assert.ok(at.events.includes('Left to fate: Refuse and drive him out.'),'with its line');assert.equal(g.npcMemory.mara?.attitude,'friendly','and what it costs');
 assert.equal(g.pace.owed,1,'clock +1 owes a step');
 // The offer is made once Linnet is with the hero (back at the camp), and stays until she joins.
 let back=travel(g,'inn',{beats:told(g)}).game;assert.ok(back.joinOffers?.mara,'the offer is made where she is');assert.ok(r.dmChoices(kara,back,null).some(c=>c.id==='join:mara'),'"Take Linnet along" is offered');
 back=settle(back,{type:'accept-offer',id:'mara'},{question:'Come with me, Linnet.',narration:'She comes.',dialogue:[],npcId:null}).game;assert.equal(back.followers.mara.status,'following');assert.ok(!back.pace.offers.includes('mara'),'and the waiting offer is gone');
 // Held: a step held back does not fire (the clock still moved: owed spent).
 const held=seat(copy(s=>{ch(s,0).beats[0].when={reach:'Fernmoot Spring'};ch(s,0).beats[0].then={clock:-1};}));let h=travel(held,'p2').game;assert.equal(h.pace.held,1,'clock -1 holds the next step back');
 // The foe is never a person of the tale: introducing its name (with or without "The") is refused.
 const sketch={name:'The Corran Stell',role:'A poacher.',appearance:'A lean man in a green coat.',toughness:'common',attitude:'indifferent',foe:'neutral'};
 for(const name of ['Corran Stell','the corran stell'])assert.match(r.introducePerson(seat(copy()),{...sketch,name},kara).error,/your foe/,'introducePerson refuses the foe ('+name+')');
}

// ---------- 4. One thing due at a time; never in a fight; the find first; told by the request that carried it ----------
{
 // Two beats that both hold: the first fires, the second waits until the first is told.
 const two=copy(s=>{ch(s,0).beats=[{id:'b1',when:{reach:'Fernmoot Spring'},if:null,tell:'The bell rings once.',line:'The bell rings once.',then:{}},{id:'b9',when:{reach:'Fernmoot Spring'},if:null,tell:'A second sound.',line:'A second sound.',then:{}}];});
 let g=travel(seat(two),'p2').game;assert.equal(r.paceDueKey(g.pace.due),'beat:b1');assert.ok(!g.pace.fired.includes('b9'),'one thing due at a time');
 const notTold=talk(g).game;assert.equal(r.paceDueKey(notTold.pace.due),'beat:b1','a turn that did not carry it (an older client, a failed request) leaves it due');
 const toldIt=talk(g,{beats:['beat:b1']}).game;assert.ok(toldIt.pace.told.includes('b1'));assert.equal(r.paceDueKey(toldIt.pace.due),'beat:b9','the next fires once the first is told');
 // A beat carried by a request whose turn the game told (offline): the game's own line, beatTold.
 const offline=r.withBeatLine({narration:'You look about.'},g);assert.equal(offline.beatTold,'beat:b1');assert.ok(offline.narration.endsWith('The bell rings once.'),'the beat\'s own line after the telling');
 const offlineTold=settle(g,null,{question:'I look.',narration:offline.narration,dialogue:[],npcId:null,told:'game',beatTold:offline.beatTold}).game;assert.ok(offlineTold.pace.told.includes('b1'),'beatTold marks it told');
 // A spared step is not told; told never holds a step that was spared.
 // Never in a fight: a beat whose moment comes while fighting waits for the fight's end, and is not carried meanwhile.
 const inFight=copy(s=>{ch(s,0).beats=[{id:'b1',when:{at:'The Log Slide'},if:null,tell:'Wolf-tracks everywhere.',line:'Wolf-tracks everywhere.',then:{}}];});
 let f=travel(seat(inFight),'p1').game;assert.equal(f.stage,'combat');assert.equal(f.pace.due,null,'no beat fires in a fight');assert.equal(r.beatDue(f),null);
 // Only a fight's own due thing is told in it (a hold, a deadline, the foe bloodied: verify-fight-shape.cjs).
 const held=copy(s=>{ch(s,0).fight={...ch(s,0).fight,hold:{rounds:2,tell:'The wolf circles and will not close.'}};ch(s,0).beats=[{id:'b1',when:{at:'The Log Slide'},if:null,tell:'Wolf-tracks everywhere.',line:'Wolf-tracks everywhere.',then:{}}];});
 const heldUp=travel(seat(held),'p1').game;assert.equal(heldUp.pace.due,null,'still no calm beat in the fight');assert.equal(r.paceDueKey(r.beatDue(heldUp)),'hold:c1','the hold is told as the fight begins');
 const fought=fightIt(f);assert.equal(r.paceDueKey(fought.game.pace.due),'beat:b1','it fires once the fight is over');
 // The find first: a route holding replaces a beat due but untold (the truth is due, with what closed the chapter).
 const both=copy(s=>{ch(s,0).beats=[{id:'b1',when:{reach:'Fernmoot Spring'},if:null,tell:'The bell rings.',line:'The bell rings.',then:{}}];});
 let b=travel(seat(both),'p2').game;assert.equal(r.paceDueKey(b.pace.due),'beat:b1');
 b=travel(b,place(b,'The Old Sawpit')).game;assert.equal(b.story.chapter,1,'reaching the sawpit is a route');assert.equal(r.paceDueKey(b.pace.due),'turn:found:1','the truth replaces the untold beat');
 assert.ok(b.pace.fired.includes('b1')&&!b.pace.told.includes('b1'),'the older one fired, never told');
 assert.match(r.beatLineOf(b),/^The wolf was led to the camp/,'the truth in the game\'s own words');
}

// ---------- 5. The preview and the commit agree; routine moves give way while a beat is due ----------
{
 const g=seat(copy(s=>{ch(s,0).beats[0].when={reach:'Fernmoot Spring'};}));
 const action={type:'travel',destination:'p2'},rolls=[],draw=()=>{const v=0.37;rolls.push(v);return v;};
 const preview=r.stagedPreview(g,r.adventureStep(g,null,kara,action,draw),kara,action);
 assert.equal(r.paceDueKey(preview.game.pace.due),'beat:b1','the preview stages the move');
 assert.equal(r.routineTelling({hero:kara,before:g,preview,health:null,action,words:'I travel to Fernmoot Spring.',preferences:{}}),null,'a routine journey gives way to the beat');
 assert.equal(r.beatSent(preview.game,{engineResolved:['You travel.']}),'beat:b1','its request carries the beat');
 let i=0;const commit=settle(g,action,{question:'I travel to Fernmoot Spring.',narration:'You arrive.',dialogue:[],npcId:null,beats:['beat:b1']},{dice:()=>rolls[i++]??0.5}).game;
 for(const k of ['fired','seen','stakes','marks','flags','offers','leads','step','owed','held','ch','turns'])assert.deepEqual(plain(commit.pace[k]),plain(preview.game.pace[k]),'preview and commit agree: '+k);
 assert.deepEqual(plain(commit.world),plain(preview.game.world),'and on the world');assert.deepEqual(plain(commit.people),plain(preview.game.people),'and on the people');
 assert.ok(commit.pace.told.includes('b1')&&commit.pace.due===null,'the commit marks the carried beat told');
 // The reply's own additions (gold handed over, words spoken) never change what the move brings due (the review of
 // 2026-10-22: a pressure step fired on quiet in the preview and was told, then the commit, counting the reply's gold
 // as something happening, fired nothing; with the last steps it closed no chapter whose truth had been told).
 for(const fired of [0,2]){
  let q=seat(copy());const steps=ch(fixture.story,0).pressure.map(p=>p.id);
  if(fired)q={...q,pace:{...q.pace,step:fired,fired:[...q.pace.fired,...steps.slice(0,fired)],told:[...q.pace.told,...steps.slice(0,fired)]}};
  for(let i=0;i<2;i++)q=talk(q,{words:'I wait.'}).game;
  const hp=r.combatBasics(kara).hp,health={current:hp-5,maximum:hp,temp:0},act='short-rest';
  const pv=r.stagedPreview(q,r.adventureStep(q,health,kara,act,()=>0.5),kara,act),key=r.beatSent(pv.game,{engineResolved:true});
  assert.ok(key,'the preview of the rest brings the clock\'s step due ('+fired+' fired)');
  const here=r.npcScene(q).filter(n=>n.present&&(n.hp??0)>0).map(n=>n.id).slice(0,1);
  const done=settle(q,act,{question:'I rest.',narration:'You rest; a few coins glint in the straw.',dialogue:here.map(id=>({speakerId:id,text:'Rest while you can.'})),npcId:null,loot:{gold:3,items:[],reason:'Coins in the straw.'},beats:[key]},{health}).game;
  for(const k of ['fired','step','ch','stakes'])assert.deepEqual(plain(done.pace[k]),plain(pv.game.pace[k]),'with gold and words in the reply, the commit still agrees with the preview ('+fired+' fired): '+k);
  assert.equal(done.story.chapter,pv.game.story.chapter,'and closes the chapter the preview closed');assert.equal(done.pace.due,null,'what the request carried is told');
 }
 // With nothing due, the same journey back is told by the game.
 const quiet=seat(copy());let v=travel(quiet,'p2').game;v=travel(v,'inn').game;
 const back={type:'travel',destination:'p2'},pv=r.stagedPreview(v,r.adventureStep(v,null,kara,back,()=>0.5),kara,back);
 if(!r.beatKey(pv.game))assert.ok(r.routineTelling({hero:kara,before:v,preview:pv,health:null,action:back,words:'I travel to Fernmoot Spring.',preferences:{}}),'a journey back is told by the game when nothing is due');
 // A written place's colour replaces the arrival line, and the clock's sign is told once on a journey the game tells.
 const told2=r.calmTelling({hero:kara,before:v,after:pv.game,action:back,events:pv.events,kind:'journey'});assert.ok(told2.narration.includes('Ferns crowd the hollow'),'the place\'s own colour');
 const signed={...pv.game,pace:{...pv.game.pace,sign:'Two cutters are loading a cart to leave.'}};assert.ok(r.calmTelling({hero:kara,before:v,after:signed,action:back,events:pv.events,kind:'journey'}).narration.endsWith('Two cutters are loading a cart to leave.'),'the sign, once');
 const seenSign={...v,playback:[...(v.playback??[]),{id:999,events:[{kind:'narration',text:'Two cutters are loading a cart to leave.'}]}]};assert.ok(!r.calmTelling({hero:kara,before:seenSign,after:signed,action:back,events:pv.events,kind:'journey'}).narration.includes('loading a cart'),'never twice');
}

// ---------- 6. The clock ----------
{
 // Quiet: three quiet moves (no talk) fire the first step; it is due; once told, quiet starts again.
 let g=seat(copy());const first=ch(fixture.story,0).pressure;
 for(let i=0;i<3;i++)g=talk(g,{beats:told(g)}).game;
 assert.equal(r.paceDueKey(g.pace.due),'pressure:p1','quiet fires the first step');assert.equal(g.pace.sign,first[0].sign,'its sign is the Quest tab\'s line');assert.equal(g.pace.stakes.s1,'two carts loaded to leave','its effects apply');
 g=talk(g,{beats:told(g)}).game;assert.ok(g.pace.told.includes('p1'));
 // Two moves at least between clock beats.
 const at=g.pace.turns;g=talk(g).game;assert.equal(g.pace.step,1,'no second step at once');assert.equal(g.pace.clockAt,at-1);
 // Drift: a step owed every "drift" calm moves, whatever happens.
 const busy=seat(copy(s=>{s.staging.drift=4;ch(s,0).complications=[];}));let d=busy;let steps=[];for(let i=0;i<9;i++){d=talk(d,{dialogue:[{speakerId:'keeper',text:'Hm.'}],npcId:'keeper',beats:told(d)}).game;steps.push(d.pace.step);}
 assert.ok(steps.includes(1),'drift owes a step');
 // Spared: a step whose `if` does not hold is told as spared, its effects skipped, the clock moved.
 const spare=seat(copy(s=>{const p=ch(s,0).pressure[0];p.if={flag:'never-set'};p.spared={tell:'The wolves hold off tonight.',line:'The wolves hold off tonight.',sign:'The wolves held off.'};ch(s,0).then={flag:'never-set'};}));
 let sp=spare;for(let i=0;i<3;i++)sp=talk(sp,{beats:told(sp)}).game;
 assert.equal(r.paceDueKey(sp.pace.due),'pressure:p1');assert.ok(sp.pace.fired.includes('spared:p1'),'spared');assert.equal(sp.pace.stakes.s1,'holding on','its effects skipped');assert.equal(sp.pace.sign,'The wolves held off.');
 assert.equal(r.taleNow(sp).beat.tell,'The wolves hold off tonight.','the spared telling is told');sp=talk(sp,{beats:told(sp)}).game;assert.ok(!sp.pace.told.includes('p1'),'a spared step is never told');
 // Days: a road of a day owes a step (ticks.days), never more than the chapter has left.
 const far=seat(copy(s=>{s.landmarks[2].miles=12;s.landmarks[2].from='inn';s.staging.ticks={days:2};}));let fd=far;for(const id of ['p3','inn','p3','inn','p3'])fd=travel(fd,id,{beats:told(fd)}).game;assert.ok(fd.pace.owed+fd.pace.step>=1,'days on the road owe steps');assert.ok(fd.pace.owed<=3-fd.pace.step,'never more than the chapter has left');
 // The stall bound and the late ending: talk alone closes chapter 1 and ends the tale late, with its default ending.
 let s=seat(copy()),moves=0,closed=[];
 while(s.story.status==='active'&&moves<80){s=talk(s,{dialogue:[{speakerId:'keeper',text:'Well?'}],npcId:'keeper',beats:told(s)}).game;moves++;if(s.story.chapter>closed.length&&closed.length<1)closed.push(moves);}
 assert.equal(s.story.status,'complete','the clock ends a tale nobody pursues');assert.ok(closed[0]<=24&&moves-closed[0]<=24,'each chapter closes within the short stall bound: '+closed[0]+', '+(moves-closed[0]));
 assert.ok(s.pace.flags.includes('late'),'late');assert.equal(s.pace.ending,'gone','the default ending');assert.equal(r.endingOf(s).id,'gone');
 assert.equal(r.paceDueKey(s.pace.due),'ending:q3','the ending is due, with the step that closed it');assert.match(r.taleNow(s).beat.text,/^The carts roll out/);
 assert.ok(s.storyLog.some(e=>e.text==='Ending: The Carts Roll Out.')&&s.storyLog.some(e=>/^Left to fate: Refuse/.test(e.text)),'the story log keeps the choice let lapse and the ending');
 // The passive and violent players of the walkthrough runner end too.
 for(const mode of ['passive','violent']){const w=W.walkTale({r,story:copy(),hero:r.readyHero('fighter'),mode,seed:1});assert.ok(w.ok,mode+': '+w.error);assert.ok(w.chapters.every((c,i,all)=>c.moves-(i?all[i-1].moves:0)<=34),mode+' chapters close near the stall bound');}
}

// ---------- 7. Choices ----------
{
 let g=seat(copy());g=travel(g,place(g,'The Log Slide')).game;g=fightIt(g).game;
 g=settle(g,{type:'loot'},{question:'I search.',narration:'You search.',dialogue:[],npcId:null,beats:told(g)}).game;assert.equal(g.story.chapter,1);
 assert.equal(r.stagingChoices(kara,g).length,0,'not offered before it opens');
 g=talk(g,{beats:told(g)}).game;g=travel(g,'bridge',{beats:told(g)}).game;
 for(let i=0;i<4&&r.paceDueKey(g.pace.due)!=='choice:stell';i++)g=talk(g,{beats:told(g)}).game;
 assert.equal(r.paceDueKey(g.pace.due),'choice:stell','the choice opens once the oak is reached and nothing else is due');assert.equal(r.taleNow(g).beat.ask,ch(fixture.story,1).choice.ask);
 const offered=r.stagingChoices(kara,g);assert.deepEqual(offered.map(c=>c.id),['tale-choice:stell:bargain','tale-choice:stell:refuse']);assert.ok(offered.every(c=>/^The player commits to: .+ \(ONLY when their words or deeds clearly choose it\)$/.test(c.label)));
 assert.ok(r.dmChoices(kara,g,null).some(c=>c.id==='tale-choice:stell:bargain'),'in the Dungeon Master\'s choices');assert.ok(!r.quickActions(kara,g,null).some(c=>/tale-choice/.test(c.key??c.id??'')),'never a chip');
 assert.deepEqual(plain(r.taleSayLines(g)),ch(fixture.story,1).choice.options.map(o=>o.say),'Suggestions offer each option\'s line');
 const many=Array.from({length:40},(_,i)=>({id:'travel-p'+i,label:'x'}));assert.ok(r.offeredChoices([...many,...offered.map(c=>({id:c.id,label:c.label}))]).some(c=>c.id.startsWith('tale-choice:')),'kept within the thirty');
 const made=settle(g,'tale-choice:stell:bargain',{question:'Keep your deer park.',narration:'He nods.',dialogue:[],npcId:null,beats:told(g)});
 assert.ok(made.events.includes('You chose: Accept his terms.'));assert.equal(made.game.story.status,'complete','the bargain at the oak is chapter 2\'s find: the tale ends');assert.equal(made.game.pace.ending,'terms','the first ending that holds');
 assert.equal(made.game.npcMemory.keeper.attitude,'unfriendly','the choice costs what it says');
 assert.match(r.adventureStep(made.game,null,kara,'tale-choice:stell:refuse',()=>0.5).error??'',/not before you/,'a choice made is closed');
 // An option's when: the engine settles it itself; an option's if: offered only while it holds.
 const settled=seat(copy(s=>{ch(s,0).choice={id:'trail',opens:null,ask:'Follow the trail or guard the camp?',options:[{id:'follow',label:'Follow the trail',say:'I follow the trail.',if:null,when:{reach:'Fernmoot Spring'},then:{flag:'followed'}},{id:'guard',label:'Guard the camp',say:'I stay and guard.',if:{flag:'never-set'},when:null,then:{}}],late:'follow'};ch(s,1).then={flag:'never-set'};}));
 let t=talk(settled).game;assert.equal(r.paceDueKey(t.pace.due),'choice:trail','a choice that opens as the chapter begins');assert.deepEqual(r.stagingChoices(kara,t).map(c=>c.id),['tale-choice:trail:follow'],'an option whose if does not hold is not offered');
 t=travel(t,'p2',{beats:told(t)}).game;assert.equal(t.pace.marks.trail,'follow','settled by its when');assert.ok(t.pace.flags.includes('followed'));
 // An option that closes the chapter: the truth is due, named by its choice (ids of the longest shape stay valid).
 const longIds=seat(copy(s=>{ch(s,0).choice={id:'a-turning-point-long-id1',opens:null,ask:'Run for the sawpit now, or stay?',options:[{id:'an-option-with-long-id1',label:'Run for the sawpit',say:'I run for the sawpit.',if:null,when:null,then:{advance:true}},{id:'stay',label:'Stay',say:'I stay.',if:null,when:null,then:{}}]};ch(s,1).then={};}));
 let lid=talk(longIds).game;lid=settle(lid,'tale-choice:a-turning-point-long-id1:an-option-with-long-id1',{question:'I run for the sawpit.',narration:'You run.',dialogue:[],npcId:null,beats:told(lid)}).game;
 assert.equal(lid.story.chapter,1,'an option that closes the chapter');assert.equal(r.paceDueKey(lid.pace.due),'turn:opt:a-turning-point-long-id1','its truth due, named by its choice');
 // In a fight no choice is offered.
 let fightChoice=travel(settled,'p1').game;assert.equal(r.stagingChoices(kara,fightChoice).length,0,'none in a fight');
}

// ---------- 8. The foe held back; no road beyond the map; story-advance; story-complete not offered ----------
{
 let g=seat(copy(s=>{s.landmarks[0].danger='safe';}));g=travel(g,'bridge').game;
 assert.equal(r.bossOpen(g),false,'chapter 1 of a tale whose foe is met from chapter 2');assert.ok(!r.dmChoices(kara,g,null).some(c=>c.id==='approach'||c.id.startsWith('encounter-attack')),'no confronting it');
 assert.match(r.adventureStep(g,null,kara,'approach',()=>0.5).error,/beyond your reach for now/,'and the engine refuses it');
 assert.ok(r.dmContext(kara,g,null,'x').quest.bossLater===true);
 assert.match(r.beyondError(g,'N'),/keeps to its own land/,'no road beyond the map before the last chapter');
 // The Dungeon Master is offered story-advance only once the chapter's set piece is beaten (and its choice made, when it
 // has one): before that the scene carries no truth to tell early, and the move is refused (the review of 2026-10-22:
 // a story-advance on the first move skipped the set piece and paid the chapter's experience).
 assert.ok(!r.dmChoices(kara,g,null).some(c=>c.id==='story-advance'),'no story-advance before the set piece is beaten');
 assert.equal(r.dmContext(kara,g,null,'x').quest.truth,undefined,'and no truth in the scene to tell early');
 assert.match(r.settleTurn({hero:kara,game:g,health:null,action:'story-advance',conversation:{question:'I tell them what I found.',narration:'The truth comes out.',dialogue:[],npcId:null},random:()=>0.5}).error,/no longer available/,'the move is refused at the commit');
 {const choiceTale=seat(copy(s=>{s.landmarks[0].danger='safe';s.staging.chapters[0].choice={id:'test',opens:null,ask:'Which way?',options:[{id:'a',label:'Go left',say:'I go left.',if:null,when:null,then:null},{id:'b',label:'Go right',say:'I go right.',if:null,when:null,then:null}]};})),at=place(choiceTale,ch(fixture.story,0).fight.at);
  const beaten={...choiceTale,world:{...choiceTale.world,places:choiceTale.world.places.map(p=>p.id===at?{...p,cleared:true}:p)}};
  assert.ok(!r.dmChoices(kara,beaten,null).some(c=>c.id==='story-advance'),'nor while the chapter\'s choice is still to be made');
  const chosen={...beaten,pace:{...beaten.pace,marks:{test:'a'},fired:[...beaten.pace.fired,'choice:test','chosen:test']}};
  assert.ok(r.dmChoices(kara,chosen,null).some(c=>c.id==='story-advance'),'then it is offered');assert.ok(r.dmContext(kara,chosen,null,'x').quest.truth,'with the truth to tell');}
 g={...g,world:{...g.world,places:g.world.places.map(p=>p.id===place(g,ch(fixture.story,0).fight.at)?{...p,cleared:true}:p)}};
 assert.ok(r.dmChoices(kara,g,null).some(c=>c.id==='story-advance'),'the set piece beaten (a chapter with no choice): offered');
 // The Dungeon Master's story-advance closes the chapter as the engine does: the chapter's find given, its then and
 // its choice's late, the next chapter's opening due.
 const adv=settle(g,'story-advance',{question:'I tell them what I found.',narration:'The truth comes out.',dialogue:[],npcId:null}).game;
 assert.equal(adv.story.chapter,1);assert.equal(r.paceDueKey(adv.pace.due),'opening:opening:2','the next chapter\'s opening is due');
 assert.ok(adv.pack.items.some(i=>i.name==='Strip of Deer Hide'),'the find\'s item, however the chapter closes');assert.ok(adv.pace.offers.includes('mara')||adv.joinOffers?.mara,'the chapter\'s then');
 assert.equal(r.bossOpen(adv),true,'and from chapter 2 the foe can be met');
 assert.ok(!r.dmChoices(kara,adv,null).some(c=>c.id==='story-complete'),'a written tale ends where the engine finds it ends: no story-complete');
 // A brawl at the stronghold: the foe is not offered as a target (the engine would leave it untouched and the commit
 // refuse the move: the review of 2026-10-22).
 {const at={...adv,stage:'bridge'},brawl={...at,npcCombat:{active:true,order:[{id:'keeper',side:'enemy',init:10}],turn:0,round:1}};
  assert.ok(r.dmChoices(kara,at,null).some(c=>c.id.startsWith('encounter-attack')),'the foe is a target at the stronghold');
  assert.ok(!r.dmChoices(kara,brawl,null).some(c=>/^encounter-(?:attack|throw)/.test(c.id)),'but not during a brawl there');}
 // A lead that opens in a later chapter is neither shown nor ticked before it (noteLead refuses it).
 {const later=seat(copy(s=>{s.staging.leads[0].opens=2;}));
  assert.equal(r.leadOpenNow(later,'l1'),false);assert.equal(r.noteLead(later,'l1'),later,'a lead not yet open cannot be ticked');
  assert.ok(!(r.dmContext(kara,later,null,'x').quest?.openLeads??[]).some(l=>l.id==='l1'),'nor told to the Dungeon Master');
  const open=seat(copy());assert.notEqual(r.noteLead(open,'l1'),open,'an open lead can');}
}

// ---------- 9. What the Dungeon Master reads; the opening turn ----------
{
 const g=seat(copy());
 const ctx=r.dmContext(kara,g,null,'I take the lantern.');assert.equal(ctx.story.staging,undefined);assert.equal(ctx.story.written,undefined,'the plan and the shelf tag never reach the Dungeon Master');
 assert.equal(ctx.quest.where,ch(fixture.story,0).where);assert.equal(ctx.quest.agenda,ch(fixture.story,0).agenda);assert.equal(ctx.quest.pace,'Short tale, chapter 1 of 2.');
 assert.deepEqual(plain(ctx.taleNow),{stakes:[{name:'Kettle Camp',state:'holding on'},{name:'The meal stores',state:'one sack lost in the dark'}]});
 assert.deepEqual(plain(r.taleSayLines(g)),fixture.story.staging.firstSay,'the opening turn offers firstSay');
 // A lead that opens in a later chapter is not told before it.
 const lateLead=seat(copy(s=>{s.staging.leads[0].opens=2;}));assert.equal(r.dmContext(kara,lateLead,null,'x').quest.openLeads.length,0,'a lead opened later is not told');assert.ok(!r.dmChoices(kara,lateLead,null).some(c=>c.id.startsWith('lead-done')));
 // A set piece's objective is read in its fight.
 const fight=travel(g,'p1').game;assert.equal(r.dmContext(kara,fight,null,'x').encounter.objective,ch(fixture.story,0).fight.objective);
}

// ---------- 10. At a table: a beat told through the campaign server ----------
(async()=>{
 const {resolveTurn}=require('./server-turn.cjs'),R=require('./rules-engine.cjs').rules();
 const hero=R.readyHero('fighter'),story=copy(s=>{ch(s,0).beats[0].when={reach:'Fernmoot Spring'};});
 let table=R.startParty(R.adventureSnapshot(hero,R.newAdventure(hero),null,true),'seat-'+'a'.repeat(16),'Ann');
 const wiz=R.readyHero('wizard');table=R.joinParty(table,'seat-'+'b'.repeat(16),{character:JSON.stringify(wiz),game:R.newAdventure(wiz),health:null,name:'Bo'}).snapshot;
 table=R.partyInTale(table,'seat-'+'a'.repeat(16),story,'written').snapshot;assert.ok(table.game.pace,'a table seats the plan');
 const asked=[],ask=async body=>{asked.push(body);return {narration:'It is told.',dialogue:[],suggestions:[]};};
 const go=R.mapMoves(table.game).find(m=>m.action.type==='travel'&&m.action.destination==='p2');
 let out=await resolveTurn(table,{question:'I travel to Fernmoot Spring.',action:go.action},{ask,randomImpl:()=>0.5});
 assert.equal(asked.at(-1).context.taleNow.beat.id,'b1','the journey\'s telling carries the beat it brings');assert.ok(out.snapshot.game.pace.told.includes('b1'),'the campaign server marks it told');
 assert.ok(R.validAdventure(out.snapshot,hero),'the table stays valid');
 // A talk turn after: nothing more due; the stakes and the plan's place are read the same way.
 out=await resolveTurn(out.snapshot,{question:'I listen for the bell.'},{ask,randomImpl:()=>0.5});assert.equal(asked.at(-1).context.taleNow.beat,undefined);
 // Every member sees the same pace.
 assert.deepEqual(plain(R.partyView(out.snapshot,'seat-'+'b'.repeat(16)).game.pace),plain(out.snapshot.game.pace),'the pace is world state, shared at the table');

 // ---------- 11. A rollback: the rules of a build from before written tales load and play a game with a pace ----------
 {let old=null;
  try{const rev='648bddd',show=f=>execFileSync('git',['-C',__dirname,'show',rev+':'+f],{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:64*1024*1024}).replace(/\r\n/g,'\n');
   const files=vm.runInNewContext(show('rules-files.cjs').replace(/module\.exports=[^;]*;/,'')+';rulesFiles',{require,__dirname,module:{},console});
   const src='const catalog='+show('spellCatalog.json')+';const progression='+show('spellProgression.json')+';\n'+files.map(f=>show(f).replace(/^\s*import .*;\n/gm,'').replace(/export /g,'')).join('\n');
   old=vm.runInNewContext(src+'\n;({validAdventure,adventureSnapshot,settleTurn,newAdventure,readyHero})',{AsyncStorage:{},console},{timeout:20000});}catch(e){console.log('verify-staging: the rollback was not tried (no git history: '+String(e.message).split('\n')[0]+')');}
  if(old){const g=seat(copy()),hero2=old.readyHero('fighter');
   assert.ok(old.validAdventure(plain(r.adventureSnapshot(kara,g,null,true)),hero2),'an older build accepts a game with a staging and a pace');
   const s=old.settleTurn({hero:hero2,game:plain(g),health:null,action:null,conversation:{question:'I look around.',narration:'You look.',dialogue:[],npcId:null},random:()=>0.5});assert.ok(!s.error,'and plays a turn of it');
   assert.deepEqual(plain(s.result.game.pace),plain(g.pace),'leaving the pace as it was (the tale plays as an ordinary chaptered story)');}}

 // ---------- 12. The 167 fixture saves ----------
 {const dir=path.join(__dirname,'save-fixtures');let saves=0;
  for(const f of fs.readdirSync(dir).filter(x=>/^\d{4}-\d\d-\d\d-[0-9a-f]{7}\.json$/.test(x)).sort()){
   for(const save of JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).saves){saves++;
    const hero=r.upgradeCharacter(JSON.parse(save.character)),adv=r.upgradeAdventure(save.adventure),game=adv?.game??save.adventure.game;
    // The engine leaves a game without a written tale alone.
    assert.equal(r.withBeats(game,game,hero,{}).game,game,f+' '+save.label+': untouched');assert.equal(r.seatStaging(game,hero),game);
    // Their hero seats a written tale (what they carry comes too) and plays its first move.
    const fresh=r.freshStoryGame(hero,copy(),r.newAdventure(hero,game));valid(fresh,hero);
    const s=r.settleTurn({hero,game:fresh,health:null,action:null,conversation:{question:'I look around.',narration:'You look.',dialogue:[],npcId:null},random:()=>0.5});assert.ok(!s.error,f+' '+save.label+': '+s.error);valid(s.result.game,hero);}}
  assert.equal(saves,167,'every fixture save');}

 // ---------- 13. Total: nothing throws, whatever it is given ----------
 {let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const junk=d=>{const k=Math.floor(rnd()*9);if(d>3||k<2)return [null,undefined,0,-1,1.5,'',true,'x'.repeat(5),NaN][Math.floor(rnd()*9)];if(k<5){const o={};for(let i=0;i<1+Math.floor(rnd()*4);i++)o[['due','pace','fired','seen','marks','story','staging','chapters','kind','id','turns','step','stakes'][Math.floor(rnd()*13)]]=junk(d+1);return o;}return Array.from({length:Math.floor(rnd()*4)},()=>junk(d+1));};
  const base=seat(copy());
  for(let i=0;i<600;i++){
   const a=i%3?junk(0):{...plain(base),pace:junk(1)},b=i%2?junk(0):{...plain(base),pace:{...plain(base.pace),...(junk(1)??{})},story:{...plain(base.story),staging:i%5?plain(base.story.staging):junk(1)}};
   for(const fn of [()=>r.withBeats(a,b,kara,{action:junk(0),conversation:junk(0)}),()=>r.stagedPreview(a,{game:b},kara,null),()=>r.taleNow(b),()=>r.beatLineOf(b),()=>r.stagingChoices(kara,b),()=>r.endingOf(b),()=>r.taleSayLines(b),()=>r.writtenCheck(junk(0)),()=>r.seatStaging(b,kara)])
    assert.doesNotThrow(fn,'never throws (case '+i+')');
  }}
 console.log('Staging: seating by the level rules, events kept for the chapter, every effect, offers that wait, one thing due at a time and never in a fight, the find first, the preview and the commit agreeing, the clock (quiet, drift, rests, days, held and spared steps, the stall bound, the late ending), choices open and settled, the foe held back, story-advance, what the Dungeon Master reads, a beat told at a table, a rollback, the 167 fixture saves, and nothing thrown on fuzzed input.');
})().catch(e=>{console.error(e);process.exit(1);});
