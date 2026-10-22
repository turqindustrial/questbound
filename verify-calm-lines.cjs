// Routine moves away from a fight told by the game (calmLines.js): which calm moves the game tells itself (a rest, a
// draught, a journey back to a place already visited, a search of the fallen with nobody watching, an order to a
// companion, the shield slung or taken up) and which still go to the Dungeon Master (anywhere new, a fight on
// arrival, anyone who could react, a hoard, words that say more than the move); the line book (every case, every
// narrator, varied, no numbers or rule words, a twin told of the hero by name for a table of several heroes); seeded
// tellings; and both paths (a device alone, the campaign server at a table) making no request for a routine calm move.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {rulesSource,readText}=require('./rules-files.cjs');
const {journeyStory}=require('./journey-fixtures.cjs');
const x=vm.runInNewContext(rulesSource()+'\n({readyHero,newAdventure,freshStoryGame,adventureStep,settleTurn,routineTelling,routineCalmTurn,calmFallback,calmTelling,calmLineBook,calmBarks,calmLineCases,plainCalmWords,quickActions,dmChoices,dmCommand,validAdventure,adventureSnapshot,npcScene,sceneLocation,startParty,joinParty,partyView,heroesAtTable})',{AsyncStorage:{}});
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const lcg=(s=7)=>{s=(s*2654435761)%2147483647||1;return ()=>(s=(s*16807)%2147483647)/2147483647;};
const kara=x.readyHero('fighter');
const fresh=hero=>{const g=plain(x.freshStoryGame(hero,journeyStory(0),x.newAdventure(hero)));return {...g,map:{...g.map,accepted:true}};};
const preview=(g,h,hero,action,random=lcg(5))=>{const p=x.adventureStep(g,h,hero,action,random);assert.equal(p.error,undefined,p.error);return p;};
const verdict=(g,h,hero,action,words,random)=>{const p=preview(g,h,hero,action,random);return x.routineCalmTurn(g,p.game,action,words,{events:p.events,waiting:!!p.waiting});};
const routine=(why,...a)=>{const v=verdict(...a);assert.equal(v.routine,true,why+': '+v.why);};
const notable=(why,expect,...a)=>{const v=verdict(...a);assert.equal(v.routine,false,why+' should go to the Dungeon Master');if(expect)assert.match(v.why,expect,why+': '+v.why);};
// Settle a turn as a device does: the game's telling for a routine move, a stand-in Dungeon Master's otherwise.
const settle=(g,h,hero,action,words,prefs={})=>{const p=preview(g,h,hero,action);const told=x.routineTelling({hero,before:g,preview:p,health:h,action,words,preferences:prefs});
 const s=x.settleTurn({hero,game:g,health:h,action,conversation:{question:words,narration:told?.narration??'The Dungeon Master tells it.',dialogue:told?.dialogue??[],...(told?{told:'game'}:{})},random:lcg(5)});
 assert.equal(s.error,undefined,s.error);assert.ok(x.validAdventure(x.adventureSnapshot(hero,plain(s.result.game),s.result.health,true),hero),'the turn keeps the save valid');return {...s.result,told};};

// ---- 1. Journeys: back to a place already visited is the game's; anywhere new is the Dungeon Master's ----
const start=fresh(kara);
notable('a first visit',/somewhere new/,start,null,kara,{type:'travel',destination:'tower'},'I travel to Saltmarsh Chapel.');
const atChapel=settle(start,null,kara,{type:'travel',destination:'tower'},'I travel to Saltmarsh Chapel.');assert.equal(atChapel.told,null,'the first visit was the Dungeon Master\'s');
routine('the road back to the start',atChapel.game,atChapel.health,kara,{type:'travel',destination:'inn'},'I travel to Stillwater Market.');
const back=settle(atChapel.game,atChapel.health,kara,{type:'travel',destination:'inn'},'I travel to Stillwater Market.');
assert.ok(back.told&&/Stillwater Market/.test(back.told.narration),'the telling names where the road ends: '+back.told?.narration);
assert.equal(back.turn.told,'game','the turn is marked as told by the game');assert.equal(back.turn.fightRound,undefined,'a calm turn has no fight round');
routine('a typed journey back',back.game,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
for(const words of ['I travel to Saltmarsh Chapel and pray at the altar.','I go to Saltmarsh Chapel to look for the missing boy.','Can we go to Saltmarsh Chapel?','I sneak back to Saltmarsh Chapel.','"Let us go," I say, and head to Saltmarsh Chapel.','I travel to Saltmarsh Chapel, then rest.'])
 notable('words that say more than the journey: '+words,/words/,back.game,back.health,kara,{type:'travel',destination:'tower'},words);
// A lair on arrival is a fight: the Dungeon Master's.
{const mill=x.dmChoices(kara,start,null).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label));const visited={...start,map:{...start.map,visited:[...start.map.visited,mill.action.destination]}};
 notable('a fight on arrival',/fight/,visited,null,kara,mill.action,'I travel to The Old Mill.');}
// The chips' own sentences are plain requests.
{const hurt={current:4,temp:0};for(const c of x.quickActions(kara,back.game,hurt).filter(c=>c.action&&(['short-rest','potion'].includes(c.action)||c.action.type==='travel')))assert.ok(x.plainCalmWords(c.question),'the chip sentence is a plain request: '+c.question);}

// ---- 2. Rests and draughts ----
const hurt={current:4,temp:0};
routine('a short rest',back.game,hurt,kara,'short-rest','I take a short rest.');
routine('a typed short rest',back.game,hurt,kara,'short-rest','short rest');
routine('a healing draught away from a fight',back.game,hurt,kara,'potion','I drink a healing draught.');
routine('a long rest at the inn',back.game,hurt,kara,'long-rest','I take a long rest.');
notable('a rest with a plan',/words/,back.game,hurt,kara,'short-rest','I take a short rest and ask Tamsin about the mill.');
// A companion knocked senseless who comes round is the Dungeon Master's to tell.
{const g={...back.game,followers:{mara:{status:'following',location:'inn',reason:'Test.',terms:''}},npcHP:{...back.game.npcHP,mara:0},npcFate:{...(back.game.npcFate??{}),mara:'unconscious'}};
 notable('a companion who comes round',null,g,hurt,kara,'long-rest','I take a long rest.');}

// ---- 2b. Moves with story weight go to the Dungeon Master (the stories spec, Phase A4, 2026-10-22) ----
// The walk back after something that mattered (a lair cleared or the tale's own foe beaten, a chapter, lead or tale
// closed, a death) and the first long rest after it are the Dungeon Master's; so is a journey or a rest after two calm
// moves in a row told by the game. A fight won elsewhere (an ambush, a risky place) is not a milestone (the project
// review, 2026-10-22: the spec names a lair cleared).
{const log=back.game.storyLog??[],next=log.at(-1)?.id??0,line=(kind,text,i=1)=>({id:next+i,kind,text});
 const den=back.game.world.places.find(p=>p.danger==='lair'),open=back.game.world.places.find(p=>p.danger!=='lair');assert.ok(den&&open,'a lair and a place that is not one');
 const won={...back.game,storyLog:[...log,line('fight','Fought the Mill wolf at '+den.name+'.'),line('victory','Slew the Mill wolf.',2)]},chaptered={...back.game,storyLog:[...log,line('quest','Finished chapter 1: The Mill.')]};
 const ambushed={...back.game,storyLog:[...log,line('fight','Fought the dire wolf at '+open.name+'.'),line('victory','Slew the dire wolf.',2)]};
 routine('the walk back from an ambush won is the game\'s',ambushed,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 const foe={...back.game,storyLog:[...log,line('victory','Slew '+back.game.story.foe+'.')]};notable('the walk back from the tale\'s own foe beaten',/mattered/,foe,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 notable('the walk back from a lair won',/mattered/,won,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 notable('the walk after a chapter closed',/mattered/,chaptered,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 notable('the first night after it',/mattered/,won,hurt,kara,'long-rest','I take a long rest.');
 routine('a draught after it is still the game\'s',won,hurt,kara,'potion','I drink a healing draught.');
 const walked={...won,storyLog:[...won.storyLog,line('travel','Returned to Saltmarsh Chapel.',3)]};
 routine('the next walk is the game\'s again',walked,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 notable('the night after the walk is still the first since',/mattered/,walked,hurt,kara,'long-rest','I take a long rest.');
 const slept={...walked,storyLog:[...walked.storyLog,line('rest','Took a long rest at Stillwater Market.',4)]};
 routine('the second night is the game\'s',slept,hurt,kara,'long-rest','I take a long rest.');
 const told=t=>({id:t,npcId:null,told:'game',events:[{kind:'narration',text:'You walk on.'}]}),last=back.game.playback?.at(-1)?.id??1;
 assert.equal(back.game.playback.at(-1).told,'game','the journey back was told by the game');const twice={...back.game,playback:[...(back.game.playback??[]),told(last+1)]},once=back.game;
 notable('a third calm move in a row (a journey)',/in a row/,twice,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 notable('a third calm move in a row (a rest)',/in a row/,twice,hurt,kara,'short-rest','I take a short rest.');
 routine('a draught is never sent for it',twice,hurt,kara,'potion','I drink a healing draught.');
 routine('after one, the game tells it',once,back.health,kara,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel');
 // The Dungeon Master is preferred there, never required (the project review, 2026-10-22: past the guests' ceiling a hero
 // who had made two such moves could never travel or rest again): when it cannot answer, the game tells the move
 // (calmFallback); a move that needs it for any other reason has no such telling.
 for(const [g,h,a,w] of [[won,back.health,{type:'travel',destination:'tower'},'I go back to Saltmarsh Chapel'],[twice,hurt,'short-rest','I take a short rest.'],[won,hurt,'long-rest','I take a long rest.']]){
  const p=preview(g,h,kara,a),told=x.calmFallback({hero:kara,before:g,preview:p,action:a,words:w,preferences:{narrator:'bard'}});assert.ok(told&&told.told==='game'&&told.narration,JSON.stringify(a));}
 {const p=preview(won,back.health,kara,{type:'travel',destination:'tower'});assert.equal(x.calmFallback({hero:kara,before:won,preview:p,action:{type:'travel',destination:'tower'},words:'I go back to Saltmarsh Chapel and ask about the mill.'}),null,'not for words that say more');}
 // A move the Dungeon Master chose is told by its own reply either way.
 assert.equal(x.routineCalmTurn(won,preview(won,back.health,kara,{type:'travel',destination:'tower'}).game,{type:'travel',destination:'tower'},'Back we go.',{events:preview(won,back.health,kara,{type:'travel',destination:'tower'}).events,chosen:true}).routine,true,'chosen: its own telling');}
// No line announces that nothing happened: the game's calm lines are movement, never "without incident".
{const flat=/without incident|unremarkable|uneventful|much as (?:you|they|\{hero\}) left|unchanged|nothing (?:happens|attacks|tries|bothers)|as dull as|a quiet one|just as (?:you|they) remember|just as before|has not missed|never change|as unimpressed|right where (?:you|\{hero\}) left|Nobody (?:bothers|throws)|underwhelming|not burned down|asks nothing|without trouble|passes quietly|Things are quiet|Still standing/i;
 for(const [voice,book] of Object.entries(x.calmLineBook))for(const [kind,lines] of Object.entries(book))if(!/^search/.test(kind))for(const l of lines)assert.ok(!flat.test(l),voice+' '+kind+' says nothing happened: '+l);}

// ---- 3. Searching the fallen ----
{const here=x.sceneLocation(atChapel.game),alone={...atChapel.game,spoils:[{kind:'creature',template:'wolf',name:'Mill wolf',count:1,place:here}]};
 const watchers=x.npcScene(alone).filter(n=>n.present&&(n.hp??0)>0);
 const empty=watchers.length?{...alone,people:Object.fromEntries(Object.entries(alone.people??{}).map(([id,p])=>[id,{...p,home:'inn'}]))}:alone;
 const nobody=x.npcScene(empty).filter(n=>n.present&&(n.hp??0)>0).length===0?empty:null;
 assert.ok(nobody,'a place with nobody watching');{routine('a search with nobody watching',nobody,null,kara,{type:'loot'},'I search the fallen for anything of value.');
  const s=settle(nobody,null,kara,{type:'loot'},'I search the fallen for anything of value.');assert.ok(s.told,'searched by the game');}
 notable('a search in front of the people of the market',/watching/,{...back.game,spoils:[{kind:'creature',template:'wolf',name:'Mill wolf',count:1,place:x.sceneLocation(back.game)}]},null,kara,{type:'loot'},'I search the fallen for anything of value.');
 notable('the tale\'s foe and its hoard',/hoard|find/,{...(nobody??alone),spoils:[{kind:'boss',name:'The foe',place:here}]},null,kara,{type:'loot'},'I search the fallen for anything of value.');}

// ---- 4. Orders to companions ----
{const g={...back.game,followers:{mara:{status:'following',location:'inn',reason:'Test.',terms:''}}};
 routine('a companion told to wait',g,null,kara,{type:'follower',id:'mara',order:'wait'},'Mara, wait here.');
 const waited=settle(g,null,kara,{type:'follower',id:'mara',order:'wait'},'Mara, wait here.');assert.ok(waited.told);
 for(const d of waited.told.dialogue)assert.equal(d.speakerId,'mara','only the companion answers');
 routine('a companion asked to come along again',waited.game,null,kara,{type:'follower',id:'mara',order:'resume'},'Mara, follow me.');
 notable('parting ways',/calm move/,g,null,kara,{type:'follower',id:'mara',order:'dismiss'},'We part ways, Mara.');
 notable('everyone at once',/calm move/,g,null,kara,{type:'follower',ids:['mara'],order:'wait'},'Everyone wait here.');}

// ---- 5. The shield ----
{const cleric=x.readyHero('cleric'),g=fresh(cleric),away=x.adventureStep(g,null,cleric,{type:'shield',away:true},lcg(2));
 if(!away.error){routine('the shield slung away from a fight',g,null,cleric,{type:'shield',away:true},'I sling my shield.');
  const s=settle(g,null,cleric,{type:'shield',away:true},'I sling my shield.');assert.ok(s.told&&/shield/i.test(s.told.narration));}}

// ---- 6. The line book ----
const voices=['chronicler','lamplighter','bard'];
assert.deepEqual(Object.keys(x.calmLineBook).sort(),[...voices].sort(),'three narrators');
const cases=x.calmLineCases();
for(const v of voices)assert.deepEqual(cases.filter(c=>c.narrator===v).map(c=>c.case).sort(),cases.filter(c=>c.narrator==='chronicler').map(c=>c.case).sort(),v+' tells every case');
for(const c of cases)assert.ok(c.count>=(/^shield/.test(c.case)?6:8),c.narrator+' has only '+c.count+' ways to tell "'+c.case+'"');
for(const kind of ['wait','resume','call'])assert.ok(x.calmBarks[kind].length>=12,'spoken lines for '+kind);
const raw=[];const walk=(v,where)=>{if(Array.isArray(v))v.forEach(s=>raw.push([where,s]));else if(v&&typeof v==='object')for(const [k,w] of Object.entries(v))walk(w,where+'.'+k);};walk(x.calmLineBook,'book');walk(x.calmBarks,'barks');
assert.ok(raw.length>=420,'a large library ('+raw.length+' lines)');
const formsOf=s=>{const at=s.indexOf('|');return at<0?[s]:[s.slice(0,at),s.slice(at+1)];};
const counted=/\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred|dozen)\b/i,rulesWords=/\b(?:HP|hit points?|damage|dice|die|d20|rolls?|rolled|AC|armou?r class|bonus action|reaction|advantage|disadvantage|initiative|round|slot|slots|saving throw|saves?|proficiency|modifier|critical|crit|luck|lucky|unlucky|fortune|fortunate|reroll|spared|mercy|turn order|second wind|action surge|short rest|long rest|spell|charges?|experience|level)\b/i;
for(const [where,s] of raw)for(const f of formsOf(s)){assert.ok(!counted.test(f),where+' states a number: '+f);assert.ok(!rulesWords.test(f),where+' names a rule: '+f);assert.ok(f.length<=170,where+' is short: '+f);}
for(const twin of [false,true]){const all=raw.map(e=>formsOf(e[1])).filter(f=>!twin||f[1]).map(f=>twin?f[1]:f[0]);assert.equal(new Set(all).size,all.length,'no line is written twice'+(twin?' (told of the hero)':''));}
{const heroMoves=/^book\.\w+\.(?:road|longRoad|shortRest|longRest|draught|shieldAway|shieldUp|searchFound|searchNothing)$/,you=/\b(?:you|your|yours|yourself)\b/i,names=t=>[...t.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(k=>k!=='hero').sort().join(',');
 for(const [where,s] of raw){const [line,twin]=formsOf(s),speech=where.startsWith('barks.');
  const needs=heroMoves.test(where)||you.test(line)||speech;
  // A line about someone else needs no twin, unless it speaks of the hero ("our hero").
  if(!needs){assert.ok(twin===undefined||/\bour hero\b/.test(line),where+' needs no twin: '+s);if(twin===undefined)continue;}
  assert.ok(twin,where+' tells the hero\'s move or says "you", so it needs a twin told of the hero by name: '+line);
  assert.ok(twin.includes('{hero}'),where+': the twin names the hero: '+twin);
  if(!speech)assert.ok(!you.test(twin),where+': the twin never says "you": '+twin);
  assert.equal(names(twin),names(line),where+': the twin keeps the line\'s other names: '+twin);
  assert.ok(!/(?<!\b(?:watch|watches|let|lets|see|sees|make|makes|help|helps) )\{hero\} (?:are|have|were|do|go|take|keep|walk|rest|sleep|drink|sit|find|wake|rise|search|sling|strap|put)\b/.test(twin),where+': "{hero}" takes a singular verb: '+twin);
  assert.ok(!/\bthey (?:is|has|was|does|keeps|walks|rests|sleeps|drinks|sits|finds|wakes)\b/i.test(twin),where+': "they" takes a plural verb: '+twin);
  assert.ok(Math.abs(twin.length-line.length)<=60,where+': the twin keeps the line\'s length: '+twin);}}
assert.ok(!/survivalOdds|sparedBlow/.test(readText('calmLines.js')),'the hidden odds are never mentioned');

// ---- 7. Seeded: the same turn gives the same words; each narrator its own; different turns differ ----
{const p=preview(atChapel.game,atChapel.health,kara,{type:'travel',destination:'inn'});const args={hero:kara,before:atChapel.game,after:p.game,action:{type:'travel',destination:'inn'},events:p.events};
 assert.deepEqual(x.calmTelling(args),x.calmTelling(plain(args)),'the same turn, the same telling');
 assert.equal(new Set(voices.map(narrator=>x.calmTelling({...args,narrator}).narration)).size,3,'each narrator in their own voice');
 const later=new Set();for(let id=1;id<=30;id++)later.add(x.calmTelling({...args,before:{...atChapel.game,playback:[{id,npcId:null,events:[{kind:'narration',text:'.'}]}]}}).narration);
 assert.ok(later.size>=15,'different turns are told differently ('+later.size+' of 30)');}
// No telling repeats a line said in the last few turns while others are left.
{let g=back.game,h=hurt,said=[];for(let i=0;i<8;i++){const s=settle(g,h,kara,'potion','I drink a healing draught.');if(!s.told)break;assert.ok(!said.slice(-4).includes(s.told.narration),'a fresh line each time: '+s.told.narration);said.push(s.told.narration);g={...s.game,potions:3};h=hurt;}}

// ---- 8. Both paths make no request for a routine calm move ----
{let asked=0;const ask=async()=>{asked++;return {narration:'The Dungeon Master tells it.',dialogue:[],suggestions:[]};};
 (async()=>{
  const snap=r.adventureSnapshot(kara,atChapel.game,atChapel.health,true);
  const one=await resolveTurn(snap,{question:'I travel to Stillwater Market.',action:{type:'travel',destination:'inn'}},{ask,randomImpl:lcg(4)});
  assert.equal(asked,0,'the table asks nothing for a journey back');assert.equal(one.turn.told,'game','the server marks the game-told turn');
  const two=await resolveTurn({...one.snapshot,health:{current:4,temp:0}},{question:'I take a short rest.',action:'short-rest'},{ask,randomImpl:lcg(4)});
  assert.equal(asked,0,'nor for a rest');assert.ok(two.narration.length>10);
  await resolveTurn(one.snapshot,{question:'I travel to The Old Mill.',action:x.dmChoices(kara,one.snapshot.game,one.snapshot.health).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label)).action},{ask,randomImpl:lcg(4)});
  assert.equal(asked,1,'somewhere new still asks the Dungeon Master');
  // At a table of several heroes the telling names the hero who acted.
  const wizard=x.readyHero('wizard');let party=r.startParty(snap,'A','Al');party=r.joinParty(party,'B',{character:JSON.stringify(wizard),game:r.newAdventure(wizard),health:null,name:'Bo'}).snapshot;
  const view=r.partyView(party,'A'),hero=JSON.parse(view.character);
  const told=await resolveTurn(view,{question:'I travel to Stillwater Market.',action:{type:'travel',destination:'inn'}},{ask,randomImpl:lcg(4),actorName:'Al'});
  assert.equal(asked,1,'a table of several heroes asks nothing either');
  assert.ok(told.narration.includes(hero.name.split(/\s+/)[0])&&!/\byou\b/i.test(told.narration),'told of the hero by name: '+told.narration);

  // ---- 9. A routine calm move the Dungeon Master chose keeps its own reply: one request, not two ----
  {let n=0;const queue=[];const dm=async p=>{n++;return queue.shift()??{narration:'The Dungeon Master tells what happened.',dialogue:[],suggestions:['I ask what happened.']};};
   queue.push({narration:'You and Wren take the causeway back toward town.',dialogue:[],actionId:'travel-inn',suggestions:['I look for the reeve.']});
   const home=await resolveTurn(snap,{question:'Let us head back to town.'},{ask:dm,randomImpl:lcg(4)});
   assert.equal(n,1,'a journey back the Dungeon Master chose is told in its own reply');
   assert.ok(home.narration.startsWith('You and Wren take the causeway back toward town.')&&/Stillwater Market/.test(home.narration),'its words, then where the road ended: '+home.narration);
   assert.deepEqual(home.suggestions,['I look for the reeve.'],'the reply\'s own suggestions');assert.equal(home.turn.told,undefined,'a Dungeon Master\'s turn is not marked as the game\'s');
   assert.equal(home.snapshot.game.stage,'inn','the journey was made');
   n=0;queue.push({narration:'You take the path to The Market of Stillwater, Stillwater Market.',actionId:'travel-inn'});
   const named=await resolveTurn(snap,{question:'Back to the market.'},{ask:dm,randomImpl:lcg(4)});assert.equal(n,1);assert.equal(named.narration,'You take the path to The Market of Stillwater, Stillwater Market.','a reply that names the place needs nothing added');
   n=0;queue.push({narration:'You set off toward the mill.',actionId:x.dmChoices(kara,one.snapshot.game,one.snapshot.health).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label)).id});
   await resolveTurn(one.snapshot,{question:'Off to the mill.'},{ask:dm,randomImpl:lcg(4)});assert.equal(n,2,'somewhere new (a fight there) is still told by the Dungeon Master');
   n=0;queue.push({narration:'The keeper shows you a bed upstairs.',actionId:'long-rest'});
   const slept=await resolveTurn({...one.snapshot,health:{current:4,temp:0}},{question:'I take a room for the night.'},{ask:dm,randomImpl:lcg(4)});
   assert.equal(n,1,'a night\'s rest the Dungeon Master chose: one request');assert.ok(slept.narration.length>'The keeper shows you a bed upstairs.'.length,'and the night is seen through: '+slept.narration);
   n=0;queue.push({narration:'The keeper nods.',actionId:'story-advance'});
   await resolveTurn(one.snapshot,{question:'The mill is clear, reeve.'},{ask:dm,randomImpl:lcg(4)});assert.equal(n,2,'a chapter closing is still told by the Dungeon Master');}

  // ---- 10. When the Dungeon Master cannot answer, a calm move sent to it only by preference is told by the game ----
  // (the project review, 2026-10-22: a guest past the day's ceiling, the guests' pause, a rate limit or an outage left a
  // hero who had made two game-told moves unable ever to travel or rest again). Somewhere new still needs it.
  {const refused=async()=>{throw Object.assign(Error('The game has reached today\'s limit for guests.'),{status:503});};
   let s=snap;for(const [dest,words] of [['inn','I travel to Stillwater Market.'],['tower','I travel to Saltmarsh Chapel.'],['inn','I travel to Stillwater Market.'],['tower','I travel to Saltmarsh Chapel.']]){
    const t=await resolveTurn(s,{question:words,action:{type:'travel',destination:dest}},{ask:refused,randomImpl:lcg(4)});assert.equal(t.turn.told,'game',words);s=t.snapshot;}
   const rested=await resolveTurn({...s,health:{current:4,temp:0}},{question:'I take a short rest.',action:'short-rest'},{ask:refused,randomImpl:lcg(4)});assert.equal(rested.turn.told,'game','and rest');
   await assert.rejects(resolveTurn(one.snapshot,{question:'I travel to The Old Mill.',action:x.dmChoices(kara,one.snapshot.game,one.snapshot.health).find(c=>/^travel-/.test(c.id)&&/Mill/.test(c.label)).action},{ask:refused,randomImpl:lcg(4)}),/limit for guests/,'somewhere new is refused as before');
   const src=readText('useDmTurn.js');assert.ok(/calmFallback\(\{hero,before:game,preview,action:command\.action,words:question,preferences:storyPreferences\(\)\}\)/.test(src)&&/catch\(e\)\{if\(!fallback\|\|benignTurnFailure\(String\(e\?\.message\?\?e\)\)\)throw e;body=withBeatLine\(fallback,preview\.game\);\}/.test(src),'a device does the same (a scene that changed meanwhile still refuses)');}
  console.log('verify-calm-lines: ok ('+raw.length+' lines)');
 })().catch(e=>{console.error(e);process.exit(1);});}
