const assert=require('node:assert/strict');
const {generate}=require('./dm-server.cjs');
const {generateAdventure}=require('./adventure-generator.cjs');
const {artPrompt,revision}=require('./world-art.cjs');
// What the Dungeon Master and the story writer are asked for, and how their replies are tidied: new lands with
// their own maps, how people take to the hero's kind, who is a woman and who a man (and how a woman is painted),
// and a note saying what each found thing is.
let lastRequest=null;
const success=reply=>async(url,options)=>{lastRequest=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null,...reply})}]}]})};};
const keys={apiKey:'test-only',model:'test-model'};
const story={foe:'Marsh Hag',foeSpecies:'Hag',npcs:{keeper:{name:'Ysolde Fenn'},mara:{name:'Pim Ashdown'}}};
const body=(input,extra={})=>({input,context:{choices:[],story,player:{species:'Tiefling',level:2},npcSocialState:[{id:'keeper'},{id:'mara'}],...extra}});
(async()=>{
 // ---- Far journeys ----
 const port={name:'Port Halloway',description:'A harbour town of tarred sheds and gulls, three days down the coast.',kind:'settlement',bearing:'S',miles:140,travel:true,danger:'safe',feature:null,lair:null};
 const free=body('I take ship south, to wherever the salt goes.',{world:{canDiscover:true,region:{name:'The Brinefold',terrain:'coast'},regions:['The Brinefold']}});
 const far=await generate(free,{...keys,fetchImpl:success({narration:'Three days under sail.',discovery:{...port,region:{name:'  The Halloway Shore  ',terrain:'hills'}}})});
 assert.deepEqual(far.discovery.region,{name:'The Halloway Shore',terrain:'hills'});assert.equal(far.discovery.miles,140,'Days of travel are allowed into a new land');
 const schema=lastRequest.text.format.schema.properties.discovery;assert.ok(schema.required.includes('region'));assert.deepEqual(schema.properties.region.properties.terrain.enum,['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns']);
 assert.match(lastRequest.instructions,/FAR JOURNEYS:/);assert.match(lastRequest.instructions,/miles up to 300/);
 assert.deepEqual(JSON.parse(lastRequest.input).context.world.region,{name:'The Brinefold',terrain:'coast'},'The Dungeon Master is told which land this is');
 const near=await generate(free,{...keys,fetchImpl:success({narration:'You walk.',discovery:{...port,region:null}})});assert.equal(near.discovery.miles,12,'Without a new land, a place is within a day\'s walk');assert.equal(near.discovery.region,null);
 const odd=await generate(free,{...keys,fetchImpl:success({narration:'You walk.',discovery:{...port,region:{name:'Jungle of Sighs',terrain:'jungle'}}})});assert.equal(odd.discovery.region,null,'An unknown terrain is no new land');assert.equal(odd.discovery.miles,12);
 const big=await generate(free,{...keys,fetchImpl:success({narration:'You ride.',discovery:{...port,miles:5000,region:{name:'The Far East',terrain:'desert'}}})});assert.equal(big.discovery.miles,300);
 // ---- People: gender and how they take to the hero's kind ----
 const meet=body('I hail the ferrywoman.',{world:{canIntroduce:true}});
 const person={name:'Old Marta Venn',species:'Human',role:'A ferrywoman at the river crossing.',appearance:'A stooped woman in an oilskin cape with a grey braid.',personality:'Dry and patient.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null};
 const met=await generate(meet,{...keys,fetchImpl:success({narration:'She looks you over.',introduce:{...person,gender:'woman',regard:{stance:'wary',reason:'  A tiefling once cheated her of a season\'s fares.  '}}})});
 assert.equal(met.introduce.gender,'woman');assert.deepEqual(met.introduce.regard,{stance:'wary',reason:'A tiefling once cheated her of a season\'s fares.'});
 const intro=lastRequest.text.format.schema.properties.introduce;assert.ok(intro.required.includes('gender')&&intro.required.includes('regard'));assert.deepEqual(intro.properties.regard.properties.stance.enum,['kin','warm','curious','indifferent','wary','scornful']);
 assert.match(lastRequest.instructions,/KINDS OF PEOPLE:/);assert.match(lastRequest.instructions,/a woman never has a beard/);assert.match(lastRequest.instructions,/Two people in the same room should not react to the same hero in the same way/);
 const loose=await generate(meet,{...keys,fetchImpl:success({narration:'She looks you over.',introduce:{...person,gender:'crone',regard:{stance:'adoring',reason:'x'}}})});
 assert.equal(loose.introduce.gender,'other');assert.equal(loose.introduce.regard,null,'A person is still met when the extras are malformed');assert.equal(loose.introduce.name,'Old Marta Venn');
 const bare=await generate(meet,{...keys,fetchImpl:success({narration:'She looks you over.',introduce:person})});assert.equal(bare.introduce.gender,'other');assert.equal(bare.introduce.regard,null);
 // What is known of each person nearby reaches the model.
 await generate(body('I greet them.',{nearbyNPCs:[{id:'keeper',name:'Ysolde Fenn',regardsYourKind:{stance:'scornful',reason:'Tieflings burned the salt sheds.'}}]}),{...keys,fetchImpl:success({narration:'She does not smile.'})});
 assert.equal(JSON.parse(lastRequest.input).context.nearbyNPCs[0].regardsYourKind.stance,'scornful');
 // ---- Loot: every item comes with a note ----
 const shop=body('I search the wreck.',{inventory:{gold:20},stage:'wild'});
 const haul=await generate(shop,{...keys,fetchImpl:success({narration:'Under the thwart you find a tin and a ring.',loot:{gold:0,items:[{name:'Tin of pitch',kind:'gear',qty:1,value:0,note:'  Shipwright\'s pitch: seals a leak or a seam.  '},{name:'Silver ring',kind:'treasure',qty:1,value:25,note:'x'.repeat(400)},{name:'Wet rope',kind:'gear',qty:1,value:0}],reason:'Searched the wreck.'}})});
 assert.equal(haul.loot.items[0].note,'Shipwright\'s pitch: seals a leak or a seam.');assert.ok(haul.loot.items[1].note.length<=160);assert.equal(haul.loot.items[2].note,'');
 assert.ok(lastRequest.text.format.schema.properties.loot.properties.items.items.required.includes('note'));assert.match(lastRequest.instructions,/note: one short sentence saying what the thing is/);
 // ---- The story writer: a land, a layout, landmarks, and people with gender and regard ----
 const written={title:'T',premise:'P',opening:'O',objective:'J',resolution:'R',secret:'S',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',region:'The Brinefold',terrain:'coast',layout:{bridge:{bearing:'W',miles:1.5},tower:{bearing:'S',miles:.8,from:'inn'}},
  landmarks:[{name:'Tern Ferry',description:'A rope ferry across the estuary.',kind:'water',bearing:'E',miles:2,from:'inn',danger:'safe',feature:'A bell nobody answers.'}],
  locations:{inn:{name:'A',description:'a',kind:'settlement'},bridge:{name:'B',description:'b',kind:'road'},tower:{name:'C',description:'c',kind:'ruin'}},
  npcs:{keeper:{name:'Ivo',species:'Human',gender:'man',role:'r',motive:'m',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',regard:{stance:'wary',reason:'r'},ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera',species:'Elf',gender:'woman',role:'r',motive:'m',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',regard:{stance:'curious',reason:'r'},ties:{other:'friend',foe:'neutral',note:'n'}}}};
 let request=null;const storyFetch=async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:JSON.stringify(written)}]}]})};};
 const made=await generateAdventure({context:{introId:'garden',player:{name:'Vex',species:'Tiefling',class:'Rogue'}}},{apiKey:'k',model:'m',fetchImpl:storyFetch});
 assert.equal(made.story.region,'The Brinefold');assert.equal(made.story.terrain,'coast');assert.equal(made.story.layout.tower.from,'inn');assert.equal(made.story.landmarks.length,1);assert.equal(made.story.npcs.mara.gender,'woman');assert.equal(made.story.npcs.keeper.regard.stance,'wary');
 const s=request.text.format.schema;
 for(const key of ['region','terrain','layout','landmarks'])assert.ok(s.required.includes(key),key+' is asked for');
 assert.deepEqual(s.properties.layout.properties.tower.properties.from.enum,['inn','bridge']);assert.equal(s.properties.landmarks.maxItems,4);assert.ok(!s.properties.landmarks.items.properties.kind.enum.includes('lair'));
 for(const id of ['keeper','mara']){const n=s.properties.npcs.properties[id];assert.ok(n.required.includes('gender')&&n.required.includes('regard')&&n.required.includes('ties'));assert.deepEqual(n.properties.gender.enum,['woman','man','other']);}
 for(const id of ['inn','bridge','tower'])assert.ok(s.properties.locations.properties[id].required.includes('kind'));
 const strict=node=>{if(!node||typeof node!=='object')return;if(node.type==='object'){assert.equal(node.additionalProperties,false);assert.deepEqual([...node.required].sort(),Object.keys(node.properties).sort(),'Every property is required (strict schema)');Object.values(node.properties).forEach(strict);}if(node.items)strict(node.items);};strict(s);
 assert.match(request.instructions,/THE LAND:/);assert.match(request.instructions,/rather than a neat triangle/);assert.match(request.instructions,/A woman never has a beard/);assert.match(request.instructions,/species of the hero \(context\.player\.species\)/);
 assert.equal(JSON.parse(request.input).context.player.species,'Tiefling','The writer is told the hero\'s species');
 // ---- The painter ----
 const prompt=artPrompt({campaignId:'c',kind:'portrait',id:'keeper-w',name:'Thora',description:'A woman. A dwarf smith.',setting:''});
 assert.match(prompt,/no beard, moustache or stubble of any kind, whatever her species \(a dwarf woman has no beard\)/);assert.equal(revision,4);
 assert.ok(!/no beard/.test(artPrompt({campaignId:'c',kind:'landscape',id:'inn',name:'Inn',description:'An inn.',setting:''})));
 console.log('Passed: the Dungeon Master is asked for new lands (and far journeys are allowed only into one), for each new person\'s gender and view of the hero\'s kind, and for a note on every found thing, with malformed extras tidied, never fatal; the story writer is asked for a land, a layout, landmarks and people with gender and regard under a strict schema; portraits of women are painted without beards.');
})().catch(e=>{console.error(e);process.exit(1);});
