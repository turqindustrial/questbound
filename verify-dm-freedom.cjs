const assert=require('node:assert/strict');
const {generate}=require('./dm-server.cjs');
const {requestParts,requestScene}=require('./dm-server.cjs');
// The Dungeon Master server: spells must be named (nicknames allowed), new places are revealed only when the player
// is free to set out, and the instructions cover attack wording, precise deaths, brutality and exploration.
let lastRequest=null;
const success=reply=>async(url,options)=>{lastRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dialogue:[],recruitment:[],actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,...reply})}]}]})};};
const keys={apiKey:'test-only',model:'test-model'};
const spells=[{name:'Fire Bolt'},{name:'Magic Missile'},{name:'Shield'}];
const story={foe:'Bandit Cutthroat',foeSpecies:'Human',npcs:{keeper:{name:'Captain Oona Brask'},mara:{name:'Tobin Reed'}}};
const body=(input,extra={})=>({input,context:{choices:[],spellReference:spells,story,...extra}});
(async()=>{
 // An unnamed cast becomes a question; nothing is cast.
 for(const input of ['I cast a spell at the bandit.','I use magic on him!','Cast something at it','I hit the bandit with magic']){
  const reply=await generate(body(input),{...keys,fetchImpl:success({narration:'Fire leaps from your hand.',castCommand:'I cast Fire Bolt at the Bandit Cutthroat'})});
  assert.equal(reply.castCommand,null,input);assert.match(reply.narration,/^Which spell do you cast\? Name it — for example Fire Bolt, Magic Missile, Shield\.$/);
 }
 // Named, nicknamed or misspelled spells go through as the DM normalised them.
 for(const input of ['I cast Fire Bolt at the bandit','FB him','missiles at Tobin','I cast fyre bolt at it','zap him with sparks']){
  const reply=await generate(body(input),{...keys,fetchImpl:success({narration:'Fire leaps.',castCommand:'I cast Fire Bolt at the Bandit Cutthroat'})});
  assert.equal(reply.castCommand,'I cast Fire Bolt at the Bandit Cutthroat',input);
 }
 // A new place: allowed only when the client says the player can set out; miles are kept in range.
 const ridge={name:'Thornback Ridge',description:'A spine of wind-scoured rock above the road.',kind:'mountain',bearing:'N',miles:30,travel:true};
 const free=body('I head for the hills to the north.',{world:{canDiscover:true}});
 const found=await generate(free,{...keys,fetchImpl:success({narration:'You climb toward the ridge.',discovery:ridge})});
 assert.equal(found.discovery.name,'Thornback Ridge');assert.equal(found.discovery.miles,12);
 assert.equal(require('./dm-schemas.cjs').asFields(lastRequest.text.format.schema).properties.discovery.type[0],'object');assert.ok(require('./dm-schemas.cjs').asFields(lastRequest.text.format.schema).required.includes('discovery'));
 // A place the map cannot take now is never added (the stories spec, Phase A9, 2026-10-22). One seen or heard of (travel
 // false) is left out at once, never asked again, and kept as words; a known place named as new, with its journey on
 // offer, is that journey. One the telling walks the hero to (travel true) would say they arrived where the game never
 // moved them (the project review, 2026-10-22): it is asked again once with the reason, then the way is told shut; in a
 // fight nothing is kept as words.
 {let n=0;const seen={...ridge,travel:false},once=async(u,o)=>{n++;return success({narration:'Far to the north a ridge breaks the sky.',discovery:seen})(u,o);};const left=await generate(body('I look north.',{world:{canDiscover:false}}),{...keys,fetchImpl:once});
  assert.equal(left.discovery,null,'a place the map could not use is never added');assert.equal(n,1,'and the reply is not asked for again');assert.match(left.worldEvent,/^Thornback Ridge, to the north: A spine of wind-scoured rock/,'kept as words');
  n=0;const walked=async(u,o)=>{n++;return success(n===1?{narration:'You climb to Thornback Ridge.',discovery:ridge}:{narration:'Fog rolls down the slope; the climb will have to wait.'})(u,o);};const asked=await generate(body('I head north.',{world:{canDiscover:false}}),{...keys,fetchImpl:walked});
  assert.equal(n,2,'a journey the map cannot take is asked again once');assert.match(requestParts(lastRequest).tail??'',/new place the map cannot take now/,'with the reason');assert.equal(asked.narration,'Fog rolls down the slope; the climb will have to wait.');assert.equal(asked.discovery,null);
  n=0;const stubborn=async(u,o)=>{n++;return success({narration:'You tear free of the wolf and scramble up to Thornback Ridge.',discovery:ridge})(u,o);};const shut=await generate(body('I break away and run north up the ridge.',{stage:'combat',encounter:{name:'Dire Wolf'},world:{canDiscover:false}}),{...keys,fetchImpl:stubborn});
  assert.equal(n,2,'asked again once only');assert.equal(shut.narration,'There is no breaking away toward Thornback Ridge while the fight goes on.','the way told shut');assert.equal(shut.worldEvent,null,'never kept as words in a fight');assert.equal(shut.discovery,null);
  const calm=await generate(body('I head north.',{world:{canDiscover:false}}),{...keys,fetchImpl:success({narration:'You climb to Thornback Ridge.',discovery:ridge})});assert.equal(calm.narration,'The way to Thornback Ridge is not open to you just yet.');
  const back=await generate(body('I go back to Lookout Rock.',{world:{canDiscover:false,knownPlaces:[{id:'tower',name:'Lookout Rock',kind:'landmark',visited:true}]},choices:[{id:'travel-tower',label:'Travel to Lookout Rock'}]}),{...keys,fetchImpl:success({narration:'You head back.',discovery:{...ridge,name:'Lookout Rock'}})});
  assert.equal(back.discovery,null);assert.equal(back.actionId,'travel-tower','a known place named as new is the journey there');
  // Words the map does not use are read as its own: a kind, a bearing and a land in other words; a creature it cannot run leaves a risky place.
  const {repairedDiscovery,validDiscovery}=require('./dm-replies.cjs'),mended=repairedDiscovery({name:'Grey Keep',description:'Old.',kind:'castle',bearing:'north-east',miles:'4',travel:'true',danger:'deadly',feature:null,lair:{template:'dragon',name:'Ash',appearance:'A wyrm.'},region:{name:'The Ash Coast',terrain:'sea'}});
  assert.ok(validDiscovery(mended),JSON.stringify(mended));assert.equal(mended.kind,'settlement');assert.equal(mended.bearing,'NE');assert.equal(mended.miles,4);assert.equal(mended.travel,true);assert.equal(mended.danger,'risky');assert.equal(mended.lair,null);assert.deepEqual(mended.region,{name:'The Ash Coast',terrain:'coast'});assert.ok(mended.description.startsWith('Grey Keep, a settlement'));}
 {await generate(free,{...keys,fetchImpl:success({narration:'You go.'})});const freeSchema=JSON.stringify(lastRequest.text.format.schema);await generate(body('I head north.',{world:{canDiscover:false}}),{...keys,fetchImpl:success({narration:'Not yet.'})});assert.equal(JSON.stringify(lastRequest.text.format.schema),freeSchema,'the schema is the same whether or not the player may set out (it is cached); the map refuses the place instead (above)');}
 {const told=await generate({...free,context:{...free.context,engineResolved:['You travel to Thornback Ridge.']}},{...keys,fetchImpl:success({narration:'You arrive.',discovery:ridge})});assert.equal(told.discovery,null,'Narrating a resolved turn reveals nothing');assert.equal(told.narration,'You arrive.');assert.equal(JSON.stringify(lastRequest.text.format.schema),JSON.stringify(require('./dm-server.cjs').replySchemaFor()),'the one schema, the same for every phase');}
 // One game action per reply: when two arrive together the first is kept and the other dropped, not the whole reply.
 const look={skill:null,ability:'Wisdom',dc:10,mode:'normal',reason:'Look',success:'Yes',failure:'No',damageCount:0,damageDie:6,damageOn:'none'};
 const both=await generate(free,{...keys,fetchImpl:success({narration:'Both.',discovery:ridge,check:look})});assert.equal(both.discovery.name,'Thornback Ridge');assert.equal(both.check,null,'The journey is kept, the check dropped');
 const walk=await generate({...free,context:{...free.context,choices:[{id:'travel-tower',label:'Travel to Lookout Rock'}]}},{...keys,fetchImpl:success({narration:'You go.',actionId:'travel-tower',check:look,discovery:ridge})});assert.equal(walk.actionId,'travel-tower');assert.equal(walk.check,null);assert.equal(walk.discovery,null);
 assert.match(requestParts(lastRequest).instructions,/WHAT IS TRUE NOW:/);assert.match(requestParts(lastRequest).instructions,/never invent an obstacle/);
 assert.equal((await generate(free,{...keys,fetchImpl:success({narration:'Odd.',discovery:{...ridge,kind:'castle'}})})).discovery.kind,'settlement','a kind in other words is read as the map\'s own');
 // The standing prompt's dampers, reworded (the stories spec, Phase A2, 2026-10-22): the law, the grieving and the vengeful
 // arrive as people, what waits at a place may answer on arrival, failure moves the scene, and every reply moves something.
 {const p=requestParts(lastRequest).instructions;assert.ok(!p.includes('Never conjure guards'),'the old damper is gone');
  for(const part of ['Never claim a fight, damage, initiative or movement the engine has not resolved; the law, the grieving and the vengeful arrive as people (introduce), who can be talked to, fled from or fought.','what waits there may still answer them on arrival.','the failure text changes the situation (the thing found at a cost in time, trust, noise or position, or a worse way; never gold, items, harm the dice did not deal or someone new), never "nothing happens"','PLAY TO FIND OUT (ordinary turns): every reply moves something','who could have learned of it act between scenes','Looking closely finds something specific, unless nothing is there.','say what they would share; companions speak up (not one on one)','never subtract again; tell how hurt someone is, not the figure.','End most replies on something the player can answer.','a failed search finds no treasure','end with the first step plain unless already taken.','That place cleared: the game closes chapter 1 (its find is told there)'])assert.ok(p.includes(part),'the standing prompt says: '+part);
  assert.ok(!p.includes('(orders, aim or hook)'),'the first turn does not restate the orders');}
 // Danger in the wilds: a lair's creature, a feature, and ambushes only where the player is out in the wilds.
 const widow={template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled.'};
 const den=await generate(free,{...keys,fetchImpl:success({narration:'Silk glints.',discovery:{...ridge,miles:2,danger:'lair',feature:'A satchel under the webs.',lair:widow}})});
 assert.equal(den.discovery.lair.name,'Grey Widow');assert.equal(den.discovery.feature,'A satchel under the webs.');
 assert.equal((await generate(free,{...keys,fetchImpl:success({narration:'x',discovery:{...ridge,danger:'risky',feature:null,lair:widow}})})).discovery.danger,'lair','A place given a creature is a lair');
 const wild=body('I kick the sleeping boar.',{world:{canDiscover:true,canAmbush:true}});
 const sprung=await generate(wild,{...keys,fetchImpl:success({narration:'It wakes.',ambush:{template:'boar',name:'Tusked Brute',appearance:'A boar with tusks like sickles.'}})});
 assert.equal(sprung.ambush.template,'boar');assert.equal(require('./dm-schemas.cjs').asFields(lastRequest.text.format.schema).properties.ambush.type[0],'object');
 assert.equal((await generate(free,{...keys,fetchImpl:success({narration:'x',ambush:widow})})).ambush,null,'No ambush away from the wilds');
 assert.equal((await generate(wild,{...keys,fetchImpl:success({narration:'x',ambush:{...widow,template:'dragon'}})})).ambush,null);
 assert.ok(requestParts(lastRequest).instructions.includes('DANGER IN THE WILDS'));
 // Loot: handed over with the narration, never mid-fight, never more gold than the hero has.
 const shop=body('I buy a healing potion from the captain.',{stage:'inn',inventory:{gold:60},player:{level:1}});
 const potionBuy={gold:-50,items:[{name:'Potion of Healing',kind:'potion',qty:1,value:0}],reason:'Bought from the captain.'};
 assert.equal((await generate(shop,{...keys,fetchImpl:success({narration:'She hands it over.',loot:potionBuy})})).loot.gold,-50);
 await assert.rejects(generate(shop,{...keys,fetchImpl:success({narration:'x',loot:{...potionBuy,gold:-80}})}),/enough gold/);
 assert.equal((await generate({...shop,context:{...shop.context,choices:[{id:'travel-inn',label:'Travel'}]}},{...keys,fetchImpl:success({narration:'You go.',actionId:'travel-inn',loot:potionBuy})})).loot,null,'Loot waits for the narration of an action');
 assert.equal((await generate(body('I loot it.',{stage:'combat',inventory:{gold:60}}),{...keys,fetchImpl:success({narration:'Not now.',loot:potionBuy})})).loot,null,'No loot mid-fight');
 assert.ok(requestParts(lastRequest).instructions.includes('LOOT AND TRADE'));
{// Spoils and magic (lootRules.js): the schema knows armor and magic ids; the engine's own search is never doubled;
 // gold over the level's most is cut to it (not dropped); magic only rewards a chapter or a lead, within the level.
  const chest=body('I search the chest.',{stage:'inn',inventory:{gold:10},player:{level:1}});
 await generate(chest,{...keys,fetchImpl:success({narration:'You open it.'})});
 const itemSchema=require('./dm-schemas.cjs').asFields(lastRequest.text.format.schema).properties.loot.anyOf?.[0]??require('./dm-schemas.cjs').asFields(lastRequest.text.format.schema).properties.loot;
 assert.ok(itemSchema.properties.items.items.properties.kind.enum.includes('armor'),'armor is a kind');assert.ok(itemSchema.properties.items.items.properties.magic.enum.includes('cloak-of-protection')&&itemSchema.properties.items.items.required.includes('magic'),'magic is an id from the catalogue');
 assert.ok(requestParts(lastRequest).instructions.includes('SPOILS: context.spoils')&&requestParts(lastRequest).instructions.includes('MAGIC REWARDS'));
 const hoard={gold:150,items:[{name:'Silver chalice',kind:'treasure',qty:1,value:25,note:'A dented cup.',magic:null}],reason:'Found in the chest.'};
 const clamped=await generate(chest,{...keys,fetchImpl:success({narration:'Coins spill out.',loot:hoard})});assert.equal(clamped.loot.gold,100,'gold over the cap is cut to the most a level-1 hero may find, not dropped');assert.equal(clamped.loot.items.length,1);
 const searched=body('I search the bandit.',{stage:'victory',inventory:{gold:10},player:{level:1},engineResolved:['You search the Bandit Cutthroat.','Found: 9 gold, Scimitar.']});
 assert.equal((await generate(searched,{...keys,fetchImpl:success({narration:'You find 9 gold and a scimitar.',loot:{gold:9,items:[],reason:'Searched.'}})})).loot,null,'the engine\'s search is never doubled');
 const wonFight=body('I finish it.',{stage:'victory',inventory:{gold:10},player:{level:1},engineResolved:['The Bandit Cutthroat is slain.']});
 assert.equal((await generate(wonFight,{...keys,fetchImpl:success({narration:'It falls.',loot:{gold:9,items:[],reason:'Searched.'}})})).loot,null,'no loot of its own on the turn a fight is won');
 const cloak={gold:0,items:[{name:'Grey Mantle',kind:'gear',qty:1,value:0,note:'A grey cloak.',magic:'cloak-of-protection'}],reason:'The reward.'};
 assert.equal((await generate(chest,{...keys,fetchImpl:success({narration:'A cloak lies inside.',loot:cloak})})).loot.items[0].magic,null,'no magic outside a chapter or lead reward');
 const reward=body('I take the reward.',{stage:'inn',inventory:{gold:10},player:{level:1},engineResolved:['Lead seen through: The Copyist\'s Debt.']});
 assert.equal((await generate(reward,{...keys,fetchImpl:success({narration:'She gives you her cloak.',loot:cloak})})).loot.items[0].magic,'cloak-of-protection','a lead\'s reward may be magic');
 const ring={...cloak,items:[{...cloak.items[0],name:'Iron Ring',magic:'ring-of-protection'}]};
 assert.equal((await generate(reward,{...keys,fetchImpl:success({narration:'A ring.',loot:ring})})).loot.items[0].magic,null,'no rarer than the level allows');
 assert.equal((await generate({...reward,context:{...reward.context,player:{level:5}}},{...keys,fetchImpl:success({narration:'A ring.',loot:ring})})).loot.items[0].magic,'ring-of-protection');}
 // Relationship notes: kept on an ordinary turn or when narrating a resolved one; dropped when the turn starts an
 // action (recorded when it is narrated), for the dead, and for scene cues.
 const note={npcId:'mara',change:'grateful',memory:'The player shared their last rations with me.'};
 const kept=await generate(body('I give Tobin my rations.'),{...keys,fetchImpl:success({narration:'He thanks you.',relationships:[note]})});assert.equal(kept.relationships[0].change,'grateful');
 const narrated=await generate(body('x',{engineResolved:['Cure Wounds on Tobin Reed: restored 8 HP.']}),{...keys,fetchImpl:success({narration:'He stirs.',relationships:[{...note,change:'bond'}]})});assert.equal(narrated.relationships[0].change,'bond');
 const acting=await generate(body('I travel on.',{choices:[{id:'travel-inn',label:'Travel'}]}),{...keys,fetchImpl:success({narration:'You go.',actionId:'travel-inn',relationships:[note]})});assert.equal(acting.relationships.length,0);
 const ghost=await generate(body('I mourn him.',{npcFates:{mara:'dead'}}),{...keys,fetchImpl:success({narration:'Silence.',relationships:[note]})});assert.equal(ghost.relationships.length,0);
 assert.deepEqual((await generate(body('x',{sceneTrigger:{id:'wake',cue:'They wake.'},conversationParticipants:[{id:'mara',name:'Tobin Reed'}]}),{...keys,fetchImpl:success({narration:'He speaks.',relationships:[note]})})).relationships,[],'no relationship notes on a scene cue');
 assert.ok(requestParts(lastRequest).instructions.includes('MEMORY AND RELATIONSHIPS'));
 // The instructions carry the new rules.
 const instructions=requestParts(lastRequest).instructions;
 for(const part of ['ATTACKS:','Unarmed Strike','attackOptions.mainWeapon','SPELLS MUST BE NAMED','nickname','KILLING AND DEATH','describe that death precisely','storyPreferences.brutality','restrained','gritty','brutal','OPEN WORLD','context.world.canDiscover'])assert.ok(instructions.includes(part),part);
 console.log('Passed: unnamed casts become a question, nicknames and misspellings pass, discovery gated and bounded, one action per reply, and attack/death/brutality/open-world instructions present.');
})().catch(e=>{console.error(e);process.exit(1);});
