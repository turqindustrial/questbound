const assert=require('node:assert/strict');
const {generate}=require('./dm-server.cjs');
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
 assert.equal(lastRequest.text.format.schema.properties.discovery.type[0],'object');assert.ok(lastRequest.text.format.schema.required.includes('discovery'));
 await assert.rejects(generate(body('I head north.',{world:{canDiscover:false}}),{...keys,fetchImpl:success({narration:'You climb.',discovery:ridge})}),/new place the map could not use/);
 await generate(body('I head north.',{world:{canDiscover:false}}),{...keys,fetchImpl:success({narration:'Not yet.'})});assert.equal(lastRequest.text.format.schema.properties.discovery.type,'null','No new places while the player is not free to travel');
 await generate({...free,context:{...free.context,engineResolved:['You travel to Thornback Ridge.']}},{...keys,fetchImpl:success({narration:'You arrive.'})});assert.equal(lastRequest.text.format.schema.properties.discovery.type,'null','Narrating a resolved turn reveals nothing');
 await assert.rejects(generate(free,{...keys,fetchImpl:success({narration:'Both.',discovery:ridge,check:{skill:null,ability:'Wisdom',dc:10,mode:'normal',reason:'Look',success:'Yes',failure:'No',damageCount:0,damageDie:6,damageOn:'none'}})}),/invalid ruling/,'One mechanical action at a time');
 await assert.rejects(generate(free,{...keys,fetchImpl:success({narration:'Odd.',discovery:{...ridge,kind:'castle'}})}),/new place the map could not use/);
 // Danger in the wilds: a lair's creature, a feature, and ambushes only where the player is out in the wilds.
 const widow={template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled.'};
 const den=await generate(free,{...keys,fetchImpl:success({narration:'Silk glints.',discovery:{...ridge,miles:2,danger:'lair',feature:'A satchel under the webs.',lair:widow}})});
 assert.equal(den.discovery.lair.name,'Grey Widow');assert.equal(den.discovery.feature,'A satchel under the webs.');
 assert.equal((await generate(free,{...keys,fetchImpl:success({narration:'x',discovery:{...ridge,danger:'risky',feature:null,lair:widow}})})).discovery.danger,'lair','A place given a creature is a lair');
 const wild=body('I kick the sleeping boar.',{world:{canDiscover:true,canAmbush:true}});
 const sprung=await generate(wild,{...keys,fetchImpl:success({narration:'It wakes.',ambush:{template:'boar',name:'Tusked Brute',appearance:'A boar with tusks like sickles.'}})});
 assert.equal(sprung.ambush.template,'boar');assert.equal(lastRequest.text.format.schema.properties.ambush.type[0],'object');
 await assert.rejects(generate(free,{...keys,fetchImpl:success({narration:'x',ambush:widow})}),/could not use/,'No ambush away from the wilds');
 await assert.rejects(generate(wild,{...keys,fetchImpl:success({narration:'x',ambush:{...widow,template:'dragon'}})}));
 assert.ok(lastRequest.instructions.includes('DANGER IN THE WILDS'));
 // Loot: handed over with the narration, never mid-fight, never more gold than the hero has.
 const shop=body('I buy a healing potion from the captain.',{stage:'inn',inventory:{gold:60},player:{level:1}});
 const potionBuy={gold:-50,items:[{name:'Potion of Healing',kind:'potion',qty:1,value:0}],reason:'Bought from the captain.'};
 assert.equal((await generate(shop,{...keys,fetchImpl:success({narration:'She hands it over.',loot:potionBuy})})).loot.gold,-50);
 await assert.rejects(generate(shop,{...keys,fetchImpl:success({narration:'x',loot:{...potionBuy,gold:-80}})}),/enough gold/);
 assert.equal((await generate({...shop,context:{...shop.context,choices:[{id:'travel-inn',label:'Travel'}]}},{...keys,fetchImpl:success({narration:'You go.',actionId:'travel-inn',loot:potionBuy})})).loot,null,'Loot waits for the narration of an action');
 await generate(body('I loot it.',{stage:'combat',inventory:{gold:60}}),{...keys,fetchImpl:success({narration:'Not now.'})});assert.equal(lastRequest.text.format.schema.properties.loot.type,'null','No loot mid-fight');
 assert.ok(lastRequest.instructions.includes('LOOT AND TRADE'));
 // Relationship notes: kept on an ordinary turn or when narrating a resolved one; dropped when the turn starts an
 // action (recorded when it is narrated), for the dead, and for scene cues.
 const note={npcId:'mara',change:'grateful',memory:'The player shared their last rations with me.'};
 const kept=await generate(body('I give Tobin my rations.'),{...keys,fetchImpl:success({narration:'He thanks you.',relationships:[note]})});assert.equal(kept.relationships[0].change,'grateful');
 const narrated=await generate(body('x',{engineResolved:['Cure Wounds on Tobin Reed: restored 8 HP.']}),{...keys,fetchImpl:success({narration:'He stirs.',relationships:[{...note,change:'bond'}]})});assert.equal(narrated.relationships[0].change,'bond');
 const acting=await generate(body('I travel on.',{choices:[{id:'travel-inn',label:'Travel'}]}),{...keys,fetchImpl:success({narration:'You go.',actionId:'travel-inn',relationships:[note]})});assert.equal(acting.relationships.length,0);
 const ghost=await generate(body('I mourn him.',{npcFates:{mara:'dead'}}),{...keys,fetchImpl:success({narration:'Silence.',relationships:[note]})});assert.equal(ghost.relationships.length,0);
 await generate(body('x',{sceneTrigger:{id:'wake',cue:'They wake.'},conversationParticipants:[{id:'mara',name:'Tobin Reed'}]}),{...keys,fetchImpl:success({narration:'He speaks.'})});assert.equal(lastRequest.text.format.schema.properties.relationships.maxItems,0);
 assert.ok(lastRequest.instructions.includes('MEMORY AND RELATIONSHIPS'));
 // The instructions carry the new rules.
 const instructions=lastRequest.instructions;
 for(const part of ['ATTACKS:','Unarmed Strike','attackOptions.mainWeapon','SPELLS MUST BE NAMED','nickname','KILLING AND DEATH','describe that death precisely','storyPreferences.brutality','restrained','gritty','brutal','OPEN WORLD','context.world.canDiscover'])assert.ok(instructions.includes(part),part);
 console.log('Passed: unnamed casts become a question, nicknames and misspellings pass, discovery gated and bounded, one action per reply, and attack/death/brutality/open-world instructions present.');
})().catch(e=>{console.error(e);process.exit(1);});
