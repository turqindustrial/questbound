const http=require('node:http');
const {diagnose,providerError}=require('./ai-diagnostics.cjs'),{loopbackHost}=require('./security-headers.cjs');
delete require.cache[require.resolve('./dm-rules.cjs')];
const {turnRules,validateGroundedReply}=require('./dm-rules.cjs');
delete require.cache[require.resolve('./ai-request.cjs')];
const {modelOptions,providerTimeout,outputBudget,outputText,firstObject,repairedJson,requestFailure}=require('./ai-request.cjs');
// Holding the Dungeon Master to what the player asked (reloaded with this file, so an edit there is live at once).
delete require.cache[require.resolve('./dm-intent.cjs')];
const {situation,secondLook,settled}=require('./dm-intent.cjs');
// The standing instructions (dm-instructions.cjs), reloaded with this file like the modules above.
delete require.cache[require.resolve('./dm-instructions.cjs')];
const {standingPrompt,heroPrompt,narratorVoice,suggestionNote,questInstructions,memoryInstructions,contractInstructions}=require('./dm-instructions.cjs');
// The reply schema and its parts (dm-schemas.cjs), reloaded with this file like the modules above.
delete require.cache[require.resolve('./dm-schemas.cjs')];
const {npcClassNames,introduceSchema,replySchemaFor,spelledOutSchema,asFields,flatReply,phaseFields,listFields}=require('./dm-schemas.cjs');
// Reading the reply: its checks and repairs (dm-replies.cjs), reloaded with this file like the modules above.
delete require.cache[require.resolve('./dm-replies.cjs')];
const {cut,deadEnd,repairedCreature,repairedDiscovery,repairedIntroduce,repairedLoot,errandPaidTurn,errandPurse,clampedLoot,validLoot,personId,validIntroduce,validRelationships,validCreature,validDiscovery,spellNamed,validCheck,validRuling,checkedHp,unusable,transient,faultKind,tellingCut,castableSpell,castWords,echoes,distinctDialogue,cleanRemember,cleanSuggestions}=require('./dm-replies.cjs');
const allowedOrigins=new Set(['http://localhost:8081','http://localhost:8082']);
// What the model is shown: the scene without the guidance above, without text it would read twice (portraits, the
// opening already played, places described in two lists, conversation kept in two journals) and without the parts
// this phase cannot use (choices and spells while narrating a resolved turn, creature templates when no fight can
// start). The full context still drives every check on the reply.
function sceneFor(body,{canDiscover=false,canAmbush=false}={}){
 const c=body.context??{},resolved=!!c.engineResolved,narrating=resolved||!!c.sceneTrigger,ruling=!!c.pendingSpell&&!resolved;
 // `now` restates the present in plain sentences (see dm-intent.cjs): where the player is, whether a fight is on,
 // what became of the foe and where they may go.
 const scene={now:situation(c),...c};
 // Whether the player sees suggestions is said in this turn's note (suggestionNote), not read with the scene.
 for(const key of ['actionContract','loadoutGuidance','castingHelp','suggest'])delete scene[key];
 if(Array.isArray(scene.skillChecks))scene.skillChecks=scene.skillChecks.map(s=>s&&typeof s==='object'?(s.skill??s.ability)+': '+s.ability+' '+(s.total>=0?'+':'')+s.total+(s.expert?' (expert)':s.trained?' (trained)':'')+(s.reliable?' (reliable)':''):s);
 if(scene.player&&typeof scene.player==='object')scene.player={...scene.player,backstory:cut(scene.player.backstory,600),description:cut(scene.player.description,400),connections:cut(scene.player.connections,300)};
 if(scene.story&&typeof scene.story==='object'){
  const s=scene.story,fighting=!!scene.encounter||scene.stage==='bridge',{foeStats,...story}=s;
  story.opening=cut(s.opening,320);story.foeAppearance=cut(s.foeAppearance,fighting?600:240);
  // The introduction is read on the tale's first move (context.introduction), not on every turn.
  delete story.introduction;
  if(scene.world&&s.locations&&typeof s.locations==='object')story.locations=Object.fromEntries(Object.entries(s.locations).map(([id,l])=>[id,{name:l?.name}]));
  if(s.npcs&&typeof s.npcs==='object')story.npcs=Object.fromEntries(Object.entries(s.npcs).map(([id,n])=>{const {appearance,...rest}=n??{};return [id,rest];}));
  scene.story=story;
 }
 // People elsewhere (residents of places not yet reached among them) are told in brief: who and where they are, how
 // they feel, how near a grudge is to forgiveness, and their last two memories.
 if(Array.isArray(scene.npcSocialState))scene.npcSocialState=scene.npcSocialState.map(n=>!n||typeof n!=='object'||n.present!==false?n:{id:n.id,name:n.name,role:n.role,livesAt:n.livesAt,...(n.land?{land:n.land}:{}),...(n.unnoticed?{unnoticed:true}:{}),attitude:n.attitude,grudge:n.grudge,...(n.grudge&&n.forgiveness?{forgiveness:n.forgiveness}:{}),...(n.forgave?{forgave:n.forgave}:{}),bond:n.bond,fate:n.fate,ties:n.ties,metHero:n.metHero,...(n.standing?{standing:n.standing}:{}),...(n.trainedAs?{trainedAs:n.trainedAs}:{}),memories:(Array.isArray(n.memories)?n.memories:[]).slice(-2)});
 if(Array.isArray(scene.nearbyNPCs))scene.nearbyNPCs=scene.nearbyNPCs.map(n=>{if(!n||typeof n!=='object')return n;const {memories,...rest}=n;return {...rest,appearance:cut(n.appearance,200)};});
 if(Array.isArray(scene.journal))scene.journal=scene.journal.filter(e=>e?.title!=='AI DM conversation').slice(-6).map(e=>e&&typeof e==='object'?{...e,text:cut(e.text,500)}:e);
 if(Array.isArray(scene.conversationHistory))scene.conversationHistory=scene.conversationHistory.slice(-6).map(e=>e&&typeof e==='object'?{...e,text:cut(e.text,1000)}:e);
 if(resolved&&Array.isArray(scene.recentEvents))scene.recentEvents=scene.recentEvents.slice(0,4);
 if(scene.world&&typeof scene.world==='object'){
  const w={...scene.world};
  if(canAmbush||canDiscover){if(Array.isArray(w.creatureTemplates))w.creatureTemplates=w.creatureTemplates.map(t=>t&&typeof t==='object'?t.template+': '+t.example+' ('+t.kind+(t.pack?', a pack':'')+'), signature move '+t.signatureMove:t);}
  else delete w.creatureTemplates;
  if(Array.isArray(w.knownPlaces))w.knownPlaces=w.knownPlaces.map(p=>{if(!p||typeof p!=='object')return p;const {description,...rest}=p;return p.id===w.current?.id?rest:{...rest,description:cut(description,140)};});
  delete w.poolTaken;
  scene.world=w;delete scene.travelRoutes;
 }
 // A telling or a cue chooses nothing; the hero's spells stay with what lasts the tale (sceneParts), so the parts after
 // them stay cached between a turn and its telling.
 if(narrating)scene.choices=[];
 if(Array.isArray(scene.spellReference))scene.spellReference=scene.spellReference.map(s=>s&&typeof s==='object'?{...s,material:cut(s.material,80)}:s);
 if(!ruling&&scene.stage!=='combat'&&!scene.npcCombat?.active)delete scene.npcDefenses;
 // The rules text for the spells and features the player's words name (and a spell awaiting a ruling), read this turn.
 // A scene cue's words are the game's, not the player's: they name no spell or feature.
 {const named=c.sceneTrigger?null:turnRules(body);if(named&&(named.spells.length||named.featureDetails.length))scene.rulesReference=named;}
 leaner(scene,body);compact(scene,body);briefer(scene,body);if(narrating&&!ruling)tellingOnly(scene,body);
 // The player's words come last, after the scene, so the start of the request stays the same from turn to turn.
 return {context:inCacheOrder(lean(scene)),input:body.input};
}
// A leaner turn (the host, 2026-10-17: "only send what the moment needs (no spell reference for a fighter, less of the
// long story memory during a plain fight, fewer far-away places)"). In a fight the model reads the fight, the hero, the
// foe and how the creatures stand, the people here, a short memory and nothing of far-away lands; outside one the
// far-away lists are shorter (anything the player names is kept); what two lists both tell is told once. Only what the
// model reads changes: every check on the reply still sees the whole context.
const leanLimits={morePlaces:12,farLands:10,farLandsWithPlaces:5,peopleElsewhere:12,journalInFight:2,taleLinesInFight:2};
const fightingNow=c=>c.stage==='combat'||!!c.npcCombat?.active||!!c.dying;
// Whether the player's words name a place or person given as "Name (…)" or "Name, …".
const namedIn=(input,text)=>{const n=String(text??'').split(/ \(|, /)[0].trim().toLowerCase().replace(/^the /,'');return n.length>=3&&String(input??'').toLowerCase().includes(n);};
function leaner(scene,body){
 const input=body.input,fight=fightingNow(scene);
 const keepNamed=(list,n)=>Array.isArray(list)&&list.length>n?[...list.slice(0,n),...list.slice(n).filter(x=>namedIn(input,typeof x==='string'?x:x?.name))]:list;
 if(scene.story&&typeof scene.story==='object'){
  // Where the starting places lie is in world.knownPlaces; the opening lines were spoken on the tale's first turn.
  const s={...scene.story};delete s.geography;if(!scene.openingTurn)delete s.openingDialogue;scene.story=s;
 }
 if(scene.world&&typeof scene.world==='object'){
  const w={...scene.world};
  if(fight){
   const travel=new Set((scene.choices??[]).map(ch=>/^travel-(.+)$/.exec(String(ch?.id??''))?.[1]).filter(Boolean));
   if(Array.isArray(w.knownPlaces))w.knownPlaces=w.knownPlaces.filter(p=>!p||typeof p!=='object'||p.id===w.current?.id||travel.has(p.id));
   for(const k of ['morePlaces','morePlacesNotListed','farLands','regions','landsRemembered','placesLeft','peopleMet'])delete w[k];
  }else{
   if(Array.isArray(w.morePlaces)&&w.morePlaces.length>leanLimits.morePlaces){const kept=keepNamed(w.morePlaces,leanLimits.morePlaces);w.morePlacesNotListed=(Number(w.morePlacesNotListed)||0)+w.morePlaces.length-kept.length;w.morePlaces=kept;}
   // Other lands: the nearest ten with their roads (the nearest five with their places by name); the rest are named in
   // world.regions, and any land or place the player names is kept in full.
   if(Array.isArray(w.farLands)){const named=l=>!!l&&typeof l==='object'&&(namedIn(input,l.name)||(Array.isArray(l.places)&&l.places.some(p=>namedIn(input,p))));
    w.farLands=w.farLands.filter((l,i)=>i<leanLimits.farLands||named(l)).map((l,i)=>!l||typeof l!=='object'||!Array.isArray(l.places)||i<leanLimits.farLandsWithPlaces||named(l)?l:{name:l.name,...(l.road?{road:l.road}:{}),placesKnown:l.places.length});}
  }
  scene.world=w;
 }
 if(fight)delete scene.peopleElsewhere;
 else if(Array.isArray(scene.peopleElsewhere))scene.peopleElsewhere=keepNamed(scene.peopleElsewhere,leanLimits.peopleElsewhere);
 if(fight){
  if(Array.isArray(scene.npcSocialState))scene.npcSocialState=scene.npcSocialState.filter(n=>!n||typeof n!=='object'||n.present!==false);
  if(Array.isArray(scene.journal))scene.journal=scene.journal.slice(-leanLimits.journalInFight);
  // The memory in a fight: the tale under way (its first line and the chapter being played) and the facts that bear on
  // who and what is here; the earlier tales and the rest wait for a quieter moment.
  if(scene.memory&&typeof scene.memory==='object'){const m=scene.memory,tale=Array.isArray(m.taleNow)?m.taleNow:[];scene.memory={...(tale.length?{taleNow:tale.length>leanLimits.taleLinesInFight?[tale[0],...tale.slice(1-leanLimits.taleLinesInFight)]:tale}:{}),...(m.facts?{facts:m.facts}:{}),...(m.about?{about:m.about}:{})};}
  // A creature fight: the defenses of people who are not here are not needed.
  if(!scene.npcCombat?.active&&scene.npcDefenses&&typeof scene.npcDefenses==='object'){const here=new Set((scene.npcSocialState??[]).filter(n=>n&&n.present!==false).map(n=>n.id));scene.npcDefenses=Object.fromEntries(Object.entries(scene.npcDefenses).filter(([id])=>here.has(id)));}
 }
 // People here are described in nearbyNPCs and their standing with the hero in npcSocialState: each told once.
 const social=new Map((Array.isArray(scene.npcSocialState)?scene.npcSocialState:[]).filter(n=>n&&typeof n==='object').map(n=>[n.id,n]));
 if(Array.isArray(scene.nearbyNPCs)){
  const near=new Set();
  scene.nearbyNPCs=scene.nearbyNPCs.map(n=>{if(!n||typeof n!=='object'||!social.has(n.id))return n;near.add(n.id);const {attitude,grudge,bond,standing,trainedAs,...rest}=n;return rest;});
  if(near.size)scene.npcSocialState=scene.npcSocialState.map(n=>{if(!n||typeof n!=='object'||!near.has(n.id))return n;const {role,regardsYourKind,...rest}=n;return rest;});
 }
 // Hit points are told in npcHP (with the turn's other figures, last), not again among the standings.
 const hp=scene.npcHP&&typeof scene.npcHP==='object'?scene.npcHP:{};
 if(Array.isArray(scene.npcSocialState))scene.npcSocialState=scene.npcSocialState.map(n=>{if(!n||typeof n!=='object')return n;const out={...n};if(out.response==='No hostile response recorded.')delete out.response;if(out.id in hp&&out.hp===hp[out.id])delete out.hp;return out;});
 // Hit points of people who are not here are not needed (the checks on the reply still see them all).
 {const here=new Set((Array.isArray(scene.npcSocialState)?scene.npcSocialState:[]).filter(n=>n&&typeof n==='object'&&n.present!==false).map(n=>n.id));
  if(scene.npcHP&&typeof scene.npcHP==='object')scene.npcHP=Object.fromEntries(Object.entries(scene.npcHP).filter(([id])=>here.has(id)||scene.followers?.[id]));}
 // Which places were visited is told with each place (world.knownPlaces, morePlaces), not again as a list of ids.
 if(scene.world&&scene.map&&typeof scene.map==='object'&&Array.isArray(scene.map.visited)){const {visited,...rest}=scene.map;scene.map=rest;}
 if(Array.isArray(scene.conversationParticipants))scene.conversationParticipants=scene.conversationParticipants.map(n=>n&&typeof n==='object'&&social.has(n.id)?{id:n.id,name:n.name}:n);
 // A note in brackets that several choices share (how a grapple is saved against, what lies beyond the map) is given once.
 if(Array.isArray(scene.choices)){const seen=new Set();scene.choices=scene.choices.map(ch=>{if(!ch||typeof ch.label!=='string')return ch;const m=/ (\([^()]{12,}\))$/.exec(ch.label);if(!m)return ch;if(seen.has(m[1]))return {...ch,label:ch.label.slice(0,m.index)};seen.add(m[1]);return ch;});}
}
// Said once and briefly (the host, 2026-10-21: "optimize token usage even further we shouldn't need that many per
// turn"). What the game sends as objects with many keys (places, spells, skills, choices, people's ties, the journal)
// the model reads as short lines; what another field already tells (a place's own entry beside world.current, the
// story's people beside the people here, the opening beside the journal, a price list that never changes, a skill no
// better than its ability) is told once; fixed explanations (weapon masteries, grappling, hands) are in the standing
// prompt. Only what the model reads changes: every check on the reply still sees the whole context.
const standardResponses=new Set(['Refuses to help the player and wants nothing to do with them.','Wary and cold toward the player.','No strong feelings about the player.','Warm toward the player and willing to help.','Devoted to the player and eager to help.']);
const standardPrices='{"Potion of Healing":50,"Arrow":0.05,"Dagger":2,"Handaxe":5,"Javelin":0.5,"Mace":5,"Quarterstaff":0.2,"Sickle":1,"Spear":1,"Greataxe":30,"Greatsword":50,"Flail":10,"Longsword":15,"Battleaxe":10,"Trident":5,"Maul":10,"Glaive":20,"Halberd":20,"Scimitar":25,"Shortsword":10,"Shortbow":25,"Longbow":50}';
// The game's creature kinds (hostileEncounter.js hostileFoes, as dmContext.js sends them): the same for every player,
// so the standing prompt names them and a scene that lists exactly these leaves them out (verify-dm-cache checks).
const standardCreatures='["bandit: Bandit Cutthroat (Human), signature move Dirty Trick","wolf: Starving Dire Wolf (Dire wolf), signature move Knockdown","goblin: Three goblin raiders (Goblin, a pack), signature move Ganging Up","skeleton: Restless Skeleton (Undead skeleton), signature move Shield Wall","boar: Enraged Boar (Boar), signature move Charge","spider: Giant Cave Spider (Giant spider), signature move Web","zombies: Two rotting zombies (Undead zombie, a pack), signature move Undead Fortitude","orc: Orc Marauder (Orc), signature move Savage Blow","wolves: Two grey wolves (Wolf, a pack), signature move Pack Tactics"]';
const lightWeapon=/^(?:Dagger|Handaxe|Sickle|Scimitar|Shortsword)\b/;
const abilityShort={Strength:'Str',Dexterity:'Dex',Constitution:'Con',Intelligence:'Int',Wisdom:'Wis',Charisma:'Cha'};
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const sameStart=(a,b,n=80)=>typeof a==='string'&&typeof b==='string'&&a.length>=24&&b.length>=24&&a.replace(/…$/,'').slice(0,n)===b.replace(/…$/,'').slice(0,n);
// A person's ties as one line: whom they are tied to and how, and how they regard the main foe.
const tiesLine=t=>{if(!isObj(t))return t;const all=Array.isArray(t.all)?t.all:[];const parts=all.length?all.map(x=>(x?.name??x?.id)+' ('+x?.id+'): '+x?.kind):t.other?[t.other+': '+t.toOther]:[];if(t.toFoe)parts.push('the foe: '+t.toFoe);return parts.join('; ')+(t.note&&String(t.note).length>2?'. '+cut(String(t.note),80):'');};
// A known place as one line: "Name [id]: kind, in Land, 3.7 miles S, visited, lair, threat X (wolf). Feature: …" (a
// place not yet visited says nothing of it). Its description only when asked for (the place the player names, the
// errand's): the place the player stands in is told in full in world.current, and a journey's telling has it there.
// A place not yet visited within five miles of here keeps a few words of what it is (80 characters; the stories spec,
// Phase A5, 2026-10-22: the places nearby were names alone, and a scene could not point anywhere).
const milesOf=distance=>{const m=/^([\d.,]+) (ft|miles?)\b/.exec(String(distance??''));return m?Number(m[1].replace(/,/g,''))/(m[2]==='ft'?5280:1):NaN;};
const placeLine=(p,described=true,lands=null)=>{if(!isObj(p))return p;if(p.land&&lands?.has(p.land))p={...p,distance:null};const away=milesOf(p.distance),far=!described&&(p.land||away>5),near=!described&&!p.land&&!p.visited&&away<=5;const bits=[p.kind,p.land?'in '+p.land:null,p.distance&&p.distance!=='0 ft'?p.distance+(p.bearing?' '+p.bearing:''):null,p.visited?'visited':null,p.cleared?'cleared':null,p.danger&&p.danger!=='safe'?p.danger:null,p.threat?'threat '+p.threat.name+' ('+p.threat.template+')':null].filter(Boolean);
 return p.name+' ['+p.id+']: '+bits.join(', ')+'.'+(p.feature&&!far?' Feature: '+p.feature:'')+(described&&p.description?' '+cut(p.description,100):near&&p.description?' '+cut(p.description,80):'');};
// A spell as one line: "Cure Wounds (level 1; Action; Touch; V, S; cast with: slot 1)".
const spellLine=s=>{if(!isObj(s))return s;const costs=Array.isArray(s.availableCosts)?s.availableCosts:[];const lvl=Number(s.level)||0;
 const how=lvl===0?null:'cast with: '+(costs.length?costs.map(x=>typeof x==='number'?'slot '+x:x==='species'?'species (free)':x).join(', '):'nothing left');
 return s.name+' ('+[lvl?'level '+lvl:'cantrip',s.castingTime==='Action'?null:s.castingTime,s.range,s.components?s.components+(s.material?': '+s.material:''):null,how].filter(Boolean).join('; ')+')';};
function compact(scene,body){
 const c=body.context??{},fight=fightingNow(scene),ruling=!!scene.pendingSpell&&!scene.engineResolved;
 if(isObj(scene.storyPreferences)){const {brutality,narrator}=scene.storyPreferences;scene.storyPreferences={...(brutality&&brutality!=='gritty'?{brutality}:{}),...(narrator&&narrator!=='chronicler'?{narrator}:{})};}
 const here=new Set((Array.isArray(c.npcSocialState)?c.npcSocialState:[]).filter(n=>n&&typeof n==='object'&&n.present!==false).map(n=>n.id));
 const nearIds=new Set((Array.isArray(scene.nearbyNPCs)?scene.nearbyNPCs:[]).map(n=>n?.id).filter(Boolean));
 // The story: its people's roles and ties are told with the people (nearbyNPCs, npcSocialState) and who they are with the
 // story, the same wherever the player is (what lasts the tale stays one cacheable part); the starting places are in
 // world.knownPlaces, the land in world.region, the opening in the journal (in full on the tale's first move); the ids
 // for the painter and the library go.
 if(isObj(scene.story)){
  const s={...scene.story};for(const k of ['id','libraryId','artId','introId'])delete s[k];if(s.status==='active')delete s.status;
  if(scene.world){delete s.locations;if(isObj(scene.world.region)){delete s.region;delete s.terrain;}}
  if(!scene.openingTurn||(Array.isArray(c.journal)&&c.journal.some(e=>sameStart(e?.text,s.opening))))delete s.opening;
  delete s.foeDamageType;
  if(isObj(s.npcs))s.npcs=Object.fromEntries(Object.entries(s.npcs).map(([id,n])=>{if(!isObj(n))return [id,n];const {role,ties,class:_c,...rest}=n;return [id,rest];}));
  scene.story=s;
 }
 // The hero: scores and species in a line; the spell list once (spellReference); the hit points with their maximum.
 if(isObj(scene.player)){
  const p={...scene.player};
  if(isObj(p.scores)){
   // Skills: only those better or worse than their ability (training, expertise, an item): the rest are the ability's modifier.
   if(Array.isArray(scene.skillChecks)&&scene.skillChecks.every(x=>typeof x==='string')){const mod=a=>Math.floor(((Number(p.scores[a])||10)-10)/2);const odd=[];let ok=true;
    for(const line of scene.skillChecks){const m=/^(.+?): (\w+) ([+-]\d+)(.*)$/.exec(line);if(!m||!(m[2] in abilityShort)){ok=false;break;}if(Number(m[3])!==mod(m[2])||m[4].trim())odd.push(m[1]+' '+m[3]+m[4]);}
    if(ok)scene.skillChecks=odd.join(', ');}
   p.scores=Object.entries(p.scores).map(([a,v])=>(abilityShort[a]??a)+' '+v).join(', ');
  }
  if(isObj(p.speciesTraits)){const t=p.speciesTraits;p.speciesTraits=[t.size,t.speed?'speed '+t.speed+' ft':null,t.darkvision?'darkvision '+t.darkvision+' ft':'no darkvision'].filter(Boolean).join(', ')+(Array.isArray(t.traits)&&t.traits.some(x=>!/\(applied by the game\)\s*$/.test(String(x)))?'. '+t.traits.filter(x=>!/\(applied by the game\)\s*$/.test(String(x))).map(x=>cut(String(x),70)).join(' '):'');}
  if(Array.isArray(scene.spellReference)&&scene.spellReference.length)delete p.spells;
  if(isObj(p.health)){const h={current:p.health.current};if(isObj(scene.turnStart)&&Number.isFinite(scene.turnStart.max))h.max=scene.turnStart.max;if(p.health.temp)h.temp=p.health.temp;p.health=h;}
  scene.player=p;
 }
 if(isObj(scene.turnStart)&&Number.isFinite(scene.player?.health?.max)&&(scene.turnStart.hp===scene.player.health.current||!scene.engineResolved))delete scene.turnStart;
 if(isObj(scene.equipment)&&Array.isArray(scene.equipment.items))scene.equipment=scene.equipment.items.map(i=>i?.name+(i?.quantity>1?' x'+i.quantity:'')).join(', ');
 if(isObj(scene.loadout)){const l=scene.loadout;scene.loadout=[l.armor?'wears '+l.armor:'no armor',l.shield?'a shield':null,l.focus?'focus: '+l.focus:null,l.ammunition?l.ammunition+' ammunition':null,scene.attackOptions?.mainWeapon?null:l.mainWeapon?'main weapon: '+l.mainWeapon:null].filter(Boolean).join('; ');}
 if(!(Array.isArray(scene.spellReference)&&scene.spellReference.length)){delete scene.spellSaveDC;delete scene.spellAttackBonus;}
 if(Array.isArray(scene.spellReference))scene.spellReference=scene.spellReference.map(spellLine);
 if(isObj(scene.attackOptions)){const a={...scene.attackOptions};
  if(Array.isArray(a.masteries))a.masteries=a.masteries.map(m=>typeof m==='string'?m.replace(/^([^:]+: [A-Za-z]+): .*$/,'$1'):m);
  {const dc=/DC (\d+)/.exec(String(a.grappleAndShove??''));if(dc){delete a.grappleAndShove;a.grappleDC=Number(dc[1]);}}
  if(typeof a.twoWeapons==='string'&&/^After an attack with a light weapon/.test(a.twoWeapons)){delete a.twoWeapons;if((a.carried??[]).some(w=>lightWeapon.test(String(w))))a.twoWeapons=true;}
  if(typeof a.hands==='string'){const h=a.hands;a.hands=/^The player has put the shield/.test(h)?'shield put away':/^The shield is slung/.test(h)?'shield slung':/^A shield on one arm/.test(h)?'shield on arm':/^No shield/.test(h)?'no shield':h;}
  if(a.unarmed==='Unarmed Strike')delete a.unarmed;
  scene.attackOptions=a;}
 if(isObj(scene.inventory)){const i={...scene.inventory};if(fight||JSON.stringify(i.priceList)===standardPrices)delete i.priceList;if(!i.arrows)delete i.arrows;scene.inventory=i;}
 // The land: the place the player stands in is world.current (with what its entry adds); every other known place a line.
 if(isObj(scene.world)){const w={...scene.world};
  if(Array.isArray(w.knownPlaces)){const at=w.knownPlaces.find(p=>isObj(p)&&p.id===w.current?.id);
   if(at&&isObj(w.current)){const {danger,feature,threat,cleared}=at;w.current={...w.current,...(danger&&danger!=='safe'?{danger}:{}),...(feature?{feature}:{}),...(threat?{threat:threat.name+' ('+threat.template+')'}:{}),...(cleared?{cleared:true}:{})};}
   const errandPlace=c.story?.errand?.place;const lands=new Set((Array.isArray(w.farLands)?w.farLands:[]).map(l=>isObj(l)&&l.road?l.name:null).filter(Boolean));w.knownPlaces=w.knownPlaces.filter(p=>!(at&&p===at)).map(p=>placeLine(p,isObj(p)&&(p.id===errandPlace||namedIn(body.input,p.name)),lands));}
  for(const k of ['placesLeft','landsRemembered','peopleMet'])delete w[k];
  // What the world cannot do now (no new place, person or ambush; nobody here) goes unsaid: absent is false or zero.
  for(const k of ['canDiscover','canIntroduce','canAmbush','peopleHere'])if(w[k]===false||w[k]===0)delete w[k];
  if(Array.isArray(w.regions)&&w.regions.every(n=>n===w.region?.name))delete w.regions;
  if(JSON.stringify(w.creatureTemplates)===standardCreatures)delete w.creatureTemplates;
  // Other lands: the nearest as lines (name, road, places known); world.regions then names only the rest.
  if(Array.isArray(w.farLands)){const named=new Set();
   w.farLands=w.farLands.map(l=>{if(!isObj(l)||Object.keys(l).some(k=>!['name','road','places','placesKnown'].includes(k)))return l;named.add(l.name);
    return l.name+': '+[l.road,Array.isArray(l.places)&&l.places.length?'places: '+l.places.join(', '):null,l.placesKnown?l.placesKnown+' places known':null].filter(Boolean).join('; ');});
   if(Array.isArray(w.regions)){const rest=w.regions.filter(n=>!named.has(n)&&n!==w.region?.name);if(rest.length)w.regions=rest;else delete w.regions;}}
  scene.world=w;}
 if(isObj(scene.map)&&scene.world){const {accepted,visited,...m}=scene.map;for(const k of ['clue','peaceful'])if(!m[k])delete m[k];if(!m.minutes)delete m.minutes;scene.map=m;}
 // The people: nobody away in a fight; ties in a line; what their attitude already says is not said again.
 if(Array.isArray(scene.npcSocialState)){
  if(fight)scene.npcSocialState=scene.npcSocialState.filter(n=>!isObj(n)||here.has(n.id));
  scene.npcSocialState=scene.npcSocialState.map(n=>{if(!isObj(n))return n;const o={...n};
   if(o.ties)o.ties=tiesLine(o.ties);
   if(standardResponses.has(o.response))delete o.response;
   if(Array.isArray(o.knows)&&isObj(n.ties)&&Array.isArray(n.ties.all)&&o.knows.every(k=>n.ties.all.some(t=>t?.id===k)))delete o.knows;
   if(o.metHero===true)delete o.metHero;
   if(!fight&&!ruling){delete o.maximumHP;delete o.ac;}else if(isObj(scene.npcDefenses)&&scene.npcDefenses[o.id])delete o.ac;
   return o;});
 }
 // The people here are told once, in nearbyNPCs: who they are and how they stand with the hero (npcSocialState then
 // holds only those not here, or down). Someone elsewhere is one line unless a grudge, a bond or a fate is to be told.
 if(Array.isArray(scene.nearbyNPCs)){const story=isObj(c.story?.npcs)?c.story.npcs:{};const social=new Map((Array.isArray(scene.npcSocialState)?scene.npcSocialState:[]).filter(isObj).map(n=>[n.id,n]));
  scene.nearbyNPCs=scene.nearbyNPCs.map(n=>{if(!isObj(n))return n;const {id:_i,name:_n,present:_p,role:_r,...more}=social.get(n.id)??{};const o={...n,appearance:cut(n.appearance,120),...more};if(isObj(o.trainedAs))o.trainedAs=o.trainedAs.class+' '+o.trainedAs.level;if(o.livesAt&&o.livesAt===scene.world?.current?.name)delete o.livesAt;const told=story[n.id];if(isObj(told)){if(o.voice===told.personality)delete o.voice;if(o.motive===told.motive)delete o.motive;if(o.species===told.species)delete o.species;}return o;});
  if(Array.isArray(scene.npcSocialState))scene.npcSocialState=scene.npcSocialState.filter(n=>!isObj(n)||!nearIds.has(n.id));}
 if(Array.isArray(scene.npcSocialState))scene.npcSocialState=scene.npcSocialState.map(n=>{if(!isObj(n)||here.has(n.id)||n.grudge||n.bond||n.forgiveness||n.forgave||n.fate||n.standing||n.trainedAs||(Array.isArray(n.memories)&&n.memories.length)||!n.name)return n;
  return n.name+' ['+n.id+']: '+[typeof n.role==='string'?cut(n.role.replace(/\.$/,''),n.metHero===false?45:70):null,n.livesAt?'lives at '+n.livesAt+(n.land?' ('+n.land+')':''):null,n.attitude,n.unnoticed?'unnoticed':null,n.metHero===false?'not met':null,n.ties&&n.metHero!==false?'ties: '+n.ties:null].filter(Boolean).join('; ');});
 if(Array.isArray(scene.conversationParticipants))scene.conversationParticipants=scene.conversationParticipants.map(n=>isObj(n)&&nearIds.has(n.id)?n.id:n);
 if(isObj(scene.npcHP)){const raw=new Map((Array.isArray(c.npcSocialState)?c.npcSocialState:[]).filter(isObj).map(n=>[n.id,n]));
  scene.npcHP=Object.fromEntries(Object.entries(scene.npcHP).filter(([id,hp])=>(here.has(id)||!!c.followers?.[id])&&(fight||ruling||!Number.isFinite(raw.get(id)?.maximumHP)||hp<raw.get(id).maximumHP)));}
 if(isObj(scene.npcDefenses))scene.npcDefenses=Object.fromEntries(Object.entries(scene.npcDefenses).filter(([id])=>here.has(id)).map(([id,d])=>[id,isObj(d)&&d.saveModifiers===0?{ac:d.ac}:d]));
 // The story so far: a fact that only repeats the premise, a journal entry as a line, an event the journal already holds.
 if(Array.isArray(scene.worldFacts)){const premise=c.story?.premise;scene.worldFacts=scene.worldFacts.filter(f=>!sameStart(f,premise));}
 const journalTexts=[];
 if(Array.isArray(scene.journal))scene.journal=scene.journal.map(e=>{if(!isObj(e))return e;journalTexts.push(e.text);return (e.title?e.title+': ':'')+e.text;});
 if(Array.isArray(scene.recentEvents)&&!scene.engineResolved)scene.recentEvents=scene.recentEvents.filter(t=>!journalTexts.some(j=>sameStart(t,j)));
 if(Array.isArray(scene.conversationHistory))scene.conversationHistory=scene.conversationHistory.map(e=>isObj(e)&&typeof e.text==='string'?e.text:e);
 // This turn: nothing spent and nothing earned is not said; the foe's hit points once.
 if(scene.earnedGold===0)delete scene.earnedGold;
 if(scene.enemyHP!==0&&(!fight||!scene.encounter||scene.encounter?.currentHP===scene.enemyHP))delete scene.enemyHP;
 if(isObj(scene.turnResources)){const t=scene.turnResources,o={};for(const [k,v] of Object.entries(t))if(v===true||(typeof v==='number'&&!(k==='attacksPerAction'&&v===1))||(typeof v==='string'&&v)||(isObj(v)))o[k]=v;scene.turnResources=fight||Object.keys(o).some(k=>k!=='left')?o:{};}
 if(isObj(scene.encounter)&&!ruling){const e={...scene.encounter};for(const k of ['attackBonus','bonus','count','die','saves','sleepless','wildCreature'])delete e[k];if(e.clearPath===true)delete e.clearPath;scene.encounter=e;}
 // Choices as lines ("[id] label"); a label that only repeats its id, and the ways beyond the map and the leads seen
 // through, are told once for all.
 if(Array.isArray(scene.choices)&&scene.choices.every(ch=>isObj(ch)&&typeof ch.id==='string')){
  const out=[],beyond=[],leads=[],travel=[],swings=[],people=new Map(),names=new Map((Array.isArray(scene.nearbyNPCs)?scene.nearbyNPCs:[]).filter(isObj).map(n=>[n.id,n.name]));
  for(const ch of scene.choices){const label=String(ch.label??'');
   // A blow, a grapple, a shove or a throw at a person here: one line per person, its ids and what each does.
   const blow=/^npc-(attack|grapple|shove|throw):([^:]+)(?::(.+))?$/.exec(ch.id);
   if(blow&&names.has(blow[2])){let g=people.get(blow[2]);if(!g){g={ids:[],verbs:[]};people.set(blow[2],g);out.push(g);}g.ids.push('['+ch.id+']');g.verbs.push(blow[1]==='attack'?'attack'+(blow[3]?' with '+blow[3]:''):blow[1]==='throw'?'throw '+(blow[3]??''):blow[1]);continue;}
   if(/^beyond-[NSEW]{1,2}$/.test(ch.id)){beyond.push(ch);continue;}
   if(/^lead-done:/.test(ch.id)){leads.push(ch);continue;}
   {const to=/^travel-/.test(ch.id)&&/^Travel to (.+)$/.exec(label);if(to){if(!travel.length)out.push(travel);travel.push('['+ch.id+'] '+to[1]);continue;}}
   // The weapons to swing at the creature fought: one line, each id naming its weapon.
   if(/^attack:/.test(ch.id)&&label==='Attack with '+ch.id.slice(7)){if(!swings.length)out.push(swings);swings.push('['+ch.id+']');continue;}
   out.push(label.toLowerCase()===ch.id.toLowerCase()||!label?'['+ch.id+']':'['+ch.id+'] '+label);}
  // Journeys: each place's own line in world.knownPlaces names it ("Name [p1]: …"), so a journey there is told by id.
  if(travel.length){const listed=new Set([...(Array.isArray(scene.world?.knownPlaces)?scene.world.knownPlaces:[]).map(l=>/^.*? \[([^\]]+)\]: /.exec(String(l))?.[1]),scene.world?.current?.id].filter(Boolean));
   const byId=travel.every(t=>listed.has(/^\[travel-([^\]]+)\]/.exec(t)?.[1]));
   out[out.indexOf(travel)]=byId?travel.map(t=>t.replace(/ .*$/,'')).join(' ')+': travel there.':travel.join('; ')+': travel there.';}
  if(swings.length)out[out.indexOf(swings)]=swings.join(' ')+': attack with that weapon.';
  // The blows at the people here: one line for everyone offered the same ones, ID standing for each id listed
  // ("[npc-attack:ID:Mace] [npc-grapple:ID], ID: mara, n1 or n2"; the standing prompt says how to read it).
  {const groups=new Map();for(const [id,g] of people){const key=g.ids.map(s=>s.replace('['+/^\[(npc-[a-z]+):/.exec(s)?.[1]+':'+id,m=>m.slice(0,m.lastIndexOf(':'))+':ID')).join(' ');let to=groups.get(key);if(!to){to={ids:[],at:g};groups.set(key,to);}else out[out.indexOf(g)]=null;to.ids.push(id);}
   for(const [key,to] of groups)out[out.indexOf(to.at)]=key+', ID: '+(to.ids.length>1?to.ids.slice(0,-1).join(', ')+' or '+to.ids.at(-1):to.ids[0]);
   for(let i=out.length-1;i>=0;i--)if(out[i]===null)out.splice(i,1);}
  if(beyond.length)out.push('[beyond-ID], ID: '+beyond.map(ch=>ch.id.slice(7)).join(', ').replace(/, ([^,]+)$/,' or $1')+': beyond the map that way (days on the road).');
  {const open=new Set((Array.isArray(scene.quest?.openLeads)?scene.quest.openLeads:[]).map(l=>'lead-done:'+l?.id));
   if(leads.length&&leads.every(ch=>open.has(ch.id)))out.push('[lead-done:ID], ID: '+leads.map(ch=>ch.id.slice(10)).join(', ').replace(/, ([^,]+)$/,' or $1')+': a lead (quest.openLeads) truly resolved in play.');
   else if(leads.length)out.push(leads.map(ch=>'['+ch.id+']'+(open.has(ch.id)?'':' '+(/\("[^"]*"\)/.exec(ch.label)?.[0]??ch.label))).join(' ')+': a lead (quest.openLeads) truly resolved in play.');}
  scene.choices=out;
  // context.now names the journeys on offer with their ids; the travel choices above say it already.
  if(travel.length&&Array.isArray(scene.now))scene.now=scene.now.map(l=>typeof l==='string'&&/^The player may set out at once for any of: /.test(l)?'The player may set out at once on any travel choice offered.':l);
 }
}
// Briefer still (2026-10-21, the host: "optimize efficiency even more, then do it again until we are at the lowest
// possible cost per turn"). The scene is paid in full every turn (the provider caches only the instructions and the
// schema), so what the moment does not need is left out of what the model reads (the checks on the reply still see the
// whole context): the tale's resolution until its last chapter, what a chapter reveals and the next chapter (the
// game's own "Chapter N complete" and "begins" lines tell both when it comes), the secret and the resolution in a fight
// with a creature of the wilds, the leads in any fight, the hero's backstory in a fight, a short look for people
// already seen, a person's view of the hero's kind in a line, the older talk and journal shorter, a chronicle that says
// no more than the quest, and the notes in brackets that only repeat what attackOptions or the standing prompt say.
// The game's own words for a view of the hero's kind with no reason of the person's own (relationshipRules.js regardReasons).
const standardRegard=/^(?:One of their own kind\.|Has always got on well with .+\.|Has met few .+ and is full of questions\.|Has heard hard things about .+ and keeps their guard up\.|Thinks little of .+ and does n.*)$/;
// Someone here as one line: "Name [id]: role; attitude; trained Ranger 1; species; looks: …; voice: …; wants: …;
// view of your kind: …; ties: …; memories: … | …" (and anything else they carry as "key: value"). Someone whose entry
// holds more than words (a grudge's forgiveness counted out, say) is left as it is.
const personLabels={role:'',trainedAs:'trained ',appearance:'looks: ',voice:'voice: ',motive:'wants: ',personality:'manner: ',regardsYourKind:'view of your kind: ',ties:'ties: ',hook:'hook: ',livesAt:'lives at ',grudge:'grudge: ',bond:'bond: ',fate:'fate: ',standing:'',attitude:'',species:'',response:'',memories:'memories: '};
function personLine(o){
 if(!isObj(o)||typeof o.name!=='string'||typeof o.id!=='string')return o;
 for(const [k,v] of Object.entries(o))if(!(v==null||typeof v==='string'||typeof v==='number'||typeof v==='boolean'||(Array.isArray(v)&&v.every(x=>typeof x==='string'))))return o;
 const order=['role','attitude','standing','trainedAs','species','appearance','voice','motive','personality','regardsYourKind','ties','hook','livesAt','grudge','bond','fate','response','memories'];
 const bits=[];for(const k of [...order,...Object.keys(o).filter(k=>!order.includes(k)&&!['id','name'].includes(k))]){const v=o[k];if(v==null||v===''||v===false||(Array.isArray(v)&&!v.length)||!(k in o))continue;
  const text=Array.isArray(v)?v.join(' | '):v===true?'':String(v).replace(/\.$/,'');bits.push(k in personLabels?personLabels[k]+text:k+(text?': '+text:''));}
 return o.name+' ['+o.id+']: '+bits.join('; ');
}
// The game's own first memory of a view of the hero's kind (relationshipRules.js regardMemory).
const standardRegardMemory=/^(?:One of my own kind came by: .+\.|An? [^.]+\. (?:I have always got on well with .+\.|I have met few .+, and I have questions\.|I have heard hard things about .+, and I am keeping my guard up\.|I think little of .+\.))$/;
const taleHeading=l=>typeof l==='string'&&(/^Tale \d+ of \d+: .*\(under way, begun at [^)]*\)\.$/.test(l)||/^Chapter \d+(?:, [^(]*)? \(now\):$/.test(l));
const briefLimits={journal:4,journalText:300,journalInFight:1,journalTextInFight:200,talkInFull:2,olderTalk:200,chapterInFight:300,placeInFight:160,seenLook:50,role:80,voice:80,motive:80,hook:110,premise:400,foeLook:80,description:200,backstory:300,roleAway:70,featureMiles:5};
// The chapter's truth cut as the game cuts it (dmSceneRules.js truthText): 200 characters, at a sentence where one ends.
const truthOf=t=>{t=String(t??'').replace(/\s+/g,' ').trim();if(t.length<=200)return t;const head=t.slice(0,200),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));return end>=80?head.slice(0,end+1):cut(t,200);};
function briefer(scene,body){
 const c=body.context??{},fight=fightingNow(scene),wild=fight&&!!c.encounter?.wildCreature;
 if(isObj(scene.story)){const s={...scene.story},q=c.quest;
  // The resolution is a condition for story-complete, offered only in the last chapter (or a tale without chapters).
  if(isObj(q)&&q.chapter&&!q.finalChapter)delete s.resolution;
  if(wild){delete s.secret;delete s.resolution;delete s.npcs;}
  // The errand stays while the hero fights at the errand's own place (the stories spec, Phase A5: the first set piece
  // belongs to the tale).
  const atErrand=isObj(s.errand)&&typeof s.errand.place==='string'&&c.world?.current?.id===s.errand.place;
  if(fight){if(!atErrand)delete s.errand;delete s.resolution;
   // The foe fought is described in encounter.appearance; the story's people only while one of them is here or follows.
   if(typeof c.encounter?.appearance==='string'&&c.encounter.appearance)delete s.foeAppearance;
   const near=new Set([...(Array.isArray(c.npcSocialState)?c.npcSocialState:[]).filter(n=>isObj(n)&&n.present!==false).map(n=>n.id),...Object.keys(isObj(c.followers)?c.followers:{})]);
   if(isObj(s.npcs)&&!Object.keys(s.npcs).some(id=>near.has(id)))delete s.npcs;}
  s.premise=typeof s.premise==='string'&&s.premise.length>briefLimits.premise?tellingCut(s.premise,briefLimits.premise):s.premise;
  if(!fight&&scene.stage!=='bridge')s.foeAppearance=cut(s.foeAppearance,briefLimits.foeLook);
  // The errand is the first chapter: its title and task are the quest's goal while it lasts, and done after it, but for
  // a reward still owed (rewardDue: the game closed chapter 1 at the cleared place; keeper pays when next spoken with).
  if(isObj(s.errand)&&isObj(q)&&q.chapter){if(q.chapter>1){if(s.errand.rewardDue===true&&s.errand.reward)s.errand={reward:s.errand.reward,rewardDue:true};else delete s.errand;}else{const {title:_t,task,...e}=s.errand;s.errand={...(q.goal&&sameStart(task,q.goal,30)?{}:{task}),...e};}}
  scene.story=s;}
 // The chapter's truth and the next chapter's title (the stories spec, Phase A1, 2026-10-22: a chapter's answer hidden
 // from the Dungeon Master while it was asked to steer toward it meant no chapter ever closed): out of a fight the truth
 // (at most 200 characters, quest.truth; worked out from revealedWhenAchieved for a device that sends only that) and the
 // next chapter by its title; in a fight neither. In the telling of a chapter closed ("Chapter N complete: <its truth>")
 // the quest is already the next chapter: its truth is not read there (the project review, 2026-10-22: the next
 // chapter's truth sat beside "carry on to where the next chapter points").
 if(isObj(scene.quest)){const q={...scene.quest},closed=(Array.isArray(c.engineResolved)?c.engineResolved:[]).some(t=>/^Chapter \d+ complete: /.test(String(t)));
  if(fight||closed){delete q.truth;delete q.next;}
  else{if(typeof q.truth!=='string'&&typeof q.revealedWhenAchieved==='string')q.truth=truthOf(q.revealedWhenAchieved);if(isObj(q.next))q.next=typeof q.next.title==='string'?q.next.title:null;}
  delete q.revealedWhenAchieved;delete q.leadsSeenThrough;if(q.finalChapter===false)delete q.finalChapter;
  if(fight)delete q.openLeads;else if(Array.isArray(q.openLeads))q.openLeads=q.openLeads.map(l=>isObj(l)?{...l,hook:cut(l.hook,briefLimits.hook)}:l);
  scene.quest=q;}
 if(isObj(scene.player)){const p={...scene.player};
  if(fight){delete p.backstory;delete p.background;}else p.backstory=cut(p.backstory,briefLimits.backstory);
  if(p.description)delete p.age;
  if(fight&&Array.isArray(scene.party))scene.party=scene.party.map(h=>isObj(h)?{...h,appearance:cut(h.appearance,briefLimits.seenLook)}:h);
  p.description=cut(p.description,briefLimits.description);
  scene.player=p;}
 // People here: someone already seen (named in the talk or the journal, or with memories of the hero) is told by a
 // short look; their view of the hero's kind is a line.
 if(Array.isArray(scene.nearbyNPCs)){const told=[...(c.conversationHistory??[]).map(e=>isObj(e)?e.text:e),...(c.journal??[]).map(e=>isObj(e)?e.text:e)].filter(t=>typeof t==='string').join('\n');
  scene.nearbyNPCs=scene.nearbyNPCs.map(n=>{if(!isObj(n))return n;const o={...n};
   if(typeof o.name==='string'&&(told.includes(o.name)||(Array.isArray(o.memories)&&o.memories.length)))o.appearance=cut(o.appearance,briefLimits.seenLook);
   o.role=cut(o.role,briefLimits.role);
   // A first memory in the game's own words for that view of the hero's kind says what the view says.
   if(o.regardsYourKind&&Array.isArray(o.memories))o.memories=o.memories.filter(m=>!standardRegardMemory.test(String(m)));
   if(isObj(o.regardsYourKind)&&o.regardsYourKind.stance){const {stance,reason}=o.regardsYourKind;o.regardsYourKind=stance+(reason&&!standardRegard.test(reason)?': '+reason:'');}
   o.voice=cut(o.voice,briefLimits.voice);o.motive=cut(o.motive,briefLimits.motive);
   return personLine(o);});}
 // The person spoken with is one of the people here: their id says who (and oneOnOne only when it holds).
 if(isObj(scene.conversationWith)&&(scene.nearbyNPCs??[]).some(n=>typeof n==='string'?n.includes(' ['+scene.conversationWith.id+']: '):n?.id===scene.conversationWith.id)){const {id,oneOnOne}=scene.conversationWith;scene.conversationWith={id,...(oneOnOne?{oneOnOne:true}:{})};}
 // Out of a fight: weapon masteries (they matter only for a blow) and short rests when none is offered go unsaid.
 if(!fight&&isObj(scene.attackOptions)){const {masteries:_m,...a}=scene.attackOptions;scene.attackOptions=a;}
 if(!fight&&Array.isArray(scene.choices)&&!scene.choices.some(l=>typeof l==='string'&&l.startsWith('[short-rest]')))delete scene.shortRests;
 // A telling: what the engine resolved this turn is in engineResolved; the journal entry and the recent events that
 // repeat it are not read again.
 if(Array.isArray(scene.engineResolved)&&scene.engineResolved.length){const said=scene.engineResolved.filter(l=>typeof l==='string'&&l.length>=24).map(l=>l.slice(0,40));const repeats=t=>typeof t==='string'&&said.some(x=>t.includes(x));
  if(Array.isArray(scene.recentEvents)){const lines=new Set(scene.engineResolved);scene.recentEvents=scene.recentEvents.filter(t=>!lines.has(t)&&!repeats(t));}
  if(Array.isArray(scene.journal))scene.journal=scene.journal.filter(t=>!repeats(t));}
 if(Array.isArray(scene.now))scene.now=scene.now.map(l=>l==='No fight is in progress here: nothing is attacking the player, who is free to act, talk, rest where it is offered and travel.'?'No fight here: nothing attacks the player, who is free to act, talk, rest where offered and travel.':l==='The player may set out at once on any travel choice offered.'?'Any travel choice offered may be taken at once.':typeof l==='string'?l.replace(/^(.+) is not at (.+) and is not attacking the player\.$/,'$1 is not here and not attacking.'):l);
 // The story so far: the journal's latest entries, shorter; the talk's older exchanges shorter; a chronicle that
 // holds only the tale's and the chapter's headings says no more than the quest.
 if(scene.openingTurn&&isObj(scene.introduction)&&Array.isArray(scene.journal)&&scene.journal.length<=1)delete scene.journal;
 // The tale's opening entry goes on to its goal, chapter, orders and introduction: the story, the quest and the errand
 // say those, so it is read up to them.
 if(Array.isArray(scene.journal))scene.journal=scene.journal.map(t=>typeof t==='string'&&/\nGoal: /.test(t)?t.slice(0,t.indexOf('\nGoal: ')):t);
 if(Array.isArray(scene.journal))scene.journal=scene.journal.slice(-(fight?briefLimits.journalInFight:briefLimits.journal)).map(t=>cut(t,fight?briefLimits.journalTextInFight:briefLimits.journalText));
 if(fight&&Array.isArray(scene.conversationHistory))scene.conversationHistory=scene.conversationHistory.slice(-briefLimits.talkInFull);
 if(fight&&isObj(scene.memory)&&Array.isArray(scene.memory.taleNow))scene.memory={...scene.memory,taleNow:scene.memory.taleNow.map(l=>cut(l,briefLimits.chapterInFight))};
 if(fight&&isObj(scene.world?.current))scene.world={...scene.world,current:{...scene.world.current,description:cut(scene.world.current.description,briefLimits.placeInFight)}};
 if(Array.isArray(scene.conversationHistory)){const h=scene.conversationHistory,keep=h.length-briefLimits.talkInFull;scene.conversationHistory=h.map((t,i)=>i<keep?cut(t,briefLimits.olderTalk):t);}
 if(isObj(scene.memory)&&Array.isArray(scene.memory.taleNow)){const t=scene.memory.taleNow.filter(l=>!/^Tale \d+ of \d+: .*\(under way, begun at [^)]*\)\.$/.test(l));scene.memory={...scene.memory,taleNow:t};if(!t.length)delete scene.memory.taleNow;}
 if(isObj(scene.memory)&&Object.keys(scene.memory).every(k=>k==='taleNow')&&(scene.memory.taleNow??[]).every(taleHeading))delete scene.memory;
 // Choices: a note that only repeats attackOptions (the grapple's DC) or the standing prompt (when a chapter may close).
 if(Array.isArray(scene.choices))scene.choices=scene.choices.map(l=>typeof l==='string'&&(/^\[end-turn\] End your turn without acting$/.test(l)||/^\[throw:([^\]]+)\] Throw \1$/.test(l))?l.replace(/\] .*$/,']'):l).map(l=>typeof l!=='string'?l:/^\[(?:grapple|shove)(?::[^\]]*)?\] /.test(l)?l.replace(/ \(an Unarmed Strike: [^)]*\)$/,''):/^\[story-advance\] /.test(l)?'[story-advance] the chapter\'s truth found where its goal points, told in this reply (never before the player pursues it)':l);
 if(isObj(scene.encounter)&&isObj(scene.encounter.signatureMove)){const m=scene.encounter.signatureMove;scene.encounter={...scene.encounter,signatureMove:m.name+(m.text?': '+m.text:'')};}
}
// A telling (round 3 of leaner turns, 2026-10-21, the host: "the lowest possible cost per turn"): a resolved turn or a
// scene cue chooses, checks, discovers and recruits nothing, so what only an ordinary turn can use is left out of what
// the model reads. What lasts the tale (sceneParts' first part: the story, the hero, their skills and spells, the quest)
// is never touched, and in a fight nothing but this turn's part is, so a telling still shares those parts with the turn
// before it. Out of a fight: the attack figures, the map beyond where the hero stands (a place the engine's lines or the
// player's words name is kept), people elsewhere, offers to join, the older story so far (the tale's first line, the
// chapter under way and the facts bearing on who is here stay), the journal beyond its last two entries; a cue also the
// pack and the spoils. Always: journeys on offer, and a cue's own words (the turn's note says them). The people here,
// the place, the story, the talk and what the engine resolved stay. Every check on the reply still reads the whole
// context.
const tellingLimits={journal:2,taleLines:2};
function tellingOnly(scene,body){
 const c=body.context??{},cue=!!c.sceneTrigger,fight=fightingNow(scene);
 for(const k of ['shortRests','recruitmentTargets','sceneTrigger','speakFirst','levelReady','castingIssue','choices'])delete scene[k];
 if(Array.isArray(scene.now))scene.now=scene.now.filter(l=>typeof l!=='string'||!/^(?:The player may set out at once|Any travel choice offered may be taken)/.test(l));
 if(fight)return;
 for(const k of ['attackOptions','joinOffers','peopleElsewhere'])delete scene[k];
 if(cue){delete scene.inventory;delete scene.spoils;}
 const said=[body.input,...(Array.isArray(c.engineResolved)?c.engineResolved:[])].map(t=>String(t??'')).join(' ').toLowerCase();
 if(isObj(scene.world)){const w={...scene.world};
  for(const k of ['morePlaces','morePlacesNotListed','farLands','regions','landsRemembered','placesLeft','canDiscover','canAmbush','creatureTemplates','beyond'])delete w[k];
  if(Array.isArray(w.knownPlaces))w.knownPlaces=w.knownPlaces.filter(p=>{const name=(typeof p==='string'?p.split(' [')[0]:p?.name)??'';return name.length>=3&&said.includes(name.toLowerCase());});
  scene.world=w;}
 if(Array.isArray(scene.journal))scene.journal=scene.journal.slice(-tellingLimits.journal);
 if(isObj(scene.memory)){const m=scene.memory,tale=Array.isArray(m.taleNow)?m.taleNow:[];scene.memory={...(tale.length?{taleNow:tale.length>tellingLimits.taleLines+1?[tale[0],...tale.slice(-tellingLimits.taleLines)]:tale}:{}),...(m.facts?{facts:m.facts}:{}),...(m.about?{about:m.about}:{})};}
}
// Empty parts (null, '', [] and {}) are left out of what the model reads: an absent field means the same to it.
const lean=v=>{if(Array.isArray(v))return v.map(lean);if(!v||typeof v!=='object')return v;const out={};for(const [k,x] of Object.entries(v)){const y=lean(x);if(y===null||y===undefined||y===''||(Array.isArray(y)&&!y.length)||(typeof y==='object'&&!Array.isArray(y)&&!Object.keys(y).length))continue;out[k]=y;}return out;};
// The cache order (the host, 2026-10-17: "put everything that never changes first and the turn-by-turn details
// last"). The provider caches a request part by part (see standingPrompt), so the scene is sent in parts, each a
// message, from what lasts the whole tale to what changes every turn: a part that changes makes every part after it
// new, and the parts before it stay cached. sceneParts names each part's fields in order (measured with
// verify-dm-cache.cjs: which fields change from turn to turn); anything not named goes at the start of the last part,
// this turn, which ends with the present in plain sentences (`now`) and holds the player's own words. Within the hero,
// the hit points are told with this turn (sceneMessages); within the world, the creature kinds come first.
const sceneParts=[
 {name:'what lasts the tale',keys:['storyPreferences','campaign','story','player','skillChecks','equipment','loadout','spellSaveDC','spellAttackBonus','spellReference','quest']},
 {name:'the land and what the hero carries',keys:['world','map','peopleElsewhere','followers','npcFates','foeFate','attackOptions','inventory']},
 {name:'who is here',keys:['party','nearbyNPCs','npcSocialState','joinOffers']},
 {name:'the story so far',keys:['worldFacts','journal','memory']}];
const sceneFirst=sceneParts.flatMap(p=>p.keys);
const sceneLast=['introduction','openingTurn','levelReady','spoils','heroSpellEffects','castingConditions','stage','shortRests','choices','conversationParticipants','conversationWith','recruitmentTargets','turnOrder','encounter','encounterInitiative','enemyHP','npcCombat','npcDefenses','npcHP','fightConditions','turnResources','turnStart','concentration','spellSlotsUsed','pendingSpell','castingIssue','dying','death','resolvedActionEvents','recentEvents','conversationHistory','engineResolved','sceneTrigger','outOfCharacter','rulesReference','now'];
function inCacheOrder(scene){
 const out={},last=new Set(sceneLast),first=new Set(sceneFirst);
 for(const k of sceneFirst)if(k in scene)out[k]=scene[k];
 for(const k of Object.keys(scene))if(!first.has(k)&&!last.has(k))out[k]=scene[k];
 for(const k of sceneLast)if(k in scene)out[k]=scene[k];
 // Inside the hero, the hit points (which change in a fight) come last; inside the world, the creature kinds first.
 if(out.player&&typeof out.player==='object'&&'health' in out.player){const {health,...rest}=out.player;out.player={...rest,health};}
 if(out.world&&typeof out.world==='object'&&'creatureTemplates' in out.world){const {creatureTemplates,...rest}=out.world;out.world={creatureTemplates,...rest};}
 return out;
}
// The scene as the model reads it: one user message per part of sceneParts that has anything in it, then this turn's
// part with the player's words. The hero's hit points go with this turn, the rest of the hero with what lasts the tale.
function sceneMessages(body,options){
 const {context,input}=sceneFor(body,options),parts=[],taken=new Set();
 for(const part of sceneParts){
  const fields={};for(const k of part.keys)if(k in context){fields[k]=context[k];taken.add(k);}
  if(fields.player&&typeof fields.player==='object'&&'health' in fields.player){const {health,...rest}=fields.player;fields.player=rest;}
  if(Object.keys(fields).length)parts.push({role:'user',content:'Scene: '+part.name+'.\n'+JSON.stringify({context:fields})});
 }
 const now={};
 if(context.player&&typeof context.player==='object'&&'health' in context.player)now.player={health:context.player.health};
 for(const k of Object.keys(context))if(!taken.has(k))now[k]=context[k];
 parts.push({role:'user',content:'Scene: this turn, and the player\'s message.\n'+JSON.stringify({context:now,input})});
 return parts;
}
// The whole request a turn sends (see standingPrompt): the standing instructions, then as input this hero's features,
// the scene in parts and this turn's note (`tail`: the phase, a retry's or second look's note, the narrator's voice).
function turnRequest(body,options,tail){
 return {instructions:standingPrompt,input:[{role:'developer',content:heroPrompt(body)},...sceneMessages(body,options),...(tail.trim()?[{role:'developer',content:tail.trim()}]:[])]};
}
// What a turn request asked, read back (for the checks): the instructions with every developer note, the scene put
// together again, the player's words and this turn's note.
function requestParts(q){
 if(typeof q?.input==='string'){let json={};try{json=JSON.parse(q.input);}catch{}return {instructions:String(q.instructions??''),scene:json.context??{},input:json.input,tail:'',hero:''};}
 const items=(Array.isArray(q?.input)?q.input:[]).map(m=>({...m,content:messageText(m?.content)})),notes=items.filter(m=>m?.role==='developer').map(m=>String(m.content)),scene={};let input;
 for(const m of items.filter(m=>m?.role==='user')){const text=String(m.content),json=JSON.parse(text.slice(text.indexOf('\n')+1));
  for(const [k,v] of Object.entries(json.context??{}))scene[k]=k in scene&&v&&typeof v==='object'&&!Array.isArray(v)?{...scene[k],...v}:v;if('input' in json)input=json.input;}
 const tail=items.length&&items.at(-1)?.role==='developer'&&items.length>1?String(items.at(-1).content):'';
 return {instructions:[String(q?.instructions??''),...notes].join('\n'),scene,input,tail,hero:notes[0]??''};
}
// A message's words, sent as a string or as content blocks (a cache breakpoint sits on a block: cacheHoldFor).
const messageText=c=>typeof c==='string'?c:Array.isArray(c)?c.map(b=>typeof b?.text==='string'?b.text:'').join(''):String(c??'');
// The scene and the player's words of a turn request, as one object ({context, input}), the way it used to be sent.
const requestScene=q=>{if(typeof q?.input==='string')return JSON.parse(q.input);const p=requestParts(q);return {context:p.scene,input:p.input};};
// One OpenAI safety identifier per player, for their turns and for tales written ahead at their cost.
const safetyFor=guest=>guest?{safety_identifier:guest.startsWith('account-')?'qb-acct-'+guest.slice(8,40):'qb-guest-'+guest.slice(0,32)}:null;

function validRequest(body){return body&&typeof body.input==='string'&&body.input.trim().length>0&&body.input.length<=1000&&body.context&&Array.isArray(body.context.choices)&&body.context.choices.length<=30&&body.context.choices.every(c=>typeof c.id==='string'&&c.id.length<=100&&typeof c.label==='string'&&c.label.length<=150);}
// A streamed reply: the narration written so far is passed on as it arrives (the JSON follows the schema's order, so
// narration comes first). Returns the full text once the response completes.
function partialNarration(text){
 const m=/"narration"\s*:\s*"/.exec(text);if(!m)return '';
 let out='',i=m.index+m[0].length;
 while(i<text.length){const c=text[i];if(c==='"')break;if(c==='\\'){const e=text[i+1];if(e===undefined)break;if(e==='u'){if(i+6>text.length)break;out+=String.fromCharCode(parseInt(text.slice(i+2,i+6),16));i+=6;continue;}out+={n:'\n',t:' ',r:'',b:'',f:''}[e]??e;i+=2;continue;}out+=c;i++;}
 return out;
}
async function streamedText(response,onNarration,onUsage=null,onCompleted=null){
 const decoder=new TextDecoder();let buffer='',text='',completed=null,shown='',last=0;
 for await(const chunk of response.body){
  buffer+=decoder.decode(chunk,{stream:true});
  let cut;while((cut=buffer.indexOf('\n\n'))>=0){
   const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);
   const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('');if(!data||data==='[DONE]')continue;
   let event;try{event=JSON.parse(data);}catch{continue;}
   if(event.type==='response.output_text.delta'&&typeof event.delta==='string'){text+=event.delta;const part=partialNarration(text),now=Date.now(),closed=/"narration"\s*:\s*"(?:[^"\\]|\\.)*"/.test(text);if(part!==shown&&(closed||now-last>150||part.length-shown.length>60)){shown=part;last=now;try{onNarration(part);}catch{}}}
   else if(event.type==='response.completed')completed=event.response;
   else if(['response.failed','response.incomplete','error'].includes(event.type)){
    // Cut short or failed: its cost is still counted, and what was written is kept on the error for the last resort.
    const cut=event.response??null;if(cut&&onUsage)try{onUsage(cut.usage);}catch{}if(cut&&onCompleted)try{onCompleted(cut);}catch{}
    throw Object.assign(Error('The AI reply was incomplete. No game action was applied.'),{partial:text,incomplete:cut?.incomplete_details?.reason??String(event.type).replace(/^response\./,'')});
   }
  }
 }
 if(completed&&onUsage)try{onUsage(completed.usage);}catch{}
 if(completed&&onCompleted)try{onCompleted(completed);}catch{}
 if(!completed||completed.status!=='completed')throw Object.assign(Error('The AI reply was incomplete. No game action was applied.'),{partial:text,incomplete:completed?.incomplete_details?.reason??(completed?String(completed.status):'cut off')});
 return outputText(completed)||text;
}
// The models the host chose (the launcher's -Models writes .questbound-model and .questbound-story-model) are read on
// every live request, so a change takes effect at once: no restart, no key. The play model answers turns; the story
// writer writes adventures and heroes and follows the play model unless it was set apart. Tests with a stand-in
// provider never read the files.
function chosenModel(file){try{const id=require('node:fs').readFileSync(require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,file),'utf8').replace(/^\uFEFF/,'').trim();return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/.test(id)?id:null;}catch{return null;}}
// How hard the story writer thinks about a new tale: the host's choice in .questbound-story-effort (none, minimal,
// low, medium, high or xhigh; read on every live request, like the models), else what the service was started with.
function storyEffort(fallback,read=chosenModel){const chosen=read('.questbound-story-effort');return ['none','minimal','low','medium','high','xhigh'].includes(chosen)?chosen:fallback;}
// How hard the play model thinks about an ordinary turn: the host's choice in .questbound-dm-effort (read on every
// live request), else what the service was started with (none by default: quick replies).
function turnEffort(fallback,read=chosenModel){const chosen=read('.questbound-dm-effort');return ['none','minimal','low','medium','high'].includes(chosen)?chosen:fallback;}
// Stories in the making are kept in a module of their own, which stays loaded while this file is reloaded.
// The day's spending and the host's ceilings on it (spending.cjs) also stay loaded between requests.
function loadSpending(){if(require('./spending.cjs').revision!==6)delete require.cache[require.resolve('./spending.cjs')];return require('./spending.cjs').spending;}
// A guest's label: the phone gateway (phone-server.cjs) adds it to every request from a paired browser, replacing
// anything the browser sent. The host's own browser on this PC has none.
// A paired browser's label is a hex hash; an account player's table turn comes from the account service as account-<id>.
const modes=new Set(['art','adventure','character','diagnostics','moderate','people-batch']);
// The host's own library jobs (make-people-library.cjs, make-creature-library.cjs, the place-art painter): their usage lines are tagged so the
// spending ceilings leave them out (spending.cjs: the host funds them). Every painting line carries job (null when
// it is not one), so a line from before the tag can be told apart.
const hostJobOf=(subject,guest)=>guest||typeof subject?.campaignId!=='string'?null:subject.campaignId.startsWith('questbound-people-library')?'people-library':subject.campaignId.startsWith('questbound-place-library')?'place-library':subject.campaignId.startsWith('questbound-creature-library')?'creature-library':null;
// A creature painted because the host's creature library had nothing like it (world-art.cjs onUnmatched) is noted in
// the diagnostics, mechanical only (the creature's name as the tale gave it, template, land, kind, the closest picture
// and its score), so the host can see what the library is missing (dm-report.cjs lists them). Live runs only.
function recordCreatureMiss(note,live,guest){
 if(!live||!note||typeof note!=='object')return;
 try{const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...(guest?{guest}:{}),art:'creature-unmatched',name:String(note.name??'').slice(0,60),...(note.template?{template:String(note.template).slice(0,20)}:{}),...(note.terrain?{terrain:String(note.terrain).slice(0,20)}:{}),...(note.creatureKind?{creatureKind:String(note.creatureKind).slice(0,60)}:{}),closest:note.closest&&typeof note.closest.id==='string'?{id:note.closest.id.slice(0,60),score:Number(note.closest.score)||0}:null})+'\n');}catch{}
}
const guestOf=body=>typeof body?.guest==='string'&&/^(?:account-)?[a-f0-9]{16,64}$/.test(body.guest)?body.guest:null;
// Ready journeys (tale-library.cjs) also stay loaded between requests: a shared library of finished tales that players
// compare and choose between, each written once at the effort the host chose and played by many (each player their own
// copy). It is topped up one journey at a time when the Dungeon Master starts and on any live turn, by the host's own
// writer (no guest label), and only while background writing may spend: spending.cjs `background()` (the host's
// ceilings and the guests' pause switch) when the module has it; without it, writing is paced by the library alone.
// Tests pass a stand-in `library`.
function loadLibrary(){if(require('./tale-library.cjs').revision!==5)delete require.cache[require.resolve('./tale-library.cjs')];return require('./tale-library.cjs').library;}
function backgroundAllowed(spend){try{return !spend||typeof spend.background!=='function'||spend.background().ok!==false;}catch{return false;}}
// A journey is offered only when the game's own rules accept it: the tale seats a hero (a ready-made Fighter) and the
// adventure that results is valid, with its introduction, its errand (every journey starts with orders in hand) and
// at least two chapters.
function journeyCheck(story){
 try{
  const r=require('./rules-engine.cjs').storyChecks(),hero=r.readyHero('fighter');
  const game=r.freshStoryGame(hero,JSON.parse(JSON.stringify({...story,id:'journey-check',status:'active'})),r.newAdventure(hero));
  return !!game.story.errand&&!!game.story.introduction&&(game.story.chapters?.length??0)>=2&&r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero);
 }catch{return false;}
}
// The host's pause for the journey library (2026-10-22; the stories spec, Phase 0): while the file
// .questbound-library-paused exists (any content; Questbound.cmd -PauseLibrary makes it, -ResumeLibrary removes it) no
// new journey is written, read live on every top-up and again before each write, so a fill under way stops at the next
// journey. Journeys already written are still listed and started. QUESTBOUND_LIBRARY=off only skips the start-up fill.
function libraryPaused(){try{return require('node:fs').existsSync(require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-library-paused'));}catch{return false;}}
function topUpLibrary(library,{apiKey,storyModel,effort,fetchImpl,live=true,spend=null}){
 if(!library||!apiKey||!storyModel||libraryPaused())return false;
 const ceilings=spend??(live?loadSpending():null);
 if(!backgroundAllowed(ceilings))return false;
 const write=async brief=>{
  if(libraryPaused())throw Object.assign(Error('The host paused the journey library.'),{kind:'paused'});
  if(!backgroundAllowed(ceilings))throw Object.assign(Error('Spending ceiling reached.'),{kind:'ceiling'});
  delete require.cache[require.resolve('./adventure-generator.cjs')];
  const cast=live?await castFor(loadPeople()):null;
  return require('./adventure-generator.cjs').generateAdventure({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'easy',ahead:true,libraryBrief:brief,choices:[],variation:Date.now()+'-'+Math.random()}},{apiKey,model:storyModel,reasoning:effort,timeout:420000,fetchImpl,safety:null,cast,onUsage:u=>recordUsage('adventure-ahead',storyModel,u,live,null)});
 };
 // A pause is the host's choice, not a failure: it is not noted in the diagnostics.
 return library.topUp(write,{accept:journeyCheck,onFailure:e=>{if(e?.kind!=='paused')recordWriteFailure('library',e,live);}});
}
// The journeys on offer, as a device sees them. A cover is offered only when its picture costs nothing more: already
// painted (the journey's opening place, under the journey's art id) or, once world-art.cjs can answer a place from
// ready-made paintings, whatever its `readyMade(subject)` says. A device never asks for a cover that would be painted.
function journeyCovers(){
 if(require('./world-art.cjs').revision!==12)delete require.cache[require.resolve('./world-art.cjs')];
 const fs=require('node:fs'),path=require('node:path'),art=require('./world-art.cjs'),dir=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-art');
 return subject=>{try{if(typeof art.artStore?.readyMade==='function'&&art.artStore.readyMade(subject))return true;return fs.existsSync(path.join(dir,art.artKey(art.validateSubject(subject))+'.jpg'));}catch{return false;}};
}
// When the Dungeon Master starts, the library tops itself up (the host's writer, one journey at a time).
function startLibrary({apiKey,model,storyModel=model,storyReasoning='medium',library=null,fetchImpl=fetch}){
 if(!apiKey||!model)return false;
 const live=fetchImpl===fetch;if(live)({storyModel}=liveModels(model,storyModel));
 return topUpLibrary(library??loadLibrary(),{apiKey,storyModel,effort:live?storyEffort(storyReasoning):storyReasoning,fetchImpl,live});
}
// OpenAI's moderation check on what players type (moderation.cjs) stays loaded too: its cache, each player's count of
// held-back messages and any pause. Tests pass a stand-in `moderation`; runs against a fake provider skip it.
// The host's library of ready-made people (people-library.cjs) stays loaded too (its list is read again within 30 s
// of changing); world-art.cjs loads it afresh when it loads, so a change there raises both revisions together.
function loadPeople(){if(require('./people-library.cjs').revision!==3)delete require.cache[require.resolve('./people-library.cjs')];return require('./people-library.cjs');}
// The people to offer the Dungeon Master where the hero is (context.world.peopleToMeet): a few suited to the kind of
// place and its land, never one already met in this game (context.world.poolTaken), the same few at a place until one
// of them is met (poolTaken holds their numbers: 42 for np042). Returns the offered library entries by id; none when the library is empty or cannot be read.
async function peopleToMeetFor(context,lib,alsoTaken=new Set()){
 if(!lib?.people||!context?.world||typeof context.world!=='object')return new Map();
 try{
  const w=context.world,taken=new Set([...(Array.isArray(w.poolTaken)?w.poolTaken:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=999).map(n=>'np'+String(n).padStart(3,'0')),...(alsoTaken instanceof Set?alsoTaken:[])]);
  const kind=lib.placeKinds.includes(w.current?.kind)?w.current.kind:null,terrain=lib.terrains.includes(w.region?.terrain)?w.region.terrain:null;
  const found=await lib.people.suited({kind,terrain,taken,seed:String(context.story?.id??'')+':'+String(w.current?.id??''),count:4});
  return new Map(found.map(e=>[e.id,e]));
 }catch{return new Map();}
}
// The faces the painter has already given people of this tale as look-alikes (people-library.cjs lookAlike, kept per
// tale and per ready journey): those library people are not offered as someone new, so no two people of a tale share
// a face. Tests pass a stand-in `portraits` ({takenIn}); none when nothing can be read.
async function portraitsTaken(context,{live=false,portraits=null}={}){
 try{
  const store=portraits??(live?(()=>{if(require('./world-art.cjs').revision!==12)delete require.cache[require.resolve('./world-art.cjs')];return require('./world-art.cjs').artStore?.people;})():null);
  const ids=[context?.story?.id,context?.story?.artId].filter(id=>typeof id==='string'&&id.length&&id.length<=120);
  return store?.takenIn&&ids.length?await store.takenIn(ids):new Set();
 }catch{return new Set();}
}
// A person the Dungeon Master introduced from peopleToMeet (by its pool id, or by the exact name of one offered) is
// filled in whole from the library; anyone else is as the Dungeon Master wrote them.
function pooledIntroduce(p,offered,lib){
 if(!p||typeof p!=='object')return p;
 const {pool,...rest}=p,list=offered instanceof Map?offered:new Map();
 const entry=list.get(pool)??[...list.values()].find(e=>e.name.toLowerCase()===String(p.name??'').trim().toLowerCase());
 return entry&&lib?.filledIntroduce?lib.filledIntroduce(rest,entry):rest;
}
// A dozen ready-made people the story writer may cast as residents (adventure-generator.cjs castResidents), by chance,
// at most three trained; none when the library is empty or cannot be read.
async function castFor(lib){try{return lib?.people?await lib.people.suited({seed:Date.now()+':'+Math.random(),count:12}):null;}catch{return null;}}
function loadModeration(){if(require('./moderation.cjs').revision!==1)delete require.cache[require.resolve('./moderation.cjs')];return require('./moderation.cjs').moderation;}
// What the player typed in this request, if anything: a turn's words (never a scene cue the game wrote), the idea for
// a tale of their own, or the description for a hero drafted by the AI.
function typedByPlayer(body){
 const c=body.context;
 if(c.mode==='adventure')return typeof c.idea==='string'?c.idea:'';
 if(c.mode==='art'||c.mode==='diagnostics'||c.mode==='moderate'||c.mode==='people-batch'||c.sceneTrigger)return '';
 return typeof body.input==='string'?body.input:'';
}
function loadStoryJobs(){if(require('./story-jobs.cjs').revision!==1)delete require.cache[require.resolve('./story-jobs.cjs')];return require('./story-jobs.cjs').storyJobs;}
function liveModels(model,storyModel,read=chosenModel){
 const play=read('.questbound-model'),story=read('.questbound-story-model');
 if(play){if(storyModel===model)storyModel=play;model=play;}
 if(story)storyModel=story;
 return {model,storyModel};
}
// How long a turn may take and how much it may write. The gateways wait 90 seconds for a turn, so the turn's quiet
// attempts and second look share 80 (a retry is only begun with 12 left). A reply has room for 3000 tokens (a long
// telling with four spoken lines is about 1500); one cut short by that limit is asked again with twice the room.
const turnBudget=80000,retryFloor=12000,turnRoom=3000;
// Better use of the provider's cache (the host, 2026-10-17: "put everything that never changes first and the
// turn-by-turn details last, so OpenAI reuses far more of each request"). The provider caches a request in whole
// parts (messages): it reuses every part, from the start, that is the same as in a request it saw a little earlier,
// and nothing after the first part that differs (measured on 2026-10-17: warm turns stopped at exactly the end of the
// instructions and schema, 14,280 or 14,901 tokens, and a retry whose note was added to the instructions got none).
// So the request is told in parts, from what never changes to what changes every turn:
//  1. the instructions: the standing prompt, byte-identical for every player, hero, phase, retry and second look, with
//     the one reply schema (replySchemaFor) that is also the same for all of them;
//  2. this hero's class features (a developer message; changes with a level);
//  3. the scene in parts (sceneMessages: what lasts the tale, the land and the pack, who is here, the story so far,
//     this turn with the player's words), each a user message;
//  4. what this turn alone needs, as a developer message after the scene: the phase, a retry's or second look's note
//     and NARRATOR THIS TURN, which stays the very last thing the model reads.
// `layout` 3 in the usage log marks requests built this way (dm-report.cjs shows the cached share).
// Measured live on 2026-10-20: still no turn was cached past about 15,020 tokens (the instructions and schema), though
// the hero and the scene before this turn's part were byte-identical from turn to turn. Sending the hero and the note
// as user messages instead (tried that day as layout 4) cached exactly as much, so the provider stops where the input
// begins and the developer messages are not the reason. Caching more would mean moving the scene into the
// instructions, and the scene holds what players wrote (their hero's story, their earlier words): kept out of the
// instructions on purpose.
const promptLayout=3,cacheBuckets=8;
// Keeping the cache warm across pauses (2026-10-22, the host: "keep the cache warm across pauses"; OpenAI's prompt
// caching guide and Responses reference, read that day). Live, a turn after a pause of more than about three minutes got
// nothing cached (usage log, 2026-10-16 to 22), so it paid the standing instructions and schema (about 15,000 tokens)
// in full again. How a cache is held depends on the model:
//  - GPT-5.6 and later (gpt-6-luna, which plays now): prompt_cache_retention is deprecated there; a cache lives for its
//    ttl (30 minutes by default, 12 hours on request in the Responses API) at breakpoints. The implicit breakpoint is
//    the end of the last user message (this turn's part, new every turn), and the guide's gotcha is exactly what was
//    measured: "without a breakpoint after static content, a changing suffix can prevent reuse of the shared prefix".
//    So two explicit breakpoints are added (prompt_cache_breakpoint on a content block; a request may write four):
//    after this hero's features (the instructions, schema and hero, the same for every turn: held 12 hours, written at
//    2.5 times the input price once and read at a tenth after), and after the last part of the scene that does not
//    change from turn to turn (what lasts the tale, the land, who is here: the request's own 30 minutes). Tokens
//    written are billed at the write rates (spending.cjs costOf prices them from the usage line).
//    prompt_cache_retention is not sent to these: the reference maps it to the request's ttl, and a request-level 12 hours
//    would bill every turn's new scene at 2.5 times instead of 1.25.
//  - Earlier models: prompt_cache_retention '24h' (no write charge there).
// .questbound-cache-hold (read live, like .questbound-dm-effort): 12h (the default), 30m (the breakpoints, the hero's for
// 30 minutes) or off. A provider 400 naming a parameter drops it for this DM process and asks again at once, as with
// prompt_cache_key: a 12-hour ttl refused (globalThis.__questboundNoLongTtl) falls back to the breakpoints for 30 minutes,
// breakpoints refused (globalThis.__questboundNoCacheBreakpoints) to prompt_cache_retention
// '24h', and that refused (globalThis.__questboundNoCacheRetention) to nothing. Usage lines carry hold: what was sent
// (12h or 30m for breakpoints, 24h for retention).
const newerCaching=model=>/^gpt-(?:5\.(?:[6-9]|\d{2,})|[6-9]|\d{2,})(?![\d])/.test(String(model??''));
function cacheHoldFor(model,setting){
 if(!['12h','30m'].includes(setting))return null;
 const retain=setting==='12h'&&!globalThis.__questboundNoCacheRetention?{label:'24h',kind:'retention',params:{prompt_cache_retention:'24h'},apply:q=>q}:null;
 if(!newerCaching(model)||globalThis.__questboundNoCacheBreakpoints)return retain;
 const block=(text,mark)=>[{type:'input_text',text,prompt_cache_breakpoint:mark}];
 const long=setting==='12h'&&!globalThis.__questboundNoLongTtl;
 return {label:long?'12h':'30m',kind:'breakpoints',params:{},apply:q=>{
  const input=q.input.map(m=>({...m})),users=input.map((m,i)=>m.role==='user'?i:-1).filter(i=>i>=0);
  if(input[0]?.role==='developer'&&typeof input[0].content==='string')input[0].content=block(input[0].content,long?{mode:'explicit',ttl:'12h'}:{mode:'explicit'});
  // The last part before this turn's that stays from turn to turn (the story so far changes with every turn's journal).
  const steady=users.slice(0,-1).filter(i=>typeof input[i].content==='string'&&!input[i].content.startsWith('Scene: the story so far.')).at(-1);
  if(steady!==undefined)input[steady].content=block(input[steady].content,{mode:'explicit'});
  return {...q,input};
 }};
}
function cacheHold(fallback,read=chosenModel){const chosen=read('.questbound-cache-hold');return ['12h','30m','off'].includes(chosen)?chosen:fallback;}
// One prompt_cache_key per share of the players (by tale and hero), the same for every kind of reply, so a hero's turns
// and their tellings meet the provider machine that saw the last one, and no one machine is asked too often.
function cacheKeyFor(body){
 const c=body?.context??{},who=String(c.story?.id??c.story?.title??'')+'|'+String(c.player?.name??'');
 let h=0;for(const ch of who)h=(h*31+ch.charCodeAt(0))>>>0;
 return {prompt_cache_key:'qb-dm-'+(h%cacheBuckets)};
}
async function generate(body,{apiKey,model,storyModel=model,reasoning='none',storyReasoning='medium',fetchImpl=fetch,onNarration=null,spending=null,library=null,moderation=null,people=null,portraits=null,holdCache=null}){
  if(fetchImpl===fetch)({model,storyModel}=liveModels(model,storyModel));
  // A guest's requests are counted against the host's daily allowance, and OpenAI is told which guest asked (by label
  // only), so misuse by one player is never taken for the host's own. Tests pass a stand-in `spending`.
  // Every live request reads the host's ceilings: guests are held to them, background work stops at them, and the host's
  // own play on this PC (no label) is never stopped.
  const guest=guestOf(body),live=fetchImpl===fetch,spend=spending??(live?loadSpending():null);
  const safety=safetyFor(guest),mayPaint=()=>!guest||!spend||(spend.mayPaint?spend.mayPaint(guest):spend.check(guest).ok);
  // Only what the game sends is accepted, refused before anything costs money: the modes it uses, a player's words up
  // to the message box's 1000 characters and a tale idea up to its 300.
  if(body.context.mode!==undefined&&body.context.mode!==null&&!modes.has(body.context.mode))throw Object.assign(Error('Invalid scene or action.'),{httpStatus:400});
  if(typeof body.input!=='string'||body.input.length>1000||(body.context.idea!==undefined&&body.context.idea!==null&&(typeof body.context.idea!=='string'||body.context.idea.length>300)))throw Object.assign(Error('That is longer than the game allows.'),{httpStatus:400});
  // A story being written in the background is asked after like an illustration: a quick question, never a wait.
  if(body.context.mode==='art'&&body.context.storyJob!==undefined)return loadStoryJobs().poll(body.context.storyJob);
  // The ready journeys on offer (their pitches, never their secrets) are asked for like an illustration: a quick look
  // that costs nothing, and keeps the library topped up.
  // Only the library writes a journey's brief: a brief sent by a browser is dropped.
  if(body.context.libraryBrief!==undefined)delete body.context.libraryBrief;
  const shelf=library??(live?loadLibrary():null);
  if(body.context.mode==='art'&&body.context.journeys==='list'){if(!shelf)return {journeys:[]};try{topUpLibrary(shelf,{apiKey,storyModel,effort:live?storyEffort(storyReasoning):storyReasoning,fetchImpl,live,spend});}catch{}return {journeys:shelf.list({cover:journeyCovers()})};}
  if(body.context.mode==='art'){if(require('./world-art.cjs').revision!==12)delete require.cache[require.resolve('./world-art.cjs')];return require('./world-art.cjs').artStore.request(body.context.subject,{apiKey,model,retry:body.context.retry===true,safety,mayPaint,host:!guest,onUnmatched:note=>recordCreatureMiss(note,live,guest),onPainted:(u,imageModel)=>recordUsage('art',model,u,live,guest,{images:1,imageModel,job:hostJobOf(body.context.subject,guest)})});}
  // Only the host checks the AI connection: its answer describes the key's shape.
  if(body.context.mode==='diagnostics'){if(guest)throw Object.assign(Error('Only the host can check the AI connection, on the PC itself.'),{httpStatus:403});return diagnose({apiKey,model,fetchImpl});}
  // The host's library of ready-made people is written in batches (make-people-library.cjs, people-writer.cjs): only the
  // host, on this PC, may ask. Recorded as 'people' in the usage log (the host's own spending).
  if(body.context.mode==='people-batch'){if(guest)throw Object.assign(Error('Only the host can write the people library, on the PC itself.'),{httpStatus:403});delete require.cache[require.resolve('./people-writer.cjs')];return require('./people-writer.cjs').writePeople(body,{apiKey,model:storyModel,fetchImpl,onUsage:u=>recordUsage('people',storyModel,u,live,null,{job:'people-library'})});}
  // The content check (moderation.cjs): a table name asked about by the account service (mode 'moderate') is answered
  // at once; a player paused after several held-back messages waits; what a player typed is checked before the story
  // model sees it, and held back with a calm line (or a caring one) when it crosses the limits. It fails open.
  const check=moderation??(live?loadModeration():null);
  if(body.context.mode==='moderate'){if(!check)return {moderation:{action:'allow',categories:[],unchecked:true}};const v=await check.check(body.input,{apiKey,guest,purpose:'name'});return {moderation:{action:v.action,categories:v.categories,line:v.line??null,...(v.unchecked?{unchecked:true}:{})}};}
  if(check&&guest){const left=check.paused(guest);if(left)throw Object.assign(Error(check.pauseLine(left)),{httpStatus:403});}
  if(check){const typed=typedByPlayer(body);if(typed){const v=await check.check(typed,{apiKey,guest,purpose:'turn'});if(v.action!=='allow')throw Object.assign(Error(v.line),{httpStatus:422});}}
  // Once guests have used the host's daily allowance (or this guest their share), or a ceiling is reached, or the host
  // paused guests, they are refused before anything is asked of the AI. New tales and drafted heroes are counted per guest too.
  if(guest&&spend){const verdict=spend.check(guest);if(!verdict.ok)throw Object.assign(Error(verdict.error),{httpStatus:verdict.status??503});
    const kind=body.context.mode==='adventure'?'tale':body.context.mode==='character'?'hero':null,counted=kind&&spend.allow?spend.allow(guest,kind):null;
    if(counted&&!counted.ok)throw Object.assign(Error(counted.error),{httpStatus:counted.status??429});}
  // While people play, the library of ready journeys is kept full (one journey at a time, in the background).
  const storyEffortNow=live?storyEffort(storyReasoning):storyReasoning;
  if(shelf&&!['adventure','character'].includes(body.context.mode))try{topUpLibrary(shelf,{apiKey,storyModel,effort:storyEffortNow,fetchImpl,live,spend});}catch{}
  if(body.context.mode==='adventure'){
    delete require.cache[require.resolve('./adventure-generator.cjs')];
    const effort=fetchImpl===fetch?storyEffort(storyReasoning):storyReasoning;
    // A tale that is not the next in a region may cast residents from the host's ready-made people.
    const castLib=people??(live?loadPeople():null);
    const write=(reasoning,timeout)=>{const go=cast=>require('./adventure-generator.cjs').generateAdventure(body,{apiKey,model:storyModel,reasoning,timeout,fetchImpl,safety,cast,onUsage:u=>recordUsage('adventure',storyModel,u,live,guest)});return castLib&&!body.context.continuing?castFor(castLib).then(go):go(null);};
    // A ready journey the player chose starts at once: their own copy of it (it is not used up). A journey that has just
    // left the library is refused, and the game shows the journeys on offer again.
    if(shelf&&body.context.journey!==undefined&&!body.context.continuing){const copy=shelf.start(String(body.context.journey));try{topUpLibrary(shelf,{apiKey,storyModel,effort,fetchImpl,live,spend});}catch{}if(!copy)throw Object.assign(Error('That journey has just left the library. Choose another; your adventure is unchanged.'),{httpStatus:409});return {story:copy,ahead:true,journey:true};}
    // A game from before the library, asking for Let fate decide or Easy to get into, gets any journey on offer (every
    // journey begins with orders in hand). Written openings, the next tale in a region and the player's own idea are
    // always written fresh.
    if(shelf&&body.context.journey===undefined&&!body.context.continuing&&!body.context.idea&&['easy','surprise'].includes(String(body.context.introId??'surprise'))){const copy=shelf.any();try{topUpLibrary(shelf,{apiKey,storyModel,effort,fetchImpl,live,spend});}catch{}if(copy)return {story:copy,ahead:true,journey:true};}
    // Asked for with a job id, the tale is written in the background with the effort the host chose, for as long as
    // it takes (up to seven minutes; at high effort a tale takes about three); the game asks after it every few
    // seconds (storyJob above).
    if(body.context.job!==undefined)return loadStoryJobs().start(body.context.job,()=>write(effort,420000).catch(e=>{recordWriteFailure('story-job',e,live,guest);throw e;}));
    // A browser on an earlier build waits on this one request: light thinking, so the tale arrives inside 80 seconds.
    return write(['medium','high','xhigh'].includes(effort)?'low':effort);
  }
  if(body.context.mode==='character'){delete require.cache[require.resolve('./character-generator.cjs')];return require('./character-generator.cjs').generateCharacter(body,{apiKey,model:storyModel,reasoning:storyReasoning,fetchImpl,safety,onUsage:u=>recordUsage('character',storyModel,u,live,guest)});}
  return playTurn(body,{apiKey,model,reasoning,fetchImpl,onNarration,live,guest,safety,people,portraits,holdCache});
}
// A game turn, in phases: what this turn allows (turnPlan), the request to the model with its waits (turnAsker),
// reading the reply, mending it and, as a last resort, rescuing what can be used (replyReader), asking again until
// a reply can be used (answered), then the second look (secondLooked). The phases share the plan and its state: the
// number of requests asked, the last response, and whether a reply is read quietly or for the second look.
async function playTurn(body,env){
  const turn=await turnPlan(body,env);
  const ask=turnAsker(body,turn,env),reader=replyReader(body,turn,env);
  const first=await answered(body,turn,env,ask,reader);
  return secondLooked(body,turn,env,ask,reader,first);
}
// What this turn allows: its phase, who may speak, be recruited or be met, what the reply may carry, and its time.
async function turnPlan(body,{fetchImpl,reasoning,live,people,portraits}){
  const choices=body.context.choices.map(c=>c.id);
  const resolvingSpell=!!body.context.pendingSpell&&!body.context.engineResolved;
  const nullSchema={type:'null'};
  const speakers=(body.context.conversationParticipants??[]).filter(n=>personId(n.id)).map(n=>n.id);
  // Someone new can be met on an ordinary turn or when narrating a resolved one (arriving somewhere), never on a scene cue or spell ruling.
  const canIntroduce=!!body.context.world?.canIntroduce&&!resolvingSpell&&!body.context.sceneTrigger&&!body.context.outOfCharacter;
  // Ready-made people from the host's library who suit this place, for the Dungeon Master to bring in (their portraits
  // are already painted). Tests pass a stand-in `people` (people-library.cjs's exports with a library of their own).
  const roster=people??(live?loadPeople():null),offered=canIntroduce?await peopleToMeetFor(body.context,roster,roster?await portraitsTaken(body.context,{live,portraits}):new Set()):new Map();
  if(offered.size)body.context.world={...body.context.world,peopleToMeet:[...offered.values()].map(roster.toMeet)};
  const recruitable=body.context.engineResolved||resolvingSpell||body.context.outOfCharacter?[]:(body.context.recruitmentTargets??[]).filter(id=>speakers.includes(id));
  // Someone present may offer, unasked, to come along (the player then chooses); never on a cue, a ruling or a resolved turn.
  const offerable=body.context.engineResolved||resolvingSpell||body.context.outOfCharacter||body.context.sceneTrigger?[]:speakers.filter(id=>body.context.followers?.[id]?.status!=='following'),recruitIds=[...new Set([...recruitable,...offerable])];
  // One on one: the player has turned to one person present, and only they may answer (never on a scene cue, where
  // whoever is present may speak first).
  const withId=body.context.conversationWith?.id,alone=body.context.conversationWith?.oneOnOne===true&&speakers.includes(withId)&&!body.context.sceneTrigger,allowedSpeakers=alone?[withId]:speakers;
  const voices=[...allowedSpeakers,...(canIntroduce&&!alone?['new']:[])];
  const sceneTrigger=body.context.sceneTrigger&&typeof body.context.sceneTrigger.cue==='string'?body.context.sceneTrigger.cue.slice(0,800):null;
  // A moment in which people would speak first (a first arrival, a return, a fight won: sceneTriggers.js), told in the
  // telling of the move that brought it, so it is not asked about in a request of its own (2026-10-22, the host:
  // "merge telling into first call"). The device sends it with the engine's lines (useDmTurn.js cast); the game then
  // sees who spoke and plays no cue for them (withSceneTrigger).
  const firstWords=body.context.engineResolved&&body.context.speakFirst&&typeof body.context.speakFirst.cue==='string'&&speakers.includes(body.context.speakFirst.speakerId)?body.context.speakFirst:null;
  const firstWordsNote=firstWords?' PEOPLE SPEAK FIRST: '+firstWords.cue.slice(0,600)+' So after the engine\'s results, '+String((body.context.conversationParticipants??[]).find(n=>n.id===firstWords.speakerId)?.name??firstWords.speakerId).slice(0,60)+' ['+firstWords.speakerId+'] speaks first in dialogue (one or two lines, to the player), and others present may add one, each saying something different.':'';
  // The player speaking to the DM directly, out of character: an answer, and perhaps the last turn taken back.
  const ooc=!!body.context.outOfCharacter&&!body.context.engineResolved&&!resolvingSpell&&!sceneTrigger;
  const phaseInstructions=sceneTrigger?'\nSCENE TRIGGER: The player has not spoken. '+sceneTrigger+' Present conversationParticipants speak first, in character, reacting to this moment and addressing the player. Give one to three short dialogue lines, each speaker saying something different (never two greetings alike), and in narration exactly one short sentence of what is seen or done as they speak (never empty, never the spoken words). Do not decide the player\'s words or actions. effects empty.':resolvingSpell?'\nCURRENT PHASE: Adjudicate pendingSpell now. Return a ruling (cast, deny or clarify) and no castCommand, actionId or check. If details are missing, use clarify and ask the specific question in narration and note; all effects must be zero. A narrative answer alone does not resolve the spell. Prefer cast or deny; use clarify only when the target is truly missing. Damage on a cast is never more than pendingSpell.damageMost, the most the dice of the spell can deal.':body.context.engineResolved?'\nCURRENT PHASE: Narrate the already resolved engine results. No actionId, castCommand, ruling, check, discovery, ambush, recruitment or worldEvent.'+firstWordsNote+(errandPaidTurn(body.context)?' The errand in context.story.errand is done: keeper hands over the promised reward ('+String(body.context.story.errand.reward??'').slice(0,160)+') now, with loot in this reply, within the loot limits.':''):ooc?'\nOUT OF CHARACTER: The player is speaking to you directly, player to Dungeon Master, outside the story: about a ruling, something that went wrong, what they meant to do, or how the game works. Answer plainly in your own voice, as a friendly human Dungeon Master talking across the table, in two to five sentences: no story narration, no NPC speech, and do not advance the scene. Speak of "the rules", "the dice" and "the game"; never mention an engine, fields, schemas, data or anything about how the game is built. Be fair and specific: explain what the rules or the game did, using context.outOfCharacter.lastTurn (what they said and what the game resolved); admit it when their words were misread or a rule was applied wrongly; say what they can do now. If the last turn went wrong because their words were misread, the game did something they clearly did not intend, or a rule was misapplied, and context.outOfCharacter.canRewind is true, set rewind to true: the game then takes that whole turn back (hit points, dice, position, everything) so they can say what they meant, and tell them so. Never rewind because the dice went badly, a fight is going poorly, a risk they chose did not pay off, or the hero died fairly: say no kindly and explain why. When canRewind is false and they ask to undo something, explain that the turn cannot be taken back any more and suggest what they can do instead. Set fault to true when the player tells you the game would not let them do something the rules allow, did something other than what they asked, or showed something wrong, or when you admit a rule was applied wrongly: the game then offers to send a short note to the host so it can be fixed. Leave it out for questions about the rules, plans, or the dice going against them. You cannot change hit points, gold, items or the story here: effects hold only rewind or fault, and dialogue is empty.':(errandPaidTurn(body.context)?'\nERRAND REWARD: the errand in context.story.errand is done and its reward is owed: keeper hands over the promised reward ('+String(body.context.story.errand.reward??'').slice(0,160)+') in this reply, said in the telling, with loot (one item may carry magic, as MAGIC REWARDS allows), within the loot limits.':'')+suggestionNote(body);
  // A new place can be revealed only on an ordinary turn of a written story, when the player is free to set out.
  const canDiscover=!!body.context.world?.canDiscover&&!body.context.engineResolved&&!resolvingSpell&&!sceneTrigger&&!ooc;
  const canAmbush=!!body.context.world?.canAmbush&&!body.context.engineResolved&&!resolvingSpell&&!sceneTrigger&&!ooc;
  // Relationship notes: on ordinary turns and when narrating a resolved turn, never for a scene cue or a spell ruling.
  const canRelate=!sceneTrigger&&!resolvingSpell&&!ooc;
  // Loot changes hands outside fights, on an ordinary turn or when narrating a resolved one (a search, a reward).
  // The engine's own spoils are never doubled: no loot when it has just searched the fallen or a fight has just been won.
  const engineSpoils=(body.context.engineResolved??[]).some(t=>/^You search |^Found: |^Among the hoard: | is slain\.$| falls dead\.$|drops senseless\.|collapses, beaten but alive\.|opponents are down/.test(String(t)));
  const canLoot=canRelate&&!!body.context.inventory&&!['combat','dying','dead'].includes(body.context.stage)&&!body.context.npcCombat?.active&&!engineSpoils;
  // No check while fighting people, or once a creature fight's action is spent (dm-rules refuses both): the schema
  // does not offer one, so talking a brawl down is told, and a spent action leaves a bonus action or end-turn.
  const noCheck=!body.context.engineResolved&&(!!body.context.npcCombat?.active||(body.context.stage==='combat'&&!!body.context.turnResources?.actionUsed));
  // The turn's phase: turn (an ordinary turn), told (a resolved turn or a scene cue, which only tell), ruling (a spell
  // awaiting one) or ooc (out of character). The reply schema is the same for all of them (the provider caches it with
  // the standing instructions); what the phase may return, who may speak, be recruited or be named this turn is held to
  // it when the reply is read.
  const shape=resolvingSpell?'ruling':ooc?'ooc':body.context.engineResolved||sceneTrigger?'told':'turn',replySchema=replySchemaFor();
  const turnReasoning=fetchImpl===fetch?turnEffort(reasoning):reasoning;
  // A turn's time: the phone gateway and the account service wait 90 seconds for the Dungeon Master, so every quiet
  // attempt and the second look fit inside turnBudget, each request given at most what is left.
  const begun=Date.now(),left=()=>turnBudget-(Date.now()-begun);
  return {choices,resolvingSpell,speakers,canIntroduce,roster,offered,recruitable,offerable,recruitIds,withId,alone,allowedSpeakers,voices,sceneTrigger,ooc,phaseInstructions,canDiscover,canAmbush,canRelate,engineSpoils,canLoot,noCheck,shape,replySchema,turnReasoning,begun,left,state:{lastReply:null,asks:0,quiet:false,aside:false}};
}
function turnAsker(body,{canDiscover,canAmbush,phaseInstructions,shape,replySchema,left,state},{apiKey,model,fetchImpl,onNarration,live,guest,safety,holdCache}){
  // One request to the model: `note` (a retry's or second look's) goes into this turn's note after the scene, so the
  // instructions and the scene before it stay cached. The provider's
  // completed response is kept beside the text so an unreadable reply can be described (replyShape). Each request
  // is numbered in the usage log (ask 1 is the turn itself, later ones its retries and second looks: dm-report.cjs).
  return async(note,effort,limit=90000,room=turnRoom)=>{
  const asked=++state.asks,aside=state.aside;
  let response;
  // The request in parts, in the cache order (turnRequest): the standing instructions and the one reply schema (the same
  // for every player, phase and retry), this hero's features, the scene from what lasts to what changes with the player's
  // words, then what this turn alone needs (its phase, a retry's or second look's note, the narrator's voice for this
  // turn, last). prompt_cache_key sends a hero's requests to the same provider machines (cacheKeyFor); a provider that
  // does not know it is asked again without it.
  const cacheKey=cacheKeyFor(body),request=turnRequest(body,{canDiscover,canAmbush},phaseInstructions+note+narratorVoice(body));
  for(let waits=0;;waits++){
  const keyed=!globalThis.__questboundNoCacheKey?cacheKey:{},held=cacheHoldFor(model,holdCache??(live?cacheHold('12h'):'off')),sent=held?held.apply(request):request;
  // A provider that refuses the effects list (its anyOf items) is asked with every effect spelled out as a field, as
  // before 2026-10-21, for the rest of this DM process; flatReply reads either shape.
  const schema=globalThis.__questboundSpelledOut?spelledOutSchema():replySchema;
  response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(Math.max(1000,Math.min(limit,providerTimeout(effort),left()))),body:JSON.stringify({...modelOptions(model,effort),...(safety??{}),...keyed,...(held?.params??{}),...(onNarration?{stream:true}:{}),store:false,...sent,max_output_tokens:outputBudget(room,effort),text:{format:{type:'json_schema',name:'dm_reply',strict:true,schema}}})});
  state.held=held?.label??null;
  if(response.ok)break;
  if(response.status===400&&(keyed.prompt_cache_key||held||!globalThis.__questboundSpelledOut)){let data=null;try{data=await response.json();}catch{}
   const said=JSON.stringify(data??'');
   if(held?.label==='12h'&&/\bttl\b|12h/.test(said)){globalThis.__questboundNoLongTtl=true;waits--;continue;}
   if(held?.kind==='breakpoints'&&/prompt_cache_(?:breakpoint|options)|\bttl\b|input_text/.test(said)){globalThis.__questboundNoCacheBreakpoints=true;waits--;continue;}
   if(held?.kind==='retention'&&/prompt_cache_retention/.test(said)){globalThis.__questboundNoCacheRetention=true;waits--;continue;}
   if(keyed.prompt_cache_key&&/prompt_cache_key/.test(said)){globalThis.__questboundNoCacheKey=true;waits--;continue;}
   if(!globalThis.__questboundSpelledOut&&/anyOf|json_schema|text\.format|schema/i.test(said)){globalThis.__questboundSpelledOut=true;waits--;continue;}
   throw await providerError({status:400,json:async()=>data??{}});}
  // Too many requests in this minute (several players at once): wait as long as the provider asks, briefly, and try
  // again, rather than failing the player's turn. Anything else (no credit, a bad key) is reported at once.
  const failure=await providerError(response);
  if(response.status!==429||!/code: rate_limit_exceeded/.test(failure.message)||waits>=2)throw failure;
  const retryAfter=Number(response.headers?.get?.('retry-after')),wait=Math.min(8000,Math.max(1500,(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:2500)*(waits+1)));
  if(left()<wait+10000)throw failure;
  await new Promise(resolve=>setTimeout(resolve,wait));
  }
  const usage=u=>{if(u&&typeof u==='object')recordUsage('turn',model,u,live,guest,{ask:asked,layout:promptLayout,phase:shape,...(aside?{aside:true}:{}),...(state.held?{hold:state.held}:{}),...(body.context?.storyPreferences?.length==='brief'?{length:'brief'}:{})});};
  if(onNarration)return streamedText(response,part=>onNarration(checkedHp(part,body.context)),usage,c=>{state.lastReply=c;});
  const data=await response.json();state.lastReply=data;usage(data.usage);
  // Cut short (the output limit, or the provider stopping): what was written is kept on the error for the last resort.
  if(data.status!=='completed')throw Object.assign(Error('The AI reply was incomplete. No game action was applied.'),{partial:outputText(data),incomplete:data.incomplete_details?.reason??String(data.status??'cut off')});
  return outputText(data);
  };
}
function replyReader(body,{choices,resolvingSpell,voices,offerable,recruitable,noCheck,ooc,sceneTrigger,shape,canIntroduce,offered,roster,allowedSpeakers,alone,canRelate,canLoot,canDiscover,canAmbush,state},{live}){
  // Reading a reply: repaired where the fault is small, refused where it is not. An unreadable reply keeps its text on
  // the error, so a sound narration in it can still be told as a last resort (rescued below).
  const noted=(kind,outcome)=>{if(!state.quiet)recordSecondLook(kind,outcome,body,live);};
  // The plain line for a journey to a new place the map could not open (a fight, a full map, a pending spell...).
  const shutWay=d=>{const name=typeof d?.name==='string'&&d.name.trim().length>=2?d.name.trim():'it';return fightingNow(body.context)?'There is no breaking away toward '+name+' while the fight goes on.':'The way to '+name+' is not open to you just yet.';};
  const read=text=>{
   // The provider writes each game effect as an item of effects (dm-schemas.cjs replySchemaFor); everything after this
   // reads the reply with every effect in its own field, as before (flatReply).
   const flat=value=>flatReply(value,()=>noted('effect given twice','dropped'));
   try{const value=JSON.parse(text);if(value&&typeof value==='object'&&!Array.isArray(value))return flat(value);}catch{}
   const repaired=repairedJson(text);
   if(repaired!==null){noted('unparseable reply','repaired');return flat(repaired);}
   const shape=replyShape(text,state.lastReply);if(!state.quiet)recordRejection('unparseable reply',null,body,live,shape,state.aside?{aside:true}:null);
   throw Object.assign(Error(shape.refusal?'The Dungeon Master declined to answer that. Try other words.':'The AI did not return a usable reply.'),{partial:typeof text==='string'?text:'',refusal:shape.refusal});
  };
  // Small faults the game mends in place instead of asking again, each noted for dm-report.cjs.
  const steadied=result=>{
   // What this phase cannot use (the one reply schema allows every field): left out, as the old per-phase schemas left
   // it out. A spell awaiting a ruling must get one (cast, deny or clarify): without it the reply is asked for again.
   {let dropped=false;for(const [k,allowed] of Object.entries(phaseFields[shape])){if(allowed)continue;const v=result[k],empty=listFields.has(k)?!Array.isArray(v)||!v.length:v==null||k==='rewind'||k==='fault';if(!empty)dropped=true;result[k]=listFields.has(k)?[]:null;}
    if(dropped)noted('field not used in this phase','dropped');}
   if(shape==='ruling'&&(result.ruling==null||typeof result.ruling!=='object'))throw Error('The DM must return a ruling (cast, deny or clarify) on the spell awaiting one. Nothing was applied.');
   // What the reply schema no longer lists turn by turn (it is the same for every player, so the provider caches it):
   // a choice id written in other capitals is the choice; a speaker named instead of given by id is that person, and a
   // line from someone who cannot speak now is dropped, and so is a recruitment decision this turn does not allow (a
   // join, check or decline for someone not invited, an offer from someone not here).
   // A telling given as null (outside the schema; seen in the diagnostics) is an empty one, framed below when it can be.
   if(result.narration==null)result.narration='';
   // A choice id copied with the brackets the choices are listed in ("[flee]") is that id.
   if(typeof result.actionId==='string'&&!choices.includes(result.actionId)){const bare=result.actionId.trim().replace(/^\[\s*(.*?)\s*\]$/,'$1').replace(/^["'`](.*)["'`]$/,'$1');if(bare!==result.actionId&&choices.includes(bare)){result.actionId=bare;noted('choice id','brackets removed');}}
   if(typeof result.actionId==='string'&&!choices.includes(result.actionId)){const want=result.actionId.trim().toLowerCase(),match=choices.find(id=>id.toLowerCase()===want);if(match){result.actionId=match;noted('choice id','matched');}else if(['','null','none'].includes(want)){result.actionId=null;noted('choice id','empty');}}
   // A known place given by its bare id ("inn" for travel-inn) is the journey there (seen in the diagnostics, 2026-10-21).
   if(typeof result.actionId==='string'&&!choices.includes(result.actionId)){const there=choices.find(id=>id.toLowerCase()==='travel-'+result.actionId.trim().toLowerCase());if(there){result.actionId=there;noted('choice id','place id');}}
   // A search of the fallen when nothing here is left to search (no spoils, no fight: the game offers no loot choice):
   // the game says so plainly rather than asking again (seen in the diagnostics, 2026-10-21: four of the last day's
   // replies asked again). The reply's own telling may tell of finds that were never there, so it gives way.
   if(result.actionId==='loot'&&!choices.includes('loot')&&!fightingNow(body.context)&&!body.context.pendingSpell&&!(Array.isArray(body.context.spoils)&&body.context.spoils.length)){
    result.actionId=null;result.narration='You look again, but there is nothing left here to search.';result.dialogue=[];result.loot=null;result.worldEvent=null;result.introduce=null;noted('search with nothing to search','told plainly');}
   if(Array.isArray(result.dialogue)&&result.dialogue.length){
    const byName=new Map((body.context.conversationParticipants??[]).filter(n=>n&&typeof n.name==='string').map(n=>[n.name.trim().toLowerCase(),n.id]));
    const named=result.dialogue.map(l=>l&&typeof l==='object'&&typeof l.speakerId==='string'&&!voices.includes(l.speakerId)&&voices.includes(byName.get(l.speakerId.trim().toLowerCase()))?{...l,speakerId:byName.get(l.speakerId.trim().toLowerCase())}:l);
    const kept=named.filter(l=>!l||typeof l!=='object'||voices.includes(l.speakerId));
    if(kept.length<named.length)noted('unavailable speaker','dropped');
    result.dialogue=kept;
   }
   if(Array.isArray(result.recruitment)&&result.recruitment.length){
    const fit=result.recruitment.filter(p=>!p||typeof p!=='object'||(p.decision==='offer'?offerable.includes(p.npcId):recruitable.includes(p.npcId)));
    if(fit.length<result.recruitment.length)noted('recruitment not allowed this turn','dropped');
    result.recruitment=fit;
   }
   // No check while fighting people or once a creature fight's action is spent (dm-rules refuses both): one written
   // anyway is left out and the telling stands, as when the schema could not hold one.
   if(noCheck&&result.check!=null){result.check=null;noted('check not allowed now','dropped');}
   const lines=Array.isArray(result.dialogue)?result.dialogue.filter(l=>typeof l?.text==='string'&&l.text.trim()):[];
   // Spoken lines without a telling (someone greets the player, or people answer): the framing is supplied.
   if(!ooc&&typeof result.narration==='string'&&!result.narration.trim()&&lines.length){const who=(body.context.conversationParticipants??[]).find(n=>n.id===lines[0]?.speakerId)?.name;result.narration=who?who+' looks up.':'A voice breaks the quiet.';if(!sceneTrigger)noted('narration missing','framing supplied');}
   // A game action with no telling: a plain line stands in (an action's own telling follows once the game resolves it).
   else if(!ooc&&!body.context.engineResolved&&typeof result.narration==='string'&&!result.narration.trim()){
    const place=result.discovery&&typeof result.discovery.name==='string'?result.discovery.name.slice(0,80):null,foe=result.ambush&&typeof result.ambush.name==='string'?result.ambush.name.slice(0,80):null;
    const line=place?(result.discovery.travel?'You set out, and come to '+place+'.':'You learn of '+place+'.'):foe?foe+' is upon you!':[result.actionId,result.castCommand,result.check,result.ruling].some(v=>v!=null)||(result.recruitment??[]).length?'Your action is resolved below.':null;
    if(line){result.narration=line;noted('narration missing','filled');}
   }
   // Too long a telling is cut after the last whole sentence that fits.
   if(typeof result.narration==='string'&&result.narration.length>1800){result.narration=tellingCut(result.narration,1800);noted('narration too long','cut');}
   // A ruling with no spell awaiting one (a cast the model was told about in castingIssue, or one it believed the hero
   // could not cast) is dropped. The rules decide what can be cast: a deny of a spell the hero knows and can pay for,
   // with no castingIssue, goes to the rules as the cast; anything else leaves the telling as it stands.
   if(result.ruling!=null&&!body.context.pendingSpell){
    const denied=result.ruling?.decision==='deny';result.ruling=null;
    const spell=denied&&result.castCommand==null&&!body.context.castingIssue?castableSpell(body.input,body.context):null;
    if(spell){result.castCommand=castWords(body.input,spell);noted('deny of a castable spell','the rules decide');}
    // A deny of the very cast the rules could not read (castingIssue) agrees with them: the telling says why, and the
    // cast the model also wrote out is not tried again.
    else if(denied&&body.context.castingIssue&&result.castCommand!=null){result.castCommand=null;noted('ruling without a spell','dropped with its cast');}
    else noted('ruling without a spell','dropped');
   }
   // On the spell awaiting a ruling: a deny or clarify applies nothing, and damage the game rolls itself is never the DM's.
   if(resolvingSpell&&result.ruling&&typeof result.ruling==='object'){
    const effects=['damage','selfDamage','healing','temporaryHP'];
    if(result.ruling.decision!=='cast'&&effects.some(k=>result.ruling[k]!==0)){for(const k of effects)result.ruling[k]=0;noted('effects on an uncast spell','zeroed');}
    if(result.ruling.decision==='cast'&&body.context.pendingSpell?.engineDamage&&result.ruling.damage!==0){result.ruling.damage=0;noted('spell damage from the DM','left to the dice');}
   }
   // A recruitment decision beside another game action (someone agrees to come along as the hero sets out): a join or
   // a check is the turn and the journey waits for the next one (a join starts no other action); a decline or an
   // offer leaves the action standing and is dropped.
   if(Array.isArray(result.recruitment)&&result.recruitment.length&&[result.actionId,result.castCommand,result.check,result.discovery,result.ambush].some(v=>v!=null)){
    if(result.recruitment.some(p=>['join','check'].includes(p?.decision))){for(const k of ['actionId','castCommand','check','discovery','ambush'])result[k]=null;result.retell=true;noted('recruitment beside an action','the action waits');}
    else{result.recruitment=[];noted('recruitment beside an action','recruitment dropped');}
   }
  };
  const judge=(result,{quiet=false}={})=>{
  state.quiet=quiet;
  try{
  steadied(result);
  if(typeof result.narration!=='string'||!result.narration.trim()||result.narration.length>1800||(result.actionId!==null&&!choices.includes(result.actionId)))throw Error('The AI proposed an invalid response.');
  // Out of character the DM only talks: it may take the last turn back, never change the game.
  if(ooc&&([result.actionId,result.castCommand,result.ruling,result.check,result.discovery,result.ambush,result.worldEvent,result.loot,result.introduce].some(v=>v!=null)||(result.dialogue??[]).length||(result.recruitment??[]).length))throw Error('Out of character, the Dungeon Master cannot change the game. Nothing was applied.');
  let check=result.check??null;
  // A check without damage has no meaningful die; the model often sends 0 there.
  if(check&&check.damageCount===0&&check.damageOn==='none'&&![4,6,8,10,12,20].includes(check.damageDie))check.damageDie=6;
  if(!validCheck(check))throw Error('Invalid check plan.');
  let castCommand=result.castCommand??null,narration=result.narration,worldEvent=result.worldEvent??null;const ruling=result.ruling??null;let discovery=repairedDiscovery(result.discovery??null),ambush=repairedCreature(result.ambush??null);
  // One game action per reply. When the model starts two (a journey and a check on arriving), the first in the
  // order the game resolves them is kept and the rest dropped, instead of refusing the whole reply.
  if(!ruling){let kept=false;const keep=v=>{if(v==null||kept)return null;kept=true;return v;};result.actionId=keep(result.actionId);castCommand=keep(castCommand);discovery=keep(discovery);check=keep(check);ambush=keep(ambush);}
  if((castCommand!==null&&(typeof castCommand!=='string'||castCommand.length>500||!/^I cast /i.test(castCommand)))||!validRuling(ruling)||(worldEvent!==null&&(typeof worldEvent!=='string'||!worldEvent.trim()||worldEvent.length>800))||[result.actionId,castCommand,ruling,check,discovery,ambush].filter(v=>v!==null).length>1||(ruling&&!body.context.pendingSpell))throw Error('The AI proposed an invalid ruling. Nothing was applied.');
  // A new place the map cannot take (the stories spec, Phase A9, 2026-10-22: asked again nine times in one rough session;
  // repairedDiscovery mends what it can first): a known place by its name, with a journey there on offer, is that journey;
  // anything else is left out, kept as words when the reply records nothing lasting of its own (worldEvent), and never a
  // reason to ask again.
  if(discovery&&(!validDiscovery(discovery)||!canDiscover)){
   const bare=t=>String(t??'').trim().toLowerCase().replace(/^the /,''),known=(Array.isArray(body.context.world?.knownPlaces)?body.context.world.knownPlaces:[]).find(p=>isObj(p)&&bare(p.name)&&bare(p.name)===bare(discovery.name));
   const journey=known&&discovery.travel===true&&choices.includes('travel-'+known.id)&&[result.actionId,castCommand,check,ambush].every(v=>v==null)?'travel-'+known.id:null;
   if(journey){result.actionId=journey;noted('discovery','a known place: its journey');}
   else{const ways={N:'north',NE:'north-east',E:'east',SE:'south-east',S:'south',SW:'south-west',W:'west',NW:'north-west'},name=typeof discovery.name==='string'?discovery.name.trim():'',about=typeof discovery.description==='string'?discovery.description.trim():'';
    const fighting=fightingNow(body.context);
    // A telling that walks the hero there (travel true) would say they arrived where the game never moved them (the
    // project review, 2026-10-22): asked again once with the reason, then told plainly that the way is not open.
    if(discovery.travel===true){
     if(!quiet&&!state.discoveryAsked){state.discoveryAsked=true;throw Error(fighting?'The DM described a new place the map cannot take now: the hero is in a fight or down, so nobody walks off to a new place. Tell what happens here.':'The DM described a new place the map cannot take now (world.canDiscover is false): tell what happens here instead.');}
     narration=shutWay(discovery);result.dialogue=[];noted('discovery','left out: the way told shut');
    }
    // Kept as words when the reply records nothing lasting of its own, out of a fight only.
    else if(worldEvent===null&&!fighting&&name.length>=2&&about)worldEvent=cut(name+(ways[discovery.bearing]?', to the '+ways[discovery.bearing]:'')+': '+about,800);
    noted('discovery','left out: the map could not use it');}
   discovery=null;}
  if(!validCreature(ambush)||(ambush&&!canAmbush))throw Error('The DM described a creature the game could not use. Nothing was applied.');
  if(discovery)discovery.miles=Math.round(Math.min(discovery.region?300:12,Math.max(0.1,discovery.miles))*10)/10;
  // Tellings written ahead (2026-10-22, the host: "merge telling into first call"): a check's two outcomes and a
  // journey's arrival somewhere not yet visited. The device and the campaign server show them only when the rules turned
  // out as foreseen (toldAhead.js), else they ask for the telling as before; anything unsound here is left out (the
  // telling is then asked for after the roll or the road), never a reason to ask again.
  const aheadText=t=>typeof t==='string'&&t.trim()?checkedHp(t.trim().length>900?tellingCut(t.trim(),900):t.trim(),body.context):null;
  const aheadLines=(lines,max,ok)=>distinctDialogue((Array.isArray(lines)?lines:[]).filter(l=>l&&typeof l==='object'&&ok(l.speakerId)&&typeof l.text==='string'&&l.text.trim()&&l.text.length<=700).slice(0,max).map(l=>({speakerId:l.speakerId,text:checkedHp(l.text.trim(),body.context)})));
  const aheadOutcome=o=>{if(!o||typeof o!=='object')return null;const told=aheadText(o.narration);if(!told)return null;const rel=canRelate?(Array.isArray(o.relationships)?o.relationships:[]).slice(0,1).filter(d=>validRelationships([d],body.context)):[];return {narration:told,dialogue:aheadLines(o.dialogue,2,id=>allowedSpeakers.includes(id)),relationships:rel};};
  // A failure written ahead that changes nothing ("you find nothing") is asked for again (CHECKS: the failure moves the
  // scene; the stories spec, Phase A2); a rescue keeps the check, told after the roll.
  if(check&&check.outcomes!=null&&!fightingNow(body.context)&&deadEnd(check.outcomes?.failure?.narration,check.outcomes?.failure?.dialogue)){
   if(!quiet&&!state.deadEndAsked){state.deadEndAsked=true;throw Error('The check\'s failure outcome ends on nothing: a failure moves the scene (the thing found at a cost in time, trust, noise or position, or a worse way).');}
   noted('check outcomes','dead end kept');}
  if(check&&check.outcomes!=null){const won=aheadOutcome(check.outcomes?.success),lost=aheadOutcome(check.outcomes?.failure),kept=won&&lost&&!fightingNow(body.context)?{success:won,failure:lost}:null;if(!kept)noted('check outcomes','told after the roll');check={...check,outcomes:kept};}
  let arrival=null;
  if(result.arrival!=null){const told=aheadText(result.arrival?.narration),journey=typeof result.actionId==='string'&&result.actionId.startsWith('travel-')&&choices.includes(result.actionId);
   if(told&&journey)arrival={narration:told,dialogue:aheadLines(result.arrival.dialogue,3,id=>personId(id))};else noted('arrival','dropped');}
  // The player has to name the spell; an unnamed cast becomes a question instead.
  if(castCommand&&!spellNamed(body.input,body.context)){const known=(body.context.spellReference??[]).map(s=>s.name).slice(0,4);castCommand=null;narration='Which spell do you cast? Name it'+(known.length?' — for example '+known.join(', ')+'.':'.');}
  // Someone new: only alongside narration (or a place revealed), never with another game action; their lines go with them.
  let introduce=canIntroduce?pooledIntroduce(repairedIntroduce(result.introduce??null,body.context),offered,roster):null;
  if(introduce&&([result.actionId,castCommand,ruling,check,ambush].some(v=>v!=null)||(result.recruitment??[]).length||!validIntroduce(introduce,body.context)))introduce=null;
  const dialogue=(result.dialogue??[]).filter(l=>!(l?.speakerId==='new'&&!introduce)),recruitment=(result.recruitment??[]).map(p=>p&&typeof p==='object'?{...p,dc:p.decision==='check'&&Number.isInteger(p.dc)?Math.min(25,Math.max(10,p.dc)):p.decision==='check'?p.dc:null,class:npcClassNames.includes(p.class)?p.class:null}:p);
   // Two people never say the same thing in one reply: a later line that echoes an earlier one is dropped.
  {const kept=distinctDialogue(dialogue);if(kept.length<dialogue.length){noted('echoed line','dropped');dialogue.splice(0,dialogue.length,...kept);}}
  // A clear yes/no needs no DC, and a hesitant NPC's DC stays within 10–25.
  if(!Array.isArray(dialogue)||dialogue.length>4||dialogue.some(line=>!line||!(allowedSpeakers.includes(line.speakerId)||(line.speakerId==='new'&&introduce&&!alone))||typeof line.text!=='string'||!line.text.trim()||line.text.length>700))throw Error('The DM included an unavailable speaker. Nothing was applied.');
  if(!Array.isArray(recruitment)||recruitment.length>2||new Set(recruitment.map(p=>p?.npcId)).size!==recruitment.length||recruitment.some(p=>!p||!(p.decision==='offer'?offerable.includes(p.npcId):recruitable.includes(p.npcId)&&['join','decline','check'].includes(p.decision))||typeof p.reason!=='string'||p.reason.trim().length<3||p.reason.length>400||typeof p.terms!=='string'||p.terms.length>300||(p.decision==='check'?!(Number.isInteger(p.dc)&&p.dc>=10&&p.dc<=25):p.dc!==null))||recruitment.length&&[result.actionId,castCommand,ruling,check,discovery].some(v=>v!=null))throw Error('The recruitment decision was invalid. Nothing was applied.');
  // A turn that starts a game action records its effect on people when that action is narrated, not before.
  let relationships=Array.isArray(result.relationships)?result.relationships:[];
  if(!canRelate||[result.actionId,castCommand,ruling,check,discovery,ambush].some(v=>v!=null)||recruitment.length)relationships=[];
  if(!validRelationships(relationships,body.context))relationships=relationships.filter(d=>validRelationships([d],body.context));
  // Loot goes with the narration that hands it over: dropped when this turn starts an action, refused if it cannot be paid.
  let loot=canLoot?repairedLoot(result.loot??null):null;
  {const clamped=clampedLoot(loot,body.context);loot=clamped.loot;for(const what of new Set(clamped.changed))noted('loot '+what,what==='gold'?'clamped to the level\'s most':'magic removed');}
  if(loot&&([result.actionId,castCommand,ruling,check,discovery,ambush].some(v=>v!=null)||recruitment.length)){loot=null;result.retell=true;noted('loot beside an action','dropped');}
  // The game's own payment of the promised purse when the reply's loot is missing: in the telling of "Chapter 1 complete"
  // (a device on an earlier build, where the Dungeon Master moved the tale on) as before; on a turn spoken with keeper
  // while the reward is owed, only when the telling hands it over (the project review, 2026-10-22: it was paid on any
  // such turn, whatever the telling said).
  const handedOver=body.context.story?.errand?.rewardDue!==true||/\b(?:reward|purse|coins?|gold|silver|pay|paid|payment|promised|owed|earned|fee|wages?)\b/i.test([narration,...dialogue.filter(l=>l?.speakerId==='keeper').map(l=>l.text)].join(' '));
  if(!loot&&canLoot&&handedOver&&errandPaidTurn(body.context)&&errandPurse(body.context)>0){loot={gold:Math.min(errandPurse(body.context),40*(body.context.player?.level??1)+60),items:[],reason:'The promised reward for the errand.'};noted('errand reward','the game paid');}
  if(loot&&!validLoot(loot,body.context)){if(Number.isInteger(loot.gold)&&(body.context.inventory?.gold??0)+loot.gold<0)throw Error('You do not have enough gold for that.');loot=null;}
  // Facts to keep (the story so far): tidied here, never a reason to refuse; a turn that starts an action keeps them
  // for the telling of what it resolved, as relationship notes are kept.
  let remember=canRelate?cleanRemember(result.remember,body.context):[];
  if([result.actionId,castCommand,ruling,check].some(v=>v!=null)||recruitment.length)remember=[];
  if(!introduce)remember=remember.map(f=>({...f,about:f.about.filter(id=>id!=='new')}));
  // retell: the narration may tell what did not happen (a journey that now waits for a join, loot left out), so the
  // device and the campaign server ask for the telling of what the engine resolved even where the reply could serve.
  const reply={...(result.retell?{retell:true}:{}),narration,dialogue,recruitment,relationships,remember,loot,introduce,actionId:result.actionId,castCommand,ruling,worldEvent,check,discovery,ambush,arrival,rewind:ooc&&result.rewind===true&&body.context.outOfCharacter?.canRewind===true,suggestions:ooc?[]:cleanSuggestions(result.suggestions,body.input,body.context),fault:ooc&&result.fault===true};
  // Hit points stated in the telling must be the game's own.
  reply.narration=checkedHp(reply.narration,body.context);reply.dialogue=reply.dialogue.map(l=>({...l,text:checkedHp(l.text,body.context)}));
  validateGroundedReply(body.context,reply);
  return reply;
  }catch(e){if(!quiet)recordRejection(e.message,result,body,live,null,state.aside?{aside:true}:null);if(e&&typeof e==='object')e.fromReply=true;throw e;}
  finally{state.quiet=false;}
  };
  const digest=text=>judge(read(text));
  // The last resort, once the quiet attempts are spent or the time is short: what the last reply holds that the game
  // can use. Each part the checks refuse is taken out in turn and the telling stays when it is sound; a spell awaiting a
  // ruling is asked about again (clarify: nothing is spent); a resolved turn keeps the engine's results with a plain
  // line if its telling is lost. Nothing the checks refuse is ever applied.
  const clarifying={decision:'clarify',note:'The ruling on this spell was not settled. Say again how you cast it, and at whom or what.',damage:0,selfDamage:0,healing:0,temporaryHP:0};
  const mechanical=['actionId','castCommand','ruling','check','discovery','ambush','worldEvent','loot','introduce','arrival'];
  const plainOf=r=>{
   const out={...r};for(const k of mechanical)out[k]=null;out.recruitment=[];out.relationships=[];out.rewind=null;out.fault=null;
   out.dialogue=ooc?[]:(Array.isArray(r.dialogue)?r.dialogue:[]).filter(l=>l&&allowedSpeakers.includes(l.speakerId)&&typeof l.text==='string'&&l.text.trim()&&l.text.length<=700).slice(0,4);
   if(!Array.isArray(out.suggestions))out.suggestions=[];
   if(resolvingSpell){out.ruling={...clarifying};out.narration=clarifying.note;}
   else if(typeof out.narration!=='string'||!out.narration.trim())out.narration=body.context.engineResolved?'The moment settles as the dice fell.':out.narration;
   return out;
  };
  const withoutFault=(r,message)=>{
   let next={...r};
   if(/invalid response/.test(message)&&r.actionId!=null&&!choices.includes(r.actionId))next.actionId=null;
   else if(/Invalid check plan|check cannot be made|already spent/.test(message))next.check=null;
   else if(/new place/.test(message)){next.discovery=null;if(r.discovery?.travel===true){next.narration=shutWay(r.discovery);next.dialogue=[];}}
   else if(/creature the game/.test(message))next.ambush=null;
   else if(/recruitment decision/.test(message))next.recruitment=[];
   else next=plainOf(r);
   if(JSON.stringify(next)===JSON.stringify(r))next=plainOf(r);
   return JSON.stringify(next)===JSON.stringify(r)?null:next;
  };
  const rescued=result=>{
   if(!result||typeof result!=='object')return null;
   let r=structuredClone(result);
   for(let i=0;i<10&&r;i++){
    try{return judge(structuredClone(r),{quiet:true});}
    catch(e){if(/enough gold/.test(String(e?.message)))return null;r=withoutFault(r,String(e?.message??''));}
   }
   return null;
  };
  // An unreadable or cut-short reply whose narration was written in full: that telling alone, with nothing applied.
  const fromText=text=>{
   if(typeof text!=='string'||!/"narration"\s*:\s*"(?:[^"\\]|\\.)*"/.test(text))return null;
   const narration=partialNarration(text).trim();if(!narration)return null;
   return {narration,dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,fault:null,suggestions:[]};
  };
  return {read,judge,digest,rescued,fromText};
}
// A reply that cannot be used for a mechanical reason (unreadable, cut short, outside the schema or the rules) is
// asked for again with the reason, up to twice and only while the turn has time; a passing provider fault (a time
// out, a server error) is tried once more. Then the last resort; only if nothing in it can be used does the player see
// a calm error (with the Report chip). What the player has to hear (they cannot pay) is never asked again.
async function answered(body,{turnReasoning,left,state},{live},ask,{read,judge,rescued,fromText}){
   let note='',room=turnRoom,last=null,lastText=null,passed=false;const reasons=[];
   for(let tries=0;;tries++){
    try{
     const text=await ask(note,turnReasoning,note?40000:90000,room);lastText=text;
     const parsed=read(text);last=structuredClone(parsed);
     const reply=judge(parsed);
     if(reasons.length)recordTurn('asked again',reasons,body,live,state.asks);
     return reply;
    }
    catch(e){
     const message=String(e?.message??e);
     if(typeof e?.partial==='string'){lastText=e.partial;if(e.incomplete)recordRejection('incomplete reply',null,body,live,{...replyShape(e.partial,state.lastReply),incomplete:String(e.incomplete).slice(0,40)});}
     const fixable=(unusable(message)||e?.fromReply===true)&&!e?.refusal,passing=transient(e);
     if((!fixable&&!passing)||/enough gold/.test(message))throw e;
     reasons.push(faultKind(e));
     if(tries<2&&left()>=retryFloor&&(fixable||!passed)){
      if(passing)passed=true;
      // Cut short by the output limit: the next attempt gets more room.
      if(e?.incomplete&&/max_output_tokens|cut off/.test(String(e.incomplete)))room=Math.min(room*2,8000);
      recordSecondLook('unusable reply','asked again',body,live);
      note=fixable?'\nLOOK AGAIN: Your last reply could not be used ('+message.slice(0,160)+'). Answer the player\'s message again, keeping exactly to the reply format, the choices on offer and the limits given.':'';
      continue;
     }
     const saved=rescued(last)??rescued(fromText(lastText));
     if(saved){recordTurn('rescued',reasons,body,live,state.asks);return saved;}
     recordTurn('failed',reasons,body,live,state.asks);
     if(fixable)throw Object.assign(Error('The Dungeon Master\'s reply could not be used this time, so nothing was applied. Try again, perhaps in other words.'),{httpStatus:e?.httpStatus});
     throw e;
    }
   }
}
// A second look (dm-intent.cjs): when the reply does not do what the player's words plainly ask and the game
// offers, the model is asked once more with the point spelled out and a little thought, if the turn has time. If it
// still does not act and the request is unmistakable, the game starts the action itself.
async function secondLooked(body,{canDiscover,turnReasoning,left,state},{live},ask,{digest},first){
  const fault=secondLook(body,first,{canDiscover});
  if(!fault)return first;
  // An unmistakable request (sure: a whole place name, a plain rest or draught...) is acted on by the game at once, with
  // the reply's own telling when it tells that move (dm-intent.cjs settled), instead of asking the model again first
  // (2026-10-22, the host: "fewer retries and second looks"; the model acted on the second ask anyway).
  if(fault.sure){recordSecondLook(fault.kind,'the game acted at once',body,live);return settled(fault,first);}
  let second=null;
  if(left()>=retryFloor){state.aside=true;try{second=digest(await ask('\nLOOK AGAIN: '+fault.note,turnReasoning==='none'?'low':turnReasoning,40000));}catch{}finally{state.aside=false;}}
  const still=second?secondLook(body,second,{canDiscover}):fault,sure=[still,fault].find(f=>f?.sure)??null;
  recordSecondLook(fault.kind,second&&!still?'the model acted':sure?'the game acted':'left as answered',body,live);
  if(second&&!still)return second;
  if(sure)return settled(sure,second??first);
  return second??first;
}
// Token use per request (mode, model, input, cached and output tokens, paintings, and the guest's label when a guest
// asked) is appended locally so the host can see what play costs (node dm-report.cjs) and spending.cjs can keep guests
// within the host's daily allowance. Test runs against a fake provider are not counted.
function recordUsage(mode,model,usage,live=true,guest=null,extra=null){
 if(!live||((!usage||typeof usage!=='object')&&!extra))return;usage=usage&&typeof usage==='object'?usage:{};
 try{
  const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-usage.jsonl');
  // Cache writes, on the models that report them (priced at the write rates by spending.cjs costOf).
  const written=usage.input_tokens_details?.cache_write_tokens,long=usage.input_tokens_details?.cache_write_tokens_details?.ttl_12h_tokens;
  const entry={at:new Date().toISOString(),mode,model:String(model??''),input:usage.input_tokens??0,cached:usage.input_tokens_details?.cached_tokens??0,...(Number.isFinite(written)&&written>0?{written,...(Number.isFinite(long)&&long>0?{written12h:long}:{})}:{}),output:usage.output_tokens??0,reasoning:usage.output_tokens_details?.reasoning_tokens??0,...(guest?{guest}:{}),...(extra??{})};
  if(fs.existsSync(file)&&fs.statSync(file).size>5e6)fs.renameSync(file,file+'.old');
  fs.appendFileSync(file,JSON.stringify(entry)+'\n');
 }catch{}
}
// Rejected AI replies are logged locally (mechanical fields only, never keys or story text) so intermittent failures can
// be diagnosed. Test runs against a fake provider are not logged.
// A reply that is not JSON: JSON wrapped in markdown fences or prose is recovered, and so is a reply the model sent
// twice (two output messages, two objects back to back: seen in the diagnostics on 2026-10-03), read as its first
// complete object (repairedJson and firstObject in ai-request.cjs, shared with the story writer); anything else is refused.
// What an unreadable reply looked like, in mechanical terms only (never its words): how long, how it starts and ends,
// which output items the provider sent, and whether it was a refusal or cut short.
function replyShape(text,reply){
 const t=typeof text==='string'?text:'',head=t.trimStart(),tail=t.trimEnd();
 const items=(reply?.output??[]).map(o=>String(o?.type??'?')+(Array.isArray(o?.content)?':'+o.content.map(c=>String(c?.type??'?')).join('+'):'')).slice(0,8);
 return {length:t.length,start:!head?'empty':head[0]==='{'?'brace':head.startsWith('```')?'fence':'text',end:!tail?'empty':tail.at(-1)==='}'?'brace':tail.endsWith('```')?'fence':'text',items,status:reply?.status??null,incomplete:reply?.incomplete_details?.reason??null,refusal:items.some(i=>/refusal/.test(i))};
}
function recordRejection(error,result,body,live=true,shape=null,extra=null){
 if(!live)return;
 try{
  const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl');
  const r=result??{},entry={at:new Date().toISOString(),guest:guestOf(body),error:String(error).slice(0,300),...(shape?{shape}:{}),...(extra??{}),context:{stage:body.context?.stage??null,pendingSpell:!!body.context?.pendingSpell,engineResolved:!!body.context?.engineResolved,sceneTrigger:!!body.context?.sceneTrigger,recruitmentTargets:body.context?.recruitmentTargets??[],participants:(body.context?.conversationParticipants??[]).map(p=>p.id)},
   reply:{actionId:r.actionId??null,castCommand:r.castCommand?String(r.castCommand).slice(0,120):null,ruling:r.ruling??null,check:r.check?{...r.check,reason:undefined,success:undefined,failure:undefined,outcomes:r.check.outcomes!=null?true:undefined}:null,arrival:r.arrival!=null?true:undefined,recruitment:(r.recruitment??[]).map(p=>({npcId:p?.npcId,decision:p?.decision,dc:p?.dc,reasonLength:p?.reason?.length??0,termsLength:p?.terms?.length??0})),dialogueSpeakers:(r.dialogue??[]).map(l=>l?.speakerId),narrationLength:typeof r.narration==='string'?r.narration.length:null,worldEventLength:typeof r.worldEvent==='string'?r.worldEvent.length:null,...(r.discovery&&typeof r.discovery==='object'?{discovery:{kind:r.discovery.kind??null,bearing:r.discovery.bearing??null,miles:r.discovery.miles??null,travel:r.discovery.travel??null,danger:r.discovery.danger??null,region:!!r.discovery.region,lair:r.discovery.lair?.template??null,ally:r.discovery.lair?.ally?.template??null,nameLength:typeof r.discovery.name==='string'?r.discovery.name.length:null,descriptionLength:typeof r.discovery.description==='string'?r.discovery.description.length:null,featureLength:typeof r.discovery.feature==='string'?r.discovery.feature.length:null,canDiscover:!!body.context?.world?.canDiscover}}:{})}};
  if(fs.existsSync(file)&&fs.statSync(file).size>2e6)fs.renameSync(file,file+'.old');
  fs.appendFileSync(file,JSON.stringify(entry)+'\n');
 }catch{}
}
// A tale written in the background (a ready journey for the library, or a story job) that failed is noted with what
// kind of failure it was and nothing of its words (requestFailure in ai-request.cjs: timeout, provider HTTP status,
// incomplete, failed, refused, invalid JSON, rejected by journeyCheck...), so the next failure can be told apart.
function recordWriteFailure(what,error,live=true,guest=null){
 if(!live)return;
 try{const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...(guest?{guest}:{}),write:what,...requestFailure(error)})+'\n');}catch{}
}
// Second looks are noted beside the rejections (kind and outcome only), so the host can see how often the Dungeon
// Master had to be asked twice: node dm-report.cjs counts them.
function recordSecondLook(kind,outcome,body,live=true){
 if(!live)return;
 try{const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),guest:guestOf(body),secondLook:kind,outcome,stage:body.context?.stage??null})+'\n');}catch{}
}
// How a troubled turn ended (dm-report.cjs): 'asked again' (a quiet retry gave a usable reply), 'rescued' (the
// attempts were spent and the usable part of a reply was told: nothing invalid applied) or 'failed' (the player saw a
// calm error). The reasons are kinds of fault only, never words.
function recordTurn(outcome,reasons,body,live=true,asks=1){
 if(!live)return;
 const c=body?.context??{},phase=c.engineResolved?'resolved':c.pendingSpell?'spell':c.sceneTrigger?'cue':c.outOfCharacter?'ooc':'ordinary';
 try{const fs=require('node:fs'),file=require('node:path').join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-diagnostics.jsonl');fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),guest:guestOf(body),turn:outcome,reasons:(reasons??[]).slice(0,4),asks,phase,stage:c.stage??null})+'\n');}catch{}
}
// Several players can share one Dungeon Master: up to `concurrency` replies are written at once and the rest wait
// briefly for a turn instead of being turned away. Illustration requests only queue or report progress, so they never wait.
function createServer({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL,storyModel=process.env.OPENAI_STORY_MODEL||model,reasoning=process.env.QUESTBOUND_DM_REASONING||'none',storyReasoning=process.env.QUESTBOUND_STORY_REASONING||'medium',fetchImpl=fetch,concurrency=Number(process.env.QUESTBOUND_DM_CONCURRENCY)||3,queueLimit=12,queueWait=40000}={}){
  let running=0;const waiting=[];
  const busy=()=>Object.assign(Error('The Dungeon Master is busy with other players. Try again in a moment. Your adventure is unchanged.'),{httpStatus:429});
  const acquire=()=>new Promise((resolve,reject)=>{
    if(running<concurrency){running++;return resolve();}
    if(waiting.length>=queueLimit)return reject(busy());
    const entry={start:()=>{clearTimeout(timer);running++;resolve();}},timer=setTimeout(()=>{waiting.splice(waiting.indexOf(entry),1);reject(busy());},queueWait);
    waiting.push(entry);
  });
  const release=()=>{running--;waiting.shift()?.start();};
  // When the Dungeon Master starts with a live key, the library of ready journeys tops itself up (the host's writer).
  if(fetchImpl===fetch&&apiKey&&model&&process.env.QUESTBOUND_LIBRARY!=='off')setTimeout(()=>{try{require(__filename).startLibrary({apiKey,model,storyModel,storyReasoning});}catch{}},3000).unref?.();
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data));};
    // Only this PC's own loopback names are answered (a site pointed at this PC by DNS rebinding is turned away).
    if(!loopbackHost(req))return send(403,{error:'Use the Questbound game on this PC.'});
    if(origin&&!allowedOrigins.has(origin))return send(403,{error:'Origin not allowed.'});
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin??'http://localhost:8081','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
    if(req.url==='/health'&&req.method==='GET')return send(200,{ready:!!apiKey&&!!model,actionProtocol:3});
    if(req.url!=='/dm'||req.method!=='POST')return send(404,{error:'Not found.'});
    if(!allowedOrigins.has(origin)||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Use the Questbound app to contact the DM.'});
    if(!apiKey||!model)return send(503,{error:'Live AI is not configured yet. Set the server API key and model, then restart the DM server. Your adventure is unchanged.'});
    let raw='',slot=false;try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>64000)return send(413,{error:'This scene is too large.'});}
      let body;try{body=JSON.parse(raw);}catch{return send(400,{error:'Invalid request.'});}if(!validRequest(body))return send(400,{error:'Invalid scene or action.'});
      if(!['art','people-batch'].includes(body.context.mode)){await acquire();slot=true;}
      delete require.cache[__filename];
      // A game turn can be streamed: lines of {narration} while it is written, then {reply} (or {error}).
      const live=body.stream===true&&!['art','adventure','character','diagnostics','people-batch'].includes(body.context.mode);
      if(!live){const reply=await require(__filename).generate(body,{apiKey,model,storyModel,reasoning,storyReasoning,fetchImpl});send(200,reply);}
      else{
        let started=false;const start=()=>{if(started)return;started=true;res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});};
        try{const reply=await require(__filename).generate(body,{apiKey,model,storyModel,reasoning,storyReasoning,fetchImpl,onNarration:text=>{start();res.write(JSON.stringify({narration:text})+'\n');}});if(!started)send(200,reply);else res.end(JSON.stringify({reply})+'\n');}
        catch(e){if(!started)throw e;res.end(JSON.stringify({error:e.name==='TimeoutError'?'The AI timed out. Your adventure is unchanged.':e.message})+'\n');}
      }
    }catch(e){send(e.httpStatus??502,{error:e.name==='TimeoutError'?'The AI timed out. Your adventure is unchanged.':e.message});}finally{if(slot)release();}
  });
}
if(require.main===module){const port=Number(process.env.QUESTBOUND_DM_PORT??8083);createServer().listen(port,'127.0.0.1',()=>console.log('Questbound DM server ready on localhost:'+port+'. Live AI '+(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL?'configured: '+process.env.OPENAI_MODEL+(process.env.OPENAI_STORY_MODEL&&process.env.OPENAI_STORY_MODEL!==process.env.OPENAI_MODEL?' for play, '+process.env.OPENAI_STORY_MODEL+' for stories and heroes.':'.'):'not configured.')));}
module.exports={standingPrompt,heroPrompt,replySchemaFor,asFields,flatReply,cacheKeyFor,promptLayout,sceneParts,sceneMessages,turnRequest,requestParts,requestScene,phaseFields,hostJobOf,recordCreatureMiss,castFor,peopleToMeetFor,portraitsTaken,pooledIntroduce,introduceSchema,loadPeople,recordWriteFailure,cleanRemember,memoryInstructions,typedByPlayer,startLibrary,topUpLibrary,libraryPaused,journeyCheck,unusable,transient,tellingCut,castableSpell,castWords,distinctDialogue,echoes,turnEffort,storyEffort,questInstructions,liveModels,chosenModel,createServer,generate,validRequest,validRuling,checkedHp,partialNarration,streamedText,sceneFor,repairedDiscovery,repairedCreature,repairedIntroduce,repairedJson,replyShape,contractInstructions};
