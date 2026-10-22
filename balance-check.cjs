// Fight balance: every ready-made hero, at levels 1, 3 and 5, against every creature template, many times over, with a
// plain tactic (swing the main weapon or cast the best damaging spell; drink a draught or heal when low). Prints the
// win rate, how often the hero falls and how often they die (a fallen hero rolls death saves to the end, a companion
// helping first), fight length and HP left, flags fights that look deadly or trivial, and ends
// with a summary line (mean win, fall and death rates, trivial and deadly cells). Plain Node, no AI calls. Options:
//  --fights N (default 200 per cell), --levels 1,3,5, --foe key (one creature, or "story" for a written story's foe)
//  --companion Class   a companion of that class, a level below the hero, fights beside every hero
//  --party N           a party of N heroes (2-4) at the shared table, fighting in turns: the ready-made hero and the
//                      next N-1 ready-made heroes at the same level (partyRules.js, partyStep)
//  --magic item[,item] the hero carries magic: weapon+1, cloak (Cloak of Protection), ring (Ring of Protection)
//  --day N             N fights between long rests (a short rest after each win; slots, uses, draughts and hit
//                      points carried); a fall ends the day and its remaining fights count as lost
//  --subclass <name|all> compare each subclass with its class's SRD subclass, on a plain hero of every class (by
//                      default with --day 3): their win rates should sit within about 12 points of each other
//  --class A,B         with --subclass: only these classes
//  --quiet (flags and summary only)
//  --alone off         creatures meet a hero alone as written, whatever the class (encounterRules.js foeScaling.alone
//                      off): to compare with how they were before 2026-10-22
//  --tale <file>       a written tale (WRITTEN-TALES.md): each chapter's set piece and the tale's foe, for the ready-made
//                      Fighter, Rogue, Wizard and Cleric (--classes a,b) at the tale's lowest, middle and highest level
//                      (--levels lo,mid,hi or numbers), alone and with one more hero (--party 1,2), against the targets
//                      of check 8 (tale-balance.cjs; --fights defaults to 100 here)
//  --tale <file>       a written tale (WRITTEN-TALES.md): each chapter's set piece and the tale's foe, for the ready-made
//                      Fighter, Rogue, Wizard and Cleric (--classes a,b) at the tale's lowest, middle and highest level
//                      (--levels lo,mid,hi or numbers), alone and with one more hero (--party 1,2), against the targets
//                      of check 8 (tale-balance.cjs; --fights defaults to 100 here)
const fs=require('fs'),vm=require('vm');
const {rulesSource}=require('./rules-files.cjs');
const source=rulesSource({extra:['worldArtRules.js']});
const r=vm.runInNewContext(source+'\n({gearedHero,npcClassList,readyHeroes,makeCharacter,blankBuild,hostileEncounterGame,hostileFoes,foeStatsFor,storyFoeStats,encounterFoe,newAdventure,adventureStep,dmCommand,attackOptions,combatBasics,surgeReady,subclassOptions,subclassAction,subclassUses,classes,abilities,standardArray,knownSpells,automaticEffects,startParty,joinParty,partyView,settleParty,adventureSnapshot,makeMagicItem,freshStoryGame,startWildFight,stagedThreat,stagingIds,readyHero,automaticSpells,spellLimits,spellsForClass,worldPlaces,foeScaling,bossShape})',{AsyncStorage:{},weaponIcon:()=>'sword'});
if(process.argv.includes('--alone')&&process.argv[process.argv.indexOf('--alone')+1]==='off')for(const k of Object.keys(r.foeScaling.alone))delete r.foeScaling.alone[k];
// --tale: a written tale's own fights (tale-balance.cjs), and nothing else.
function taleMode(){
 const tb=require('./tale-balance.cjs'),argOf=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0&&process.argv[i+1]!==undefined?process.argv[i+1]:fallback;};
 const file=argOf('--tale',null);if(!file){console.error('balance-check: --tale needs a tale file');process.exitCode=1;return;}
 const tale=JSON.parse(fs.readFileSync(file,'utf8')),lv=tb.taleLevels(tale),spec=String(argOf('--levels','lo,mid,hi'));
 const lvls=[...new Set(spec.split(',').map(x=>x==='lo'?lv[0]:x==='mid'?lv[Math.floor(lv.length/2)]:x==='hi'?lv[lv.length-1]:Number(x)).filter(n=>Number.isInteger(n)&&n>=1&&n<=20))];
 const classes=String(argOf('--classes','fighter,rogue,wizard,cleric')).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const party=String(argOf('--party','1,2')).split(',').map(Number).filter(n=>n>=1&&n<=4);
 const n=Math.max(10,Number(argOf('--fights',100))||100),t0=Date.now();
 const out=tb.taleBalance({r,story:tb.taleCopy(tale,'balance-tale'),heroAt:tb.readyHeroAt(r),classes,levels:lvls,party,fights:n});
 const pct=v=>String(Math.round(100*v)).padStart(3)+'%';
 console.log((tale.story?.title??file)+' ('+(tale.length??'?')+', '+(tale.difficulty??'?')+', levels '+lv[0]+'-'+lv[lv.length-1]+'): '+n+' fights a cell');
 let label=null;
 for(const c of out.cells){
  if(c.label!==label){label=c.label;console.log('\n'+label+':');}
  const who=(c.cls+' L'+c.level+(c.size>1?' +'+(c.size-1):'')).padEnd(16);
  if(c.none){console.log('  '+who+' no fight at this level');continue;}
  console.log('  '+who+pct(c.win)+' win '+pct(c.fall)+' fall '+pct(c.death)+' die ~'+c.rounds.toFixed(1).padStart(5)+' steps'+(c.cost!==null?' '+pct(c.cost)+' HP spent':''));
 }
 const found=tb.balanceFindings(out.cells,tale.difficulty??'steady');
 console.log('\nAgainst the targets ('+found.length+'):');for(const f of found)console.log('  '+f.where+': '+f.message);if(!found.length)console.log('  all within them.');
 if(out.problems.length){console.log('\nEngine problems:');for(const p of out.problems)console.log('  '+p);process.exitCode=1;}
 console.log('\n('+Math.round((Date.now()-t0)/1000)+' s)');
}
if(process.argv.includes('--tale')){taleMode();process.exit(process.exitCode??0);}
// --tale: a written tale's own fights (tale-balance.cjs), and nothing else.
function taleMode(){
 const tb=require('./tale-balance.cjs'),argOf=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0&&process.argv[i+1]!==undefined?process.argv[i+1]:fallback;};
 const file=argOf('--tale',null);if(!file){console.error('balance-check: --tale needs a tale file');process.exitCode=1;return;}
 const tale=JSON.parse(fs.readFileSync(file,'utf8')),lv=tb.taleLevels(tale),spec=String(argOf('--levels','lo,mid,hi'));
 const lvls=[...new Set(spec.split(',').map(x=>x==='lo'?lv[0]:x==='mid'?lv[Math.floor(lv.length/2)]:x==='hi'?lv[lv.length-1]:Number(x)).filter(n=>Number.isInteger(n)&&n>=1&&n<=20))];
 const classes=String(argOf('--classes','fighter,rogue,wizard,cleric')).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const party=String(argOf('--party','1,2')).split(',').map(Number).filter(n=>n>=1&&n<=4);
 const n=Math.max(10,Number(argOf('--fights',100))||100),t0=Date.now();
 const out=tb.taleBalance({r,story:tb.taleCopy(tale,'balance-tale'),heroAt:tb.readyHeroAt(r),classes,levels:lvls,party,fights:n});
 const pct=v=>String(Math.round(100*v)).padStart(3)+'%';
 console.log((tale.story?.title??file)+' ('+(tale.length??'?')+', '+(tale.difficulty??'?')+', levels '+lv[0]+'-'+lv[lv.length-1]+'): '+n+' fights a cell');
 let label=null;
 for(const c of out.cells){
  if(c.label!==label){label=c.label;console.log('\n'+label+':');}
  const who=(c.cls+' L'+c.level+(c.size>1?' +'+(c.size-1):'')).padEnd(16);
  if(c.none){console.log('  '+who+' no fight at this level');continue;}
  console.log('  '+who+pct(c.win)+' win '+pct(c.fall)+' fall '+pct(c.death)+' die ~'+c.rounds.toFixed(1).padStart(5)+' steps'+(c.cost!==null?' '+pct(c.cost)+' HP spent':''));
 }
 const found=tb.balanceFindings(out.cells,tale.difficulty??'steady');
 console.log('\nAgainst the targets ('+found.length+'):');for(const f of found)console.log('  '+f.where+': '+f.message);if(!found.length)console.log('  all within them.');
 if(out.problems.length){console.log('\nEngine problems:');for(const p of out.problems)console.log('  '+p);process.exitCode=1;}
 console.log('\n('+Math.round((Date.now()-t0)/1000)+' s)');
}
if(process.argv.includes('--tale')){taleMode();process.exit(process.exitCode??0);}
// A written story's main foe, alongside the creature templates.
const storyFoe={key:'story',foe:'Story Foe',species:'Unknown',type:'Slashing',appearance:'The main foe of a written story.',story:true};
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0&&process.argv[i+1]!==undefined?process.argv[i+1]:fallback;};
const fights=Math.max(10,Number(arg('--fights',200))||200),levels=String(arg('--levels','1,3,5')).split(',').map(Number).filter(n=>n>=1&&n<=20),quiet=process.argv.includes('--quiet');
const subclassMode=arg('--subclass',null),partySize=Math.max(1,Math.min(4,Number(arg('--party',1))||1)),day=Math.max(1,Math.min(6,Number(arg('--day',subclassMode?3:1))||1));
const magic=String(arg('--magic','')).split(',').filter(Boolean);
if(magic.some(m=>!['weapon+1','cloak','ring'].includes(m))){console.error('Unknown magic item: use weapon+1, cloak or ring.');process.exit(1);}
// A ready-made hero at a level, as the checks make one: its own spells, then the class's list to the level's limits
// (tale-balance.cjs readyHeroAt; until 2026-10-22 a caster kept only its level-1 spells at every level).
const readyAt=require('./tale-balance.cjs').readyHeroAt(r),heroAt=(entry,level)=>readyAt(entry.key,level);
// The hero's magic items, attuned (lootRules.js).
function withMagic(g,hero){
 if(!magic.length)return g;
 const main=r.attackOptions(hero).find(x=>!x.unarmed&&!x.ranged)??r.attackOptions(hero)[0];
 const items=magic.map(m=>m==='weapon+1'?r.makeMagicItem('weapon+1',hero,{base:main.name}):{...r.makeMagicItem(m==='cloak'?'cloak-of-protection':'ring-of-protection',hero),attuned:true});
 return {...g,pack:{gold:10,spent:{},...(g.pack??{}),items:[...(g.pack?.items??[]),...items]}};
}
// The same camp as the Random hostile encounter, with the chosen creature in place of the random one.
function fightWith(hero,f){
 const g=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stats=f.story?r.storyFoeStats(hero.level,f.type):r.foeStatsFor(f,hero.level);
 return withMagic({...g,story:{...g.story,id:'hostile-encounter-'+f.key,title:'Balance: '+f.foe,foe:f.foe,foeSpecies:f.species,foeAppearance:f.appearance,foeDamageType:f.type,foeStats:stats},enemyHP:stats.maximum},hero);
}
// A plain player's tactics (fight-tactics.cjs): heal or drink when low, the strongest damaging spell while slots last,
// then cantrips, then the main weapon.
const {choose}=require('./fight-tactics.cjs').fightTactics(r);
const flags=[],problems=new Set(),only=arg('--foe',null),companion=arg('--companion',null),cells=[];
if(companion&&!r.npcClassList.includes(companion)){console.error('Unknown class: '+companion);process.exit(1);}
// A companion travelling with the hero (followerRules.js): one level below them, fighting by their class.
const withCompanion=(g,level,cls=companion)=>cls?{...g,followers:{mara:{status:'following',location:'inn',reason:'Balance check.',terms:''}},npcClasses:{mara:{class:cls,level:Math.max(1,level-1)}}}:g;
const heroFieldsCarried=['resources','spellSlotsUsed','arcanumUsed','shortRests','potions'];
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
// One hero (with any companion) through one fight; the game and health carry what came before.
function soloFight(hero,g,h,chooser){
 const max=r.combatBasics(hero).hp;let t=0;
 for(;t<60&&g.stage==='combat'&&(h?.current??1)>0;t++){
  const step=r.adventureStep(g,h,hero,chooser(hero,g,h,max),Math.random);
  if(step.error||step.waiting){problems.add(hero.name+' L'+hero.level+' vs '+g.story.foe+': '+(step.error??'spell waiting for a ruling'));break;}
  g=step.game;h=step.health;
 }
 const fell=(h?.current??1)<=0||['dying','dead'].includes(g.stage);
 // A fallen hero rolls death saves until they live or die (a companion at their side tries to help first).
 for(let i=0;i<20&&g.stage==='dying';i++){const step=r.adventureStep(g,h,hero,'death-save',Math.random);if(step.error)break;g=step.game;h=step.health;}
 return {g,h,t,won:g.stage==='victory',fell,died:g.stage==='dead'};
}
// A party of heroes at the shared table: each plays their own turn from their own view; the foe acts at its place.
const plain=v=>JSON.parse(JSON.stringify(v));
function partyFight(heroes,f,chooser){
 const lead=heroes[0],ids=heroes.map((_,i)=>'P'+i),byId=Object.fromEntries(ids.map((id,i)=>[id,heroes[i]]));
 const g=withCompanion(fightWith(lead,f),lead.level);
 let table=r.startParty(r.adventureSnapshot(lead,g,{current:r.combatBasics(lead).hp,temp:0},true),'P0','P0');
 for(let i=1;i<heroes.length;i++)table=r.joinParty(table,ids[i],{character:JSON.stringify(heroes[i]),game:null,health:null,name:ids[i]}).snapshot;
 table=plain(table);
 // The others carry what the lead carries (draughts, magic): the same kit for everyone.
 for(let i=1;i<heroes.length;i++){const m=table.game.party.members[ids[i]];m.hero={...m.hero,potions:g.potions??0,...(magic.length?{pack:withMagic({},heroes[i]).pack}:{})};}
 const fallen=new Set();let t=0,world=null;
 for(;t<300;t++){
  const settled=r.settleParty(table);world=settled.world;
  for(const [id,m] of Object.entries(settled.members))if(m.status!=='up')fallen.add(id);
  if(world.stage!=='combat'&&!world.npcCombat?.active)break;
  const turn=world.turnOrder?.order?.[world.turnOrder.at]?.id??'P0',hero=byId[turn];if(!hero)break;
  const v=r.partyView(table,turn),max=r.combatBasics(hero).hp;
  const action=v.game.stage==='dying'?'death-save':chooser(hero,v.game,v.health,max);
  const step=r.adventureStep(v.game,v.health,hero,action,Math.random);
  if(step.error||step.waiting){problems.add('party '+hero.name+' L'+hero.level+' vs '+f.key+': '+(step.error??'spell waiting for a ruling'));break;}
  table=plain(r.adventureSnapshot(hero,step.game,step.health,true));
 }
 const dead=Object.values(r.settleParty(table).members).some(m=>m.status==='dead');
 return {won:world?.stage==='victory',fell:fallen.size>0,died:dead,t};
}
// A cell: `fights` days of `day` fights each against one creature (a party plays single fights).
function rateCell(heroes,f,chooser,opts={}){
 let wins=0,falls=0,deaths=0,rounds=0,hpLeft=0,n=0;
 for(let i=0;i<fights;i++){
  if(heroes.length>1){const p=partyFight(heroes,f,chooser);n++;rounds+=p.t;if(p.won)wins++;if(p.fell)falls++;if(p.died)deaths++;continue;}
  const hero=heroes[0],max=r.combatBasics(hero).hp;let carry={},h=null,over=false;
  for(let d=0;d<day;d++){
   n++;if(over)continue;
   const out=soloFight(hero,{...withCompanion(fightWith(hero,f),hero.level,opts.companion??companion),...carry},h,chooser);
   rounds+=out.t;
   if(out.died)deaths++;
   if(out.won){wins++;hpLeft+=(out.h?.current??max)/max;}else{if(out.fell)falls++;over=true;continue;}
   let g=out.g,hh=out.h;
   if(d<day-1){const rest=r.adventureStep(g,hh,hero,'short-rest',()=>0.5);if(!rest.error){g=rest.game;hh=rest.health;}}
   carry=pick(g,heroFieldsCarried);h=hh;
  }
 }
 return {win:wins/n,fall:falls/n,death:deaths/n,rounds:rounds/n,hp:wins?hpLeft/wins:0};
}
// --subclass: every class with each of its subclasses against every creature, compared with the SRD subclass.
if(subclassMode){
 const order={Artificer:'Intelligence Constitution Dexterity Wisdom Strength Charisma',Barbarian:'Strength Constitution Dexterity Wisdom Charisma Intelligence',Bard:'Charisma Dexterity Constitution Wisdom Intelligence Strength',Cleric:'Wisdom Constitution Strength Charisma Dexterity Intelligence',Druid:'Wisdom Constitution Dexterity Intelligence Charisma Strength',Fighter:'Strength Constitution Dexterity Wisdom Intelligence Charisma',Monk:'Dexterity Wisdom Constitution Strength Intelligence Charisma',Paladin:'Strength Charisma Constitution Wisdom Dexterity Intelligence',Ranger:'Dexterity Wisdom Constitution Strength Intelligence Charisma',Rogue:'Dexterity Constitution Intelligence Wisdom Charisma Strength',Sorcerer:'Charisma Constitution Dexterity Wisdom Intelligence Strength',Warlock:'Charisma Constitution Dexterity Wisdom Intelligence Strength',Wizard:'Intelligence Constitution Dexterity Wisdom Charisma Strength'};
 const plainHero=(cls,level,sub)=>{const rank=order[cls].split(' ');return r.makeCharacter({...r.blankBuild(),name:'Plain '+cls,species:'Human',class:cls,background:'Soldier',bonusMode:'three',baseScores:r.abilities.map(a=>r.standardArray[rank.indexOf(a)]),level,plannedSubclass:sub,spells:plainSpells(cls,sub)});};
 // A caster's plain spells: an attack cantrip (the one a subclass's gift favours), a healing spell when the class has
 // one, and a damaging spell of each of the first levels from the class's own list (cast while slots last).
 function plainSpells(cls,sub){
  // (Every Druid knows Poison Spray too, so the Fallow Field's favourite is no edge of its own.)
  const cantrip={'Frostblood Sorcery':'ray-of-frost','Circle of the Fallow Field':'poison-spray',Bonewright:'chill-touch'}[sub]??{Artificer:'fire-bolt',Bard:'vicious-mockery',Cleric:'sacred-flame',Druid:'produce-flame',Sorcerer:'fire-bolt',Warlock:'blast',Wizard:'fire-bolt'}[cls];
  const second=cls==='Druid'?'poison-spray':null;
  const heal={Artificer:'cure',Bard:'healing-word',Cleric:'cure',Druid:'cure'}[cls];
  const slots={Wizard:['missile','scorching-ray','fireball'],Sorcerer:['chromatic-orb','scorching-ray','fireball'],Warlock:['mind-spike','vampiric-touch'],Cleric:['guiding-bolt','spirit-guardians'],Druid:['ice-knife','moonbeam','call-lightning'],Bard:['dissonant-whispers','shatter']}[cls]??[];
  return [...new Set([cantrip,second,heal,...slots].filter(Boolean))];
 }
 // A Ranger fights beside a companion (a Fighter a level below), so Packbound's companion gift is measured, and its
 // SRD sibling is measured the same way.
 const rate=hero=>{let sum=0,n=0;for(const f of [...r.hostileFoes,storyFoe].filter(f=>!only||f.key===only)){const c=rateCell([hero],f,choose,hero.class==='Ranger'&&!companion?{companion:'Fighter'}:{});sum+=c.win;n++;}return sum/n;};
 const onlyClass=arg('--class',null);
 for(const cls of r.classes.filter(c=>!onlyClass||onlyClass.split(',').includes(c)))for(const level of levels.filter(l=>l>=3)){
  const subs=Object.keys(r.subclassOptions[cls]).filter(s=>subclassMode==='all'||s===subclassMode||Object.keys(r.subclassOptions[cls])[0]===s);if(subs.length<2&&subclassMode!=='all')continue;
  const base=rate(plainHero(cls,level,subs[0]));if(!quiet)console.log('\n'+cls+' L'+level+': '+subs[0]+' '+Math.round(100*base)+'% win');
  for(const sub of subs.slice(1)){const win=rate(plainHero(cls,level,sub)),gap=Math.round(100*(win-base));if(!quiet)console.log('  '+sub.padEnd(32)+String(Math.round(100*win)).padStart(4)+'% win ('+(gap>=0?'+':'')+gap+')');if(Math.abs(gap)>12)flags.push((gap>0?'stronger ':'weaker   ')+sub+' L'+level+': '+(gap>0?'+':'')+gap+' points against '+subs[0]);}
 }
}
for(const [index,entry] of (subclassMode?[]:r.readyHeroes).entries())for(const level of levels){
 const hero=heroAt(entry,level);if(!hero){problems.add(entry.form.name+' could not be built at level '+level);continue;}
 const others=Array.from({length:partySize-1},(_,i)=>heroAt(r.readyHeroes[(index+1+i)%r.readyHeroes.length],level));
 const max=r.combatBasics(hero).hp,row=[];
 for(const f of [...r.hostileFoes,storyFoe].filter(f=>!only||f.key===only)){
  const start=fightWith(hero,f);if(r.encounterFoe(hero,start).maximum!==start.enemyHP)problems.add('Foe HP mismatch for '+f.key);
  const c=rateCell([hero,...others],f,choose);cells.push(c);
  row.push(f.key.padEnd(8)+' '+String(Math.round(100*c.win)).padStart(3)+'% win '+String(Math.round(100*c.fall)).padStart(3)+'% fall '+String(Math.round(100*c.death)).padStart(3)+'% die ~'+c.rounds.toFixed(1).padStart(4)+(partySize>1?' steps':'r')+(c.hp?' '+String(Math.round(100*c.hp)).padStart(3)+'% HP':'        '));
  const name=hero.name.split(' ')[0]+' ('+hero.class+') L'+level+(partySize>1?' +'+(partySize-1):'');
  if(c.win<0.35)flags.push('deadly   '+name+' vs '+f.foe+(f.group?' (pack)':'')+': '+Math.round(100*c.win)+'% win, '+Math.round(100*c.fall)+'% fall');
  else if(c.win>0.97&&c.fall<0.01)flags.push('trivial  '+name+' vs '+f.foe+(f.group?' (pack)':'')+': '+Math.round(100*c.win)+'% win');
 }
 if(!quiet){console.log('\n'+hero.name+' ('+hero.class+' L'+level+', '+max+' HP, AC '+r.combatBasics(hero).ac+')'+(others.length?' with '+others.map(o=>o.name.split(' ')[0]).join(', '):'')+(companion?' with a level '+Math.max(1,level-1)+' '+companion+' companion':'')+(magic.length?' carrying '+magic.join(', '):'')+', '+fights+(day>1?' days of '+day+' fights':' fights')+' each:');for(const line of row)console.log('  '+line);}
}
console.log('\nFlags ('+flags.length+'):');for(const flag of flags)console.log('  '+flag);
if(!flags.length)console.log(subclassMode?'  none: every subclass sits within 12 points of its class\'s SRD subclass.':'  none: every fight sits between 35% and 97% wins.');
if(cells.length){const mean=k=>Math.round(100*cells.reduce((a,c)=>a+c[k],0)/cells.length);console.log('\nSummary: '+cells.length+' cells, mean '+mean('win')+'% win, '+mean('fall')+'% fall, '+mean('death')+'% die; '+cells.filter(c=>c.win>0.97&&c.fall<0.01).length+' trivial, '+cells.filter(c=>c.win<0.35).length+' deadly.');}
if(problems.size){console.log('\nEngine problems:');for(const p of problems)console.log('  '+p);process.exitCode=1;}
