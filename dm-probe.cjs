// Does the running Dungeon Master do what a player plainly asks? Ordinary requests (go somewhere known, go somewhere
// new, search, rest, drink a draught) each should come back with the fitting game action; questions and plans should
// not start one. Asks the live service on localhost:8084, so it needs the DM running and costs a fraction of a cent.
// It asks one thing every three seconds, so that it never uses up the provider's per-minute allowance while people play.
// Usage: node dm-probe.cjs [rounds]        (prints a score, the misses and how long a reply took)
// Run it before and after changing the play model, the instructions in dm-server.cjs or dm-intent.cjs.
const fs=require('node:fs'),vm=require('node:vm');process.chdir(__dirname);
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,dmContext,conversationPeople,freshStoryGame})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('cleric'),well={current:10,temp:0},hurt={current:4,temp:0};
// After a skirmish: the bandit dead, or still out there after the player fled back to camp.
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);
const won={...fight,stage:'inn',enemyHP:0,foeFate:'slain'},fled={...fight,stage:'inn'};delete won.openingAttackAvailable;delete fled.openingAttackAvailable;
// A written story in its first scene, with a landmark on the map.
const story={...fight.story,id:'probe-brinefold',title:'The Salt Road',introId:'surprise',premise:'Salt caravans vanish on the marsh road, and the village of Saltmere blames the thing in the causeway.',opening:'Gulls scream over the salt pans as you walk into Saltmere.',objective:'Find out what is taking the salt caravans on the Drowned Causeway.',foe:'Causeway Lurker',foeSpecies:'Aberration',region:'The Brinefold',terrain:'coast',
 locations:{inn:{name:'Saltmere',description:'A salt-pan village on stilts above grey mud.',kind:'settlement'},bridge:{name:'The Drowned Causeway',description:'A sunken stone road across the marsh, slick with weed.',kind:'road'},tower:{name:'Gull Tower',description:'A leaning lighthouse full of nests.',kind:'ruin'}},
 landmarks:[{name:'Tern Ferry',description:'A rope ferry across the brown estuary, with a bell to call the ferryman.',kind:'water',bearing:'E',miles:2,from:'inn',danger:'safe',feature:'A bell nobody answers.'}]};
delete story.openingDialogue;delete story.geography;delete story.foeStats;
const salt=r.freshStoryGame(hero,story,r.newAdventure(hero));
const acted=b=>b.actionId?'action '+b.actionId:b.discovery?'discovery '+b.discovery.name:b.check?'check '+(b.check.skill??b.check.ability):b.ambush?'ambush':b.castCommand?'cast':b.loot?'loot':b.worldEvent?'world event':null;
const journey=b=>String(b.actionId??'').startsWith('travel-')||!!b.discovery;
const cases=[
 ['after a win','I walk up to the lookout rock to see what is coming.',won,well,b=>b.actionId==='travel-tower'],
 ['after a win','I go back to the roadside and search the bandit\'s body.',won,well,b=>b.actionId==='travel-bridge'||!!b.check||!!b.loot],
 ['after a win','I head for the lookout.',won,well,b=>b.actionId==='travel-tower'],
 ['after a win','I follow the old cart road north until I find wherever the bandit was camping.',won,well,b=>!!b.discovery||!!b.check],
 ['after fleeing','I climb the lookout rock to watch the road.',fled,well,b=>b.actionId==='travel-tower'],
 ['after fleeing','I go back and face the bandit.',fled,well,b=>b.actionId==='travel-bridge'],
 ['a written story','I walk out to the ferry and ring the bell.',salt,well,b=>b.actionId==='travel-p1'],
 ['a written story','I follow the shore south to see what lies beyond the salt pans.',salt,well,b=>!!b.discovery],
 ['a written story','I go to the Drowned Causeway.',salt,well,b=>b.actionId==='travel-bridge'],
 ['a written story','I search the salt sheds for anything the caravans left behind.',salt,well,b=>!!b.check||!!b.loot||!!b.worldEvent],
 ['a written story','I bed down and rest for the night.',salt,hurt,b=>b.actionId==='long-rest'],
 ['a written story','I drink my healing draught.',salt,hurt,b=>b.actionId==='potion'],
 // These must not start a journey.
 ['a question','How far is Gull Tower from here?',salt,well,b=>!journey(b)],
 ['a plan','I tell the salt-workers that I mean to go out to the causeway tomorrow.',salt,well,b=>!journey(b)],
 ['small talk','I ask who keeps the ferry these days.',salt,well,b=>!journey(b)],
];
(async()=>{
 const rounds=Math.max(1,Number(process.argv[2])||1);let good=0,total=0,ms=0;const misses=[];
 for(let round=0;round<rounds;round++)for(const [label,input,game,hp,ok] of cases){
  const context={...r.dmContext(hero,game,hp),turnStart:{hp:hp.current,max:10},storyPreferences:{brutality:'gritty'},conversationWith:null,conversationParticipants:r.conversationPeople(game).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),recruitmentTargets:[]};
  const t=Date.now();let body;
  try{body=await (await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input,context})})).json();}catch(e){body={error:e.message};}
  ms+=Date.now()-t;total++;await new Promise(resolve=>setTimeout(resolve,Math.max(0,3000-(Date.now()-t))));
  if(!body.error&&ok(body))good++;else misses.push('['+label+'] "'+input+'" -> '+(body.error?'ERROR '+body.error:(acted(body)??'no action')+': '+String(body.narration).slice(0,150)));
 }
 console.log(good+' of '+total+' as hoped; '+Math.round(ms/total)+' ms a reply on average');
 for(const miss of misses)console.log('  miss '+miss);
})().catch(e=>{console.error(e);process.exit(1);});
