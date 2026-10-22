// What a fight leaves behind (mapRules.js timePasses, lastingSpellRules.js markGone, adventureRules.js heroStep): time goes by
// on a retreat and a short rest, so a held spell or a spell's temporary hit points run out; a spell held on a creature
// of a fight that is over cannot reach anyone it was never cast on; and a finished brawl at the old crossroads inn
// leaves no record that spoils the next fight at the bridge.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {rulesSource}=require('./rules-files.cjs');
const source=rulesSource();
const r=vm.runInNewContext(source+'\n;({readyHero,makeCharacter,blankBuild,newAdventure,freshStoryGame,adventureStep,settleTurn,combatBasics,dmChoices,dmCommand,validAdventure,adventureSnapshot,timePasses})',{AsyncStorage:{},console});
const plain=v=>JSON.parse(JSON.stringify(v));
const person=name=>({name,species:'Human',gender:'man',role:'A resident.',motive:'Wants the road safe.',appearance:'A weathered face under a wool hood, with a scar.',personality:'Plain.',ties:{other:'friend',foe:'enemy',note:'They share the refuge.'}});
const story={id:'after-1',status:'active',title:'The Notch',premise:'A pass is closed.',opening:'Snow at the gate.',objective:'Open the pass.',resolution:'The pass is open.',secret:'The warden sold it.',foe:'Kestrel of the Notch',foeSpecies:'Human',foeAppearance:'A lean swordsman in a grey cloak with a hawk mask.',foeDamageType:'Slashing',region:'Veyr',terrain:'mountains',
 locations:{inn:{name:'Bellwether Refuge',description:'A refuge.',kind:'settlement'},bridge:{name:'Redknife Notch',description:'A cut.',kind:'mountain'},tower:{name:'Shrine',description:'A shrine.',kind:'shrine'}},npcs:{keeper:person('Tamsin Rook'),mara:person('Rusk Hale')}};
const druid=r.makeCharacter({...r.blankBuild(),name:'Moss Druid',species:'Human',class:'Druid',background:'Soldier',bonusMode:'three',baseScores:[8,14,13,10,15,12],level:5,advancements:[],spellSelectionVersion:2,spells:['produce-flame','druidcraft','guidance','heat-metal','moonbeam','cure','healing-word','ice-knife','thunderwave','entangle']});
const lair={type:'discover',place:{name:'Wolf Hollow',description:'A den among the roots of an old oak.',kind:'camp',bearing:'E',miles:1,danger:'lair',feature:null,lair:{template:'wolf',name:'Grey Wolf',appearance:'A great grey wolf with a torn ear.'}},travel:true};

// ---- Time on the clock ----
{
 const g={concentration:{id:'moonbeam',remaining:100,duration:'10 minutes',level:2,dc:13},temporarySpell:{id:'false-life',remaining:600}};
 const ten=r.timePasses(g,{current:5,temp:7},5);
 assert.equal(ten.game.concentration.remaining,50,'five minutes are fifty rounds');assert.equal(ten.health.temp,7);
 const hour=r.timePasses(g,{current:5,temp:7},60);
 assert.equal(hour.game.concentration,undefined,'a held spell runs out');assert.equal(hour.game.temporarySpell,undefined);assert.equal(hour.health.temp,0,'and so do a spell’s temporary hit points');
 assert.equal(r.timePasses(g,null,0).game,g,'no time, no change');
}

// ---- Moonbeam on a wolf, then a retreat ----
{
 let g=r.freshStoryGame(druid,plain(story),r.newAdventure(druid)),h={current:r.combatBasics(druid).hp,temp:0};
 const step=(a,rand=()=>0.5)=>{const s=r.settleTurn({hero:druid,game:g,health:h,action:a,random:rand,sceneTrigger:false});assert.equal(s.error,undefined,JSON.stringify(a)+': '+s.error);g=s.result.game;h=s.result.health;return s.result;};
 step(lair);assert.ok(g.wildFight,'the wolf’s den');
 step(r.dmCommand(druid,g,'I cast Moonbeam at the enemy.',h).action);
 assert.equal(g.concentration?.target,'foe','Moonbeam is held on the wolf');
 if(g.actionUsed)step('end-turn',()=>0.9);
 step('flee',()=>0.99);
 assert.equal(g.wildFight,undefined,'the druid flees the den');
 assert.equal(g.concentration,undefined,'a one-minute beam has run out on the road back');
 const brawl=r.dmChoices(druid,g,h).find(c=>c.id.startsWith('npc-attack:keeper'));
 step(brawl.action,()=>0.3);assert.ok(!r.dmChoices(druid,g,h).some(c=>/^again:/.test(c.id)),'the beam cannot be moved onto the residents');
}
// ---- A short rest is an hour ----
{
 const g={...r.freshStoryGame(druid,plain(story),r.newAdventure(druid)),concentration:{id:'moonbeam',remaining:10,duration:'1 minute',level:2,dc:13}};
 const rested=r.adventureStep(g,{current:5,temp:0},druid,'short-rest',()=>0.5);assert.equal(rested.error,undefined,rested.error);
 assert.equal(rested.game.concentration,undefined,'an hour’s rest outlasts a one-minute beam');
 const long=r.adventureStep({...g,concentration:{...g.concentration,remaining:6000,duration:'10 hours'}},{current:5,temp:0},druid,'short-rest',()=>0.5);
 assert.equal(long.game.concentration.remaining,5400,'and takes six hundred rounds off a longer one');
}

// ---- A held spell on a creature whose fight is over ----
{
 const g0=r.freshStoryGame(druid,plain(story),r.newAdventure(druid)),h={current:r.combatBasics(druid).hp,temp:0},road={type:'travel',destination:'tower'};
 const heat=r.adventureStep({...g0,concentration:{id:'heat-metal',remaining:900,duration:'1 minute',level:2,dc:13,target:'foe'}},h,druid,road,()=>0.5);
 assert.equal(heat.error,undefined,heat.error);
 assert.equal(heat.game.concentration,undefined,'Heat Metal ends once the creature it was on is gone');
 const beam=r.adventureStep({...g0,concentration:{id:'moonbeam',remaining:900,duration:'10 minutes',level:2,dc:13,target:'foe'}},h,druid,road,()=>0.5);
 assert.ok(beam.game.concentration&&beam.game.concentration.target===undefined,'a beam that can be moved is held on nothing once its fight is over');
}

// ---- The old crossroads tale: a finished brawl at the inn, then the bridge ----
{
 const hero=r.readyHero('fighter'),max=r.combatBasics(hero).hp;
 let g={...r.newAdventure(hero),npcCombat:{active:false,round:4,order:[{id:'player',side:'player',role:'attack',initiative:12},{id:'keeper',side:'enemy',role:'attack',initiative:8}],help:null}},h={current:max,temp:0};
 assert.ok(r.validAdventure(plain(r.adventureSnapshot(hero,g,h,true)),hero),'a finished brawl’s record is a valid save at the inn');
 for(const a of ['listen','approach']){
  const s=r.adventureStep(g,h,hero,a,()=>0.5);if(s.error)continue;g=s.game;h=s.health;
  assert.ok(r.validAdventure(plain(r.adventureSnapshot(hero,g,h,true)),hero),'after '+a+' the save is valid (stage '+g.stage+')');
 }
 assert.equal(g.npcCombat,undefined,'the record goes once the hero has left the inn');
}
// A written tale's foe that breaks away at half its hit points (stagingRules.js, boss.bloodied "flee"): the fight is
// over for good, nothing of it is left (initiative, the opening, a spent action, marks, the creatures beside it), and
// the foe waits at its stronghold to be gone after.
{
 const fixture=JSON.parse(fs.readFileSync('written-fixture.json','utf8')),hero=r.readyHero('fighter');
 assert.equal(fixture.story.staging.boss.bloodied.kind,'flee','the fixture\'s foe breaks away');
 let g=r.freshStoryGame(hero,{...plain(fixture.story),id:'aftermath-flee',status:'active',libraryId:fixture.id,artId:'journey-'+fixture.id,written:{slug:fixture.slug,edition:1,length:'short'}},r.newAdventure(hero));
 const last=g.story.chapters.length-1;g={...g,story:{...g.story,chapter:last},pace:{...g.pace,ch:last},stage:'bridge'};
 const fight=r.adventureStep(g,null,hero,'approach',()=>0.5).game,half=Math.floor(fight.story.foeStats.maximum/2)+1;
 const broke=r.adventureStep({...fight,enemyHP:half,openingAttackAvailable:false,encounterInitiative:{player:20,foe:1},marks:{foe:{prone:true}},foeAllies:[{template:'wolf',name:'Hound',appearance:'A lean grey hound with a torn ear.',hp:4,maximum:6}]},null,hero,{type:'encounter-attack',weapon:'Greatsword'},(()=>{let n=0;return()=>n++<3?0.9:0.01;})());
 assert.equal(broke.game.stage,'bridge','it broke away');
 for(const k of ['encounterInitiative','openingAttackAvailable','actionUsed','marks','foeAllies','turnOrder','heroCondition','foeTricks'])assert.equal(broke.game[k],undefined,k+' is left behind');
 assert.ok(broke.game.enemyHP>0);assert.ok(r.validAdventure(plain(r.adventureSnapshot(hero,broke.game,broke.health,true)),hero),'a valid save');
 assert.ok(r.dmChoices(hero,broke.game,broke.health).some(c=>c.id==='approach'),'and it can be gone after');
}
console.log('Fight aftermath: a retreat and a short rest let time run on held spells and spell-given hit points; a spell on a creature of a finished fight reaches no one new; a finished crossroads brawl leaves nothing to spoil the bridge; a written tale\'s foe that breaks away leaves nothing of the fight.');
