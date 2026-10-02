const assert=require('node:assert/strict');
// Holding the Dungeon Master to what the player asked (dm-intent.cjs and the second look in dm-server.cjs): the plain
// facts it is shown, which replies get a second look, and when the game acts itself.
const {situation,secondLook,settled,namedJourneys}=require('./dm-intent.cjs');
const {generate,sceneFor,turnEffort}=require('./dm-server.cjs');
const places=[{id:'inn',name:'Caravan Camp'},{id:'bridge',name:'Overgrown Roadside'},{id:'tower',name:'Lookout Rock'},{id:'p1',name:'Tern Ferry'},{id:'p2',name:'Old Ferry Road'}];
const base={stage:'inn',enemyHP:16,foeFate:null,story:{foe:'Bandit Cutthroat'},world:{current:{id:'inn',name:'Caravan Camp'},knownPlaces:places,canDiscover:true},
 choices:[{id:'travel-bridge',label:'Travel to Overgrown Roadside'},{id:'travel-tower',label:'Travel to Lookout Rock'},{id:'travel-p1',label:'Travel to Tern Ferry'},{id:'long-rest',label:'Rest'},{id:'short-rest',label:'Short rest'},{id:'potion',label:'Drink a healing draught'}]};
const quiet={narration:'The camp is quiet.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null};
const look=(input,reply=quiet,context=base)=>secondLook({input,context},reply,{canDiscover:!!context.world?.canDiscover});
// What is true now, in plain sentences.
let now=situation(base);
assert.ok(now[0]==='The player is at Caravan Camp.'&&now.some(l=>l.startsWith('No fight is in progress'))&&now.some(l=>l==='Bandit Cutthroat is not at Caravan Camp and is not attacking the player.'));
assert.ok(now.at(-1).includes('Lookout Rock (travel-tower)')&&now.at(-1).includes('Nothing has to happen first'));
assert.ok(situation({...base,foeFate:'slain',enemyHP:0}).includes('Bandit Cutthroat is dead and no longer a threat.'));
assert.ok(situation({...base,foeFate:'subdued',enemyHP:0}).includes('Bandit Cutthroat is beaten and no longer a threat.'));
now=situation({...base,stage:'combat',encounter:{name:'Bandit Cutthroat'}});
assert.ok(now.includes('A fight is in progress against Bandit Cutthroat.')&&!now.some(l=>l.includes('set out')||l.includes('not attacking')));
assert.ok(situation({...base,stage:'dying',dying:{failures:1}}).some(l=>l.includes('down and dying')));
assert.deepEqual(situation({choices:[]}),['No fight is in progress here: nothing is attacking the player, who is free to act, talk, rest where it is offered and travel.']);
// The model reads them first.
assert.deepEqual(Object.keys(sceneFor({input:'x',context:base},{}).context)[0],'now');
// Which place the words name: the whole name, or a word no other known place shares.
const named=text=>namedJourneys(text,base).map(j=>j.actionId+(j.strong?'!':''));
assert.deepEqual(named('i head for the lookout'),['travel-tower!']);assert.deepEqual(named('i walk to lookout rock'),['travel-tower!']);
assert.deepEqual(named('i climb a rock'),['travel-tower']);            // one shared, short word: named, not beyond doubt
assert.deepEqual(named('i go back to the roadside'),['travel-bridge!']);
assert.deepEqual(named('i take the ferry'),[]);                         // two known places share "ferry"
assert.deepEqual(named('i go to the tern ferry'),['travel-p1!']);
assert.deepEqual(named('i go back to the camp'),[]);                    // where they already are is no journey
// A plain request the reply ignored gets a second look; an unmistakable one may be settled by the game.
let fault=look('I head for the lookout.');
assert.equal(fault.kind,'known place');assert.equal(fault.actionId,'travel-tower');assert.equal(fault.sure,true);assert.ok(fault.note.includes('travel-tower')&&fault.note.includes('Lookout Rock'));
assert.deepEqual(settled(fault),{...quiet,narration:'You set out for Lookout Rock.',actionId:'travel-tower',rewind:false});
assert.equal(look('I walk up to the lookout rock to see what is coming.').sure,true);
fault=look('I climb a rock and look around.');assert.equal(fault.kind,'known place');assert.equal(fault.sure,false,'a doubtful name is asked about, never acted on');
// Said, planned, asked or refused journeys are never forced.
for(const words of ['I tell Oona that I will go to the lookout tomorrow.','If the road is clear I head for the lookout.','"I am going to the lookout," I say.','I plan to walk to Lookout Rock after we eat.'])assert.equal(look(words).sure,false,words);
for(const words of ['How far is the lookout?','Can I go to the lookout','I do not go to the lookout.','Where does the road to Lookout Rock lead?','I ask Oona about the lookout.','I sharpen my mace.'])assert.equal(look(words),null,words);
// A reply that acts is left alone, whatever it chose.
assert.equal(look('I head for the lookout.',{...quiet,actionId:'travel-tower'}),null);
assert.equal(look('I head for the lookout.',{...quiet,check:{skill:'Perception'}}),null);
// Setting out for somewhere new: nothing, or a known place the words never named, gets a second look (never forced).
fault=look('I follow the shore south to see what lies beyond the salt pans.');assert.equal(fault.kind,'new place');assert.equal(fault.sure,false);assert.ok(fault.note.includes('discovery')&&fault.note.includes('south'));
fault=look('I follow the shore south to see what lies beyond the salt pans.',{...quiet,actionId:'travel-p1'});assert.equal(fault.kind,'wrong place');assert.ok(fault.note.includes('Tern Ferry'));
assert.equal(look('I follow the shore south to see what lies beyond.',{...quiet,discovery:{name:'Gull Spit'}}),null);
assert.equal(look('I follow the shore south to see what lies beyond.',quiet,{...base,world:{...base.world,canDiscover:false}}),null);
assert.equal(look('I follow the road to the lookout.',{...quiet,actionId:'travel-tower'}),null,'a named place is where they are going');
// A fight that is over is not still going on.
fault=look('I look around the camp.',{...quiet,narration:'The bandit\'s ambush is still underway; you cannot simply wander off.'});assert.equal(fault.kind,'phantom fight');assert.ok(fault.note.includes('context.now'));
assert.equal(look('I look around the camp.',{...quiet,narration:'The fight is over and the road is still.'}),null);
// Rests and draughts the game offers.
fault=look('I take a short rest.');assert.equal(fault.actionId,'short-rest');assert.equal(fault.sure,true);
fault=look('I bed down and sleep.');assert.equal(fault.actionId,'long-rest');
fault=look('I drink my healing potion.');assert.equal(fault.actionId,'potion');assert.equal(settled(fault).narration,'You drink a healing draught.');
assert.equal(look('I take a short rest.',quiet,{...base,choices:base.choices.filter(c=>c.id!=='short-rest')}),null,'only what is offered');
assert.equal(look('Should I rest for the night?'),null);
// A side errand the player's words seem to settle is asked about (the game never closes one itself).
const errands={...base,quest:{openLeads:[{id:'l1',title:'Nemi\u2019s Dry Measure',hook:'Find the copper measure.'},{id:'l2',title:'The Water Debt',hook:'Destroy the slips.'}]},choices:[...base.choices,{id:'lead-done:l1',label:'Close the lead'},{id:'lead-done:l2',label:'Close the lead'}]};
fault=look('I put the copper ration measure in Nemi\'s hands. "This was your family\'s."',quiet,errands);assert.equal(fault.kind,'lead');assert.equal(fault.sure,false);assert.ok(fault.note.includes('lead-done:l1')&&!fault.note.includes('lead-done:l2'));
assert.equal(look('I burn the debt slips in the brazier.',quiet,errands).kind,'lead');
assert.equal(look('I ask Nemi about the measure.',quiet,errands),null);assert.equal(look('I hand Nemi the measure.',{...quiet,actionId:'lead-done:l1'},errands),null);
assert.equal(look('I hand Nemi the measure.',quiet,{...errands,choices:base.choices}),null,'only a lead the game offers to close');
// Never during a fight, a spell ruling, a resolved turn, a scene cue or out of character.
for(const extra of [{stage:'combat'},{encounter:{name:'Wolf'}},{npcCombat:{active:true}},{stage:'dying'},{engineResolved:['x']},{sceneTrigger:{cue:'x'}},{outOfCharacter:{}},{pendingSpell:{id:'x'}}])assert.equal(look('I head for the lookout.',quiet,{...base,...extra}),null,JSON.stringify(extra));
// The whole turn, with a stand-in model: what it is asked, how often, and what comes back.
const scripted=replies=>{const calls=[];const fetchImpl=async(url,options)=>{const request=JSON.parse(options.body);calls.push(request);const reply=replies[Math.min(calls.length-1,replies.length-1)];if(reply instanceof Error)throw reply;return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})};};return {fetchImpl,calls};};
const turn=async(input,replies,context=base)=>{const s=scripted(replies);const reply=await generate({input,context},{apiKey:'test-only',model:'test-model',fetchImpl:s.fetchImpl});return {reply,calls:s.calls};};
(async()=>{
 // Acted first time: one request.
 let r=await turn('I head for the lookout.',[{...quiet,actionId:'travel-tower',narration:'You climb toward the rock.'}]);
 assert.equal(r.calls.length,1);assert.equal(r.reply.actionId,'travel-tower');assert.ok(!r.calls[0].instructions.includes('LOOK AGAIN'));
 assert.ok(JSON.parse(r.calls[0].input).context.now[0]==='The player is at Caravan Camp.');
 // Refused, then acted when asked again: the second reply is the one that counts.
 r=await turn('I head for the lookout.',[{...quiet,narration:'The ambush is still underway; you cannot leave.'},{...quiet,actionId:'travel-tower',narration:'You climb toward the rock.'}]);
 assert.equal(r.calls.length,2);assert.ok(r.calls[1].instructions.includes('LOOK AGAIN')&&r.calls[1].instructions.includes('travel-tower'));assert.equal(r.reply.actionId,'travel-tower');assert.equal(r.reply.narration,'You climb toward the rock.');
 assert.ok(r.calls[1].instructions.startsWith(r.calls[0].instructions),'the note follows the standing instructions, which stay cached');
 // Refused twice, and the request is unmistakable: the game sets out itself.
 r=await turn('I head for the lookout.',[{...quiet,narration:'You should wait for the captain.'}]);
 assert.equal(r.calls.length,2);assert.equal(r.reply.actionId,'travel-tower');assert.equal(r.reply.narration,'You set out for Lookout Rock.');assert.deepEqual(r.reply.dialogue,[]);
 // Refused twice, and the words leave room for doubt: the second answer stands.
 r=await turn('I tell Oona I will go to the lookout tomorrow.',[{...quiet,narration:'She nods.'},{...quiet,narration:'Oona grunts her approval.'}]);
 assert.equal(r.calls.length,2);assert.equal(r.reply.actionId,null);assert.equal(r.reply.narration,'Oona grunts her approval.');
 // The second request failing leaves the first answer (or the game's own action when the request is unmistakable).
 r=await turn('I climb a rock and look around.',[{...quiet,narration:'You see the road.'},Error('provider down')]);
 assert.equal(r.calls.length,2);assert.equal(r.reply.narration,'You see the road.');
 r=await turn('I take a short rest.',[{...quiet,narration:'You sit a moment.'},Error('provider down')]);
 assert.equal(r.reply.actionId,'short-rest');
 // Questions, fights and resolved turns are answered once.
 for(const [input,context] of [['How far is the lookout?',base],['I head for the lookout.',{...base,stage:'combat'}],['I sharpen my mace.',base]]){r=await turn(input,[quiet],context);assert.equal(r.calls.length,1,input);assert.equal(r.reply.actionId,null);}
 // A new place asked for and not given is asked for once more.
 r=await turn('I follow the shore south to see what lies beyond the salt pans.',[{...quiet,actionId:'travel-p1'},{...quiet,narration:'Reeds give way to a spit of shingle.',discovery:{name:'Gull Spit',description:'A long spit of shingle where the estuary meets the sea, strewn with wrack and the ribs of a boat.',kind:'water',bearing:'S',miles:2,travel:true,danger:'safe',feature:'The ribs of a wrecked boat.',lair:null,region:null}}]);
 assert.equal(r.calls.length,2);assert.equal(r.reply.discovery?.name,'Gull Spit');assert.equal(r.reply.actionId,null);
 // A reply that cannot be used is asked for once more, with the reason; twice unusable is an error as before.
 r=await turn('I sharpen my mace.',[{...quiet,actionId:'invent-gold'},{...quiet,narration:'Steel sings on the whetstone.'}]);
 assert.equal(r.calls.length,2);assert.ok(r.calls[1].instructions.includes('could not be used'));assert.equal(r.reply.narration,'Steel sings on the whetstone.');
 await assert.rejects(turn('I sharpen my mace.',[{...quiet,actionId:'invent-gold'}]),/invalid response/);
 // A momentary rate limit at the provider is waited out; no credit is reported at once.
 {const calls=[];const limited=async()=>{calls.push(Date.now());if(calls.length===1)return {ok:false,status:429,headers:{get:()=>'1'},json:async()=>({error:{code:'rate_limit_exceeded'}})};return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(quiet)}]}]})};};
  const reply=await generate({input:'I sharpen my mace.',context:base},{apiKey:'test-only',model:'test-model',fetchImpl:limited});
  assert.equal(calls.length,2);assert.ok(calls[1]-calls[0]>=1400,'waited before asking again');assert.equal(reply.narration,'The camp is quiet.');
  let asked=0;await assert.rejects(generate({input:'I sharpen my mace.',context:base},{apiKey:'test-only',model:'test-model',fetchImpl:async()=>{asked++;return {ok:false,status:429,json:async()=>({error:{code:'insufficient_quota'}})};}}),/usage limit/);assert.equal(asked,1);}
 // How hard the play model thinks can be changed live by the host.
 assert.equal(turnEffort('none',()=>null),'none');assert.equal(turnEffort('none',()=>'low'),'low');assert.equal(turnEffort('none',()=>'banana'),'none');
 console.log('Second look: plain requests are acted on, doubtful ones asked about, questions and fights left alone.');
})().catch(e=>{console.error(e);process.exit(1);});
