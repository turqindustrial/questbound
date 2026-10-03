const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// People anywhere: the Dungeon Master brings named characters into the story wherever the player goes. They live
// where they were met, speak with their own name and portrait, remember the player, can be tied to someone already
// known, recruited, healed and fought (and their deaths matter to those tied to them), and are kept in saves.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmCommand,dmContext,dmChoices,validAdventure,adventureSnapshot,npcScene,introducePerson,canMeetPeople,recruitmentTargets,resolveRecruitment,conversationPeople,conversationTarget,recordedTurn,npcArtSubject,quickActions})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const kara=r.readyHero('fighter'),hp={current:12,temp:0};
const valid=(g,h=null)=>r.validAdventure(r.adventureSnapshot(kara,JSON.parse(JSON.stringify(g)),h,true),kara);
let g={...r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0),stage:'inn'};delete g.openingAttackAvailable;
// Out to a river crossing.
g=r.adventureStep(g,hp,kara,{type:'discover',place:{name:'Greywater Ford',description:'A wide, shallow ford where a rope ferry crosses the black river.',kind:'water',bearing:'W',miles:2,danger:'safe'},travel:true},()=>0.5).game;
assert.equal(g.stage,'wild');
const hob={name:'Hob Tallow',species:'Human',role:'The old ferryman of Greywater Ford.',appearance:'A stooped old man with a white beard, a tarred coat and hands like knotted rope.',personality:'Gruff and slow to trust; counts every copper twice.',toughness:'frail',attitude:'indifferent',foe:'neutral',tie:null};
assert.ok(r.dmContext(kara,g,hp).world.canIntroduce,'Someone can be met out here');
// ---- Met with the Dungeon Master's reply; their line is theirs ----
const meet=r.commitDmTurn(kara,g,hp,null,{question:'I hail the ferryman.',narration:'An old man poles his raft to the bank.',dialogue:[{speakerId:'new',text:'Crossing costs a copper. Two if you talk.'}],introduce:hob});
assert.equal(meet.error,undefined);assert.equal(meet.introduced,'n1');same(meet.conversation.dialogue[0].speakerId,'n1');
const turn=r.recordedTurn(kara,g,hp,meet,meet.conversation,null);
assert.ok(turn.game.playback.at(-1).events.some(e=>e.kind==='dialogue'&&e.speakerName==='Hob Tallow'&&e.speakerId==='n1'),'The new person speaks under their own name');
g=turn.game;assert.ok(valid(g,hp));
assert.equal(g.people.n1.home,'p1');assert.ok(r.conversationPeople(g).some(n=>n.id==='n1'&&n.name==='Hob Tallow'&&n.role==='The old ferryman of Greywater Ford.'));
assert.equal(r.conversationTarget(g,'Hob, how deep is the water?'),'n1');
const art=r.npcArtSubject(g,'n1');assert.equal(art.kind,'portrait');assert.equal(art.name,'Hob Tallow');assert.match(art.description,/tarred coat/);
assert.ok(g.journal.entries.some(e=>e.title==='Met: Hob Tallow'),'The journal notes who you met');
// His daughter, tied to him; meeting him again elsewhere is the same man, not a double.
g=r.commitDmTurn(kara,g,hp,null,{question:'Who is that?',narration:'A young woman mends nets.',introduce:{...hob,name:'Edda Reed',role:'Hob\'s daughter, who keeps the ferry ropes.',appearance:'A broad-shouldered young woman with tar-stained hands and a red headscarf.',toughness:'common',attitude:'friendly',tie:{to:'n1',kind:'family'}}}).game;
assert.equal(g.npcMemory.n2.attitude,'friendly');
const again=r.introducePerson(g,hob);assert.equal(again.id,'n1');assert.equal(Object.keys(again.game.people).length,2);
// The context the Dungeon Master sees: who is here, where people live, and their ties.
const ctx=r.dmContext(kara,g,hp);
assert.ok(ctx.nearbyNPCs.some(n=>n.id==='n2'&&n.name==='Edda Reed'&&/red headscarf/.test(n.appearance)));
const edda=ctx.npcSocialState.find(n=>n.id==='n2');assert.equal(edda.livesAt,'Greywater Ford');same(edda.ties.all.map(t=>[t.id,t.kind]),[['n1','family']]);
assert.ok(ctx.npcDefenses.n1&&ctx.npcHP.n1===4);
// Names: a surname two people share names neither; first names and full names work.
assert.equal(r.dmCommand(kara,g,'I attack Reed',hp)?.action?.target,undefined);
same(r.dmCommand(kara,g,'I attack Edda',hp).action,{type:'npc-attack',target:'n2',weapon:'Greatsword'});
// ---- Violence out in the wilds: a killing, a fight with those who cared, and a retreat the way you came ----
assert.ok(r.dmChoices(kara,g).some(c=>c.id==='npc-attack:n1:Greatsword'),'People anywhere can be attacked');
const blow=r.adventureStep(g,hp,kara,{type:'npc-attack',target:'n1',weapon:'Greatsword'},()=>0.5);
assert.equal(blow.error,undefined);assert.equal(blow.game.npcFate.n1,'dead');
assert.match(blow.game.npcMemory.n2.grudge,/killed Hob Tallow, my family/);
assert.equal(blow.game.npcCombat.active,true);same(blow.game.npcCombat.order.map(n=>n.id).sort(),['n2','player']);
assert.ok(valid(blow.game,blow.health),'A fight at a found place saves');
const fled=r.adventureStep(blow.game,blow.health,kara,'npc-flee',()=>0.5);
assert.equal(fled.error,undefined);assert.equal(fled.game.stage,'inn');assert.equal(fled.game.npcCombat,undefined);assert.ok(valid(fled.game,fled.health));
g=fled.game;
assert.ok(!r.npcScene(g).find(n=>n.id==='n2').present,'Edda stays at the ford');
// Word reaches those tied to the dead: someone met later already hates you.
const sister=r.introducePerson(g,{...hob,name:'Marta Tallow',role:'Hob\'s sister, a cook at the camp.',appearance:'A thin grey-haired woman with flour on her sleeves.',toughness:'frail',tie:{to:'n1',kind:'family'}});
assert.ok(sister.lines.includes('Marta Tallow will never forgive you.'));assert.equal(sister.game.npcMemory.n3.attitude,'hostile');
g=sister.game;
// ---- A sellsword joins; companions are capped at three ----
g=r.introducePerson(g,{...hob,name:'Brannoc Vey',role:'A sellsword resting at the camp.',appearance:'A tall scarred man in a dented breastplate with a notched longsword.',toughness:'tough',attitude:'friendly',foe:'enemy'}).game;
same(r.recruitmentTargets(g,'Brannoc, will you join me?'),['n4']);
const hired=r.resolveRecruitment(kara,g,hp,[{npcId:'n4',decision:'join',reason:'He wants the coin.',terms:'A share of any reward.',dc:null}],'Brannoc, will you join me?',null,()=>0.5);
assert.equal(hired.error,undefined);assert.equal(hired.game.followers.n4.status,'following');g=hired.game;
const walk=r.adventureStep(g,hp,kara,{type:'travel',destination:'p1'},()=>0.5).game;
assert.ok(r.npcScene(walk).find(n=>n.id==='n4').present,'A companion met later travels with you');assert.ok(valid(walk));
const full={...g,followers:{...g.followers,mara:{status:'following',location:'inn',reason:'x',terms:''},keeper:{status:'following',location:'inn',reason:'x',terms:''}}};
const fourth=r.introducePerson(full,{...hob,name:'Ilse Marr',role:'A camp guard.',appearance:'A stocky woman in a leather jack with a spear.',toughness:'tough',attitude:'friendly'});
const crowded=r.resolveRecruitment(kara,fourth.game,hp,[{npcId:'n5',decision:'join',reason:'Why not.',terms:'',dc:null}],'Ilse, join me?',null,()=>0.5);
assert.equal(crowded.game.followers.n5,undefined);assert.ok(crowded.events.some(t=>/already travel with 3 companions/.test(t)));
// ---- Healing a stranger ----
const hurt={...g,npcHP:{...g.npcHP,n4:5}};
assert.ok(r.dmChoices(kara,hurt).some(c=>c.id==='give-potion:n4'));
const dosed=r.adventureStep(hurt,hp,kara,{type:'give-potion',target:'n4'},()=>0.5);assert.equal(dosed.error,undefined);assert.ok(dosed.game.npcHP.n4>5);
// ---- Limits: three living people per place, twelve in a region ----
let crowd=r.adventureStep(g,hp,kara,{type:'travel',destination:'p1'},()=>0.5).game;
crowd=r.introducePerson(crowd,{...hob,name:'Rook',role:'A fisher boy.',appearance:'A barefoot boy with a willow rod.'}).game;
crowd=r.introducePerson(crowd,{...hob,name:'Ansel Brigg',role:'A drover.',appearance:'A ruddy man leading two oxen.'}).game;
assert.ok(!r.canMeetPeople(crowd),'Edda, Rook and Ansel live here (Hob is dead)');
assert.match(r.introducePerson(crowd,{...hob,name:'Someone Else',role:'A traveller.',appearance:'A cloaked figure with a staff.'}).error,/as many named people/);
// ---- The foe's name, a broken description, and tampered saves are refused ----
assert.match(r.introducePerson(g,{...hob,name:g.story.foe}).error,/foe/);
assert.match(r.introducePerson(g,{...hob,name:'Nobody',tie:{to:'n9',kind:'family'}}).error,/does not know/);
assert.match(r.introducePerson(g,{...hob,name:'X'}).error,/could not use/);
assert.ok(!valid({...g,people:{...g.people,n1:{...g.people.n1,home:'nowhere'}}}));
assert.ok(!valid({...g,people:{...g.people,n7:{...g.people.n1,name:'Hob Tallow'}}}),'Two people never share a name');
assert.ok(!valid({...g,npcHP:{...g.npcHP,n4:99}}));
// ---- The Dungeon Master server ----
const {generate}=require('./dm-server.cjs');
let lastRequest=null;
const reply=extra=>async(url,options)=>{lastRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,...extra})}]}]})};};
const keys={apiKey:'test-only',model:'test-model'},social=[{id:'keeper',name:'Captain Oona Brask'},{id:'mara',name:'Tobin Reed'},{id:'n1',name:'Hob Tallow'}];
const body=(world,extra={})=>({input:'I hail the ferryman.',context:{choices:[{id:'travel-inn',label:'Travel'}],story:{foe:'Bandit Cutthroat'},npcSocialState:social,conversationParticipants:[],world,...extra}});
(async()=>{
 const met=await generate(body({canIntroduce:true}),{...keys,fetchImpl:reply({narration:'An old man waves.',introduce:hob,dialogue:[{speakerId:'new',text:'A copper to cross.'}]})});
 assert.equal(met.introduce.name,'Hob Tallow');same(met.dialogue.map(l=>l.speakerId),['new']);
 same(lastRequest.text.format.schema.properties.introduce.properties.tie.properties.to.enum,['keeper','mara','n1']);
 assert.ok(lastRequest.text.format.schema.properties.dialogue.items.properties.speakerId.enum.includes('new'));
 assert.ok(lastRequest.instructions.includes('PEOPLE ANYWHERE'));
 // Not allowed here: no schema, and a stray introduction (with its lines) is dropped.
 const shut=await generate(body({canIntroduce:false}),{...keys,fetchImpl:reply({narration:'A man waves.',introduce:hob,dialogue:[{speakerId:'new',text:'Hi.'}]})});
 assert.equal(shut.introduce,null);same(shut.dialogue,[]);assert.equal(lastRequest.text.format.schema.properties.introduce.type,'null');
 // Never alongside another game action; never tied to someone unknown; relationships can name anyone known.
 assert.equal((await generate(body({canIntroduce:true}),{...keys,fetchImpl:reply({narration:'You go.',actionId:'travel-inn',introduce:hob})})).introduce,null);
 const untied=(await generate(body({canIntroduce:true}),{...keys,fetchImpl:reply({narration:'x',introduce:{...hob,tie:{to:'n9',kind:'family'}}})})).introduce;assert.equal(untied.name,'Hob Tallow');assert.equal(untied.tie,null,'A tie to nobody known is dropped, the person kept');
 const noted=await generate(body({canIntroduce:false}),{...keys,fetchImpl:reply({narration:'He nods.',relationships:[{npcId:'n1',change:'pleased',memory:'The player paid the toll without haggling.'}]})});
 assert.equal(noted.relationships[0].npcId,'n1');same(lastRequest.text.format.schema.properties.relationships.items.properties.npcId.enum,['keeper','mara','n1']);
 // Present people speak by their ids.
 await generate(body({canIntroduce:false},{conversationParticipants:[{id:'n1',name:'Hob Tallow'}]}),{...keys,fetchImpl:reply({narration:'x',dialogue:[{speakerId:'n1',text:'Aye.'}]})});
 assert.ok(lastRequest.text.format.schema.properties.dialogue.items.properties.speakerId.enum.includes('n1'));
 console.log('Passed: people met anywhere (with their own voice, portrait, home and ties), named in commands, fought where they live (killings remembered by kin, even kin met later), recruited, healed, capped per place and region, kept in saves, and offered to the Dungeon Master only when they can be met.');
})().catch(e=>{console.error(e);process.exit(1);});
