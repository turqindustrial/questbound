// Fight balance: every ready-made hero, at levels 1, 3 and 5, against every creature template, many times over, with a
// plain tactic (swing the main weapon or throw a damaging cantrip; drink a draught or heal when low). Prints the win
// rate, how often the hero falls, fight length and HP left, and flags fights that look deadly or trivial. Plain Node,
// no AI calls. Options: --fights N (default 200 per cell), --levels 1,3,5, --foe key (one creature, or "story" for a
// written story's main foe), --quiet (flags only), --subclass <name|all> (compare each subclass with its class's SRD
// subclass, on a plain hero of every class: their win rates should sit within about 8 points of each other).
const fs=require('fs'),vm=require('vm');
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHeroes,makeCharacter,blankBuild,hostileEncounterGame,hostileFoes,foeStatsFor,storyFoeStats,encounterFoe,newAdventure,adventureStep,dmCommand,attackOptions,combatBasics,subclassOptions,subclassAction,subclassUses,classes,abilities,standardArray,knownSpells})',{AsyncStorage:{},weaponIcon:()=>'sword'});
// A written story's main foe, alongside the creature templates.
const storyFoe={key:'story',foe:'Story Foe',species:'Unknown',type:'Slashing',appearance:'The main foe of a written story.',story:true};
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>0&&process.argv[i+1]!==undefined?process.argv[i+1]:fallback;};
const fights=Math.max(10,Number(arg('--fights',200))||200),levels=String(arg('--levels','1,3,5')).split(',').map(Number).filter(n=>n>=1&&n<=20),quiet=process.argv.includes('--quiet');
const heroAt=(entry,level)=>r.makeCharacter({...r.blankBuild(),...entry.form,level,advancements:[],spellSelectionVersion:2});
// The same camp as the Random hostile encounter, with the chosen creature in place of the random one.
function fightWith(hero,f){
 const g=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stats=f.story?r.storyFoeStats(hero.level,f.type):r.foeStatsFor(f,hero.level);
 return {...g,story:{...g.story,id:'hostile-encounter-'+f.key,title:'Balance: '+f.foe,foe:f.foe,foeSpecies:f.species,foeAppearance:f.appearance,foeDamageType:f.type,foeStats:stats},enemyHP:stats.maximum};
}
// A plain player: heal or drink when low, spend spell slots on the strongest simple spell while they last, then
// cantrips, then the main weapon.
function choose(hero,g,h,max){
 const cur=h?.current??max,low=cur<=max*0.35,foe=g.story.foe,cast=words=>{const c=r.dmCommand(hero,g,words,h);return c?.action&&!c.error?c.action:null;};
 const weapon=()=>{const weapons=r.attackOptions(hero),w=weapons.find(x=>!x.unarmed&&!x.ranged)??weapons[0];return {type:'encounter-attack',weapon:w.name};};
 // A draught or Second Wind is a bonus action: taken when low, alongside the action. Once the action is spent
 // (the turn waits for a bonus action), anything not worth using is skipped with End turn.
 if(!g.bonusUsed&&low&&(g.potions??0)>0)return 'potion';
 // The subclass's own action while it has uses: a bonus action before the action (healing only when low, temporary
 // hit points only when there are none), an action in place of the attack.
 const feat=r.subclassAction(hero),featLeft=feat?r.subclassUses(hero,feat.uses)-(g.resources?.feat??0):0;
 if(feat&&featLeft>0&&!g.actionUsed&&(feat.bonus?!g.bonusUsed&&(feat.effect.heal?low&&cur<max:feat.effect.temp?!(h?.temp>0):true):true))return 'class:'+feat.id;
 if(!g.bonusUsed&&low&&hero.class==='Fighter'&&(g.resources?.wind??0)<(hero.level>=10?4:hero.level>=4?3:2))return 'class:wind';
 if(g.actionUsed)return 'end-turn';
 if(hero.class==='Cleric'){if(low){const heal=cast('I cast Cure Wounds on myself');if(heal)return heal;}return cast('I cast Inflict Wounds on the '+foe)??cast('I cast Sacred Flame at the '+foe)??weapon();}
 if(hero.class==='Wizard')return cast('I cast Magic Missile at the '+foe)??cast('I cast Fire Bolt at the '+foe)??weapon();
 return weapon();
}
const flags=[],problems=new Set(),only=arg('--foe',null);
// --subclass: every class with each of its subclasses against every creature, compared with the SRD subclass.
const subclassMode=arg('--subclass',null);
if(subclassMode){
 const order={Artificer:'Intelligence Constitution Dexterity Wisdom Strength Charisma',Barbarian:'Strength Constitution Dexterity Wisdom Charisma Intelligence',Bard:'Charisma Dexterity Constitution Wisdom Intelligence Strength',Cleric:'Wisdom Constitution Strength Charisma Dexterity Intelligence',Druid:'Wisdom Constitution Dexterity Intelligence Charisma Strength',Fighter:'Strength Constitution Dexterity Wisdom Intelligence Charisma',Monk:'Dexterity Wisdom Constitution Strength Intelligence Charisma',Paladin:'Strength Charisma Constitution Wisdom Dexterity Intelligence',Ranger:'Dexterity Wisdom Constitution Strength Intelligence Charisma',Rogue:'Dexterity Constitution Intelligence Wisdom Charisma Strength',Sorcerer:'Charisma Constitution Dexterity Wisdom Intelligence Strength',Warlock:'Charisma Constitution Dexterity Wisdom Intelligence Strength',Wizard:'Intelligence Constitution Dexterity Wisdom Charisma Strength'};
 const plainHero=(cls,level,sub)=>{const rank=order[cls].split(' ');return r.makeCharacter({...r.blankBuild(),name:'Plain '+cls,species:'Human',class:cls,background:'Soldier',bonusMode:'three',baseScores:r.abilities.map(a=>r.standardArray[rank.indexOf(a)]),level,plannedSubclass:sub,spells:plainSpells(cls,sub)});};
 // A caster's plain spells: an attack cantrip (the one a subclass's gift favours) and a healing spell when the class has one.
 function plainSpells(cls,sub){const cantrip={'Frostblood Sorcery':'ray-of-frost','Circle of the Fallow Field':'poison-spray',Bonewright:'chill-touch'}[sub]??{Artificer:'fire-bolt',Bard:'vicious-mockery',Cleric:'sacred-flame',Druid:'produce-flame',Sorcerer:'fire-bolt',Warlock:'blast',Wizard:'fire-bolt'}[cls];const heal={Artificer:'cure',Bard:'healing-word',Cleric:'cure',Druid:'cure'}[cls];return [cantrip,heal].filter(Boolean);}
 // The plain caster: heal when low (a slot spell), else the attack cantrip, else the main weapon; the subclass action as before.
 const plainChoose=(hero,g,h,max)=>{const picked=choose(hero,g,h,max);if(typeof picked==='string'&&(picked.startsWith('class:')||picked==='potion'||picked==='end-turn'))return picked;const cur=h?.current??max,known=r.knownSpells(hero),cast=words=>{const c=r.dmCommand(hero,g,words,h);return c?.action&&!c.error?c.action:null;};
  const heal=known.find(s=>['cure','healing-word'].includes(s.id));if(heal&&cur<=max*0.35){const c=cast('I cast '+heal.name+' on myself');if(c)return c;}
  const cantrip=plainSpells(hero.class,'').length&&known.find(s=>s.level===0&&['fire-bolt','vicious-mockery','sacred-flame','produce-flame','blast','ray-of-frost','poison-spray','chill-touch'].includes(s.id));if(cantrip){const c=cast('I cast '+cantrip.name+' at the '+g.story.foe);if(c)return c;}
  return picked;};
 const rate=hero=>{let wins=0,n=0;for(const f of [...r.hostileFoes,storyFoe].filter(f=>!only||f.key===only))for(let i=0;i<fights;i++){let g=fightWith(hero,f),h=null,t=0;const max=r.combatBasics(hero).hp;for(;t<60&&g.stage==='combat'&&(h?.current??1)>0;t++){const step=r.adventureStep(g,h,hero,plainChoose(hero,g,h,max),Math.random);if(step.error||step.waiting){problems.add(hero.plannedSubclass+' L'+hero.level+' vs '+f.key+': '+(step.error??'spell waiting for a ruling'));break;}g=step.game;h=step.health;}n++;if(g.stage==='victory')wins++;}return wins/n;};
 for(const cls of r.classes)for(const level of levels.filter(l=>l>=3)){
  const subs=Object.keys(r.subclassOptions[cls]).filter(s=>subclassMode==='all'||s===subclassMode||Object.keys(r.subclassOptions[cls])[0]===s);if(subs.length<2&&subclassMode!=='all')continue;
  const base=rate(plainHero(cls,level,subs[0]));if(!quiet)console.log('\n'+cls+' L'+level+': '+subs[0]+' '+Math.round(100*base)+'% win');
  for(const sub of subs.slice(1)){const win=rate(plainHero(cls,level,sub)),gap=Math.round(100*(win-base));if(!quiet)console.log('  '+sub.padEnd(32)+String(Math.round(100*win)).padStart(4)+'% win ('+(gap>=0?'+':'')+gap+')');if(Math.abs(gap)>8)flags.push((gap>0?'stronger ':'weaker   ')+sub+' L'+level+': '+(gap>0?'+':'')+gap+' points against '+subs[0]);}
 }
}
for(const entry of subclassMode?[]:r.readyHeroes)for(const level of levels){
 const hero=heroAt(entry,level);if(!hero){problems.add(entry.form.name+' could not be built at level '+level);continue;}
 const max=r.combatBasics(hero).hp,row=[];
 for(const f of [...r.hostileFoes,storyFoe].filter(f=>!only||f.key===only)){
  let wins=0,falls=0,rounds=0,hpLeft=0;
  for(let n=0;n<fights;n++){
   let g=fightWith(hero,f),h=null,t=0;
   if(n===0&&r.encounterFoe(hero,g).maximum!==g.enemyHP)problems.add('Foe HP mismatch for '+f.key);
   for(;t<60&&g.stage==='combat'&&(h?.current??1)>0;t++){
    const step=r.adventureStep(g,h,hero,choose(hero,g,h,max),Math.random);
    if(step.error||step.waiting){problems.add(hero.name+' L'+level+' vs '+f.key+': '+(step.error??'spell waiting for a ruling'));break;}
    g=step.game;h=step.health;
   }
   rounds+=t;
   if(g.stage==='victory'){wins++;hpLeft+=(h?.current??max)/max;}
   else if((h?.current??1)<=0||['dying','dead'].includes(g.stage))falls++;
  }
  const win=wins/fights,fall=falls/fights;
  row.push(f.key.padEnd(8)+' '+String(Math.round(100*win)).padStart(3)+'% win '+String(Math.round(100*fall)).padStart(3)+'% fall ~'+(rounds/fights).toFixed(1).padStart(4)+'r'+(wins?' '+String(Math.round(100*hpLeft/wins)).padStart(3)+'% HP':'        '));
  const name=hero.name.split(' ')[0]+' ('+hero.class+') L'+level;
  if(win<0.35)flags.push('deadly   '+name+' vs '+f.foe+(f.group?' (pack)':'')+': '+Math.round(100*win)+'% win, '+Math.round(100*fall)+'% fall');
  else if(win>0.97&&fall<0.01)flags.push('trivial  '+name+' vs '+f.foe+(f.group?' (pack)':'')+': '+Math.round(100*win)+'% win');
 }
 if(!quiet){console.log('\n'+hero.name+' ('+hero.class+' L'+level+', '+max+' HP, AC '+r.combatBasics(hero).ac+'), '+fights+' fights each:');for(const line of row)console.log('  '+line);}
}
console.log('\nFlags ('+flags.length+'):');for(const flag of flags)console.log('  '+flag);
if(!flags.length)console.log(subclassMode?'  none: every subclass sits within 8 points of its class\'s SRD subclass.':'  none: every fight sits between 35% and 97% wins.');
if(problems.size){console.log('\nEngine problems:');for(const p of problems)console.log('  '+p);process.exitCode=1;}
