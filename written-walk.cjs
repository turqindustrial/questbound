// Walkthroughs of a written tale (WRITTEN-TALES.md 7 and 13, check 5): a scripted path, a passive player and a violent
// one, played move by move through the game's own rules (turnRules.js settleTurn, the same pipeline as a device and the
// campaign server), with seeded dice and scripted Dungeon Master replies. Every move goes the way a device sends it
// (useDmTurn.js): the preview and its staging (stagingRules.js stagedPreview), the game's own telling of a routine move
// (fightLines.js routineTelling, which gives way while a beat is due), else a request whose scene's beat is recorded
// (beatSent), then the commit with the beats the requests carried. Used by check-written-tale.cjs (checks 5 and 9) and
// verify-staging.cjs. No AI, no network, no ports.
//   walkTale({r, story, hero, heroAt, steps|mode, seed, levelUps}) -> {ok, ending, moves, chapters, levels, log, error}
// `r` is the rules (rules-files.cjs, run in a context of the caller's own: it must export the names in `needs`).
'use strict';
const needs=['dmCommand','freshStoryGame','newAdventure','adventureStep','stagedPreview','settleTurn','commitDmTurn','routineTelling','dmChoices','mapMoves','beatSent','beatKey','stagingIds','validAdventure','adventureSnapshot','withAttackIntent','npcScene','levelUpReady','advancedInPlace','foeForLevel','levelCompanions','combatBasics','standingOffers','mapLocation','worldPlaces','lootError','placeName','storyText'];
// A small seeded generator (mulberry32): the same seed, the same dice.
function seeded(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fighting=g=>['combat','dying','dead','defeat'].includes(g.stage)||!!g.npcCombat?.active||!!g.turnOrder||!!g.pendingSpell||!!g.wildFight;
class WalkError extends Error{}
function walkTale({r,story,hero,heroAt=null,steps=null,mode='steps',seed=1,levelUps=true,limit=1200,narrator='chronicler',trace=false}){
 for(const n of needs)if(typeof r[n]!=='function')throw Error('written-walk.cjs needs '+n+' from the rules');
 const random=seeded(seed),log=[],chapters=[];
 let game,health=null,moves=0,levels=0;
 try{game=r.freshStoryGame(hero,story,r.newAdventure(hero));}catch(e){return {ok:false,error:'the tale does not seat: '+(e?.message??e),moves:0,chapters,levels:0,log};}
 const startLevel=hero.level??1,ids=()=>r.stagingIds(game),staging=game.story.staging;
 const note=(kind,text)=>log.push({move:moves,kind,text});
 const check=()=>{if(!r.validAdventure(r.adventureSnapshot(hero,game,health,true),hero))throw new WalkError('after move '+moves+' the game is not a valid adventure');};
 const people=()=>r.npcScene(game).filter(n=>n.present&&(n.hp??0)>0&&n.fate!=='dead');
 const done=()=>game.story.status!=='active';
 // One move, settled as a device settles it. `sent` holds the keys of the beats the requests of this move carried.
 function settle(action,conversation,dice){
  const before=game,chapter=before.story.chapter??0;
  const settled=r.settleTurn({hero,game,health,action,conversation,random:dice});
  if(settled.error)throw new WalkError('move '+(moves+1)+' ('+(typeof action==='string'?action:JSON.stringify(action))+') was refused: '+settled.error);
  game=settled.result.game;health=settled.result.health;moves++;
  if(trace)note('move',(conversation?.question??'')+' | '+game.stage+' at '+r.mapLocation(game)+' | chapter '+((game.story.chapter??0)+1)+' | due '+(game.pace?.due?game.pace.due.kind+':'+(game.pace.due.id??''):'-')+' | step '+(game.pace?.step??0)+' quiet '+(game.pace?.quiet??0)+' owed '+(game.pace?.owed??0)+(conversation?.told==='game'?' | told by the game':'')+(conversation?.beats?' | carried '+conversation.beats.join(','):''));
  for(const e of settled.result.events??[])if(/^(?:Chapter \d+ complete|Ending: |You chose: |Left to fate: |Lead seen through|Adventure complete)/.test(String(e)))note('engine',String(e));
  // A chapter closed: when, and whether the clock ran out (its last pressure step fired).
  const byClock=()=>{const last=(staging.chapters[chapter]?.pressure??[]).at(-1)?.id;return !!last&&(game.pace?.fired??[]).includes(last);};
  if((game.story.chapter??0)>chapter)chapters.push({chapter:chapter+1,moves,byClock:byClock()});
  if(done()&&before.story.status==='active')chapters.push({chapter:chapter+1,moves,byClock:byClock(),ending:game.pace?.ending??null});
  check();
  if(levelUps&&heroAt&&!fighting(game)&&r.levelUpReady(game,hero)){
   const next=heroAt(hero.level+1);let advanced=r.advancedInPlace(game,hero,next);advanced=r.foeForLevel(advanced,next.level);advanced=r.levelCompanions(advanced,next.level);
   game=advanced;hero=next;health=null;levels++;note('level','Level '+next.level+'.');check();
  }
  return settled;
 }
 // A scripted reply: the narration says who told it; the people named answer (those present).
 const reply=(text,speakers=[])=>{const here=new Set(people().map(n=>n.id));return {narration:text,dialogue:speakers.filter(id=>here.has(id)).slice(0,3).map(id=>({speakerId:id,text:'They answer you in their own words.'}))};};
 const record=(sent,scene,extra={})=>{const k=r.beatSent(scene,extra);if(k&&!sent.includes(k))sent.push(k);};
 // An engine move the player makes (a chip or plain words): previewed and staged, told by the game when routine,
 // else by the Dungeon Master from the preview.
 function engine(action,words,{dice=null,chosen=null}={}){
  const rolled=[],draw=dice??(()=>{const v=random();rolled.push(v);return v;});
  const sent=[];
  if(chosen){record(sent,game);}
  const scene=action?.type==='npc-attack'||typeof action==='string'?r.withAttackIntent(game,words):game;
  const preview=r.stagedPreview(game,r.adventureStep(scene,health,hero,action,draw),hero,action);
  if(preview.error)throw new WalkError('move '+(moves+1)+' ('+(typeof action==='string'?action:JSON.stringify(action))+') was refused: '+preview.error);
  const told=r.routineTelling({hero,before:game,preview,health,action,words,preferences:{narrator},chosen});
  let body;
  if(told)body=told;
  else{record(sent,preview.game,{engineResolved:true});body=reply('The Dungeon Master tells what happened.');}
  let i=0;const replay=dice??(()=>rolled[i++]??0.5);
  return settle(action,{question:words,narration:String(body.narration||'The moment passes.').slice(0,1700),dialogue:body.dialogue??[],npcId:null,...(body.told==='game'?{told:'game',fightRound:body.fightRound}:{}),...(sent.length?{beats:sent}:{})},replay);
 }
 // The Dungeon Master chooses a move in reply to the player's words (an actionId: a tale's choice, story-advance...).
 const chosenMove=(action,words)=>engine(action,words,{chosen:{narration:'The Dungeon Master answers your words.',dialogue:[]}});
 // Words only: the Dungeon Master answers, and the people named speak.
 function talk(words,speakers=[],{introduce=null}={}){
  const sent=[];record(sent,game);
  const body=reply('The Dungeon Master answers.',speakers);
  return settle(null,{question:words,narration:body.narration,dialogue:body.dialogue,introduce,npcId:body.dialogue[0]?.speakerId??null,...(sent.length?{beats:sent}:{})},random);
 }
 const person=name=>{const id=ids().person(name);if(!id)throw new WalkError('"'+name+'" is no person of this tale');return id;};
 const place=name=>{const id=ids().place(name);if(!id)throw new WalkError('"'+name+'" is no place of this tale');return id;};
 const nameOf=id=>game.story.npcs?.[id]?.name??game.people?.[id]?.name??id;
 // Travel along the map's roads (a journey the map offers).
 function go(id){
  if(r.mapLocation(game)===id&&!fighting(game))return;
  const move=r.mapMoves(game).find(m=>m.action.type==='travel'&&m.action.destination===id);
  if(!move)throw new WalkError('no road leads to '+r.placeName(game,id)+' from '+r.placeName(game,r.mapLocation(game)));
  engine(move.action,'I travel to '+r.placeName(game,id)+'.');
 }
 // Fight until the fight is over: the main weapon, a bonus action to heal when hurt, death saves while dying.
 // A fight lost (the hero fell and woke, or fled) is tried again after a rest, as a player would: at most four tries.
 function fight(subdue=false,target=null,again=null){
  for(let attempt=0;;attempt++){
   fightOnce(subdue,target);
   if(done()||!again||again.beaten())return;
   if(attempt>=3)throw new WalkError('the fight could not be won in four tries');
   recover();if(done())return;again.reengage();if(done())return;
  }
 }
 // Back to strength: a night's rest at the start where one is offered, else a short rest.
 function recover(){
  if(fighting(game))return;
  const offered=id=>r.dmChoices(hero,game,health).some(c=>c.id===id);
  if(game.stage!=='inn'){try{go('inn');}catch{}}
  if(!fighting(game)&&offered('long-rest'))engine('long-rest','I rest for the night.');
  else if(!fighting(game)&&offered('short-rest'))engine('short-rest','I take a short rest.');
 }
 function fightOnce(subdue=false,target=null){
  let rounds=0;
  while(fighting(game)&&!done()){
   if(++rounds>80)throw new WalkError('a fight lasted more than 80 moves');
   if(game.stage==='dead')throw new WalkError('the hero died',{cause:'dead'});
   if(game.stage==='dying'){engine('death-save','I fight to hold on.');continue;}
   const choices=r.dmChoices(hero,game,health),most=r.combatBasics(hero).hp,hurt=health&&health.current<most/2;
   const pick=id=>choices.find(c=>c.id===id);
   let c=null;
   if(game.actionUsed)c=(hurt&&(pick('class:wind')??pick('potion')))||pick('end-turn');
   else if(game.npcCombat?.active){c=choices.find(x=>x.id.startsWith('npc-attack:'+(target??'')))??choices.find(x=>x.id.startsWith('npc-attack:'))??pick('npc-wait');}
   else c=choices.find(x=>x.id.startsWith('attack:'))??pick('end-turn');
   if(!c)throw new WalkError('no move in the fight ('+choices.map(x=>x.id).join(', ')+')');
   const foe=game.wildFight?.name??game.story.foe;
   engine(c.action,subdue&&/attack/.test(c.id)?'I knock '+(target?nameOf(target):foe)+' out.':c.id.startsWith('attack:')||c.id.startsWith('npc-attack:')?'I attack with my '+c.id.split(':').pop()+'.':c.label);
  }
  if(game.stage==='dead')throw new WalkError('the hero died',{cause:'dead'});
 }
 const settleFights=()=>{if(fighting(game))fightOnce();};
 // What beating a place, the foe or a person means, and how to go back to it.
 const atPlace=id=>({beaten:()=>!r.worldPlaces(game).find(p=>p.id===id)?.threat,reengage:()=>go(id)});
 const atFoe=()=>({beaten:()=>!!game.foeFate||game.enemyHP===0,reengage:()=>{go('bridge');if(!done())engine('approach','I confront '+game.story.foe+'.');}});
 function step(s){
  const k=Object.keys(s).find(x=>x!=='speakers'),v=s[k];
  if(k!=='fight'&&k!=='confront'&&k!=='attack')settleFights();
  if(done())return;
  if(k==='go')go(place(v));
  // Words the game reads as a move of its own (an order to a companion, a blow) are that move, as on a device.
  else if(k==='say'){const command=r.dmCommand(hero,game,v,health,null);if(command?.action)engine(command.action,v);else talk(v,(s.speakers??[]).map(person));}
  else if(k==='fight'){const where=game.wildFight?.place??r.mapLocation(game);fight(false,null,/^p\d/.test(where)?atPlace(where):null);}
  else if(k==='confront'){settleFights();go('bridge');const c=r.dmChoices(hero,game,health).find(x=>x.id==='approach');if(!c)throw new WalkError(game.story.foe+' cannot be confronted here now');engine('approach','I confront '+game.story.foe+'.');fight(v==='subdue',null,atFoe());}
  else if(k==='attack'){const id=person(v.who),home=game.people?.[id]?.home;settleFights();if(!people().some(n=>n.id===id)&&home)go(home);
   const c=r.dmChoices(hero,game,health).find(x=>x.id.startsWith('npc-attack:'+id+':'));if(!c)throw new WalkError(v.who+' cannot be attacked here');
   const words=v.to==='subdue'?'I knock '+nameOf(id)+' out.':'I attack '+nameOf(id)+' with my '+c.id.split(':').pop()+'.';
   engine(c.action,words);
   fight(v.to==='subdue',id,{beaten:()=>!!game.npcFate?.[id]||(game.npcHP?.[id]??1)<=0,reengage:()=>{const h=game.people?.[id]?.home;if(h)go(h);const a=r.dmChoices(hero,game,health).find(x=>x.id.startsWith('npc-attack:'+id+':'));if(a&&!done())engine(a.action,words);}});}
  else if(k==='search'){if(r.lootError(game,health)){note('skip','Nothing to search here.');return;}engine({type:'loot'},'I search the fallen.');}
  else if(k==='check'){const sent=[];record(sent,game);const dice=()=>v==='pass'?0.999:0;
   const check={skill:'Investigation',ability:'Intelligence',dc:10,mode:'normal',reason:'Searching closely.',success:'You find what was hidden.',failure:'You find it, at a cost.',damageCount:0,damageDie:4,damageOn:'none'},action={type:'ai-check',check};
   const preview=r.stagedPreview(game,r.commitDmTurn(hero,game,health,action,{question:'I search the place closely.',narration:'You search.',npcId:null},dice),hero,action);
   if(preview.error)throw new WalkError('the check was refused: '+preview.error);record(sent,preview.game,{engineResolved:true});
   settle(action,{question:'I search the place closely.',narration:'The Dungeon Master tells what the search turns up.',dialogue:[],npcId:null,...(sent.length?{beats:sent}:{})},dice);}
  else if(k==='rest'){if(v==='long'){if(game.stage!=='inn')go('inn');if(r.dmChoices(hero,game,health).some(c=>c.id==='long-rest'))engine('long-rest','I rest for the night.');else talk('I try to rest, but nobody here will give me a bed.');}else{const c=r.dmChoices(hero,game,health).find(x=>x.id==='short-rest');if(c)engine('short-rest','I take a short rest.');else talk('I sit a while and catch my breath.');}}
  else if(k==='choose'){const [c,o]=Object.entries(v)[0];const choice=staging.chapters.map(x=>x.choice).find(x=>x?.id===c),opt=choice?.options?.find(x=>x.id===o);
   // The player says it; while something else is due (or the choice is still to be put), the Dungeon Master tells that
   // first and the player says it again (one thing at a time), at most eight times.
   let offered=null;for(let i=0;i<9&&!done();i++){offered=r.dmChoices(hero,game,health).find(x=>x.id==='tale-choice:'+c+':'+o);if(offered)break;if(i<8)talk(opt?.say??'I choose.');}
   if(done())return;if(!offered)throw new WalkError('the choice "'+c+'" is not open to "'+o+'" now');chosenMove(offered.action,opt?.say??'I choose.');}
  else if(k==='join'){const id=person(v);
   if(r.standingOffers(game).includes(id)){engine({type:'accept-offer',id},'I take '+nameOf(id)+' along.');return;}
   if(!people().some(n=>n.id===id)){const home=game.people?.[id]?.home??(['keeper','mara'].includes(id)?'inn':null);if(home)go(home);}
   const question=nameOf(id)+', will you come with me?',action={type:'recruitment',plans:[{npcId:id,decision:'join',dc:null,reason:'They agree to come along.',terms:'',class:null}]};
   const sent=[];record(sent,game);settle(action,{question,narration:'The Dungeon Master tells their answer.',npcId:id,dialogue:[],...(sent.length?{beats:sent}:{})},random);}
  else if(k==='find'){const id=person(v),p=game.people?.[id];if(!p)throw new WalkError(v+' cannot be found');if(r.mapLocation(game)!==p.home)go(p.home);
   talk('I search for anyone hiding here.',[],{introduce:{name:p.name,species:p.species??'',role:p.role,appearance:p.appearance,personality:p.personality??'',toughness:p.toughness,attitude:'indifferent',foe:p.foe??'neutral',tie:null,class:null}});}
  else if(k==='advance'){const c=r.dmChoices(hero,game,health).find(x=>x.id==='story-advance');if(!c)throw new WalkError('no chapter can be moved on now');chosenMove(c.action,'I tell them what I found.');}
  else if(k==='lead'){const c=r.dmChoices(hero,game,health).find(x=>x.id==='lead-done:'+v);if(!c)throw new WalkError('the lead '+v+' cannot be closed now');chosenMove(c.action,'I see it through.');}
  else if(k==='wait'){const n=Number.isInteger(v)?v:v.moves,chat=plain(v)&&v.talk===true;for(let i=0;i<n&&!done();i++){settleFights();if(done())break;const here=people()[0]?.id;chat&&here?talk('I talk with '+nameOf(here)+' for a while.',[here]):talk('I wait and watch.');}}
  else throw new WalkError('unknown step '+k);
 }
 // A passive player: talks with whoever is here, rests, and wanders to safe places already known; flees nothing,
 // fights only what falls on them. A violent one first kills every resident the tale names.
 function wander(){
  const options=r.mapMoves(game).filter(m=>m.action.type==='travel').map(m=>m.action.destination).filter(id=>{const p=r.worldPlaces(game).find(x=>x.id===id);return !p||(!p.threat&&p.danger!=='risky'&&!p.region);}).filter(id=>id!=='bridge');
  if(options.length)go(options[moves%options.length]);else talk('I wander and look around.');
 }
 function passive(){
  let n=0;
  while(!done()&&moves<limit){
   settleFights();if(done())break;
   const turn=n++%6,here=people()[0]?.id;
   if(turn===2)wander();
   else if(turn===4){if(r.dmChoices(hero,game,health).some(c=>c.id==='long-rest'))engine('long-rest','I rest for the night.');else talk('I sit and rest a while.');}
   else here?talk('I talk with '+nameOf(here)+'.',[here]):talk('I wait and watch.');
  }
 }
 function violent(){
  const residents=Object.entries(game.people??{}).filter(([,p])=>p.resident).map(([id])=>id);
  for(const id of residents){
   if(done()||moves>=limit)break;settleFights();if(done())break;
   if(game.npcFate?.[id]==='dead')continue;
   const p=game.people?.[id];if(!p)continue;
   try{
    if(r.mapLocation(game)!==p.home)go(p.home);
    if(game.people[id]?.hidden)step({find:p.name});
    if(game.npcFate?.[id]==='dead'||!people().some(n=>n.id===id))continue;
    step({attack:{who:p.name,to:'kill'}});
   }catch(e){if(e?.cause==='dead')throw e;note('skip','Could not reach '+p.name+': '+e.message);}
  }
  passive();
 }
 try{
  if(mode==='steps')for(const s of steps??[]){if(done())break;step(s);if(moves>limit)throw new WalkError('more than '+limit+' moves');}
  else if(mode==='passive')passive();
  else if(mode==='violent')violent();
  if(mode==='steps'&&!done())settleFights();
  return {ok:done(),ending:game.pace?.ending??null,flags:game.pace?.flags??[],moves,chapters,levels,startLevel,endLevel:hero.level,xp:game.xp??0,log,game,hero,...(done()?{}:{error:'the tale had not ended after '+moves+' moves'})};
 }catch(e){
  if(!(e instanceof WalkError))return {ok:false,error:'the walk failed: '+(e?.stack??e),moves,chapters,levels,log,game,hero};
  return {ok:false,died:e.cause==='dead',error:e.message,moves,chapters,levels,startLevel,endLevel:hero.level,log,game,hero};
 }
}
module.exports={walkTale,needs,seeded};
