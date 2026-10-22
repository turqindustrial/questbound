// The fights of a written tale, simulated (balance-check.cjs --tale and check-written-tale.cjs check 8; WRITTEN-TALES.md
// 13): each chapter's set piece (armed by the tale's own level rules, as stagingRules.js arms it) and the tale's foe
// (its stat block from storyRules.js storyBossStats, its minions, its turn at half its hit points, its hold), for each
// class and level asked, by a hero alone and by a party, many times over, through the game's own rules
// (adventureStep, with the plain tactics of fight-tactics.cjs). A fallen hero rolls death saves to the end. A foe
// that breaks away (bloodied "flee") is gone after once the hero has taken a short rest, as far as twice. Plain Node, no AI calls, no ports.
//   taleBalance({r, story, heroAt, classes, levels, party, fights, random}) -> {cells, problems}
// `story` is the copy a player starts (written-shelf.cjs start), `heroAt(key, level)` makes a ready-made hero. `r` is
// the rules, run in the caller's own context: it must export the names in `needs`.
'use strict';
const {fightTactics,needs:tacticNeeds}=require('./fight-tactics.cjs');
const needs=[...tacticNeeds,'worldPlaces','freshStoryGame','newAdventure','adventureStep','startWildFight','stagedThreat','stagingIds','combatBasics','startParty','joinParty','partyView','settleParty','adventureSnapshot'];
const plain=v=>JSON.parse(JSON.stringify(v));
// The targets (WRITTEN-TALES.md 13, check 8; provisional): fights won by difficulty, and what the foe costs a hero alone.
const balanceTargets={won:{gentle:0.9,steady:0.8,hard:0.7},bossCost:[0.5,0.8],bossFalls:[0.05,0.15],bossDeaths:0.03};
function taleBalance({r,story,heroAt,classes=['fighter','rogue','wizard','cleric'],levels=[1],party=[1],fights=100,random=Math.random}){
 for(const n of needs)if(r[n]===undefined)throw Error('tale-balance.cjs needs '+n+' from the rules');
 const {choose}=fightTactics(r),problems=new Set(),cells=[];
 const st=story.staging,chapters=Array.isArray(st?.chapters)?st.chapters:[],last=chapters.length-1;
 // The foe may be met only once its chapter has come and its condition holds: here it is always met.
 const copy=()=>{const s=plain(story);if(s.staging?.boss&&typeof s.staging.boss==='object')s.staging.boss.if=null;return s;};
 // A tale seated for this hero, the chapter under way set to `ch`.
 // (At a table the tale is seated as partyRules.js partyInTale seats it: the foe is not sized to the lead's class.)
 function seated(hero,ch,party=false){
  const game=r.freshStoryGame(hero,copy(),r.newAdventure(hero),{party});
  return {...game,story:{...game.story,chapter:ch},pace:{...game.pace,ch}};
 }
 // The fights to try: each chapter's set piece, then the foe.
 const plans=[];
 chapters.forEach((c,i)=>{if(c?.fight&&typeof c.fight==='object')plans.push({kind:'set',chapter:i+1,at:c.fight.at,label:'Chapter '+(i+1)+' set piece at '+c.fight.at});});
 plans.push({kind:'boss',chapter:last+1,label:'The foe, '+story.foe});
 // The game at the moment the fight begins (a set piece already upon the hero; the foe still to be approached), or null
 // when there is no fight at that level (a set piece with no creature below its level).
 function start(plan,hero,party=false){
  if(plan.kind==='boss'){const g=seated(hero,Math.max(0,last),party);return {...g,stage:'bridge'};}
  const g=seated(hero,plan.chapter-1,party),threat=r.stagedThreat(chapters[plan.chapter-1].fight,hero.level??1);if(!threat)return null;
  const place=r.stagingIds(g).place(plan.at);if(!place)return null;
  return r.startWildFight(g,hero,threat,{place,from:'inn'}).game;
 }
 const fightOn=g=>g.stage==='combat'||!!g.npcCombat?.active;
 const beaten=g=>g.stage==='victory'||!!g.foeFate;
 // One hero through one fight (and a foe that breaks away gone after, at most twice).
 function solo(plan,hero){
  let g=start(plan,hero);if(!g)return null;
  const placeOf=g.wildFight?.place??null,max=r.combatBasics(hero).hp;let h={current:max,temp:0},t=0,fell=false;
  const act=a=>{const step=r.adventureStep(g,h,hero,a,random);if(step.error||step.waiting){problems.add(plan.label+', '+hero.name+' L'+hero.level+': '+(step.error??'a spell waiting for a ruling'));return false;}g=step.game;h=step.health??h;return true;};
  for(let chase=0;chase<3;chase++){
   if(g.stage==='bridge'&&!act('approach'))break;
   for(;t<120&&fightOn(g)&&(h?.current??1)>0;t++)if(!act(choose(hero,g,h,max)))break;
   if((h?.current??1)<=0||['dying','dead'].includes(g.stage))fell=true;
   for(let i=0;i<20&&g.stage==='dying';i++)if(!act('death-save'))break;
   if(plan.kind!=='boss'||beaten(g)||fell||g.stage!=='bridge')break;
   // It broke away: a short rest, as a player would take, and after it.
   {const rest=r.adventureStep(g,h,hero,'short-rest',random);if(!rest.error){g=rest.game;h=rest.health??h;}}
  }
  const won=(plan.kind==='boss'?beaten(g):!!r.worldPlaces(g).find(p=>p.id===placeOf)?.cleared)&&!['dying','dead'].includes(g.stage);
  return {won,fell,died:g.stage==='dead',rounds:t,cost:won?1-Math.max(0,h?.current??0)/max:null};
 }
 // A party at the shared table, each hero on their own turn from their own view.
 function inParty(plan,heroes){
  const lead=heroes[0],ids=heroes.map((_,i)=>'P'+i),byId=Object.fromEntries(ids.map((id,i)=>[id,heroes[i]]));
  const g=start(plan,lead,true);if(!g)return null;
  const placeOf=g.wildFight?.place??null;
  let table=r.startParty(r.adventureSnapshot(lead,g,{current:r.combatBasics(lead).hp,temp:0},true),'P0','P0');
  for(let i=1;i<heroes.length;i++){const joined=r.joinParty(table,ids[i],{character:JSON.stringify(heroes[i]),game:null,health:null,name:ids[i]});if(joined.error){problems.add('party: '+joined.error);return null;}table=joined.snapshot;}
  table=plain(table);
  // The others carry what the lead carries (draughts): the same kit for everyone.
  for(let i=1;i<heroes.length;i++){const m=table.game.party.members[ids[i]];m.hero={...m.hero,potions:g.potions??0};}
  const fallen=new Set();let world=null,t=0,chases=0;
  for(;t<400;t++){
   const settled=r.settleParty(table);world=settled.world;
   for(const [id,m] of Object.entries(settled.members))if(m.status!=='up')fallen.add(id);
   const up=ids.find(id=>settled.members[id]?.status==='up');
   if(world.stage==='bridge'&&plan.kind==='boss'&&!world.foeFate&&chases<3&&up){chases++;const v=r.partyView(table,up);const step=r.adventureStep(v.game,v.health,byId[up],'approach',random);if(step.error){problems.add(plan.label+', party: '+step.error);break;}table=plain(r.adventureSnapshot(lead,step.game,step.health,true));continue;}
   if(!fightOn(world))break;
   const turn=world.turnOrder?.order?.[world.turnOrder.at]?.id??'P0',hero=byId[turn];if(!hero)break;
   // A hero who has died has no turn: another passes it on.
   if(settled.members[turn]?.status==='dead'){if(!up)break;const v=r.partyView(table,up),step=r.adventureStep(v.game,v.health,byId[up],{type:'party-pass'},random);if(step.error){if(!/no turn to pass/.test(step.error))problems.add(plan.label+', party: '+step.error);break;}table=plain(r.adventureSnapshot(byId[up],step.game,step.health,true));continue;}
   const v=r.partyView(table,turn),max=r.combatBasics(hero).hp;
   const step=r.adventureStep(v.game,v.health,hero,v.game.stage==='dying'?'death-save':choose(hero,v.game,v.health,max),random);
   if(step.error||step.waiting){problems.add(plan.label+', party '+hero.name+' L'+hero.level+': '+(step.error??'a spell waiting for a ruling'));break;}
   table=plain(r.adventureSnapshot(hero,step.game,step.health,true));
  }
  const members=r.settleParty(table).members;
  return {won:plan.kind==='boss'?world?.stage==='victory'||!!world?.foeFate:!!r.worldPlaces(world??{}).find(p=>p.id===placeOf)?.cleared,fell:fallen.size>0,died:Object.values(members).some(m=>m.status==='dead'),rounds:t,cost:null};
 }
 const keyOf=k=>String(k).toLowerCase();
 for(const plan of plans)for(const key of classes.map(keyOf))for(const level of levels)for(const size of party){
  let hero;try{hero=heroAt(key,level);}catch(e){problems.add('could not make the ready-made '+key+' at level '+level+': '+e.message);continue;}
  const others=[];
  if(size>1){const order=['fighter','rogue','wizard','cleric'],at=order.indexOf(key);for(let i=1;i<size;i++){try{others.push(heroAt(order[(Math.max(0,at)+i)%order.length],level));}catch{}}}
  let n=0,won=0,fell=0,died=0,rounds=0,cost=0,costs=0;
  for(let i=0;i<fights;i++){
   let out;try{out=size>1?inParty(plan,[hero,...others]):solo(plan,hero);}catch(e){problems.add(plan.label+': '+(e?.stack??e).toString().split('\n').slice(0,2).join(' '));break;}
   if(!out)break;
   n++;rounds+=out.rounds;if(out.won)won++;if(out.fell)fell++;if(out.died)died++;if(out.cost!==null){cost+=out.cost;costs++;}
  }
  if(!n){cells.push({...plan,key,cls:hero.class,level,size,none:true});continue;}
  cells.push({...plan,key,cls:hero.class,level,size,fights:n,win:won/n,fall:fell/n,death:died/n,rounds:rounds/n,cost:costs?cost/costs:null});
 }
 return {cells,problems:[...problems]};
}
// What the cells say against the targets: [{level:'warn', where, message}] (`difficulty`: gentle, steady or hard).
function balanceFindings(cells,difficulty){
 const out=[],pct=v=>Math.round(100*v)+'%',want=balanceTargets.won[difficulty]??balanceTargets.won.steady;
 for(const c of cells){
  if(c.none)continue;
  const who=c.cls+' level '+c.level+(c.size>1?' with '+(c.size-1)+' more':' alone');
  if(c.win<want)out.push({where:c.label,message:who+' wins '+pct(c.win)+' (a '+difficulty+' tale: at least '+pct(want)+')'});
  if(c.kind==='boss'&&c.size===1){
   if(c.cost!==null&&(c.cost<balanceTargets.bossCost[0]||c.cost>balanceTargets.bossCost[1]))out.push({where:c.label,message:who+': the fight costs '+pct(c.cost)+' of their hit points (50% to 80%)'});
   if(c.fall<balanceTargets.bossFalls[0]||c.fall>balanceTargets.bossFalls[1])out.push({where:c.label,message:who+' falls in '+pct(c.fall)+' of fights (5% to 15%)'});
   if(c.death>=balanceTargets.bossDeaths)out.push({where:c.label,message:who+' dies in '+pct(c.death)+' of fights (under 3%)'});
  }
 }
 return out;
}
// A ready-made hero at any level, as the checks make one (through the developer options): its own spells first, then
// the class's list to the level's limits, and the class's first subclass.
function readyHeroAt(r){
 return (key,level)=>{
  if(level===1)return r.readyHero(key);
  const form=r.readyHeroes.find(h=>h.key===key).form,sub=Object.keys(r.subclassOptions[form.class]??{})[0]??'';
  const auto=r.automaticSpells({...form,level,plannedSubclass:sub}),limits=r.spellLimits({class:form.class,level}),list=r.spellsForClass(form.class,level).filter(s=>!auto.includes(s.id));
  if(!limits)return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[],spellbook:[],spellSelectionVersion:2});
  const take=(pool,n)=>[...new Set([...(form.spells??[]).filter(id=>pool.some(s=>s.id===id)),...pool.map(s=>s.id)])].slice(0,n),prepared=take(list.filter(s=>s.level>0),limits.prepared);
  return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[...take(list.filter(s=>s.level===0),limits.cantrips),...prepared],spellbook:limits.book?[...new Set([...prepared,...list.filter(s=>s.level>0).map(s=>s.id)])].slice(0,limits.book):[],spellSelectionVersion:2});
 };
}
// The copy a player starts (written-shelf.cjs start): the story with an id, active, tagged with the tale it came from.
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const taleCopy=(tale,id='written-check')=>({...JSON.parse(JSON.stringify(tale.story)),id,status:'active',libraryId:uuidPattern.test(String(tale.id))?tale.id:'00000000-0000-4000-8000-000000000000',artId:'journey-'+(uuidPattern.test(String(tale.id))?tale.id:'00000000-0000-4000-8000-000000000000'),written:{slug:/^[a-z0-9-]{3,28}$/.test(String(tale.slug))?tale.slug:'unnamed',edition:Number.isInteger(tale.edition)&&tale.edition>=1&&tale.edition<=999?tale.edition:1,length:['short','medium','long'].includes(tale.length)?tale.length:'short'}});
// The tale's levels to try: its lowest, the middle and its highest.
const taleLevels=tale=>Array.isArray(tale?.levels)&&tale.levels.length===2&&tale.levels.every(Number.isInteger)?[...new Set([tale.levels[0],Math.round((tale.levels[0]+tale.levels[1])/2),tale.levels[1]])].filter(l=>l>=1&&l<=20):[1];
module.exports={taleBalance,balanceFindings,balanceTargets,needs,readyHeroAt,taleCopy,taleLevels,heroNeeds:['readyHero','readyHeroes','subclassOptions','automaticSpells','spellLimits','spellsForClass','makeCharacter','blankBuild']};
