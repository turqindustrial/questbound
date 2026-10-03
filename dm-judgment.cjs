// Does the running Dungeon Master judge well? Not whether it acts (dm-probe.cjs), but how: people true to their
// grudges and bonds, deeds recorded, gold and goods handled sensibly, a fight kept to its tempo, resolved results
// told as they fell. Asks the live service on localhost:8084 (it must be running; a fraction of a cent), one request
// every three seconds so players keep their share of the provider's allowance.
// Usage: node dm-judgment.cjs [rounds]
const fs=require('node:fs'),vm=require('node:vm');process.chdir(__dirname);
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,dmContext,conversationPeople,adventureStep,freshStoryGame,recordDeed,recruitmentTargets,npcLore})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter'),well={current:12,temp:0},hurt={current:4,temp:0};
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0);
// The bandit lies dead where it fell: the player is still at the roadside, over the body.
const won={...fight,stage:'bridge',enemyHP:0,foeFate:'slain'};delete won.openingAttackAvailable;
const story={...fight.story,id:'probe-brinefold',title:'The Salt Road',introId:'surprise',premise:'Salt caravans vanish on the marsh road, and the village of Saltmere blames the thing in the causeway.',opening:'Gulls scream over the salt pans as you walk into Saltmere.',objective:'Find out what is taking the salt caravans on the Drowned Causeway.',foe:'Causeway Lurker',foeSpecies:'Aberration',region:'The Brinefold',terrain:'coast',
 locations:{inn:{name:'Saltmere',description:'A salt-pan village on stilts above grey mud.',kind:'settlement'},bridge:{name:'The Drowned Causeway',description:'A sunken stone road across the marsh, slick with weed.',kind:'road'},tower:{name:'Gull Tower',description:'A leaning lighthouse full of nests.',kind:'ruin'}}};
delete story.openingDialogue;delete story.geography;delete story.foeStats;delete story.landmarks;
const salt=r.freshStoryGame(hero,story,r.newAdventure(hero)),keeper=r.npcLore(salt,'keeper').name,mara=r.npcLore(salt,'mara').name;
const grudge=r.recordDeed(salt,'keeper','grudge','The player cut down my brother at the roadside and left him in the mud.').game;
const bond=r.recordDeed(salt,'mara','bond','The player hauled me out of the marsh when the tide had me by the legs.').game;
const rich={...salt,pack:{gold:57,items:[],spent:{}}},poor={...salt,pack:{gold:12,items:[],spent:{}}};
// A seller who is known to have a draught, a found trinket to sell, and nothing to give away.
const seller={...rich,worldFacts:[...(rich.worldFacts??[]),keeper+' keeps two healing draughts in her kit and will sell one for 50 gold.']};
const trinket={...rich,pack:{gold:57,items:[{name:'Silver Locket',kind:'treasure',qty:1,value:12,note:'A tarnished locket with a lock of fair hair inside.'}],spent:{}}};
const empty={...rich,potions:0};
const dying={...fight,stage:'dying',dying:{successes:0,failures:1}};
const miss=r.adventureStep(fight,well,hero,{type:'encounter-attack',weapon:'Greatsword'},()=>.02);
const spent={...fight,actionUsed:true};
// Resolved turns: a hit, and a killing blow, from the engine itself.
const hit=r.adventureStep(fight,well,hero,{type:'encounter-attack',weapon:'Greatsword'},()=>.95),kill=r.adventureStep({...fight,enemyHP:1},well,hero,{type:'encounter-attack',weapon:'Greatsword'},()=>.95);
const hitLines=hit.events.join(' '),killLines=kill.events.join(' ');
const says=(b,re)=>re.test([b.narration,...(b.dialogue??[]).map(l=>l.text)].join(' '));
const recruits=b=>(b.recruitment??[]).map(p=>p.decision).join(',');
const relates=b=>(b.relationships??[]).map(d=>d.npcId+':'+d.change).join(',');
const acted=b=>b.actionId?'action '+b.actionId:b.castCommand?'cast':b.check?'check '+(b.check.skill??b.check.ability):b.discovery?'discovery':b.ambush?'ambush':null;
// [label, what the player says, game, hp, extra context, is the reply good, what was looked at]
const cases=[
 ['grudge: asked to travel','Oona, come with me to the causeway. I need you at my side.',grudge,well,{conversationWith:'keeper'},b=>recruits(b)!=='join'&&!/join|check/.test(recruits(b))&&!/pleased|grateful|bond/.test(relates(b)),b=>'recruit '+(recruits(b)||'-')+' relate '+(relates(b)||'-')],
 ['grudge: asked for help','Oona, I need your help finding the lost caravans. Will you tell me what you know?',grudge,well,{conversationWith:'keeper'},b=>says(b,/\b(no|never|refuse|nothing|won't|will not|not|brother)\b/i)&&!/pleased|grateful|bond/.test(relates(b)),b=>'relate '+(relates(b)||'-')+' | '+String(b.dialogue?.[0]?.text??b.narration).slice(0,120)],
 ['bond: asked to travel','Tobin, will you come with me to Gull Tower?',bond,well,{conversationWith:'mara'},b=>/join/.test(recruits(b))||(/check/.test(recruits(b))&&(b.recruitment[0].dc??25)<=14),b=>'recruit '+(recruits(b)||'-')+(b.recruitment?.[0]?.dc?' dc '+b.recruitment[0].dc:'')],
 ['gift recorded','I press five gold pieces into Oona\'s hand. "For your trouble, captain."',rich,well,{conversationWith:'keeper'},b=>/keeper:(pleased|grateful)/.test(relates(b))&&(b.loot?.gold===-5),b=>'relate '+(relates(b)||'-')+' loot '+JSON.stringify(b.loot?.gold??null)],
 ['insult recorded','"You\'re a coward, Oona, hiding in camp while your people die on the road."',rich,well,{conversationWith:'keeper'},b=>/keeper:(offended|angered)/.test(relates(b)),b=>'relate '+(relates(b)||'-')],
 ['small talk: nothing recorded','I ask Tobin how long he has worked these roads.',rich,well,{conversationWith:'mara'},b=>!(b.relationships??[]).length&&!b.loot,b=>'relate '+(relates(b)||'-')+' loot '+(b.loot?'yes':'-')],
 ['buy a draught','I ask Oona to sell me one of her healing draughts and pay her the fifty gold.',seller,well,{conversationWith:'keeper'},b=>b.loot&&b.loot.gold<0&&b.loot.gold>=-50&&(b.loot.items??[]).some(i=>/Potion of Healing/i.test(i.name)&&i.qty===1),b=>'loot '+JSON.stringify(b.loot)+' | '+String([b.narration,...(b.dialogue??[]).map(l=>l.text)].join(' ')).slice(0,160)],
 ['cannot afford','I ask Oona to sell me a healing potion. I have twelve gold.',poor,well,{conversationWith:'keeper'},b=>(!b.loot||!(b.loot.items??[]).some(i=>/Potion/i.test(i.name)))&&(b.error?/enough gold/.test(b.error):says(b,/\b(twelve|12|short|afford|enough|cost|fifty|50)\b/i)),b=>'loot '+JSON.stringify(b.loot)+(b.error?' error '+b.error:'')],
 ['search the fallen','I search the bandit\'s body for coin and anything useful.',won,well,{},b=>!!b.check||(b.loot&&(b.loot.gold??0)>=0&&(b.loot.gold??0)<=100),b=>(acted(b)??'no action')+' loot '+JSON.stringify(b.loot)],
 ['an unpromised reward','Tobin promised me eighty gold for guarding the caravan. I collect it from him now.',rich,well,{conversationWith:'mara'},b=>!b.loot||(b.loot.gold??0)<=0,b=>'loot '+JSON.stringify(b.loot)+' | '+String([b.narration,...(b.dialogue??[]).map(l=>l.text)].join(' ')).slice(0,120)],
 ['giving what you do not carry','I hand Oona my healing potion for her wounded.',empty,well,{conversationWith:'keeper'},b=>!(b.loot?.items??[]).some(i=>/potion|draught/i.test(i.name)&&i.qty<0)&&says(b,/\b(no|none|not|don't|do not|haven't|have none|nothing)\b/i),b=>'loot '+JSON.stringify(b.loot)+' | '+String(b.narration).slice(0,120)],
 ['selling a find','I offer Oona the silver locket I found and ask what she will give for it.',trinket,well,{conversationWith:'keeper'},b=>!b.loot||((b.loot.items??[]).some(i=>/locket/i.test(i.name)&&i.qty===-1)&&(b.loot.gold??0)>=3&&(b.loot.gold??0)<=12),b=>'loot '+JSON.stringify(b.loot)+' | '+String([b.narration,...(b.dialogue??[]).map(l=>l.text)].join(' ')).slice(0,120)],
 ['a greedy demand','I tell Oona I want five hundred gold for saving the caravan, now.',rich,well,{conversationWith:'keeper'},b=>!b.loot||(b.loot.gold??0)<=100,b=>'loot '+JSON.stringify(b.loot)],
 ['fight: an attack in other words','I bring my greatsword down on the bandit with everything I have.',fight,well,{},b=>/^(attack|encounter-attack):Greatsword$/.test(String(b.actionId)),b=>acted(b)??'no action'],
 ['fight: action already used','I attack the bandit again!',spent,hurt,{},b=>!/^(attack|encounter-attack):/.test(String(b.actionId))&&(b.actionId===null||b.actionId==='end-turn'||b.actionId==='potion')&&says(b,/\b(action|bonus|turn)\b/i),b=>(acted(b)??'no action')+' | '+String(b.narration).slice(0,110)],
 ['fight: drink when hurt','I drink my healing potion.',fight,hurt,{},b=>b.actionId==='potion',b=>acted(b)??'no action'],
 ['fight: a question is not a move','What are my options here? How badly am I hurt?',fight,hurt,{},b=>!acted(b),b=>acted(b)??'no action'],
 ['fight: running away','I turn and run for the camp.',fight,hurt,{},b=>b.actionId==='flee',b=>acted(b)??'no action'],
 ['fight: words, not blows','I lower my blade and offer the bandit ten gold to walk away.',fight,well,{},b=>!String(b.actionId).startsWith('encounter-attack')&&(b.actionId===null||!!b.check),b=>acted(b)??'no action'],
 ['fight: two things at once','I attack the bandit and then drink my potion.',fight,hurt,{},b=>/^(attack|encounter-attack):/.test(String(b.actionId)),b=>acted(b)??'no action'],
 ['dying: no attacks','I get up and attack the bandit!',dying,{current:0,temp:0},{},b=>(b.actionId===null||b.actionId==='death-save')&&says(b,/\b(dying|unconscious|cannot|can't|bleeding|fading|death)\b/i),b=>(acted(b)??'no action')+' | '+String(b.narration).slice(0,120)],
 ['resolved: a miss is a miss','I attack with my greatsword.',miss.game,well,{engineResolved:miss.events},b=>!acted(b)&&!says(b,/\b(lands|bites into|cuts into|slashes across|draws blood|wounds him|wounds the|takes \d+ damage)\b/i),b=>(acted(b)??'narration')+' | '+String(b.narration).slice(0,120)],
 ['resolved: a hit is a hit','I attack with my greatsword.',hit.game,well,{engineResolved:hit.events},b=>!acted(b)&&!says(b,/\b(miss|misses|missed|glances off|wide)\b/i),b=>(acted(b)??'narration')+' | '+String(b.narration).slice(0,120)],
 ['resolved: a death is a death','I attack with my greatsword.',kill.game,well,{engineResolved:kill.events},b=>!acted(b)&&says(b,/\b(dead|dies|slain|slays|kills|killed|lifeless|corpse|falls dead|last breath|crumples)\b/i)&&!says(b,/\b(flees|retreats|escapes|limps away|staggers off)\b/i),b=>String(b.narration).slice(0,140)],
];
(async()=>{
 if(!/Hit\./.test(hitLines)||!/slain|dead|dies/.test(killLines))console.log('note: the engine rolls read '+hitLines.slice(0,80)+' / '+killLines.slice(0,80));
 const rounds=Math.max(1,Number(process.argv[2])||1);let good=0,total=0,ms=0;const misses=[];
 for(let round=0;round<rounds;round++)for(const [label,input,game,hp,extra,ok,seen] of cases){
  const talkingTo=extra.conversationWith?{id:extra.conversationWith,name:r.npcLore(game,extra.conversationWith).name,role:r.npcLore(game,extra.conversationWith).role}:null;
  const context={...r.dmContext(hero,game,hp),turnStart:{hp:hp.current,max:12},storyPreferences:{brutality:'gritty'},conversationWith:talkingTo,conversationParticipants:r.conversationPeople(game).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),recruitmentTargets:r.recruitmentTargets(game,input,talkingTo?.id??null),...(extra.engineResolved?{engineResolved:extra.engineResolved}:{})};
  const t=Date.now();let body;
  try{body=await (await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input,context})})).json();}catch(e){body={error:e.message};}
  ms+=Date.now()-t;total++;
  let fine=false;try{fine=ok(body);}catch{}
  if(fine)good++;else misses.push('['+label+'] -> '+(body.error&&!ok(body)?'ERROR '+body.error:seen(body)));
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,3000-(Date.now()-t))));
 }
 console.log(good+' of '+total+' judged well; '+Math.round(ms/total)+' ms a reply on average');
 for(const miss of misses)console.log('  miss '+miss);
})().catch(e=>{console.error(e);process.exit(1);});
